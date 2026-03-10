# Handover Documentation: ABIF Funding Intelligence Radar
**Status:** Operational (v2.9.0-Stable) | **Revision Date:** March 9, 2026

## 🚨 The Brutal Truth (Read This First)
This codebase is a highly customized, "lean-and-mean" automation machine designed for **Agri Business Incubation Foundation IIT Kharagpur**. It is NOT a standard enterprise CRUD app.

### 1. Scrapers are Fragile
The heart of the data collection is `scripts/scraper.js`. It depends on **cheerio** and **puppeteer** to crawl government and institutional portals. 
- **The Problem:** These websites change their HTML structure frequently. If a scraper fails, it's almost certainly because a CSS selector in the script is now obsolete. 
- **Task:** You will periodically need to update selectors in `scripts/scraper.js`.

### 2. GitHub Actions "Backend"
There is no traditional database. The "database" is a static JSON file at `public/data/opportunities.json`.
- **The Workflow:** The system uses GitHub Actions (`.github/workflows/scraper-sync.yml`) as a worker to run the scraper and *commit* the results back to the repo. This triggers the GitHub Pages deployment.

### 3. Vercel + GitHub "CORS Hack"
Because GitHub Pages is static, the frontend cannot safely store a GitHub Token or SMTP password. 
- We use **Vercel Serverless Functions** (`api/trigger-sync.js` and `api/trigger-email.js`) as a secure proxy.
- The frontend calls the Vercel API -> Vercel uses the `GITHUB_TOKEN` to trigger a GitHub Workflow Dispatch. 

---

## ⚡ Performance Optimization (Advanced Integration)
The system has been heavily optimized for low-bandwidth and low-performance institutional environments:

### 1. Contextual Data Engine
The statistics shown in the **Numbers Board** and the **AI Briefing** are now "Context Aware." 
- Unlike standard dashboards, these recalculate in a single-pass loop when the user searches or filters.
- Logic is centralized in `src/hooks/useEcosystemData.js`. If you add new metrics, ensure they are calculated inside the `useMemo` block to prevent UI lag.

### 2. Low-Performance Mode ("Zap")
Users can toggle "Low-Perf Mode" via the **Zap** icon in the `TacticalSpear` menu.
- **What it does:** Disables CSS backdrop-filters, reduces animation durations, and removes complex gradients.
- **CSS Hook:** Managed via the `.low-perf` class on the root `<html>` element in `index.css`.

### 3. Asset Management
- **Logos:** Institutional logos (ABIF, IITKGP, NABARD) are stored locally in `/public/logos/`. Do NOT use remote URLs if possible to avoid initial load "pop-in."
- **Lazy Loading:** Large components like the `IntelligenceReport` are lazy-loaded using `React.lazy` to keep the main bundle size under 200KB.

---

## 🏗️ Architecture Stack
- **Frontend:** React (Vite) + Lucide Icons + Tailwind (Native CSS 4.0).
- **Automation:** Node.js + Puppeteer (Scraping) + Nodemailer (Emails).
- **AI Integration:** Google Gemini (for live briefings and research reports).
- **Hosting:** GitHub Pages (Frontend) + Vercel (API Proxies).

---

## 🛠️ Key Files & their Secrets
- `scripts/scraper.js`: Data extraction logic.
- `scripts/send-email.js`: AI-enhanced email dispatch.
- `src/App.jsx`: Main UI logic, theme management, and performance toggles.
- `src/utils/aiBriefing.js`: Reactive AI synthesis generator.

### Necessary Secrets (GitHub Settings > Secrets)
1. `GITHUB_TOKEN`: Standard token for repository checkouts and commits.
2. `GEMINI_API_KEY`: For AI descriptive/insight generation.
3. `SMTP_HOST`, `SMTP_PASS`, etc.: For the automated emailer.

---

## 🚀 Common Maintenance Tasks

### Adding a New Funding Source
1. Go to `scripts/scraper.js`.
2. Map the new portal's HTML to the scheme object structure.
3. Update the `main()` function to include your new scraper.

### Branding Updates
The official name is **Agri Business Incubation Foundation IIT Kharagpur**. 
- Short forms: ABIF, ABIF IIT KGP.
- Locations checked: `index.html`, `Footer.jsx`, `IntelligenceReport.jsx`.

---

## ⚠️ Technical Debt & Known Risks
- **Data Duplication:** Deduplication is strictly string-based.
- **Link Verification:** Many government portals block automated HEAD requests; "Verification Unknown" is a common fallback.
- **Deployment Lag:** Because it relies on GitHub Pages, data updates take ~2-3 minutes to reflect after a successful sync.

**Good luck. Keep the radar running.**
