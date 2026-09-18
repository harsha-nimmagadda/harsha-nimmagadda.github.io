# Parent Intelligence & Strategic Guidance Hub (Parent Demo Package)
### Antigravity / Excellencia Junior College — Standalone Developer Package

Welcome to the **Parent Intelligence & Strategic Guidance Hub** standalone package. This demo provides parents of 11th & 12th Indian competitive exam aspirants (JEE Mains, JEE Advanced, NEET) with clarity, reassurance, and actionable guidance without inducing anxiety or conflict at home.

The package includes **both Parent V1 (Baseline Intelligence)** and **Parent V2 (Question-Led Guidance)**, fully functional statically offline via `file:///` and over a dedicated local server.

---

## ⚡ Quick Start

You can run this demo in **either of two ways**:

### Option 1: Direct Offline Browser (Zero Setup / file:///)
Simply double-click **`index.html`**, **`parent-v2.html`**, or **`parent-v1.html`** in any modern web browser (Chrome, Edge, Firefox, Safari).
* **Zero CORS issues**: The package includes `data/students_data.js` which preloads 50 authentic student records directly into memory.
* No local web server or terminal required.

### Option 2: Local HTTP Server (Node.js)
If you prefer running over HTTP:
```bash
node server.js
```
Then open your browser to:
* 👉 **Default / Flagship V2:** [http://localhost:3304](http://localhost:3304) (or [http://localhost:3304/parent-v2.html](http://localhost:3304/parent-v2.html))
* 📌 **Baseline V1 Dashboard:** [http://localhost:3304/parent-v1.html](http://localhost:3304/parent-v1.html)

---

## 📂 Package Structure

```
parent demo/
├── index.html                   # Flagship entry point (Parent V2 Question-Led Hub with version switcher)
├── parent-v1.html               # Parent V1 Baseline Intelligence Dashboard
├── parent-v1.js                 # Parent V1 Engine (dual-mode static data loader)
├── parent-v2.html               # Parent V2 Question-Led Guidance Hub
├── parent-v2.js                 # Parent V2 Engine (dual-mode static data loader)
├── server.js                    # Zero-dependency local Node.js server (Port 3304)
├── README.md                    # This quickstart guide & overview
├── DATA_PRESENTATION_SPEC.md    # Complete mathematical formulas, schemas, and psychological spec
└── data/
    ├── students_data.js         # 2.6 MB offline preload bundle (50 students ready on file:///)
    ├── students.json            # Student catalog for HTTP mode
    ├── student_*_profile.json   # 50 individual student identity files
    ├── student_*_analytics.json # 50 individual student diagnostic telemetry files
    ├── student_*_exams.json     # 50 individual student test history records
    └── student_*_mastery.json   # 50 individual chapter/topic mastery logs
```

---

## 🧭 Parent V1 vs. Parent V2 Comparison

| Feature / Dimension | Parent V1 (Baseline Intelligence) | Parent V2 (Question-Led Guidance) |
| :--- | :--- | :--- |
| **Philosophical Goal** | Comprehensive executive telemetry dashboard. | Alleviating parental anxiety, contextualizing scores, and enabling constructive home support. |
| **Primary Structure** | Tabbed dashboard (Home, Exams, Target AIR, Playbook). | 4 Natural Parent Questions arranged in a cognitive journey. |
| **Score Interpretation** | Raw exam marks and general target rank charts. | **Indian Exam Reality Translator** explaining why 45–55% in JEE represents the top 2% nationally. |
| **Marks Recovery** | Behavioral notes on calculation slips and skips. | **Interactive "What-If" Simulator** showing real-time rank elevation (+6,500 seats) from avoiding execution slips. |
| **Home Support** | General lifestyle advice (screen time, sleep). | **Tonight's Dinner Table Starter** (grounded, praise-first prompt based on weekly syllabus). |
| **PTM Preparation** | Static teacher feedback log. | **3 Grounded Discussion Questions** customized for Chemistry, Math, and the Class Mentor. |

---

## 🌟 The 4 Parent Journeys in Parent V2

1. **Where Does My Child Stand for Their Target Exam?**
   - **Preparation Health Dial (84/100)**: Holistic composite metric reflecting score consistency, attendance, and composure.
   - **Calibrated JEE Mains Projection**: Projected Score (`162–188/300`), Percentile (`97.6–98.5%ile`), and Estimated AIR (`13,500–21,000`).
   - **Indian Exam Reality Translator**: Dismantles the Class 10 Board Exam 95% illusion, explaining why competitive elimination curves operate differently.
   - **Interactive "What-If" Simulator**: Sliders allowing parents to see how fixing calculation slips (+12M) and blind guessing (+4M) elevates rank from ~18,000 to ~11,500 AIR.

2. **Why Are Marks Leaking & How Do We Fix It?**
   - **Effort × Outcome Diagnostic Pulse**: Confirms high homework diligence (92%) and test discipline (90%) while highlighting test-taking rush (-16 avoidable marks lost).
   - **Avoidable Leaks Autopsy**: Breaks down exact marks lost to calculation slips (-12M), quick skips (-4M), and time traps (9m on Argand plane).

3. **How Can I Help at Home Tonight? (Dinner Table Playbook)**
   - **Classroom Syllabus Tracker**: Up-to-date insight into what faculty are teaching this week (Electromagnetism, Diazonium Salts, Complex Numbers).
   - **Tonight's Conversation Starter**: A non-nagging, praise-first prompt: *"I noticed your Physics accuracy was 60% on Sunday, which is really strong. The teachers mentioned Chemistry had some tricky Diazonium questions—did you get time to review those today?"*
   - **3 Golden Rules for Indian Parents**: Avoid peer comparisons ("Sharma-ji's son"), protect 7 hours of sleep, and focus on process rather than fluctuating ranks.

4. **What Should I Ask at PTM? (Faculty Partnership)**
   - **3 Data-Grounded Questions**: Specific questions for Chemistry teacher, Math teacher, and Mentor.
   - **Verified Exam Attendance**: Official record (18 of 20 tests written, 90% discipline).
   - **Direct Mentor WhatsApp Contact**: One-click communication with the student's class mentor.

---

## 📖 Complete Math & Technical Specification

For the complete mathematical formulations, Health Index formulas, Indian Exam Reality mappings, and Next.js / Effect v3 backend data schemas, see:
👉 **[`DATA_PRESENTATION_SPEC.md`](DATA_PRESENTATION_SPEC.md)**

---

## 🛠️ Developer Notes

* **100% Offline Static Ready**: All assets, Tailwind CDN styling, FontAwesome icons, and Chart.js scripts are loaded with resilient fallbacks. The `data/students_data.js` script allows instant loading without network requests.
* **Student Switching**: Both V1 and V2 feature a student selector dropdown populated with all 50 students, updating all metrics and projections instantaneously.
* **Bidirectional Version Switching**: Both interfaces feature prominent top banners allowing seamless switching between Parent V1 and Parent V2.
