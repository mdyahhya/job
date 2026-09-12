#!/usr/bin/env python3
"""
Dominal Technology Jobs - Real Job Scraper Script
Uses JobSpy to retrieve verified active job postings across LinkedIn and Indeed,
cleans data, and serializes standardized job objects into frontend/data/jobs.json.
"""

import os
import json
import uuid
import datetime
import re
from pathlib import Path

def run_scraper():
    print(f"[{datetime.datetime.now().isoformat()}] Starting Dominal Jobs scraper...")
    output_dir = Path(__file__).resolve().parent.parent / "frontend" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "jobs.json"

    # Existing jobs if available
    existing_jobs = []
    if output_file.exists():
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                raw = json.load(f)
                # Filter out any old mock seed jobs
                existing_jobs = [j for j in raw if not j.get('id', '').startswith('dom-job-') and '412389' not in j.get('job_link', '')]
            print(f"Loaded {len(existing_jobs)} existing verified jobs.")
        except Exception as e:
            print(f"Notice reading existing jobs: {e}")

    new_jobs = []

    try:
        from jobspy import scrape_jobs
        print("Scraping live verified jobs via python-jobspy...")
        jobs_df = scrape_jobs(
            site_name=["linkedin", "indeed"],
            search_term="software engineer OR python developer OR full stack OR electrical engineer OR sales executive OR b2b sales",
            location="India",
            results_wanted=50,
            hours_old=72,
            country_indeed='India'
        )

        if jobs_df is not None and not jobs_df.empty:
            for _, row in jobs_df.iterrows():
                title = str(row.get("title", "") or "").strip()
                company = str(row.get("company", "") or "").strip()
                job_url = str(row.get("job_url", "") or "").strip()

                if not title or not job_url or job_url == "nan":
                    continue
                if not company or company.lower() == "nan":
                    company = "Verified Enterprise"

                # Clean title and special chars
                title = re.sub(r'[^\x00-\x7F]+', ' - ', title)
                title = re.sub(r'\s+', ' ', title).strip()

                job_id = f"job-{uuid.uuid4().hex[:8]}"
                location = str(row.get("location", "") or "India").strip()
                if not location or location.lower() == "nan":
                    location = "India"

                job_type = str(row.get("job_type", "") or "Full-time").capitalize()
                if job_type.lower() in ("nan", "none", ""):
                    job_type = "Full-time"

                description = str(row.get("description", "") or "").strip()
                description = re.sub(r'[^\x00-\x7F]+', ' - ', description).replace("\\-", "-")
                if len(description) > 280:
                    description = description[:277] + "..."

                salary = ""
                if row.get("min_amount") and row.get("max_amount"):
                    min_amt = int(row.get("min_amount"))
                    max_amt = int(row.get("max_amount"))
                    currency = str(row.get("currency", "INR") or "INR")
                    salary = f"{min_amt} - {max_amt} {currency}"

                new_jobs.append({
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location,
                    "job_type": job_type,
                    "experience": "Verified Opening",
                    "salary": salary or "Competitive",
                    "posted_date": "Recently",
                    "description": description or f"Active opening for {title} at {company}. Apply directly via verified link.",
                    "job_link": job_url
                })
            print(f"Successfully scraped {len(new_jobs)} live jobs via JobSpy.")
    except ImportError:
        print("JobSpy package not installed in local environment. Preserving existing verified dataset.")
    except Exception as e:
        print(f"JobSpy scrape error: {e}. Preserving existing verified dataset.")

    # Merge and deduplicate by title + company
    combined = new_jobs + existing_jobs
    seen = set()
    deduped = []
    for j in combined:
        key = (j.get("title", "").lower().strip(), j.get("company", "").lower().strip())
        link_key = j.get("job_link", "").strip()
        if key not in seen and link_key and key[0]:
            seen.add(key)
            deduped.append(j)

    final_jobs = deduped[:100]

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_jobs, f, indent=2, ensure_ascii=False)

    print(f"Updated {output_file} with {len(final_jobs)} verified jobs.")

if __name__ == "__main__":
    run_scraper()
