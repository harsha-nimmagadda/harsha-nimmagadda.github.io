/**
 * modules/batches/batch-detail.js
 * Batch Hub Analytics, Roster Leaderboard, Bloom Matrix, and Diagnostic Distributions.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart } from '../../core/chart-utils.js';
import { openStudentModal, closeBatchModal } from '../../core/modals.js';

let currentBatchActiveTab = 'overview';
let batchSortField = 'rank';
let batchSortDir = 'asc';
let currentBloomsSubjectFilter = 'all';
let selectedLookupStudentId = 's-101';

export function openFullBatchAnalytics(batchId) {
  closeBatchModal();
  const targetId = batchId || store.get('currentActiveBatchId') || 'b-srmpc-madhapur';
  store.set('currentActiveBatchId', targetId);
  router.navigate(`batch/${targetId}`);
}

export function switchBatchTab(tabName) {
  currentBatchActiveTab = tabName;
  document.querySelectorAll('.batch-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.className = 'batch-tab-btn rounded-lg px-4 py-2 text-sm font-semibold transition-all bg-primary/10 text-primary shadow-xs';
    } else {
      btn.className = 'batch-tab-btn rounded-lg px-4 py-2 text-sm font-medium transition-all text-muted hover:text-gray-900';
    }
  });

  document.querySelectorAll('.batch-tab-view').forEach(view => {
    view.classList.add('hidden');
  });
  const targetView = document.getElementById(`batch-tab-${tabName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  setTimeout(() => {
    if (tabName === 'bell-curve') renderTabBellCurve();
    if (tabName === 'box-plot') renderTabBoxPlot();
    if (tabName === 'attendance') renderTabAttendance();
    if (tabName === 'syllabus') renderTabSyllabus();
  }, 50);
}

export function renderBatchDetail(batchId) {
  const targetBatchId = batchId || store.get('currentActiveBatchId') || 'b-srmpc-madhapur';
  const b = store.batchAnalytics || {};
  const allBatches = store.batches || [];
  const foundBatch = allBatches.find(x => x.id === targetBatchId);

  const batchName = foundBatch ? `${foundBatch.name} (${foundBatch.branchName})` : (b.batchName || "SR MPC (Madhapur)");
  const targetExam = foundBatch ? foundBatch.targetExam : (b.targetExam || "JEE Mains");
  const studentCount = foundBatch ? foundBatch.studentCount : (b.studentCount || 78);
  const avgScore = foundBatch ? Math.round(foundBatch.avgScore || 68.4) : (b.averageScore || 68.4);

  // Header & Meta
  const titleEl = document.getElementById("batch-detail-title");
  if (titleEl) titleEl.textContent = batchName;
  const metaEl = document.getElementById("batch-detail-meta");
  if (metaEl) metaEl.innerHTML = `<span class="capitalize">${targetExam}</span> · 2025-26 · ${studentCount} students`;
  const avgScoreEl = document.getElementById("batch-detail-avg-score");
  if (avgScoreEl) avgScoreEl.textContent = `${avgScore}%`;
  const rosterCountEl = document.getElementById("batch-detail-roster-count");
  if (rosterCountEl) rosterCountEl.textContent = `All Students (${studentCount})`;

  // KPI Summary Cards
  const kpiStudents = document.getElementById("batch-kpi-students");
  if (kpiStudents) kpiStudents.textContent = studentCount;
  const kpiStudentsSub = document.getElementById("batch-kpi-students-sub");
  if (kpiStudentsSub) kpiStudentsSub.textContent = `${targetExam} · 2025-26`;

  const kpiAvg = document.getElementById("batch-kpi-avg");
  if (kpiAvg) kpiAvg.textContent = `${avgScore}%`;

  const topScorer = b.summary?.topScorer || { name: "Bhagam Khyathi", avgPct: 94.2 };
  const kpiTopName = document.getElementById("batch-kpi-top-name");
  if (kpiTopName) kpiTopName.textContent = topScorer.name;
  const kpiTopAvg = document.getElementById("batch-kpi-top-avg");
  if (kpiTopAvg) kpiTopAvg.textContent = `${topScorer.avgPct}% avg`;

  const kpiAtrisk = document.getElementById("batch-kpi-atrisk-count");
  if (kpiAtrisk) kpiAtrisk.textContent = (b.atRiskStudents || []).length || 3;

  // Render Sub-views
  renderBatchScoreDistribution();
  renderBatchSubjectRadar();
  renderBloomsMatrix();
  renderWeakestTopicsTable();
  renderBatchStudentsLeaderboard();
  renderBatchTierSegmentation();
  renderBatchAtRiskOverview();
  renderStudentStandingCard(selectedLookupStudentId);

  switchBatchTab(currentBatchActiveTab || 'overview');
}

export function renderBatchScoreDistribution() {
  const canvas = document.getElementById("batchScoreDistChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const dist = store.batchAnalytics?.scoreDistribution || {
    "0-10": 0, "10-20": 1, "20-30": 2, "30-40": 4, "40-50": 8,
    "50-60": 14, "60-70": 22, "70-80": 18, "80-90": 7, "90-100": 2
  };
  const labels = Object.keys(dist);
  const counts = Object.values(dist);

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Submissions',
        data: counts,
        backgroundColor: '#2563EB',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw} submissions`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
  registerChart('batchScoreDistChart', chartInstance);
}

export function renderBatchSubjectRadar() {
  const canvas = document.getElementById("batchSubjectRadarChart");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const subjects = store.batchAnalytics?.subjects || [
    { name: "Physics", accuracy: 64 },
    { name: "Chemistry", accuracy: 72 },
    { name: "Mathematics", accuracy: 68 }
  ];

  const chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: subjects.map(s => s.name),
      datasets: [{
        label: 'Accuracy %',
        data: subjects.map(s => s.accuracy),
        backgroundColor: 'rgba(37, 99, 235, 0.25)',
        borderColor: '#2563EB',
        pointBackgroundColor: '#2563EB',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, display: false },
          grid: { color: 'rgba(0,0,0,0.08)' }
        }
      }
    }
  });
  registerChart('batchSubjectRadarChart', chartInstance);
}

export function cellColorClass(accuracy, attempts) {
  if (!attempts || attempts === 0) return "bg-slate-50 text-slate-400";
  if (accuracy >= 80) return "bg-emerald-100 text-emerald-800 font-bold";
  if (accuracy >= 65) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (accuracy >= 50) return "bg-amber-100 text-amber-800 font-semibold";
  if (accuracy >= 35) return "bg-amber-50 text-amber-700 font-medium";
  return "bg-red-100 text-red-700 font-bold";
}

export function filterBloomsSubject(subjectId) {
  currentBloomsSubjectFilter = subjectId;
  renderBloomsMatrix();
}

export function renderBloomsMatrix() {
  const matrix = store.batchAnalytics?.bloomsMatrix;
  if (!matrix) return;

  const tbody = document.getElementById("batch-blooms-tbody");
  const tfoot = document.getElementById("batch-blooms-tfoot");
  if (!tbody || !tfoot) return;

  const levels = matrix.bloomsLevels || ["remember", "understand", "apply", "analyse", "evaluate", "create"];
  
  const filteredTopics = currentBloomsSubjectFilter === 'all'
    ? matrix.topics
    : matrix.topics.filter(t => t.subjectId === currentBloomsSubjectFilter);

  tbody.innerHTML = filteredTopics.map(t => `
    <tr class="transition-colors hover:bg-primary/5">
      <td class="sticky left-0 bg-surface border-b border-border/40 py-2.5 pr-3 max-w-[240px]">
        <div class="truncate font-medium text-gray-900 text-xs">${t.topicName}</div>
        <div class="truncate text-[10px] text-muted">${t.subjectName} · ${t.parentChapterName}</div>
      </td>
      ${levels.map(lvl => {
        const cell = t.blooms[lvl] || { attempts: 0, accuracy: 0, avgTimeSeconds: 0 };
        const cls = cellColorClass(cell.accuracy, cell.attempts);
        const title = cell.attempts ? `${cell.correct}/${cell.attempts} correct · ${cell.avgTimeSeconds}s avg` : 'No attempts';
        return `
          <td class="border-b border-border/40 px-1 py-1 text-center">
            <div title="${title}" class="mx-auto flex h-9 w-12 items-center justify-center rounded-md font-mono text-[11px] ${cls}">
              ${cell.attempts ? cell.accuracy + '%' : '—'}
            </div>
          </td>
        `;
      }).join("")}
      <td class="border-b border-border/40 px-1 py-1 text-center">
        <span class="font-mono text-xs font-bold ${t.accuracy >= 70 ? 'text-success' : t.accuracy >= 50 ? 'text-amber-600' : 'text-danger'}">
          ${t.accuracy}%
        </span>
      </td>
    </tr>
  `).join("");

  tfoot.innerHTML = `
    <tr class="font-semibold text-xs border-t border-border">
      <td class="sticky left-0 bg-surface pt-3 pr-3 text-[11px] uppercase tracking-wider text-muted">
        Bloom Totals
      </td>
      ${levels.map(lvl => {
        const tot = matrix.bloomsTotals[lvl] || { attempts: 0, accuracy: 0 };
        return `
          <td class="px-1 pt-3 text-center">
            <div class="font-mono text-xs font-bold text-gray-900">${tot.accuracy}%</div>
            <div class="text-[10px] text-muted font-mono">${tot.attempts} att</div>
          </td>
        `;
      }).join("")}
      <td class="px-1 pt-3 text-center">
        <div class="font-mono text-xs font-bold text-primary">${matrix.totals.accuracy}%</div>
        <div class="text-[10px] text-muted font-mono">${matrix.totals.attempts} total</div>
      </td>
    </tr>
  `;
}

export function renderWeakestTopicsTable() {
  const tbody = document.getElementById("batch-weakest-topics-tbody");
  if (!tbody) return;
  const topics = store.batchAnalytics?.topicPerformance || [];

  tbody.innerHTML = topics.slice(0, 15).map(t => {
    const accClass = t.accuracy < 40 ? "text-danger bg-red-50" : t.accuracy < 60 ? "text-amber-700 bg-amber-50" : "text-success bg-emerald-50";
    return `
      <tr class="border-b border-border/40 hover:bg-slate-50/60 transition-colors">
        <td class="py-2.5 pr-4 font-medium text-gray-900 text-xs">${t.topicName}</td>
        <td class="py-2.5 pr-4 text-xs text-muted">${t.subjectName}</td>
        <td class="py-2.5 pr-4 text-right font-mono text-xs text-slate-700">${t.totalQuestions}</td>
        <td class="py-2.5 pr-4 text-right font-mono text-xs text-slate-700">${t.correctAnswers}</td>
        <td class="py-2.5 text-right">
          <span class="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold ${accClass}">
            ${t.accuracy}%
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

export function sortBatchStudents(field) {
  if (batchSortField === field) {
    batchSortDir = batchSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    batchSortField = field;
    batchSortDir = field === 'name' ? 'asc' : 'desc';
  }

  ['rank', 'name', 'averagePercentage', 'averagePercentile', 'examsAttempted'].forEach(f => {
    const el = document.getElementById(`sort-icon-${f}`);
    if (el) {
      el.textContent = f === batchSortField ? (batchSortDir === 'asc' ? '▲' : '▼') : '';
    }
  });

  renderBatchStudentsLeaderboard();
}

export function renderBatchStudentsLeaderboard() {
  const tbody = document.getElementById("batch-students-roster-tbody");
  if (!tbody) return;

  const roster = [...(store.batchAnalytics?.studentRanking || [])];

  roster.sort((a, b) => {
    const mul = batchSortDir === 'asc' ? 1 : -1;
    if (batchSortField === 'name') return mul * a.name.localeCompare(b.name);
    return mul * ((a[batchSortField] ?? 0) - (b[batchSortField] ?? 0));
  });

  tbody.innerHTML = roster.map(s => {
    const rankBadge = s.rank === 1 ? "bg-amber-100 text-amber-800" :
                      s.rank === 2 ? "bg-slate-200 text-slate-800" :
                      s.rank === 3 ? "bg-orange-100 text-orange-800" :
                      "text-muted font-normal";

    return `
      <tr class="border-b border-border/30 hover:bg-primary/5 transition-colors">
        <td class="py-2.5 pr-3">
          <span class="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${rankBadge}">
            ${s.rank}
          </span>
        </td>
        <td class="py-2.5 pr-3">
          <button onclick="openStudentModal('${s.studentId}')" class="font-medium text-gray-900 hover:text-primary text-xs text-left">
            ${s.name}
          </button>
        </td>
        <td class="py-2.5 pr-3 text-right font-mono text-xs text-slate-900 font-semibold">${s.averagePercentage}%</td>
        <td class="py-2.5 pr-3 text-right font-mono text-xs font-bold text-primary">${s.averagePercentile}%ile</td>
        <td class="py-2.5 text-right font-mono text-xs text-muted">${s.examsAttempted}</td>
      </tr>
    `;
  }).join("");
}

export function renderBatchTierSegmentation() {
  const container = document.getElementById("batch-tier-segmentation-container");
  if (!container) return;

  const tiers = store.batchAnalytics?.tierSegmentation || {};

  const tierConfigs = [
    { key: 'top', data: tiers.top, icon: 'ph-trophy', color: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20', iconColor: 'text-emerald-600', labelColor: 'text-emerald-700' },
    { key: 'middle', data: tiers.middle, icon: 'ph-minus', color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20', iconColor: 'text-blue-600', labelColor: 'text-blue-700' },
    { key: 'bottom', data: tiers.bottom, icon: 'ph-trend-down', color: 'from-red-500/10 to-red-500/5 border-red-500/20', iconColor: 'text-red-600', labelColor: 'text-red-700' }
  ];

  container.innerHTML = tierConfigs.map(c => {
    const t = c.data;
    if (!t) return '';
    return `
      <div class="rounded-2xl border bg-gradient-to-br p-5 ${c.color}">
        <div class="flex items-center gap-2 mb-4">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 shadow-xs ${c.iconColor}">
            <i class="ph-duotone ${c.icon} text-lg"></i>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wide ${c.labelColor}">${t.label}</h3>
            <p class="text-[11px] text-muted">${t.studentCount} students · ${t.averagePercentage}% avg</p>
          </div>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Strong subjects</p>
            <div class="space-y-1">
              ${(t.strongSubjects || []).map(s => `
                <div class="flex items-center justify-between">
                  <span class="font-medium text-slate-800">${s.subjectName}</span>
                  <span class="flex items-center gap-1 font-mono font-bold text-emerald-600 text-[11px]">
                    <i class="ph-bold ph-trend-up"></i> ${s.accuracy}%
                  </span>
                </div>
              `).join("")}
            </div>
          </div>

          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Weak subjects</p>
            <div class="space-y-1">
              ${(t.weakSubjects || []).map(s => `
                <div class="flex items-center justify-between">
                  <span class="font-medium text-slate-800">${s.subjectName}</span>
                  <span class="flex items-center gap-1 font-mono font-bold text-red-600 text-[11px]">
                    <i class="ph-bold ph-trend-down"></i> ${s.accuracy}%
                  </span>
                </div>
              `).join("")}
            </div>
          </div>

          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Strong chapters</p>
            <div class="space-y-1">
              ${(t.strongChapters || []).map(c => `
                <div class="flex items-center justify-between">
                  <span class="truncate text-slate-700 max-w-[160px]">${c.topicName}</span>
                  <span class="font-mono font-semibold text-emerald-600 text-[11px]">+${c.accuracy}%</span>
                </div>
              `).join("")}
            </div>
          </div>

          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Weak chapters</p>
            <div class="space-y-1">
              ${(t.weakChapters || []).map(c => `
                <div class="flex items-center justify-between">
                  <span class="truncate text-slate-700 max-w-[160px]">${c.topicName}</span>
                  <span class="font-mono font-semibold text-red-600 text-[11px]">-${c.accuracy}%</span>
                </div>
              `).join("")}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join("");
}

export function renderBatchAtRiskOverview() {
  const container = document.getElementById("batch-atrisk-overview-list");
  if (!container) return;
  const list = store.batchAnalytics?.atRiskStudents || [];

  container.innerHTML = list.map(s => `
    <div onclick="openStudentModal('${s.studentId}')" class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/70 p-3.5 transition-colors hover:bg-red-100/60 cursor-pointer">
      <div>
        <p class="text-sm font-semibold text-gray-900">${s.name} (Roll: ${s.rollNo})</p>
        <div class="mt-1 flex items-center gap-2">
          ${(s.recentPercentiles || []).map((p, i) => `
            <span class="inline-flex items-center gap-0.5 rounded-md bg-red-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-900">
              ${i > 0 ? '<i class="ph-bold ph-trend-down text-[9px]"></i>' : ''}
              ${p}%ile
            </span>
          `).join("")}
          <span class="text-[11px] text-red-800 ml-1">· ${s.topWeakTopic}</span>
        </div>
      </div>
      <span class="rounded-full bg-red-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-900">
        ${s.trend}
      </span>
    </div>
  `).join("");
}

export function onStudentLookupInput(q) {
  const resultsContainer = document.getElementById("batch-student-lookup-results");
  if (!resultsContainer) return;

  const query = (q || "").toLowerCase().trim();
  if (query.length < 2) {
    resultsContainer.classList.add("hidden");
    return;
  }

  const roster = store.batchAnalytics?.studentRanking || [];
  const matches = roster.filter(s => s.name.toLowerCase().includes(query) || (s.studentId && s.studentId.includes(query)));

  if (matches.length === 0) {
    resultsContainer.innerHTML = '<p class="p-3 text-xs text-muted">No matching students found</p>';
  } else {
    resultsContainer.innerHTML = matches.map(s => `
      <button onclick="selectStudentLookup('${s.studentId}')" class="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs border-b border-border/30">
        <div>
          <span class="font-semibold text-gray-900">${s.name}</span>
          <span class="text-muted ml-1">· Rank #${s.rank}</span>
        </div>
        <span class="font-mono text-primary font-bold">${s.averagePercentage}%</span>
      </button>
    `).join("");
  }
  resultsContainer.classList.remove("hidden");
}

export function selectStudentLookup(studentId) {
  selectedLookupStudentId = studentId;
  const input = document.getElementById("batch-student-lookup-input");
  const results = document.getElementById("batch-student-lookup-results");
  if (results) results.classList.add("hidden");
  
  const student = (store.batchAnalytics?.studentRanking || []).find(s => s.studentId === studentId);
  if (input && student) input.value = student.name;

  renderStudentStandingCard(studentId);
}

export function renderStudentStandingCard(studentId) {
  const card = document.getElementById("batch-student-standing-card");
  if (!card) return;

  const roster = store.batchAnalytics?.studentRanking || [];
  const student = roster.find(s => s.studentId === studentId) || roster[0] || {
    name: "Bhagam Khyathi",
    studentId: "s-101",
    rank: 1,
    averagePercentage: 94.2,
    averagePercentile: 99.1
  };

  const deltaVsMedian = Math.round(student.averagePercentage - 68);
  const gapToTop = Math.max(0, Math.round(94.2 - student.averagePercentage));

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-base font-semibold text-gray-900">${student.name}</p>
        <p class="text-xs text-muted">SR MPC (Madhapur)</p>
      </div>
      <span class="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
        Rank #${student.rank} / 78
      </span>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-xl border border-border bg-white p-3 shadow-2xs">
        <p class="text-[11px] uppercase tracking-wider text-muted font-medium">Avg %</p>
        <p class="mt-1 text-lg font-bold font-mono text-gray-900">${student.averagePercentage}%</p>
        <p class="text-[11px] text-muted">batch median 68%</p>
      </div>
      <div class="rounded-xl border border-border bg-white p-3 shadow-2xs">
        <p class="text-[11px] uppercase tracking-wider text-muted font-medium">Percentile</p>
        <p class="mt-1 text-lg font-bold font-mono text-primary">p${Math.round(student.averagePercentile)}</p>
        <p class="text-[11px] text-muted">within batch</p>
      </div>
      <div class="rounded-xl border border-border bg-white p-3 shadow-2xs">
        <p class="text-[11px] uppercase tracking-wider text-muted font-medium">Δ vs median</p>
        <p class="mt-1 text-lg font-bold font-mono ${deltaVsMedian >= 0 ? 'text-emerald-600' : 'text-red-600'}">
          ${deltaVsMedian >= 0 ? '+' : ''}${deltaVsMedian} pts
        </p>
        <p class="text-[11px] ${deltaVsMedian >= 0 ? 'text-emerald-600' : 'text-red-600'} font-medium">
          ${deltaVsMedian >= 0 ? 'above median' : 'below median'}
        </p>
      </div>
      <div class="rounded-xl border border-border bg-white p-3 shadow-2xs">
        <p class="text-[11px] uppercase tracking-wider text-muted font-medium">Gap to top</p>
        <p class="mt-1 text-lg font-bold font-mono text-amber-600">${gapToTop} pts</p>
        <p class="text-[11px] text-amber-600 font-medium">Bhagam Khyathi</p>
      </div>
    </div>

    <div class="flex items-center justify-end border-t border-border pt-3">
      <button onclick="openStudentModal('${student.studentId}')" class="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
        Open Student Dossier <i class="ph-bold ph-arrow-right"></i>
      </button>
    </div>
  `;
}

export function renderTabBellCurve() {
  const canvas = document.getElementById("tabBellCurveCanvas");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const bell = store.batchAnalytics?.bellCurve || {};
  const buckets = bell.buckets || [];

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.range),
      datasets: [
        {
          label: 'Student Count',
          data: buckets.map(b => b.count),
          backgroundColor: '#2563EB',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
  registerChart('tabBellCurveCanvas', chartInstance);
}

export function renderTabBoxPlot() {
  const container = document.getElementById("tab-boxplot-list");
  if (!container) return;

  const b = store.batchAnalytics || {};
  const subjects = Array.isArray(b.boxPlot) ? b.boxPlot : (b.boxPlot?.subjects || [
    { name: "Physics", min: 28, q1: 52, median: 68, q3: 82, max: 96 },
    { name: "Chemistry", min: 34, q1: 58, median: 74, q3: 88, max: 98 },
    { name: "Mathematics", min: 22, q1: 48, median: 64, q3: 78, max: 94 }
  ]);

  container.innerHTML = subjects.map(s => `
    <div class="flex items-center gap-4">
      <span class="w-28 text-xs font-semibold text-gray-900 truncate">${s.name || s.subject}</span>
      <div class="flex-1 relative h-7 rounded-lg bg-slate-100">
        <div class="absolute top-1/2 -translate-y-1/2 h-0.5 bg-slate-400" style="left: ${s.min}%; right: ${100 - s.max}%"></div>
        <div class="absolute top-1 bottom-1 rounded bg-blue-200 border border-blue-400" style="left: ${s.q1}%; width: ${s.q3 - s.q1}%"></div>
        <div class="absolute top-0 bottom-0 w-1 bg-primary rounded-full" style="left: ${s.median}%"></div>
      </div>
      <span class="w-16 text-right font-mono text-xs font-bold text-primary">${s.median}% med</span>
    </div>
  `).join("");
}

export function renderTabAtRisk() {
  const roster = document.getElementById("tab-atrisk-roster");
  if (!roster) return;
  const list = store.batchAnalytics?.atRiskStudents || [];

  roster.innerHTML = list.map(s => `
    <div onclick="openStudentModal('${s.studentId}')" class="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
      <div>
        <p class="text-sm font-semibold text-gray-900">${s.name} (Roll: ${s.rollNo || ''})</p>
        <p class="text-xs text-muted">Risk Score: <span class="font-bold font-mono text-red-600">${s.riskScore}</span> · Weak: ${s.topWeakTopic}</p>
      </div>
      <span class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${s.riskScore > 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">
        ${s.trend}
      </span>
    </div>
  `).join("");
}

export function renderTabAttendance() {
  const canvas = document.getElementById("tabAttendanceCanvas");
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext("2d");

  const b = store.batchAnalytics || {};
  const att = b.attendance || {};
  const buckets = att.buckets || [
    { range: '0-50', count: 2 },
    { range: '50-60', count: 1 },
    { range: '60-70', count: 3 },
    { range: '70-80', count: 8 },
    { range: '80-90', count: 28 },
    { range: '90-100', count: 36 }
  ];

  const avgEl = document.getElementById("tab-att-avg");
  if (avgEl) avgEl.textContent = `${att.avgAttendance || 89}%`;
  const belowEl = document.getElementById("tab-att-below");
  if (belowEl) belowEl.textContent = att.belowThreshold != null ? att.belowThreshold : 2;
  const totalEl = document.getElementById("tab-att-total");
  if (totalEl) totalEl.textContent = att.totalStudents || 78;

  const chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.range + "%"),
      datasets: [{
        label: 'Students',
        data: buckets.map(b => b.count),
        backgroundColor: '#10B981',
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} students in ${ctx.label} attendance band`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 5 } },
        x: { grid: { display: false } }
      }
    }
  });
  registerChart('tabAttendanceCanvas', chartInstance);
}

export function renderTabSyllabus() {
  // Batch syllabus tracker
}
