const fs = require('fs');
const path = require('path');

const DEMO_DIR = 'C:\\work\\analytics\\admin demo';
const DATA_DIR = path.join(DEMO_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. Institution Overview Data
const institutionData = {
  institutionName: "Excellencia",
  totalStudents: 4765,
  totalExams: 36920,
  avgPercentile: 54.2,
  activeBatches: 76,
  feeCollectionRate: 96.4,
  studentRetention: 98.2,
  activeDailyUsers: 88.5,
  atRiskStudents: [
    { studentId: "s-risk-1", name: "Kiran Varma", rollNo: "225188", batch: "SR MPC", branch: "Madhapur", percentile: 24.5, scores: [82, 76, 84], daysSinceLogin: 4, severity: "critical" },
    { studentId: "s-risk-2", name: "Siddharth Rao", rollNo: "225192", batch: "SR MPC", branch: "Madhapur", percentile: 34.2, scores: [102, 98, 105], daysSinceLogin: 2, severity: "warning" },
    { studentId: "s-risk-3", name: "Meera Nair", rollNo: "225195", batch: "SR MPC", branch: "Madhapur", percentile: 38.0, scores: [115, 110, 118], daysSinceLogin: 1, severity: "warning" },
    { studentId: "s-risk-4", name: "NAYANI MANO VAISITA", rollNo: "126173", batch: "JR MPC", branch: "Shamirpet", percentile: 26.8, scores: [74, 80, 78], daysSinceLogin: 5, severity: "critical" },
    { studentId: "s-risk-5", name: "POOSKURU SRIHAAN RAO", rollNo: "126335", batch: "JR MPC", branch: "Shamirpet", percentile: 32.4, scores: [95, 90, 92], daysSinceLogin: 3, severity: "warning" },
    { studentId: "s-risk-6", name: "H SRINIKA", rollNo: "626038", batch: "JR MPC", branch: "LB Nagar", percentile: 28.5, scores: [80, 85, 82], daysSinceLogin: 4, severity: "warning" },
    { studentId: "s-risk-7", name: "PERI SHANMUKI", rollNo: "325067", batch: "SR MPC", branch: "Suchitra", percentile: 31.0, scores: [90, 88, 94], daysSinceLogin: 2, severity: "warning" },
    { studentId: "s-risk-8", name: "DESU VEDA HASINI", rollNo: "106097", batch: "JR MPC", branch: "Bachupally", percentile: 35.6, scores: [104, 98, 102], daysSinceLogin: 1, severity: "warning" },
    { studentId: "s-risk-9", name: "KASIPAKA RACHEAL PRINCY", rollNo: "926114", batch: "JR BIPC", branch: "West Marredpally", percentile: 29.8, scores: [320, 310, 335], daysSinceLogin: 3, severity: "warning" },
    { studentId: "s-risk-10", name: "SAHASRA ANNAMANENI", rollNo: "126636", batch: "JR MEC CBSE", branch: "Shamirpet", percentile: 22.0, scores: [65, 70, 68], daysSinceLogin: 6, severity: "critical" },
    { studentId: "s-risk-11", name: "CHINTHAKINDI SUHARSH PATEL", rollNo: "125126", batch: "SR MPC", branch: "Shamirpet", percentile: 33.2, scores: [98, 92, 96], daysSinceLogin: 2, severity: "warning" },
    { studentId: "s-risk-12", name: "NAGANULU SRILAXMI", rollNo: "825178", batch: "SR MPC", branch: "Arithri Girls Campus", percentile: 36.4, scores: [108, 102, 110], daysSinceLogin: 1, severity: "warning" },
    { studentId: "s-risk-13", name: "SATVIK REDDY CHINTHALA", rollNo: "125717", batch: "SR MPC CBSE", branch: "Shamirpet", percentile: 27.5, scores: [85, 80, 84], daysSinceLogin: 4, severity: "warning" },
    { studentId: "s-risk-14", name: "KODAKANDLA SATHWIK REDDY", rollNo: "125359", batch: "SR MPC", branch: "Shamirpet", percentile: 37.0, scores: [112, 108, 114], daysSinceLogin: 2, severity: "warning" }
  ],
  branches: [
    { branchId: "b-shamirpet", name: "Shamirpet", percentile: 58.4, students: 1176, exams: 28, code: "SHAMIRPET-HYD" },
    { branchId: "b-suchitra", name: "Suchitra", percentile: 55.2, students: 598, exams: 24, code: "SUCHITRA-HYD" },
    { branchId: "b-kokapet", name: "Kokapet", percentile: 56.8, students: 579, exams: 25, code: "KOKAPET-HYD" },
    { branchId: "b-miyapur", name: "Miyapur", percentile: 53.9, students: 506, exams: 22, code: "MIYAPUR-HYD" },
    { branchId: "b-arithri", name: "Arithri Girls Campus", percentile: 57.1, students: 424, exams: 23, code: "ARITHRI-GC-HYD" },
    { branchId: "b-ecil", name: "ECIL", percentile: 52.6, students: 334, exams: 20, code: "ECIL-HYD" },
    { branchId: "b-wmp", name: "West Marredpally", percentile: 54.5, students: 328, exams: 21, code: "WMP-HYD" },
    { branchId: "b-madhapur", name: "Madhapur", percentile: 59.3, students: 271, exams: 26, code: "MADHAPUR-HYD" },
    { branchId: "b-lbnagar", name: "LB Nagar", percentile: 51.7, students: 262, exams: 19, code: "LBNAGAR-HYD" },
    { branchId: "b-bachupally", name: "Bachupally", percentile: 53.1, students: 242, exams: 20, code: "BACHUPALLY-HYD" }
  ],
  topBatches: [
    { rank: 1, batchId: "b-srmpc-madhapur", name: "SR MPC", branch: "Madhapur", avgPercentile: 68.4, students: 78, targetExam: "JEE Mains" },
    { rank: 2, batchId: "b-srmpc-shamirpet", name: "SR MPC", branch: "Shamirpet", avgPercentile: 64.2, students: 408, targetExam: "JEE Mains" },
    { rank: 3, batchId: "b-srbipc-madhapur", name: "SR BIPC", branch: "Madhapur", avgPercentile: 62.8, students: 64, targetExam: "NEET" },
    { rank: 4, batchId: "b-jrmpc-shamirpet", name: "JR MPC", branch: "Shamirpet", avgPercentile: 59.5, students: 365, targetExam: "JEE Mains" },
    { rank: 5, batchId: "b-srmpc-suchitra", name: "SR MPC", branch: "Suchitra", avgPercentile: 57.1, students: 222, targetExam: "JEE Mains" },
    { rank: 6, batchId: "b-jrbipc-kokapet", name: "JR BIPC", branch: "Kokapet", avgPercentile: 55.4, students: 140, targetExam: "NEET" }
  ],
  topPerformers: [
    { rank: 1, studentId: "s-101", name: "Bhagam Khyathi", rollNo: "225144", batch: "SR MPC", branch: "Madhapur", avgPercentile: 98.4, avgScore: 262, targetExam: "JEE Mains" },
    { rank: 2, studentId: "s-102", name: "JAY RAJ VAISHNAV", rollNo: "225167", batch: "SR MPC", branch: "Madhapur", avgPercentile: 96.2, avgScore: 248, targetExam: "JEE Mains" },
    { rank: 3, studentId: "s-103", name: "VISHWANATH AKSHAY KUMAR", rollNo: "125029", batch: "SR MPC", branch: "Shamirpet", avgPercentile: 95.1, avgScore: 242, targetExam: "JEE Mains" },
    { rank: 4, studentId: "s-104", name: "Gowtham Reddy", rollNo: "225008", batch: "SR MPC", branch: "Madhapur", avgPercentile: 93.8, avgScore: 235, targetExam: "JEE Mains" },
    { rank: 5, studentId: "s-105", name: "R PRANAV", rollNo: "425117", batch: "SR MPC", branch: "ECIL", avgPercentile: 92.5, avgScore: 229, targetExam: "JEE Mains" },
    { rank: 6, studentId: "s-106", name: "INDUR SAANVI", rollNo: "825323", batch: "SR MPC CBSE", branch: "Arithri Girls Campus", avgPercentile: 91.0, avgScore: 221, targetExam: "JEE Mains" },
    { rank: 7, studentId: "s-107", name: "Anwita Salike", rollNo: "225005", batch: "SR BIPC", branch: "Madhapur", avgPercentile: 94.7, avgScore: 658, targetExam: "NEET" },
    { rank: 8, studentId: "s-108", name: "BALATRIVIKRAM DHANUSH", rollNo: "225121", batch: "SR BIPC", branch: "Madhapur", avgPercentile: 92.3, avgScore: 641, targetExam: "NEET" }
  ],
  attendanceSummary: {
    overallRate: 88.5,
    present: 4217,
    absent: 381,
    late: 167,
    totalStudents: 4765,
    byBranch: [
      { branch: "Madhapur", rate: 91.4 },
      { branch: "Arithri Girls Campus", rate: 89.8 },
      { branch: "Shamirpet", rate: 89.2 },
      { branch: "Kokapet", rate: 88.6 },
      { branch: "ECIL", rate: 88.0 },
      { branch: "Suchitra", rate: 87.8 },
      { branch: "West Marredpally", rate: 87.5 },
      { branch: "LB Nagar", rate: 87.1 },
      { branch: "Miyapur", rate: 86.9 },
      { branch: "Bachupally", rate: 86.2 }
    ]
  }
};

// 2. Institution Trends (12 Months)
const institutionTrends = {
  trends: [
    { month: "Apr 2025", avgScore: 48.5, avgPercentile: 49.0, examsCount: 4, attendanceRate: 92.0 },
    { month: "May 2025", avgScore: 49.2, avgPercentile: 50.1, examsCount: 4, attendanceRate: 91.5 },
    { month: "Jun 2025", avgScore: 50.4, avgPercentile: 51.0, examsCount: 5, attendanceRate: 90.2 },
    { month: "Jul 2025", avgScore: 51.1, avgPercentile: 51.8, examsCount: 6, attendanceRate: 89.4 },
    { month: "Aug 2025", avgScore: 52.0, avgPercentile: 52.5, examsCount: 6, attendanceRate: 88.9 },
    { month: "Sep 2025", avgScore: 52.8, avgPercentile: 53.2, examsCount: 7, attendanceRate: 89.1 },
    { month: "Oct 2025", avgScore: 53.4, avgPercentile: 53.9, examsCount: 6, attendanceRate: 87.8 },
    { month: "Nov 2025", avgScore: 54.1, avgPercentile: 54.5, examsCount: 8, attendanceRate: 88.2 },
    { month: "Dec 2025", avgScore: 54.6, avgPercentile: 55.0, examsCount: 8, attendanceRate: 87.4 },
    { month: "Jan 2026", avgScore: 55.2, avgPercentile: 55.7, examsCount: 9, attendanceRate: 88.5 },
    { month: "Feb 2026", avgScore: 56.0, avgPercentile: 56.4, examsCount: 9, attendanceRate: 89.0 },
    { month: "Mar 2026", avgScore: 56.8, avgPercentile: 57.2, examsCount: 8, attendanceRate: 89.6 }
  ]
};

// 3. Branches
const branchesData = [
  {
    id: "b-shamirpet",
    name: "Shamirpet",
    code: "SHAMIRPET-HYD",
    location: "Shamirpet, Hyderabad",
    studentCount: 1176,
    facultyCount: 28,
    batchCount: 12,
    avgScore: 58.4,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC", "SR BIPC", "JR MEC CBSE"]
  },
  {
    id: "b-suchitra",
    name: "Suchitra",
    code: "SUCHITRA-HYD",
    location: "Suchitra Junction, Hyderabad",
    studentCount: 598,
    facultyCount: 18,
    batchCount: 7,
    avgScore: 55.2,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC", "SR BIPC"]
  },
  {
    id: "b-kokapet",
    name: "Kokapet",
    code: "KOKAPET-HYD",
    location: "Kokapet, Hyderabad",
    studentCount: 579,
    facultyCount: 16,
    batchCount: 9,
    avgScore: 56.8,
    status: "active",
    activeBatches: ["SR MPC", "JR BIPC", "JR ACE"]
  },
  {
    id: "b-miyapur",
    name: "Miyapur",
    code: "MIYAPUR-HYD",
    location: "Miyapur, Hyderabad",
    studentCount: 506,
    facultyCount: 15,
    batchCount: 7,
    avgScore: 53.9,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC", "JR CEC"]
  },
  {
    id: "b-arithri",
    name: "Arithri Girls Campus",
    code: "ARITHRI-GC-HYD",
    location: "Arithri, Hyderabad",
    studentCount: 424,
    facultyCount: 14,
    batchCount: 10,
    avgScore: 57.1,
    status: "active",
    activeBatches: ["SR MPC", "SR MPC CBSE", "JR MPC"]
  },
  {
    id: "b-ecil",
    name: "ECIL",
    code: "ECIL-HYD",
    location: "ECIL, Hyderabad",
    studentCount: 334,
    facultyCount: 12,
    batchCount: 7,
    avgScore: 52.6,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC"]
  },
  {
    id: "b-wmp",
    name: "West Marredpally",
    code: "WMP-HYD",
    location: "Secunderabad",
    studentCount: 328,
    facultyCount: 12,
    batchCount: 7,
    avgScore: 54.5,
    status: "active",
    activeBatches: ["SR MPC", "JR BIPC", "JR ACE"]
  },
  {
    id: "b-madhapur",
    name: "Madhapur",
    code: "MADHAPUR-HYD",
    location: "Hi-Tech City, Madhapur, Hyderabad",
    studentCount: 271,
    facultyCount: 11,
    batchCount: 4,
    avgScore: 59.3,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC", "SR BIPC", "JR BIPC"]
  },
  {
    id: "b-lbnagar",
    name: "LB Nagar",
    code: "LBNAGAR-HYD",
    location: "LB Nagar, Hyderabad",
    studentCount: 262,
    facultyCount: 10,
    batchCount: 3,
    avgScore: 51.7,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC", "JR BIPC"]
  },
  {
    id: "b-bachupally",
    name: "Bachupally",
    code: "BACHUPALLY-HYD",
    location: "Bachupally, Hyderabad",
    studentCount: 242,
    facultyCount: 10,
    batchCount: 4,
    avgScore: 53.1,
    status: "active",
    activeBatches: ["SR MPC", "JR MPC"]
  }
];

// 4. Batches
const batchesData = [
  {
    id: "b-srmpc-madhapur",
    name: "SR MPC",
    branchId: "b-madhapur",
    branchName: "Madhapur",
    targetExam: "JEE Mains",
    studentCount: 78,
    avgScore: 68.4,
    passRate: 94.5,
    topScore: 284,
    atRiskCount: 3,
    faculty: [
      { name: "Prof. Anand Kumar", subject: "Mathematics" },
      { name: "Dr. Srinivas Rao", subject: "Physics" },
      { name: "Dr. Venkat Reddy", subject: "Chemistry" }
    ]
  },
  {
    id: "b-srmpc-shamirpet",
    name: "SR MPC",
    branchId: "b-shamirpet",
    branchName: "Shamirpet",
    targetExam: "JEE Mains",
    studentCount: 408,
    avgScore: 64.2,
    passRate: 91.0,
    topScore: 278,
    atRiskCount: 8,
    faculty: [
      { name: "Dr. Srinivas Rao", subject: "Physics" },
      { name: "Dr. Venkat Reddy", subject: "Chemistry" },
      { name: "Prof. Anand Kumar", subject: "Mathematics" }
    ]
  },
  {
    id: "b-srbipc-madhapur",
    name: "SR BIPC",
    branchId: "b-madhapur",
    branchName: "Madhapur",
    targetExam: "NEET",
    studentCount: 64,
    avgScore: 62.8,
    passRate: 89.2,
    topScore: 672,
    atRiskCount: 2,
    faculty: [
      { name: "Dr. Padma Sundari", subject: "Biology" },
      { name: "Dr. Ramesh Babu", subject: "Botany" },
      { name: "Dr. Swathi Naidu", subject: "Zoology" }
    ]
  },
  {
    id: "b-jrmpc-shamirpet",
    name: "JR MPC",
    branchId: "b-shamirpet",
    branchName: "Shamirpet",
    targetExam: "JEE Mains",
    studentCount: 365,
    avgScore: 59.5,
    passRate: 86.4,
    topScore: 260,
    atRiskCount: 6,
    faculty: [
      { name: "Prof. Lakshmi Devi", subject: "Physics" },
      { name: "Dr. Venkat Reddy", subject: "Chemistry" }
    ]
  },
  {
    id: "b-srmpc-suchitra",
    name: "SR MPC",
    branchId: "b-suchitra",
    branchName: "Suchitra",
    targetExam: "JEE Mains",
    studentCount: 222,
    avgScore: 57.1,
    passRate: 85.0,
    topScore: 254,
    atRiskCount: 4,
    faculty: [
      { name: "Prof. Lakshmi Devi", subject: "Physics" },
      { name: "Prof. Anand Kumar", subject: "Mathematics" }
    ]
  },
  {
    id: "b-jrbipc-kokapet",
    name: "JR BIPC",
    branchId: "b-kokapet",
    branchName: "Kokapet",
    targetExam: "NEET",
    studentCount: 140,
    avgScore: 55.4,
    passRate: 83.2,
    topScore: 640,
    atRiskCount: 3,
    faculty: [
      { name: "Dr. Padma Sundari", subject: "Biology" },
      { name: "Dr. Swathi Naidu", subject: "Zoology" }
    ]
  }
];

// 5. Batch Analytics Detail
const batchAnalyticsData = {
  batchId: "b-srmpc-madhapur",
  batchName: "SR MPC (Madhapur)",
  bellCurve: {
    mean: 68.4,
    standardDeviation: 12.8,
    buckets: [
      { range: "0-20", count: 1, gaussian: 0.5 },
      { range: "21-40", count: 4, gaussian: 3.2 },
      { range: "41-60", count: 18, gaussian: 14.6 },
      { range: "61-80", count: 36, gaussian: 34.8 },
      { range: "81-100", count: 19, gaussian: 18.2 }
    ]
  },
  boxPlot: [
    { subject: "Physics", min: 28, q1: 52, median: 68, q3: 82, max: 96, avg: 67.4 },
    { subject: "Chemistry", min: 34, q1: 58, median: 74, q3: 88, max: 98, avg: 72.8 },
    { subject: "Mathematics", min: 22, q1: 48, median: 64, q3: 78, max: 94, avg: 63.2 }
  ],
  attendanceHistogram: {
    bucket_0_50: 2,
    bucket_50_70: 3,
    bucket_70_80: 8,
    bucket_80_90: 28,
    bucket_90_100: 37,
    totalTracked: 78
  },
  syllabusFlow: {
    weeks: ["W1", "W3", "W5", "W7", "W9", "W11", "W13", "W15", "W17", "W19"],
    plannedCumulative: [5, 12, 22, 34, 48, 60, 72, 84, 94, 100],
    actualCumulative: [5, 11, 20, 32, 45, 58, 69, 82, 91, 98]
  },
  atRiskStudents: [
    {
      studentId: "s-risk-1",
      name: "Kiran Varma",
      rollNo: "225188",
      riskLevel: "critical",
      percentile: 24.5,
      avgScore: 84,
      attendance: 68.0,
      daysSinceLogin: 4,
      primaryLeak: "Physics Time Traps (avg 3.8 min/Q)",
      recentScores: [92, 88, 76, 84]
    },
    {
      studentId: "s-risk-2",
      name: "Siddharth Rao",
      rollNo: "225192",
      riskLevel: "warning",
      percentile: 34.2,
      avgScore: 110,
      attendance: 74.5,
      daysSinceLogin: 2,
      primaryLeak: "Negative marking in Organic Chemistry (-16 marks)",
      recentScores: [120, 115, 102, 110]
    },
    {
      studentId: "s-risk-3",
      name: "Meera Nair",
      rollNo: "225195",
      riskLevel: "warning",
      percentile: 38.0,
      avgScore: 118,
      attendance: 78.0,
      daysSinceLogin: 1,
      primaryLeak: "Mathematics calculus unforced algebraic errors",
      recentScores: [110, 125, 114, 118]
    }
  ]
};

// 6. Students Roster
const studentsRoster = [
  { studentId: "s-101", name: "Bhagam Khyathi", rollNo: "225144", batch: "SR MPC", branch: "Madhapur", rank: 1, percentile: 98.4, avgScore: 262, attendance: 98.0, examCount: 26, trend: "improving", risk: "healthy" },
  { studentId: "s-102", name: "JAY RAJ VAISHNAV", rollNo: "225167", batch: "SR MPC", branch: "Madhapur", rank: 2, percentile: 96.2, avgScore: 248, attendance: 96.5, examCount: 26, trend: "improving", risk: "healthy" },
  { studentId: "s-103", name: "VISHWANATH AKSHAY KUMAR", rollNo: "125029", batch: "SR MPC", branch: "Shamirpet", rank: 3, percentile: 95.1, avgScore: 242, attendance: 95.0, examCount: 25, trend: "improving", risk: "healthy" },
  { studentId: "s-104", name: "Gowtham Reddy", rollNo: "225008", batch: "SR MPC", branch: "Madhapur", rank: 4, percentile: 93.8, avgScore: 235, attendance: 94.5, examCount: 24, trend: "improving", risk: "healthy" },
  { studentId: "s-105", name: "R PRANAV", rollNo: "425117", batch: "SR MPC", branch: "ECIL", rank: 5, percentile: 92.5, avgScore: 229, attendance: 93.0, examCount: 24, trend: "improving", risk: "healthy" },
  { studentId: "s-106", name: "INDUR SAANVI", rollNo: "825323", batch: "SR MPC CBSE", branch: "Arithri Girls Campus", rank: 6, percentile: 91.0, avgScore: 221, attendance: 92.5, examCount: 23, trend: "plateau", risk: "healthy" },
  { studentId: "s-107", name: "Anwita Salike", rollNo: "225005", batch: "SR BIPC", branch: "Madhapur", rank: 7, percentile: 94.7, avgScore: 658, attendance: 96.0, examCount: 22, trend: "improving", risk: "healthy" },
  { studentId: "s-108", name: "BALATRIVIKRAM DHANUSH", rollNo: "225121", batch: "SR BIPC", branch: "Madhapur", rank: 8, percentile: 92.3, avgScore: 641, attendance: 94.0, examCount: 22, trend: "improving", risk: "healthy" },
  { studentId: "s-109", name: "SINGIREDDY JAIDEEP REDDY", rollNo: "125210", batch: "SR MPC", branch: "Shamirpet", rank: 9, percentile: 88.5, avgScore: 212, attendance: 91.5, examCount: 23, trend: "plateau", risk: "healthy" },
  { studentId: "s-110", name: "Avyajasri Pulluru", rollNo: "925005", batch: "SR MPC", branch: "West Marredpally", rank: 10, percentile: 86.4, avgScore: 206, attendance: 90.0, examCount: 21, trend: "improving", risk: "healthy" },
  { studentId: "s-111", name: "P KARTHIK", rollNo: "126404", batch: "JR MPC", branch: "Shamirpet", rank: 11, percentile: 84.2, avgScore: 198, attendance: 89.5, examCount: 20, trend: "improving", risk: "developing" },
  { studentId: "s-112", name: "AREEBA TANEEM", rollNo: "626016", batch: "JR MPC", branch: "LB Nagar", rank: 12, percentile: 81.0, avgScore: 188, attendance: 88.0, examCount: 19, trend: "plateau", risk: "developing" },
  { studentId: "s-risk-3", name: "Meera Nair", rollNo: "225195", batch: "SR MPC", branch: "Madhapur", rank: 72, percentile: 38.0, avgScore: 118, attendance: 78.0, examCount: 18, trend: "declining", risk: "warning" },
  { studentId: "s-risk-2", name: "Siddharth Rao", rollNo: "225192", batch: "SR MPC", branch: "Madhapur", rank: 75, percentile: 34.2, avgScore: 110, attendance: 74.5, examCount: 17, trend: "declining", risk: "warning" },
  { studentId: "s-risk-1", name: "Kiran Varma", rollNo: "225188", batch: "SR MPC", branch: "Madhapur", rank: 78, percentile: 24.5, avgScore: 84, attendance: 68.0, examCount: 16, trend: "declining", risk: "critical" }
];

// 7. Student Dossier Detail (for Bhagam Khyathi)
const studentDossierData = {
  studentId: "s-101",
  name: "Bhagam Khyathi",
  rollNo: "225144",
  batch: "SR MPC",
  branch: "Madhapur",
  targetExam: "JEE Mains",
  avatarUrl: null,
  kpis: {
    rankInBatch: 1,
    batchSize: 78,
    rankInCampus: 1,
    campusSize: 271,
    currentPercentile: 98.4,
    percentileDelta: "+1.6",
    avgScore: 262,
    totalPossible: 300,
    attendancePct: 98.0,
    dppStreak: 19,
    dppCompletionRate: 96.5
  },
  scoreHistory: [
    { exam: "Mock 1", score: 232, percentile: 94.2, date: "2025-11-10" },
    { exam: "Mock 2", score: 240, percentile: 95.8, date: "2025-11-24" },
    { exam: "Unit Test 4", score: 248, percentile: 96.5, date: "2025-12-08" },
    { exam: "Mock 3", score: 254, percentile: 97.4, date: "2025-12-22" },
    { exam: "Revision Test", score: 258, percentile: 97.9, date: "2026-01-12" },
    { exam: "Grand Mock 1", score: 265, percentile: 98.6, date: "2026-02-02" },
    { exam: "Grand Mock 2", score: 262, percentile: 98.4, date: "2026-02-23" }
  ],
  subjectBreakdown: [
    { subject: "Mathematics", score: 92, total: 100, pct: 92.0, stateAvg: 58.4, status: "Mastered" },
    { subject: "Physics", score: 86, total: 100, pct: 86.0, stateAvg: 54.2, status: "Proficient" },
    { subject: "Chemistry", score: 84, total: 100, pct: 84.0, stateAvg: 56.1, status: "Proficient" }
  ],
  bloomsTaxonomy: [
    { level: "Remembering", masteryPct: 96, stateAvgPct: 78 },
    { level: "Understanding", masteryPct: 92, stateAvgPct: 69 },
    { level: "Applying", masteryPct: 88, stateAvgPct: 54 },
    { level: "Analyzing", masteryPct: 82, stateAvgPct: 46 },
    { level: "Evaluating", masteryPct: 79, stateAvgPct: 38 }
  ],
  weakTopics: [
    { chapter: "Physics", topic: "Rotational Dynamics — Rolling on Inclined Plane", errorRate: 38, marksLost: 8 },
    { chapter: "Chemistry", topic: "Ionic Equilibrium — Buffer Capacity", errorRate: 32, marksLost: 6 }
  ],
  strengths: [
    "Differential Calculus & Integral Applications (100% accuracy in last 3 mocks)",
    "Modern Physics & Photoelectric Effect (zero errors across 18 questions)",
    "Chemical Thermodynamics & Energetics (95% accuracy)"
  ],
  behavioralAlerts: [
    { type: "positive", message: "Practicing 45 mins daily on DPP. 19-day streak unbroken." },
    { type: "tip", message: "Time spent on Physics numericals is 2.4 min/Q vs target 1.8 min/Q. Recommend speed drills." }
  ]
};

// 8. Exams List
const examsData = [
  {
    id: "ex-301",
    title: "Mock Test — Jee Mains",
    scheduledStart: "2026-03-12T09:00:00.000Z",
    purpose: "jee_mains",
    status: "results_released",
    assignedBatches: [{ id: "b-srmpc-madhapur", name: "SR MPC (Madhapur)" }, { id: "b-srmpc-shamirpet", name: "SR MPC (Shamirpet)" }, { id: "b-srmpc-suchitra", name: "SR MPC (Suchitra)" }],
    totalAssigned: 708,
    totalSubmissions: 672,
    appearanceRate: 94.9,
    averageScore: 164.2,
    passRate: 88.5,
    omrEnabled: true,
    omrProcessed: true
  },
  {
    id: "ex-302",
    title: "Mock Test — Neet",
    scheduledStart: "2026-03-08T10:00:00.000Z",
    purpose: "neet",
    status: "results_released",
    assignedBatches: [{ id: "b-srbipc-madhapur", name: "SR BIPC (Madhapur)" }, { id: "b-jrbipc-kokapet", name: "JR BIPC (Kokapet)" }],
    totalAssigned: 204,
    totalSubmissions: 195,
    appearanceRate: 95.6,
    averageScore: 492.0,
    passRate: 91.2,
    omrEnabled: true,
    omrProcessed: true
  },
  {
    id: "ex-303",
    title: "Physics Unit Test — Electrostatics",
    scheduledStart: "2026-03-01T14:00:00.000Z",
    purpose: "unit_test",
    status: "results_released",
    assignedBatches: [{ id: "b-srmpc-madhapur", name: "SR MPC (Madhapur)" }, { id: "b-jrmpc-shamirpet", name: "JR MPC (Shamirpet)" }],
    totalAssigned: 443,
    totalSubmissions: 418,
    appearanceRate: 94.4,
    averageScore: 58.4,
    passRate: 82.0,
    omrEnabled: false,
    omrProcessed: false
  },
  {
    id: "ex-304",
    title: "Mathematics Chapter Test — Calculus",
    scheduledStart: "2026-02-22T10:00:00.000Z",
    purpose: "chapter_test",
    status: "results_released",
    assignedBatches: [{ id: "b-srmpc-madhapur", name: "SR MPC (Madhapur)" }],
    totalAssigned: 78,
    totalSubmissions: 76,
    appearanceRate: 97.4,
    averageScore: 68.2,
    passRate: 89.5,
    omrEnabled: false,
    omrProcessed: false
  },
  {
    id: "ex-305",
    title: "Mock Test — Custom",
    scheduledStart: "2026-02-15T09:00:00.000Z",
    purpose: "mock_test",
    status: "completed",
    assignedBatches: [{ id: "b-srmpc-shamirpet", name: "SR MPC (Shamirpet)" }],
    totalAssigned: 408,
    totalSubmissions: 384,
    appearanceRate: 94.1,
    averageScore: 158.0,
    passRate: 84.2,
    omrEnabled: true,
    omrProcessed: true
  }
];

// 9. DPP (Daily Practice Adherence)
const dppData = {
  overallAdherenceRate: 74.2,
  activeDailyPractitioners: 3240,
  averageStreakDays: 5.4,
  atRiskHabitCount: 182,
  batchRollup: [
    {
      batchId: "b-srmpc-madhapur",
      batchName: "SR MPC",
      branch: "Madhapur",
      studentsCount: 78,
      adherenceRate: 88.4,
      avgStreak: 9.2,
      assignedDpps: 45,
      completedDpps: 40,
      status: "Exceptional"
    },
    {
      batchId: "b-srbipc-madhapur",
      batchName: "SR BIPC",
      branch: "Madhapur",
      studentsCount: 64,
      adherenceRate: 84.1,
      avgStreak: 8.0,
      assignedDpps: 45,
      completedDpps: 38,
      status: "Good"
    },
    {
      batchId: "b-srmpc-shamirpet",
      batchName: "SR MPC",
      branch: "Shamirpet",
      studentsCount: 408,
      adherenceRate: 76.5,
      avgStreak: 5.8,
      assignedDpps: 45,
      completedDpps: 34,
      status: "Healthy"
    },
    {
      batchId: "b-jrmpc-shamirpet",
      batchName: "JR MPC",
      branch: "Shamirpet",
      studentsCount: 365,
      adherenceRate: 71.0,
      avgStreak: 4.6,
      assignedDpps: 45,
      completedDpps: 32,
      status: "Moderate"
    },
    {
      batchId: "b-srmpc-suchitra",
      batchName: "SR MPC",
      branch: "Suchitra",
      studentsCount: 222,
      adherenceRate: 68.2,
      avgStreak: 4.1,
      assignedDpps: 45,
      completedDpps: 31,
      status: "Attention"
    },
    {
      batchId: "b-jrbipc-kokapet",
      batchName: "JR BIPC",
      branch: "Kokapet",
      studentsCount: 140,
      adherenceRate: 62.4,
      avgStreak: 3.4,
      assignedDpps: 45,
      completedDpps: 28,
      status: "At Risk"
    }
  ],
  studentAdherence: [
    { studentId: "s-101", name: "Bhagam Khyathi", rollNo: "225144", batch: "SR MPC", branch: "Madhapur", completionPct: 98, streak: 19, status: "Elite" },
    { studentId: "s-102", name: "JAY RAJ VAISHNAV", rollNo: "225167", batch: "SR MPC", branch: "Madhapur", completionPct: 94, streak: 14, status: "Active" },
    { studentId: "s-103", name: "VISHWANATH AKSHAY KUMAR", rollNo: "125029", batch: "SR MPC", branch: "Shamirpet", completionPct: 92, streak: 12, status: "Active" },
    { studentId: "s-104", name: "Gowtham Reddy", rollNo: "225008", batch: "SR MPC", branch: "Madhapur", completionPct: 90, streak: 10, status: "Active" },
    { studentId: "s-105", name: "R PRANAV", rollNo: "425117", batch: "SR MPC", branch: "ECIL", completionPct: 88, streak: 9, status: "Active" },
    { studentId: "s-107", name: "Anwita Salike", rollNo: "225005", batch: "SR BIPC", branch: "Madhapur", completionPct: 95, streak: 16, status: "Elite" },
    { studentId: "s-risk-1", name: "Kiran Varma", rollNo: "225188", batch: "SR MPC", branch: "Madhapur", completionPct: 32, streak: 0, status: "Fallen Off" },
    { studentId: "s-risk-2", name: "Siddharth Rao", rollNo: "225192", batch: "SR MPC", branch: "Madhapur", completionPct: 44, streak: 1, status: "At Risk" }
  ]
};

// 10. Cohort Snapshots (Year-over-Year comparison)
const cohortsData = {
  milestones: ["Month 1", "Month 3", "Month 6", "Month 9", "Month 12", "Final Mock"],
  cohorts: [
    {
      cohortId: "c-jee-2026",
      name: "JEE 2026 Cohort",
      academicYear: "2025-26",
      targetExam: "JEE Mains",
      studentCount: 1420,
      scores: [54.2, 58.6, 62.4, 66.8, 71.2, 74.5],
      mastery: [46, 52, 60, 68, 74, 78],
      attendance: [92, 90, 88, 87, 86, 88]
    },
    {
      cohortId: "c-jee-2027",
      name: "JEE 2027 Cohort",
      academicYear: "2026-27",
      targetExam: "JEE Mains",
      studentCount: 1580,
      scores: [51.8, 55.4, 59.8, 63.5, 67.8, 70.9],
      mastery: [42, 48, 55, 63, 69, 73],
      attendance: [94, 91, 89, 87, 85, 87]
    },
    {
      cohortId: "c-neet-2026",
      name: "NEET 2026 Cohort",
      academicYear: "2025-26",
      targetExam: "NEET",
      studentCount: 980,
      scores: [58.0, 61.5, 65.2, 69.8, 73.4, 77.0],
      mastery: [50, 56, 64, 71, 77, 82],
      attendance: [93, 91, 89, 88, 88, 90]
    }
  ]
};

// 11. Home V2 Data
const homeV2Data = {
  scope: "institution",
  headline: "Academic Operations & Performance Pulse",
  subHeadline: "Excellencia Academic Platform • Real-time Overview",
  generatedAt: new Date().toISOString(),
  pulse: {
    activeStudents: 4120,
    avgScore7d: 58.4,
    avgScoreDelta: 2.1,
    attendance7d: 89.2,
    attendanceDelta: 1.4,
    atRiskCount: 14,
    testsThisWeek: 18,
    submissions24h: 342
  },
  trend30d: [
    { day: "Day 1", avgPct: 54.2, n: 18 },
    { day: "Day 5", avgPct: 55.0, n: 24 },
    { day: "Day 10", avgPct: 56.4, n: 32 },
    { day: "Day 15", avgPct: 55.8, n: 28 },
    { day: "Day 20", avgPct: 57.2, n: 44 },
    { day: "Day 25", avgPct: 58.0, n: 38 },
    { day: "Day 30", avgPct: 58.4, n: 52 }
  ],
  risers: [
    { studentId: "s-101", name: "Bhagam Khyathi", batchName: "SR MPC", recent: 98.4, prior: 96.8, delta: 1.6 },
    { studentId: "s-102", name: "JAY RAJ VAISHNAV", batchName: "SR MPC", recent: 96.2, prior: 93.5, delta: 2.7 },
    { studentId: "s-103", name: "VISHWANATH AKSHAY KUMAR", batchName: "SR MPC", recent: 95.1, prior: 91.8, delta: 3.3 },
    { studentId: "s-107", name: "Anwita Salike", batchName: "SR BIPC", recent: 94.7, prior: 92.1, delta: 2.6 }
  ],
  fallers: [
    { studentId: "s-risk-1", name: "Kiran Varma", batchName: "SR MPC", recent: 24.5, prior: 32.0, delta: -7.5 },
    { studentId: "s-risk-2", name: "Siddharth Rao", batchName: "SR MPC", recent: 34.2, prior: 39.8, delta: -5.6 },
    { studentId: "s-risk-3", name: "Meera Nair", batchName: "SR MPC", recent: 38.0, prior: 42.4, delta: -4.4 },
    { studentId: "s-risk-4", name: "NAYANI MANO VAISITA", batchName: "JR MPC", recent: 26.8, prior: 31.2, delta: -4.4 }
  ],
  insights: [
    {
      id: "ins-1",
      severity: "warning",
      title: "Rotational Dynamics Marks Bleed in SR MPC",
      body: "Students lose 8.4 marks on average on Rolling Motion questions. Recommend a 40-minute concept drill.",
      recommendedActions: [{ label: "Deploy Concept Drill" }, { label: "Notify Faculty" }]
    },
    {
      id: "ins-2",
      severity: "celebrate",
      title: "Strong Velocity in Mathematics Across Madhapur",
      body: "Average calculus score is up 4.8% over the past 3 weeks with high consistency.",
      recommendedActions: [{ label: "View Batch Trajectory" }]
    },
    {
      id: "ins-3",
      severity: "suggestion",
      title: "14 Students Require Intervention",
      body: "Declining scores detected across 3 consecutive assessments with attendance drop below 80%.",
      recommendedActions: [{ label: "Generate Intervention Plan" }]
    }
  ],
  countdowns: [
    { targetExam: "JEE Mains Session 2", scheduledStart: "2026-04-04", daysAway: 18 },
    { targetExam: "NEET UG 2026", scheduledStart: "2026-05-03", daysAway: 47 },
    { targetExam: "EAPCET 2026", scheduledStart: "2026-05-18", daysAway: 62 }
  ]
};

// 12. Compare Score Matrix
const compareMatrixData = {
  grain: "students",
  examColumns: [
    { id: "e1", code: "Mock 1", maxMarks: 300, date: "Nov 10" },
    { id: "e2", code: "Mock 2", maxMarks: 300, date: "Nov 24" },
    { id: "e3", code: "Unit 4", maxMarks: 100, date: "Dec 08" },
    { id: "e4", code: "Mock 3", maxMarks: 300, date: "Dec 22" },
    { id: "e5", code: "Rev Test", maxMarks: 300, date: "Jan 12" },
    { id: "e6", code: "GM 1", maxMarks: 300, date: "Feb 02" },
    { id: "e7", code: "GM 2", maxMarks: 300, date: "Feb 23" }
  ],
  rows: [
    { rank: 1, name: "Bhagam Khyathi", rollNo: "225144", batch: "SR MPC", branch: "Madhapur", scores: [232, 240, 84, 254, 258, 265, 262], avgPct: 87.2, fluctuation: 3.1, trend: "improving" },
    { rank: 2, name: "JAY RAJ VAISHNAV", rollNo: "225167", batch: "SR MPC", branch: "Madhapur", scores: [218, 226, 80, 238, 242, 250, 248], avgPct: 83.1, fluctuation: 3.8, trend: "improving" },
    { rank: 3, name: "VISHWANATH AKSHAY KUMAR", rollNo: "125029", batch: "SR MPC", branch: "Shamirpet", scores: [210, 220, 78, 232, 236, 244, 242], avgPct: 81.0, fluctuation: 4.2, trend: "improving" },
    { rank: 4, name: "Gowtham Reddy", rollNo: "225008", batch: "SR MPC", branch: "Madhapur", scores: [205, 214, 76, 225, 230, 238, 235], avgPct: 78.9, fluctuation: 3.9, trend: "improving" },
    { rank: 5, name: "R PRANAV", rollNo: "425117", batch: "SR MPC", branch: "ECIL", scores: [198, 208, 74, 218, 224, 232, 229], avgPct: 76.8, fluctuation: 4.1, trend: "improving" },
    { rank: 6, name: "INDUR SAANVI", rollNo: "825323", batch: "SR MPC CBSE", branch: "Arithri Girls Campus", scores: [192, 201, 72, 212, 216, 224, 221], avgPct: 74.4, fluctuation: 3.8, trend: "plateau" },
    { rank: 7, name: "SINGIREDDY JAIDEEP REDDY", rollNo: "125210", batch: "SR MPC", branch: "Shamirpet", scores: [184, 192, 68, 204, 208, 215, 212], avgPct: 71.6, fluctuation: 4.3, trend: "plateau" },
    { rank: 8, name: "Avyajasri Pulluru", rollNo: "925005", batch: "SR MPC", branch: "West Marredpally", scores: [178, 186, 66, 196, 202, 209, 206], avgPct: 69.3, fluctuation: 4.0, trend: "improving" },
    { rank: 9, name: "P KARTHIK", rollNo: "126404", batch: "JR MPC", branch: "Shamirpet", scores: [170, 178, 64, 188, 194, 202, 198], avgPct: 66.8, fluctuation: 4.4, trend: "improving" },
    { rank: 10, name: "AREEBA TANEEM", rollNo: "626016", batch: "JR MPC", branch: "LB Nagar", scores: [162, 170, 60, 180, 184, 192, 188], avgPct: 63.9, fluctuation: 4.2, trend: "plateau" }
  ]
};

// 13. Ask Analytics Answers
const askAnalyticsData = {
  presets: [
    {
      query: "Why did SR MPC average drop in Grand Mock 1?",
      answer: "SR MPC saw a 4.2% dip primarily due to Physics Section B (Rotational Motion and Wave Optics) where 64% of students negative-marked numericals. Mathematics and Chemistry remained steady above the 72nd percentile."
    },
    {
      query: "Which branch leads in overall JEE Mains performance?",
      answer: "Madhapur branch leads in average percentile (59.3rd) followed by Shamirpet (58.4th) and Kokapet (56.8th)."
    },
    {
      query: "How many students are currently in the critical risk bracket?",
      answer: "There are currently 14 students flagged at risk institution-wide (3 critical, 11 warning). Critical students have logged zero platform activity in 4+ days with recent scores falling below the 30th percentile."
    }
  ]
};

// Save individual JSON files
fs.writeFileSync(path.join(DATA_DIR, 'institution.json'), JSON.stringify(institutionData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'institution_trends.json'), JSON.stringify(institutionTrends, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'branches.json'), JSON.stringify(branchesData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'batches.json'), JSON.stringify(batchesData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'batch_analytics.json'), JSON.stringify(batchAnalyticsData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'students.json'), JSON.stringify(studentsRoster, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'student_dossier.json'), JSON.stringify(studentDossierData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'exams.json'), JSON.stringify(examsData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'dpp.json'), JSON.stringify(dppData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'cohorts.json'), JSON.stringify(cohortsData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'home_v2.json'), JSON.stringify(homeV2Data, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'compare_matrix.json'), JSON.stringify(compareMatrixData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'ask_demo.json'), JSON.stringify(askAnalyticsData, null, 2));

// Save combined JS bundle
const jsBundle = `// Pre-bundled static dataset for Admin Demo Console (Zero external dependencies)
window.__DEMO_DATA__ = {
  institution: ${JSON.stringify(institutionData, null, 2)},
  trends: ${JSON.stringify(institutionTrends, null, 2)},
  branches: ${JSON.stringify(branchesData, null, 2)},
  batches: ${JSON.stringify(batchesData, null, 2)},
  batchAnalytics: ${JSON.stringify(batchAnalyticsData, null, 2)},
  students: ${JSON.stringify(studentsRoster, null, 2)},
  studentDossier: ${JSON.stringify(studentDossierData, null, 2)},
  exams: ${JSON.stringify(examsData, null, 2)},
  dpp: ${JSON.stringify(dppData, null, 2)},
  cohorts: ${JSON.stringify(cohortsData, null, 2)},
  homeV2: ${JSON.stringify(homeV2Data, null, 2)},
  compareMatrix: ${JSON.stringify(compareMatrixData, null, 2)},
  askDemo: ${JSON.stringify(askAnalyticsData, null, 2)}
};
`;

fs.writeFileSync(path.join(DATA_DIR, 'all_data.js'), jsBundle);

// Also copy this file content to admin demo/generate-mock-data.js
const selfContent = fs.readFileSync(__filename, 'utf8');
fs.writeFileSync(path.join(DEMO_DIR, 'generate-mock-data.js'), selfContent);

console.log('✅ All canonical demo datasets successfully generated in admin demo/data/ and admin demo/generate-mock-data.js');
