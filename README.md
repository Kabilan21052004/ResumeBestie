# ResumeBestie 💅✨

> **Your AI Career Concierge.** Turn your PDF resume into a main character moment and secure the bag with elite AI analysis.

ResumeBestie is a premium, high-energy AI application that analyzes your resume, gives you "roast & toast" feedback, and instantly matches you with live job openings on Naukri.com.

![ResumeBestie Screenshot](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## ✨ Features

- **📄 AI Resume Analysis**: Uses **Llama-3-70b (via Groq)** to deeply analyze your resume's strengths, weaknesses, and vibe.
- **💅 "Bestie" Persona**: Feedback is delivered in a supportive, Gen-Z "bestie" tone. No boring corporate speak.
- **🔍 Live Job Matching**: Automatically searches **Naukri.com** for real-time jobs that match your skills and experience level.
- **💾 Session Persistence**: Log in once, stay logged in. Your data is saved to **Supabase** so you never lose your progress.
- **💬 AI Career Chat**: Chat with your "Career Concierge" to get specific advice on interview prep, salary negotiation, and more.
- **🎨 Premium UI**: Glassmorphism design, dotted glow backgrounds, and smooth animations.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), TypeScript, CSS Modules (Glassmorphism)
- **Backend**: Python (FastAPI), Uvicorn
- **AI Model**: Llama-3-70b-versatile (via Groq API)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Google OAuth + JWT
- **Deployment**: Render / Vercel

## 🚀 Run Locally

### Prerequisites
- Node.js & npm
- Python 3.9+
- A Supabase project
- A Groq API Key
- A Google Cloud Console Project (for OAuth)

### 1. Clone & Install
```bash
git clone https://github.com/Kabilan21052004/ResumeBestie.git
cd ResumeBestie

# Install Frontend Dependencies
npm install

# Install Backend Dependencies
pip install -r requirements.txt
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
# AI & Auth
GROQ_API_KEY=your_groq_api_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Database (Supabase Session Pooler Recommended)
SUPABASE_DB_URL=postgresql://postgres.user:password@aws-0-region.pooler.supabase.com:5432/postgres
```

### 3. Run the App
You need two terminals:

**Terminal 1 (Frontend)**
```bash
npm run dev
```

**Terminal 2 (Backend)**
```bash
python server.py
# Server runs on http://localhost:8000
```

## 🌍 Deployment

This project is configured for **Render.com**.

1. **Build Command**: `npm install && npm run build && pip install -r requirements.txt`
2. **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
3. **Environment**: Add your `.env` variables to the Render dashboard.

## 🤝 Contributing

Pull requests are vibe-checked! Feel free to open an issue or submit a PR.

---

*Made with 💖 and a lot of caffeine by Kabilan.*
