/**
 * core/modals.js
 * Centralized controller for all dialog modals:
 * 1. Student Dossier Modal
 * 2. Batch Hub Modal
 * 3. Exam Hub Modal
 * 4. Ask Analytics AI Modal (Preserves Developer Directive)
 * 5. Overview DatePicker Modal (Preserves Developer Directive)
 * 6. Assignment Developer Modal (Preserves Developer Directive)
 * 7. Question Palette Detail Modal
 */
import { store } from './state.js';
import { switchView } from './router.js';

// ── 1. Student Dossier Modal ────────────────────────────────────────────────
export function toggleStudentView1() {
  const content = document.getElementById('student-view1-content');
  const caret = document.getElementById('stu-view1-caret');
  const pill = document.getElementById('stu-view1-status-pill');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Expanded';
      pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md';
    }
  } else {
    content.classList.add('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Collapsed';
      pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
    }
  }
}

export function toggleStudentView2() {
  const content = document.getElementById('student-view2-content');
  const caret = document.getElementById('stu-view2-caret');
  const pill = document.getElementById('stu-view2-status-pill');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Expanded';
      pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md';
    }
  } else {
    content.classList.add('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Collapsed';
      pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
    }
  }
}

export function openStudentModal(studentId) {
  if (studentId) {
    store.set('currentActiveStudentId', studentId);
  }
  const modal = document.getElementById("student-modal");
  if (!modal) return;

  const currentActiveStudentId = store.get('currentActiveStudentId') || 's-101';
  let name = "Bhagam Khyathi";
  let rollNo = "225144";
  let batch = "SR MPC";
  let branch = "Madhapur";
  let section = "Section A";
  let pct = 98.4;
  let rank = 1;
  let avgScore = 262;
  let attendance = 96.5;

  const found = (store.students || []).find(s => s.studentId === currentActiveStudentId);
  if (found) {
    name = found.name;
    rollNo = found.rollNo || "225144";
    batch = found.batch || "SR MPC";
    branch = found.branch || "Madhapur";
    section = found.section || "Section A";
    pct = found.percentile || 98.4;
    rank = found.rank || 1;
    avgScore = found.avgScore || 262;
    attendance = found.attendance || 96.5;
  } else if (store.studentDossier) {
    name = store.studentDossier.name;
    rollNo = store.studentDossier.rollNo;
    batch = store.studentDossier.batch;
    branch = store.studentDossier.branch;
  }

  // Update modal avatar initials
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById("modal-student-avatar");
  if (avatarEl) avatarEl.textContent = initials;

  const nameEl = document.getElementById("modal-student-name");
  if (nameEl) nameEl.textContent = name;
  const tagEl = document.getElementById("modal-student-batch-tag");
  if (tagEl) tagEl.textContent = `${batch} · ${section}`;
  const metaEl = document.getElementById("modal-student-meta");
  if (metaEl) metaEl.textContent = `Roll: ${rollNo} · ${batch} (${section}) · ${branch} Campus`;
  const pctEl = document.getElementById("dos-pct");
  if (pctEl) pctEl.textContent = `${pct}%ile`;
  const rankEl = document.getElementById("dos-rank");
  if (rankEl) rankEl.textContent = `#${rank} / 271`;
  const scoreEl = document.getElementById("dos-score");
  if (scoreEl) scoreEl.textContent = `${avgScore} / 300`;
  const streakEl = document.getElementById("dos-streak");
  if (streakEl) streakEl.textContent = `19 Days`;
  const attEl = document.getElementById("dos-attendance");
  if (attEl) attEl.textContent = `${attendance}%`;

  const isBiPC = (batch || "").includes("BIPC");

  // Subject proficiency breakdown
  const subjectsContainer = document.getElementById("dos-subjects");
  if (subjectsContainer) {
    const subjectsList = isBiPC ? [
      { subject: "Physics", score: Math.round(avgScore * 0.28), total: 180, pct: 74, status: "Needs Practice Drill", color: "bg-amber-100 text-amber-800", barColor: "bg-amber-500" },
      { subject: "Chemistry", score: Math.round(avgScore * 0.32), total: 180, pct: 84, status: "Strong Scoring", color: "bg-emerald-100 text-emerald-800", barColor: "bg-emerald-500" },
      { subject: "Biology", score: Math.round(avgScore * 0.40), total: 360, pct: 92, status: "Mastery Zone", color: "bg-emerald-100 text-emerald-800", barColor: "bg-emerald-500" }
    ] : [
      { subject: "Physics", score: Math.round(avgScore * 0.31), total: 100, pct: 78, status: "Focus on Mechanics", color: "bg-blue-100 text-blue-800", barColor: "bg-blue-500" },
      { subject: "Chemistry", score: Math.round(avgScore * 0.36), total: 100, pct: 92, status: "Strong Scoring", color: "bg-emerald-100 text-emerald-800", barColor: "bg-emerald-500" },
      { subject: "Mathematics", score: Math.round(avgScore * 0.33), total: 100, pct: 82, status: "Moderate / Speed Drill", color: "bg-blue-100 text-blue-800", barColor: "bg-blue-500" }
    ];

    subjectsContainer.innerHTML = subjectsList.map(s => `
      <div class="p-2.5 rounded-xl bg-slate-50/70 border border-border">
        <div class="flex items-center justify-between mb-1.5 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${s.subject}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.color}">${s.status}</span>
          </div>
          <span class="font-mono font-bold text-slate-800">${s.score}/${s.total} (${s.pct}%)</span>
        </div>
        <div class="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div class="${s.barColor} h-full rounded-full" style="width: ${s.pct}%"></div>
        </div>
      </div>
    `).join("");
  }

  // Marks Leaks & Topic Hotspots
  const leaksContainer = document.getElementById("dos-leaks");
  if (leaksContainer) {
    const leakItems = isBiPC ? [
      { chapter: "Physics", topic: "Optics & Ray Diagram Questions", marksLost: 12, hint: "3 negative marks incurred from sign convention error" },
      { chapter: "Chemistry", topic: "Ionic Equilibrium & Salt Hydrolysis", marksLost: 8, hint: "Calculation mistake in pH buffer questions" }
    ] : [
      { chapter: "Physics", topic: "Rotational Dynamics & Rolling Motion", marksLost: 12, hint: "Lost 8 marks in unattempted integer questions + 4 negative marks" },
      { chapter: "Mathematics", topic: "Definite Integrals & Area Under Curves", marksLost: 8, hint: "Lost time on 2 multi-concept questions, revise shortcut methods" }
    ];

    leaksContainer.innerHTML = leakItems.map(w => `
      <div class="p-2.5 rounded-xl border border-red-200 bg-rose-50/40 text-xs flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-red-900">${w.chapter}:</span>
            <span class="font-medium text-slate-800">${w.topic}</span>
          </div>
          <p class="text-[10px] text-rose-700 mt-0.5">${w.hint}</p>
        </div>
        <span class="shrink-0 font-mono text-danger font-bold text-xs bg-white px-2 py-1 rounded-md border border-rose-200">
          -${w.marksLost} marks
        </span>
      </div>
    `).join("");
  }

  // View 2 Profile & Benchmark metrics
  const targetExamEl = document.getElementById("stu-target-exam");
  if (targetExamEl) targetExamEl.textContent = isBiPC ? "NEET (UG) 2026" : "JEE Mains 2026";
  const airEl = document.getElementById("stu-projected-air");
  if (airEl) airEl.textContent = pct > 95 ? "Top 1,200 – 1,800 AIR" : pct > 85 ? "Top 5,000 – 10,000 AIR" : "Top 25,000 – 35,000 AIR";
  const probEl = document.getElementById("stu-cutoff-prob");
  if (probEl) probEl.textContent = pct > 85 ? "99.2% (Confirmed Safe Zone)" : pct > 70 ? "84.5% (Probable)" : "62.0% (Borderline)";

  const benchStudentEl = document.getElementById("stu-bench-student");
  if (benchStudentEl) benchStudentEl.textContent = `${avgScore} / 300`;
  const benchBatchEl = document.getElementById("stu-bench-batch");
  if (benchBatchEl) benchBatchEl.textContent = "168 / 300";
  const benchDiffEl = document.getElementById("stu-bench-diff");
  if (benchDiffEl) {
    const diff = avgScore - 168;
    benchDiffEl.textContent = `${diff >= 0 ? '+' : ''}${diff} marks ahead of median`;
  }

  // PTM Counseling notes
  const notesEl = document.getElementById("stu-counseling-notes");
  if (notesEl) {
    notesEl.innerHTML = `
      <li>Demonstrates outstanding consistency with a <strong>${pct}%ile</strong> average across mock tests.</li>
      <li>Daily practice (DPP) submission is exemplary at <strong>94% completion</strong>, driving strong exam recall.</li>
      <li><strong>Parent Action Item:</strong> Focus revision sessions on <em>${isBiPC ? 'Ray Optics' : 'Rotational Dynamics'}</em> to eliminate avoidable negative marks and comfortably target top ranks.</li>
    `;
  }

  // Role-based view expansion
  const userRole = store.get('currentUserRole') || 'super_admin';
  const v1Content = document.getElementById('student-view1-content');
  const v2Content = document.getElementById('student-view2-content');
  const v1Caret = document.getElementById('stu-view1-caret');
  const v2Caret = document.getElementById('stu-view2-caret');
  const v1Pill = document.getElementById('stu-view1-status-pill');
  const v2Pill = document.getElementById('stu-view2-status-pill');

  if (userRole === 'faculty') {
    v1Content?.classList.remove('hidden');
    if (v1Caret) v1Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (v1Pill) { v1Pill.textContent = 'Expanded'; v1Pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'; }

    v2Content?.classList.add('hidden');
    if (v2Caret) v2Caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (v2Pill) { v2Pill.textContent = 'Collapsed'; v2Pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md'; }
  } else if (userRole === 'principal') {
    v1Content?.classList.add('hidden');
    if (v1Caret) v1Caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (v1Pill) { v1Pill.textContent = 'Collapsed'; v1Pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md'; }

    v2Content?.classList.remove('hidden');
    if (v2Caret) v2Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (v2Pill) { v2Pill.textContent = 'Expanded'; v2Pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md'; }
  } else {
    // Super Admin: expand both
    v1Content?.classList.remove('hidden');
    if (v1Caret) v1Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (v1Pill) { v1Pill.textContent = 'Expanded'; v1Pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'; }

    v2Content?.classList.remove('hidden');
    if (v2Caret) v2Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (v2Pill) { v2Pill.textContent = 'Expanded'; v2Pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md'; }
  }

  modal.classList.remove("hidden");
}

export function closeStudentModal() {
  document.getElementById('student-modal')?.classList.add('hidden');
}

export function openStudentFullDossier() {
  closeStudentModal();
  switchView(`student/${store.get('currentActiveStudentId')}`);
}

export function openFullStudentAnalytics(studentId) {
  if (studentId) {
    store.set('currentActiveStudentId', studentId);
  }
  closeStudentModal();
  switchView('student-detail');
}

// ── 2. Batch Hub Modal ──────────────────────────────────────────────────────
export function toggleBatchView1() {
  const content = document.getElementById('batch-view1-content');
  const caret = document.getElementById('view1-caret');
  const pill = document.getElementById('view1-status-pill');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Expanded';
      pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md';
    }
  } else {
    content.classList.add('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Collapsed';
      pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
    }
  }
}

export function toggleBatchView2() {
  const content = document.getElementById('batch-view2-content');
  const caret = document.getElementById('view2-caret');
  const pill = document.getElementById('view2-status-pill');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Expanded';
      pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md';
    }
    // Resize chart when revealed
    if (store.charts.bellCurveChart && typeof store.charts.bellCurveChart.resize === 'function') {
      setTimeout(() => store.charts.bellCurveChart?.resize(), 60);
    }
  } else {
    content.classList.add('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
    if (pill) {
      pill.textContent = 'Collapsed';
      pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
    }
  }
}

export function openBatchModal(batchId) {
  try {
    const modal = document.getElementById("batch-modal");
    if (!modal) return;
    
    if (batchId) {
      store.set('currentActiveBatchId', batchId);
    }
    const currentActiveBatchId = store.get('currentActiveBatchId') || 'b-srmpc-madhapur';
    
    modal.classList.remove("hidden");

    const b = store.batchAnalytics || {};
    const allBatches = store.batches || [];
    const found = allBatches.find(x => x.id === currentActiveBatchId);
    const titleName = found ? `${found.name} (${found.branchName})` : (b.batchName || "SR MPC (Madhapur)");
    const targetExam = found ? found.targetExam : (b.targetExam || "JEE Mains");
    const studentCount = found ? (found.studentCount || 64) : (b.studentCount || 64);

    const titleEl = document.getElementById("modal-batch-title");
    if (titleEl) titleEl.textContent = `Batch Hub — ${titleName}`;
    const metaEl = document.getElementById("modal-batch-meta");
    if (metaEl) metaEl.textContent = `${studentCount} Students · Target: ${targetExam} 2026 · Branch: ${found?.branchName || "Madhapur"}`;

    // ── View 1: KPIs ──
    const avgScore = Math.round(b.averageScore ? b.averageScore * 2.5 : 168);
    const avgPct = b.summary?.latestAvgPct || b.averageScore || 84.2;
    const qualCount = Math.round(studentCount * 0.75);

    const kpiAvg = document.getElementById("batch-kpi-avg");
    if (kpiAvg) kpiAvg.textContent = avgScore;
    const kpiPct = document.getElementById("batch-kpi-pct");
    if (kpiPct) kpiPct.textContent = `${avgPct}% avg`;
    const kpiTotal = document.getElementById("batch-kpi-total");
    if (kpiTotal) kpiTotal.textContent = studentCount;
    const kpiQualCount = document.getElementById("batch-kpi-qual-count");
    if (kpiQualCount) kpiQualCount.textContent = qualCount;
    const kpiQualRate = document.getElementById("batch-kpi-qual-rate");
    if (kpiQualRate) kpiQualRate.textContent = "75%";
    const kpiAtt = document.getElementById("batch-kpi-att");
    if (kpiAtt) kpiAtt.textContent = "92.4%";
    const kpiDpp = document.getElementById("batch-kpi-dpp");
    if (kpiDpp) kpiDpp.textContent = "81.6%";

    // ── View 1: Subject Health Cards ──
    const boxplotContainer = document.getElementById("batch-boxplot");
    if (boxplotContainer) {
      const subjectDiagnoses = [
        {
          name: "Physics",
          avgMarks: 48,
          maxMarks: 100,
          accuracy: 64,
          status: "Needs Problem Practice",
          color: "bg-amber-100 text-amber-800 border-amber-200",
          barColor: "bg-amber-500",
          diagnostic: "Focus on Rotational Motion & Electrodynamics"
        },
        {
          name: "Chemistry",
          avgMarks: 64,
          maxMarks: 100,
          accuracy: 74,
          status: "Strong Scoring Zone",
          color: "bg-emerald-100 text-emerald-800 border-emerald-200",
          barColor: "bg-emerald-500",
          diagnostic: "Consistent in Physical & Organic Chemistry"
        },
        {
          name: "Mathematics",
          avgMarks: 56,
          maxMarks: 100,
          accuracy: 68,
          status: "Moderate / Speed Focused",
          color: "bg-blue-100 text-blue-800 border-blue-200",
          barColor: "bg-blue-500",
          diagnostic: "Calculus accuracy good, needs speed in Vectors"
        }
      ];

      boxplotContainer.innerHTML = subjectDiagnoses.map(sub => `
        <div class="p-3 bg-white border border-border rounded-xl shadow-2xs">
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-bold text-slate-900 text-xs">${sub.name}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${sub.color}">${sub.status}</span>
          </div>
          <div class="flex items-baseline justify-between mb-2">
            <div>
              <span class="font-mono text-base font-bold text-slate-900">${sub.avgMarks}</span>
              <span class="text-[10px] text-muted">/${sub.maxMarks} marks</span>
            </div>
            <span class="text-[11px] font-mono font-semibold text-slate-600">${sub.accuracy}% accuracy</span>
          </div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div class="${sub.barColor} h-full rounded-full" style="width: ${sub.accuracy}%"></div>
          </div>
          <p class="text-[10px] text-muted truncate" title="${sub.diagnostic}">${sub.diagnostic}</p>
        </div>
      `).join("");
    }

    // ── View 1: At-Risk Students ──
    const atRiskContainer = document.getElementById("batch-atrisk-list");
    const atRiskList = Array.isArray(b.atRiskStudents) && b.atRiskStudents.length > 0 
      ? b.atRiskStudents 
      : [
          { studentId: "s-107", name: "Ananya Sharma", rollNo: "225172", currentPercentile: 58.4, reason: "Low DPP completion & Physics score drop" },
          { studentId: "s-108", name: "Rohan Varma", rollNo: "225173", currentPercentile: 61.2, reason: "Attendance < 78% in last 3 weeks" },
          { studentId: "s-109", name: "Deepak Choudhary", rollNo: "225174", currentPercentile: 63.8, reason: "Calculus backlog in weekend tests" }
        ];

    if (atRiskContainer) {
      atRiskContainer.innerHTML = atRiskList.slice(0, 3).map(s => `
        <div class="p-2.5 bg-white border border-rose-200/80 rounded-lg text-xs flex items-center justify-between cursor-pointer hover:border-danger hover:shadow-xs transition-all" onclick="closeBatchModal(); openStudentModal('${s.studentId}')">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-rose-900">${s.name}</span>
              <span class="text-[10px] font-mono text-muted">(${s.rollNo})</span>
            </div>
            <p class="text-[10px] text-rose-700 mt-0.5">${s.reason || "Score drop in recent exams"}</p>
          </div>
          <div class="text-right shrink-0">
            <span class="font-mono text-danger font-bold text-xs">${s.currentPercentile || s.percentile}%ile</span>
            <p class="text-[9px] text-muted flex items-center gap-0.5 justify-end mt-0.5">Dossier &rarr;</p>
          </div>
        </div>
      `).join("");
    }

    // ── View 1: Top Rankers ──
    const topRankersContainer = document.getElementById("batch-top-rankers-list");
    if (topRankersContainer) {
      const topRankers = [
        { studentId: "s-101", name: "Bhagam Khyathi", rollNo: "225166", score: "262/300", pct: "98.4%ile", rank: 1 },
        { studentId: "s-102", name: "Jay Raj Vaishnav", rollNo: "225167", score: "248/300", pct: "96.2%ile", rank: 2 },
        { studentId: "s-104", name: "Gowtham Reddy", rollNo: "225008", score: "235/300", pct: "93.8%ile", rank: 3 }
      ];

      topRankersContainer.innerHTML = topRankers.map(r => `
        <div class="p-2.5 bg-white border border-border rounded-lg text-xs flex items-center justify-between cursor-pointer hover:border-primary hover:shadow-xs transition-all" onclick="closeBatchModal(); openStudentModal('${r.studentId}')">
          <div class="flex items-center gap-2.5">
            <span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${r.rank === 1 ? 'bg-amber-100 text-amber-800' : r.rank === 2 ? 'bg-slate-200 text-slate-800' : 'bg-orange-100 text-orange-800'}">
              ${r.rank}
            </span>
            <div>
              <span class="font-bold text-slate-900">${r.name}</span>
              <span class="text-[10px] font-mono text-muted ml-1">(${r.rollNo})</span>
            </div>
          </div>
          <div class="text-right">
            <span class="font-mono text-xs font-bold text-success">${r.score}</span>
            <p class="text-[10px] text-muted">${r.pct}</p>
          </div>
        </div>
      `).join("");
    }

    // ── View 2: Marks Bracket Distribution Bar Chart ──
    const canvas = document.getElementById("bellCurveChart");
    if (canvas && typeof Chart !== 'undefined') {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (store.charts.bellCurveChart && typeof store.charts.bellCurveChart.destroy === 'function') {
          store.charts.bellCurveChart.destroy();
        }
        
        const brackets = [
          { label: "<100 (Remedial)", count: 5, color: "#EF4444" },
          { label: "100-140 (Borderline)", count: 11, color: "#F59E0B" },
          { label: "140-170 (Safe Zone)", count: 24, color: "#3B82F6" },
          { label: "170-200 (High Scorers)", count: 16, color: "#6366F1" },
          { label: ">200 (Rankers Tier)", count: 8, color: "#10B981" }
        ];

        store.charts.bellCurveChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: brackets.map(b => b.label),
            datasets: [{
              label: 'Students in Bracket',
              data: brackets.map(b => b.count),
              backgroundColor: brackets.map(b => b.color),
              borderRadius: 6,
              maxBarThickness: 44
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.parsed.y} students in this marks bracket`
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 5 }
              },
              x: {
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // ── View 2: Inter-Section Benchmark Matrix ──
    const sectionTbody = document.getElementById("batch-section-matrix-tbody");
    if (sectionTbody) {
      const matrix = [
        { sec: "Section A (Current)", enrolled: 64, avg: 168, phy: 48, chem: 64, math: 56, qual: "75%", dpp: "82%", isCurrent: true },
        { sec: "Section B", enrolled: 62, avg: 154, phy: 44, chem: 60, math: 50, qual: "68%", dpp: "76%", isCurrent: false },
        { sec: "Section C", enrolled: 58, avg: 142, phy: 38, chem: 56, math: 48, qual: "59%", dpp: "71%", isCurrent: false }
      ];

      sectionTbody.innerHTML = matrix.map(m => `
        <tr class="hover:bg-slate-50/70 transition-colors ${m.isCurrent ? 'bg-primary/5 font-semibold' : ''}">
          <td class="py-2.5 px-3">
            <span class="${m.isCurrent ? 'text-primary font-bold' : 'text-slate-900'}">${m.sec}</span>
          </td>
          <td class="py-2.5 px-3 font-mono text-muted">${m.enrolled}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-900">${m.avg}</td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${m.phy}</td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${m.chem}</td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${m.math}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-emerald-600">${m.qual}</td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${m.dpp}</td>
        </tr>
      `).join("");
    }

    // Role-based view expansion
    const userRole = store.get('currentUserRole') || 'super_admin';
    const v1Content = document.getElementById('batch-view1-content');
    const v2Content = document.getElementById('batch-view2-content');
    const v1Caret = document.getElementById('view1-caret');
    const v2Caret = document.getElementById('view2-caret');
    const v1Pill = document.getElementById('view1-status-pill');
    const v2Pill = document.getElementById('view2-status-pill');

    if (userRole === 'faculty') {
      v1Content?.classList.remove('hidden');
      if (v1Caret) v1Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
      if (v1Pill) { v1Pill.textContent = 'Expanded'; v1Pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'; }

      v2Content?.classList.add('hidden');
      if (v2Caret) v2Caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
      if (v2Pill) { v2Pill.textContent = 'Collapsed'; v2Pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md'; }
    } else if (userRole === 'principal') {
      v1Content?.classList.add('hidden');
      if (v1Caret) v1Caret.className = 'ph-bold ph-caret-down text-xs text-muted transition-transform';
      if (v1Pill) { v1Pill.textContent = 'Collapsed'; v1Pill.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md'; }

      v2Content?.classList.remove('hidden');
      if (v2Caret) v2Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
      if (v2Pill) { v2Pill.textContent = 'Expanded'; v2Pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md'; }
      if (store.charts.bellCurveChart && typeof store.charts.bellCurveChart.resize === 'function') {
        setTimeout(() => store.charts.bellCurveChart?.resize(), 60);
      }
    } else {
      // Super Admin: expand both
      v1Content?.classList.remove('hidden');
      if (v1Caret) v1Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
      if (v1Pill) { v1Pill.textContent = 'Expanded'; v1Pill.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'; }

      v2Content?.classList.remove('hidden');
      if (v2Caret) v2Caret.className = 'ph-bold ph-caret-up text-xs text-muted transition-transform';
      if (v2Pill) { v2Pill.textContent = 'Expanded'; v2Pill.className = 'text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md'; }
      if (store.charts.bellCurveChart && typeof store.charts.bellCurveChart.resize === 'function') {
        setTimeout(() => store.charts.bellCurveChart?.resize(), 60);
      }
    }
  } catch (err) {
    console.error("Error in openBatchModal:", err);
  }
}

export function closeBatchModal() {
  document.getElementById('batch-modal')?.classList.add('hidden');
}

export function openFullBatchAnalytics(batchId) {
  if (batchId) {
    store.set('currentActiveBatchId', batchId);
  }
  closeBatchModal();
  switchView('batch-detail');
}

// ── 3. Exam Hub Modal ───────────────────────────────────────────────────────
export function openExamModal(examId) {
  try {
    const modal = document.getElementById("exam-modal");
    if (!modal) return;

    if (examId) {
      store.set('currentActiveExamId', examId);
    }
    const currentActiveExamId = store.get('currentActiveExamId') || 'ex-301';

    modal.classList.remove("hidden");

    let data = store.data.examAnalytics && store.data.examAnalytics[currentActiveExamId];
    if (!data) {
      const ex = (store.exams || []).find(e => e.id === currentActiveExamId);
      const title = ex ? ex.name : "JEE Advanced Full Mock 04";
      const totalAssigned = ex ? ex.totalAssigned : 1420;
      const totalSubmissions = ex ? ex.totalSubmissions : 1380;
      const avgScore = ex ? ex.averageScore : 68.4;
      const passRate = ex ? ex.passRate : 74.2;
      data = {
        examId: currentActiveExamId,
        title,
        examType: ex?.purpose || "JEE Advanced",
        totalAssigned,
        totalSubmissions,
        averageScore: avgScore,
        highestScore: 98.5,
        passRate,
        scoreDistribution: [
          { range: "<40%", count: 85 },
          { range: "40-60%", count: 320 },
          { range: "60-75%", count: 540 },
          { range: "75-90%", count: 310 },
          { range: ">90%", count: 125 }
        ],
        topScorers: [
          { rank: 1, name: "Bhagam Khyathi", rollNo: "225144", batch: "SR MPC", branch: "Madhapur", score: 292, pct: 97.3 },
          { rank: 2, name: "Aditya Verma", rollNo: "EX-2026-001", batch: "SR MPC", branch: "Madhapur", score: 288, pct: 96.0 },
          { rank: 3, name: "Sneha Reddy", rollNo: "EX-2026-003", batch: "JR MPC", branch: "Shamirpet", score: 284, pct: 94.7 }
        ]
      };
    }

    const titleEl = document.getElementById("modal-exam-title");
    if (titleEl) titleEl.textContent = `Exam Hub — ${data.title}`;
    const metaEl = document.getElementById("modal-exam-meta");
    if (metaEl) metaEl.textContent = `${data.totalSubmissions} Submissions · Purpose: ${(data.examType || 'JEE Mains').toUpperCase()} · Pass Rate: ${data.passRate}%`;

    const appEl = document.getElementById("modal-exam-appeared");
    if (appEl) appEl.textContent = `${data.totalSubmissions} / ${data.totalAssigned}`;
    const avgEl = document.getElementById("modal-exam-avg-score");
    if (avgEl) avgEl.textContent = data.averageScore;
    const topEl = document.getElementById("modal-exam-top-score");
    if (topEl) topEl.textContent = data.highestScore;
    const passEl = document.getElementById("modal-exam-pass-rate");
    if (passEl) passEl.textContent = `${data.passRate}%`;

    // Mini score distribution chart
    const canvas = document.getElementById("modalExamDistChart");
    if (canvas && typeof Chart !== 'undefined') {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (store.charts.modalExamDistChart && typeof store.charts.modalExamDistChart.destroy === 'function') {
          store.charts.modalExamDistChart.destroy();
        }

        const dist = data.scoreDistribution || [];
        store.charts.modalExamDistChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dist.map(d => d.range),
            datasets: [{
              label: "Students",
              data: dist.map(d => d.count),
              backgroundColor: "#7C3AED",
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: "#F1F5F9" } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }

    // Top 3 Scorers preview
    const scorersEl = document.getElementById("modal-exam-top-scorers");
    if (scorersEl) {
      scorersEl.innerHTML = (data.topScorers || []).slice(0, 3).map((s, idx) => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-border text-xs">
          <div class="flex items-center gap-2.5">
            <span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-800' : 'bg-orange-100 text-orange-800'}">
              ${idx + 1}
            </span>
            <div>
              <p class="font-semibold text-slate-900">${s.name}</p>
              <p class="text-[10px] text-muted">${s.batch} · ${s.branch}</p>
            </div>
          </div>
          <span class="font-mono font-bold text-purple-700">${s.score} (${s.pct}%)</span>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error in openExamModal:", err);
  }
}

export function closeExamModal() {
  document.getElementById('exam-modal')?.classList.add('hidden');
}

export function openFullExamAnalytics(examId) {
  if (examId) {
    store.set('currentActiveExamId', examId);
  }
  closeExamModal();
  switchView('exam-detail');
}

// ── 4. Ask Analytics AI Modal ───────────────────────────────────────────────
export function openAskAnalyticsModal() {
  document.getElementById('ask-modal')?.classList.remove('hidden');
  initAskPresets();
}

export function closeAskAnalyticsModal() {
  document.getElementById('ask-modal')?.classList.add('hidden');
}

export function initAskPresets() {
  const container = document.getElementById('ask-presets');
  if (!container) return;
  const presets = (store.data.askDemo && store.data.askDemo.presets) || [
    {
      query: "Why did SR MPC average drop in Grand Mock 1?",
      answer: "SR MPC saw a 4.2% dip primarily due to Physics Section B (Rotational Motion) where 64% of students negative-marked numericals."
    },
    {
      query: "Which branch leads in overall JEE Mains performance?",
      answer: "Madhapur branch leads in average percentile (59.3rd) followed by Shamirpet (58.4th)."
    },
    {
      query: "How many students are currently in the critical risk bracket?",
      answer: "There are currently 14 students flagged across institutions (3 critical, 11 warning)."
    }
  ];

  container.innerHTML = presets.map((p, idx) => `
    <button type="button" onclick="selectAskPreset(${idx})" class="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
      ${p.query}
    </button>
  `).join('');
}

export function selectAskPreset(idx) {
  const presets = (store.data.askDemo && store.data.askDemo.presets) || [];
  const p = presets[idx];
  if (!p) return;
  const input = document.getElementById('ask-input');
  if (input) input.value = p.query;
  const ansCont = document.getElementById('ask-answer-container');
  const ansText = document.getElementById('ask-answer-text');
  if (ansCont && ansText) {
    ansCont.classList.remove('hidden');
    ansText.textContent = p.answer;
  }
}

export function submitAskQuery() {
  const input = document.getElementById('ask-input');
  const q = (input ? input.value : '').trim().toLowerCase();
  const presets = (store.data.askDemo && store.data.askDemo.presets) || [];
  const matched = presets.find(p => p.query.toLowerCase().includes(q) || q.includes(p.query.toLowerCase())) || presets[0];
  const ansCont = document.getElementById('ask-answer-container');
  const ansText = document.getElementById('ask-answer-text');
  if (ansCont && ansText) {
    ansCont.classList.remove('hidden');
    ansText.textContent = matched ? matched.answer : "According to the institutional model, the selected metric aligns with historical benchmarks within a ±3.2% deviation window.";
  }
}

// ── 5. Overview DateRange Modal ─────────────────────────────────────────────
export function openOverviewDateRangeModal() {
  document.getElementById('overview-datepicker-modal')?.classList.remove('hidden');
}

export function closeOverviewDateRangeModal() {
  document.getElementById('overview-datepicker-modal')?.classList.add('hidden');
}

export function setOverviewDateRange(label) {
  const badge = document.getElementById("overview-range-badge");
  if (badge) badge.textContent = label;
  
  document.querySelectorAll(".overview-date-preset-btn").forEach(btn => {
    if (btn.textContent.trim().startsWith(label)) {
      btn.className = "overview-date-preset-btn text-left px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white border border-primary transition-colors";
    } else {
      btn.className = "overview-date-preset-btn text-left px-3 py-2 rounded-xl text-xs font-medium border border-border hover:border-primary hover:bg-primary/5 transition-colors";
    }
  });

  closeOverviewDateRangeModal();
}

// ── 6. Student Assignment Developer Modal ───────────────────────────────────
export function openAssignmentDeveloperModal(title, subtitle, status, score, completedAt) {
  const modal = document.getElementById('assignment-developer-modal');
  if (!modal) return;
  const titleEl = document.getElementById('assignment-modal-title');
  if (titleEl) titleEl.textContent = title || 'Assignment Details';
  const subEl = document.getElementById('assignment-modal-subtitle');
  if (subEl) subEl.textContent = `${subtitle || 'Assignment'} · ${completedAt || 'Recent Activity'}`;
  const metaTitle = document.getElementById('assignment-modal-meta-title');
  if (metaTitle) metaTitle.textContent = title || '—';
  const metaType = document.getElementById('assignment-modal-meta-type');
  if (metaType) metaType.textContent = subtitle || 'Assignment';
  const metaStatus = document.getElementById('assignment-modal-meta-status');
  if (metaStatus) metaStatus.textContent = status || 'Done';
  const metaScore = document.getElementById('assignment-modal-meta-score');
  const scoreRow = document.getElementById('assignment-modal-meta-score-row');
  if (score) {
    if (metaScore) metaScore.textContent = `${score}%`;
    if (scoreRow) scoreRow.classList.remove('hidden');
  } else {
    if (scoreRow) scoreRow.classList.add('hidden');
  }
  modal.classList.remove('hidden');
}

export function closeAssignmentDeveloperModal() {
  document.getElementById('assignment-developer-modal')?.classList.add('hidden');
}

// ── 7. Faculty Impact Modal ─────────────────────────────────────────────────
export function openFacultyImpactModal() {
  alert("Faculty Effectiveness:\n• Physics syllabus completion: 86.4%\n• Mathematics syllabus completion: 82.1%\n• Chemistry syllabus completion: 88.5%\n• Teacher-student interaction rating: 9.4/10");
}
