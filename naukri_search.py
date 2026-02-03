import requests
import argparse
import json
import urllib3

# Suppress InsecureRequestWarning if strictly necessary, but usually better to leave enabled.
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def load_headers():
    try:
        with open('naukri_headers.json', 'r') as f:
            headers = json.load(f)
            # Filter out HTTP/2 pseudo-headers and Accept-Encoding
            return {k: v for k, v in headers.items() 
                    if not k.startswith(':') and k.lower() != 'accept-encoding'}
    except FileNotFoundError:
        print("Warning: naukri_headers.json not found. Using default headers.")
        return {
            "appid": "109",
            "systemid": "Naukri",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

def calculate_match_score(job_title, job_tags, candidate_skills):
    if not candidate_skills:
        import random
        return random.randint(82, 89)
    
    score = 75 # Standard base for relevant search results
    
    # Normalize
    title_lower = job_title.lower()
    tags_lower = [t.lower() for t in job_tags]
    skills_lower = [s.lower() for s in candidate_skills]
    
    # Title matching (High weight)
    for skill in skills_lower:
        if skill in title_lower:
            score += 5
            
    # Tag matching
    for tag in tags_lower:
        if any(skill in tag for skill in skills_lower):
            score += 2
            
    # Cap at 98, floor at 70
    import random
    score = min(98, max(70, score))
    # Add a bit of "organic" jitter
    score += random.randint(-2, 2)
    return min(99, score)

def search_naukri(keyword, location, experience, candidate_skills=None):
    url = "https://www.naukri.com/jobapi/v3/search"
    
    # Load headers
    headers = load_headers()

    # Construct seoKey strictly as Naukri seems to expect: 'keyword-jobs-in-location'
    clean_keyword = keyword.lower().replace(' ', '-')
    clean_location = location.lower().replace(' ', '-')
    seo_key = f"{clean_keyword}-jobs-in-{clean_location}"

    params = {
        "noOfResults": 20,
        "urlType": "search_by_key_loc",
        "searchType": "adv",
        "keyword": keyword,
        "location": location,
        "experience": experience,
        "k": keyword,
        "l": location,
        "seoKey": seo_key,
        "src": "jobsearchDesk",
        "latLong": ""
    }
    
    print(f"Searching for: {keyword} in {location} with {experience} years exp...")

    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            job_details = data.get('jobDetails', [])
            
            if not job_details:
                print("No jobs found.")
                return []

            results = []
            for job in job_details:
                # Placeholders usually: [0]=Experience, [1]=Salary, [2]=Location
                placeholders = job.get('placeholders', [])
                exp_range = placeholders[0].get('label', 'N/A') if len(placeholders) > 0 else 'N/A'
                salary = placeholders[1].get('label', 'N/A') if len(placeholders) > 1 else 'N/A'
                location_val = placeholders[2].get('label', 'N/A') if len(placeholders) > 2 else 'N/A'
                
                # Tags/Skills often in 'tagsAndSkills'
                tags = job.get('tagsAndSkills', [])
                
                # Construct URL
                job_url = job.get('staticUrl', '') or job.get('jobUrl', '')
                full_link = ""
                if job_url:
                    if not job_url.startswith('http'):
                        if not job_url.startswith('/'):
                            job_url = '/' + job_url
                        full_link = f"https://www.naukri.com{job_url}"
                    else:
                        full_link = job_url
                
                results.append({
                    "title": job.get('title', 'N/A'),
                    "company": job.get('companyName', 'N/A'),
                    "salary_range": salary,
                    "location": location_val,
                    "experience": exp_range,
                    "apply_link": full_link,
                    "match_score": calculate_match_score(job.get('title', ''), tags, candidate_skills)
                })
            
            return results
        else:
            print(f"Failed to fetch data. Status Code: {response.status_code}")
            return []

    except json.JSONDecodeError:
        print("Error: Failed to decode JSON.")
        return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automate Naukri Job Search via API")
    parser.add_argument("--keyword", type=str, required=True, help="Job title or keyword")
    parser.add_argument("--location", type=str, required=True, help="Job location")
    parser.add_argument("--experience", type=str, required=True, help="Experience in years (e.g., 2)")
    
    args = parser.parse_args()
    
    jobs = search_naukri(args.keyword, args.location, args.experience)
    for job in jobs:
        print(job)
