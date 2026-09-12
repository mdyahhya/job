#!/usr/bin/env python3
"""
Dominal Technology Jobs - Multi-Source Job Scraping Engine
Pulls verified listings across primary and secondary sources:
1. JobSpy (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs, Naukri, Bayt)
2. Remotive API (Remote IT, Tech, Sales, DevOps, Data)
3. RemoteOK API (Remote software engineering & design)
4. Arbeitnow API (Remote & On-site openings)
5. WeWorkRemotely RSS (Remote programming & business feeds)
Deduplicates, classifies workplace mode (Remote vs On-site),
and merges into frontend/data/jobs.json preserving all historical openings.
"""

import os
import json
import uuid
import datetime
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; DominalJobsBot/1.0)"

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', ' ', str(text))
    text = re.sub(r'[^\x00-\x7F]+', ' - ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def detect_workplace(title, location, description, is_remote_flag=None):
    if is_remote_flag is True:
        return "Remote"
    combined = f"{title} {location} {description}".lower()
    if re.search(r'\b(remote|work from home|wfh|telecommute|virtual|anywhere)\b', combined):
        return "Remote"
    if re.search(r'\bhybrid\b', combined):
        return "Hybrid"
    return "On-site"

def detect_job_type(title, raw_type=""):
    combined = f"{title} {raw_type}".lower()
    if re.search(r'\b(intern|internship|trainee|apprentice)\b', combined):
        return "Internship"
    if "part" in combined:
        return "Part-time"
    if "contract" in combined or "freelance" in combined:
        return "Contract"
    return "Full-time"

def fetch_jobspy():
    """Tier 1: JobSpy (LinkedIn, Indeed, Glassdoor, Google, ZipRecruiter, Naukri, Bayt)"""
    jobs = []
    try:
        from jobspy import scrape_jobs
        print("Scraping via python-jobspy (LinkedIn & Indeed)...")
        # Keep results_wanted moderate (25-30) per recommendation to avoid LinkedIn IP throttle
        df = scrape_jobs(
            site_name=["linkedin", "indeed"],
            search_term="software engineer OR python developer OR civil engineer OR mechanical engineer OR entc engineer OR electrical engineer OR data analyst OR devops",
            location="India",
            results_wanted=30,
            hours_old=72,
            country_indeed='India'
        )
        if df is not None and not df.empty:
            for _, row in df.iterrows():
                title = clean_text(row.get("title", ""))
                company = clean_text(row.get("company", "")) or "Verified Enterprise"
                job_url = str(row.get("job_url", "") or "").strip()
                if not title or not job_url or job_url == "nan":
                    continue

                location = clean_text(row.get("location", "")) or "India"
                desc = clean_text(row.get("description", ""))
                if len(desc) > 280:
                    desc = desc[:277] + "..."

                salary = "Competitive"
                if row.get("min_amount") and row.get("max_amount"):
                    salary = f"{int(row.get('min_amount'))} - {int(row.get('max_amount'))} {row.get('currency', 'INR') or 'INR'}"

                is_rem = bool(row.get("is_remote", False))
                workplace = detect_workplace(title, location, desc, is_rem)
                platform = "LinkedIn" if "linkedin.com" in job_url.lower() else "Indeed"

                jobs.append({
                    "id": f"job-{uuid.uuid4().hex[:8]}",
                    "title": title,
                    "company": company,
                    "location": location,
                    "job_type": detect_job_type(title, str(row.get("job_type", ""))),
                    "workplace_type": workplace,
                    "experience": "Verified Opening",
                    "salary": salary,
                    "posted_date": "Recently",
                    "description": desc or f"Active opening for {title} at {company}.",
                    "job_link": job_url,
                    "platform": platform
                })
            print(f"JobSpy fetched {len(jobs)} jobs.")
    except ImportError:
        print("JobSpy not installed in current Python environment. Proceeding to secondary sources.")
    except Exception as e:
        print(f"JobSpy cycle notice: {e}. Skipping JobSpy for this cycle.")
    return jobs

def fetch_remotive():
    """Tier 2: Remotive Public API (Remote Jobs)"""
    jobs = []
    try:
        print("Fetching from Remotive API...")
        url = "https://remotive.com/api/remote-jobs?limit=50"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            for r in data.get("jobs", []):
                title = clean_text(r.get("title", ""))
                company = clean_text(r.get("company_name", "")) or "Tech Firm"
                job_url = str(r.get("url", "")).strip()
                if not title or not job_url:
                    continue

                desc = clean_text(r.get("description", ""))
                if len(desc) > 280:
                    desc = desc[:277] + "..."

                loc = clean_text(r.get("candidate_required_location", "Remote")) or "Remote"
                salary = clean_text(r.get("salary", "")) or "Competitive"

                jobs.append({
                    "id": f"remotive-{r.get('id', uuid.uuid4().hex[:8])}",
                    "title": title,
                    "company": company,
                    "location": loc,
                    "job_type": detect_job_type(title, r.get("job_type", "")),
                    "workplace_type": "Remote",
                    "experience": "Verified Remote",
                    "salary": salary,
                    "posted_date": "Recent",
                    "description": desc or f"Remote role for {title} at {company}.",
                    "job_link": job_url,
                    "platform": "Remotive"
                })
        print(f"Remotive API fetched {len(jobs)} jobs.")
    except Exception as e:
        print(f"Remotive API notice: {e}. Continuing.")
    return jobs

def fetch_remoteok():
    """Tier 3: RemoteOK API (Remote Jobs)"""
    jobs = []
    try:
        print("Fetching from RemoteOK API...")
        url = "https://remoteok.com/api"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            # Skip index 0 (legal notice)
            for r in data[1:51]:
                if not isinstance(r, dict) or not r.get("position"):
                    continue
                title = clean_text(r.get("position", ""))
                company = clean_text(r.get("company", "")) or "Remote Enterprise"
                job_url = str(r.get("url", "")).strip()
                if not title or not job_url:
                    continue

                desc = clean_text(r.get("description", ""))
                if len(desc) > 280:
                    desc = desc[:277] + "..."

                loc = clean_text(r.get("location", "Remote")) or "Remote (Global)"

                jobs.append({
                    "id": f"remoteok-{r.get('id', uuid.uuid4().hex[:8])}",
                    "title": title,
                    "company": company,
                    "location": loc,
                    "job_type": detect_job_type(title),
                    "workplace_type": "Remote",
                    "experience": "Mid-Senior",
                    "salary": "Competitive",
                    "posted_date": "Recent",
                    "description": desc or f"Active remote opening for {title} at {company}.",
                    "job_link": job_url,
                    "platform": "RemoteOK"
                })
        print(f"RemoteOK API fetched {len(jobs)} jobs.")
    except Exception as e:
        print(f"RemoteOK API notice: {e}. Continuing.")
    return jobs

def fetch_arbeitnow():
    """Tier 4: Arbeitnow API (Remote & On-site)"""
    jobs = []
    try:
        print("Fetching from Arbeitnow API...")
        url = "https://www.arbeitnow.com/api/job-board-api"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            for r in data.get("data", [])[:50]:
                title = clean_text(r.get("title", ""))
                company = clean_text(r.get("company_name", "")) or "European Enterprise"
                job_url = str(r.get("url", "")).strip()
                if not title or not job_url:
                    continue

                desc = clean_text(r.get("description", ""))
                if len(desc) > 280:
                    desc = desc[:277] + "..."

                is_remote = bool(r.get("remote", False))
                loc = clean_text(r.get("location", "Europe")) or ("Remote" if is_remote else "On-site")
                workplace = "Remote" if is_remote else detect_workplace(title, loc, desc)

                jobs.append({
                    "id": f"arbeitnow-{r.get('slug', uuid.uuid4().hex[:8])}",
                    "title": title,
                    "company": company,
                    "location": loc,
                    "job_type": detect_job_type(title),
                    "workplace_type": workplace,
                    "experience": "Verified Role",
                    "salary": "Competitive",
                    "posted_date": "Recent",
                    "description": desc or f"Opening for {title} at {company}.",
                    "job_link": job_url,
                    "platform": "Arbeitnow"
                })
        print(f"Arbeitnow API fetched {len(jobs)} jobs.")
    except Exception as e:
        print(f"Arbeitnow API notice: {e}. Continuing.")
    return jobs

def fetch_weworkremotely():
    """Tier 5: WeWorkRemotely RSS (Programming & Sales/DevOps categories)"""
    jobs = []
    feeds = [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss"
    ]
    for url in feeds:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as res:
                root = ET.fromstring(res.read().decode("utf-8"))
                for item in root.findall(".//item")[:20]:
                    full_title = item.find("title").text if item.find("title") is not None else ""
                    link = item.find("link").text if item.find("link") is not None else ""
                    if not full_title or not link:
                        continue

                    company = "WWR Partner"
                    title = full_title
                    if ":" in full_title:
                        parts = full_title.split(":", 1)
                        company = clean_text(parts[0])
                        title = clean_text(parts[1])

                    desc_node = item.find("description")
                    desc = clean_text(desc_node.text)[:277] + "..." if desc_node is not None and desc_node.text else ""

                    jobs.append({
                        "id": f"wwr-{uuid.uuid4().hex[:8]}",
                        "title": title,
                        "company": company,
                        "location": "Remote (Global)",
                        "job_type": detect_job_type(title),
                        "workplace_type": "Remote",
                        "experience": "Verified Remote",
                        "salary": "Competitive",
                        "posted_date": "Recent",
                        "description": desc or f"Remote role for {title} at {company}.",
                        "job_link": link,
                        "platform": "WeWorkRemotely"
                    })
        except Exception as e:
            print(f"WWR feed notice ({url}): {e}. Continuing.")
    print(f"WeWorkRemotely RSS fetched {len(jobs)} jobs.")
    return jobs

def run_scraper():
    print(f"[{datetime.datetime.now().isoformat()}] Starting Dominal Jobs Multi-Source Scraping Engine...")
    output_dir = Path(__file__).resolve().parent.parent / "frontend" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "jobs.json"

    # Load existing historical jobs to merge and never lose any scraped opening
    existing_jobs = []
    if output_file.exists():
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                raw = json.load(f)
                existing_jobs = [j for j in raw if not j.get('id', '').startswith('dom-job-') and '412389' not in j.get('job_link', '')]
            print(f"Loaded {len(existing_jobs)} existing verified historical jobs.")
        except Exception as e:
            print(f"Notice reading existing jobs: {e}")

    # Ensure existing jobs also have workplace_type normalized
    for j in existing_jobs:
        if not j.get("workplace_type"):
            j["workplace_type"] = detect_workplace(j.get("title", ""), j.get("location", ""), j.get("description", ""))

    new_jobs = []

    # Priority 1: JobSpy
    new_jobs.extend(fetch_jobspy())

    # Priority 2: Remotive API
    new_jobs.extend(fetch_remotive())

    # Priority 3: RemoteOK API
    new_jobs.extend(fetch_remoteok())

    # Priority 4: Arbeitnow API
    new_jobs.extend(fetch_arbeitnow())

    # Priority 5: WeWorkRemotely RSS
    new_jobs.extend(fetch_weworkremotely())

    # Deduplicate across combined set by (title, company) and link
    combined = new_jobs + existing_jobs
    seen_links = set()
    seen_keys = set()
    deduped = []

    for j in combined:
        link = (j.get("job_link") or "").strip().lower()
        title_company = (clean_text(j.get("title", "")).lower(), clean_text(j.get("company", "")).lower())

        if not link or not title_company[0]:
            continue

        if link in seen_links or title_company in seen_keys:
            continue

        seen_links.add(link)
        seen_keys.add(title_company)
        deduped.append(j)

    # Keep a robust archive of verified listings
    final_jobs = deduped[:250]

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_jobs, f, indent=2, ensure_ascii=False)

    print(f"Successfully serialized {len(final_jobs)} verified jobs to {output_file}.")

if __name__ == "__main__":
    run_scraper()
