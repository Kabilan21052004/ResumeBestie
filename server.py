
import os
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from groq import Groq
from naukri_search import search_naukri
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Build path for static files
BUILD_DIR = os.path.join(os.path.dirname(__file__), "dist")

load_dotenv()

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve React Static Files (Build)
if os.path.exists(BUILD_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(BUILD_DIR, "assets")), name="assets")

# API Routes above this...

# ... (Existing Routes) ...

# Catch-all for React Router (must be last or properly ordered)
# We will add this at the END of the file usually, but for now let's add a function to return index.html
@app.get("/")
async def serve_index():
    if os.path.exists(os.path.join(BUILD_DIR, "index.html")):
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
    return {"message": "Development API Server Running. Build frontend to see UI."}

# Initialize Groq Client
# Ensure GROQ_API_KEY is set in .env
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

# Supabase Database Handling
def get_db_connection():
    return psycopg2.connect(os.environ.get("SUPABASE_DB_URL"))

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_resumes (
            google_id TEXT PRIMARY KEY,
            email TEXT,
            name TEXT,
            resume_data JSONB,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized.")

init_db()

class Job(BaseModel):
    title: str
    company: str
    salary_range: str
    apply_link: str
    match_score: float

class AnalysisResponse(BaseModel):
    personal_info: dict
    predicted_role: str
    executive_summary: str
    skills: List[str]
    experience_years: str
    improvements: List[dict]
    jobs: List[dict]

@app.post("/api/analyze")
async def analyze_resume(request: Request, file: UploadFile = File(...)):
    print(f"Received file: {file.filename}")
    
    try:
        # 1. Read file content
        content = await file.read()
        
        # NOTE: For this iteration, I will add a basic PDF text extractor.
        import io
        from pypdf import PdfReader
        
        try:
            pdf_file = io.BytesIO(content)
            reader = PdfReader(pdf_file)
            text_content = ""
            for page in reader.pages:
                text_content += page.extract_text() or ""
        except ImportError:
            print("pypdf not installed. Using dummy content.")
            text_content = "Resume content could not be extracted (pypdf missing). Analyze as a generic Software Engineer."
        except Exception as e:
            print(f"PDF extraction error: {e}")
            text_content = "Resume content extraction failed."

        # 2. Analyze with Groq
        system_prompt = """
        You are an elite career coach. Analyze the resume text provided and extract ALL relevant information.
        Return a strict JSON object with this comprehensive schema:
        {
          "personal_info": { 
            "name": "String", 
            "email": "String",
            "phone": "String (optional)",
            "linkedin": "String (optional)",
            "github": "String (optional)",
            "portfolio": "String (optional)"
          },
          "predicted_role": "String",
          "executive_summary": "String (2-3 sentences about the candidate)",
          "skills": ["String"],
          "experience_years": "String (total years)",
          "education": [
            {
              "degree": "String",
              "institution": "String",
              "year": "String",
              "gpa": "String (optional)"
            }
          ],
          "certifications": [
            {
              "name": "String",
              "issuer": "String (optional)",
              "date": "String (optional)"
            }
          ],
          "projects": [
            {
              "name": "String",
              "description": "String (brief)",
              "technologies": ["String"],
              "link": "String (optional)"
            }
          ],
          "work_experience": [
            {
              "company": "String",
              "role": "String",
              "duration": "String",
              "responsibilities": ["String"]
            }
          ],
          "achievements": ["String (notable achievements, awards, publications)"],
          "improvements": [{ "type": "critical" | "recommended", "suggestion": "String" }],
          "search_params": { "keyword": "String (best job title)", "location": "String", "experience": "Number (years)" }
        }
        
        CRITICAL INSTRUCTIONS:
        1. Extract ALL sections present in the resume. If a section is missing, use an empty array [].
        2. The 'search_params' should infer the best job title keyword, location (default to 'India' or 'Remote' if not found), and years of experience.
        3. For 'improvements', provide SPECIFIC, ACTIONABLE advice:
           - ❌ BAD: "Gain more experience" or "Tailor resume to job openings"
           - ✅ GOOD: "Add quantifiable metrics to your project descriptions (e.g., 'Reduced API response time by 40%')"
           - ✅ GOOD: "Include specific technologies used in each project (e.g., 'Built with React, Node.js, PostgreSQL')"
           - ✅ GOOD: "Add a 'Summary' section at the top highlighting your 3 strongest technical skills"
           - Focus on: missing sections, weak descriptions, lack of metrics, formatting issues, missing keywords for ATS
           - Each suggestion should be something they can implement TODAY
        """

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"Resume Text:\n{text_content[:15000]}" # Limit context
                }
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
        )

        result_json = chat_completion.choices[0].message.content
        analysis_data = json.loads(result_json)
        
        # 3. Search Naukri with real params
        search_params = analysis_data.get("search_params", {})
        keyword = search_params.get("keyword", "Software Engineer")
        location = search_params.get("location", "Bangalore")
        experience = str(search_params.get("experience", "0"))
        skills = analysis_data.get("skills", [])
        
        print(f"Groq suggested search: {keyword} in {location} ({experience} yrs)")
        
        real_jobs = search_naukri(keyword, location, experience, candidate_skills=skills)
        
        # 4. Merge results
        analysis_data["jobs"] = real_jobs
        
        # 5. Save/Update in Supabase
        # Get google_id from REQUEST headers (not file headers)
        google_id = request.headers.get("X-Google-Id")
        if google_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                print(f"Attempting to save resume for Google ID: {google_id}") # DEBUG LOG
                
                # Verify passed data isn't empty
                email_val = analysis_data.get("personal_info", {}).get("email")
                name_val = analysis_data.get("personal_info", {}).get("name")
                
                cur.execute("""
                    INSERT INTO user_resumes (google_id, email, name, resume_data, updated_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (google_id) DO UPDATE SET
                        resume_data = EXCLUDED.resume_data,
                        updated_at = NOW()
                """, (
                    google_id,
                    email_val,
                    name_val,
                    json.dumps(analysis_data)
                ))
                conn.commit()
                cur.close()
                conn.close()
                print(f"Resume saved successfully for user: {google_id}")
            except Exception as db_err:
                print(f"CRITICAL DATABASE ERROR during save: {db_err}")
                import traceback
                traceback.print_exc()
        else:
            print("WARNING: No X-Google-Id header found in request. Resume NOT saved.")
                
        return analysis_data

    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str
    context: dict  # Pass necessary context about the candidate

@app.post("/api/chat")
async def chat_agent(request: ChatRequest):
    try:
        system_prompt = f"""
        You are the "Career Bestie" - a high-energy, empathetic, and ultra-supportive career concierge. 
        Your mission is to help {request.context.get('name', 'Bestie')} secure the bag and achieve their {request.context.get('role', 'dream role')}.

        PERSONALITY GUIDELINES:
        - Use Gen-Z/Millennial "Bestie" energy: "I see you!", "Main character energy", "Securing the bag", "💅✨", "Vibes".
        - BE EMPATHETIC: Before giving career advice, acknowledge any emotions or concerns the user expresses. If they are nervous, give them a pep talk.
        - BE MOTIVATIONAL: Remind them of their strengths based on their skills: {', '.join(request.context.get('skills', []))}.
        - BE STRATEGIC: Your advice must still be elite and professionally sound, just delivered with flair.
        - Be concise but punchy.

        CANDIDATE CONTEXT:
        Name: {request.context.get('name', 'Candidate')}
        Target Role: {request.context.get('role', 'Job Seeker')}
        Skills: {', '.join(request.context.get('skills', []))}
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            model="llama-3.3-70b-versatile",
        )
        
        return {"response": chat_completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AuthRequest(BaseModel):
    credential: str

@app.post("/api/auth/google")
async def verify_google_auth(request: AuthRequest):
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        client_id = os.environ.get("VITE_GOOGLE_CLIENT_ID")
        if not client_id or client_id == "YOUR_GOOGLE_CLIENT_ID":
            print("Warning: Google Client ID not configured.")
            # During dev, if client id isn't set, we can allow mock success if the user wants,
            # but for real security, we must verify.
            
        # Verify the ID token
        id_info = id_token.verify_oauth2_token(
            request.credential, 
            requests.Request(), 
            client_id
        )

        google_id = id_info.get("sub")
        email = id_info.get("email")
        name = id_info.get("name")
        picture = id_info.get("picture")

        # Check for existing resume in Supabase AND Upsert User
        existing_resume = None
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # 1. Upsert User (Ensure they exist)
            cur.execute("""
                INSERT INTO user_resumes (google_id, email, name, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (google_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    updated_at = NOW()
            """, (google_id, email, name))
            conn.commit()
            print(f"User synced to DB: {email}")

            # 2. Check for existing resume
            cur.execute("SELECT resume_data FROM user_resumes WHERE google_id = %s", (google_id,))
            row = cur.fetchone()
            if row:
                existing_resume = row['resume_data']
            
            cur.close()
            conn.close()
        except Exception as db_err:
            print(f"Database error during login check/upsert: {db_err}")

        return {
            "success": True,
            "email": email,
            "name": name,
            "picture": picture,
            "uid": google_id,
            "existing_resume": existing_resume
        }
    except Exception as e:
        print(f"Auth verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
