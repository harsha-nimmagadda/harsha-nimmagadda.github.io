# Excellencia AI — Admin Analytics Demo & Blueprint

A fully self-contained, offline-safe interactive static suite representing the **Admin Analytics Engine & Dashboard UI** from `backend-source/apps/dashboard/src/app/analytics`.

This directory contains everything needed to examine, discuss, and revamp the Admin Analytics experience without touching or relying on `backend-source` or live database connections.

---

## 🚀 How to Run the Demo

### Option 1: Zero-Dependency Local Node Server (Recommended)
From this directory (`admin demo/`):
```bash
node server.js
```
Then open your browser to:
👉 **[http://localhost:3400](http://localhost:3400)**

### Option 2: Direct File Open (Offline Safe)
Double-click `index.html` or open it directly in Chrome, Edge, or Firefox. The application includes pre-bundled offline data (`data/all_data.js`) that works seamlessly even across local `file://` restrictions.

---

## 📁 Directory Structure

```
admin demo/
├── index.html                   # Master Admin Analytics Cockpit (7 primary views)
├── app.js                       # Interactive router, Chart.js visualizations, & filter state
├── styles.css                   # Custom typography, animations, and badge styles
├── server.js                    # Zero-dependency local Node.js HTTP server (port 3400)
├── SCHEMA_AND_API_SPEC.md       # Complete DB schema catalog & REST API specifications
├── README.md                    # This document
├── data/                        # Static datasets matching real PostgreSQL schemas & seed data
│   ├── all_data.js              # Bundled fallback dataset for file:// execution
│   ├── institution.json         # Top-level KPIs, branch comparison, top batches, & top performers
│   ├── institution_trends.json  # 12-month longitudinal score & percentile trends
│   ├── branches.json            # 10 Branches (Shamirpet, Suchitra, Kokapet, Miyapur, Madhapur, etc.)
│   ├── batches.json             # Active batches (SR MPC, JR MPC, SR BIPC, JR BIPC, JR MEC, JR CEC)
│   ├── batch_analytics.json     # Bell curve, box plot, at-risk matrix, attendance, syllabus flow
│   ├── students.json            # Student roster with percentiles, attendance, & risk flags
│   ├── student_dossier.json     # Deep-dive profile for Bhagam Khyathi (heatmap, predictive path, autopsy)
│   ├── cohorts.json             # Milestone tracking across multi-year cohorts
│   ├── insights.json            # AI diagnostic cards (velocity, topic hotspots, attendance drops)
│   └── ask_demo.json            # Ask Analytics query responses with embedded charts
├── schema/                      # Original Drizzle ORM schema files
│   ├── analytics.ts             # Cache tables, student analytics, institution analytics
│   ├── analytics-v3.ts          # Cohort snapshots, baselines, histograms, predictions
│   ├── analytics-cache.ts       # Caching strategies
│   └── api-routes/              # Backend Hono API route handlers
│       ├── analytics.ts         # Core analytics API endpoints
│       ├── analytics-v3.ts      # V3 analytics API endpoints
│       └── ask-analytics.ts     # Ask Analytics conversational AI backend
└── source/                      # Direct copies of the production React / Next.js code
    ├── analytics/               # All 39 page.tsx and component files from apps/dashboard
    ├── components-analytics/    # Shared analytics UI widgets (panels, scope bar, export)
    └── hooks/                   # use-analytics-scope.ts and client hooks
```

---

## 🖥️ What's Included in the Demo UI

1. **Institution Overview (`/analytics`)**:
   - Header with Batch filter, Open batch hub, Ask Analytics, Faculty impact, and DateRangePicker.
   - 6 KPI summary counters: Total Students (4,765), Exams (36,920), Avg Score (54%), Attendance (88%), Batches (76), At Risk (14).
   - Below-Threshold Alert Card (14 Students At Risk with quick link to student roster).
   - 12-Month Longitudinal Performance Trend Chart (Chart.js interactive area plot with gradient fill).
   - Branch Benchmark (Shamirpet, Suchitra, Kokapet, Miyapur, Madhapur, etc.).
   - Attendance Donut Chart (88% Present, 8% Absent, 4% Late).
   - Top Batches Leaderboard (Rank 1: SR MPC Madhapur, Rank 2: SR MPC Shamirpet, Rank 3: SR BIPC Madhapur).
   - Top Performers Table with tabs (Rank 1: Bhagam Khyathi, Rank 2: JAY RAJ VAISHNAV, Rank 3: VISHWANATH AKSHAY KUMAR).
   - Batch Performance Overview Table with progress bars and status badges (Healthy / Warning / Critical).

2. **Home / Insights (`/analytics/home`)**:
   - 6-tile pulse metric strip (Active students, 7d avg score, 7d attendance, at-risk count, tests this week, 24h submissions).
   - 30-day rolling performance curve.
   - Big Movers: Top Risers & Steepest Fallers with delta points and avatars.
   - AI Strategic Insights with single-click actionable interventions.
   - Upcoming competitive exam countdowns.

3. **Students Directory (`/analytics/students`)**:
   - Filter bar with live debounced search, Branch filter, Batch filter, and At-risk only toggle.
   - Real student records with roll numbers (Bhagam Khyathi: 225144, R PRANAV: 425117, etc.).
   - Interactive rows open the comprehensive Student Dossier.

4. **Exams Analytics (`/analytics/exams`)**:
   - Evaluations roster with date, purpose, batches, appearance rate with progress bar, avg score, pass rate, and OMR badges.

5. **Score Matrix Explorer (`/analytics/compare`)**:
   - Excel-like comparative score matrix with student exam marks, average percentages, and trajectory line chart.

6. **Branches (`/analytics/branches`)**:
   - Branch cards and summary table with student counts and average percentiles. Clicking any branch filters the entire console to that branch.

7. **Practice Adherence (`/analytics/dpp`)**:
   - Daily practice habit tracking, adherence rates (74.2%), active daily practitioners (3,240), average streaks (5.4 days), and batch rollup.

8. **Batch Comparison (`/analytics/institution/cohorts`)**:
   - Longitudinal milestone line chart tracking JEE 2026 vs JEE 2027 vs NEET 2026 from Month 1 to Final Mock.
   - Cohort summary cards with mastery and retention rates.

5. **Student Dossier (`/analytics/student/[id]`)**:
   - Profile banner for Bhagam Khyathi (Roll 225144, Rank #1, 96.8%ile, ERI 3.63 Adv / 3.20 Mains).
   - Topic Mastery Heatmap with difficulty pills (Easy, Medium, Hard).
   - Predictive Path line chart with +16 marks pacing fixes and projected AIR.
   - Recent evaluations table with subject breakdown.
   - Forensic Exam Autopsy highlighting exact score leaks (-8 marks time traps, -4 marks calculation rush).

6. **Ask Brilliance AI (`/analytics/ask`)**:
   - Interactive natural language query prompt.
   - Dynamic chart rendering and structured diagnostic recommendations.

7. **Campuses & Students Directory (`/analytics/branches`, `/analytics/students`)**:
   - Branch profiles, student counts, and full institutional candidate directory.

---

## 🎯 Next Steps: Areas for Revamp & Discussion

Now that the existing UI and data structures are fully isolated in `admin demo/`, we can discuss and implement improvements:
1. **Executive vs Operator Clarity**: Differentiating what top institutional leadership (Principals/Trustees) needs to see versus what Academic Coordinators and HODs need.
2. **Behavioral Diagnostics over Passive Charts**: Replacing raw histograms with clear action recommendations (similar to the pacing archetypes created in Student Analytics V2).
3. **Intervention Workflows**: Adding one-click student messaging, assignment of remedial drill sheets, and automated parent communication directly from the At-Risk and Leak panels.
4. **Export & Reporting**: Enhancing automated PDF/PTA report generation and spreadsheet exports.
