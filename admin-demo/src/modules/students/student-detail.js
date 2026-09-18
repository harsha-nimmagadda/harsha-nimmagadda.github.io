/**
 * modules/students/student-detail.js
 * Comprehensive Student Analytics Dossier & Deep Dive Visualizations.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart, destroyChart } from '../../core/chart-utils.js';
import { openAssignmentDeveloperModal } from '../../core/modals.js';
import { openStudentTestAnalysis } from './test-analysis.js';

let currentStudentTimeRange = 'all';
let currentStudentExamsPage = 1;
export let currentStudentTab = 'diagnostic';

export function ordinal(n) {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function navigateToStudentDeepDive(key) {
  if (!key || key === 'detail' || key === 'student-detail') {
    router.navigate('student-detail');
  } else {
    const target = key.startsWith('student-') ? key : `student-${key}`;
    router.navigate(target);
  }
}

export function getStudentAnalyticsData(studentId) {
  const targetId = studentId || store.get('currentActiveStudentId') || 's-101';
  const cached = store.studentAnalytics?.[targetId];
  if (cached && cached.recentExams && cached.recentExams.length > 0 && cached.weakAreas?.subjects?.length > 0) {
    return cached;
  }

  // Dynamic generator tailored to ANY selected student with rich schema-compliant dummy data
  let student = (store.students || []).find(s => s.studentId === targetId);
  if (!student && store.dpp?.students) {
    student = store.dpp.students.find(s => s.studentId === targetId);
  }
  const name = student ? student.name : (targetId === 's-101' ? "Bhagam Khyathi" : "JAY RAJ VAISHNAV");
  const rollNo = student ? (student.rollNo || "225144") : "225144";
  const batch = student ? (student.batchName || student.batch || "SR MPC") : "SR MPC";
  const branch = student ? (student.branchName || student.branch || "Madhapur") : "Madhapur";
  const isNeverStarted = student?.status === 'Never Started' || student?.daysDone === 0;
  const avgPct = student ? (student.percentile || (isNeverStarted ? 52.4 : 96.2)) : 98.4;
  const avgScore = student ? (student.avgScore ? Math.round((student.avgScore / 300) * 100) : (isNeverStarted ? 44 : 87)) : 87;
  const rank = student ? (student.rank || 1) : 1;
  const isNeet = batch.toLowerCase().includes('bipc') || (student?.targetExam === 'NEET');
  const targetExam = isNeet ? "NEET" : "JEE Mains";

  // 10 Progressive Mock Exams
  const trajectoryExams = [
    { title: "JEE Mains Full Mock 1", date: "2025-11-10", delta: -10 },
    { title: "JEE Mains Full Mock 2", date: "2025-11-24", delta: -7 },
    { title: "Unit Test 4 - Mechanics & Optics", date: "2025-12-08", delta: -5 },
    { title: "JEE Mains Full Mock 3", date: "2025-12-22", delta: -3 },
    { title: "Mid-Term Comprehensive Mock", date: "2026-01-12", delta: -2 },
    { title: "Part Test - Calculus & EM", date: "2026-01-26", delta: 0 },
    { title: "All India Grand Mock 1", date: "2026-02-02", delta: 1 },
    { title: "All India Grand Mock 2", date: "2026-02-16", delta: 2 },
    { title: "State-wide Pre-Final Mock", date: "2026-02-23", delta: 0 },
    { title: "Final JEE Mains Mock Drill", date: "2026-03-05", delta: 4 }
  ];

  const scoreTrajectory = (cached?.scoreTrajectory && cached.scoreTrajectory.length > 0)
    ? cached.scoreTrajectory
    : trajectoryExams.map((t, idx) => {
        const pct = Math.min(99.4, Math.max(30, Number((avgPct + t.delta * 0.7).toFixed(1))));
        const scorePct = Math.min(100, Math.max(25, Number((avgScore + t.delta).toFixed(1))));
        return {
          examId: `ex-${idx + 1}`,
          examTitle: isNeet ? t.title.replace(/JEE Mains/g, "NEET") : t.title,
          score: Math.round(scorePct * 3),
          maxScore: 300,
          percentage: scorePct,
          percentile: pct,
          date: t.date
        };
      });

  const recentExams = (cached?.recentExams && cached.recentExams.length > 0)
    ? cached.recentExams
    : [...scoreTrajectory].reverse().map(t => ({
        examId: t.examId,
        examTitle: t.examTitle,
        percentage: t.percentage,
        percentile: t.percentile,
        date: t.date
      }));

  const subjectWise = (cached?.subjectWise && cached.subjectWise.length > 0)
    ? cached.subjectWise
    : (isNeet ? [
        { subjectId: "sub-bio", subjectName: "Biology", totalQuestions: 380, correctAnswers: Math.round(380 * (avgScore / 100) * 1.04), accuracy: Math.min(98, Number((avgScore * 1.04).toFixed(1))) },
        { subjectId: "sub-phy", subjectName: "Physics", totalQuestions: 375, correctAnswers: Math.round(375 * (avgScore / 100) * 0.93), accuracy: Math.max(35, Number((avgScore * 0.93).toFixed(1))) },
        { subjectId: "sub-chem", subjectName: "Chemistry", totalQuestions: 370, correctAnswers: Math.round(370 * (avgScore / 100) * 1.01), accuracy: Math.min(96, Number((avgScore * 1.01).toFixed(1))) }
      ] : [
        { subjectId: "sub-1", subjectName: "Mathematics", totalQuestions: 380, correctAnswers: Math.round(380 * (avgScore / 100) * 1.02), accuracy: Math.min(98, Number((avgScore * 1.02).toFixed(1))) },
        { subjectId: "sub-2", subjectName: "Physics", totalQuestions: 375, correctAnswers: Math.round(375 * (avgScore / 100) * 0.94), accuracy: Math.max(35, Number((avgScore * 0.94).toFixed(1))) },
        { subjectId: "sub-3", subjectName: "Chemistry", totalQuestions: 370, correctAnswers: Math.round(370 * (avgScore / 100) * 1.01), accuracy: Math.min(97, Number((avgScore * 1.01).toFixed(1))) }
      ]);

  const assignmentData = (cached?.assignmentData && cached.assignmentData.length > 0)
    ? cached.assignmentData
    : [
        { id: "as-1", title: isNeet ? "Genetics & Inheritance DPP-04" : "Rotational Mechanics DPP-04", type: "dpp", score: Math.min(100, avgScore + 4), status: "done", completedAt: "2026-03-04" },
        { id: "as-2", title: isNeet ? "Final NEET Full Mock Drill" : "Final JEE Mains Mock Drill", type: "exam", score: Math.min(100, avgScore + 5), status: "done", completedAt: "2026-03-05" },
        { id: "as-3", title: isNeet ? "Human Physiology Practice Sheet" : "Definite Integration DPP-08", type: "dpp", score: 100, status: "done", completedAt: "2026-03-02" },
        { id: "as-4", title: "Coordination Compounds Practice Sheet", type: "assignment", score: Math.max(50, avgScore - 2), status: "done", completedAt: "2026-02-28" },
        { id: "as-5", title: "State-wide Pre-Final Mock", type: "exam", score: Math.round(avgScore), status: "done", completedAt: "2026-02-23" },
        { id: "as-6", title: "Organic Synthesis & Mechanisms Homework", type: "assignment", score: Math.min(100, avgScore + 8), status: "done", completedAt: "2026-02-20" },
        { id: "as-7", title: "Fluid Dynamics DPP-03", type: "dpp", score: Math.max(45, avgScore - 10), status: "done", completedAt: "2026-02-15" },
        { id: "as-8", title: isNeet ? "Biotechnology Principles Drill" : "Electromagnetic Induction Practice Drill", type: "assignment", score: null, status: "pending", completedAt: null }
      ];

  const weakAreas = (cached?.weakAreas && cached.weakAreas.subjects && cached.weakAreas.subjects.length > 0)
    ? cached.weakAreas
    : {
        studentId: targetId,
        totalSubjectsWithErrors: 3,
        totalErrors: Math.round(Math.max(18, 120 - avgScore)),
        totalUnresolved: Math.round(Math.max(4, (120 - avgScore) * 0.28)),
        subjects: [
          {
            subjectId: "sub-2",
            subjectName: "Physics",
            errorCount: Math.round(Math.max(8, (120 - avgScore) * 0.52)),
            unresolvedCount: Math.round(Math.max(2, (120 - avgScore) * 0.15)),
            topics: [
              { topicId: "tp-1", topicName: "Rotational Dynamics — Rolling on Inclined Plane", errorCount: 8, unresolvedCount: 2 },
              { topicId: "tp-2", topicName: "Wave Optics — Polarisation & Brewster Law", errorCount: 6, unresolvedCount: 2 },
              { topicId: "tp-3", topicName: "Electromagnetic Induction — Eddy Currents & LC", errorCount: 5, unresolvedCount: 1 },
              { topicId: "tp-4", topicName: "Fluid Mechanics — Viscous Flow & Terminal Velocity", errorCount: 3, unresolvedCount: 1 }
            ]
          },
          {
            subjectId: isNeet ? "sub-bio" : "sub-1",
            subjectName: isNeet ? "Biology" : "Mathematics",
            errorCount: Math.round(Math.max(5, (120 - avgScore) * 0.30)),
            unresolvedCount: Math.round(Math.max(1, (120 - avgScore) * 0.08)),
            topics: isNeet ? [
              { topicId: "tp-5b", topicName: "Genetics — Pedigree Analysis & Linkage", errorCount: 5, unresolvedCount: 1 },
              { topicId: "tp-6b", topicName: "Plant Physiology — Calvin Cycle Steps", errorCount: 4, unresolvedCount: 1 },
              { topicId: "tp-7b", topicName: "Human Reproduction — Gametogenesis Timing", errorCount: 3, unresolvedCount: 1 }
            ] : [
              { topicId: "tp-5", topicName: "Probability — Conditional & Bayes Theorem", errorCount: 5, unresolvedCount: 1 },
              { topicId: "tp-6", topicName: "Differential Equations — Homogeneous Types", errorCount: 4, unresolvedCount: 1 },
              { topicId: "tp-7", topicName: "Complex Numbers — Rotation of Complex Axis", errorCount: 3, unresolvedCount: 1 }
            ]
          },
          {
            subjectId: "sub-3",
            subjectName: "Chemistry",
            errorCount: Math.round(Math.max(4, (120 - avgScore) * 0.18)),
            unresolvedCount: Math.round(Math.max(1, (120 - avgScore) * 0.05)),
            topics: [
              { topicId: "tp-8", topicName: "Coordination Compounds — Crystal Field Isomerism", errorCount: 5, unresolvedCount: 1 },
              { topicId: "tp-9", topicName: "Ionic Equilibrium — Buffer Capacity & Solubility", errorCount: 3, unresolvedCount: 1 }
            ]
          }
        ]
      };

  const rwl = (cached?.rwl && cached.rwl.questions && cached.rwl.questions.length > 0)
    ? cached.rwl
    : {
        studentId: targetId,
        total: 3,
        questions: [
          {
            questionId: "q-301",
            questionTextMd: "A solid sphere rolls without slipping down an inclined plane of inclination θ. Find the minimum coefficient of friction required for pure rolling.",
            subjectName: "Physics",
            topicName: "Rotational Dynamics",
            difficulty: "Hard",
            errorType: "applied_wrong_concept",
            repeatCount: 3,
            masteryStatus: "in_revision"
          },
          {
            questionId: "q-302",
            questionTextMd: isNeet
              ? "In a testcross involving F1 dihybrid flies with 18% recombination, what proportion of total offspring are expected to exhibit the non-parental phenotype?"
              : "If three coins are tossed and at least one shows heads, what is the probability that all three show heads?",
            subjectName: isNeet ? "Biology" : "Mathematics",
            topicName: isNeet ? "Genetics" : "Probability",
            difficulty: "Medium",
            errorType: "calculation_mistake",
            repeatCount: 2,
            masteryStatus: "in_revision"
          },
          {
            questionId: "q-303",
            questionTextMd: "Calculate the Crystal Field Stabilization Energy (CFSE) for a d⁶ octahedral complex in a strong-field low-spin state.",
            subjectName: "Chemistry",
            topicName: "Coordination Compounds",
            difficulty: "Hard",
            errorType: "cannot_derive_formula",
            repeatCount: 2,
            masteryStatus: "weak"
          }
        ]
      };

  const errorPatterns = (cached?.errorPatterns && cached.errorPatterns.byType && cached.errorPatterns.byType.length > 0)
    ? cached.errorPatterns
    : {
        totalErrors: weakAreas.totalErrors,
        byType: [
          { errorType: "calculation_mistake", label: "Calculation Mistake", count: Math.round(weakAreas.totalErrors * 0.33), percentage: 33.3, category: "Careless" },
          { errorType: "applied_wrong_concept", label: "Applied Wrong Concept", count: Math.round(weakAreas.totalErrors * 0.21), percentage: 21.4, category: "Conceptual" },
          { errorType: "time_management", label: "Time Management", count: Math.round(weakAreas.totalErrors * 0.17), percentage: 16.7, category: "Time/Strategy" },
          { errorType: "cannot_derive_formula", label: "Formula Recall / Derive", count: Math.round(weakAreas.totalErrors * 0.14), percentage: 14.3, category: "Formula/Method" },
          { errorType: "misread_question", label: "Misread Question", count: Math.round(weakAreas.totalErrors * 0.10), percentage: 9.5, category: "Careless" },
          { errorType: "lengthy_calculation", label: "Lengthy Calculation", count: Math.round(weakAreas.totalErrors * 0.05), percentage: 4.8, category: "Time/Strategy" }
        ],
        trend: {
          last30Days: Math.round(weakAreas.totalErrors * 0.28),
          previous30Days: Math.round(weakAreas.totalErrors * 0.42),
          direction: avgScore >= 70 ? "improving" : "worsening",
          changePercent: avgScore >= 70 ? -33.3 : 15.4
        }
      };

  const skillMap = (cached?.skillMap && cached.skillMap.current && cached.skillMap.current.length > 0)
    ? cached.skillMap
    : {
        current: isNeet ? [
          { topicId: "t-1b", topicName: "Genetics & Heredity", subjectName: "Biology", mastery: Math.min(96, avgScore + 4), questionsAttempted: 48, accuracy: Math.min(95, avgScore + 3) },
          { topicId: "t-2b", topicName: "Electrodynamics", subjectName: "Physics", mastery: Math.max(40, avgScore - 5), questionsAttempted: 52, accuracy: Math.max(40, avgScore - 6) },
          { topicId: "t-3b", topicName: "Chemical Kinetics", subjectName: "Chemistry", mastery: Math.min(97, avgScore + 6), questionsAttempted: 38, accuracy: Math.min(96, avgScore + 5) },
          { topicId: "t-4b", topicName: "Human Physiology", subjectName: "Biology", mastery: Math.min(95, avgScore + 5), questionsAttempted: 60, accuracy: Math.min(94, avgScore + 4) },
          { topicId: "t-5b", topicName: "Thermodynamics", subjectName: "Physics", mastery: Math.max(35, avgScore - 8), questionsAttempted: 42, accuracy: Math.max(35, avgScore - 9) },
          { topicId: "t-6b", topicName: "Organic Mechanisms", subjectName: "Chemistry", mastery: Math.min(92, avgScore + 2), questionsAttempted: 50, accuracy: Math.min(91, avgScore + 1) },
          { topicId: "t-7b", topicName: "Rotational Dynamics", subjectName: "Physics", mastery: Math.max(30, avgScore - 15), questionsAttempted: 48, accuracy: Math.max(30, avgScore - 16) },
          { topicId: "t-8b", topicName: "Plant Anatomy", subjectName: "Biology", mastery: Math.min(93, avgScore + 1), questionsAttempted: 44, accuracy: Math.min(92, avgScore) }
        ] : [
          { topicId: "t-1", topicName: "Definite Integrals", subjectName: "Mathematics", mastery: Math.min(96, avgScore + 5), questionsAttempted: 45, accuracy: Math.min(95, avgScore + 4) },
          { topicId: "t-2", topicName: "Electrodynamics", subjectName: "Physics", mastery: Math.max(40, avgScore - 4), questionsAttempted: 52, accuracy: Math.max(40, avgScore - 5) },
          { topicId: "t-3", topicName: "Chemical Kinetics", subjectName: "Chemistry", mastery: Math.min(98, avgScore + 7), questionsAttempted: 38, accuracy: Math.min(97, avgScore + 6) },
          { topicId: "t-4", topicName: "Coordinate Geometry", subjectName: "Mathematics", mastery: Math.min(94, avgScore + 3), questionsAttempted: 60, accuracy: Math.min(93, avgScore + 2) },
          { topicId: "t-5", topicName: "Thermodynamics", subjectName: "Physics", mastery: Math.max(35, avgScore - 8), questionsAttempted: 42, accuracy: Math.max(35, avgScore - 9) },
          { topicId: "t-6", topicName: "Organic Reaction Mech", subjectName: "Chemistry", mastery: Math.min(92, avgScore + 1), questionsAttempted: 50, accuracy: Math.min(91, avgScore) },
          { topicId: "t-7", topicName: "Rotational Dynamics", subjectName: "Physics", mastery: Math.max(30, avgScore - 16), questionsAttempted: 48, accuracy: Math.max(30, avgScore - 17) },
          { topicId: "t-8", topicName: "Probability & Bayes", subjectName: "Mathematics", mastery: Math.max(45, avgScore - 2), questionsAttempted: 35, accuracy: Math.max(45, avgScore - 3) }
        ]
      };

  return {
    studentId: targetId,
    profile: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.') || 'student'}@excellencia.edu`,
      batchId: "b-srmpc-madhapur",
      batchName: batch,
      branchName: branch,
      targetExam,
      rollNumber: rollNo,
      enrollmentDate: "2024-06-15"
    },
    overview: {
      totalExams: student?.examCount || 26,
      averageScore: avgScore,
      averagePercentile: avgPct,
      highestScore: Math.min(100, Math.round(avgScore * 1.1)),
      lowestScore: Math.max(50, Math.round(avgScore * 0.85)),
      consistencyScore: Math.round(85 + (avgPct / 10)),
      batchSize: 78,
      batchRank: rank,
      practiceCount: 148,
      practiceAverage: Math.round(avgScore + 2)
    },
    scoreTrajectory,
    subjectWise,
    eri: (cached && cached.eri) || { eriValue: Math.round(avgPct * 0.9), activeCells: 142, masteredCells: Math.round(142 * (avgScore / 100)), totalCells: 160 },
    velocity: (cached && cached.velocity) || { deltaWeek: 2.4 },
    skillMap,
    errorPatterns,
    weakAreas,
    rwl,
    recentExams,
    assignmentData,

    eriDetails: cached?.eriDetails || {
      eriScore: 88.4,
      activeCells: 142,
      masteredCells: 118,
      totalCells: 160,
      deltaWeek: 2.4,
      deltaMonth: 6.8,
      velocityPoints: [
        { date: "2026-02-09", eriValue: 81.6, activeCells: 130, masteredCells: 104 },
        { date: "2026-02-14", eriValue: 83.0, activeCells: 132, masteredCells: 107 },
        { date: "2026-02-19", eriValue: 84.5, activeCells: 135, masteredCells: 110 },
        { date: "2026-02-24", eriValue: 86.0, activeCells: 138, masteredCells: 114 },
        { date: "2026-03-01", eriValue: 87.2, activeCells: 140, masteredCells: 116 },
        { date: "2026-03-06", eriValue: 88.4, activeCells: 142, masteredCells: 118 }
      ],
      subjects: [
        { subjectId: "sub-1", subjectName: "Mathematics", eriValue: 92.5, activeCells: 52, masteredCells: 46, totalCells: 56 },
        { subjectId: "sub-2", subjectName: "Chemistry", eriValue: 89.0, activeCells: 48, masteredCells: 41, totalCells: 52 },
        { subjectId: "sub-3", subjectName: "Physics", eriValue: 83.7, activeCells: 42, masteredCells: 31, totalCells: 52 }
      ],
      weakCells: [
        { id: "wc-1", topicName: "Rotational Dynamics", subjectName: "Physics", questionType: "Numerical", difficulty: "Hard", totalAttempts: 12, correctCount: 4, accuracy: 33.3, masteryState: "weak" },
        { id: "wc-2", topicName: "Wave Optics", subjectName: "Physics", questionType: "Multiple Choice", difficulty: "Hard", totalAttempts: 10, correctCount: 4, accuracy: 40.0, masteryState: "weak" },
        { id: "wc-3", topicName: "Conditional Probability", subjectName: "Mathematics", questionType: "Numerical", difficulty: "Medium", totalAttempts: 14, correctCount: 7, accuracy: 50.0, masteryState: "developing" },
        { id: "wc-4", topicName: "Coordination Compounds", subjectName: "Chemistry", questionType: "Matrix Match", difficulty: "Hard", totalAttempts: 8, correctCount: 4, accuracy: 50.0, masteryState: "developing" },
        { id: "wc-5", topicName: "Electromagnetic Induction", subjectName: "Physics", questionType: "Multiple Choice", difficulty: "Hard", totalAttempts: 11, correctCount: 6, accuracy: 54.5, masteryState: "developing" }
      ],
      actionItems: [
        { tint: "red", title: "Rotational Dynamics — Hard Numericals", body: "Low accuracy (33%) on pure rolling & angular momentum conservation in recent tests. Recommend 15 targeted numerical drills.", cta: "Assign 15 Drills" },
        { tint: "amber", title: "Wave Optics — Brewster Law & Thin Films", body: "Accuracy dropped 8% over last 2 weeks due to calculation slips on path difference formulas.", cta: "Review Concept Notes" },
        { tint: "blue", title: "Math Calculus — Maintain Titan Streak", body: "Integration and Differential Calculus are running at 94% accuracy. Lock in with full-length speed mock.", cta: "Start Timed Speed Drill" }
      ]
    },
    heatmapData: cached?.heatmapData || {
      subjects: [
        {
          id: "math",
          name: "Mathematics",
          topics: [
            { name: "Definite Integrals", easy: { acc: 98, attempts: 24, state: "mastered" }, med: { acc: 94, attempts: 32, state: "mastered" }, hard: { acc: 88, attempts: 18, state: "reinforced" } },
            { name: "Coordinate Geometry", easy: { acc: 95, attempts: 30, state: "mastered" }, med: { acc: 91, attempts: 28, state: "mastered" }, hard: { acc: 85, attempts: 16, state: "reinforced" } },
            { name: "Differential Equations", easy: { acc: 92, attempts: 18, state: "mastered" }, med: { acc: 86, attempts: 20, state: "reinforced" }, hard: { acc: 74, attempts: 12, state: "developing" } },
            { name: "Probability & Bayes", easy: { acc: 90, attempts: 22, state: "mastered" }, med: { acc: 78, attempts: 18, state: "developing" }, hard: { acc: 55, attempts: 14, state: "weak" } },
            { name: "Complex Numbers", easy: { acc: 92, attempts: 16, state: "mastered" }, med: { acc: 84, attempts: 18, state: "reinforced" }, hard: { acc: 68, attempts: 10, state: "developing" } },
            { name: "Vectors & 3D", easy: { acc: 96, attempts: 25, state: "mastered" }, med: { acc: 92, attempts: 22, state: "mastered" }, hard: { acc: 82, attempts: 14, state: "reinforced" } }
          ]
        },
        {
          id: "physics",
          name: "Physics",
          topics: [
            { name: "Electrodynamics", easy: { acc: 94, attempts: 28, state: "mastered" }, med: { acc: 89, attempts: 30, state: "mastered" }, hard: { acc: 82, attempts: 20, state: "reinforced" } },
            { name: "Thermodynamics", easy: { acc: 91, attempts: 24, state: "mastered" }, med: { acc: 85, attempts: 26, state: "reinforced" }, hard: { acc: 72, attempts: 16, state: "developing" } },
            { name: "Rotational Dynamics", easy: { acc: 88, attempts: 20, state: "reinforced" }, med: { acc: 72, attempts: 24, state: "developing" }, hard: { acc: 42, attempts: 18, state: "weak" } },
            { name: "Wave Optics", easy: { acc: 85, attempts: 16, state: "reinforced" }, med: { acc: 68, attempts: 18, state: "developing" }, hard: { acc: 48, attempts: 14, state: "weak" } },
            { name: "Electromagnetic Induction", easy: { acc: 90, attempts: 22, state: "mastered" }, med: { acc: 80, attempts: 20, state: "developing" }, hard: { acc: 62, attempts: 12, state: "developing" } },
            { name: "Modern Physics", easy: { acc: 98, attempts: 35, state: "mastered" }, med: { acc: 94, attempts: 28, state: "mastered" }, hard: { acc: 89, attempts: 18, state: "mastered" } }
          ]
        },
        {
          id: "chem",
          name: "Chemistry",
          topics: [
            { name: "Chemical Kinetics", easy: { acc: 98, attempts: 26, state: "mastered" }, med: { acc: 96, attempts: 24, state: "mastered" }, hard: { acc: 92, attempts: 15, state: "mastered" } },
            { name: "Organic Reaction Mech", easy: { acc: 92, attempts: 32, state: "mastered" }, med: { acc: 88, attempts: 30, state: "reinforced" }, hard: { acc: 81, attempts: 18, state: "reinforced" } },
            { name: "Coordination Compounds", easy: { acc: 90, attempts: 20, state: "mastered" }, med: { acc: 82, attempts: 22, state: "developing" }, hard: { acc: 65, attempts: 14, state: "developing" } },
            { name: "Electrochemistry", easy: { acc: 95, attempts: 24, state: "mastered" }, med: { acc: 91, attempts: 22, state: "mastered" }, hard: { acc: 84, attempts: 16, state: "reinforced" } },
            { name: "Ionic Equilibrium", easy: { acc: 88, attempts: 18, state: "reinforced" }, med: { acc: 79, attempts: 20, state: "developing" }, hard: { acc: 60, attempts: 12, state: "developing" } },
            { name: "Thermodynamics (Chem)", easy: { acc: 94, attempts: 22, state: "mastered" }, med: { acc: 89, attempts: 20, state: "mastered" }, hard: { acc: 82, attempts: 14, state: "reinforced" } }
          ]
        }
      ]
    },
    predictivePathData: cached?.predictivePathData || {
      targetExam: "JEE Mains 2026",
      forecastScore: 278,
      forecastRange: "270 - 286",
      forecastPercentile: 99.1,
      confidencePct: 89,
      points: [
        { label: "Mock 1", score: 232, predicted: false },
        { label: "Mock 2", score: 240, predicted: false },
        { label: "UT 4", score: 248, predicted: false },
        { label: "Mock 3", score: 254, predicted: false },
        { label: "Mock 4", score: 262, predicted: false },
        { label: "Sprint 1", score: 268, predicted: true },
        { label: "Sprint 2", score: 274, predicted: true },
        { label: "Final JEE", score: 278, predicted: true }
      ],
      milestones: [
        { title: "Crossed 95th Percentile Barrier", date: "Jan 14, 2026", note: "Jumped +18 marks following Calculus remediation drills." },
        { title: "Top 3 Rank in SR MPC Batch", date: "Feb 02, 2026", note: "Maintained 91% accuracy across all 3 subjects in Mock 3." },
        { title: "Titan Status in Exam Readiness Index (ERI > 85)", date: "Feb 28, 2026", note: "Mastered 118 concept cells across syllabus." }
      ]
    },
    rankPredictorData: cached?.rankPredictorData || {
      currentMarks: 262,
      maxMarks: 300,
      predictedAir: 1420,
      airRange: "1,250 - 1,600",
      predictedPercentile: 99.4,
      targetColleges: [
        { institute: "IIT Bombay", branch: "Electrical Engineering", cutoffRank: 420, probabilityPct: 45 },
        { institute: "IIT Madras", branch: "Mechanical Engineering", cutoffRank: 1850, probabilityPct: 88 },
        { institute: "NIT Trichy", branch: "Computer Science", cutoffRank: 2100, probabilityPct: 94 },
        { institute: "BITS Pilani", branch: "Computer Science", cutoffRank: 1500, probabilityPct: 78 }
      ],
      subjectDeltas: [
        { subject: "Physics", currentMarks: 86, potentialGain: 8, difficulty: "Medium", lever: "Fix pure rolling rotational questions" },
        { subject: "Chemistry", currentMarks: 90, potentialGain: 4, difficulty: "Low", lever: "Revise coordination isomerism exceptions" },
        { subject: "Mathematics", currentMarks: 86, potentialGain: 12, difficulty: "Hard", lever: "Speed drills on 3D coordinate geometry" }
      ]
    },
    practiceData: {
      totalQuestions: Math.round(1200 + (avgScore * 3.5)),
      totalHours: Number(((1200 + (avgScore * 3.5)) / 30).toFixed(1)),
      overallAccuracy: Number((avgScore * 0.98 + 3).toFixed(1)),
      streakDays: Math.max(7, Math.round(avgScore * 0.22)),
      longestStreakDays: Math.max(12, Math.round(avgScore * 0.22) + 5),
      dppStreak: Math.max(7, Math.round(avgScore * 0.22)),
      mockFrequency: (avgScore >= 80 ? 2.5 : 2.0),
      selfAssignedRatio: 65,
      dppCompletionRate: Math.min(100, Math.round(82 + (avgScore * 0.15))),
      homeworkAdherence: Math.min(100, Math.round(85 + (avgScore * 0.12))),
      weeklyVolume: [
        { week: "W1", questions: 120, accuracy: Math.max(65, Math.round(avgScore * 0.9)) },
        { week: "W2", questions: 180, accuracy: Math.max(68, Math.round(avgScore * 0.92)) },
        { week: "W3", questions: 220, accuracy: Math.max(70, Math.round(avgScore * 0.95)) },
        { week: "W4", questions: 260, accuracy: Math.round(avgScore) },
        { week: "W5", questions: 310, accuracy: Math.min(96, Math.round(avgScore + 2)) },
        { week: "W6", questions: 390, accuracy: Math.round(avgScore) }
      ],
      typeBreakdown: [
        { type: "Daily Practice Problems (DPP)", count: Math.round((1200 + (avgScore * 3.5)) * 0.35), percentage: 35, accuracy: Math.min(96, Math.round(avgScore + 2)), color: "#2563EB" },
        { type: "Chapter Practice Drills", count: Math.round((1200 + (avgScore * 3.5)) * 0.30), percentage: 30, accuracy: Math.max(60, Math.round(avgScore - 2)), color: "#10B981" },
        { type: "Previous Year Questions (PYQ)", count: Math.round((1200 + (avgScore * 3.5)) * 0.22), percentage: 22, accuracy: Math.min(98, Math.round(avgScore + 4)), color: "#F59E0B" },
        { type: "Self-Initiated Drills", count: Math.round((1200 + (avgScore * 3.5)) * 0.13), percentage: 13, accuracy: Math.max(55, Math.round(avgScore - 8)), color: "#8B5CF6" }
      ],
      activityDays: [
        { date: "Mar 16, 2026", type: "DPP Drill", subject: "Physics", topic: "Electrodynamics — Gauss Law", minutes: 35, answered: 25, correct: Math.round(25 * (Math.min(96, avgScore + 2) / 100)), accuracy: Math.min(96, avgScore + 2) },
        { date: "Mar 15, 2026", type: "Chapter Test", subject: isNeet ? "Biology" : "Mathematics", topic: isNeet ? "Genetics — Mendelian Ratios" : "Definite Integrals — Properties", minutes: 45, answered: 30, correct: Math.round(30 * (Math.min(98, avgScore + 3) / 100)), accuracy: Math.min(98, avgScore + 3) },
        { date: "Mar 14, 2026", type: "Self Practice", subject: "Chemistry", topic: "Chemical Kinetics — Rate Laws & Arrhenius", minutes: 30, answered: 20, correct: Math.round(20 * (avgScore / 100)), accuracy: avgScore },
        { date: "Mar 13, 2026", type: "PYQ Drill", subject: "Physics", topic: "Rotational Dynamics — Moment of Inertia", minutes: 50, answered: 25, correct: Math.max(12, Math.round(25 * (Math.max(50, avgScore - 8) / 100))), accuracy: Math.max(50, avgScore - 8) },
        { date: "Mar 12, 2026", type: "DPP Drill", subject: isNeet ? "Biology" : "Mathematics", topic: isNeet ? "Human Physiology — Circulation" : "Differential Equations — Homogeneous", minutes: 40, answered: 25, correct: Math.round(25 * (avgScore / 100)), accuracy: avgScore },
        { date: "Mar 11, 2026", type: "Revision Quiz", subject: "Chemistry", topic: "Coordination Compounds — CFT & Ligands", minutes: 25, answered: 20, correct: Math.round(20 * (Math.min(98, avgScore + 4) / 100)), accuracy: Math.min(98, avgScore + 4) },
        { date: "Mar 10, 2026", type: "DPP Drill", subject: "Physics", topic: "Current Electricity — Kirchhoff Rules", minutes: 35, answered: 25, correct: Math.round(25 * (avgScore / 100)), accuracy: avgScore },
        { date: "Mar 09, 2026", type: "Chapter Test", subject: isNeet ? "Biology" : "Mathematics", topic: isNeet ? "Plant Anatomy — Tissues" : "Coordinate Geometry — Circles", minutes: 45, answered: 30, correct: Math.round(30 * (Math.max(50, avgScore - 3) / 100)), accuracy: Math.max(50, avgScore - 3) },
        { date: "Mar 08, 2026", type: "Self Practice", subject: "Chemistry", topic: "Organic Mechanisms — SN1 vs SN2 Substitution", minutes: 30, answered: 20, correct: Math.round(20 * (avgScore / 100)), accuracy: avgScore },
        { date: "Mar 07, 2026", type: "DPP Drill", subject: "Physics", topic: "Magnetism — Biot-Savart Law", minutes: 40, answered: 25, correct: Math.round(25 * (Math.max(50, avgScore - 4) / 100)), accuracy: Math.max(50, avgScore - 4) }
      ],
      errorCorrection: {
        flagged: Math.round(weakAreas.totalErrors * 1.8),
        resolved: Math.round(weakAreas.totalErrors * 1.4),
        pending: Math.max(5, Math.round(weakAreas.totalErrors * 0.4)),
        avgTurnaroundDays: Number((2.8 + (100 - avgScore) * 0.02).toFixed(1)),
        avgRevisionsToMaster: Number((1.8 + (100 - avgScore) * 0.01).toFixed(1)),
        complianceRate: Math.min(98, Number((78 + avgScore * 0.15).toFixed(1))),
        overdueReviews: avgScore >= 75 ? 2 : 6
      }
    },
    successGapData: cached?.successGapData || {
      metricDeltas: [
        { metric: "Mock Average Score", studentValue: "262 / 300", topperValue: "284 / 300", gap: "-22 marks", status: "closing" },
        { metric: "Negative Marking Slip", studentValue: "-14 marks", topperValue: "-4 marks", gap: "10 marks lost to slips", status: "critical" },
        { metric: "Time in First 30 Min", studentValue: "18 questions", topperValue: "25 questions", gap: "-7 questions pace", status: "warning" },
        { metric: "Hard Tier Accuracy", studentValue: "64%", topperValue: "88%", gap: "-24% accuracy", status: "warning" }
      ],
      recommendation: "Closing the negative marking penalty from -14 to -4 marks will instantly recover +10 marks, shifting predicted AIR from #1,420 to ~#850."
    },
    weaknessImprovementData: cached?.weaknessImprovementData || {
      remediationCycles: [
        { topic: "Rotational Motion", cycleDate: "Feb 10 - Feb 18", beforeAcc: 28, afterAcc: 62, drillsCompleted: 45, status: "improving" },
        { topic: "Ionic Equilibrium", cycleDate: "Feb 20 - Feb 28", beforeAcc: 40, afterAcc: 84, drillsCompleted: 30, status: "mastered" },
        { topic: "Integration by Parts", cycleDate: "Mar 01 - Mar 06", beforeAcc: 55, afterAcc: 92, drillsCompleted: 40, status: "mastered" }
      ]
    },
    timeVsPerformanceData: cached?.timeVsPerformanceData || {
      distribution: [
        { category: "Fast & Accurate (<60s, Correct)", count: 48, pct: 64, tone: "text-emerald-700 bg-emerald-50" },
        { category: "Thoughtful & Accurate (60-120s, Correct)", count: 18, pct: 24, tone: "text-blue-700 bg-blue-50" },
        { category: "Rushed Error (<45s, Wrong)", count: 5, pct: 7, tone: "text-amber-700 bg-amber-50" },
        { category: "Time Sink Error (>150s, Wrong)", count: 4, pct: 5, tone: "text-rose-700 bg-rose-50" }
      ],
      timeWastedOnErrorsSeconds: 840
    },
    attendanceImpactData: cached?.attendanceImpactData || {
      attendancePct: 96.4,
      classesAttended: 162,
      classesTotal: 168,
      correlationPoints: [
        { week: "W1", attendance: 100, testScore: 84 },
        { week: "W2", attendance: 100, testScore: 86 },
        { week: "W3", attendance: 80, testScore: 78 },
        { week: "W4", attendance: 100, testScore: 88 },
        { week: "W5", attendance: 100, testScore: 91 },
        { week: "W6", attendance: 100, testScore: 92 }
      ],
      facultyNotes: [
        { date: "2026-03-02", author: "Dr. K. Srinivas (Physics)", note: "Active participation in doubts session. Resolved moment of inertia queries quickly." },
        { date: "2026-02-18", author: "V. Sharma (Math)", note: "Consistent topper in daily problem set sprints." }
      ]
    }
  };
}

export function renderStudentDetail(studentId) {
  const data = getStudentAnalyticsData(studentId);
  if (!data) return;

  // Header
  const nameEl = document.getElementById("student-detail-name");
  if (nameEl) nameEl.textContent = data.profile.name;
  const examEl = document.getElementById("student-detail-exam");
  if (examEl) examEl.textContent = data.profile.targetExam || "JEE Mains";
  const rollEl = document.getElementById("student-detail-roll");
  if (rollEl) rollEl.textContent = data.profile.rollNumber || "225144";
  const batchEl = document.getElementById("student-detail-batch-name");
  if (batchEl) batchEl.textContent = data.profile.batchName || "SR MPC";
  const branchEl = document.getElementById("student-detail-branch-name");
  if (branchEl) branchEl.textContent = data.profile.branchName || "Madhapur";

  // Avatar initials
  const avatarEl = document.getElementById("student-detail-avatar");
  if (avatarEl) {
    const parts = (data.profile.name || "Student").split(" ");
    avatarEl.textContent = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  }

  // Rank Banner & Top Metrics
  const bannerRank = document.getElementById("banner-batch-rank");
  if (bannerRank) bannerRank.textContent = data.overview.batchRank ? `${ordinal(data.overview.batchRank)} / ${data.overview.batchSize || 78}` : "—";
  const bannerPct = document.getElementById("banner-batch-pct");
  if (bannerPct) bannerPct.textContent = data.overview.averagePercentile ? ordinal(Math.round(data.overview.averagePercentile)) : "—";
  const bannerAvg = document.getElementById("banner-avg-score");
  if (bannerAvg) bannerAvg.textContent = `${Math.round(data.overview.averageScore)}%`;
  const bannerHigh = document.getElementById("banner-highest-score");
  if (bannerHigh) bannerHigh.textContent = `${Math.round(data.overview.highestScore)}%`;

  // Overview KPI Cards
  const cardRank = document.getElementById("card-batch-rank");
  if (cardRank) cardRank.textContent = data.overview.batchRank ? `#${data.overview.batchRank}` : "—";
  const cardExams = document.getElementById("card-total-exams");
  if (cardExams) cardExams.textContent = data.overview.totalExams || "26";
  const cardAvg = document.getElementById("card-avg-score");
  if (cardAvg) cardAvg.textContent = `${data.overview.averageScore}%`;
  const cardConsistency = document.getElementById("card-consistency");
  if (cardConsistency) cardConsistency.textContent = data.overview.consistencyScore != null ? data.overview.consistencyScore : "92";

  // Syllabus & Exam Readiness (Replaces Cryptic ERI)
  const eriVal = data.eri?.eriValue || 88;
  const eriScoreEl = document.getElementById("eri-score");
  if (eriScoreEl) eriScoreEl.textContent = Math.round(eriVal);
  const eriLevelEl = document.getElementById("eri-level");
  if (eriLevelEl) {
    const level = eriVal >= 80 ? "JEE Adv Ready" : eriVal >= 60 ? "JEE Mains Ready" : eriVal >= 40 ? "Needs Practice" : "Needs Support";
    eriLevelEl.textContent = level;
    eriLevelEl.className = `rounded-md px-1.5 py-0.5 text-[10px] font-bold ${eriVal >= 80 ? 'bg-emerald-50 text-emerald-700' : eriVal >= 60 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`;
  }
  const activeCells = data.eri?.activeCells || 142;
  const masteredCells = data.eri?.masteredCells || 118;
  const weakCells = Math.max(0, activeCells - masteredCells);
  const eriActiveEl = document.getElementById("eri-active-cells");
  if (eriActiveEl) eriActiveEl.textContent = activeCells;
  const eriMasteredEl = document.getElementById("eri-mastered-cells");
  if (eriMasteredEl) eriMasteredEl.textContent = masteredCells;
  const eriWeakEl = document.getElementById("eri-weak-cells");
  if (eriWeakEl) eriWeakEl.textContent = weakCells;

  const eriDeltaEl = document.getElementById("eri-weekly-delta");
  if (eriDeltaEl && data.velocity?.deltaWeek != null) {
    const d = data.velocity.deltaWeek;
    eriDeltaEl.innerHTML = `Weekly change: <span class="${d >= 0 ? 'text-emerald-600' : 'text-red-500'} font-semibold">${d >= 0 ? '+' : ''}${d.toFixed(1)}</span> ERI points`;
  }

  // Subject Performance Quick Cards
  const subjects = data.subjectWise || [];
  subjects.slice(0, 3).forEach((s, idx) => {
    const i = idx + 1;
    const titleEl = document.getElementById(`subj-card-title-${i}`);
    if (titleEl) titleEl.textContent = s.subjectName;
    const scoreEl = document.getElementById(`subj-card-score-${i}`);
    if (scoreEl) scoreEl.textContent = `${Math.round(s.accuracy)}% Acc`;
  });

  // Score Timeline Chart
  renderStudentTrajectoryChart(data.scoreTrajectory || []);

  // Subject-wise Accuracy Chart
  renderStudentSubjectBarChart(data.subjectWise || []);

  // Skill Map Radar Chart
  renderStudentSkillRadarChart(data.skillMap?.current || []);

  // Error Patterns Chart
  renderStudentErrorPatternChart(data.errorPatterns || {});

  // Cumulative Subject Mastery Chart
  renderStudentCumMasteryChart(data.skillMap?.current || []);

  // Filtered & Paginated Exams Table
  renderStudentExamsTable(data.recentExams || []);

  // Assignments & Practice
  renderStudentAssignments(data.assignmentData || []);

  // High / Low Range
  const highEl = document.getElementById("stat-highest-score");
  if (highEl) highEl.textContent = `${data.overview.highestScore}%`;
  const lowEl = document.getElementById("stat-lowest-score");
  if (lowEl) lowEl.textContent = `${data.overview.lowestScore}%`;

  // Error Analytics Overview
  renderStudentErrorOverview(data.weakAreas, data.errorPatterns, data.rwl);

  // Weak Areas
  renderStudentWeakAreas(data.weakAreas);

  // Recurring Wrong List (RWL)
  renderStudentRwl(data.rwl);

  // Initialize Tab State
  switchStudentTab(currentStudentTab);
}

export function switchStudentTab(tabId) {
  currentStudentTab = tabId || 'diagnostic';
  const tabs = ['diagnostic', 'exams', 'deepdives'];
  tabs.forEach(t => {
    const btn = document.getElementById(`student-tab-btn-${t}`);
    const panel = document.getElementById(`student-tab-${t}-panel`);
    if (t === currentStudentTab) {
      if (btn) {
        btn.className = "student-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all bg-indigo-600 text-white shadow-xs";
      }
      if (panel) {
        panel.classList.remove('hidden');
      }
    } else {
      if (btn) {
        btn.className = "student-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-medium text-muted transition-all hover:text-foreground hover:bg-slate-50";
      }
      if (panel) {
        panel.classList.add('hidden');
      }
    }
  });

  // Re-render and resize charts in active tab so canvas elements do not render with 0 dimensions
  const currentStudentId = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(currentStudentId);
  if (tabId === 'diagnostic' && data) {
    setTimeout(() => {
      renderStudentTrajectoryChart(data.scoreTrajectory || []);
      renderStudentSubjectBarChart(data.subjectWise || []);
      renderStudentSkillRadarChart(data.skillMap?.current || []);
      renderStudentCumMasteryChart(data.skillMap?.current || []);
      renderStudentErrorOverview(data.weakAreas, data.errorPatterns, data.rwl);
    }, 40);
  } else if (tabId === 'deepdives' && data) {
    setTimeout(() => {
      renderStudentErrorPatternChart(data.errorPatterns || {});
    }, 40);
  }
}

export function openStudentWhatsApp(studentId) {
  const targetId = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(targetId);
  const modal = document.getElementById('student-whatsapp-modal');
  const body = document.getElementById('whatsapp-message-body');
  if (!data) return;

  const rank = data.overview.batchRank ? `#${data.overview.batchRank}` : '#1';
  const total = data.overview.batchSize || 78;
  const avgScore = Math.round(data.overview.averageScore);
  const targetExam = data.profile.targetExam || 'JEE Mains';
  const weakSub = data.weakAreas?.subjects?.[0]?.subjectName || 'Physics';

  const msg = `Respected Parent,\n\nHere is the weekly academic performance summary for *${data.profile.name}* (${data.profile.batchName}, ${data.profile.branchName} Campus):\n\n• *Target Exam:* ${targetExam}\n• *Current Standing:* Rank ${rank} of ${total} students (Top ${Math.max(1, 100 - Math.round(data.overview.averagePercentile))}%ile)\n• *Mock Test Average:* ${avgScore}% Marks\n• *Attendance & Practice:* 96% Test Attendance, 86% DPP Submission\n• *Focus Area:* Targeted problem-solving drills in ${weakSub}.\n\nOur faculty has scheduled a short PTM consultation this Saturday. Please feel free to reply directly here with any questions.\n\nWarm regards,\n*Academic Coordinator · Excellencia Junior College*`;

  if (body) {
    body.textContent = msg;
  }
  if (modal) {
    modal.classList.remove('hidden');
  }
}

export function closeStudentWhatsAppModal() {
  const modal = document.getElementById('student-whatsapp-modal');
  if (modal) modal.classList.add('hidden');
}

export function copyWhatsAppMessage() {
  const body = document.getElementById('whatsapp-message-body');
  const btnText = document.getElementById('whatsapp-copy-text');
  if (body && body.textContent) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(body.textContent).then(() => {
        if (btnText) {
          btnText.textContent = 'Copied!';
          setTimeout(() => { if (btnText) btnText.textContent = 'Copy Text'; }, 2000);
        }
      }).catch(() => {
        if (btnText) btnText.textContent = 'Copied!';
      });
    } else {
      if (btnText) btnText.textContent = 'Copied!';
    }
  }
}

export function sendWhatsAppDirect() {
  const body = document.getElementById('whatsapp-message-body');
  if (body && body.textContent) {
    const text = encodeURIComponent(body.textContent);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }
}

export function openStudentPtmNotes() {
  const targetId = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(targetId);
  const name = data?.profile?.name || 'Student';
  const sub = data?.weakAreas?.subjects?.[0]?.subjectName || 'Physics';
  alert(`Counseling Log for ${name}:\n• Student is progressing on target for ${data?.profile?.targetExam || 'JEE'}.\n• Priority action: Focus on ${sub} problem-solving drills.\n• PTM status: Parent notification scheduled via WhatsApp.`);
}

export function setStudentTimeRange(range) {
  currentStudentTimeRange = range;
  document.querySelectorAll(".student-range-btn").forEach(btn => {
    btn.className = "student-range-btn rounded-lg px-2.5 py-1 transition-colors text-muted hover:bg-primary/5 hover:text-foreground";
  });
  const activeBtn = document.getElementById(`student-range-${range}`);
  if (activeBtn) {
    activeBtn.className = "student-range-btn rounded-lg px-2.5 py-1 transition-colors bg-white font-semibold text-primary shadow-xs";
  }
  const currentStudentId = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(currentStudentId);
  if (data) {
    renderStudentExamsTable(data.recentExams || []);
  }
}

export function changeStudentExamsPage(delta) {
  currentStudentExamsPage += delta;
  const currentStudentId = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(currentStudentId);
  if (data) {
    renderStudentExamsTable(data.recentExams || []);
  }
}

export function refreshStudentAnalytics() {
  const currentStudentId = store.get('currentActiveStudentId') || 's-101';
  renderStudentDetail(currentStudentId);
}

export function renderStudentTrajectoryChart(trajectory) {
  destroyChart('studentTrajectoryChart');
  const canvas = document.getElementById("studentTrajectoryChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const recents = trajectory.slice(-10);
  const labels = recents.map(t => t.examTitle.length > 14 ? t.examTitle.slice(0, 14) + "…" : t.examTitle);
  const scores = recents.map(t => Math.round(t.percentage));
  const cutoffs = recents.map(() => 75);

  const subtitle = document.getElementById("student-trajectory-subtitle");
  if (subtitle) {
    subtitle.textContent = `Score trend across last ${recents.length} mock tests vs 75% qualifying cutoff`;
  }

  // Create smooth vertical gradient for the line area fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, "rgba(79, 70, 229, 0.25)");
  gradient.addColorStop(1, "rgba(79, 70, 229, 0.01)");

  const chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: "Student Score %",
          data: scores,
          borderColor: "#4F46E5",
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: "#FFFFFF",
          pointBorderColor: "#4F46E5",
          pointBorderWidth: 2.5,
          pointRadius: 4.5,
          pointHoverRadius: 6.5
        },
        {
          label: "Qualifying Cutoff (75%)",
          data: cutoffs,
          borderColor: "#F59E0B",
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { boxWidth: 14, font: { size: 11, weight: '500' }, color: '#475569' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const diff = ctx.parsed.y - 75;
                const sign = diff >= 0 ? '+' : '';
                return ` Score: ${ctx.parsed.y}% (${sign}${diff}% vs Cutoff)`;
              }
              return ` Cutoff Target: 75%`;
            }
          }
        }
      },
      scales: {
        y: {
          min: Math.max(0, Math.min(...scores) - 15),
          max: 100,
          ticks: {
            font: { size: 10 },
            callback: (v) => `${v}%`
          },
          grid: { color: "#F1F5F9" }
        },
        x: {
          ticks: { font: { size: 10 }, maxRotation: 20 },
          grid: { display: false }
        }
      }
    }
  });
  registerChart('studentTrajectoryChart', chartInstance);
}

export function renderStudentSubjectBarChart(subjectWise) {
  destroyChart('studentSubjectBarChart');
  const canvas = document.getElementById("studentSubjectBarChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const labels = subjectWise.map(s => s.subjectName);
  const accuracies = subjectWise.map(s => Math.round(s.accuracy));
  const bgColors = accuracies.map(a => 
    a >= 85 ? "#10B981" : a >= 70 ? "#2563EB" : a >= 50 ? "#F59E0B" : "#EF4444"
  );

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Accuracy %",
        data: accuracies,
        backgroundColor: bgColors,
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = subjectWise[ctx.dataIndex];
              return ` Accuracy: ${ctx.parsed.x}% (${item?.correctAnswers || 0}/${item?.totalQuestions || 0})`;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            font: { size: 10 },
            callback: (v) => `${v}%`
          },
          grid: { color: "#F1F5F9" }
        },
        y: {
          ticks: { font: { size: 11, weight: '600' } },
          grid: { display: false }
        }
      }
    }
  });
  registerChart('studentSubjectBarChart', chartInstance);
}

export function renderStudentSkillRadarChart(skills) {
  destroyChart('studentSkillRadarChart');
  const listContainer = document.getElementById("student-chapter-strength-list");
  
  const slice = [...(skills || [])];
  // Sort descending by mastery so strongest to weakest are clear for faculty
  slice.sort((a, b) => b.mastery - a.mastery);

  if (listContainer) {
    if (slice.length === 0) {
      listContainer.innerHTML = `<p class="text-xs text-muted text-center py-4">No chapter data recorded yet.</p>`;
    } else {
      listContainer.innerHTML = slice.map(s => {
        const m = Math.round(s.mastery);
        const isMastered = m >= 85;
        const isDeveloping = m >= 70 && m < 85;

        const badgeClass = isMastered
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : isDeveloping
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : m >= 50
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-rose-50 text-rose-700 border-rose-200";

        const badgeText = isMastered
          ? "Strong"
          : isDeveloping
            ? "Good"
            : m >= 50
              ? "Developing"
              : "Needs Drill";

        const barColor = isMastered
          ? "bg-emerald-500"
          : isDeveloping
            ? "bg-blue-500"
            : m >= 50
              ? "bg-amber-500"
              : "bg-rose-500";

        return `
          <div class="p-2.5 rounded-xl border border-border/80 bg-white hover:bg-slate-50/80 transition-colors">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-semibold text-gray-900 truncate">${s.topicName}</span>
                <span class="text-[10px] text-muted shrink-0">· ${s.subjectName}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-mono text-xs font-bold text-gray-900">${m}%</span>
                <span class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}">${badgeText}</span>
              </div>
            </div>
            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500 ${barColor}" style="width: ${m}%;"></div>
            </div>
            <div class="mt-1 flex items-center justify-between text-[10px] text-muted">
              <span>${s.questionsAttempted || 40} Questions Attempted</span>
              <span>Accuracy: ${Math.round(s.accuracy || m)}%</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Safety fallback if canvas is ever made visible
  const canvas = document.getElementById("studentSkillRadarChart");
  if (canvas && !canvas.classList.contains('hidden') && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const labels = slice.map(s => s.topicName.length > 15 ? s.topicName.slice(0, 15) + "…" : s.topicName);
      const masteries = slice.map(s => s.mastery);
      const chartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            label: "Topic Mastery",
            data: masteries,
            backgroundColor: "rgba(139, 92, 246, 0.2)",
            borderColor: "#8B5CF6"
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      registerChart('studentSkillRadarChart', chartInstance);
    }
  }
}

export function renderStudentErrorPatternChart(errorPatterns) {
  destroyChart('studentErrorPatternChart');
  const canvas = document.getElementById("studentErrorPatternChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const types = (errorPatterns?.byType || []).slice(0, 6);
  const labels = types.map(t => t.label);
  const counts = types.map(t => t.count);

  const badge = document.getElementById("student-error-trend-badge");
  if (badge) {
    const isImproving = errorPatterns?.trend?.direction === "improving";
    badge.innerHTML = isImproving 
      ? `<i class="ph-bold ph-trend-down text-success text-sm"></i><span class="text-xs font-semibold text-success">Improving</span>`
      : `<i class="ph-bold ph-trend-up text-danger text-sm"></i><span class="text-xs font-semibold text-danger">Worsening</span>`;
  }

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Error Count",
        data: counts,
        backgroundColor: "#EF4444",
        borderRadius: 4,
        maxBarThickness: 20
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Errors: ${ctx.parsed.x}`
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, stepSize: 2 },
          grid: { color: "#F1F5F9" }
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
  registerChart('studentErrorPatternChart', chartInstance);
}

export function renderStudentCumMasteryChart(skills) {
  destroyChart('studentCumMasteryChart');
  const canvas = document.getElementById("studentCumMasteryChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const subjectMap = {};
  (skills || []).forEach(s => {
    const subj = s.subjectName || "Other";
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += s.mastery;
    subjectMap[subj].count++;
  });

  const subjects = Object.keys(subjectMap);
  const masteries = subjects.map(s => Math.round(subjectMap[s].total / Math.max(1, subjectMap[s].count)));
  const bgColors = masteries.map(m => m >= 85 ? "#10B981" : m >= 70 ? "#2563EB" : m >= 50 ? "#F59E0B" : "#EF4444");

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: subjects.length ? subjects : ["Mathematics", "Physics", "Chemistry"],
      datasets: [{
        label: "Cumulative Mastery",
        data: masteries.length ? masteries : [92, 81, 91],
        backgroundColor: bgColors.length ? bgColors : ["#10B981", "#2563EB", "#10B981"],
        borderRadius: 6,
        maxBarThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Mastery: ${ctx.parsed.x}%`
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { font: { size: 10 }, callback: (v) => `${v}%` },
          grid: { color: "#F1F5F9" }
        },
        y: {
          ticks: { font: { size: 11, weight: '600' } },
          grid: { display: false }
        }
      }
    }
  });
  registerChart('studentCumMasteryChart', chartInstance);
}

export function renderStudentExamsTable(exams) {
  const tbody = document.getElementById("student-exams-table-body");
  if (!tbody) return;

  const now = new Date("2026-03-10").getTime();
  const cutoffDays = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "year": 365,
    "all": null
  }[currentStudentTimeRange];

  const filtered = cutoffDays == null 
    ? exams 
    : exams.filter(e => {
        if (!e.date) return false;
        const t = new Date(e.date).getTime();
        return !isNaN(t) && (now - t) <= cutoffDays * 24 * 60 * 60 * 1000;
      });

  const total = filtered.length;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentStudentExamsPage = Math.min(Math.max(1, currentStudentExamsPage), totalPages);

  const startIdx = (currentStudentExamsPage - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  const countMeta = document.getElementById("student-exams-count-meta");
  if (countMeta) {
    const rangeText = {
      "all": "all time",
      "7d": "last 7 days",
      "30d": "last 30 days",
      "90d": "last 90 days",
      "year": "last year"
    }[currentStudentTimeRange];
    countMeta.textContent = `${total} exam${total === 1 ? '' : 's'} in ${rangeText} · click a row to inspect`;
  }

  const currentStudentId = store.get('currentActiveStudentId') || 's-101';

  if (pageRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-xs text-muted">
          No exams found in this time range. Try selecting "All".
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageRows.map(e => {
      const scoreColor = e.percentage >= 80 ? "text-success" : e.percentage >= 50 ? "text-primary" : "text-danger";
      return `
        <tr class="group border-b border-border/40 hover:bg-primary/5 transition-colors cursor-pointer" onclick="openStudentTestAnalysis('${currentStudentId}', '${e.examId || 'ex-301'}')">
          <td class="py-3 pr-4 font-medium text-gray-900 group-hover:text-primary transition-colors">
            ${e.examTitle}
          </td>
          <td class="py-3 pr-4 text-xs text-muted whitespace-nowrap">
            ${e.date || '—'}
          </td>
          <td class="py-3 pr-4 text-right font-mono font-semibold ${scoreColor}">
            ${Math.round(e.percentage)}%
          </td>
          <td class="py-3 pr-4 text-right font-mono text-xs text-muted">
            ${e.percentile != null ? Math.round(e.percentile) + '%ile' : '—'}
          </td>
          <td class="py-3 text-right">
            <i class="ph-bold ph-caret-right text-muted opacity-0 group-hover:opacity-100 transition-opacity"></i>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Update pagination
  const pageInfo = document.getElementById("student-exams-page-info");
  if (pageInfo) {
    pageInfo.textContent = total > 0 ? `Showing ${startIdx + 1} - ${Math.min(startIdx + pageSize, total)} of ${total}` : "Showing 0 exams";
  }
  const pageCur = document.getElementById("student-exams-page-cur");
  if (pageCur) pageCur.textContent = `Page ${currentStudentExamsPage} / ${totalPages}`;

  const prevBtn = document.getElementById("student-exams-prev");
  if (prevBtn) prevBtn.disabled = currentStudentExamsPage <= 1;
  const nextBtn = document.getElementById("student-exams-next");
  if (nextBtn) nextBtn.disabled = currentStudentExamsPage >= totalPages;
}

export function renderStudentAssignments(assignments) {
  const listContainer = document.getElementById("student-assignment-list");
  if (!listContainer) return;

  const total = assignments.length;
  const completed = assignments.filter(a => a.status === "done").length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalEl = document.getElementById("assign-stat-total");
  if (totalEl) totalEl.textContent = total;
  const completedEl = document.getElementById("assign-stat-completed");
  if (completedEl) completedEl.textContent = completed;
  const rateEl = document.getElementById("assign-stat-rate");
  if (rateEl) {
    rateEl.textContent = `${rate}%`;
    rateEl.className = `font-mono text-lg font-bold ${rate >= 80 ? 'text-success' : rate >= 50 ? 'text-primary' : 'text-danger'}`;
  }

  listContainer.innerHTML = assignments.map(a => {
    const isExam = a.type === "exam";
    const isDpp = a.type === "dpp";
    const iconClass = isExam ? "ph-duotone ph-exam text-blue-600" : isDpp ? "ph-duotone ph-clipboard-text text-orange-600" : "ph-duotone ph-clipboard-text text-primary";
    const iconBg = isExam ? "bg-blue-50" : isDpp ? "bg-orange-50" : "bg-primary/10";
    const subtitle = isExam ? "Exam" : isDpp ? "DPP" : "Assignment";
    const scoreColor = a.score != null ? (a.score >= 80 ? "text-success" : a.score >= 50 ? "text-primary" : "text-danger") : "";
    const statusBadge = a.status === "done" ? "bg-success/10 text-success" : a.status === "missed" ? "bg-danger/10 text-danger" : "bg-amber-100 text-amber-800";
    const statusText = a.status === "done" ? "Done" : a.status === "missed" ? "Missed" : "Pending";
    const safeTitle = (a.title || '').replace(/'/g, "\\'");

    return `
      <div class="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/5 cursor-pointer" onclick="openAssignmentDeveloperModal('${safeTitle}', '${subtitle}', '${statusText}', '${a.score != null ? Math.round(a.score) : ''}', '${a.completedAt || ''}')">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}">
          <i class="${iconClass} text-base"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate text-gray-900 group-hover:text-primary transition-colors">${a.title}</p>
          <p class="text-[11px] text-muted">${subtitle} ${a.completedAt ? '· ' + a.completedAt : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          ${a.score != null ? `<span class="font-mono text-xs font-bold ${scoreColor}">${Math.round(a.score)}%</span>` : ''}
          <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge}">${statusText}</span>
          <i class="ph-bold ph-caret-right text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </div>
      </div>
    `;
  }).join("");
}

export function renderStudentErrorOverview(weakAreas, errorPatterns, rwl) {
  const topSubjEl = document.getElementById("error-top-subject");
  if (topSubjEl && weakAreas?.subjects?.[0]) {
    topSubjEl.textContent = weakAreas.subjects[0].subjectName;
  }

  const totalMistakes = weakAreas?.totalErrors || 42;
  const unresolved = weakAreas?.totalUnresolved || 11;
  const closureRate = totalMistakes > 0 ? Math.round(((totalMistakes - unresolved) / totalMistakes) * 100) : 74;

  const totalEl = document.getElementById("err-total-mistakes");
  if (totalEl) totalEl.textContent = totalMistakes;
  const unresEl = document.getElementById("err-unresolved");
  if (unresEl) unresEl.textContent = unresolved;
  const rateEl = document.getElementById("err-closure-rate");
  if (rateEl) rateEl.textContent = `${closureRate}%`;
  const repeatEl = document.getElementById("err-avg-repeat");
  if (repeatEl) repeatEl.textContent = "×2.1";

  // Category Donut Chart
  destroyChart('studentErrorDonutChart');
  const donutCanvas = document.getElementById("studentErrorDonutChart");
  if (donutCanvas && typeof Chart !== 'undefined') {
    const ctx = donutCanvas.getContext("2d");

    const categoryMap = {};
    (errorPatterns?.byType || []).forEach(e => {
      const cat = e.category || "Other";
      categoryMap[cat] = (categoryMap[cat] || 0) + e.count;
    });

    const categories = Object.keys(categoryMap);
    const counts = categories.map(c => categoryMap[c]);
    const catColors = {
      "Conceptual": "#3B82F6",
      "Formula/Method": "#8B5CF6",
      "Careless": "#F59E0B",
      "Time/Strategy": "#EF4444",
      "Other": "#94A3B8"
    };

    const chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories.length ? categories : ["Careless", "Conceptual", "Time/Strategy", "Formula/Method"],
        datasets: [{
          data: counts.length ? counts : [18, 9, 9, 6],
          backgroundColor: categories.length ? categories.map(c => catColors[c] || "#94A3B8") : ["#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6"],
          borderWidth: 2,
          borderColor: "#FFFFFF"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10 } }
          }
        }
      }
    });
    registerChart('studentErrorDonutChart', chartInstance);
  }

  // Closure Stacked Bar Chart
  destroyChart('studentSubjectClosureChart');
  const closureCanvas = document.getElementById("studentSubjectClosureChart");
  if (closureCanvas && typeof Chart !== 'undefined') {
    const ctx = closureCanvas.getContext("2d");

    const subjects = (weakAreas?.subjects || []).map(s => s.subjectName);
    const resolvedData = (weakAreas?.subjects || []).map(s => Math.max(0, s.errorCount - s.unresolvedCount));
    const unresolvedData = (weakAreas?.subjects || []).map(s => s.unresolvedCount);

    const chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: subjects.length ? subjects : ["Physics", "Mathematics", "Chemistry"],
        datasets: [
          {
            label: "Resolved",
            data: resolvedData.length ? resolvedData : [16, 9, 6],
            backgroundColor: "#10B981",
            borderRadius: { topLeft: 4, bottomLeft: 4 }
          },
          {
            label: "Unresolved",
            data: unresolvedData.length ? unresolvedData : [6, 3, 2],
            backgroundColor: "#EF4444",
            borderRadius: { topRight: 4, bottomRight: 4 }
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10 } }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 10 } },
            grid: { color: "#F1F5F9" }
          },
          y: {
            stacked: true,
            ticks: { font: { size: 11, weight: '600' } },
            grid: { display: false }
          }
        }
      }
    });
    registerChart('studentSubjectClosureChart', chartInstance);
  }
}

export function renderStudentWeakAreas(weakAreas) {
  const container = document.getElementById("student-weak-areas-list");
  if (!container) return;

  const subjects = weakAreas?.subjects || [];
  const metaEl = document.getElementById("weak-areas-meta");
  if (metaEl) {
    metaEl.textContent = `${weakAreas?.totalErrors || 42} total errors · ${weakAreas?.totalUnresolved || 11} unresolved`;
  }

  container.innerHTML = subjects.map(s => {
    const maxTopicErrors = Math.max(...s.topics.map(t => t.errorCount), 1);
    return `
      <div class="space-y-2.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-semibold text-gray-900">${s.subjectName}</span>
          <span class="font-mono text-xs text-muted">${s.errorCount} errors · ${s.unresolvedCount} unresolved</span>
        </div>
        <div class="space-y-2">
          ${s.topics.map(t => {
            const pct = Math.max(8, Math.round((t.errorCount / maxTopicErrors) * 100));
            return `
              <div class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <p class="truncate text-xs text-muted">${t.topicName}</p>
                  <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-danger/80" style="width: ${pct}%"></div>
                  </div>
                </div>
                <span class="w-16 text-right font-mono text-xs text-danger font-semibold">${t.errorCount} errors</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

export function renderStudentRwl(rwl) {
  const container = document.getElementById("student-rwl-list");
  if (!container) return;

  const metaEl = document.getElementById("rwl-meta");
  if (metaEl) metaEl.textContent = `${rwl?.total || 3} questions`;

  const questions = rwl?.questions || [];
  container.innerHTML = questions.map((q, idx) => {
    const isMastered = q.masteryStatus === "mastered";
    const isInRevision = q.masteryStatus === "in_revision";
    const toneBg = isMastered ? "bg-emerald-50/60 border-emerald-200" : isInRevision ? "bg-amber-50/60 border-amber-200" : "bg-rose-50/60 border-rose-200";

    return `
      <div class="flex items-start gap-3.5 rounded-xl border px-3.5 py-3 ${toneBg}">
        <div class="flex flex-col items-center min-w-[42px]">
          <span class="font-mono text-base font-bold text-danger">×${q.repeatCount}</span>
          <span class="text-[9px] uppercase tracking-wider font-bold text-muted mt-0.5">${(q.masteryStatus || '').replace('_', ' ')}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-gray-900 leading-snug">${q.questionTextMd}</p>
          <p class="mt-1.5 truncate text-[11px] text-muted">
            <span class="font-medium text-gray-700">${q.subjectName}</span>
            ${q.topicName ? ' · ' + q.topicName : ''}
            ${q.difficulty ? ' · Difficulty: ' + q.difficulty : ''}
            ${q.errorType ? ' · Error: ' + q.errorType.replace(/_/g, ' ') : ''}
          </p>
        </div>
      </div>
    `;
  }).join("");
}
