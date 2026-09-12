# Dominal Technology Jobs - Progressive Web App (PWA)

A Progressive Web App (PWA) for automated job scraping, deterministic rule-based domain categorization, and streamlined WhatsApp sharing.

Built with **plain HTML, CSS, and Vanilla JavaScript only** — no React, no external framework, and zero build step required.

---

## Visual Design & Architecture

- **Visual Balance (70/30)**: Pure white (`#FFFFFF`) 70% canvas, Dark blue (`#0A2A5E`) 30% presence across top header, active bottom navigation, buttons, chips, and highlights with pure black (`#000000`) typography.
- **Zero Emojis Policy**: Strictly zero emojis anywhere in the interface or generated messages. All icons are inline reusable SVGs.
- **Mobile-First Native Experience**: Fixed top navigation bar with slide-out drawer, bottom fixed taskbar with 4 core views, rounded corners (`12px` / `16px`), and smooth transitions.
- **Single Page Application (SPA)**: Instant view transitions (`#home`, `#categories`, `#activity`, `#settings`) without page reloads.

---

## Key Features

### 1. Curated Job Feed (Home)
- Real-time job listings populated by the automated JobSpy scraper or local feeds.
- Live keyword search across job titles, companies, locations, and descriptions.
- Instant category filter chips: **All Jobs**, **IT Roles**, **Non-IT**, **Electrical**, **Sales**, and **Other**.
- Each card highlights role details, company, location pin, category badge, and 1-click **Share to WhatsApp**.
- Shared jobs display a "Shared" checkmark status badge to prevent duplicate outreach.

### 2. Rule-Based Categorization (`sorter.js`)
- Completely deterministic (no AI dependency) keyword matching:
  - **IT**: Software developer, full stack, backend, frontend, Python, AI/ML engineer, QA/tester, DevOps, cloud, React, Java, etc.
  - **Non-IT**: Mechanical, electrical, sales, marketing, HR, finance, operations, civil, logistics, etc.
  - **Electrical & Sales**: Tagged with dedicated inline SVG icons.
  - **Other**: Fallback for unclassified roles (never dropped).

### 3. WhatsApp Sharing & Activity Logging (`whatsapp.js`)
- Generates `https://wa.me/918766882442?text=<encoded message>` links.
- Target phone number is configurable in Settings (defaults to `918766882442`).
- Configurable template with placeholders `{company}`, `{job_title}`, `{location}`, `{job_type}`, `{job_link}`, and `{signature}`.
- Intelligent missing field omission (lines with empty fields are dropped cleanly).
- Real-time live preview box in Settings.
- Automatically records every share in the **Activity / Sent Log** with timestamps.

### 4. Progressive Web App (PWA) & Service Worker (`sw.js`)
- Web App Manifest with standalone display mode, dark blue theme color, and 192x192 / 512x512 / maskable icons.
- **Network-First Caching**: Always attempts to fetch the newest files from network/GitHub first; seamlessly falls back to cache when offline.
- No manual version bumping needed: updates reflect automatically without reinstalling.
- Native installation prompt via "Download / Install App" button in Settings, with manual fallback guidance for Apple iOS Safari.

### 5. Automated Job Scraping (GitHub Actions)
- `.github/workflows/scrape.yml` runs every 2 hours using `python-jobspy` to scrape LinkedIn and Indeed.
- Commits updated job listings directly to `frontend/data/jobs.json`.

---

### 6. Live Search Now Multi-Platform Scraper
- Direct targeted job search targeting LinkedIn, Indeed, and Glassdoor with custom or pre-set domains.
- Dual action buttons: 1-click **WhatsApp** message generation and **LinkedIn** direct launch (opens directly in LinkedIn native app on mobile) or **Website** (in new tab).
- Search history caching in localStorage.

### 7. Password Protection (Vercel Serverless Function & PASS Environment Variable)
- Built-in authentication via `/api/auth` reading the `PASS` environment variable on Vercel.
- Protects the dashboard from unauthorized access.
- Supports 30-day session caching in `localStorage`.
- Immediate lock session buttons in top navigation drawer and Settings.

---

## File Structure

```
├── .github/
│   └── workflows/
│       └── scrape.yml             # GitHub Actions workflow running every 2 hours
├── api/
│   └── auth.js                    # Vercel Serverless Function for PASS authentication
├── frontend/
│   ├── index.html                 # Main application shell and views
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Network-first auto-updating service worker
│   ├── css/
│   │   └── styles.css             # 70/30 White-Blue design system
│   ├── js/
│   │   ├── app.js                 # App controller, AuthManager & SPA router
│   │   ├── sorter.js              # Rule-based categorization engine
│   │   ├── whatsapp.js            # WhatsApp link builder & sent logger
│   │   └── sw-register.js         # Service Worker & PWA install manager
│   ├── data/
│   │   └── jobs.json              # Scraped and curated job dataset
│   └── icons/
│       ├── logo.svg               # Dominal Technology vector logo
│       ├── icon-192.png           # 192x192 PWA icon
│       ├── icon-512.png           # 512x512 PWA icon
│       └── icon-maskable.png      # Maskable icon variant
├── scraper/
│   ├── scraper.py                 # JobSpy scraping script
│   └── requirements.txt           # Python scraper dependencies
├── index.html                     # Root redirect fallback
├── vercel.json                    # Vercel rewrites routing / to /frontend/
├── .gitignore
└── README.md
```

---

## Vercel Deployment & Setup

1. Connect this GitHub repository (`mdyahhya/job`) to Vercel.
2. In your Vercel Project Dashboard:
   - Go to **Settings** > **Environment Variables**.
   - Add a new variable:
     - **Key**: `PASS`
     - **Value**: `<your_desired_password>` (e.g. `MySecurePass2026`)
     - Click **Save**.
3. Deploy / Redeploy.
4. Open your live site URL (e.g. `https://jobscraperyahya.vercel.app`).
5. Enter your password to unlock the dashboard!

---

## Local Development & Testing

You can run the frontend with any local HTTP server:

```bash
# Using Python
python -m http.server 8080
```

Open `http://localhost:8080` in your web browser. (In local mode without Vercel Serverless functions, use fallback password: `dominal123`).

---

## GitHub Repository

Active repository: `https://github.com/mdyahhya/job.git`
Branch: `main`
