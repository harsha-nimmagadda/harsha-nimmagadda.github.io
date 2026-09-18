# Architectural & Data Presentation Specification
## Parent Intelligence & Strategic Guidance Hub (Parent V2 & V1)
### Mathematical Formulations, Psychological Pillars & Data-to-Sentence Derivations

> **⚠️ NOTICE FOR ENGINEERING & PRODUCT TEAMS:**  
> **THIS SPECIFICATION DEFINES THE PSYCHOLOGICAL ARCHITECTURE, MATHEMATICAL ENGINES, AND BACKEND DATA CONTRACTS FOR PARENT-FACING INTELLIGENCE.**  
> Implement these mathematical formulations and conversational synthesis engines within our production Next.js 15 / Effect v3 architecture (`backend-source/apps/parent` and `backend-source/packages/api/src/lib/parent-*.ts`).

---

## 1. Executive Summary: The Parent Psychology Paradigm Shift

Traditional parent portals in Indian coaching institutes fail both parents and students because they act as **surveillance dashboards**. They dump raw negative marks, class ranks, and uncontextualized percentages onto parents, triggering intense household panic:
* *"Why did my child get only 42% in Sunday's exam? In 10th Class ICSE she scored 96%!"*
* *"Is she not studying hard enough? Should I take away her phone or hire extra private home tutors?"*
* *"Who is scoring higher in her batch? Is Sharma-ji's son ahead?"*

### The Core Design Principle
> **"Replace panic with calibrated reality. Empower parents with non-nagging, grounded conversational starters and clear institutional partnership rather than passive surveillance."**

Rather than treating the parent as a truant officer, the platform structures intelligence around the **4 Natural Parent Journeys**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE 4 NATURAL PARENT JOURNEYS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. WHERE DOES MY CHILD STAND FOR THEIR TARGET EXAM?                         │
│    (Health Dial, Calibrated AIR Projection, Indian Exam Reality Translator) │
│                                                                             │
│ 2. WHY ARE MARKS LEAKING & HOW DO WE FIX IT?                                │
│    (Effort × Outcome Pulse, Avoidable Leaks Autopsy, "What-If" Simulator)   │
│                                                                             │
│ 3. HOW CAN I HELP AT HOME TONIGHT?                                          │
│    (Classroom Syllabus Tracker, Dinner Table Starter, 3 Golden Rules)       │
│                                                                             │
│ 4. WHAT SHOULD I ASK AT PTM?                                                │
│    (3 Data-Grounded Questions for Faculty, Attendance Discipline, WhatsApp) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Mathematical Formulations & Derivations

```
                          ┌─────────────────────────────┐
                          │   Institutional Telemetry   │
                          │   (Exam Submissions, PTM,   │
                          │    Attendance, LMS Logs)    │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │ Parent Mathematical Core  │                   │ Natural Language Synthesis│
   │ - Preparation Health ($H$)│                   │ - 5-Second Parent Verdict │
   │ - Reality Translation     │ ────────────────> │ - Dinner Table Starter    │
   │ - Calibrated AIR ($\hat{R}$)│                 │ - 3 PTM Faculty Questions │
   │ - "What-If" Rank Uplift   │                   │ - Composure vs Effort     │
   └───────────────────────────┘                   └───────────────────────────┘
```

---

### A. Preparation Health Composite Score ($H_{\text{prep}}$)

The preparation health dial is a **single, holistic composite index** $[0, 100]$ that aggregates academic performance, attendance consistency, and exam composure:

$$H_{\text{prep}} = w_1 S_{\text{norm}} + w_2 A_{\text{att}} + w_3 (1 - R_{\text{leak}})$$

Where:
1. $S_{\text{norm}} = \min\left(100, \frac{\bar{S}_{\text{student}}}{\bar{S}_{\text{batch}}} \times 75\right)$: Score performance normalized against the batch mean.
2. $A_{\text{att}} = \frac{N_{\text{attended}}}{N_{\text{scheduled}}} \times 100$: Test attendance discipline (e.g., $18/20 = 90\%$).
3. $R_{\text{leak}} = \frac{L_{\text{avoidable}}}{M_{\text{total}}}$: Ratio of marks lost to avoidable slips (calculation, rush, time traps) relative to maximum exam marks.
4. Weights: $w_1 = 0.50$ (Academic standing), $w_2 = 0.30$ (Consistency), $w_3 = 0.20$ (Composure).

#### Health Stratification Bands:
* $H_{\text{prep}} \ge 85$: **"🟢 Premier Track"** (Consistent, high test discipline, target NIT/IIT range).
* $70 \le H_{\text{prep}} < 85$: **"🟡 Solid Foundation"** (Good attendance, high avoidable leak requiring test composure).
* $H_{\text{prep}} < 70$: **"🔴 Support Required"** (Chronic absences, high negative marking, mentor intervention needed).

---

### B. The Indian Exam Reality Translator (Dismantling the 95% Myth)

One of the largest drivers of household tension in India is the **"Board Exam Percent Illusion"**. In standard Indian board exams (CBSE/ICSE/State Board), raw scores of $90\%\text{--}98\%$ are common. In national competitive exams (JEE Mains, NEET, JEE Advanced), the examination is designed for **elimination, not certification**.

The reality translator computes the non-linear percentile translation:

$$P_{\text{national}}(S) = \frac{1}{1 + e^{-k(S - S_0)}}$$

$$\text{Comparative Score Translation Table:}$$

| Class 10 Board Score Expectation | Equivalent JEE Mains Raw Score | Actual National Percentile | Actual National Reality |
| :---: | :---: | :---: | :--- |
| **$95\%+$ (Standard High)** | **$50\% - 55\%$ ($150\text{--}165 / 300$)** | **$98.0 - 98.7\text{th}\text{ \%ile}$** | **Top 1.5% in India** (Premier NIT / IIIT Zone) |
| **$85\% - 90\%$ (Average)** | **$38\% - 45\%$ ($115\text{--}135 / 300$)** | **$95.0 - 97.5\text{th}\text{ \%ile}$** | **Top 5% in India** (Core Engg Branches in Good NITs) |
| **$< 80\%$ (Concern)** | **$< 30\%$ ($< 90 / 300$)** | **$< 90.0\text{th}\text{ \%ile}$** | **Buffer Zone** (State EAPCET / Private Tier-1 Zone) |

#### Natural Language Derivation:
$$\text{"Scoring 45% in JEE Mains is NOT failure; it places your child in the top 2% of 1.4 million aspirants nationally."}$$

---

### C. Calibrated AIR Projection & College Band ($\hat{R}_{\text{AIR}}$)

Rather than giving parents an exact rank that fluctuates wildly from week to week, the engine outputs a **calibrated rank band** based on rolling average test percentiles:

$$\hat{R}_{\text{lower}} = N_{\text{aspirants}} \times (1 - \hat{P}_{\text{upper}})$$
$$\hat{R}_{\text{upper}} = N_{\text{aspirants}} \times (1 - \hat{P}_{\text{lower}})$$

For $N_{\text{aspirants}} \approx 1,400,000$ (JEE Mains):
* Score $162\text{--}188 \implies P \in [97.6\%, 98.5\%] \implies \hat{R} \in [\mathbf{13,500}, \mathbf{21,000}]$ (Premier NIT / IIIT Tier).
* Score $190\text{--}220 \implies P \in [99.1\%, 99.6\%] \implies \hat{R} \in [\mathbf{3,500}, \mathbf{7,500}]$ (Top 5 NIT CS / ECE Tier).

---

### D. The Interactive "What-If" Recovery Simulator Mechanics

To demonstrate to parents that extra tutoring hours are not the solution, the simulator quantifies the rank uplift of **pure behavioral error elimination**:

$$S_{\text{new}} = S_{\text{base}} + \Delta M_{\text{calc}} + \Delta M_{\text{guess}}$$

$$\text{Rank Uplift } \Delta R = \hat{R}(S_{\text{base}}) - \hat{R}(S_{\text{new}})$$

$$\text{Simulation Matrix for } S_{\text{base}} = 115:$$

| Calculation Recovered ($\Delta M_{\text{calc}}$) | Skips Recovered ($\Delta M_{\text{guess}}$) | Total Marks Recovered | New Score | Projected AIR | Seat Uplift |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **$+0\text{ M}$** | **$+0\text{ M}$** | **$+0\text{ M}$** | $115 / 300$ | $\approx 18,000$ | Baseline |
| **$+6\text{ M}$** | **$+2\text{ M}$** | **$+8\text{ M}$** | $123 / 300$ | $\approx 16,500$ | $+1,500$ Seats |
| **$+12\text{ M}$** | **$+4\text{ M}$** | **$+16\text{ M}$** | $131 / 300$ | $\approx 11,500$ | **$+6,500$ Seats!** |

---

### E. Tonight's Dinner Table Starter Derivation

Parents frequently trigger defensive silence by opening conversations with: *"How much did you get in Sunday's test?"* or *"Why are your Chemistry marks down?"*.

The Dinner Table Starter algorithm synthesizes a **3-part constructive opening**:
1. **Praise the Stronghold**: Identify the subject with the highest accuracy from Sunday ($\text{Subj}_{\text{top}}$).
2. **Contextualize with Classroom Syllabus**: Reference the specific topic faculty taught this week ($\text{Topic}_{\text{active}}$).
3. **Open an Emotion-Free Door**: Ask about review time without mentioning marks.

$$\text{Template:}$$
$$\text{"I noticed your } [\text{Subj}_{\text{top}}] \text{ accuracy was } [X\%] \text{ on Sunday, which is really strong. The teachers mentioned } [\text{Subj}_{\text{leak}}] \text{ had tricky } [\text{Topic}_{\text{active}}] \text{ questions—did you get time to review those today?"}$$

---

### F. PTM 3-Question Generator Algorithm

The Parent-Teacher Meeting (PTM) slot is strictly limited (typically 10 minutes). Parents often waste this time on generic complaints. The engine outputs 3 precise questions:

1. **Subject Specialist Question (Chemistry/Physics)**: Targets the specific high-yield chapter where calculation slips occurred, asking for 15 minutes of guided step-by-step remedial practice.
2. **Pacing/Composure Question (Mathematics)**: Cites the average time spent on time traps (e.g. 9 minutes on Argand plane) and asks for the faculty's benchmark cutoff time.
3. **Strategic Trajectory Question (Class Mentor)**: Asks whether the student should prioritize Mains score maximization or begin parallel Advanced sets given their 98th percentile projection.

---

## 3. TypeScript Backend Schemas (`backend-source/packages/api`)

```typescript
export interface ParentStandingView {
  studentId: string;
  studentName: string;
  targetExam: 'jee_mains' | 'jee_advanced' | 'neet' | 'eapcet';
  preparationHealth: {
    score: number; // 0 - 100
    band: 'premier' | 'solid' | 'support';
    verdictTitle: string;
    verdictNarrative: string;
    lastUpdatedExam: string;
  };
  calibratedProjection: {
    targetScoreRange: [number, number];
    percentileRange: [number, number];
    estimatedAirRange: [number, number];
    tierZoneDescription: string;
  };
  realityCheck: {
    boardEquivalentPercent: number;
    jeeCompetitiveReality: string;
  };
}

export interface ParentMarksAutopsyView {
  latestExamId: string;
  totalAvoidableLoss: number;
  effortOutcomePulse: {
    homeworkCompletionPct: number;
    testAttendancePct: number;
    avoidableMarksLost: number;
    verdict: string;
  };
  leaksBreakdown: Array<{
    category: 'calculation_slip' | 'rapid_abandonment' | 'time_trap';
    marksLost: number;
    questionCount: number;
    description: string;
    actionableHomeFix: string;
  }>;
}

export interface ParentPlaybookView {
  currentWeekNumber: number;
  weeklySyllabus: Array<{
    subject: string;
    topicName: string;
    upcomingExamWeightage: string;
  }>;
  dinnerTableStarter: {
    quote: string;
    psychologicalRationale: string;
  };
  goldenRules: Array<{
    ruleNumber: number;
    title: string;
    explanation: string;
  }>;
}

export interface ParentPtmDossierView {
  verifiedAttendance: {
    attended: number;
    scheduled: number;
    percentage: number;
    notes: string;
  };
  mentorContact: {
    name: string;
    role: string;
    campus: string;
    officeHours: string;
    whatsappNumber: string;
  };
  discussionQuestions: Array<{
    targetFaculty: 'Chemistry' | 'Mathematics' | 'Physics' | 'Class Mentor';
    tag: string;
    groundedQuestion: string;
  }>;
}
```
