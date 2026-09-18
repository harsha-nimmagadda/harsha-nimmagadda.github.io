/**
 * Excellencia AI — Admin Analytics Interactive Logic
 * Pixel-matched to backend-source/apps/dashboard/src/app/analytics
 */

let APP_DATA = window.__DEMO_DATA__ || {};
var DATA = APP_DATA;
window.DATA = APP_DATA;
let charts = {};
let currentScopeBranch = 'all';
let currentPerformerTab = 'all';
let filterAtRiskOnly = false;

let currentActiveBatchId = 'b-srmpc-madhapur';
let currentBatchActiveTab = 'overview';
let batchSortField = 'rank';
let batchSortDir = 'asc';
let currentBloomsSubjectFilter = 'all';
let selectedLookupStudentId = 's-101';
let currentActiveStudentId = 's-101';
let currentStudentTimeRange = 'all';
let currentStudentExamsPage = 1;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  if (!window.__DEMO_DATA__) {
    console.error("Demo data not loaded! Check data/all_data.js");
    return;
  }
  APP_DATA = window.__DEMO_DATA__;
  DATA = APP_DATA;
  window.DATA = APP_DATA;

  // Render initial components
  renderOverview();
  renderHome();
  renderStudentsTable();
  renderExamsTable();
  renderCompareMatrix();
  renderBranches();
  renderDPP();
  renderCohorts();
  initAskPresets();

  // Listen for hash changes
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      switchView(hash, false);
    }
  });

  // Check URL hash on page load
  const initialHash = window.location.hash.replace("#", "") || "overview";
  switchView(initialHash, false);
}

// ── View Switcher ────────────────────────────────────────────────────

function switchView(viewName, updateHash = true) {
  // Check if deep link to batch, student, or exam
  if (viewName.startsWith("batch/")) {
    const batchId = viewName.replace("batch/", "");
    currentActiveBatchId = batchId;
    viewName = "batch-detail";
  } else if (viewName.startsWith("student/")) {
    const raw = viewName.replace("student/", "");
    const parts = raw.split("/");
    currentActiveStudentId = parts[0] || 's-101';
    if (parts[1] === "test-analysis") {
      viewName = "student-test-analysis";
      currentActiveExamId = parts[2] || currentActiveExamId || 'ex-301';
    } else if (parts[1] === "answer-behavior") {
      viewName = "student-answer-behavior";
      if (parts[2]) currentActiveExamId = parts[2];
    } else if (parts[1]) {
      viewName = "student-" + parts[1];
    } else {
      viewName = "student-detail";
    }
  } else if (viewName.startsWith("batch/") && viewName.includes("/discrimination/")) {
    const raw = viewName.replace("batch/", "");
    const parts = raw.split("/");
    currentActiveBatchId = parts[0] || 'b-srmpc-madhapur';
    currentActiveExamId = parts[2] || 'ex-301';
    viewName = "batch-discrimination";
  } else if (viewName.startsWith("exam/")) {
    const examId = viewName.replace("exam/", "");
    currentActiveExamId = examId;
    viewName = "exam-detail";
  }

  // Hide all sections
  document.querySelectorAll(".section-view").forEach(el => el.classList.add("hidden"));
  
  // Show target section
  const target = document.getElementById(`section-${viewName}`);
  if (target) {
    target.classList.remove("hidden");
  }

  // Update nav highlights
  document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
  
  if (viewName === "overview") {
    const navOverview = document.getElementById("nav-overview");
    if (navOverview) navOverview.classList.add("active");
  } else if (viewName === "batch-detail") {
    // Parent group expanded
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const caret = document.getElementById("analytics-caret");
    if (caret) caret.className = "ph-bold ph-caret-down text-xs ml-auto";
    renderBatchDetail(currentActiveBatchId);
  } else if (viewName === "student-detail") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentDetail(currentActiveStudentId);
  } else if (viewName === "student-eri") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentEri(currentActiveStudentId);
  } else if (viewName === "student-heatmap") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentHeatmap(currentActiveStudentId);
  } else if (viewName === "student-predictive-path") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentPredictivePath(currentActiveStudentId);
  } else if (viewName === "student-rank-predictor") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentRankPredictor(currentActiveStudentId);
  } else if (viewName === "student-practice") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentPractice(currentActiveStudentId);
  } else if (viewName === "student-success-gap") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentSuccessGap(currentActiveStudentId);
  } else if (viewName === "student-weakness-improvement") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentWeaknessImprovement(currentActiveStudentId);
  } else if (viewName === "student-time-vs-performance") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentTimeVsPerformance(currentActiveStudentId);
  } else if (viewName === "student-attendance-impact") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentAttendanceImpact(currentActiveStudentId);
  } else if (viewName === "exams") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const navExams = document.getElementById("nav-exams");
    if (navExams) navExams.classList.add("active");
    renderExamsView();
  } else if (viewName === "exam-detail") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const navExams = document.getElementById("nav-exams");
    if (navExams) navExams.classList.add("active");
    renderExamDetail(currentActiveExamId);
  } else if (viewName === "student-test-analysis") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentTestAnalysis(currentActiveStudentId, currentActiveExamId);
  } else if (viewName === "student-answer-behavior") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderStudentAnswerBehavior(currentActiveStudentId, currentActiveExamId);
  } else if (viewName === "batch-discrimination") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    renderBatchDiscrimination(currentActiveBatchId, currentActiveExamId);
  } else if (viewName === "dpp") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const navDpp = document.getElementById("nav-dpp");
    if (navDpp) navDpp.classList.add("active");
    renderDppView();
  } else if (viewName === "compare") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const navCompare = document.getElementById("nav-compare");
    if (navCompare) navCompare.classList.add("active");
    renderCompareView();
  } else if (viewName === "cohorts") {
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const navCohorts = document.getElementById("nav-cohorts");
    if (navCohorts) navCohorts.classList.add("active");
    renderCohortsView();
  } else {
    // Child view is active
    const activeNav = document.getElementById(`nav-${viewName}`);
    if (activeNav) activeNav.classList.add("active");
    // Ensure parent group stays expanded
    document.getElementById("analytics-subnav")?.classList.remove("hidden");
    const caret = document.getElementById("analytics-caret");
    if (caret) caret.className = "ph-bold ph-caret-down text-xs ml-auto";
  }

  if (updateHash) {
    if (viewName === "batch-detail") {
      window.location.hash = `batch/${currentActiveBatchId}`;
    } else if (viewName === "student-detail") {
      window.location.hash = `student/${currentActiveStudentId}`;
    } else if (viewName.startsWith("student-")) {
      const dd = viewName.replace("student-", "");
      window.location.hash = `student/${currentActiveStudentId}/${dd}`;
    } else if (viewName === "exam-detail") {
      window.location.hash = `exam/${currentActiveExamId}`;
    } else {
      window.location.hash = viewName;
    }
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Trigger chart resizes for visible charts
  setTimeout(() => {
    Object.values(charts).forEach(c => c && c.resize && c.resize());
  }, 60);
}

function toggleAnalyticsGroup() {
  const subnav = document.getElementById("analytics-subnav");
  const caret = document.getElementById("analytics-caret");
  if (!subnav) return;

  if (subnav.classList.contains("hidden")) {
    subnav.classList.remove("hidden");
    if (caret) caret.className = "ph-bold ph-caret-down text-xs ml-auto";
  } else {
    switchView("overview");
  }
}

function filterNavItems(query) {
  const q = (query || "").toLowerCase().trim();
  const subnav = document.getElementById("analytics-subnav");
  if (!subnav) return;

  const childButtons = subnav.querySelectorAll(".nav-child");
  childButtons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      btn.style.display = "";
    } else {
      btn.style.display = "none";
    }
  });

  if (q) {
    subnav.classList.remove("hidden");
  }
}

// ── Scope / Branch Filter ────────────────────────────────────

function onScopeChange(branchId) {
  currentScopeBranch = branchId;
  const branchSelect = document.getElementById("sidebar-branch-select");
  if (branchSelect) branchSelect.value = branchId;

  const breadcrumb = document.getElementById("branch-breadcrumb");
  const breadcrumbName = document.getElementById("breadcrumb-branch-name");
  const title = document.getElementById("overview-title");
  const subtitle = document.getElementById("overview-subtitle");
  const scopeKpi = document.getElementById("ov-scope");

  if (branchId === "all") {
    if (breadcrumb) breadcrumb.classList.add("hidden");
    if (title) title.textContent = "Institution Analytics";
    if (subtitle) subtitle.textContent = "Overview of all branches, batches, faculty, and student performance.";
    if (scopeKpi) scopeKpi.textContent = "Institution";
    
    // Reset KPIs to total
    const inst = APP_DATA.institution || {};
    document.getElementById("ov-students").textContent = Number(inst.totalStudents || 4765).toLocaleString();
    document.getElementById("ov-exams").textContent = Number(inst.totalExams || 36920).toLocaleString();
    document.getElementById("ov-score").textContent = `${inst.avgPercentile || 54.2}%`;
    document.getElementById("ov-attendance").textContent = `${inst.attendanceSummary?.overallRate || 88.5}%`;
    document.getElementById("ov-batches").textContent = inst.activeBatches || 76;
    const atRiskCount = inst.atRiskStudents?.length || 14;
    const attCountEl = document.getElementById("ov-attention-count");
    if (attCountEl) attCountEl.textContent = atRiskCount;
    const alertTitle = document.getElementById("alert-card-title");
    if (alertTitle) alertTitle.textContent = `${atRiskCount} Students with low scores or absent ↓`;
  } else {
    const branch = (APP_DATA.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : branchId;

    if (breadcrumb) breadcrumb.classList.remove("hidden");
    if (breadcrumbName) breadcrumbName.textContent = branchName;
    if (title) title.textContent = `${branchName} Analytics`;
    if (subtitle) subtitle.textContent = "Branch performance, batches, and student analytics.";
    if (scopeKpi) scopeKpi.textContent = branchName;

    if (branch) {
      document.getElementById("ov-students").textContent = Number(branch.studentCount || 0).toLocaleString();
      document.getElementById("ov-exams").textContent = branch.examCount || branch.exams || 24;
      document.getElementById("ov-score").textContent = `${branch.avgScore || branch.percentile || 55.4}%`;
      document.getElementById("ov-attendance").textContent = `${Math.round((branch.avgScore || 55) * 0.9 + 40)}%`;
      document.getElementById("ov-batches").textContent = branch.batchCount || 4;
      const attCountEl = document.getElementById("ov-attention-count");
      if (attCountEl) attCountEl.textContent = "3";
      const alertTitle = document.getElementById("alert-card-title");
      if (alertTitle) alertTitle.textContent = "3 Students with low scores or absent ↓";
    }
  }

  switchView("overview");
}

function onBatchFilterChange(batchId) {
  const btn = document.getElementById("btn-open-batch-hub");
  if (!btn) return;
  if (batchId) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

function openSelectedBatchHub() {
  const batchId = document.getElementById("overview-batch-filter")?.value;
  if (batchId) {
    openBatchModal(batchId);
  }
}

// ── Section 0: Overview Rendering ────────────────────────────────────

function renderOverview() {
  const d = APP_DATA.institution || {};
  
  if (d.totalStudents) document.getElementById("ov-students").textContent = Number(d.totalStudents).toLocaleString();
  if (d.totalExams) document.getElementById("ov-exams").textContent = Number(d.totalExams).toLocaleString();
  if (d.avgPercentile) document.getElementById("ov-score").textContent = `${d.avgPercentile}%`;
  if (d.attendanceSummary) document.getElementById("ov-attendance").textContent = `${d.attendanceSummary.overallRate}%`;
  if (d.activeBatches) document.getElementById("ov-batches").textContent = d.activeBatches;
  if (d.atRiskStudents) {
    const el = document.getElementById("ov-attention-count");
    if (el) el.textContent = d.atRiskStudents.length;
    const alertTitle = document.getElementById("alert-card-title");
    if (alertTitle) alertTitle.textContent = `${d.atRiskStudents.length} Students with low scores or absent ↓`;
  }

  renderTrendChart();
  renderBranchChart();
  renderAttendanceDonut();
  renderTopBatchesList();
  renderTopPerformersList();
  renderBatchOverviewRows();
  renderOverviewAttentionList();
}

function renderTrendChart() {
  const ctx = document.getElementById("trendChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.trendChart) charts.trendChart.destroy();

  const trends = APP_DATA.trends?.trends || [];
  const labels = trends.map(t => t.month);
  const scoreData = trends.map(t => t.avgScore);
  const pctData = trends.map(t => t.avgPercentile);

  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

  charts.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Score %',
          data: scoreData,
          borderColor: '#2563EB',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Percentile %',
          data: pctData,
          borderColor: '#93C5FD',
          borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 11 } } }
      },
      scales: {
        y: { min: 40, max: 70, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderBranchChart() {
  const ctx = document.getElementById("branchChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.branchChart) charts.branchChart.destroy();

  const branches = APP_DATA.branches || [];
  const labels = branches.map(b => b.name);
  const data = branches.map(b => b.avgScore || b.percentile || 55);

  charts.branchChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Percentile %',
        data,
        backgroundColor: '#2563EB',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { min: 40, max: 75, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function renderAttendanceDonut() {
  const canvas = document.getElementById("attendanceDonutChart") || document.getElementById("attendanceDonut");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (charts.attendanceDonut) charts.attendanceDonut.destroy();

  const att = APP_DATA.institution?.attendanceSummary || { present: 4217, absent: 381, late: 167 };
  const presentCount = att.present || 4217;
  const absentCount = att.absent || 381;
  const lateCount = att.late || 167;
  const total = presentCount + absentCount + lateCount;

  const presentRate = Math.round(presentCount / total * 100);
  const absentRate = Math.round(absentCount / total * 100);
  const lateRate = Math.max(1, 100 - presentRate - absentRate);

  const prEl = document.getElementById("att-present") || document.getElementById("att-present-rate");
  if (prEl) prEl.textContent = `${presentRate}%`;
  const abEl = document.getElementById("att-absent");
  if (abEl) abEl.textContent = `${absentRate}%`;
  const ltEl = document.getElementById("att-late");
  if (ltEl) ltEl.textContent = `${lateRate}%`;

  charts.attendanceDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent', 'Late'],
      datasets: [{
        data: [presentCount, absentCount, lateCount],
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} students (${Math.round(ctx.parsed / total * 100)}%)`
          }
        }
      }
    }
  });
}

let overviewShowAllBatches = false;

function toggleOverviewAllBatches() {
  overviewShowAllBatches = !overviewShowAllBatches;
  const btn = document.getElementById("btn-toggle-all-batches");
  if (btn) {
    btn.textContent = overviewShowAllBatches ? "Show Top 4 Only ▴" : "Show All Batches ▾";
  }
  renderTopBatchesList();
}

function renderTopBatchesList() {
  const container = document.getElementById("top-batches-list");
  if (!container) return;
  const batches = APP_DATA.institution?.topBatches || [];
  const displayBatches = overviewShowAllBatches ? batches : batches.slice(0, 4);

  container.innerHTML = displayBatches.map(b => {
    const rankColor = b.rank === 1 ? 'bg-amber-100 text-amber-800' : b.rank === 2 ? 'bg-slate-200 text-slate-800' : b.rank === 3 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600';
    return `
      <div class="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition-colors" onclick="openBatchModal('${b.batchId}')">
        <div class="flex items-center gap-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${rankColor}">
            ${b.rank}
          </span>
          <div>
            <p class="text-sm font-semibold text-gray-900">${b.name}</p>
            <p class="text-xs text-muted">${b.branch} • ${b.targetExam}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-mono text-sm font-bold text-success">${b.avgPercentile}%</span>
          <p class="text-[11px] text-muted">${b.students} students</p>
        </div>
      </div>
    `;
  }).join("");
}

function renderTopPerformersList() {
  const container = document.getElementById("top-performers-list");
  if (!container) return;
  const performers = APP_DATA.institution?.topPerformers || [];

  const filtered = currentPerformerTab === 'all' 
    ? performers 
    : performers.filter(p => p.batch.includes(currentPerformerTab));

  container.innerHTML = filtered.slice(0, 5).map(p => {
    const crown = p.rank === 1 ? '<i class="ph-fill ph-crown text-amber-500 text-sm"></i>' : '';
    return `
      <div class="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition-colors" onclick="openStudentModal('${p.studentId}')">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary font-bold flex items-center justify-center text-xs">
            ${p.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-semibold text-gray-900">${p.name}</span>
              ${crown}
            </div>
            <p class="text-xs text-muted">${p.batch} • ${p.branch}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-mono text-sm font-bold text-slate-900">${p.avgScore}</span>
          <p class="text-[11px] font-semibold text-success font-mono">${p.avgPercentile}nd %ile</p>
        </div>
      </div>
    `;
  }).join("");
}

function filterPerformersTab(tab) {
  currentPerformerTab = tab;
  document.querySelectorAll("#top-performers-tabs .tab-btn").forEach(btn => {
    if (btn.textContent.includes(tab) || (tab === 'all' && btn.textContent.includes('All'))) {
      btn.className = "px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold tab-btn active";
    } else {
      btn.className = "px-2.5 py-1 rounded-md text-muted hover:text-slate-900 tab-btn";
    }
  });
  renderTopPerformersList();
}

function renderBatchOverviewRows() {
  const container = document.getElementById("batch-overview-rows");
  if (!container) return;
  const batches = APP_DATA.batches || [];

  container.innerHTML = batches.map(b => {
    const pct = Math.min(100, Math.round(b.avgScore || 60));
    const status = pct >= 65 ? "Healthy" : pct >= 50 ? "Warning" : "Critical";
    const statusClass = pct >= 65 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
    const barClass = pct >= 65 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

    return `
      <div onclick="openBatchModal('${b.id}')" class="group grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_100px] items-center gap-2 sm:gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-primary/5 cursor-pointer">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-gray-900 group-hover:text-primary">${b.name} (${b.branchName})</p>
          <p class="text-[10px] text-muted sm:hidden">${b.studentCount} students</p>
        </div>
        <span class="hidden sm:block text-center font-mono text-sm text-muted">${b.studentCount}</span>
        <div class="flex items-center gap-3">
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full ${barClass}" style="width: ${pct}%"></div>
          </div>
          <span class="shrink-0 font-mono text-xs font-semibold tabular-nums">${pct}%</span>
        </div>
        <div class="hidden sm:flex justify-center">
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass}">
            ${status}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

// ── Section 1: Home / Insights ───────────────────────────────────────

function renderHome() {
  const home = APP_DATA.homeV2 || {};
  
  const ctx = document.getElementById("home30dChart")?.getContext("2d");
  if (ctx) {
    if (charts.home30dChart) charts.home30dChart.destroy();
    const data = home.trend30d || [];
    charts.home30dChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.day),
        datasets: [{
          label: 'Daily Average %',
          data: data.map(d => d.avgPct),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 45, max: 65, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Risers & Fallers
  const risersList = document.getElementById("risers-list");
  if (risersList) {
    risersList.innerHTML = (home.risers || []).map(r => `
      <div class="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-50 px-2 rounded-lg" onclick="openStudentModal('${r.studentId}')">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
            ${r.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900">${r.name}</p>
            <p class="text-xs text-muted">${r.batchName}</p>
          </div>
        </div>
        <div class="text-right font-mono">
          <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
            +${r.delta} pts
          </span>
          <p class="text-[11px] text-muted mt-0.5">${r.recent}%</p>
        </div>
      </div>
    `).join("");
  }

  const fallersList = document.getElementById("fallers-list");
  if (fallersList) {
    fallersList.innerHTML = (home.fallers || []).map(f => `
      <div class="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-50 px-2 rounded-lg" onclick="openStudentModal('${f.studentId}')">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-xs">
            ${f.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900">${f.name}</p>
            <p class="text-xs text-muted">${f.batchName}</p>
          </div>
        </div>
        <div class="text-right font-mono">
          <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
            ${f.delta} pts
          </span>
          <p class="text-[11px] text-muted mt-0.5">${f.recent}%</p>
        </div>
      </div>
    `).join("");
  }

  // Insights
  const insightsList = document.getElementById("insights-list");
  if (insightsList) {
    insightsList.innerHTML = (home.insights || []).map(ins => {
      const color = ins.severity === 'warning' ? 'border-amber-200 bg-amber-50/60 text-amber-800' : ins.severity === 'celebrate' ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800' : 'border-blue-200 bg-blue-50/60 text-blue-800';
      return `
        <div class="p-4 rounded-xl border ${color}">
          <div class="font-bold text-sm text-slate-900 mb-1">${ins.title}</div>
          <p class="text-xs text-slate-700 leading-relaxed mb-3">${ins.body}</p>
          <div class="flex gap-2">
            ${(ins.recommendedActions || []).map(a => `
              <button class="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium">
                ${a.label}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  // Countdowns
  const countdownsList = document.getElementById("countdowns-list");
  if (countdownsList) {
    countdownsList.innerHTML = (home.countdowns || []).map(c => `
      <div class="p-3 rounded-xl border border-border bg-surface flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-slate-900">${c.targetExam}</div>
          <div class="text-[11px] text-muted">${c.scheduledStart}</div>
        </div>
        <div class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold font-mono text-xs">
          ${c.daysAway}d remaining
        </div>
      </div>
    `).join("");
  }

  // Batch Health Grid (Exact replica of apps/dashboard/src/app/analytics/home/page.tsx)
  const batchHealthGrid = document.getElementById("home-batch-health-grid");
  if (batchHealthGrid) {
    const batches = home.batches || APP_DATA.batches || [];
    batchHealthGrid.innerHTML = batches.map(b => {
      const healthDot = b.health === 'green' ? 'bg-emerald-500' : b.health === 'amber' ? 'bg-amber-500' : 'bg-red-500';
      const healthLabel = b.health === 'green' ? 'Healthy' : b.health === 'amber' ? 'Watch' : 'Needs attention';
      const avg = b.avgPct != null ? `${b.avgPct}%` : (b.avgScore ? `${Math.round(b.avgScore)}%` : '—');
      const size = b.size || b.studentCount || 78;
      const target = b.targetExam || "JEE Mains";
      const branch = b.branchName || "Madhapur";
      const name = b.batchName || b.name || "SR MPC";
      const last = b.lastAttemptAt ? `last test ${b.lastAttemptAt}` : 'last test yesterday';

      return `
        <div onclick="openBatchModal('${b.batchId || b.id}')" class="group block rounded-xl border border-border bg-white p-4 transition-all hover:border-blue-300 hover:shadow-xs cursor-pointer">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-[11px] font-medium uppercase tracking-wider text-muted">${branch}</p>
              <p class="mt-0.5 truncate text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">${name}</p>
              <p class="mt-0.5 truncate text-[11px] text-muted">${target} · ${size} students</p>
            </div>
            <span class="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${healthDot}" title="${healthLabel}"></span>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <p class="font-mono text-lg font-bold text-slate-900">${avg}</p>
            <p class="text-[11px] text-muted">${last}</p>
          </div>
        </div>
      `;
    }).join("");
  }
}

// ── Section 2: Students Roster ───────────────────────────────────────

function renderStudentsTable() {
  const tbody = document.getElementById("students-table-tbody");
  if (!tbody) return;

  const q = (document.getElementById("students-search")?.value || "").toLowerCase();
  const branch = document.getElementById("students-branch-filter")?.value || "all";
  const batch = document.getElementById("students-batch-filter")?.value || "all";
  const section = document.getElementById("students-section-filter")?.value || "all";

  const students = APP_DATA.students || [];

  const filtered = students.filter(s => {
    if (q && !s.name.toLowerCase().includes(q) && !s.rollNo.includes(q)) return false;
    if (branch !== "all" && s.branch !== branch) return false;
    if (batch !== "all" && s.batch !== batch) return false;
    if (section !== "all" && s.section && s.section !== section) return false;
    if (filterAtRiskOnly && s.risk !== "critical" && s.risk !== "warning") return false;
    return true;
  });

  tbody.innerHTML = filtered.map(s => {
    const riskBadge = s.risk === "critical" ? '<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">CRITICAL</span>' :
                      s.risk === "warning" ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">WARNING</span>' :
                      '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">HEALTHY</span>';

    const sectionBadge = s.section ? `<span class="inline-block text-[10px] text-muted font-normal">(${s.section})</span>` : '';

    return `
      <tr class="border-b border-border hover:bg-slate-50 cursor-pointer transition-colors" onclick="openStudentModal('${s.studentId}')">
        <td class="py-3 px-4 font-mono text-xs text-muted">${s.rollNo}</td>
        <td class="py-3 px-4 font-medium text-slate-900">${s.name}</td>
        <td class="py-3 px-4 text-slate-600">${s.batch} ${sectionBadge}</td>
        <td class="py-3 px-4 text-slate-600">${s.branch}</td>
        <td class="py-3 px-4 font-mono font-semibold text-slate-900">${s.avgScore}</td>
        <td class="py-3 px-4 font-mono font-bold text-success">${s.percentile}%</td>
        <td class="py-3 px-4 font-mono text-slate-700">${s.attendance}%</td>
        <td class="py-3 px-4">${riskBadge}</td>
      </tr>
    `;
  }).join("");
}

function toggleAtRiskFilter() {
  filterAtRiskOnly = !filterAtRiskOnly;
  const btn = document.getElementById("students-filter-atrisk");
  if (btn) {
    if (filterAtRiskOnly) {
      btn.className = "px-3 py-1.5 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-bold";
    } else {
      btn.className = "px-3 py-1.5 rounded-xl border border-border bg-white text-slate-700 text-xs font-medium";
    }
  }
  renderStudentsTable();
}

// ── Section 3: Exams Evaluation & Aggregate Analytics ────────────────────────
// Exact replica of backend-source/apps/dashboard/src/app/analytics/exams/page.tsx

const PURPOSE_LABELS = {
  mock_test: "Mock Test",
  unit_test: "Unit Test",
  chapter_test: "Chapter Test",
  practice: "Practice",
  assignment: "Assignment",
  dpp: "DPP",
  jee_mains: "JEE Mains",
  jee_advanced: "JEE Advanced",
  neet: "NEET",
  clat: "CLAT",
  ipmat_indore: "IPMAT Indore",
  ipmat_rohtak: "IPMAT Rohtak",
  bitsat: "BITSAT",
  custom: "Custom",
};

function formatPurpose(purpose) {
  if (!purpose) return "Custom";
  return PURPOSE_LABELS[purpose] || purpose.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusBadge(status) {
  switch (status) {
    case "results_released":
      return { label: "Released", color: "bg-emerald-50 text-emerald-700" };
    case "completed":
      return { label: "Completed", color: "bg-blue-50 text-blue-700" };
    case "in_progress":
      return { label: "In Progress", color: "bg-amber-50 text-amber-700" };
    case "scheduled":
      return { label: "Scheduled", color: "bg-purple-50 text-purple-700" };
    case "draft":
      return { label: "Draft", color: "bg-gray-50 text-gray-500" };
    case "grading":
      return { label: "Grading", color: "bg-orange-50 text-orange-700" };
    default:
      return { label: (status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "bg-gray-50 text-gray-500" };
  }
}

function getAppearanceColor(rate) {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

function rangeForPreset(key) {
  const today = new Date();
  const to = toIsoDate(today);
  const back = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  };
  switch (key) {
    case "today": return { from: to, to };
    case "7d": return { from: back(6), to };
    case "30d": return { from: back(29), to };
    case "90d": return { from: back(89), to };
    case "month": return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "year": return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to };
    default: return { from: "", to: "" };
  }
}

function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function detectPreset(from, to) {
  if (!from && !to) return "all";
  for (const p of DATE_PRESETS) {
    if (p.key === "all") continue;
    const r = rangeForPreset(p.key);
    if (r.from === from && r.to === to) return p.key;
  }
  return "custom";
}

// Filter and Pagination State for Exams
let examsSelectedBranchId = "all";
let examsSelectedBatchId = "all";
let examsSelectedType = "all";
let examsSelectedStatus = "all";
let examsDateFrom = "";
let examsDateTo = "";
let examsCurrentPage = 1;
const EXAMS_PAGE_SIZE = 10;
let examsDatePopoverOpen = false;

// Event Handlers for Exams Page Filters
function onExamsBranchChange(branchId) {
  examsSelectedBranchId = branchId;
  examsSelectedBatchId = "all";
  examsCurrentPage = 1;
  updateExamsBatchSelectOptions();
  renderExamsView();
}

function onExamsBatchChange(batchId) {
  examsSelectedBatchId = batchId;
  examsCurrentPage = 1;
  renderExamsView();
}

function onExamsTypeChange(type) {
  examsSelectedType = type;
  examsCurrentPage = 1;
  renderExamsView();
}

function onExamsStatusChange(status) {
  examsSelectedStatus = status;
  examsCurrentPage = 1;
  renderExamsView();
}

function changeExamsPage(delta) {
  examsCurrentPage += delta;
  renderExamsView();
}

// Date Range Popover Controls
function toggleExamDatePopover(e) {
  if (e) e.stopPropagation();
  examsDatePopoverOpen = !examsDatePopoverOpen;
  const popover = document.getElementById("exams-date-popover");
  const caret = document.getElementById("exams-date-caret");
  if (popover) {
    if (examsDatePopoverOpen) {
      popover.classList.remove("hidden");
      if (caret) caret.classList.add("rotate-180");
    } else {
      popover.classList.add("hidden");
      if (caret) caret.classList.remove("rotate-180");
    }
  }
}

function closeExamDatePopover() {
  examsDatePopoverOpen = false;
  const popover = document.getElementById("exams-date-popover");
  const caret = document.getElementById("exams-date-caret");
  if (popover) popover.classList.add("hidden");
  if (caret) caret.classList.remove("rotate-180");
}

function applyExamDatePreset(presetKey) {
  if (presetKey === "all") {
    examsDateFrom = "";
    examsDateTo = "";
  } else {
    const r = rangeForPreset(presetKey);
    examsDateFrom = r.from;
    examsDateTo = r.to;
  }
  examsCurrentPage = 1;
  syncExamDateInputs();
  closeExamDatePopover();
  renderExamsView();
}

function clearExamDateFilter(e) {
  if (e) e.stopPropagation();
  examsDateFrom = "";
  examsDateTo = "";
  examsCurrentPage = 1;
  syncExamDateInputs();
  closeExamDatePopover();
  renderExamsView();
}

function onExamsDateRangeInputChange() {
  const f = document.getElementById("exams-filter-from")?.value || "";
  const t = document.getElementById("exams-filter-to")?.value || "";
  examsDateFrom = f;
  examsDateTo = t;
  examsCurrentPage = 1;
  syncExamDateInputs();
  renderExamsView();
}

function onDirectExamsDateChange() {
  const f = document.getElementById("exams-date-from")?.value || "";
  const t = document.getElementById("exams-date-to")?.value || "";
  examsDateFrom = f;
  examsDateTo = t;
  examsCurrentPage = 1;
  syncExamDateInputs();
  renderExamsView();
}

function syncExamDateInputs() {
  const fEl1 = document.getElementById("exams-date-from");
  const tEl1 = document.getElementById("exams-date-to");
  const fEl2 = document.getElementById("exams-filter-from");
  const tEl2 = document.getElementById("exams-filter-to");
  if (fEl1) fEl1.value = examsDateFrom;
  if (tEl1) tEl1.value = examsDateTo;
  if (fEl2) fEl2.value = examsDateFrom;
  if (tEl2) tEl2.value = examsDateTo;

  // Update button label & style
  const btn = document.getElementById("exams-date-preset-btn");
  const labelEl = document.getElementById("exams-date-btn-label");
  const clearBtn = document.getElementById("exams-date-clear-btn");
  const customActiveTag = document.getElementById("exams-custom-range-active");
  const icon = document.getElementById("exams-date-icon");

  const active = !!(examsDateFrom || examsDateTo);
  const preset = detectPreset(examsDateFrom, examsDateTo);

  if (labelEl) {
    if (!active) {
      labelEl.textContent = "All time";
    } else if (preset !== "custom") {
      const pObj = DATE_PRESETS.find(p => p.key === preset);
      labelEl.textContent = pObj ? pObj.label : "Custom";
    } else if (examsDateFrom && examsDateTo) {
      labelEl.textContent = `${formatDateLabel(examsDateFrom)} – ${formatDateLabel(examsDateTo)}`;
    } else if (examsDateFrom) {
      labelEl.textContent = `From ${formatDateLabel(examsDateFrom)}`;
    } else {
      labelEl.textContent = `Until ${formatDateLabel(examsDateTo)}`;
    }
  }

  if (clearBtn) {
    if (active) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  if (btn) {
    if (active) {
      btn.className = "flex h-[42px] items-center gap-2 rounded-xl border border-primary/50 bg-primary/[0.04] px-3.5 text-sm font-medium text-primary shadow-xs outline-none transition-all";
      if (icon) icon.className = "ph-duotone ph-calendar-blank text-base text-primary";
    } else {
      btn.className = "flex h-[42px] items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-foreground shadow-xs outline-none transition-all hover:border-primary/60";
      if (icon) icon.className = "ph-duotone ph-calendar-blank text-base text-muted";
    }
  }

  if (customActiveTag) {
    if (preset === "custom") customActiveTag.classList.remove("hidden");
    else customActiveTag.classList.add("hidden");
  }

  // Update preset buttons highlighting inside popover
  document.querySelectorAll("#exams-date-popover .preset-btn").forEach(pBtn => {
    const key = pBtn.dataset.preset;
    if (key === preset) {
      pBtn.className = "preset-btn rounded-lg px-3 py-2 text-left text-sm font-medium bg-primary/10 text-primary transition-colors";
    } else {
      pBtn.className = "preset-btn rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/5 transition-colors";
    }
  });
}

// Global document click listener to dismiss date popover
document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("exams-date-filter-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeExamDatePopover();
  }
});

// Update batch dropdown depending on picked branch
function updateExamsBatchSelectOptions() {
  const batchSelect = document.getElementById("exams-filter-batch");
  if (!batchSelect) return;

  const batches = APP_DATA.batches || [];
  const visible = examsSelectedBranchId === "all"
    ? batches
    : batches.filter(b => b.branchId === examsSelectedBranchId || b.branchName?.toLowerCase() === examsSelectedBranchId.toLowerCase());

  const currentVal = examsSelectedBatchId;
  let html = '<option value="all">All Batches</option>';
  visible.forEach(b => {
    const isSelected = b.id === currentVal ? "selected" : "";
    html += `<option value="${b.id}" ${isSelected}>${b.name} (${b.branchName || ''})</option>`;
  });
  batchSelect.innerHTML = html;
}

// Populate filters initially
function initExamsFilterSelects() {
  const branchSelect = document.getElementById("exams-filter-branch");
  if (branchSelect && branchSelect.options.length <= 1) {
    const branches = APP_DATA.branches || [];
    branches.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      branchSelect.appendChild(opt);
    });
  }

  updateExamsBatchSelectOptions();

  const typeSelect = document.getElementById("exams-filter-type");
  if (typeSelect && typeSelect.options.length <= 1) {
    const allExams = APP_DATA.exams || [];
    const uniquePurposes = Array.from(new Set(allExams.map(e => e.purpose))).sort();
    uniquePurposes.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = formatPurpose(p);
      typeSelect.appendChild(opt);
    });
  }
}

// Main Render Function for Exams Page
function renderExamsView() {
  initExamsFilterSelects();
  syncExamDateInputs();

  const exams = APP_DATA.exams || [];

  // Filter exams exactly matching apps/dashboard/src/app/analytics/exams/page.tsx:580-610
  const filtered = exams.filter(e => {
    // Branch filter
    if (examsSelectedBranchId !== "all") {
      const matchesBranch = (e.assignedBatches || []).some(b => {
        const fullBatch = (APP_DATA.batches || []).find(bo => bo.id === b.id);
        return fullBatch && (fullBatch.branchId === examsSelectedBranchId || fullBatch.branchName?.toLowerCase() === examsSelectedBranchId.toLowerCase());
      });
      if (!matchesBranch) return false;
    }

    // Batch filter
    if (examsSelectedBatchId !== "all") {
      const matchesBatch = (e.assignedBatches || []).some(b => b.id === examsSelectedBatchId);
      if (!matchesBatch) return false;
    }

    // Type filter
    if (examsSelectedType !== "all" && e.purpose !== examsSelectedType) {
      return false;
    }

    // Status filter
    if (examsSelectedStatus !== "all" && e.status !== examsSelectedStatus) {
      return false;
    }

    // Date From
    if (examsDateFrom) {
      if (!e.scheduledStart) return false;
      const fromMs = new Date(`${examsDateFrom}T00:00:00`).getTime();
      const examMs = new Date(e.scheduledStart).getTime();
      if (examMs < fromMs) return false;
    }

    // Date To
    if (examsDateTo) {
      if (!e.scheduledStart) return false;
      const toMs = new Date(`${examsDateTo}T23:59:59.999`).getTime();
      const examMs = new Date(e.scheduledStart).getTime();
      if (examMs > toMs) return false;
    }

    return true;
  });

  // Calculate 4 KPIs matching page.tsx:615-631
  const conducted = filtered.filter(e => e.status !== "draft" && e.status !== "scheduled");
  const totalConducted = conducted.length;
  const avgAppearance = totalConducted > 0
    ? Math.round(conducted.reduce((s, e) => s + (e.appearanceRate || 0), 0) / totalConducted)
    : 0;
  const withScores = conducted.filter(e => (e.averageScore || 0) > 0);
  const avgScore = withScores.length > 0
    ? (Math.round((withScores.reduce((s, e) => s + e.averageScore, 0) / withScores.length) * 10) / 10).toFixed(1)
    : "0";
  const pending = filtered.filter(e =>
    e.status === "completed" || e.status === "grading" || e.status === "in_progress"
  ).length;

  // Update KPI Cards & Subtitle
  const countBadge = document.getElementById("exams-count-badge");
  if (countBadge) countBadge.textContent = `(${filtered.length} exams)`;

  const kpiCond = document.getElementById("exams-kpi-conducted");
  if (kpiCond) kpiCond.textContent = totalConducted;

  const kpiApp = document.getElementById("exams-kpi-appearance");
  if (kpiApp) kpiApp.textContent = `${avgAppearance}%`;

  const kpiAvg = document.getElementById("exams-kpi-avgscore");
  if (kpiAvg) kpiAvg.textContent = `${avgScore}%`;

  const kpiPend = document.getElementById("exams-kpi-pending");
  if (kpiPend) kpiPend.textContent = pending;

  // Handle Empty State & Pagination
  const tableCard = document.getElementById("exams-table-card");
  const emptyState = document.getElementById("exams-empty-state");

  if (filtered.length === 0) {
    if (tableCard) tableCard.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  } else {
    if (tableCard) tableCard.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / EXAMS_PAGE_SIZE));
  if (examsCurrentPage > totalPages) examsCurrentPage = totalPages;
  if (examsCurrentPage < 1) examsCurrentPage = 1;

  const startIdx = (examsCurrentPage - 1) * EXAMS_PAGE_SIZE;
  const endIdx = Math.min(startIdx + EXAMS_PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(startIdx, endIdx);

  // Update Pagination Info
  const pageInfo = document.getElementById("exams-pagination-info");
  if (pageInfo) {
    pageInfo.innerHTML = `Showing <span class="font-mono font-medium text-gray-700">${startIdx + 1}</span> - <span class="font-mono font-medium text-gray-700">${endIdx}</span> of <span class="font-mono font-medium text-gray-700">${filtered.length}</span>`;
  }

  const curPageEl = document.getElementById("exams-current-page-display");
  if (curPageEl) curPageEl.textContent = examsCurrentPage;

  const totPageEl = document.getElementById("exams-total-pages-display");
  if (totPageEl) totPageEl.textContent = totalPages;

  const prevBtn = document.getElementById("exams-prev-page-btn");
  if (prevBtn) prevBtn.disabled = examsCurrentPage <= 1;

  const nextBtn = document.getElementById("exams-next-page-btn");
  if (nextBtn) nextBtn.disabled = examsCurrentPage >= totalPages;

  // Render Rows matching page.tsx:900-1025
  const tbody = document.getElementById("exams-table-tbody");
  if (!tbody) return;

  tbody.innerHTML = paginated.map(exam => {
    const statusInfo = getStatusBadge(exam.status);
    const dateFormatted = exam.scheduledStart
      ? new Date(exam.scheduledStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "—";

    const batchList = exam.assignedBatches || [];
    let batchesHtml = '<span class="text-muted text-xs">No batches</span>';
    if (batchList.length > 0) {
      const allNames = batchList.map(b => b.name).join(", ");
      const displayStr = batchList.length === 1 ? batchList[0].name : `${batchList[0].name} +${batchList.length - 1}`;
      batchesHtml = `<div class="block max-w-[200px] truncate text-muted text-xs" title="${allNames}">${displayStr}</div>`;
    }

    const rateColor = getAppearanceColor(exam.appearanceRate);

    return `
      <tr class="group border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer" onclick="openExamModal('${exam.id}')">
        <!-- Exam Title -->
        <td class="max-w-[260px] px-4 py-3.5">
          <a href="javascript:void(0)" onclick="openExamModal('${exam.id}')" class="block truncate font-medium text-gray-900 group-hover:text-primary">
            ${exam.title}
          </a>
          ${exam.omrEnabled ? `
            <span class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
              <i class="ph-duotone ph-scan text-xs"></i>
              OMR ${exam.omrProcessed ? '<i class="ph-fill ph-check-circle text-emerald-500 text-xs"></i>' : '<i class="ph-bold ph-clock text-amber-500 text-xs"></i>'}
            </span>
          ` : ''}
        </td>

        <!-- Date -->
        <td class="whitespace-nowrap px-4 py-3.5 text-muted text-sm">
          ${dateFormatted}
        </td>

        <!-- Type -->
        <td class="px-4 py-3.5">
          <span class="inline-flex rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
            ${formatPurpose(exam.purpose)}
          </span>
        </td>

        <!-- Batches -->
        <td class="px-4 py-3.5 align-middle">
          ${batchesHtml}
        </td>

        <!-- Appeared -->
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-900">
          ${exam.totalSubmissions}/${exam.totalAssigned}
        </td>

        <!-- Rate -->
        <td class="whitespace-nowrap px-4 py-3.5">
          <span class="font-mono text-sm font-semibold ${rateColor}">
            ${exam.totalAssigned > 0 ? `${exam.appearanceRate}%` : "—"}
          </span>
        </td>

        <!-- Avg Score -->
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm font-semibold text-gray-900">
          ${exam.averageScore > 0 ? `${exam.averageScore}%` : "—"}
        </td>

        <!-- Pass Rate -->
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-900">
          ${exam.passRate > 0 ? `${exam.passRate}%` : "—"}
        </td>

        <!-- Status -->
        <td class="px-4 py-3.5">
          <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </td>

        <!-- Action Arrow -->
        <td class="px-4 py-3.5 text-right">
          <button type="button" onclick="event.stopPropagation(); openFullExamAnalytics('${exam.id}')" title="Open Full Analytics Page" class="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100">
            <i class="ph-bold ph-arrow-right text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Alias for initial app load
function renderExamsTable() {
  renderExamsView();
}

// ── Section 4: Compare Matrix ────────────────────────────────────────

function renderCompareMatrix() {
  renderCompareView();
}

// ── Section 5: Branches ──────────────────────────────────────────────

function renderBranches() {
  const tbody = document.getElementById("branches-table-tbody");
  if (!tbody) return;

  const branches = APP_DATA.branches || [];

  tbody.innerHTML = branches.map(b => `
    <tr class="border-b border-border hover:bg-slate-50 transition-colors">
      <td class="py-3 px-4 font-semibold text-slate-900">${b.name}</td>
      <td class="py-3 px-4 font-mono text-xs text-muted">${b.code || 'HYD'}</td>
      <td class="py-3 px-4 font-mono text-slate-800">${Number(b.studentCount || b.students).toLocaleString()}</td>
      <td class="py-3 px-4 font-mono text-slate-800">${b.batchCount || 4}</td>
      <td class="py-3 px-4 font-mono font-bold text-primary">${b.avgScore || b.percentile}%</td>
      <td class="py-3 px-4 text-right">
        <button onclick="onScopeChange('${b.id}')" class="px-3 py-1 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5">
          Scope View &rarr;
        </button>
      </td>
    </tr>
  `);
}

// ── Section 6: DPP Adherence ─────────────────────────────────────────

function renderDPP() {
  renderDppView();
}

// ── Section 7: Cohort Comparison ─────────────────────────────────────

function renderCohorts() {
  renderCohortsView();
}

// ── Modals: Student Dossier, Batch Hub, Ask Analytics ─────────────────

function openStudentModal(studentId) {
  if (studentId) {
    currentActiveStudentId = studentId;
  }
  const modal = document.getElementById("student-modal");
  if (!modal) return;

  // Resolve student details
  let name = "Bhagam Khyathi";
  let rollNo = "225144";
  let batch = "SR MPC";
  let branch = "Madhapur";
  let pct = 98.4;
  let rank = 1;
  let avgScore = 262;

  const found = (APP_DATA.students || []).find(s => s.studentId === currentActiveStudentId);
  if (found) {
    name = found.name;
    rollNo = found.rollNo || "225144";
    batch = found.batch || "SR MPC";
    branch = found.branch || "Madhapur";
    pct = found.percentile || 98.4;
    rank = found.rank || 1;
    avgScore = found.avgScore || 262;
  } else if (APP_DATA.studentDossier) {
    name = APP_DATA.studentDossier.name;
    rollNo = APP_DATA.studentDossier.rollNo;
    batch = APP_DATA.studentDossier.batch;
    branch = APP_DATA.studentDossier.branch;
  }

  // Update modal avatar initials
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById("modal-student-avatar");
  if (avatarEl) avatarEl.textContent = initials;

  document.getElementById("modal-student-name").textContent = name;
  document.getElementById("modal-student-meta").textContent = `Roll: ${rollNo} | ${batch} | ${branch}`;
  document.getElementById("dos-pct").textContent = `${pct}%`;
  document.getElementById("dos-rank").textContent = `#${rank} / 271`;
  document.getElementById("dos-score").textContent = `${avgScore} / 300`;
  document.getElementById("dos-streak").textContent = `19 Days`;

  const dos = APP_DATA.studentDossier || {};
  const subjectsContainer = document.getElementById("dos-subjects");
  if (subjectsContainer) {
    subjectsContainer.innerHTML = (dos.subjectBreakdown || []).map(s => `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-border text-xs">
        <span class="font-medium text-slate-900">${s.subject}</span>
        <div class="flex items-center gap-3">
          <span class="font-mono font-bold text-slate-800">${s.score}/${s.total} (${s.pct}%)</span>
          <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">${s.status}</span>
        </div>
      </div>
    `).join("");
  }

  const leaksContainer = document.getElementById("dos-leaks");
  if (leaksContainer) {
    leaksContainer.innerHTML = (dos.weakTopics || []).map(w => `
      <div class="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs">
        <span class="font-bold text-red-800">${w.chapter}: </span>
        <span class="text-red-900">${w.topic}</span>
        <span class="ml-2 font-mono text-danger font-semibold">(-${w.marksLost} marks)</span>
      </div>
    `).join("");
  }

  modal.classList.remove("hidden");
}

function closeStudentModal() {
  document.getElementById("student-modal")?.classList.add("hidden");
}

function openFullStudentAnalytics(studentId) {
  if (studentId) {
    currentActiveStudentId = studentId;
  }
  closeStudentModal();
  switchView('student-detail');
}

function navigateToStudentDeepDive(key) {
  if (!key || key === 'detail' || key === 'student-detail') {
    switchView('student-detail');
  } else {
    const target = key.startsWith('student-') ? key : `student-${key}`;
    switchView(target);
  }
}

// ── Student Detail Controller & Diagnostics ───────────────────────────

function getStudentAnalyticsData(studentId) {
  const primary = APP_DATA.studentAnalytics?.['s-101'] || {};
  if (APP_DATA.studentAnalytics && APP_DATA.studentAnalytics[studentId] && studentId === 's-101') {
    return APP_DATA.studentAnalytics[studentId];
  }

  // Fallback dynamic generator tailored to ANY selected student with FULL rich dummy data
  const student = (APP_DATA.students || []).find(s => s.studentId === studentId);
  const name = student ? student.name : (studentId === 's-101' ? "Bhagam Khyathi" : "JAY RAJ VAISHNAV");
  const rollNo = student ? (student.rollNo || "225144") : "225144";
  const batch = student ? (student.batch || "SR MPC") : "SR MPC";
  const branch = student ? (student.branch || "Madhapur") : "Madhapur";
  const avgPct = student ? (student.percentile || 96.2) : 98.4;
  const avgScore = student ? (student.avgScore ? Math.round((student.avgScore / 300) * 100) : 87) : 87;
  const rank = student ? (student.rank || 1) : 1;

  // Clone primary deep dive datasets so NO deep dive is ever empty
  return {
    studentId: studentId || "s-101",
    profile: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.') || 'student'}@excellencia.edu`,
      batchId: "b-srmpc-madhapur",
      batchName: batch,
      branchName: branch,
      targetExam: "JEE Mains",
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
    scoreTrajectory: primary.scoreTrajectory || [],
    subjectWise: primary.subjectWise || [],
    eri: primary.eri || { eriValue: 88.4, activeCells: 142, masteredCells: 118, totalCells: 160 },
    velocity: primary.velocity || { deltaWeek: 2.4 },
    skillMap: primary.skillMap || { current: [] },
    errorPatterns: primary.errorPatterns || { totalErrors: 42, byType: [], trend: { direction: "improving" } },
    weakAreas: primary.weakAreas || { subjects: [], totalErrors: 42, totalUnresolved: 11 },
    rwl: primary.rwl || { total: 3, questions: [] },
    recentExams: primary.recentExams || [],
    assignmentData: primary.assignmentData || [],

    // FULL DUMMY DATA FOR ALL 9 DEEP DIVES
    eriDetails: primary.eriDetails || {
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
    heatmapData: primary.heatmapData || {
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
    predictivePathData: primary.predictivePathData || {
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
        { label: "Mid-Term", score: 258, predicted: false },
        { label: "Part Test", score: 262, predicted: false },
        { label: "Grand Mock 1", score: 265, predicted: false },
        { label: "Grand Mock 2", score: 268, predicted: false },
        { label: "Pre-Final", score: 262, predicted: false },
        { label: "Final Mock", score: 276, predicted: false },
        { label: "Session 1 Pred", score: 278, predicted: true, upper: 286, lower: 270 },
        { label: "Session 2 Pred", score: 284, predicted: true, upper: 292, lower: 276 }
      ],
      drivers: [
        { name: "Mathematics Velocity", impact: "+12 pts", detail: "High calculus accuracy with near-zero negative marks in numericals." },
        { name: "DPP Consistency Streak", impact: "+8 pts", detail: "19-day active streak in solving high-difficulty revision problem sets." },
        { name: "Physics Rotation Drag", impact: "-6 pts", detail: "Persistent marks lost on rolling mechanics caps upside above 285." }
      ]
    },
    rankPredictorData: primary.rankPredictorData || {
      currentPercentile: 98.4,
      predictedRankMin: 1450,
      predictedRankMax: 2100,
      baseScore: 262,
      colleges: [
        { name: "IIT Madras", branch: "Electrical Engineering", category: "Target", closingRank: 1850, chancePct: 82 },
        { name: "NIT Trichy", branch: "Computer Science & Eng", category: "Safe", closingRank: 3200, chancePct: 96 },
        { name: "BITS Pilani", branch: "Computer Science", category: "Safe", closingRank: 2800, chancePct: 94 },
        { name: "IIIT Hyderabad", branch: "Computer Science", category: "Reach", closingRank: 1200, chancePct: 65 },
        { name: "NIT Surathkal", branch: "Artificial Intelligence", category: "Safe", closingRank: 2950, chancePct: 95 },
        { name: "IIT Bombay", branch: "Mechanical Engineering", category: "Reach", closingRank: 1100, chancePct: 58 }
      ],
      rankHistory: [
        { exam: "Mock 1", rank: 4850 },
        { exam: "Mock 2", rank: 3900 },
        { exam: "Mock 3", rank: 3100 },
        { exam: "Mid-Term", rank: 2650 },
        { exam: "Grand Mock 1", rank: 2150 },
        { exam: "Grand Mock 2", rank: 1950 },
        { exam: "Pre-Final", rank: 2100 },
        { exam: "Final Mock", rank: 1650 }
      ]
    },
    practiceData: primary.practiceData || {
      kpis: { totalQuestions: 1480, accuracyPct: 88.4, streakDays: 19, totalHours: 48.5 },
      activityDays: [
        { date: "2026-03-05", answered: 45, correct: 41, minutes: 65, type: "DPP" },
        { date: "2026-03-04", answered: 50, correct: 46, minutes: 75, type: "Chapter Test" },
        { date: "2026-03-03", answered: 30, correct: 28, minutes: 40, type: "Custom Quiz" },
        { date: "2026-03-02", answered: 60, correct: 54, minutes: 90, type: "Adaptive Drill" },
        { date: "2026-03-01", answered: 40, correct: 36, minutes: 55, type: "DPP" },
        { date: "2026-02-28", answered: 55, correct: 48, minutes: 80, type: "Chapter Test" },
        { date: "2026-02-27", answered: 35, correct: 32, minutes: 50, type: "Custom Quiz" },
        { date: "2026-02-26", answered: 45, correct: 40, minutes: 60, type: "DPP" }
      ],
      typeBreakdown: [
        { type: "Daily Practice Problems (DPP)", count: 620, accuracy: 89.5 },
        { type: "Chapter-wise Tests", count: 410, accuracy: 86.8 },
        { type: "Adaptive Drills", count: 280, accuracy: 85.0 },
        { type: "Custom Topic Quizzes", count: 170, accuracy: 94.2 }
      ],
      errorCorrection: { totalFlagged: 92, resolved: 71, pending: 21, avgResolutionDays: 3.4 }
    },
    successGapData: primary.successGapData || {
      spreadDelta: "+26.8%",
      strongestSubject: "Mathematics (92.5%)",
      weakestSubject: "Physics (65.7%)",
      strengths: [
        { topic: "Definite Integrals", subject: "Mathematics", accuracy: 95.8, attempts: 74, status: "Mastered" },
        { topic: "Chemical Kinetics", subject: "Chemistry", accuracy: 95.3, attempts: 65, status: "Mastered" },
        { topic: "Coordinate Geometry", subject: "Mathematics", accuracy: 93.2, attempts: 74, status: "Mastered" },
        { topic: "Modern Physics", subject: "Physics", accuracy: 92.8, attempts: 81, status: "Mastered" },
        { topic: "Electrochemistry", subject: "Chemistry", accuracy: 91.5, attempts: 62, status: "Mastered" }
      ],
      weaknesses: [
        { topic: "Rotational Dynamics — Rolling", subject: "Physics", accuracy: 42.0, attempts: 62, marksLost: 16 },
        { topic: "Wave Optics — Brewster & Thin Film", subject: "Physics", accuracy: 48.5, attempts: 48, marksLost: 12 },
        { topic: "Conditional Probability & Bayes", subject: "Mathematics", accuracy: 55.0, attempts: 54, marksLost: 8 },
        { topic: "Ionic Equilibrium — Buffers", subject: "Chemistry", accuracy: 60.0, attempts: 50, marksLost: 8 },
        { topic: "EMI — Eddy Currents & LC", subject: "Physics", accuracy: 62.0, attempts: 54, marksLost: 6 }
      ],
      actionableAdvice: "Physics Mechanics accounts for 58% of all lost marks. Boosting Rotation and Wave Optics from 45% to 75% delivers an immediate +24 marks gain."
    },
    weaknessImprovementData: primary.weaknessImprovementData || {
      trackedCount: 6,
      recoveredCount: 3,
      inProgressCount: 2,
      needsFocusCount: 1,
      topics: [
        { topic: "Calculus — Integration by Parts", subject: "Mathematics", baseline: 58, current: 92, delta: "+34%", status: "Recovered", daysTracked: 30, testsTaken: 6 },
        { topic: "Organic — Electrophilic Addition", subject: "Chemistry", baseline: 62, current: 88, delta: "+26%", status: "Recovered", daysTracked: 28, testsTaken: 5 },
        { topic: "Electrodynamics — Gauss Law", subject: "Physics", baseline: 65, current: 86, delta: "+21%", status: "Recovered", daysTracked: 25, testsTaken: 4 },
        { topic: "EMI — Mutual Inductance", subject: "Physics", baseline: 52, current: 74, delta: "+22%", status: "In Progress", daysTracked: 18, testsTaken: 4 },
        { topic: "Probability — Bayes Theorem", subject: "Mathematics", baseline: 48, current: 68, delta: "+20%", status: "In Progress", daysTracked: 14, testsTaken: 3 },
        { topic: "Rotational Motion — Pure Rolling", subject: "Physics", baseline: 38, current: 44, delta: "+6%", status: "Needs Focus", daysTracked: 30, testsTaken: 6 }
      ]
    },
    timeVsPerformanceData: primary.timeVsPerformanceData || {
      summary: { avgTimePerQuestion: "68 seconds", fastestSubject: "Chemistry (48s)", slowestSubject: "Mathematics (82s)", optimalAccuracyBand: "60-75s pace" },
      sessions: [
        { label: "Definite Integrals", subject: "Mathematics", timeSeconds: 84, accuracy: 94, quadrant: "High Accuracy, Deliberate" },
        { label: "Coordinate Geometry", subject: "Mathematics", timeSeconds: 78, accuracy: 91, quadrant: "Sweet Spot" },
        { label: "Chemical Kinetics", subject: "Chemistry", timeSeconds: 46, accuracy: 96, quadrant: "Sweet Spot" },
        { label: "Organic Mechanisms", subject: "Chemistry", timeSeconds: 52, accuracy: 89, quadrant: "Sweet Spot" },
        { label: "Modern Physics", subject: "Physics", timeSeconds: 55, accuracy: 93, quadrant: "Sweet Spot" },
        { label: "Electrodynamics", subject: "Physics", timeSeconds: 74, accuracy: 88, quadrant: "High Accuracy, Deliberate" },
        { label: "Thermodynamics", subject: "Physics", timeSeconds: 70, accuracy: 82, quadrant: "High Accuracy, Deliberate" },
        { label: "Probability & Bayes", subject: "Mathematics", timeSeconds: 96, accuracy: 68, quadrant: "Low Accuracy, Slow (Concept Trap)" },
        { label: "Wave Optics", subject: "Physics", timeSeconds: 62, accuracy: 52, quadrant: "Low Accuracy, Fast (Rushed)" },
        { label: "Rotational Dynamics", subject: "Physics", timeSeconds: 105, accuracy: 42, quadrant: "Low Accuracy, Slow (Concept Trap)" }
      ],
      subjectPacing: [
        { subject: "Chemistry", avgSeconds: 48, targetSeconds: 50, efficiency: "Fast & Accurate" },
        { subject: "Physics", avgSeconds: 72, targetSeconds: 70, efficiency: "On Track" },
        { subject: "Mathematics", avgSeconds: 84, targetSeconds: 80, efficiency: "Slight Time Pressure" }
      ]
    },
    attendanceImpactData: primary.attendanceImpactData || {
      studentAttendancePct: 98.2,
      rankInBatch: 1,
      batchAvgAttendance: 89.4,
      totalClasses: 180,
      attendedClasses: 177,
      absentClasses: 3,
      correlationInsight: "Students with >95% attendance average 18.4% higher marks on full mocks compared to the batch median.",
      scatterPoints: [
        { attendance: 98, score: 92, name: name, isTarget: true },
        { attendance: 96, score: 88, name: "Student 2", isTarget: false },
        { attendance: 95, score: 85, name: "Student 3", isTarget: false },
        { attendance: 92, score: 81, name: "Student 4", isTarget: false },
        { attendance: 90, score: 76, name: "Student 5", isTarget: false },
        { attendance: 88, score: 72, name: "Student 6", isTarget: false },
        { attendance: 85, score: 68, name: "Student 7", isTarget: false },
        { attendance: 82, score: 64, name: "Student 8", isTarget: false },
        { attendance: 78, score: 58, name: "Student 9", isTarget: false },
        { attendance: 74, score: 51, name: "Student 10", isTarget: false },
        { attendance: 68, score: 42, name: "Student 11", isTarget: false }
      ],
      absences: [
        { date: "2026-01-14", reason: "Medical Leave (Fever)", status: "Excused" },
        { date: "2026-01-15", reason: "Medical Leave (Fever)", status: "Excused" },
        { date: "2026-02-10", reason: "State Science Olympiad", status: "Excused" }
      ]
    }
  };
}

function ordinal(n) {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderStudentDetail(studentId) {
  const data = getStudentAnalyticsData(studentId);
  if (!data) return;

  // Header
  const nameEl = document.getElementById("student-detail-name");
  if (nameEl) nameEl.textContent = data.profile.name;
  const examEl = document.getElementById("student-detail-exam");
  if (examEl) examEl.textContent = data.profile.targetExam || "JEE Mains";
  const rollEl = document.getElementById("student-detail-roll");
  if (rollEl) rollEl.textContent = data.profile.rollNumber || "225144";

  // Rank Banner
  const bannerRank = document.getElementById("banner-batch-rank");
  if (bannerRank) bannerRank.textContent = data.overview.batchRank ? `${ordinal(data.overview.batchRank)} / ${data.overview.batchSize || 78}` : "—";
  const bannerPct = document.getElementById("banner-batch-pct");
  if (bannerPct) bannerPct.textContent = data.overview.averagePercentile ? ordinal(Math.round(data.overview.averagePercentile)) : "—";
  const bannerAvg = document.getElementById("banner-avg-score");
  if (bannerAvg) bannerAvg.textContent = `${Math.round(data.overview.averageScore)}%`;
  const bannerHigh = document.getElementById("banner-highest-score");
  if (bannerHigh) bannerHigh.textContent = `${Math.round(data.overview.highestScore)}%`;

  // 4 Overview KPI Cards
  const cardRank = document.getElementById("card-batch-rank");
  if (cardRank) cardRank.textContent = data.overview.batchRank ? `#${data.overview.batchRank}` : "—";
  const cardExams = document.getElementById("card-total-exams");
  if (cardExams) cardExams.textContent = data.overview.totalExams || "26";
  const cardAvg = document.getElementById("card-avg-score");
  if (cardAvg) cardAvg.textContent = `${data.overview.averageScore}%`;
  const cardConsistency = document.getElementById("card-consistency");
  if (cardConsistency) cardConsistency.textContent = data.overview.consistencyScore != null ? data.overview.consistencyScore : "—";

  // Exam Readiness (ERI)
  const eriVal = data.eri?.eriValue || 88;
  const eriScoreEl = document.getElementById("eri-score");
  if (eriScoreEl) eriScoreEl.textContent = Math.round(eriVal);
  const eriLevelEl = document.getElementById("eri-level");
  if (eriLevelEl) {
    const level = eriVal >= 80 ? "Titan" : eriVal >= 60 ? "Challenger" : eriVal >= 40 ? "Contender" : "Scholar";
    eriLevelEl.textContent = level;
    eriLevelEl.className = `text-xs font-semibold ${eriVal >= 80 ? 'text-emerald-600' : eriVal >= 60 ? 'text-blue-600' : 'text-amber-600'}`;
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
}

function setStudentTimeRange(range) {
  currentStudentTimeRange = range;
  document.querySelectorAll(".student-range-btn").forEach(btn => {
    btn.className = "student-range-btn rounded-lg px-2.5 py-1 transition-colors text-muted hover:bg-primary/5 hover:text-foreground";
  });
  const activeBtn = document.getElementById(`student-range-${range}`);
  if (activeBtn) {
    activeBtn.className = "student-range-btn rounded-lg px-2.5 py-1 transition-colors bg-primary/10 text-primary";
  }
  currentStudentExamsPage = 1;
  const data = getStudentAnalyticsData(currentActiveStudentId);
  renderStudentExamsTable(data.recentExams || []);
}

function changeStudentExamsPage(delta) {
  currentStudentExamsPage += delta;
  const data = getStudentAnalyticsData(currentActiveStudentId);
  renderStudentExamsTable(data.recentExams || []);
}

function refreshStudentAnalytics() {
  const icon = document.getElementById("student-refresh-icon");
  const text = document.getElementById("student-refresh-text");
  if (icon) icon.classList.add("animate-spin");
  if (text) text.textContent = "Refreshing…";

  setTimeout(() => {
    if (icon) icon.classList.remove("animate-spin");
    if (text) text.textContent = "Refresh";
    renderStudentDetail(currentActiveStudentId);
  }, 500);
}

function renderStudentTrajectoryChart(trajectory) {
  const canvas = document.getElementById("studentTrajectoryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts.studentTrajectoryChart) charts.studentTrajectoryChart.destroy();

  const recents = trajectory.slice(-10);
  const labels = recents.map(t => t.examTitle.length > 14 ? t.examTitle.slice(0, 14) + "…" : t.examTitle);
  const scores = recents.map(t => Math.round(t.percentage));
  const percentiles = recents.map(t => Math.round(t.percentile || 0));

  const subtitle = document.getElementById("student-trajectory-subtitle");
  if (subtitle) {
    subtitle.textContent = `Last ${recents.length} of ${trajectory.length || recents.length} exams · score % and percentile`;
  }

  charts.studentTrajectoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: "Score %",
          data: scores,
          backgroundColor: "#2563EB",
          borderRadius: 6,
          maxBarThickness: 36
        },
        {
          label: "Percentile",
          data: percentiles,
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderRadius: 6,
          maxBarThickness: 36
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        y: {
          min: 0,
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
}

function renderStudentSubjectBarChart(subjectWise) {
  const canvas = document.getElementById("studentSubjectBarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts.studentSubjectBarChart) charts.studentSubjectBarChart.destroy();

  const labels = subjectWise.map(s => s.subjectName);
  const accuracies = subjectWise.map(s => Math.round(s.accuracy));
  const bgColors = accuracies.map(a => 
    a >= 85 ? "#10B981" : a >= 70 ? "#2563EB" : a >= 50 ? "#F59E0B" : "#EF4444"
  );

  charts.studentSubjectBarChart = new Chart(ctx, {
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
}

function renderStudentSkillRadarChart(skills) {
  const canvas = document.getElementById("studentSkillRadarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts.studentSkillRadarChart) charts.studentSkillRadarChart.destroy();

  const slice = (skills || []).slice(0, 8);
  const labels = slice.map(s => s.topicName.length > 15 ? s.topicName.slice(0, 15) + "…" : s.topicName);
  const masteries = slice.map(s => s.mastery);

  charts.studentSkillRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels.length ? labels : ["Mechanics", "Calculus", "Thermodynamics", "Organic", "Electrodynamics", "Inorganic"],
      datasets: [{
        label: "Topic Mastery",
        data: masteries.length ? masteries : [85, 92, 78, 88, 90, 82],
        backgroundColor: "rgba(139, 92, 246, 0.2)",
        borderColor: "#8B5CF6",
        pointBackgroundColor: "#8B5CF6",
        borderWidth: 2,
        pointRadius: 3
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
          ticks: { display: false, stepSize: 20 },
          grid: { color: "#E2E8F0" },
          angleLines: { color: "#E2E8F0" },
          pointLabels: { font: { size: 10 } }
        }
      }
    }
  });
}

function renderStudentErrorPatternChart(errorPatterns) {
  const canvas = document.getElementById("studentErrorPatternChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts.studentErrorPatternChart) charts.studentErrorPatternChart.destroy();

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

  charts.studentErrorPatternChart = new Chart(ctx, {
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
}

function renderStudentCumMasteryChart(skills) {
  const canvas = document.getElementById("studentCumMasteryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts.studentCumMasteryChart) charts.studentCumMasteryChart.destroy();

  // Aggregate by subject
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

  charts.studentCumMasteryChart = new Chart(ctx, {
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
}

function renderStudentExamsTable(exams) {
  const tbody = document.getElementById("student-exams-table-body");
  if (!tbody) return;

  // Filter by currentStudentTimeRange
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
        <tr class="group border-b border-border/40 hover:bg-primary/5 transition-colors cursor-pointer" onclick="openStudentTestAnalysis(currentActiveStudentId, '${e.examId || 'ex-301'}')">
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

function renderStudentAssignments(assignments) {
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

function renderStudentErrorOverview(weakAreas, errorPatterns, rwl) {
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
  const donutCanvas = document.getElementById("studentErrorDonutChart");
  if (donutCanvas) {
    const ctx = donutCanvas.getContext("2d");
    if (charts.studentErrorDonutChart) charts.studentErrorDonutChart.destroy();

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

    charts.studentErrorDonutChart = new Chart(ctx, {
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
  }

  // Closure Stacked Bar Chart
  const closureCanvas = document.getElementById("studentSubjectClosureChart");
  if (closureCanvas) {
    const ctx = closureCanvas.getContext("2d");
    if (charts.studentSubjectClosureChart) charts.studentSubjectClosureChart.destroy();

    const subjects = (weakAreas?.subjects || []).map(s => s.subjectName);
    const resolvedData = (weakAreas?.subjects || []).map(s => Math.max(0, s.errorCount - s.unresolvedCount));
    const unresolvedData = (weakAreas?.subjects || []).map(s => s.unresolvedCount);

    charts.studentSubjectClosureChart = new Chart(ctx, {
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
  }
}

function renderStudentWeakAreas(weakAreas) {
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

function renderStudentRwl(rwl) {
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


function openBatchModal(batchId) {
  try {
    const modal = document.getElementById("batch-modal");
    if (!modal) return;
    
    if (batchId) {
      currentActiveBatchId = batchId;
    }
    
    // Always show modal first
    modal.classList.remove("hidden");

    const b = APP_DATA.batchAnalytics || {};
    const allBatches = APP_DATA.batches || [];
    const found = allBatches.find(x => x.id === currentActiveBatchId);
    const titleName = found ? `${found.name} (${found.branchName})` : (b.batchName || "SR MPC (Madhapur)");
    const targetExam = found ? found.targetExam : (b.targetExam || "JEE Mains");
    const studentCount = found ? found.studentCount : (b.studentCount || 78);

    const titleEl = document.getElementById("modal-batch-title");
    if (titleEl) titleEl.textContent = `Batch Hub — ${titleName}`;
    const metaEl = document.getElementById("modal-batch-meta");
    if (metaEl) metaEl.textContent = `${studentCount} Students | Target: ${targetExam} | Branch: ${found?.branchName || "Madhapur"}`;

    // Bell curve preview
    const ctx = document.getElementById("bellCurveChart")?.getContext("2d");
    if (ctx) {
      if (charts.bellCurveChart) charts.bellCurveChart.destroy();
      const buckets = b.bellCurve?.buckets || [
        { range: "0-20", count: 1 },
        { range: "21-40", count: 4 },
        { range: "41-60", count: 18 },
        { range: "61-80", count: 36 },
        { range: "81-100", count: 19 }
      ];
      charts.bellCurveChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: buckets.map(bk => bk.range),
          datasets: [{
            label: 'Student Count',
            data: buckets.map(bk => bk.count),
            backgroundColor: '#2563EB',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    // Box plot summary (defensive check for array)
    const boxplotContainer = document.getElementById("batch-boxplot");
    if (boxplotContainer) {
      const boxplotList = Array.isArray(b.boxPlot) ? b.boxPlot : (b.boxPlot?.subjects || [
        { name: "Physics", subject: "Physics", min: 28, q1: 52, median: 68, q3: 82, max: 96 },
        { name: "Chemistry", subject: "Chemistry", min: 34, q1: 58, median: 74, q3: 88, max: 98 },
        { name: "Mathematics", subject: "Mathematics", min: 22, q1: 48, median: 64, q3: 78, max: 94 }
      ]);
      boxplotContainer.innerHTML = boxplotList.map(bp => `
        <div class="p-2 bg-slate-50 border border-border rounded-lg text-xs flex justify-between">
          <span class="font-medium text-slate-900">${bp.name || bp.subject}</span>
          <span class="font-mono text-muted">Median: ${bp.median}% | Q1-Q3: ${bp.q1}%-${bp.q3}% | Max: ${bp.max}%</span>
        </div>
      `).join("");
    }

    // At risk (defensive check for array)
    const atRiskContainer = document.getElementById("batch-atrisk-list");
    if (atRiskContainer) {
      const atRiskList = Array.isArray(b.atRiskStudents) ? b.atRiskStudents : [];
      atRiskContainer.innerHTML = atRiskList.map(s => `
        <div class="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-center justify-between">
          <div>
            <span class="font-bold text-rose-900">${s.name}</span>
            <span class="text-rose-700 ml-2">Roll: ${s.rollNo}</span>
          </div>
          <span class="font-mono text-danger font-bold">${s.currentPercentile || s.percentile}%ile</span>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error in openBatchModal:", err);
  }
}

function closeBatchModal() {
  document.getElementById("batch-modal")?.classList.add("hidden");
}

function openFullBatchAnalytics(batchId) {
  closeBatchModal();
  const targetId = batchId || currentActiveBatchId || 'b-srmpc-madhapur';
  currentActiveBatchId = targetId;
  switchView('batch-detail');
}

// ── Full Batch Detail View Logic ─────────────────────────────────────

function switchBatchTab(tabName) {
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

function renderBatchDetail(batchId) {
  const b = APP_DATA.batchAnalytics || {};
  const allBatches = APP_DATA.batches || [];
  const foundBatch = allBatches.find(x => x.id === batchId);

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

  // Live KPI Summary Cards (BatchSummaryCards)
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

  // Render Sub-tab 1 (Overview)
  renderBatchScoreDistribution();
  renderBatchSubjectRadar();
  renderBloomsMatrix();
  renderWeakestTopicsTable();
  renderBatchStudentsLeaderboard();
  renderBatchTierSegmentation();
  renderBatchAtRiskOverview();
  renderStudentStandingCard(selectedLookupStudentId);

  // Set default tab
  switchBatchTab(currentBatchActiveTab || 'overview');
}

// ── Overview Tab: Score Distribution Bar Chart ────────────────────────
function renderBatchScoreDistribution() {
  const ctx = document.getElementById("batchScoreDistChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.batchScoreDistChart) charts.batchScoreDistChart.destroy();

  const dist = APP_DATA.batchAnalytics?.scoreDistribution || {
    "0-10": 0, "10-20": 1, "20-30": 2, "30-40": 4, "40-50": 8,
    "50-60": 14, "60-70": 22, "70-80": 18, "80-90": 7, "90-100": 2
  };
  const labels = Object.keys(dist);
  const counts = Object.values(dist);

  charts.batchScoreDistChart = new Chart(ctx, {
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
}

// ── Overview Tab: Subject Performance Radar Chart ────────────────────
function renderBatchSubjectRadar() {
  const ctx = document.getElementById("batchSubjectRadarChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.batchSubjectRadarChart) charts.batchSubjectRadarChart.destroy();

  const subjects = APP_DATA.batchAnalytics?.subjects || [
    { name: "Physics", accuracy: 64 },
    { name: "Chemistry", accuracy: 72 },
    { name: "Mathematics", accuracy: 68 }
  ];

  charts.batchSubjectRadarChart = new Chart(ctx, {
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
}

// ── Overview Tab: Topic x Bloom's Taxonomy Matrix ────────────────────
function cellColorClass(accuracy, attempts) {
  if (!attempts || attempts === 0) return "bg-slate-50 text-slate-400";
  if (accuracy >= 80) return "bg-emerald-100 text-emerald-800 font-bold";
  if (accuracy >= 65) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (accuracy >= 50) return "bg-amber-100 text-amber-800 font-semibold";
  if (accuracy >= 35) return "bg-amber-50 text-amber-700 font-medium";
  return "bg-red-100 text-red-700 font-bold";
}

function filterBloomsSubject(subjectId) {
  currentBloomsSubjectFilter = subjectId;
  renderBloomsMatrix();
}

function renderBloomsMatrix() {
  const matrix = APP_DATA.batchAnalytics?.bloomsMatrix;
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

// ── Overview Tab: Weakest Topics Table ────────────────────────────────
function renderWeakestTopicsTable() {
  const tbody = document.getElementById("batch-weakest-topics-tbody");
  if (!tbody) return;
  const topics = APP_DATA.batchAnalytics?.topicPerformance || [];

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

// ── Overview Tab: Student Leaderboard ─────────────────────────────────
function sortBatchStudents(field) {
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

function renderBatchStudentsLeaderboard() {
  const tbody = document.getElementById("batch-students-roster-tbody");
  if (!tbody) return;

  const roster = [...(APP_DATA.batchAnalytics?.studentRanking || [])];

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

// ── Overview Tab: Tier Segmentation Panel (Top/Middle/Bottom) ─────────
function renderBatchTierSegmentation() {
  const container = document.getElementById("batch-tier-segmentation-container");
  if (!container) return;

  const tiers = APP_DATA.batchAnalytics?.tierSegmentation || {};

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

// ── Overview Tab: At-Risk Students List ───────────────────────────────
function renderBatchAtRiskOverview() {
  const container = document.getElementById("batch-atrisk-overview-list");
  if (!container) return;
  const list = APP_DATA.batchAnalytics?.atRiskStudents || [];

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

// ── Overview Tab: Student-vs-Batch Lookup ─────────────────────────────
function onStudentLookupInput(q) {
  const resultsContainer = document.getElementById("batch-student-lookup-results");
  if (!resultsContainer) return;

  const query = (q || "").toLowerCase().trim();
  if (query.length < 2) {
    resultsContainer.classList.add("hidden");
    return;
  }

  const roster = APP_DATA.batchAnalytics?.studentRanking || [];
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

function selectStudentLookup(studentId) {
  selectedLookupStudentId = studentId;
  const input = document.getElementById("batch-student-lookup-input");
  const results = document.getElementById("batch-student-lookup-results");
  if (results) results.classList.add("hidden");
  
  const student = (APP_DATA.batchAnalytics?.studentRanking || []).find(s => s.studentId === studentId);
  if (input && student) input.value = student.name;

  renderStudentStandingCard(studentId);
}

function renderStudentStandingCard(studentId) {
  const card = document.getElementById("batch-student-standing-card");
  if (!card) return;

  const roster = APP_DATA.batchAnalytics?.studentRanking || [];
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

// ── Sub-Tab 2: Bell Curve ─────────────────────────────────────────────
function renderTabBellCurve() {
  const ctx = document.getElementById("tabBellCurveCanvas")?.getContext("2d");
  if (!ctx) return;
  if (charts.tabBellCurveCanvas) charts.tabBellCurveCanvas.destroy();

  const bell = APP_DATA.batchAnalytics?.bellCurve || {};
  const buckets = bell.buckets || [];

  charts.tabBellCurveCanvas = new Chart(ctx, {
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
}

// ── Sub-Tab 3: Box Plot ───────────────────────────────────────────────
function renderTabBoxPlot() {
  const container = document.getElementById("tab-boxplot-list");
  if (!container) return;

  const b = APP_DATA.batchAnalytics || {};
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

// ── Sub-Tab 4: At-Risk Students ───────────────────────────────────────
function renderTabAtRisk() {
  const roster = document.getElementById("tab-atrisk-roster");
  if (!roster) return;
  const list = APP_DATA.batchAnalytics?.atRiskStudents || [];

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

// ── Sub-Tab 5: Attendance ─────────────────────────────────────────────
function renderTabAttendance() {
  const canvas = document.getElementById("tabAttendanceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (charts.tabAttendanceCanvas) charts.tabAttendanceCanvas.destroy();

  const b = APP_DATA.batchAnalytics || {};
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

  charts.tabAttendanceCanvas = new Chart(ctx, {
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
}

// 1. ERI (Exam Readiness Index)
function renderStudentEri(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const eri = data.eriDetails || {};

  const scoreEl = document.getElementById("eri-page-score");
  const scoreVal = Math.round(eri.eriScore || 88);
  if (scoreEl) scoreEl.textContent = scoreVal;
  const levelEl = document.getElementById("eri-page-level");
  if (levelEl) levelEl.textContent = scoreVal >= 85 ? "Titan" : scoreVal >= 70 ? "Advanced" : "Developing";
  const activeEl = document.getElementById("eri-page-active");
  if (activeEl) activeEl.textContent = eri.activeCells || 142;
  const masteredEl = document.getElementById("eri-page-mastered");
  if (masteredEl) masteredEl.textContent = eri.masteredCells || 118;
  const totalEl = document.getElementById("eri-page-total");
  if (totalEl) totalEl.textContent = eri.totalCells || 160;
  const d7El = document.getElementById("eri-page-7d");
  if (d7El) d7El.textContent = `+${eri.deltaWeek || 2.4}`;
  const d30El = document.getElementById("eri-page-30d");
  if (d30El) d30El.textContent = `+${eri.deltaMonth || 6.8}`;

  // Velocity Chart
  const canvas = document.getElementById("eriVelocityChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.eriVelocityChart) charts.eriVelocityChart.destroy();

    const points = eri.velocityPoints || [];
    charts.eriVelocityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.date),
        datasets: [{
          label: "ERI Trajectory",
          data: points.map(p => p.eriValue),
          borderColor: "#2563EB",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: "#2563EB"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ERI Score: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          y: { min: 60, max: 100, ticks: { font: { size: 10 } }, grid: { color: "#F1F5F9" } },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Subject Cards
  const subjContainer = document.getElementById("eri-subject-cards");
  if (subjContainer) {
    subjContainer.innerHTML = (eri.subjects || []).map(s => `
      <div class="rounded-xl border border-border p-3.5 bg-surface">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-semibold text-gray-900">${s.subjectName}</p>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Titan</span>
        </div>
        <p class="text-2xl font-bold font-mono text-emerald-600">${Math.round(s.eriValue)}</p>
        <div class="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-blue-600" style="width: ${Math.min(100, s.eriValue)}%"></div>
        </div>
        <p class="mt-2 text-[11px] text-muted">${s.masteredCells}/${s.totalCells} mastered · ${s.activeCells} active</p>
      </div>
    `).join("");
  }

  // Action Items
  const actionsContainer = document.getElementById("eri-action-items");
  if (actionsContainer) {
    actionsContainer.innerHTML = (eri.actionItems || []).map(a => {
      const borderClass = a.tint === 'red' ? 'border-red-200 bg-red-50/60' : a.tint === 'amber' ? 'border-amber-200 bg-amber-50/60' : 'border-blue-200 bg-blue-50/60';
      const btnClass = a.tint === 'red' ? 'bg-red-600 hover:bg-red-700' : a.tint === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700';
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${borderClass}">
          <div class="space-y-0.5">
            <p class="text-sm font-semibold text-gray-900">${a.title}</p>
            <p class="text-xs text-muted leading-relaxed">${a.body}</p>
          </div>
          <button class="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-semibold ${btnClass} transition-colors shadow-xs">
            ${a.cta}
          </button>
        </div>
      `;
    }).join("");
  }

  // Weak Cells Body
  const weakBody = document.getElementById("eri-weak-cells-body");
  if (weakBody) {
    weakBody.innerHTML = (eri.weakCells || []).map(c => `
      <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors">
        <td class="py-2.5 pr-4 font-medium text-gray-900">${c.topicName}</td>
        <td class="py-2.5 pr-4 text-xs text-muted">${c.subjectName} · ${c.questionType}</td>
        <td class="py-2.5 pr-4 text-center">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">${c.difficulty}</span>
        </td>
        <td class="py-2.5 pr-4 text-right font-mono font-semibold text-danger">
          ${c.correctCount}/${c.totalAttempts} (${Math.round(c.accuracy)}%)
        </td>
        <td class="py-2.5 text-right">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${c.masteryState === 'weak' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">
            ${c.masteryState}
          </span>
        </td>
      </tr>
    `).join("");
  }
}

// 2. Knowledge Heatmap
let currentHeatmapFilter = 'all';

function filterHeatmapSubject(subj) {
  currentHeatmapFilter = subj;
  document.querySelectorAll(".hm-filter-btn").forEach(btn => {
    btn.className = "hm-filter-btn rounded-lg px-3 py-1 text-muted hover:text-foreground";
  });
  const activeBtn = document.getElementById("hm-filter-" + subj);
  if (activeBtn) activeBtn.className = "hm-filter-btn rounded-lg px-3 py-1 bg-primary/10 text-primary";
  renderStudentHeatmap(currentActiveStudentId);
}

function renderStudentHeatmap(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const container = document.getElementById("heatmap-subject-sections");
  if (!container) return;

  const subjects = (data.heatmapData?.subjects || []).filter(s => {
    if (currentHeatmapFilter === 'all') return true;
    return s.id === currentHeatmapFilter;
  });

  const getCellHtml = (cell) => {
    const bg = cell.state === 'mastered' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
               cell.state === 'reinforced' ? 'bg-blue-100 text-blue-800 border-blue-300' :
               cell.state === 'developing' ? 'bg-amber-100 text-amber-800 border-amber-300' :
               'bg-rose-100 text-rose-800 border-rose-300';
    return `
      <div class="p-2 rounded-lg border text-center transition-transform hover:scale-105 cursor-pointer ${bg}">
        <p class="font-mono text-xs font-bold">${cell.acc}%</p>
        <p class="text-[9px] opacity-80 mt-0.5">${cell.attempts} qns</p>
      </div>
    `;
  };

  container.innerHTML = subjects.map(s => `
    <div class="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between border-b border-border pb-3">
        <h3 class="text-base font-semibold text-gray-900">${s.name}</h3>
        <span class="text-xs text-muted">${s.topics.length} topics tracked</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-border/40">
              <th class="pb-2.5 pr-4 w-1/3">Topic</th>
              <th class="pb-2.5 px-3 text-center w-1/5">Easy</th>
              <th class="pb-2.5 px-3 text-center w-1/5">Medium</th>
              <th class="pb-2.5 px-3 text-center w-1/5">Hard</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/20">
            ${s.topics.map(t => `
              <tr>
                <td class="py-2.5 pr-4 font-medium text-gray-900 text-xs">${t.name}</td>
                <td class="py-2.5 px-3">${getCellHtml(t.easy)}</td>
                <td class="py-2.5 px-3">${getCellHtml(t.med)}</td>
                <td class="py-2.5 px-3">${getCellHtml(t.hard)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `).join("");
}

// 3. Predictive Path
function renderStudentPredictivePath(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const pred = data.predictivePathData || {};

  const scoreEl = document.getElementById("pred-score");
  if (scoreEl) scoreEl.textContent = `${pred.forecastScore || 278} / 300`;
  const rangeEl = document.getElementById("pred-range");
  if (rangeEl) rangeEl.textContent = pred.forecastRange || "270 – 286";
  const pctEl = document.getElementById("pred-pct");
  if (pctEl) pctEl.textContent = `${pred.forecastPercentile || 99.1}%ile`;

  // Trajectory Canvas
  const canvas = document.getElementById("predictivePathChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.predictivePathChart) charts.predictivePathChart.destroy();

    const points = pred.points || [];
    const labels = points.map(p => p.label);
    const actualScores = points.map(p => !p.predicted ? p.score : null);
    const projectedScores = points.map(p => p.predicted ? p.score : (p.label === 'Final Mock' ? p.score : null));

    charts.predictivePathChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: "Actual Score",
            data: actualScores,
            borderColor: "#2563EB",
            backgroundColor: "#2563EB",
            borderWidth: 2.5,
            pointRadius: 4,
            tension: 0.2
          },
          {
            label: "Projected Trajectory",
            data: projectedScores,
            borderColor: "#6366F1",
            borderDash: [5, 5],
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: "#6366F1",
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} / 300`
            }
          }
        },
        scales: {
          y: { min: 200, max: 300, ticks: { font: { size: 10 } }, grid: { color: "#F1F5F9" } },
          x: { ticks: { font: { size: 10 }, maxRotation: 20 }, grid: { display: false } }
        }
      }
    });
  }

  // Drivers List
  const driversList = document.getElementById("predictive-drivers-list");
  if (driversList) {
    driversList.innerHTML = (pred.drivers || []).map(d => `
      <div class="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-slate-50/50">
        <div>
          <p class="text-sm font-semibold text-gray-900">${d.name}</p>
          <p class="text-xs text-muted mt-0.5 leading-relaxed">${d.detail}</p>
        </div>
        <span class="font-mono text-xs font-bold ${d.impact.startsWith('+') ? 'text-success' : 'text-danger'}">
          ${d.impact}
        </span>
      </div>
    `).join("");
  }
}

// 4. Rank Predictor
function onWhatIfScoreChange(deltaMarks) {
  const delta = parseInt(deltaMarks, 10);
  const display = document.getElementById("whatif-delta-display");
  if (display) display.textContent = (delta >= 0 ? "+" : "") + delta + " marks";

  const baseRank = 1800;
  // Exponential scaling formula for rank estimation
  const simulatedRank = Math.max(120, Math.round(baseRank * Math.pow(0.95, delta)));
  const simEl = document.getElementById("whatif-simulated-rank");
  if (simEl) {
    const simPct = (100 - (simulatedRank / 15000)).toFixed(2);
    simEl.textContent = `Simulated AIR: ${simulatedRank.toLocaleString()} (~${simPct}%ile)`;
  }
}

function renderStudentRankPredictor(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const rp = data.rankPredictorData || {};

  const bannerRank = document.getElementById("rp-banner-rank");
  if (bannerRank) {
    bannerRank.textContent = `AIR ${(rp.predictedRankMin || 1450).toLocaleString()} – ${(rp.predictedRankMax || 2100).toLocaleString()}`;
  }

  // Colleges Table
  const tableBody = document.getElementById("rp-colleges-body");
  if (tableBody) {
    tableBody.innerHTML = (rp.colleges || []).map(c => {
      const badgeClass = c.category === 'Safe' ? 'bg-emerald-100 text-emerald-800' : c.category === 'Target' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
      return `
        <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors">
          <td class="py-2.5 pr-4 font-semibold text-gray-900">${c.name}</td>
          <td class="py-2.5 pr-4 text-xs text-muted">${c.branch}</td>
          <td class="py-2.5 pr-4 text-center">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}">${c.category}</span>
          </td>
          <td class="py-2.5 pr-4 text-right font-mono text-xs text-gray-700">AIR ${c.closingRank.toLocaleString()}</td>
          <td class="py-2.5 text-right font-mono font-bold text-success text-xs">${c.chancePct}%</td>
        </tr>
      `;
    }).join("");
  }

  // Historical Rank Canvas
  const canvas = document.getElementById("rankHistoryChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.rankHistoryChart) charts.rankHistoryChart.destroy();

    const history = rp.rankHistory || [];
    charts.rankHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.exam),
        datasets: [{
          label: "Estimated Rank",
          data: history.map(h => h.rank),
          borderColor: "#F59E0B",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: "#F59E0B"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` AIR: ${ctx.parsed.y.toLocaleString()}`
            }
          }
        },
        scales: {
          y: { reverse: true, ticks: { font: { size: 10 } }, grid: { color: "#F1F5F9" } },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }
}

// 5. Practice Analytics
function renderStudentPractice(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const prac = data.practiceData || {};

  // Chart
  const canvas = document.getElementById("practiceBreakdownChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.practiceBreakdownChart) charts.practiceBreakdownChart.destroy();

    const types = prac.typeBreakdown || [];
    charts.practiceBreakdownChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: types.map(t => t.type),
        datasets: [{
          label: "Questions Solved",
          data: types.map(t => t.count),
          backgroundColor: ["#EA580C", "#F59E0B", "#2563EB", "#8B5CF6"],
          borderRadius: 6,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 10 } }, grid: { color: "#F1F5F9" } },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Activity List
  const listEl = document.getElementById("practice-activity-list");
  if (listEl) {
    listEl.innerHTML = (prac.activityDays || []).map(a => `
      <div class="flex items-center justify-between py-2.5 text-xs">
        <div>
          <span class="font-semibold text-gray-900">${a.date}</span>
          <span class="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800">${a.type}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-muted">${a.minutes} mins</span>
          <span class="font-mono font-bold text-success">${a.correct} / ${a.answered} correct</span>
        </div>
      </div>
    `).join("");
  }
}

// 6. Success Gap
function renderStudentSuccessGap(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const sg = data.successGapData || {};

  const strengthsList = document.getElementById("sg-strengths-list");
  if (strengthsList) {
    strengthsList.innerHTML = (sg.strengths || []).map((s, idx) => `
      <div class="flex items-center justify-between p-3 rounded-xl border border-border bg-slate-50/50 text-xs">
        <div class="flex items-center gap-2.5">
          <span class="font-mono font-bold text-muted w-4 text-center">${idx + 1}</span>
          <div>
            <p class="font-medium text-gray-900">${s.topic}</p>
            <p class="text-[10px] text-muted">${s.subject} · ${s.attempts} attempts</p>
          </div>
        </div>
        <span class="font-mono font-bold text-success text-sm">${s.accuracy}%</span>
      </div>
    `).join("");
  }

  const weaknessesList = document.getElementById("sg-weaknesses-list");
  if (weaknessesList) {
    weaknessesList.innerHTML = (sg.weaknesses || []).map((w, idx) => `
      <div class="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/50 text-xs">
        <div class="flex items-center gap-2.5">
          <span class="font-mono font-bold text-danger w-4 text-center">${idx + 1}</span>
          <div>
            <p class="font-medium text-gray-900">${w.topic}</p>
            <p class="text-[10px] text-muted">${w.subject} · ${w.attempts} attempts</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-mono font-bold text-danger text-sm">${w.accuracy}%</span>
          <p class="text-[10px] text-danger font-semibold">-${w.marksLost} marks</p>
        </div>
      </div>
    `).join("");
  }

  const adviceEl = document.getElementById("sg-actionable-advice");
  if (adviceEl && sg.actionableAdvice) {
    adviceEl.textContent = sg.actionableAdvice;
  }
}

// 7. Weakness Improvement
function renderStudentWeaknessImprovement(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const wi = data.weaknessImprovementData || {};

  const listEl = document.getElementById("wi-topics-list");
  if (listEl) {
    listEl.innerHTML = (wi.topics || []).map(t => {
      const statusBadge = t.status === 'Recovered' ? 'bg-emerald-100 text-emerald-800' : t.status === 'In Progress' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
      return `
        <div class="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-900">${t.topic}</p>
              <p class="text-[11px] text-muted">${t.subject} · ${t.daysTracked} days tracked · ${t.testsTaken} tests taken</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-xs text-success">${t.delta}</span>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${statusBadge}">${t.status}</span>
            </div>
          </div>
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs text-muted">
              <span>Baseline: <strong class="text-gray-700">${t.baseline}%</strong></span>
              <span>Current: <strong class="text-gray-900 font-bold">${t.current}%</strong></span>
            </div>
            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div class="h-full bg-slate-300" style="width: ${t.baseline}%"></div>
              <div class="h-full bg-emerald-500" style="width: ${t.current - t.baseline}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
}

// 8. Time vs Performance
function renderStudentTimeVsPerformance(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const tp = data.timeVsPerformanceData || {};

  // Scatter Chart
  const canvas = document.getElementById("timePerformanceScatterChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.timePerformanceScatterChart) charts.timePerformanceScatterChart.destroy();

    const sessions = tp.sessions || [];
    charts.timePerformanceScatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: "Topics",
          data: sessions.map(s => ({ x: s.timeSeconds, y: s.accuracy, label: s.label })),
          backgroundColor: "#4F46E5",
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = sessions[ctx.dataIndex];
                return ` ${item.label}: ${item.timeSeconds}s, ${item.accuracy}% acc`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Time Spent (seconds)", font: { size: 10 } }, min: 40, max: 120, grid: { color: "#F1F5F9" } },
          y: { title: { display: true, text: "Accuracy (%)", font: { size: 10 } }, min: 30, max: 100, grid: { color: "#F1F5F9" } }
        }
      }
    });
  }

  // Pacing Table
  const tbody = document.getElementById("tp-subject-pacing-body");
  if (tbody) {
    tbody.innerHTML = (tp.subjectPacing || []).map(p => `
      <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors">
        <td class="py-2.5 pr-4 font-semibold text-gray-900">${p.subject}</td>
        <td class="py-2.5 pr-4 font-mono text-xs">${p.avgSeconds}s / qn</td>
        <td class="py-2.5 pr-4 font-mono text-xs text-muted">${p.targetSeconds}s / qn</td>
        <td class="py-2.5 text-right font-medium text-xs text-primary">${p.efficiency}</td>
      </tr>
    `).join("");
  }
}

// 9. Attendance Impact
function renderStudentAttendanceImpact(studentId) {
  const data = getStudentAnalyticsData(studentId);
  const att = data.attendanceImpactData || {};

  // Correlation Chart
  const canvas = document.getElementById("attendanceCorrelationChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.attendanceCorrelationChart) charts.attendanceCorrelationChart.destroy();

    const points = att.scatterPoints || [];
    charts.attendanceCorrelationChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: "Cohort Students",
            data: points.filter(p => !p.isTarget).map(p => ({ x: p.attendance, y: p.score })),
            backgroundColor: "rgba(100, 116, 139, 0.6)",
            pointRadius: 5
          },
          {
            label: "Target Student",
            data: points.filter(p => p.isTarget).map(p => ({ x: p.attendance, y: p.score })),
            backgroundColor: "#10B981",
            borderColor: "#065F46",
            borderWidth: 2,
            pointRadius: 9
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Attendance: ${ctx.parsed.x}%, Avg Score: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Class Attendance %", font: { size: 10 } }, min: 60, max: 100, grid: { color: "#F1F5F9" } },
          y: { title: { display: true, text: "Mock Exam Score %", font: { size: 10 } }, min: 30, max: 100, grid: { color: "#F1F5F9" } }
        }
      }
    });
  }

  // Absence List
  const absenceList = document.getElementById("attendance-absence-list");
  if (absenceList) {
    absenceList.innerHTML = (att.absences || []).map(a => `
      <div class="flex items-center justify-between py-2 text-xs">
        <div>
          <span class="font-semibold text-gray-900">${a.date}</span>
          <span class="text-muted ml-2">${a.reason}</span>
        </div>
        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">${a.status}</span>
      </div>
    `).join("");
  }
}


// ── Exam Analytics Controller & Inner Workspace ───────────────────────

let currentActiveExamId = 'ex-301';
let currentExamActiveTab = 'distribution';
let currentExamSelectedQIdx = 0;
let currentExamQAFilter = 'all';

function getExamAnalyticsData(examId) {
  const targetId = examId || currentActiveExamId || 'ex-301';
  if (APP_DATA.examAnalytics && APP_DATA.examAnalytics[targetId]) {
    return APP_DATA.examAnalytics[targetId];
  }
  const primary = (APP_DATA.examAnalytics && APP_DATA.examAnalytics['ex-301']) || {};
  const found = (APP_DATA.exams || []).find(e => e.id === targetId);

  // Dynamic generator for any exam
  return {
    examId: targetId,
    title: found ? found.title : "Exam Analytics Workspace",
    examType: found ? found.purpose : "jee_mains",
    scheduledStart: found ? found.scheduledStart : "2026-03-12T09:00:00.000Z",
    totalAssigned: found ? found.totalAssigned : 708,
    totalSubmissions: found ? found.totalSubmissions : 672,
    appearanceRate: found ? found.appearanceRate : 94.9,
    averageScore: found ? found.averageScore : 164.2,
    highestScore: found ? (found.topScore || 284) : 284,
    lowestScore: 42,
    standardDeviation: 28.4,
    passRate: found ? found.passRate : 88.5,
    avgTimeMinutes: 158,
    telemetrySummary: primary.telemetrySummary || {
      avgTabSwitches: 1.8,
      avgRevisits: 6.4,
      pctWithFlags: 28.5,
      pctSecondGuessedToWrong: 12.3
    },
    scoreDistribution: primary.scoreDistribution || [
      { range: "0-60", count: 18 },
      { range: "61-120", count: 84 },
      { range: "121-180", count: 268 },
      { range: "181-240", count: 214 },
      { range: "241-300", count: 88 }
    ],
    subjectBreakdown: primary.subjectBreakdown || [
      { subjectName: "Physics", totalQuestions: 25, avgScore: 52.8, avgAccuracy: 63.4, avgTimeSeconds: 122 },
      { subjectName: "Chemistry", totalQuestions: 25, avgScore: 58.6, avgAccuracy: 70.3, avgTimeSeconds: 98 },
      { subjectName: "Mathematics", totalQuestions: 25, avgScore: 52.8, avgAccuracy: 63.4, avgTimeSeconds: 158 }
    ],
    topicBreakdown: primary.topicBreakdown || [],
    killerQuestions: primary.killerQuestions || [],
    skippedQuestions: primary.skippedQuestions || [],
    questionAnalysis: primary.questionAnalysis || [],
    topScorers: primary.topScorers || [],
    batchRollup: primary.batchRollup || [],
    atRiskStudents: primary.atRiskStudents || [],
    absentStudents: primary.absentStudents || []
  };
}

function openExamModal(examId) {
  try {
    const modal = document.getElementById("exam-modal");
    if (!modal) return;

    if (examId) {
      currentActiveExamId = examId;
    }

    modal.classList.remove("hidden");

    const data = getExamAnalyticsData(currentActiveExamId);

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
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (charts.modalExamDistChart) charts.modalExamDistChart.destroy();

      const dist = data.scoreDistribution || [];
      charts.modalExamDistChart = new Chart(ctx, {
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
          <div class="text-right font-mono">
            <span class="font-bold text-slate-900">${s.score} / 300</span>
            <p class="text-[10px] font-semibold text-success">${s.percentage}%ile</p>
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error in openExamModal:", err);
  }
}

function closeExamModal() {
  document.getElementById("exam-modal")?.classList.add("hidden");
}

function openFullExamAnalytics(examId) {
  if (examId) {
    currentActiveExamId = examId;
  }
  closeExamModal();
  switchView('exam-detail');
}


// ── Global State for Exam Workspace & Inner Pages ─────────────────────────
let examScorersQuery = "";
let examScorersFlaggedOnly = false;
let examScorersSortField = "rank";
let examScorersSortDir = "asc";
let examScorersPage = 1;
const EXAM_SCORERS_PAGE_SIZE = 10;

let examAtRiskSeverity = "all";
let examMixedStrongFilter = "all";
let examMixedWeakFilter = "all";

let examSubjectRankPages = { "subj-phy": 1, "subj-chem": 1, "subj-math": 1 };
const EXAM_SUBJ_PAGE_SIZE = 4;

let examQaView = "palette"; // "palette" | "table" | "subject" | "section"
let modalViewingQNum = 1;

let taSelectedFilter = "all";
let taSelectedQIdx = 0;

function renderExamDetail(examId) {
  const data = getExamAnalyticsData(examId);

  // 1. Header & Meta
  const titleEl = document.getElementById("exam-detail-title");
  if (titleEl) titleEl.textContent = data.title || "Mock Test — JEE Mains";
  const purposeEl = document.getElementById("exam-detail-purpose");
  if (purposeEl) purposeEl.textContent = (data.examType || 'JEE Mains').replace(/_/g, " ").toUpperCase();
  const metaEl = document.getElementById("exam-detail-meta");
  if (metaEl) {
    const dStr = data.scheduledStart ? new Date(data.scheduledStart).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' }) : "Mar 12, 2026";
    metaEl.textContent = `Scheduled: ${dStr} · ${data.totalSubmissions || 672} Submissions (${data.appearanceRate || 94.9}% appearance) · Assigned: SR MPC (Madhapur, Shamirpet, Suchitra)`;
  }

  // 2. Facet selectors
  const facets = data.rosterFacets || {
    branches: [
      { id: "b-madhapur", name: "Madhapur", count: 240 },
      { id: "b-shamirpet", name: "Shamirpet", count: 216 },
      { id: "b-suchitra", name: "Suchitra", count: 216 }
    ],
    batches: [
      { id: "b-srmpc-madhapur", name: "SR MPC (Madhapur)", count: 240 },
      { id: "b-srmpc-shamirpet", name: "SR MPC (Shamirpet)", count: 216 },
      { id: "b-srmpc-suchitra", name: "SR MPC (Suchitra)", count: 216 }
    ],
    sections: [
      { key: "A", section: "A", count: 336 },
      { key: "B", section: "B", count: 336 }
    ]
  };

  const branchSel = document.getElementById("exam-detail-branch-filter");
  if (branchSel) {
    branchSel.innerHTML = '<option value="">All Branches</option>' + (facets.branches || []).map(b => `<option value="${b.id}">${b.name} (${b.count})</option>`).join("");
  }
  const batchSel = document.getElementById("exam-detail-batch-filter");
  if (batchSel) {
    batchSel.innerHTML = '<option value="">All Batches</option>' + (facets.batches || []).map(b => `<option value="${b.id}">${b.name} (${b.count})</option>`).join("");
  }
  const secSel = document.getElementById("exam-detail-section-filter");
  if (secSel) {
    secSel.innerHTML = '<option value="">All Sections</option>' + (facets.sections || []).map(s => `<option value="${s.section}">Section ${s.section} (${s.count})</option>`).join("");
  }

  // 3. 7 KPIs
  const appEl = document.getElementById("exam-kpi-appeared");
  if (appEl) appEl.textContent = `${data.totalSubmissions || 672} / ${data.totalAssigned || 708}`;
  const avgEl = document.getElementById("exam-kpi-avg-score");
  if (avgEl) avgEl.textContent = data.averageScore || 164.2;
  const topEl = document.getElementById("exam-kpi-top-score");
  if (topEl) topEl.textContent = data.highestScore || 284;
  const lowEl = document.getElementById("exam-kpi-lowest-score");
  if (lowEl) lowEl.textContent = data.lowestScore || 42;
  const passEl = document.getElementById("exam-kpi-pass-rate");
  if (passEl) passEl.textContent = `${data.passRate || 88.5}%`;
  const sdEl = document.getElementById("exam-kpi-std-dev");
  if (sdEl) sdEl.textContent = data.standardDeviation || 28.4;
  const timeEl = document.getElementById("exam-kpi-avg-time");
  if (timeEl) timeEl.textContent = `${data.avgTimeMinutes || 158}m`;

  // 4. Killer & Skipped Questions
  const killerEl = document.getElementById("exam-killer-questions");
  if (killerEl) {
    killerEl.innerHTML = (data.killerQuestions || []).map(k => `
      <button onclick="jumpToExamQuestion(${k.qNum - 1})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-xs font-medium text-rose-700 shadow-xs transition-all">
        <span class="font-mono font-bold">Q${k.qNum}</span>
        <span class="text-[10px] text-muted">${k.topic} (${k.accuracy}%)</span>
      </button>
    `).join("");
  }

  const skippedEl = document.getElementById("exam-skipped-questions");
  if (skippedEl) {
    skippedEl.innerHTML = (data.skippedQuestions || []).map(s => `
      <button onclick="jumpToExamQuestion(${s.qNum - 1})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-all">
        <span class="font-mono font-bold">Q${s.qNum}</span>
        <span class="text-[10px] text-muted">${s.topic} (${s.skippedPct}% left blank)</span>
      </button>
    `).join("");
  }

  // 5. Behavioral Signals
  const tel = data.telemetrySummary || {
    avgTabSwitches: 1.8,
    avgRevisits: 6.4,
    pctWithFlags: 28.5,
    pctSecondGuessedToWrong: 12.3
  };
  const telMeta = document.getElementById("exam-signals-meta");
  if (telMeta) telMeta.textContent = `Averaged across ${data.totalSubmissions || 672} submissions`;
  const telTabs = document.getElementById("exam-signals-tabswitches");
  if (telTabs) telTabs.textContent = tel.avgTabSwitches;
  const telRev = document.getElementById("exam-signals-revisits");
  if (telRev) telRev.textContent = tel.avgRevisits;
  const telFlag = document.getElementById("exam-signals-flagged");
  if (telFlag) telFlag.textContent = `${tel.pctWithFlags}%`;
  const tel2nd = document.getElementById("exam-signals-secondguess");
  if (tel2nd) tel2nd.textContent = `${tel.pctSecondGuessedToWrong}%`;

  // 6. Charts: Score Distribution & Subject Accuracy
  renderExamDistributionCharts(data);

  // 7. Results Leaderboard Table
  renderExamScorersTable(data);

  // 8. Students at risk
  renderExamAtRiskSection(data);

  // 9. Mixed Performance
  renderExamMixedPerformance(data);

  // 10. Subject-wise Student Rankings
  renderExamSubjectRankings(data);

  // 11. Section-wise & Branch-wise Rankings
  renderExamOrgRankings(data);

  // 12. Topic Breakdown Table
  renderExamTopicBreakdown(data);

  // 13. Question Analysis (Palette / Table / Rollup)
  renderExamQuestionAnalysis(data);

  // 14. Subject-wise RWL Bars
  renderExamSubjectRwl(data);

  // 15. Absent Students List
  renderExamAbsentList(data);
}

function toggleExamInsights() {
  const content = document.getElementById("exam-insights-content");
  const caret = document.getElementById("exam-insights-caret");
  if (!content) return;
  content.classList.toggle("hidden");
  if (caret) caret.classList.toggle("rotate-180");
}

function jumpToExamQuestion(qIdx) {
  currentExamSelectedQIdx = qIdx;
  setExamQaView("palette");
  document.getElementById("question-analysis")?.scrollIntoView({ behavior: "smooth" });
  renderExamQuestionAnalysis(getExamAnalyticsData(currentActiveExamId));
}

function renderExamDistributionCharts(data) {
  // 1. Histogram
  const histCanvas = document.getElementById("examDistributionChart");
  if (histCanvas) {
    const ctx = histCanvas.getContext("2d");
    if (charts.examDistributionChart) charts.examDistributionChart.destroy();
    const dist = data.scoreDistribution || [
      { range: "0-60", count: 18 },
      { range: "61-120", count: 84 },
      { range: "121-180", count: 268 },
      { range: "181-240", count: 214 },
      { range: "241-300", count: 88 }
    ];
    charts.examDistributionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dist.map(d => `${d.range} pts`),
        datasets: [{
          label: 'Students',
          data: dist.map(d => d.count),
          backgroundColor: '#2563EB',
          borderRadius: 6,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} students in ${ctx.label}`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Subject Accuracy Horizontal Bar Chart
  const accCanvas = document.getElementById("examSubjectAccuracyChart");
  if (accCanvas) {
    const ctx = accCanvas.getContext("2d");
    if (charts.examSubjectAccuracyChart) charts.examSubjectAccuracyChart.destroy();
    const accData = data.subjectRadarData || [
      { subject: "Chemistry", accuracy: 70 },
      { subject: "Physics", accuracy: 63 },
      { subject: "Mathematics", accuracy: 53 }
    ];
    charts.examSubjectAccuracyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: accData.map(d => d.subject),
        datasets: [{
          label: 'Accuracy %',
          data: accData.map(d => d.accuracy),
          backgroundColor: accData.map(d => d.accuracy >= 70 ? '#10B981' : d.accuracy >= 55 ? '#2563EB' : '#F59E0B'),
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
              label: (ctx) => ` Accuracy: ${ctx.parsed.x}%`
            }
          }
        },
        scales: {
          x: { min: 0, max: 100, grid: { color: '#F1F5F9' }, ticks: { callback: v => `${v}%` } },
          y: { grid: { display: false } }
        }
      }
    });
  }
}

// ── Results Leaderboard Table ─────────────────────────────────────────────
function onExamScorersSearch(val) {
  examScorersQuery = (val || "").trim().toLowerCase();
  examScorersPage = 1;
  renderExamScorersTable(getExamAnalyticsData(currentActiveExamId));
}

function toggleExamScorersFlagged() {
  examScorersFlaggedOnly = !examScorersFlaggedOnly;
  const btn = document.getElementById("exam-scorers-flagged-btn");
  if (btn) {
    if (examScorersFlaggedOnly) {
      btn.className = "flex h-8 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 text-danger px-3 text-xs font-semibold";
    } else {
      btn.className = "flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted hover:bg-primary/5 transition-colors";
    }
  }
  examScorersPage = 1;
  renderExamScorersTable(getExamAnalyticsData(currentActiveExamId));
}

function sortExamScorers(field) {
  if (examScorersSortField === field) {
    examScorersSortDir = examScorersSortDir === "asc" ? "desc" : "asc";
  } else {
    examScorersSortField = field;
    examScorersSortDir = (field === "name" || field === "rank") ? "asc" : "desc";
  }
  renderExamScorersTable(getExamAnalyticsData(currentActiveExamId));
}

function changeExamScorersPage(delta) {
  examScorersPage += delta;
  renderExamScorersTable(getExamAnalyticsData(currentActiveExamId));
}

function renderExamScorersTable(data) {
  const tbody = document.getElementById("exam-scorers-table-body");
  if (!tbody) return;

  const rawScorers = data.topScorers || [];
  
  // Update Flagged Count Badge
  const flaggedCount = rawScorers.filter(s => s.flagged).length || 3;
  const flagBadge = document.getElementById("exam-scorers-flagged-count");
  if (flagBadge) flagBadge.textContent = flaggedCount;

  // Filter
  let filtered = rawScorers.filter(s => {
    if (examScorersFlaggedOnly && !s.flagged) return false;
    if (examScorersQuery && !s.name.toLowerCase().includes(examScorersQuery) && !s.rollNo.includes(examScorersQuery)) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let valA = a[examScorersSortField] ?? (examScorersSortField === 'phy' ? a.physicsScore : examScorersSortField === 'chem' ? a.chemistryScore : a.mathScore) ?? a.score;
    let valB = b[examScorersSortField] ?? (examScorersSortField === 'phy' ? b.physicsScore : examScorersSortField === 'chem' ? b.chemistryScore : b.mathScore) ?? b.score;
    if (typeof valA === 'string') {
      return examScorersSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return examScorersSortDir === 'asc' ? (valA - valB) : (valB - valA);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / EXAM_SCORERS_PAGE_SIZE));
  if (examScorersPage > totalPages) examScorersPage = totalPages;
  if (examScorersPage < 1) examScorersPage = 1;

  const startIdx = (examScorersPage - 1) * EXAM_SCORERS_PAGE_SIZE;
  const endIdx = Math.min(startIdx + EXAM_SCORERS_PAGE_SIZE, filtered.length);
  const paged = filtered.slice(startIdx, endIdx);

  // Pagination UI
  const pageInfo = document.getElementById("exam-scorers-page-info");
  if (pageInfo) pageInfo.textContent = `Showing ${startIdx + 1} - ${endIdx} of ${filtered.length}`;
  const pageInd = document.getElementById("exam-scorers-page-indicator");
  if (pageInd) pageInd.textContent = `Page ${examScorersPage} / ${totalPages}`;
  const prevBtn = document.getElementById("exam-scorers-prev-btn");
  if (prevBtn) prevBtn.disabled = examScorersPage <= 1;
  const nextBtn = document.getElementById("exam-scorers-next-btn");
  if (nextBtn) nextBtn.disabled = examScorersPage >= totalPages;

  tbody.innerHTML = paged.map(s => {
    const isFlagged = !!s.flagged;
    const rankBadge = s.rank === 1 ? '<span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-yellow-100 text-yellow-800 font-bold text-xs">#1</span>' :
                      s.rank === 2 ? '<span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-slate-700 font-bold text-xs">#2</span>' :
                      s.rank === 3 ? '<span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 text-orange-800 font-bold text-xs">#3</span>' :
                      `<span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600 font-mono text-xs">#${s.rank || '-'}</span>`;

    const phy = s.physicsScore != null ? s.physicsScore : Math.round((s.score || 250) * 0.32);
    const chem = s.chemistryScore != null ? s.chemistryScore : Math.round((s.score || 250) * 0.35);
    const math = s.mathScore != null ? s.mathScore : Math.round((s.score || 250) * 0.33);

    return `
      <tr class="border-b border-border/40 hover:bg-primary/[0.03] transition-colors ${isFlagged ? 'bg-rose-50/25' : ''}">
        <td class="py-3 pr-4">
          <div class="flex items-center gap-2">
            ${isFlagged ? '<i class="ph-fill ph-flag text-danger text-xs" title="Integrity flag on this paper"></i>' : ''}
            <div>
              <button type="button" onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')" class="font-semibold text-primary hover:underline text-left text-sm">
                ${s.name}
              </button>
              <p class="text-[11px] text-muted">${s.rollNo} · ${s.batch || 'SR MPC'} (${s.branch || 'Madhapur'})</p>
            </div>
          </div>
        </td>
        <td class="py-3 pr-4">${rankBadge}</td>
        <td class="py-3 pr-4 text-right font-mono font-bold text-slate-900">${s.score} <span class="text-xs text-muted font-normal">/ 300</span></td>
        <td class="py-3 pr-4 text-right font-mono text-xs font-semibold text-emerald-700">${phy} / 100</td>
        <td class="py-3 pr-4 text-right font-mono text-xs font-semibold text-blue-700">${chem} / 100</td>
        <td class="py-3 pr-4 text-right font-mono text-xs font-semibold text-purple-700">${math} / 100</td>
        <td class="py-3 text-right">
          <button onclick="openStudentModal('${s.studentId}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <i class="ph-duotone ph-user"></i> Dossier
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// ── Students at Risk on THIS Exam ─────────────────────────────────────────
function setExamAtRiskSeverity(sev) {
  examAtRiskSeverity = sev;
  document.querySelectorAll('.exam-risk-filter-btn').forEach(btn => {
    if (btn.dataset.severity === sev) {
      btn.className = 'exam-risk-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary';
    } else {
      btn.className = 'exam-risk-filter-btn px-2.5 py-1 text-xs font-medium rounded-lg text-muted hover:text-foreground';
    }
  });
  renderExamAtRiskSection(getExamAnalyticsData(currentActiveExamId));
}

function renderExamAtRiskSection(data) {
  const grid = document.getElementById("exam-at-risk-grid");
  if (!grid) return;

  const list = (data.atRiskStudents || []).filter(s => {
    if (examAtRiskSeverity !== "all" && s.severity !== examAtRiskSeverity) return false;
    return true;
  });

  grid.innerHTML = list.map(s => {
    const sevBadge = s.severity === "critical" ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700">Critical</span>' :
                     s.severity === "warning" ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Warning</span>' :
                     '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">Watch</span>';

    return `
      <div class="rounded-xl border border-border bg-white p-4 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-gray-900 hover:text-primary cursor-pointer" onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')">${s.name}</p>
              <p class="text-[11px] text-muted">${s.rollNo} · ${s.batch || 'SR MPC'} (${s.branch || 'Madhapur'})</p>
            </div>
            ${sevBadge}
          </div>
          <div class="mt-2.5 flex items-baseline justify-between font-mono">
            <span class="text-lg font-bold text-rose-600">${s.score} <span class="text-xs text-muted font-normal">/ 300</span></span>
            <span class="text-xs font-bold text-rose-700">${s.percentage}%</span>
          </div>
          <p class="mt-2 text-xs text-rose-800/90 leading-relaxed bg-rose-50/60 p-2 rounded-lg border border-rose-100">${s.reason}</p>
        </div>
        <div class="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
          <button onclick="alert('Assigned diagnostic prescription: ' + '${s.action || 'Physics Mechanics'}')" class="text-[11px] font-semibold text-primary hover:underline">
            ${s.action || 'Assign Practice'}
          </button>
          <button onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')" class="text-xs text-muted hover:text-slate-900">
            <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ── Mixed Performance Section ─────────────────────────────────────────────
function filterExamMixedPerformance() {
  examMixedStrongFilter = document.getElementById("exam-mixed-strong")?.value || "all";
  examMixedWeakFilter = document.getElementById("exam-mixed-weak")?.value || "all";
  renderExamMixedPerformance(getExamAnalyticsData(currentActiveExamId));
}

function renderExamMixedPerformance(data) {
  const grid = document.getElementById("exam-mixed-grid");
  if (!grid) return;

  const list = (data.mixedPerformance || []).filter(p => {
    if (examMixedStrongFilter !== "all" && p.best?.subjectName !== examMixedStrongFilter) return false;
    if (examMixedWeakFilter !== "all" && p.worst?.subjectName !== examMixedWeakFilter) return false;
    return true;
  });

  if (list.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-muted">No students match these filter criteria.</div>';
    return;
  }

  grid.innerHTML = list.map(p => `
    <div onclick="openStudentTestAnalysis('${p.studentId}', '${currentActiveExamId}')" class="group rounded-xl border border-border bg-white p-4 transition-all hover:border-primary/40 hover:shadow-xs cursor-pointer">
      <div class="flex items-start justify-between gap-2">
        <p class="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">${p.name}</p>
        <span class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">${Math.round(p.gap)}pp gap</span>
      </div>
      <div class="mt-3 space-y-2 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            Strong: <span class="text-gray-900">${p.best?.subjectName}</span>
          </span>
          <span class="font-mono font-bold text-emerald-600">${p.best?.accuracy}%</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-rose-600 font-medium">
            <span class="inline-block h-2 w-2 rounded-full bg-rose-500"></span>
            Weak: <span class="text-gray-900">${p.worst?.subjectName}</span>
          </span>
          <span class="font-mono font-bold text-rose-600">${p.worst?.accuracy}%</span>
        </div>
      </div>
    </div>
  `).join("");
}

// ── Subject-wise Student Rankings ─────────────────────────────────────────
function renderExamSubjectRankings(data) {
  const container = document.getElementById("exam-subject-rankings-grid");
  if (!container) return;

  const subjects = data.subjectRankings || [];
  container.innerHTML = subjects.map(subj => {
    const page = examSubjectRankPages[subj.subjectId] || 1;
    const totalPages = Math.max(1, Math.ceil(subj.students.length / EXAM_SUBJ_PAGE_SIZE));
    const start = (page - 1) * EXAM_SUBJ_PAGE_SIZE;
    const paged = subj.students.slice(start, start + EXAM_SUBJ_PAGE_SIZE);

    return `
      <div class="rounded-xl border border-border bg-white p-4 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-900">${subj.subjectName} Leaderboard</h3>
            <span class="text-[10px] uppercase font-mono text-muted">${subj.students.length} students</span>
          </div>
          <div class="space-y-2">
            ${paged.map(s => `
              <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs">
                <div class="flex items-center gap-2">
                  <span class="inline-flex h-5 w-5 items-center justify-center rounded-md font-mono text-[10px] font-bold ${s.rank === 1 ? 'bg-amber-100 text-amber-800' : s.rank === 2 ? 'bg-slate-200 text-slate-700' : s.rank === 3 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-muted'}">
                    #${s.rank}
                  </span>
                  <button onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')" class="font-medium text-gray-900 hover:text-primary transition-colors text-left">
                    ${s.name}
                  </button>
                </div>
                <div class="font-mono text-right">
                  <span class="font-bold text-slate-900">${s.correct}/${s.total}</span>
                  <span class="text-[10px] font-semibold text-emerald-600 ml-1">(${s.accuracy}%)</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted">
          <button onclick="changeExamSubjPage('${subj.subjectId}', -1)" ${page <= 1 ? 'disabled' : ''} class="px-2 py-1 rounded border border-border disabled:opacity-40">Prev</button>
          <span class="font-mono text-[11px]">${page} / ${totalPages}</span>
          <button onclick="changeExamSubjPage('${subj.subjectId}', 1)" ${page >= totalPages ? 'disabled' : ''} class="px-2 py-1 rounded border border-border disabled:opacity-40">Next</button>
        </div>
      </div>
    `;
  }).join("");
}

function changeExamSubjPage(subjectId, delta) {
  examSubjectRankPages[subjectId] = (examSubjectRankPages[subjectId] || 1) + delta;
  renderExamSubjectRankings(getExamAnalyticsData(currentActiveExamId));
}

// ── Section & Branch Rankings ─────────────────────────────────────────────
function renderExamOrgRankings(data) {
  // Section Rankings
  const secContainer = document.getElementById("exam-section-rankings-container");
  if (secContainer) {
    const secList = data.sectionRankings || [];
    secContainer.innerHTML = secList.map(grp => `
      <div class="p-3.5 rounded-xl border border-border bg-slate-50/50">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">${grp.name}</h4>
          <span class="text-[10px] font-mono text-muted">${grp.students.length} top submitters</span>
        </div>
        <div class="space-y-1.5">
          ${grp.students.map(s => `
            <div class="flex items-center justify-between text-xs py-1 hover:bg-white px-2 rounded transition-colors">
              <span class="flex items-center gap-2">
                <span class="font-mono text-muted font-bold text-[11px]">#${s.rank}</span>
                <button onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')" class="font-medium text-gray-900 hover:text-primary text-left">
                  ${s.name}
                </button>
              </span>
              <span class="font-mono font-bold text-slate-800">${s.score} pts (${s.percentage}%)</span>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  // Branch Rankings
  const brContainer = document.getElementById("exam-branch-rankings-container");
  if (brContainer) {
    const brList = data.branchRankings || [];
    brContainer.innerHTML = brList.map(grp => `
      <div class="p-3.5 rounded-xl border border-border bg-slate-50/50">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">${grp.name}</h4>
          <span class="text-[10px] font-mono text-muted">${grp.students.length} submitters</span>
        </div>
        <div class="space-y-1.5">
          ${grp.students.map(s => `
            <div class="flex items-center justify-between text-xs py-1 hover:bg-white px-2 rounded transition-colors">
              <span class="flex items-center gap-2">
                <span class="font-mono text-muted font-bold text-[11px]">#${s.rank}</span>
                <button onclick="openStudentTestAnalysis('${s.studentId}', '${currentActiveExamId}')" class="font-medium text-gray-900 hover:text-primary text-left">
                  ${s.name}
                </button>
              </span>
              <span class="font-mono font-bold text-slate-800">${s.score} pts (${s.percentage}%)</span>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }
}

// ── Topic Breakdown Table ─────────────────────────────────────────────────
let examTopicSortField = "accuracy";
let examTopicSortDir = "desc";

function sortExamTopics(field) {
  if (examTopicSortField === field) {
    examTopicSortDir = examTopicSortDir === "asc" ? "desc" : "asc";
  } else {
    examTopicSortField = field;
    examTopicSortDir = (field === "topic" || field === "subject") ? "asc" : "desc";
  }
  renderExamTopicBreakdown(getExamAnalyticsData(currentActiveExamId));
}

function renderExamTopicBreakdown(data) {
  const tbody = document.getElementById("exam-topic-breakdown-body");
  if (!tbody) return;

  const topics = [...(data.topicBreakdown || [])];
  topics.sort((a, b) => {
    let valA = a[examTopicSortField];
    let valB = b[examTopicSortField];
    if (typeof valA === 'string') {
      return examTopicSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return examTopicSortDir === 'asc' ? (valA - valB) : (valB - valA);
  });

  tbody.innerHTML = topics.map(t => {
    const accClass = t.accuracy >= 75 ? "text-emerald-700 bg-emerald-50" : t.accuracy >= 50 ? "text-blue-700 bg-blue-50" : "text-rose-700 bg-rose-50";
    return `
      <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors text-xs">
        <td class="py-2.5 pr-4 font-semibold text-gray-900">${t.topic}</td>
        <td class="py-2.5 pr-4 text-muted">${t.subject}</td>
        <td class="py-2.5 pr-4 text-right font-mono">${t.questions}</td>
        <td class="py-2.5 pr-4 text-right">
          <span class="font-mono font-bold px-2 py-0.5 rounded-full ${accClass}">${t.accuracy}%</span>
        </td>
        <td class="py-2.5 text-right font-mono text-muted">${t.avgSeconds}s</td>
      </tr>
    `;
  }).join("");
}

// ── Question Analysis (Palette / Table / Rollups) ─────────────────────────
function setExamQaView(viewMode) {
  examQaView = viewMode;
  ['palette', 'table', 'subject', 'section'].forEach(m => {
    const btn = document.getElementById(`exam-qaview-${m}-btn`);
    if (btn) {
      if (m === viewMode) {
        btn.className = "rounded-lg px-3 py-1.5 bg-primary/10 text-primary font-semibold transition-colors";
      } else {
        btn.className = "rounded-lg px-3 py-1.5 text-muted hover:text-foreground transition-colors";
      }
    }
  });

  document.getElementById("exam-qa-palette-container")?.classList.toggle("hidden", viewMode !== "palette");
  document.getElementById("exam-qa-table-container")?.classList.toggle("hidden", viewMode !== "table");
  document.getElementById("exam-qa-rollup-container")?.classList.toggle("hidden", viewMode !== "subject" && viewMode !== "section");

  const descEl = document.getElementById("exam-qa-meta-desc");
  if (descEl) {
    descEl.textContent = viewMode === "palette" ? "Pick a question from the palette to inspect cohort responses & distractors" :
                         viewMode === "table" ? "Question by question — Right / Wrong / Left across 75 questions" :
                         viewMode === "subject" ? "Subject-wise performance roll-up across all 3 disciplines" :
                         "Section-wise roll-up across assigned batches";
  }

  renderExamQuestionAnalysis(getExamAnalyticsData(currentActiveExamId));
}

function selectExamQuestion(qIdx) {
  currentExamSelectedQIdx = qIdx;
  renderExamQuestionAnalysis(getExamAnalyticsData(currentActiveExamId));
}

function renderExamQuestionAnalysis(data) {
  const list = data.questionAnalysis || [];
  if (list.length === 0) return;

  const currentQ = list[currentExamSelectedQIdx] || list[0];

  // 1. Palette View
  if (examQaView === "palette") {
    const palGrid = document.getElementById("exam-question-palette-grid");
    if (palGrid) {
      palGrid.innerHTML = list.map((q, i) => {
        const isCurrent = i === currentExamSelectedQIdx;
        const colorCls = q.accuracy >= 70 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                         q.accuracy >= 40 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                         'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
        const activeCls = isCurrent ? 'bg-primary text-white font-bold ring-2 ring-primary ring-offset-1 shadow-xs' : colorCls;

        return `
          <button type="button" onclick="selectExamQuestion(${i})" class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] transition-transform hover:scale-110 ${activeCls}" title="Q${i + 1} · ${q.subjectName} · ${q.accuracy}% correct">
            ${i + 1}
          </button>
        `;
      }).join("");
    }

    // Detail Panel
    const panel = document.getElementById("exam-question-detail-panel");
    if (panel && currentQ) {
      const diffColor = currentQ.difficulty === 'Hard' ? 'bg-rose-100 text-rose-800' : currentQ.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
      const opt = currentQ.optionDistribution || { A: 25, B: 25, C: 25, D: 25 };

      panel.innerHTML = `
        <!-- Quick stats strip -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">Q${currentExamSelectedQIdx + 1} of ${list.length}</span>
          <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">${currentQ.subjectName}</span>
          <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">${currentQ.topicName}</span>
          <span class="rounded-full px-2.5 py-1 font-bold uppercase text-[10px] ${diffColor}">${currentQ.difficulty}</span>
          <span class="ml-auto flex items-center gap-3 font-mono text-xs">
            <span class="text-emerald-600 font-bold">${currentQ.correctCount} Right</span>
            <span class="text-rose-600 font-bold">${currentQ.incorrectCount} Wrong</span>
            <span class="text-muted">${currentQ.skippedCount} Left</span>
            <span class="font-bold text-slate-900">${currentQ.accuracy}% Acc</span>
            <span class="text-muted">${currentQ.avgTimeSeconds}s</span>
          </span>
        </div>

        <!-- Question Prompt Box -->
        <div class="p-4 rounded-xl bg-slate-50 border border-border">
          <p class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Question Item</p>
          <div class="text-sm text-gray-900 leading-relaxed font-sans">${currentQ.questionText || 'Question statement'}</div>
        </div>

        <!-- Options with Correct Key Highlight -->
        <div class="space-y-2">
          ${(currentQ.options || [
            { key: "A", text: "Option A" },
            { key: "B", text: "Option B" },
            { key: "C", text: "Option C" },
            { key: "D", text: "Option D" }
          ]).map(o => {
            const isCorrect = o.key === currentQ.correctOption;
            const borderCls = isCorrect ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-medium' : 'border-border bg-white text-gray-800';
            return `
              <div class="p-3 rounded-xl border flex items-center justify-between text-xs ${borderCls}">
                <div class="flex items-center gap-2">
                  <span class="inline-flex h-6 w-6 items-center justify-center rounded-md font-mono font-bold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}">${o.key}</span>
                  <span>${o.text}</span>
                </div>
                ${isCorrect ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Correct Answer</span>' : ''}
              </div>
            `;
          }).join("")}
        </div>

        <!-- Telemetry pills -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200">
            🚩 Flagged: ${currentQ.telemetry?.flagRate || 18}%
          </span>
          <span class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-800 border border-sky-200">
            ↻ Revisited: ${currentQ.telemetry?.revisitRate || 34}%
          </span>
          <span class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 border border-rose-200">
            ⇆ Second-guessed to wrong: ${currentQ.telemetry?.secondGuessWrongRate || 12}%
          </span>
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 font-mono">
            DI: ${currentQ.discriminationIndex || 0.28}
          </span>
        </div>

        <!-- Option Distribution Bar -->
        <div class="rounded-xl border border-border bg-slate-50/50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Option Selection Distribution</p>
          <div class="flex h-6 w-full overflow-hidden rounded-lg bg-slate-200 font-mono text-[10px] text-white font-bold">
            <div class="bg-blue-500 flex items-center justify-center" style="width: ${opt.A || 25}%" title="Option A: ${opt.A}%">A (${opt.A}%)</div>
            <div class="bg-purple-500 flex items-center justify-center" style="width: ${opt.B || 25}%" title="Option B: ${opt.B}%">B (${opt.B}%)</div>
            <div class="bg-amber-500 flex items-center justify-center" style="width: ${opt.C || 25}%" title="Option C: ${opt.C}%">C (${opt.C}%)</div>
            <div class="bg-emerald-500 flex items-center justify-center" style="width: ${opt.D || 25}%" title="Option D: ${opt.D}%">D (${opt.D}%)</div>
          </div>
        </div>

        <!-- Prev / Next & Modal Button -->
        <div class="flex items-center justify-between pt-2">
          <button onclick="selectExamQuestion(${Math.max(0, currentExamSelectedQIdx - 1)})" ${currentExamSelectedQIdx <= 0 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-slate-900 disabled:opacity-40">
            <i class="ph-bold ph-caret-left"></i> Prev Question
          </button>
          <button onclick="openExamQuestionDetailModal(${currentExamSelectedQIdx + 1})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs">
            <i class="ph-bold ph-magnifying-glass-plus"></i> View Full Details & Solution
          </button>
          <button onclick="selectExamQuestion(${Math.min(list.length - 1, currentExamSelectedQIdx + 1)})" ${currentExamSelectedQIdx >= list.length - 1 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-slate-900 disabled:opacity-40">
            Next Question <i class="ph-bold ph-caret-right"></i>
          </button>
        </div>
      `;
    }
  }

  // 2. Question-by-Question Table View
  if (examQaView === "table") {
    const tbody = document.getElementById("exam-qa-table-tbody");
    if (tbody) {
      tbody.innerHTML = list.map((q, idx) => `
        <tr onclick="selectExamQuestion(${idx}); setExamQaView('palette');" class="border-b border-border/40 hover:bg-primary/[0.03] transition-colors cursor-pointer text-xs">
          <td class="py-2.5 px-3 font-mono font-bold text-slate-800">Q${idx + 1}</td>
          <td class="py-2.5 px-3 max-w-xs truncate font-medium text-gray-900">${q.questionText || q.stem || 'Question item ' + (idx + 1)}</td>
          <td class="py-2.5 px-3 text-muted">${q.subjectName}</td>
          <td class="py-2.5 px-3 text-muted">${q.topicName}</td>
          <td class="py-2.5 px-3 font-mono uppercase text-[10px] font-bold">${q.difficulty}</td>
          <td class="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">${q.correctCount}</td>
          <td class="py-2.5 px-3 text-center font-mono font-bold text-rose-600">${q.incorrectCount}</td>
          <td class="py-2.5 px-3 text-center font-mono text-muted">${q.skippedCount}</td>
          <td class="py-2.5 px-3 text-center font-mono font-bold ${q.accuracy >= 70 ? 'text-emerald-700' : q.accuracy >= 40 ? 'text-amber-700' : 'text-rose-700'}">${q.accuracy}%</td>
          <td class="py-2.5 px-3 text-center font-mono">${q.discriminationIndex}</td>
          <td class="py-2.5 px-3 text-right font-mono text-muted">${q.avgTimeSeconds}s</td>
        </tr>
      `);
    }
  }

  // 3. Rollup Table View (Subject / Section)
  if (examQaView === "subject" || examQaView === "section") {
    const tbody = document.getElementById("exam-qa-rollup-tbody");
    const header = document.getElementById("exam-rollup-group-header");
    if (header) header.textContent = examQaView === "subject" ? "Subject" : "Section";
    if (tbody) {
      const rows = examQaView === "subject" ? [
        { label: "Physics", count: 25, appeared: 672, r: 63, w: 24, l: 13, acc: 63.4, pace: "122s" },
        { label: "Chemistry", count: 25, appeared: 672, r: 70, w: 18, l: 12, acc: 70.3, pace: "98s" },
        { label: "Mathematics", count: 25, appeared: 672, r: 53, w: 27, l: 20, acc: 52.8, pace: "158s" }
      ] : [
        { label: "Madhapur · Section A", count: 75, appeared: 240, r: 72, w: 18, l: 10, acc: 71.8, pace: "118s" },
        { label: "Madhapur · Section B", count: 75, appeared: 216, r: 65, w: 22, l: 13, acc: 64.2, pace: "126s" },
        { label: "Shamirpet · Section A", count: 75, appeared: 216, r: 61, w: 25, l: 14, acc: 60.5, pace: "132s" }
      ];

      tbody.innerHTML = rows.map(r => `
        <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors text-xs">
          <td class="py-2.5 px-3 font-semibold text-gray-900">${r.label}</td>
          <td class="py-2.5 px-3 text-center font-mono">${r.count}</td>
          <td class="py-2.5 px-3 text-center font-mono">${r.appeared}</td>
          <td class="py-2.5 px-3 text-center font-mono text-emerald-600 font-bold">${r.r}%</td>
          <td class="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">${r.w}%</td>
          <td class="py-2.5 px-3 text-center font-mono text-slate-500">${r.l}%</td>
          <td class="py-2.5 px-3 text-center font-mono font-bold text-slate-900">${r.acc}%</td>
          <td class="py-2.5 px-3 text-right font-mono text-muted">${r.pace}</td>
        </tr>
      `).join("");
    }
  }
}

// ── Subject-wise RWL Stacked Bars ─────────────────────────────────────────
function renderExamSubjectRwl(data) {
  const container = document.getElementById("exam-subject-rwl-bars");
  if (!container) return;

  const list = data.subjectRwlData || [
    { subject: "Physics", right: 63, wrong: 24, left: 13 },
    { subject: "Chemistry", right: 70, wrong: 18, left: 12 },
    { subject: "Mathematics", right: 53, wrong: 27, left: 20 }
  ];

  container.innerHTML = list.map(item => `
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xs font-semibold text-gray-900">
        <span>${item.subject}</span>
        <span class="font-mono text-xs text-muted">${item.right}% Right · ${item.wrong}% Wrong · ${item.left}% Left</span>
      </div>
      <div class="flex h-6 w-full overflow-hidden rounded-lg bg-slate-100 font-mono text-[10px] text-white font-bold">
        <div class="bg-emerald-500 flex items-center justify-center transition-all" style="width: ${item.right}%">${item.right}%</div>
        <div class="bg-rose-500 flex items-center justify-center transition-all" style="width: ${item.wrong}%">${item.wrong}%</div>
        <div class="bg-slate-400 flex items-center justify-center transition-all" style="width: ${item.left}%">${item.left}%</div>
      </div>
    </div>
  `).join("");
}

// ── Absent Students List ──────────────────────────────────────────────────
function renderExamAbsentList(data) {
  const ul = document.getElementById("exam-absent-list");
  if (!ul) return;

  const list = data.absentStudents || [];
  const meta = document.getElementById("exam-absent-meta");
  if (meta) meta.textContent = `${list.length} students did not submit this exam`;

  ul.innerHTML = list.map(s => {
    const initials = (s.name || "Student").split(" ").map(p => p[0]).slice(0, 2).join("");
    const statusBadge = s.markedAbsent
      ? '<span class="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700 border border-rose-200">Marked absent</span>'
      : '<span class="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 border border-amber-200">No submission</span>';

    return `
      <li class="flex items-center justify-between gap-3 py-3">
        <div class="flex items-center gap-3">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-600">
            ${initials}
          </span>
          <div>
            <button onclick="openStudentModal('${s.studentId}')" class="text-sm font-semibold text-gray-900 hover:text-primary transition-colors text-left">
              ${s.name}
            </button>
            <p class="text-[11px] text-muted">${s.rollNo || ''} · ${s.batchName || 'SR MPC'} (${s.branchName || 'Madhapur'}) · ${s.reason || 'Medical'}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge}
        </div>
      </li>
    `;
  }).join("");
}

// ── Question Detail Modal ─────────────────────────────────────────────────
function openExamQuestionDetailModal(qNum) {
  modalViewingQNum = qNum || 1;
  const modal = document.getElementById("exam-question-detail-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  updateExamQuestionModalContent();
}

function closeExamQuestionDetailModal() {
  document.getElementById("exam-question-detail-modal")?.classList.add("hidden");
}

function navigateExamQuestionModal(delta) {
  modalViewingQNum = Math.max(1, Math.min(75, modalViewingQNum + delta));
  updateExamQuestionModalContent();
}

function updateExamQuestionModalContent() {
  const data = getExamAnalyticsData(currentActiveExamId);
  const q = (data.questionAnalysis || [])[modalViewingQNum - 1];
  if (!q) return;

  const numEl = document.getElementById("qmodal-num");
  if (numEl) numEl.textContent = `Q${modalViewingQNum}`;
  const subEl = document.getElementById("qmodal-subject");
  if (subEl) subEl.textContent = q.subjectName;
  const topEl = document.getElementById("qmodal-topic");
  if (topEl) topEl.textContent = q.topicName;
  const diffEl = document.getElementById("qmodal-diff");
  if (diffEl) {
    diffEl.textContent = q.difficulty;
    diffEl.className = `px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${q.difficulty === 'Hard' ? 'bg-rose-100 text-rose-800' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`;
  }

  const stemEl = document.getElementById("qmodal-stem");
  if (stemEl) stemEl.innerHTML = q.questionText || `Detailed problem stem for ${q.subjectName} — ${q.topicName}.`;

  const optEl = document.getElementById("qmodal-options");
  if (optEl) {
    const opts = q.options || [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" },
      { key: "C", text: "Option C" },
      { key: "D", text: "Option D" }
    ];
    optEl.innerHTML = opts.map(o => {
      const isCorrect = o.key === q.correctOption;
      return `
        <div class="p-3 rounded-xl border flex items-center justify-between text-xs ${isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold' : 'border-border bg-white text-gray-800'}">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-md font-mono font-bold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}">${o.key}</span>
            <span>${o.text}</span>
          </div>
          ${isCorrect ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Correct Answer</span>' : ''}
        </div>
      `;
    }).join("");
  }

  const solEl = document.getElementById("qmodal-solution");
  if (solEl) {
    solEl.innerHTML = q.solution || `Step-by-step mathematical derivation for ${q.topicName}. Applying the governing equations yields key ${q.correctOption}.`;
  }

  const counterEl = document.getElementById("qmodal-counter");
  if (counterEl) counterEl.textContent = `Question ${modalViewingQNum} of 75`;

  const prevBtn = document.getElementById("qmodal-prev-btn");
  if (prevBtn) prevBtn.disabled = modalViewingQNum <= 1;
  const nextBtn = document.getElementById("qmodal-next-btn");
  if (nextBtn) nextBtn.disabled = modalViewingQNum >= 75;
}

// =========================================================================
// INNER PAGE 1: /analytics/student/[id]/test-analysis/[examId]
// =========================================================================
function openStudentTestAnalysis(studentId, examId) {
  currentActiveStudentId = studentId || 's-101';
  currentActiveExamId = examId || 'ex-301';
  switchView('student-test-analysis');
}

function renderStudentTestAnalysis(studentId, examId) {
  const key = `${studentId}_${examId}`;
  const data = (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics[key]) || (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics["s-101_ex-301"]);
  if (!data) return;

  // Header
  const nameEl = document.getElementById("test-analysis-student-name");
  if (nameEl) nameEl.textContent = data.studentName;
  const rollEl = document.getElementById("test-analysis-roll");
  if (rollEl) rollEl.textContent = `Roll: ${data.rollNo}`;
  const metaEl = document.getElementById("test-analysis-exam-meta");
  if (metaEl) metaEl.textContent = `${data.examTitle} · ${data.batch} (${data.branch})`;

  // 5 KPIs
  const scoreEl = document.getElementById("ta-kpi-score");
  if (scoreEl) scoreEl.textContent = `${data.submission.totalScore} / ${data.submission.totalMax}`;
  const pctEl = document.getElementById("ta-kpi-pct");
  if (pctEl) pctEl.textContent = `${data.submission.percentage}% score`;
  const pctlEl = document.getElementById("ta-kpi-percentile");
  if (pctlEl) pctlEl.textContent = `${data.submission.percentile}%ile`;
  const rankEl = document.getElementById("ta-kpi-rank");
  if (rankEl) rankEl.textContent = `#${data.submission.rank}`;
  const cohortEl = document.getElementById("ta-kpi-cohort");
  if (cohortEl) cohortEl.textContent = `out of ${data.submission.cohortSize} students`;
  const timeEl = document.getElementById("ta-kpi-time");
  if (timeEl) timeEl.textContent = `${Math.round(data.submission.timeTakenSeconds / 60)}m`;

  // Behavioral Telemetry Strip
  const tel = data.telemetry || {};
  document.getElementById("ta-tel-tabs").textContent = tel.tabSwitchCount ?? 1;
  document.getElementById("ta-tel-revisits").textContent = tel.totalRevisits ?? 4;
  document.getElementById("ta-tel-flagged").textContent = tel.flaggedCount ?? 2;
  document.getElementById("ta-tel-changes").textContent = tel.totalAnswerChanges ?? 1;
  document.getElementById("ta-tel-2ndguess").textContent = tel.secondGuessedToWrong ?? 0;
  document.getElementById("ta-tel-avgtime").textContent = `${tel.avgTimePerQuestionSeconds ?? 129}s`;

  // Subject Breakdown Cards
  const subContainer = document.getElementById("ta-subject-cards");
  if (subContainer) {
    subContainer.innerHTML = (data.subjectBreakdown || []).map(s => `
      <div class="rounded-xl border border-border bg-white p-4 shadow-xs">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-900">${s.subjectName}</h3>
          <span class="font-mono text-xs font-bold text-primary">#${s.rank} in Cohort</span>
        </div>
        <div class="flex items-baseline justify-between mb-2">
          <span class="font-mono text-xl font-bold text-gray-900">${s.marksEarned} <span class="text-xs font-normal text-muted">/ ${s.maxMarks}</span></span>
          <span class="font-mono text-sm font-bold text-emerald-600">${s.accuracy}% acc</span>
        </div>
        <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-2">
          <div class="bg-emerald-500" style="width: ${s.accuracy}%"></div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-muted font-mono">
          <span>${s.correct} Correct</span>
          <span>${s.incorrect} Wrong</span>
          <span>${s.skipped} Skipped</span>
        </div>
      </div>
    `).join("");
  }

  // Topic Breakdown Table
  const topicBody = document.getElementById("ta-topic-table-body");
  if (topicBody) {
    topicBody.innerHTML = (data.topicBreakdown || []).map(t => `
      <tr class="border-b border-border/40 hover:bg-slate-50 transition-colors text-xs">
        <td class="py-2.5 px-3 font-medium text-gray-900">${t.topicName}</td>
        <td class="py-2.5 px-3 text-center font-mono">${t.total}</td>
        <td class="py-2.5 px-3 text-center font-mono font-semibold text-emerald-600">${t.correct}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold ${t.accuracy >= 75 ? 'text-emerald-700' : 'text-amber-700'}">${t.accuracy}%</td>
      </tr>
    `).join("");
  }

  // Question Results
  filterStudentQuestions(taSelectedFilter || "all");
}

function filterStudentQuestions(filter) {
  taSelectedFilter = filter;
  document.querySelectorAll('.ta-q-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.className = "ta-q-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary";
    } else {
      btn.className = "ta-q-filter-btn px-2.5 py-1 text-xs font-medium rounded-lg text-muted hover:text-foreground";
    }
  });

  const key = `${currentActiveStudentId}_${currentActiveExamId}`;
  const data = (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics[key]) || (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics["s-101_ex-301"]);
  if (!data) return;

  const rawList = data.questionResults || [];
  const filtered = rawList.filter(q => {
    if (filter === "wrong" && (!q.selectedAnswer || q.isCorrect)) return false;
    if (filter === "skipped" && q.selectedAnswer != null) return false;
    if (filter === "correct" && !q.isCorrect) return false;
    return true;
  });

  // Palette Grid
  const palGrid = document.getElementById("ta-palette-grid");
  if (palGrid) {
    palGrid.innerHTML = rawList.map((q, i) => {
      const isSelected = i === taSelectedQIdx;
      const statusBg = q.isCorrect ? 'bg-emerald-100 text-emerald-800' :
                       (q.selectedAnswer == null) ? 'bg-slate-200 text-slate-700' :
                       'bg-rose-100 text-rose-800';
      const ring = isSelected ? 'ring-2 ring-primary ring-offset-1 font-bold' : '';

      return `
        <button onclick="selectStudentTestQuestion(${i})" class="h-7 w-7 rounded-full font-mono text-[10px] flex items-center justify-center transition-transform hover:scale-110 ${statusBg} ${ring}">
          ${i + 1}
        </button>
      `;
    }).join("");
  }

  selectStudentTestQuestion(taSelectedQIdx);
}

function selectStudentTestQuestion(idx) {
  taSelectedQIdx = idx;
  const key = `${currentActiveStudentId}_${currentActiveExamId}`;
  const data = (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics[key]) || (APP_DATA.studentExamAnalytics && APP_DATA.studentExamAnalytics["s-101_ex-301"]);
  if (!data) return;

  const q = (data.questionResults || [])[idx] || (data.questionResults || [])[0];
  const panel = document.getElementById("ta-question-detail-panel");
  if (!panel || !q) return;

  const statusBadge = q.isCorrect ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Correct (+4)</span>' :
                      (q.selectedAnswer == null) ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">Skipped (0)</span>' :
                      '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Incorrect (-1)</span>';

  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between pb-3 border-b border-border gap-2">
      <div class="flex items-center gap-2.5">
        <span class="px-2.5 py-1 rounded-lg bg-primary text-white font-mono font-bold text-xs">Question ${q.questionNumber}</span>
        <span class="font-semibold text-slate-900 text-sm">${q.subjectName} · ${q.topicName}</span>
        ${statusBadge}
      </div>
      ${q.errorClassification ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Error Pattern: ${q.errorClassification}</span>` : ''}
    </div>

    <!-- Question Prompt -->
    <div class="p-4 bg-slate-50 border border-border rounded-xl text-sm leading-relaxed text-gray-900">
      ${q.questionText || 'Question item prompt statement'}
    </div>

    <!-- Student Pick vs Correct Key -->
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="p-3.5 rounded-xl border ${q.isCorrect ? 'border-emerald-300 bg-emerald-50/50' : 'border-rose-300 bg-rose-50/50'}">
        <p class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Student Selection</p>
        <p class="font-mono text-base font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}">
          Option ${q.selectedAnswer || 'None (Left Blank)'}
        </p>
      </div>
      <div class="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50">
        <p class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Official Answer Key</p>
        <p class="font-mono text-base font-bold text-emerald-700">Option ${q.correctAnswer}</p>
      </div>
    </div>

    <!-- Timings Comparison -->
    <div class="grid grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-slate-50 text-center text-xs">
      <div>
        <p class="text-[10px] text-muted">This Student</p>
        <p class="font-mono font-bold text-gray-900 text-sm mt-0.5">${q.timeSpentSeconds}s</p>
      </div>
      <div>
        <p class="text-[10px] text-muted">Cohort Mean</p>
        <p class="font-mono font-bold text-gray-900 text-sm mt-0.5">${q.classAvgTime || 118}s</p>
      </div>
      <div>
        <p class="text-[10px] text-muted">Topper Time</p>
        <p class="font-mono font-bold text-emerald-600 text-sm mt-0.5">${q.topperTime || 84}s</p>
      </div>
    </div>

    <div class="flex items-center justify-between pt-2">
      <button onclick="selectStudentTestQuestion(${Math.max(0, taSelectedQIdx - 1)})" ${taSelectedQIdx <= 0 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-slate-900 disabled:opacity-40">Prev</button>
      <button onclick="openExamQuestionDetailModal(${q.questionNumber})" class="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-semibold hover:bg-primary/5">View Full Solution</button>
      <button onclick="selectStudentTestQuestion(${Math.min((data.questionResults || []).length - 1, taSelectedQIdx + 1)})" ${taSelectedQIdx >= (data.questionResults || []).length - 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-slate-900 disabled:opacity-40">Next</button>
    </div>
  `;
}

// =========================================================================
// INNER PAGE 2: /analytics/student/[id]/answer-behavior/[examId]
// =========================================================================
function openStudentAnswerBehavior(studentId, examId) {
  currentActiveStudentId = studentId || 's-101';
  currentActiveExamId = examId || 'ex-301';
  switchView('student-answer-behavior');
}

function renderStudentAnswerBehavior(studentId, examId) {
  const key = `${studentId}_${examId}`;
  const data = (APP_DATA.studentAnswerBehavior && APP_DATA.studentAnswerBehavior[key]) || (APP_DATA.studentAnswerBehavior && APP_DATA.studentAnswerBehavior["s-101_ex-301"]);
  if (!data) return;

  const kpis = data.kpis || { changedCorrectToWrong: 0, flaggedQuestions: 2, avgVisitsPerQuestion: 1.15 };
  document.getElementById("ab-kpi-changed").textContent = kpis.changedCorrectToWrong;
  document.getElementById("ab-kpi-marks-lost").textContent = `${data.totalMarksLost || 0} marks lost to second-guessing`;
  document.getElementById("ab-kpi-flagged").textContent = kpis.flaggedQuestions;
  document.getElementById("ab-kpi-visits").textContent = kpis.avgVisitsPerQuestion;

  // Second-Guess Errors Table
  const tbody = document.getElementById("ab-second-guess-tbody");
  if (tbody) {
    const errs = data.secondGuessErrors || [];
    if (errs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-xs text-emerald-600 font-medium">No second-guess errors recorded for this student! High decisiveness.</td></tr>';
    } else {
      tbody.innerHTML = errs.map(e => `
        <tr class="border-b border-border/40 text-xs">
          <td class="py-2.5 px-3 font-mono font-bold">Q${e.questionNumber}</td>
          <td class="py-2.5 px-3">${e.subject}</td>
          <td class="py-2.5 px-3 font-mono text-emerald-700 font-semibold">${e.originalAnswer}</td>
          <td class="py-2.5 px-3 font-mono text-rose-700 font-semibold">${e.changedTo}</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-rose-600">-${e.marksLost} pts</td>
        </tr>
      `).join("");
    }
  }

  // Indecision Index Bars
  const indContainer = document.getElementById("ab-indecision-bars");
  if (indContainer) {
    const buckets = data.indecisionIndex || [
      { visits: "1 visit", percentage: 86, color: "#10B981" },
      { visits: "2-3 visits", percentage: 12, color: "#3B82F6" },
      { visits: "4+ visits", percentage: 2, color: "#F59E0B" }
    ];
    indContainer.innerHTML = buckets.map(b => `
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-medium text-gray-700">
          <span>${b.visits}</span>
          <span class="font-mono font-bold">${b.percentage}% of questions</span>
        </div>
        <div class="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width: ${b.percentage}%; background-color: ${b.color};"></div>
        </div>
      </div>
    `).join("");
  }

  // Time Pressure Analysis
  const tpContent = document.getElementById("ab-time-pressure-content");
  if (tpContent) {
    const list = data.timePressure || [];
    const correct = list.filter(t => t.isCorrect).length;
    tpContent.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-50 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <p class="font-semibold text-gray-900">${list.length} questions attempted in final 5 minutes</p>
          <p class="text-muted">${correct} correct out of ${list.length} (${list.length > 0 ? Math.round(correct / list.length * 100) : 100}% accuracy)</p>
        </div>
        <div class="flex items-center gap-2">
          ${list.map(t => `
            <span class="px-2 py-1 rounded font-mono text-[11px] font-bold ${t.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              Q${t.questionNumber} ${t.isCorrect ? '✓' : '✗'}
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }
}

// =========================================================================
// INNER PAGE 3: /analytics/batch/[id]/discrimination/[examId]
// =========================================================================
function openBatchDiscrimination(batchId, examId) {
  currentActiveBatchId = batchId || 'b-srmpc-madhapur';
  currentActiveExamId = examId || 'ex-301';
  switchView('batch-discrimination');
}

function renderBatchDiscrimination(batchId, examId) {
  const key = `${batchId}_${examId}`;
  const data = (APP_DATA.batchDiscrimination && APP_DATA.batchDiscrimination[key]) || (APP_DATA.batchDiscrimination && APP_DATA.batchDiscrimination["b-srmpc-madhapur_ex-301"]);
  if (!data) return;

  document.getElementById("disc-batch-name").textContent = data.batchName;
  document.getElementById("disc-exam-name").textContent = data.examName;
  document.getElementById("disc-kpi-avg").textContent = data.averageDiscrimination;
  document.getElementById("disc-kpi-flagged").textContent = data.flaggedCount;

  // Chart
  const canvas = document.getElementById("batchDiscriminationChart");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (charts.batchDiscriminationChart) charts.batchDiscriminationChart.destroy();
    
    const qs = data.questions || [];
    charts.batchDiscriminationChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: qs.map(q => `Q${q.questionNumber}`),
        datasets: [{
          label: 'Discrimination Index',
          data: qs.map(q => q.discriminationIndex),
          backgroundColor: qs.map(q => q.discriminationIndex < 0 ? '#DC2626' : q.discriminationIndex < 0.2 ? '#F59E0B' : '#10B981'),
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
              label: (ctx) => ` DI: ${ctx.parsed.y} (Top: ${qs[ctx.dataIndex].topQuartilePercent}%, Bot: ${qs[ctx.dataIndex].bottomQuartilePercent}%)`
            }
          }
        },
        scales: {
          y: { min: -0.3, max: 0.8, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Flagged Table
  const tbody = document.getElementById("disc-flagged-tbody");
  if (tbody) {
    const flagged = (data.questions || []).filter(q => q.flagged);
    tbody.innerHTML = flagged.map(q => `
      <tr class="border-b border-border/40 text-xs hover:bg-rose-50/30 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-rose-800">Q${q.questionNumber}</td>
        <td class="py-2.5 px-3 text-center font-mono font-bold text-rose-600">${q.discriminationIndex}</td>
        <td class="py-2.5 px-3 text-center font-mono text-emerald-700">${q.topQuartilePercent}%</td>
        <td class="py-2.5 px-3 text-center font-mono text-rose-700">${q.bottomQuartilePercent}%</td>
        <td class="py-2.5 px-3 text-gray-800 font-medium">${q.flagReason}</td>
      </tr>
    `).join("");
  }
}

function onExamDetailFilterChange() {
  const br = document.getElementById("exam-detail-branch-filter")?.value;
  const ba = document.getElementById("exam-detail-batch-filter")?.value;
  const sc = document.getElementById("exam-detail-section-filter")?.value;
  console.log("Exam detail facet changed:", { branch: br, batch: ba, section: sc });
}


// =============================================================================
// Practice Adherence (DPP) — Staff View
// Replicating backend-source/apps/dashboard/src/app/analytics/dpp/page.tsx
// =============================================================================

const dppState = {
  practiceType: 'dpp',
  rangeKey: '7d',
  branchId: '',
  batchId: '',
  section: '',
  tab: 'batches',
  facet: 'all',
  search: '',
  studentSort: 'adherence',
  batchSort: 'adherence',
  page: 0,
  pageSize: 25
};

const PRACTICE_TYPE_LABELS = {
  dpp: 'Daily Practice',
  daily5: 'Daily 5',
  mock: 'Mock Test',
  error_revision: 'Error Revision',
  weekly_clash: 'Weekly Clash',
  custom: 'Custom Practice',
  peer: 'Peer Challenge',
  all: 'All Practice'
};

function getDppAdherenceTone(val) {
  if (val == null) return 'text-muted';
  if (val >= 0.7) return 'text-success';
  if (val >= 0.4) return 'text-warning';
  return 'text-danger';
}

function setDppType(type) {
  dppState.practiceType = type;
  dppState.page = 0;
  Object.keys(PRACTICE_TYPE_LABELS).forEach(k => {
    const btn = document.getElementById('dpp-type-btn-' + k);
    if (btn) {
      if (k === type) {
        btn.className = 'rounded-full border px-3 py-1.5 text-xs font-semibold transition border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition';
      }
    }
  });
  renderDppView();
}

function setDppWindow(win) {
  dppState.rangeKey = win;
  dppState.page = 0;
  ['7d', '14d', '30d'].forEach(w => {
    const btn = document.getElementById('dpp-win-' + w);
    if (btn) {
      if (w === win) {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-foreground';
      }
    }
  });
  const days = win === '30d' ? 30 : win === '14d' ? 14 : 7;
  const to = new Date(2026, 2, 12);
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(from) + ' → ' + fmt(to);
  renderDppView();
}

function onDppBranchChange(val) {
  dppState.branchId = val;
  dppState.page = 0;
  renderDppView();
}

function onDppBatchChange(val) {
  dppState.batchId = val;
  dppState.page = 0;
  renderDppView();
}

function onDppSectionChange(val) {
  dppState.section = val;
  dppState.page = 0;
  renderDppView();
}

function setDppTab(tab) {
  dppState.tab = tab;
  dppState.page = 0;
  const batchesBtn = document.getElementById('dpp-tab-batches-btn');
  const studentsBtn = document.getElementById('dpp-tab-students-btn');
  const batchesWrap = document.getElementById('dpp-batches-table-container');
  const studentsWrap = document.getElementById('dpp-students-table-container');
  const batchHint = document.getElementById('dpp-batches-toolbar-hint');
  const studentFacets = document.getElementById('dpp-student-facets');

  if (tab === 'batches') {
    batchesBtn?.classList.add('text-primary', 'border-b-2', 'border-primary');
    batchesBtn?.classList.remove('text-muted');
    studentsBtn?.classList.remove('text-primary', 'border-b-2', 'border-primary');
    studentsBtn?.classList.add('text-muted');
    batchesWrap?.classList.remove('hidden');
    studentsWrap?.classList.add('hidden');
    batchHint?.classList.remove('hidden');
    studentFacets?.classList.add('hidden');
    studentFacets?.classList.remove('flex');
  } else {
    studentsBtn?.classList.add('text-primary', 'border-b-2', 'border-primary');
    studentsBtn?.classList.remove('text-muted');
    batchesBtn?.classList.remove('text-primary', 'border-b-2', 'border-primary');
    batchesBtn?.classList.add('text-muted');
    studentsWrap?.classList.remove('hidden');
    batchesWrap?.classList.add('hidden');
    batchHint?.classList.add('hidden');
    studentFacets?.classList.remove('hidden');
    studentFacets?.classList.add('flex');
  }
  renderDppView();
}

function setDppFacet(facet) {
  dppState.facet = facet;
  dppState.page = 0;
  ['all', 'at_risk', 'never', 'on_streak'].forEach(f => {
    const btn = document.getElementById('dpp-facet-' + f);
    if (btn) {
      if (f === facet) {
        btn.className = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted hover:text-foreground';
      }
    }
  });
  renderDppView();
}

function onDppSearch(q) {
  dppState.search = q || '';
  dppState.page = 0;
  const clearBtn = document.getElementById('dpp-clear-search');
  if (clearBtn) {
    if (q) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderDppView();
}

function clearDppSearch() {
  const input = document.getElementById('dpp-search-input');
  if (input) input.value = '';
  onDppSearch('');
}

function onDppSortChange(sort) {
  if (dppState.tab === 'batches') {
    dppState.batchSort = sort;
  } else {
    dppState.studentSort = sort;
  }
  dppState.page = 0;
  renderDppView();
}

function changeDppPage(delta) {
  dppState.page += delta;
  renderDppView();
}

function drillIntoBatchDpp(batchId, branchId) {
  if (!batchId) return;
  dppState.batchId = batchId;
  if (branchId) dppState.branchId = branchId;
  const batchFilter = document.getElementById('dpp-batch-filter');
  if (batchFilter) batchFilter.value = batchId;
  setDppTab('students');
}

function openStudentDpp(studentId) {
  currentActiveStudentId = studentId;
  switchView('student-practice');
}


// =============================================================================
// Practice Adherence (DPP) — Interactive Calendar & DateRangeFilter
// =============================================================================

const dppCalendarState = {
  open: false,
  cursorYear: 2026,
  cursorMonth: 2, // March (0-indexed)
  draftFrom: '2026-02-13',
  draftTo: '2026-03-12',
  hoverDay: null
};

function toggleDppCalendar() {
  dppCalendarState.open = !dppCalendarState.open;
  const popover = document.getElementById('dpp-calendar-popover');
  if (popover) {
    if (dppCalendarState.open) {
      popover.classList.remove('hidden');
      renderDppCalendar();
    } else {
      popover.classList.add('hidden');
    }
  }
}

function closeDppCalendar() {
  dppCalendarState.open = false;
  const popover = document.getElementById('dpp-calendar-popover');
  if (popover) popover.classList.add('hidden');
}

function shiftDppCalendarMonth(delta) {
  dppCalendarState.cursorMonth += delta;
  if (dppCalendarState.cursorMonth < 0) {
    dppCalendarState.cursorMonth = 11;
    dppCalendarState.cursorYear -= 1;
  } else if (dppCalendarState.cursorMonth > 11) {
    dppCalendarState.cursorMonth = 0;
    dppCalendarState.cursorYear += 1;
  }
  renderDppCalendar();
}

function selectDppCalendarPreset(presetKey, days) {
  dppState.rangeKey = presetKey;
  dppState.windowDays = days;
  const to = new Date(2026, 2, 12);
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  dppCalendarState.draftFrom = ymd(from);
  dppCalendarState.draftTo = ymd(to);
  
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(from) + ' → ' + fmt(to);

  ['7d', '14d', '30d'].forEach(w => {
    const btn = document.getElementById('dpp-win-' + w);
    if (btn) {
      if (w === presetKey) {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-foreground';
      }
    }
  });

  closeDppCalendar();
  renderDppView();
}

function onDppCalendarDayClick(year, month, day) {
  const pad = n => String(n).padStart(2, '0');
  const clickedYmd = `${year}-${pad(month + 1)}-${pad(day)}`;

  if (!dppCalendarState.draftFrom || dppCalendarState.draftTo) {
    dppCalendarState.draftFrom = clickedYmd;
    dppCalendarState.draftTo = '';
  } else {
    if (clickedYmd < dppCalendarState.draftFrom) {
      dppCalendarState.draftFrom = clickedYmd;
      dppCalendarState.draftTo = '';
    } else {
      dppCalendarState.draftTo = clickedYmd;
    }
  }
  renderDppCalendar();
}

function onDppCalendarDayHover(year, month, day) {
  if (dppCalendarState.draftFrom && !dppCalendarState.draftTo) {
    const pad = n => String(n).padStart(2, '0');
    dppCalendarState.hoverDay = `${year}-${pad(month + 1)}-${pad(day)}`;
    renderDppCalendar();
  }
}

function applyDppCustomRange() {
  if (!dppCalendarState.draftFrom) return;
  const fromStr = dppCalendarState.draftFrom;
  const toStr = dppCalendarState.draftTo || dppCalendarState.draftFrom;
  
  const fromD = new Date(fromStr);
  const toD = new Date(toStr);
  const diffDays = Math.max(1, Math.round((toD - fromD) / 86400000) + 1);

  dppState.rangeKey = 'custom';
  dppState.customFrom = fromStr;
  dppState.customTo = toStr;
  dppState.windowDays = diffDays;

  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(fromD) + ' → ' + fmt(toD);

  ['7d', '14d', '30d'].forEach(w => {
    const btn = document.getElementById('dpp-win-' + w);
    if (btn) btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-foreground';
  });

  closeDppCalendar();
  renderDppView();
}

function renderDppCalendar() {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthLbl = document.getElementById('dpp-cal-month-label');
  if (monthLbl) {
    monthLbl.textContent = `${monthNames[dppCalendarState.cursorMonth]} ${dppCalendarState.cursorYear}`;
  }

  ['7d', '14d', '30d', '90d'].forEach(p => {
    const el = document.getElementById('dpp-cal-preset-' + p);
    if (el) {
      if (dppState.rangeKey === p) {
        el.className = 'w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary transition-colors';
      } else {
        el.className = 'w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors';
      }
    }
  });

  const grid = document.getElementById('dpp-cal-days-grid');
  if (!grid) return;

  const firstDayOfMonth = new Date(dppCalendarState.cursorYear, dppCalendarState.cursorMonth, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const startDate = new Date(dppCalendarState.cursorYear, dppCalendarState.cursorMonth, 1 - startDayOfWeek);

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const effectiveEnd = dppCalendarState.draftTo || (dppCalendarState.draftFrom && dppCalendarState.hoverDay && dppCalendarState.hoverDay >= dppCalendarState.draftFrom ? dppCalendarState.hoverDay : dppCalendarState.draftFrom);

  let cellsHtml = '';
  for (let i = 0; i < 42; i++) {
    const current = new Date(startDate.getTime() + i * 86400000);
    const currYmd = ymd(current);
    const isCurrentMonth = current.getMonth() === dppCalendarState.cursorMonth;
    const isStart = currYmd === dppCalendarState.draftFrom;
    const isEnd = currYmd === dppCalendarState.draftTo;
    const isInRange = dppCalendarState.draftFrom && effectiveEnd && currYmd >= dppCalendarState.draftFrom && currYmd <= effectiveEnd;

    let cellClass = 'h-7 w-7 mx-auto flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer select-none ';
    let wrapperClass = 'p-0.5 relative ';

    if (isStart || isEnd) {
      cellClass += 'bg-primary text-white font-bold shadow-xs';
    } else if (isInRange) {
      cellClass += 'text-primary font-semibold';
      wrapperClass += 'bg-primary/10 ';
      if (currYmd === dppCalendarState.draftFrom) wrapperClass += 'rounded-l-full ';
      if (currYmd === effectiveEnd) wrapperClass += 'rounded-r-full ';
    } else if (isCurrentMonth) {
      cellClass += 'text-gray-900 hover:bg-slate-100';
    } else {
      cellClass += 'text-muted/40 hover:bg-slate-50';
    }

    cellsHtml += `
      <div class="${wrapperClass}" 
           onclick="onDppCalendarDayClick(${current.getFullYear()}, ${current.getMonth()}, ${current.getDate()})"
           onmouseenter="onDppCalendarDayHover(${current.getFullYear()}, ${current.getMonth()}, ${current.getDate()})">
        <div class="${cellClass}">${current.getDate()}</div>
      </div>
    `;
  }
  grid.innerHTML = cellsHtml;

  const sumEl = document.getElementById('dpp-cal-summary-text');
  if (sumEl) {
    if (dppCalendarState.draftFrom) {
      const d1 = new Date(dppCalendarState.draftFrom);
      const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (dppCalendarState.draftTo) {
        const d2 = new Date(dppCalendarState.draftTo);
        const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
        sumEl.textContent = `${fmt(d1)} → ${fmt(d2)} (${days} days)`;
      } else {
        sumEl.textContent = `${fmt(d1)} → Pick end date`;
      }
    } else {
      sumEl.textContent = 'Select start and end dates';
    }
  }
}

// Close calendar on outside click
document.addEventListener('click', (e) => {
  const container = document.getElementById('dpp-calendar-container');
  if (container && !container.contains(e.target)) {
    closeDppCalendar();
  }
});

function renderDppView() {
  const dppData = (typeof APP_DATA !== 'undefined' && APP_DATA.dpp) || (typeof DATA !== 'undefined' && DATA.dpp) || (window.__DEMO_DATA__ && window.__DEMO_DATA__.dpp) || {};
  const allBatches = dppData.byBatch || [];
  const allStudents = dppData.students || [];

  // Update Header title
  const headerTitle = document.getElementById('dpp-header-title');
  if (headerTitle) {
    headerTitle.textContent = (PRACTICE_TYPE_LABELS[dppState.practiceType] || 'Daily Practice') + ' adherence';
  }

  // Filter batches
  let filteredBatches = allBatches.filter(b => {
    if (dppState.branchId && b.branchId !== dppState.branchId) return false;
    if (dppState.batchId && b.batchId !== dppState.batchId) return false;
    if (dppState.search) {
      const q = dppState.search.toLowerCase();
      if (!b.batchName.toLowerCase().includes(q) && !b.branch.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Sort batches
  filteredBatches.sort((a, b) => {
    switch (dppState.batchSort) {
      case 'adherence_desc': return b.adherence - a.adherence;
      case 'accuracy': return (b.avgAccuracy || 0) - (a.avgAccuracy || 0);
      case 'size': return b.students - a.students;
      case 'name': return a.batchName.localeCompare(b.batchName);
      default: return a.adherence - b.adherence; // worst first default
    }
  });

  // Filter students
  let filteredStudents = allStudents.filter(s => {
    if (dppState.branchId && s.branchId !== dppState.branchId) return false;
    if (dppState.batchId && s.batchId !== dppState.batchId) return false;
    if (dppState.section && s.section !== dppState.section) return false;
    if (dppState.facet === 'at_risk') {
      if (s.adherence >= 0.4) return false;
    } else if (dppState.facet === 'never') {
      if (s.daysDone > 0) return false;
    } else if (dppState.facet === 'on_streak') {
      if (s.streak <= 0) return false;
    }
    if (dppState.search) {
      const q = dppState.search.toLowerCase();
      const match = (s.name + ' ' + s.batchName + ' ' + (s.section || '') + ' ' + (s.rollNo || '')).toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  // Sort students
  filteredStudents.sort((a, b) => {
    switch (dppState.studentSort) {
      case 'adherence_desc': return b.adherence - a.adherence;
      case 'accuracy': return (b.avgAccuracy || 0) - (a.avgAccuracy || 0);
      case 'streak': return b.streak - a.streak;
      case 'name': return a.name.localeCompare(b.name);
      default: return a.adherence - b.adherence; // worst first default
    }
  });

  // KPI Calculations
  const scopedStudents = allStudents.filter(s => {
    if (dppState.branchId && s.branchId !== dppState.branchId) return false;
    if (dppState.batchId && s.batchId !== dppState.batchId) return false;
    return true;
  });
  const totalCount = scopedStudents.length || dppData.totals?.students || 4765;
  const activeCount = scopedStudents.filter(s => s.daysDone > 0).length || dppData.totals?.activeStudents || 3240;
  const avgAdh = scopedStudents.length
    ? (scopedStudents.reduce((acc, s) => acc + s.adherence, 0) / scopedStudents.length)
    : (dppData.totals?.adherence || 0.742);
  const avgAcc = scopedStudents.filter(s => s.avgAccuracy != null).length
    ? Math.round(scopedStudents.filter(s => s.avgAccuracy != null).reduce((acc, s) => acc + s.avgAccuracy, 0) / scopedStudents.filter(s => s.avgAccuracy != null).length)
    : Math.round(dppData.totals?.avgAccuracy || 78);
  const onStreakCount = scopedStudents.filter(s => s.streak > 0).length || dppData.totals?.onStreak || 1845;

  // Update KPI Tiles
  const elStudents = document.getElementById('dpp-kpi-students');
  const elStudentsSub = document.getElementById('dpp-kpi-students-sub');
  const elAdherence = document.getElementById('dpp-kpi-adherence');
  const elAdherenceSub = document.getElementById('dpp-kpi-adherence-sub');
  const elAccuracy = document.getElementById('dpp-kpi-accuracy');
  const elStreak = document.getElementById('dpp-kpi-streak');

  if (elStudents) elStudents.textContent = totalCount.toLocaleString();
  if (elStudentsSub) elStudentsSub.textContent = activeCount.toLocaleString() + ' practised at least once';
  if (elAdherence) {
    elAdherence.textContent = Math.round(avgAdh * 100) + '%';
    elAdherence.className = 'mt-2 font-mono text-2xl font-bold tabular-nums ' + getDppAdherenceTone(avgAdh);
  }
  const windowDays = dppState.rangeKey === '30d' ? 30 : dppState.rangeKey === '14d' ? 14 : 7;
  if (elAdherenceSub) elAdherenceSub.textContent = Math.round(totalCount * avgAdh * windowDays).toLocaleString() + ' of ' + (totalCount * windowDays).toLocaleString() + ' student-days';
  if (elAccuracy) elAccuracy.textContent = avgAcc + '%';
  if (elStreak) elStreak.textContent = onStreakCount.toLocaleString();

  // Update counts on badges and facets
  const badgeBatches = document.getElementById('dpp-badge-batches-count');
  const badgeStudents = document.getElementById('dpp-badge-students-count');
  if (badgeBatches) badgeBatches.textContent = filteredBatches.length;
  if (badgeStudents) badgeStudents.textContent = filteredStudents.length;

  const facetAll = document.getElementById('dpp-facet-count-all');
  const facetRisk = document.getElementById('dpp-facet-count-at_risk');
  const facetNever = document.getElementById('dpp-facet-count-never');
  const facetStreak = document.getElementById('dpp-facet-count-on_streak');
  if (facetAll) facetAll.textContent = allStudents.length;
  if (facetRisk) facetRisk.textContent = allStudents.filter(s => s.adherence < 0.4).length;
  if (facetNever) facetNever.textContent = allStudents.filter(s => s.daysDone === 0).length;
  if (facetStreak) facetStreak.textContent = allStudents.filter(s => s.streak > 0).length;

  // Update sort dropdown options based on tab
  const sortSelect = document.getElementById('dpp-sort-select');
  if (sortSelect) {
    if (dppState.tab === 'batches') {
      sortSelect.innerHTML = [
        '<option value="adherence"' + (dppState.batchSort === 'adherence' ? ' selected' : '') + '>Lowest adherence</option>',
        '<option value="adherence_desc"' + (dppState.batchSort === 'adherence_desc' ? ' selected' : '') + '>Highest adherence</option>',
        '<option value="accuracy"' + (dppState.batchSort === 'accuracy' ? ' selected' : '') + '>Highest accuracy</option>',
        '<option value="size"' + (dppState.batchSort === 'size' ? ' selected' : '') + '>Most students</option>',
        '<option value="name"' + (dppState.batchSort === 'name' ? ' selected' : '') + '>Name (A–Z)</option>'
      ].join('');
    } else {
      sortSelect.innerHTML = [
        '<option value="adherence"' + (dppState.studentSort === 'adherence' ? ' selected' : '') + '>Lowest adherence</option>',
        '<option value="adherence_desc"' + (dppState.studentSort === 'adherence_desc' ? ' selected' : '') + '>Highest adherence</option>',
        '<option value="accuracy"' + (dppState.studentSort === 'accuracy' ? ' selected' : '') + '>Highest accuracy</option>',
        '<option value="streak"' + (dppState.studentSort === 'streak' ? ' selected' : '') + '>Longest streak</option>',
        '<option value="name"' + (dppState.studentSort === 'name' ? ' selected' : '') + '>Name (A–Z)</option>'
      ].join('');
    }
  }

  // Render Batches Table
  const batchTbody = document.getElementById('dpp-batch-tbody');
  if (batchTbody) {
    if (filteredBatches.length === 0) {
      batchTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-sm text-muted">Nothing matches this search or filter.</td></tr>';
    } else {
      const pageRows = filteredBatches.slice(dppState.page * dppState.pageSize, (dppState.page + 1) * dppState.pageSize);
      batchTbody.innerHTML = pageRows.map(b => [
        '<tr role="button" tabindex="0" onclick="drillIntoBatchDpp(\'' + b.batchId + '\', \'' + b.branchId + '\')" class="cursor-pointer border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
        '  <td class="px-5 py-3 font-semibold text-gray-900">',
        '    <span>' + b.batchName + '</span>',
        '    <span class="text-[11px] font-normal text-muted ml-2">· ' + b.branch + '</span>',
        '  </td>',
        '  <td class="px-5 py-3 text-right tabular-nums text-muted">' + b.students + '</td>',
        '  <td class="px-5 py-3 text-right font-mono font-bold tabular-nums ' + getDppAdherenceTone(b.adherence) + '">',
        '    ' + Math.round(b.adherence * 100) + '%',
        '  </td>',
        '  <td class="px-5 py-3 text-right tabular-nums text-muted font-medium">' + (b.avgAccuracy ? Math.round(b.avgAccuracy) + '%' : '—') + '</td>',
        '  <td class="px-5 py-3 text-right tabular-nums text-muted">' + b.onStreak + '/' + b.students + '</td>',
        '</tr>'
      ].join('')).join('');
    }
  }

  // Render Students Table
  const studentsTbody = document.getElementById('dpp-students-tbody');
  if (studentsTbody) {
    if (filteredStudents.length === 0) {
      studentsTbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-sm text-muted">Nothing matches this search or filter.</td></tr>';
    } else {
      const pageRows = filteredStudents.slice(dppState.page * dppState.pageSize, (dppState.page + 1) * dppState.pageSize);
      studentsTbody.innerHTML = pageRows.map(s => [
        '<tr role="button" tabindex="0" onclick="openStudentDpp(\'' + s.studentId + '\')" class="cursor-pointer border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
        '  <td class="px-5 py-3 font-medium text-gray-900">',
        '    <span class="font-semibold hover:text-primary hover:underline">' + s.name + '</span>',
        s.section ? '    <span class="text-[10px] text-muted ml-1.5">· ' + s.section + '</span>' : '',
        '  </td>',
        '  <td class="px-5 py-3 text-muted">' + (s.batchName || '—') + '</td>',
        '  <td class="px-5 py-3 text-right tabular-nums text-muted">' + s.daysDone + '/' + windowDays + '</td>',
        '  <td class="px-5 py-3 text-right font-mono font-bold tabular-nums ' + getDppAdherenceTone(s.adherence) + '">',
        '    ' + Math.round(s.adherence * 100) + '%',
        '  </td>',
        '  <td class="px-5 py-3 text-right tabular-nums text-muted font-medium">' + (s.avgAccuracy ? Math.round(s.avgAccuracy) + '%' : '—') + '</td>',
        '  <td class="px-5 py-3 text-right tabular-nums font-semibold ' + (s.streak > 0 ? 'text-amber-600' : 'text-muted') + '">',
        '    ' + (s.streak > 0 ? ('🔥 ' + s.streak + 'd') : '—'),
        '  </td>',
        '  <td class="px-5 py-3 text-right text-[11px] text-muted">' + (s.lastCompleted ? s.lastCompleted : 'never') + '</td>',
        '</tr>'
      ].join('')).join('');
    }
  }

  // Update Pagination Controls
  const activeCountRows = dppState.tab === 'batches' ? filteredBatches.length : filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(activeCountRows / dppState.pageSize));
  const safePage = Math.min(dppState.page, totalPages - 1);
  const startRow = activeCountRows === 0 ? 0 : safePage * dppState.pageSize + 1;
  const endRow = Math.min((safePage + 1) * dppState.pageSize, activeCountRows);

  const pagInfo = document.getElementById('dpp-pagination-info');
  const pagCounter = document.getElementById('dpp-page-counter');
  const prevBtn = document.getElementById('dpp-prev-btn');
  const nextBtn = document.getElementById('dpp-next-btn');

  if (pagInfo) pagInfo.textContent = startRow + '–' + endRow + ' of ' + activeCountRows;
  if (pagCounter) pagCounter.textContent = (safePage + 1) + ' / ' + totalPages;
  if (prevBtn) prevBtn.disabled = safePage <= 0;
  if (nextBtn) nextBtn.disabled = safePage >= totalPages - 1;
}

// =============================================================================
// Compare Explorer (Score Matrix)
// Replicating backend-source/apps/dashboard/src/app/analytics/compare/page.tsx
// =============================================================================

const compareState = {
  grain: 'students',
  chartMode: 'bars',
  subjectFilter: '',
  search: '',
  sort: 'avg',
  dir: 'desc',
  page: 1,
  pageSize: 25,
  excludedExams: new Set(),
  selectedRows: new Set()
};

function setCompareGrain(grain) {
  compareState.grain = grain;
  compareState.page = 1;
  compareState.selectedRows.clear();
  const studBtn = document.getElementById('compare-grain-students');
  const batchBtn = document.getElementById('compare-grain-batches');
  const bandRows = document.getElementById('compare-band-rows');
  const searchInput = document.getElementById('compare-search-input');
  if (grain === 'students') {
    studBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-white text-primary shadow-xs';
    batchBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
    if (bandRows) bandRows.textContent = 'Students — tick up to 10 at a time to plot on the chart';
    if (searchInput) searchInput.placeholder = 'Search students…';
  } else {
    batchBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-white text-primary shadow-xs';
    studBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
    if (bandRows) bandRows.textContent = 'Batches — tick up to 10 at a time to plot on the chart';
    if (searchInput) searchInput.placeholder = 'Search batches…';
  }
  renderCompareView();
}

function setCompareChartMode(mode) {
  compareState.chartMode = mode;
  const barsBtn = document.getElementById('compare-mode-bars');
  const linesBtn = document.getElementById('compare-mode-lines');
  if (mode === 'bars') {
    barsBtn.className = 'rounded-md px-2.5 py-1 text-xs font-semibold bg-white text-primary shadow-xs';
    linesBtn.className = 'rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900';
  } else {
    linesBtn.className = 'rounded-md px-2.5 py-1 text-xs font-semibold bg-white text-primary shadow-xs';
    barsBtn.className = 'rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900';
  }
  renderCompareView();
}

function setCompareSubject(subject) {
  compareState.subjectFilter = (subject || '').toLowerCase();
  ['all', 'physics', 'chemistry', 'mathematics'].forEach(s => {
    const btn = document.getElementById('compare-subj-' + s);
    if (btn) {
      if ((s === 'all' && !compareState.subjectFilter) || s === compareState.subjectFilter) {
        btn.className = 'rounded-full border px-3 py-1 text-xs font-semibold transition-colors border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-gray-900 transition-colors';
      }
    }
  });
  renderCompareView();
}

function onCompareSearch(q) {
  compareState.search = q || '';
  compareState.page = 1;
  renderCompareView();
}

function setComparePageSize(size) {
  compareState.pageSize = Number(size) || 25;
  compareState.page = 1;
  renderCompareView();
}

function changeComparePage(delta) {
  compareState.page += delta;
  renderCompareView();
}

function toggleCompareExam(id) {
  if (compareState.excludedExams.has(id)) {
    compareState.excludedExams.delete(id);
  } else {
    compareState.excludedExams.add(id);
  }
  renderCompareView();
}

function toggleCompareRow(id) {
  if (compareState.selectedRows.has(id)) {
    compareState.selectedRows.delete(id);
  } else {
    if (compareState.selectedRows.size < 10) {
      compareState.selectedRows.add(id);
    }
  }
  renderCompareView();
}

function clearComparePlots() {
  compareState.selectedRows.clear();
  renderCompareView();
}

function toggleCompareSort(key) {
  if (compareState.sort === key) {
    compareState.dir = compareState.dir === 'desc' ? 'asc' : 'desc';
  } else {
    compareState.sort = key;
    compareState.dir = 'desc';
  }
  renderCompareView();
}

function toggleCompareSelectAll() {
  if (compareState.selectedRows.size > 0) {
    compareState.selectedRows.clear();
  } else {
    const all = window.__currentCompareSortedRows || [];
    all.slice(0, 10).forEach(r => compareState.selectedRows.add(r.id));
  }
  renderCompareView();
}

function getCompareAccuracyColor(pct) {
  if (pct == null) return '';
  if (pct >= 70) return '#10B981';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
}

function renderCompareView() {
  // Marked as: "Leave as it is in the existing app" (Developer directive)
}

function renderCompareHeaders(exams, includedIdx) {
  const headRow = document.getElementById('compare-header-row');
  if (!headRow) return;

  const sortIcon = (key) => {
    if (compareState.sort !== key) return '';
    return compareState.dir === 'asc' ? ' ▲' : ' ▼';
  };

  const frozenHeaders = [
    '<th class="sticky left-0 z-30 bg-surface border-b border-border px-2.5 py-2 text-right w-14 cursor-pointer select-none" onclick="toggleCompareSort(\'rank\')">Rank' + sortIcon('rank') + '</th>',
    '<th class="sticky left-14 z-30 bg-surface border-b border-border px-3 py-2 text-left min-w-[200px]">',
    '  <div class="flex items-center gap-2">',
    '    <input type="checkbox" onchange="toggleCompareSelectAll()" class="h-3.5 w-3.5 accent-primary cursor-pointer" title="Select top 10 / clear all">',
    '    <span class="cursor-pointer select-none" onclick="toggleCompareSort(\'name\')">Name' + sortIcon('name') + '</span>',
    '  </div>',
    '</th>',
    '<th class="sticky left-64 z-30 bg-surface border-b border-border px-2.5 py-2 text-right w-20 cursor-pointer select-none" onclick="toggleCompareSort(\'avg\')">Avg' + sortIcon('avg') + '</th>',
    '<th class="sticky left-[336px] z-30 bg-surface border-b border-border px-2.5 py-2 text-right w-24 cursor-pointer select-none" onclick="toggleCompareSort(\'sigma\')">Fluct.' + sortIcon('sigma') + '</th>',
    '<th class="sticky left-[432px] z-30 bg-surface border-b border-border px-2.5 py-2 text-right w-20 cursor-pointer select-none" onclick="toggleCompareSort(\'trend\')">Trend' + sortIcon('trend') + '</th>',
    '<th class="sticky left-[512px] z-30 bg-surface border-b border-r-2 border-border px-2.5 py-2 text-right w-20">Tests</th>'
  ];

  const dynamicHeaders = exams.map((e, i) => {
    const isExcluded = compareState.excludedExams.has(e.id);
    return [
      '<th class="border-b border-border px-2.5 py-2 text-right min-w-[100px]' + (isExcluded ? ' opacity-40' : '') + '">',
      '  <div class="flex flex-col items-end gap-0.5">',
      '    <div class="flex items-center gap-1.5">',
      '      <input type="checkbox" ' + (!isExcluded ? 'checked' : '') + ' onchange="toggleCompareExam(\'' + e.id + '\')" class="h-3.5 w-3.5 accent-primary cursor-pointer" title="Include in averages">',
      '      <span class="font-semibold text-gray-900 cursor-pointer select-none hover:text-primary" onclick="toggleCompareSort(\'col:' + i + '\')">' + e.code + sortIcon('col:' + i) + '</span>',
      '    </div>',
      '    <span class="text-[10px] font-normal text-muted">' + (e.date || '') + '</span>',
      '  </div>',
      '</th>'
    ].join('');
  });

  headRow.innerHTML = frozenHeaders.join('') + dynamicHeaders.join('');
}

function renderCompareTableBody(rows, exams, includedIdx, subjIdx) {
  const tbody = document.getElementById('matrix-table-tbody');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" class="p-8 text-center text-sm text-muted">No students or batches match the search.</td></tr>';
    return;
  }

  const startIdx = (compareState.page - 1) * compareState.pageSize;
  const pageRows = rows.slice(startIdx, startIdx + compareState.pageSize);

  tbody.innerHTML = pageRows.map(row => {
    const isChecked = compareState.selectedRows.has(row.id);
    const subLabels = ['Phy', 'Chem', 'Math'];

    const frozenCells = [
      '<td class="sticky left-0 z-10 bg-surface border-b border-border px-2.5 py-2 text-right font-mono text-muted tabular-nums">#' + row.rank + '</td>',
      '<td class="sticky left-14 z-10 bg-surface border-b border-border px-3 py-2 min-w-[200px]">',
      '  <div class="flex items-center gap-2">',
      '    <input type="checkbox" ' + (isChecked ? 'checked' : '') + ' onchange="toggleCompareRow(\'' + row.id + '\')" class="h-3.5 w-3.5 accent-primary cursor-pointer">',
      '    <div class="min-w-0">',
      compareState.grain === 'students'
        ? ('      <a href="#student/' + row.id + '" onclick="currentActiveStudentId=\'' + row.id + '\'; switchView(\'student-detail\');" class="block font-semibold text-gray-900 hover:text-primary truncate">' + row.name + '</a>' +
           '      <span class="block text-[10px] text-muted truncate">' + (row.batch ? (row.batch + ' · ' + row.rollNo) : row.rollNo) + '</span>')
        : ('      <a href="#batch/' + (row.meta?.batchId || row.id) + '" onclick="currentActiveBatchId=\'' + (row.meta?.batchId || row.id) + '\'; switchView(\'batch-detail\');" class="block font-semibold text-gray-900 hover:text-primary truncate">' + row.name + '</a>' +
           '      <span class="block text-[10px] text-muted truncate">' + (row.branch ? (row.branch + ' · ' + (row.meta?.size ? row.meta.size + ' students' : '')) : '') + '</span>'),
      '    </div>',
      '  </div>',
      '</td>',
      '<td class="sticky left-64 z-10 bg-surface border-b border-border px-2.5 py-2 text-right font-bold tabular-nums text-gray-900">' + (row.avgMark != null ? row.avgMark.toFixed(1) : '—') + '</td>',
      '<td class="sticky left-[336px] z-10 bg-surface border-b border-border px-2.5 py-2 text-right font-mono tabular-nums ' + (row.sigma != null && row.sigma >= 12 ? 'text-amber-600 font-bold' : 'text-slate-700') + '">' + (row.sigma != null ? row.sigma.toFixed(1) : '—') + '</td>',
      '<td class="sticky left-[432px] z-10 bg-surface border-b border-border px-2.5 py-2 text-right font-mono tabular-nums ' + (row.trend != null ? (row.trend > 1 ? 'text-emerald-600 font-bold' : row.trend < -1 ? 'text-rose-600 font-bold' : 'text-muted') : 'text-muted') + '">' + (row.trend != null ? ((row.trend > 0 ? '+' : '') + row.trend.toFixed(1)) : '—') + '</td>',
      '<td class="sticky left-[512px] z-10 bg-surface border-b border-r-2 border-border px-2.5 py-2 text-right text-[11px] tabular-nums text-muted">' + (row.present != null ? (row.present + 'P · ' + row.absent + 'A') : '—') + '</td>'
    ];

    const dynamicCells = exams.map((e, ei) => {
      const isExcluded = compareState.excludedExams.has(e.id);
      const mark = row.effectiveMarks[ei];
      const pct = row.effectivePcts[ei];
      const color = getCompareAccuracyColor(pct);

      let subLine = '';
      if (subjIdx < 0 && row.subScores[ei] && row.subScores[ei].some(v => v != null)) {
        subLine = '<span class="block text-[9px] text-muted whitespace-nowrap">' +
          row.subScores[ei].map((sv, si) => sv != null ? (subLabels[si] + ' ' + sv) : null).filter(Boolean).join(' · ') +
          '</span>';
      }

      return [
        '<td class="border-b border-border px-2.5 py-1.5 text-right' + (isExcluded ? ' opacity-40' : '') + '">',
        '  <div class="inline-flex flex-col items-end">',
        mark != null
          ? ('    <span class="font-semibold tabular-nums" style="color: ' + color + '" title="' + (pct != null ? pct.toFixed(1) + '%' : '') + '">' + mark + '</span>')
          : '    <span class="text-muted/60">—</span>',
        subLine,
        '  </div>',
        '</td>'
      ].join('');
    });

    return '<tr class="hover:bg-primary/5 transition-colors h-10">' + frozenCells.join('') + dynamicCells.join('') + '</tr>';
  }).join('');
}

function renderCompareChart(exams, includedIdx, allRows, subjIdx) {
  const canvas = document.getElementById('matrixChart');
  if (!canvas) return;

  const selectedRowsList = allRows.filter(r => compareState.selectedRows.has(r.id));
  const palette = [
    '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#84CC16'
  ];

  if (charts.matrixChart) {
    charts.matrixChart.destroy();
  }

  const labels = includedIdx.map(ei => exams[ei].code);

  if (compareState.chartMode === 'lines') {
    const datasets = selectedRowsList.map((r, idx) => ({
      label: r.name,
      data: includedIdx.map(ei => r.effectivePcts[ei]),
      borderColor: palette[idx % palette.length],
      backgroundColor: palette[idx % palette.length] + '20',
      borderWidth: 2.5,
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    charts.matrixChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + '%' : '—')
            }
          }
        },
        scales: {
          y: { min: 0, max: 100, grid: { color: '#F1F5F9' }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else {
    const datasets = selectedRowsList.map((r, idx) => ({
      label: r.name,
      data: includedIdx.map(ei => r.effectiveMarks[ei]),
      backgroundColor: palette[idx % palette.length],
      borderRadius: 4,
      barPercentage: 0.8
    }));

    charts.matrixChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y + ' marks' : '—')
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// =============================================================================
// Institution Cohort Analytics (Batch Comparison)
// Exact replica of backend-source/apps/dashboard/src/app/analytics/institution/cohorts/
// =============================================================================

const cohortsState = {
  visibleCohorts: new Set(['c-jee-2026', 'c-jee-2025', 'c-neet-2026']),
  activePerformerCohort: 'c-jee-2026',
  lookupCohort: 'c-jee-2026',
  selectedStudentId: 's-104'
};

function toggleCohortVisibility(cohortId) {
  if (cohortsState.visibleCohorts.has(cohortId)) {
    if (cohortsState.visibleCohorts.size > 1) {
      cohortsState.visibleCohorts.delete(cohortId);
    }
  } else {
    cohortsState.visibleCohorts.add(cohortId);
  }
  renderCohortsView();
}

function setCohortPerformerTab(cohortId) {
  cohortsState.activePerformerCohort = cohortId;
  renderCohortsView();
}

function setCohortLookupTab(cohortId) {
  cohortsState.lookupCohort = cohortId;
  const cohortsData = (APP_DATA && APP_DATA.cohorts) || {};
  const c = (cohortsData.cohorts || []).find(x => x.cohortId === cohortId);
  if (c && c.topPerformers && c.topPerformers[0]) {
    cohortsState.selectedStudentId = c.topPerformers[0].studentId;
  }
  renderCohortsView();
}

function drillIntoCohort(cohortId) {
  cohortsState.lookupCohort = cohortId;
  setCohortPerformerTab(cohortId);
  renderCohortsView();
  const el = document.getElementById('cohort-student-lookup-tabs');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function onCohortStudentSearch(query) {
  const dropdown = document.getElementById('cohort-student-search-dropdown');
  const clearBtn = document.getElementById('cohort-student-clear-search');
  if (!dropdown) return;

  if (clearBtn) {
    if (query) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  const students = (APP_DATA && APP_DATA.students) || [];
  const matches = students.filter(s => 
    (s.name && s.name.toLowerCase().includes(q)) || 
    (s.rollNo && s.rollNo.toLowerCase().includes(q))
  ).slice(0, 8);

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-xs text-muted">No students match your query</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = matches.map(s => `
    <div onclick="selectCohortStudent('${s.studentId}', '${s.name.replace(/'/g, "\\'")}')" class="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
      <div>
        <p class="text-xs font-semibold text-gray-900">${s.name}</p>
        <p class="text-[10px] text-muted">${s.batch} · ${s.branch} · Roll: ${s.rollNo}</p>
      </div>
      <i class="ph-bold ph-caret-right text-xs text-muted"></i>
    </div>
  `).join('');
  dropdown.classList.remove('hidden');
}

function clearCohortStudentSearch() {
  const input = document.getElementById('cohort-student-search-input');
  if (input) input.value = '';
  const dropdown = document.getElementById('cohort-student-search-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  const clearBtn = document.getElementById('cohort-student-clear-search');
  if (clearBtn) clearBtn.classList.add('hidden');
}

function selectCohortStudent(studentId, studentName) {
  cohortsState.selectedStudentId = studentId;
  const input = document.getElementById('cohort-student-search-input');
  if (input) input.value = studentName;
  const dropdown = document.getElementById('cohort-student-search-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  renderCohortsView();
}

function renderCohortsView() {
  const cohortsData = (APP_DATA && APP_DATA.cohorts) || (window.__DEMO_DATA__ && window.__DEMO_DATA__.cohorts) || {};
  const list = cohortsData.cohorts || [];

  // 1. Summary Cards matching CohortSummaryCards (cohort-summary-cards.tsx)
  const cardsContainer = document.getElementById('cohorts-cards-container');
  if (cardsContainer) {
    cardsContainer.innerHTML = list.map(c => {
      const topScorer = c.topScorer || (c.topPerformers && c.topPerformers[0]) || { name: 'Bhagam Khyathi', avgPct: 92.4, studentId: 's-101' };
      const vel = c.velocity != null ? c.velocity : 3.3;
      const atRisk = c.atRiskCount != null ? c.atRiskCount : 18;
      const latestAvg = c.latestAvgPct || (c.scores && c.scores[c.scores.length - 1]) || 74.5;

      return [
        '<div class="rounded-2xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">',
        '  <div>',
        '    <div class="flex items-start justify-between gap-2">',
        '      <div class="min-w-0">',
        '        <p class="truncate text-base font-bold text-gray-900">' + c.name + '</p>',
        '        <p class="mt-0.5 text-[11px] uppercase tracking-wider text-muted font-semibold">' + c.targetExam + ' · ' + c.academicYear + '</p>',
        '      </div>',
        '      <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-semibold">',
        '        <i class="ph-bold ph-users text-xs"></i> ' + c.studentCount.toLocaleString() + '',
        '      </span>',
        '    </div>',
        '    <div class="mt-4 flex items-end justify-between">',
        '      <div>',
        '        <span class="text-[11px] uppercase tracking-wider text-muted font-medium">Latest avg</span>',
        '        <p class="font-mono font-bold text-2xl text-gray-900 mt-0.5">' + latestAvg + '%</p>',
        '      </div>',
        '      <div class="flex items-center gap-1 text-xs font-bold text-emerald-600 font-mono">',
        '        <i class="ph-bold ph-trend-up"></i> +' + vel + ' pts',
        '      </div>',
        '    </div>',
        '    <div class="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 mt-4 text-xs">',
        '      <div class="min-w-0">',
        '        <span class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted font-semibold">',
        '          <i class="ph-duotone ph-crown text-amber-500"></i> Top scorer',
        '        </span>',
        '        <a href="#student/' + topScorer.studentId + '" onclick="currentActiveStudentId=\'' + topScorer.studentId + '\'; switchView(\'student-detail\');" class="mt-1 block truncate text-xs font-semibold text-primary hover:underline" title="' + topScorer.name + ' · ' + topScorer.avgPct + '%">',
        '          ' + topScorer.name + ' <span class="text-muted font-mono font-normal">' + topScorer.avgPct + '%</span>',
        '        </a>',
        '      </div>',
        '      <div class="min-w-0">',
        '        <span class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted font-semibold">',
        '          <i class="ph-duotone ph-warning text-amber-500"></i> At risk',
        '        </span>',
        '        <p class="mt-1 text-xs font-semibold text-amber-700 font-mono">' + atRisk + ' students</p>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <button type="button" onclick="drillIntoCohort(\'' + c.cohortId + '\')" class="mt-4 inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-border bg-slate-50/80 hover:bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition-colors">',
        '    <span>Drill into cohort</span> <i class="ph-bold ph-arrow-right text-xs"></i>',
        '  </button>',
        '</div>'
      ].join('');
    }).join('');
  }

  // 2. Visibility Chips
  const chipsContainer = document.getElementById('cohorts-visibility-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = list.map(c => {
      const active = cohortsState.visibleCohorts.has(c.cohortId);
      return [
        '<button type="button" onclick="toggleCohortVisibility(\'' + c.cohortId + '\')" class="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all" style="' +
        (active ? ('background-color: ' + c.color + '; color: white; border-color: transparent;') : 'background-color: white; color: #64748B; border-color: #E2E8F0;') + '">',
        '  <span class="inline-block h-2 w-2 rounded-full" style="background-color: ' + (active ? 'white' : c.color) + '"></span>',
        '  <span>' + c.name + '</span>',
        '</button>'
      ].join('');
    }).join('');
  }

  // 3. Line Chart for Milestone Progression
  const chartCanvas = document.getElementById('cohortLineChart');
  if (chartCanvas) {
    if (charts.cohortLineChart) charts.cohortLineChart.destroy();

    const visibleCohorts = list.filter(c => cohortsState.visibleCohorts.has(c.cohortId));
    const datasets = visibleCohorts.map(c => ({
      label: c.name,
      data: c.scores,
      borderColor: c.color,
      backgroundColor: c.color + '20',
      borderWidth: 2.5,
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    charts.cohortLineChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: cohortsData.milestones || ['Month 1', 'Month 3', 'Month 6', 'Month 9', 'Month 12', 'Final Mock'],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '%'
            }
          }
        },
        scales: {
          y: { min: 40, max: 100, grid: { color: '#F1F5F9' }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 4. Distribution Quartile Bars (Min · Q1 · Median · Q3 · Max)
  const distContainer = document.getElementById('cohort-distribution-container');
  if (distContainer) {
    const visibleCohorts = list.filter(c => cohortsState.visibleCohorts.has(c.cohortId));
    distContainer.innerHTML = visibleCohorts.map(c => {
      const d = c.distribution || { min: 38, q1: 58.4, median: 74.5, q3: 88.2, max: 98.4 };
      return [
        '<div class="rounded-xl border border-border bg-slate-50/50 p-4">',
        '  <div class="flex items-center justify-between text-xs font-semibold mb-2">',
        '    <span class="text-gray-900">' + c.name + '</span>',
        '    <span class="text-muted">Median: <strong class="text-gray-900 font-mono">' + d.median + '%</strong></span>',
        '  </div>',
        '  <div class="h-4 w-full bg-slate-200/80 rounded-full overflow-hidden relative flex items-center">',
        '    <div class="absolute h-0.5 bg-slate-400" style="left: ' + d.min + '%; width: ' + (d.max - d.min) + '%;"></div>',
        '    <div class="absolute h-full rounded-md shadow-xs" style="left: ' + d.q1 + '%; width: ' + (d.q3 - d.q1) + '%; background-color: ' + c.color + '; opacity: 0.85;"></div>',
        '    <div class="absolute h-full w-1.5 bg-gray-900 z-10" style="left: ' + d.median + '%;"></div>',
        '  </div>',
        '  <div class="flex justify-between text-[10px] text-muted font-mono mt-2">',
        '    <span>Min: ' + d.min + '%</span>',
        '    <span>25th Pct: ' + d.q1 + '%</span>',
        '    <span class="font-bold text-gray-900">Median: ' + d.median + '%</span>',
        '    <span>75th Pct: ' + d.q3 + '%</span>',
        '    <span>Max: ' + d.max + '%</span>',
        '  </div>',
        '</div>'
      ].join('');
    }).join('');
  }

  // 5. Top Performers Tabs + Table
  const perfTabs = document.getElementById('cohort-top-performer-tabs');
  if (perfTabs) {
    perfTabs.innerHTML = list.map(c => {
      const active = c.cohortId === cohortsState.activePerformerCohort;
      return [
        '<button type="button" onclick="setCohortPerformerTab(\'' + c.cohortId + '\')" class="rounded-full border px-3 py-1 text-xs font-medium transition ' +
        (active ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted hover:text-foreground') + '">',
        c.name,
        '</button>'
      ].join('');
    }).join('');
  }

  const perfTbody = document.getElementById('cohort-top-performers-tbody');
  if (perfTbody) {
    const activeCohort = list.find(c => c.cohortId === cohortsState.activePerformerCohort) || list[0];
    const performers = (activeCohort && activeCohort.topPerformers) || [];
    perfTbody.innerHTML = performers.map(p => [
      '<tr class="border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
      '  <td class="px-5 py-3 font-mono font-bold text-muted tabular-nums">#' + p.rank + '</td>',
      '  <td class="px-5 py-3 font-semibold text-gray-900">',
      '    <a href="#student/' + (p.studentId || 's-101') + '" onclick="currentActiveStudentId=\'' + (p.studentId || 's-101') + '\'; switchView(\'student-detail\');" class="hover:text-primary hover:underline">' + p.name + '</a>',
      '  </td>',
      '  <td class="px-5 py-3 text-muted">' + p.batch + '</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-gray-900 tabular-nums">' + p.score + '%</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-emerald-600 tabular-nums">' + p.percentile + 'th</td>',
      '</tr>'
    ].join('')).join('');
  }

  // 6. Student-vs-Cohort Lookup (Where does a student stand?)
  const lookupTabs = document.getElementById('cohort-student-lookup-tabs');
  if (lookupTabs) {
    lookupTabs.innerHTML = list.map(c => {
      const active = c.cohortId === cohortsState.lookupCohort;
      return [
        '<button type="button" onclick="setCohortLookupTab(\'' + c.cohortId + '\')" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ' +
        (active ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900') + '">',
        c.name,
        '</button>'
      ].join('');
    }).join('');
  }

  const rankResultContainer = document.getElementById('cohort-student-rank-result');
  if (rankResultContainer) {
    const targetStudentId = cohortsState.selectedStudentId || 's-104';
    const rankInfo = (cohortsData.studentRanks && cohortsData.studentRanks[targetStudentId]) || {
      studentId: targetStudentId,
      studentName: 'Gowtham Reddy',
      rollNo: '225178',
      batchName: 'SR MPC',
      branchName: 'Madhapur',
      cohortId: cohortsState.lookupCohort,
      cohortName: list.find(x => x.cohortId === cohortsState.lookupCohort)?.name || 'JEE 2026 Cohort',
      cohortSize: 1420,
      cohortMedianPct: 74.5,
      studentAvgPct: 84.5,
      percentile: 97.9,
      rankInCohort: 4,
      deltaVsMedian: 10.0,
      topScorer: { studentId: 's-101', name: 'Bhagam Khyathi', avgPct: 92.4 },
      gapToTop: -7.9,
      subjectDeltas: [
        { subjectName: 'Physics', studentPct: 86.0, cohortAvgPct: 71.0, delta: 15.0 },
        { subjectName: 'Chemistry', studentPct: 88.0, cohortAvgPct: 76.0, delta: 12.0 },
        { subjectName: 'Mathematics', studentPct: 80.0, cohortAvgPct: 77.0, delta: 3.0 }
      ]
    };

    const deltaSign = rankInfo.deltaVsMedian >= 0 ? '+' : '';
    const gapSign = rankInfo.gapToTop >= 0 ? '+' : '';

    rankResultContainer.innerHTML = [
      '<div class="rounded-2xl border border-border bg-slate-50/50 p-5 space-y-5">',
      '  <div class="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border/70">',
      '    <div>',
      '      <div class="flex items-center gap-2">',
      '        <h4 class="text-base font-bold text-gray-900">' + rankInfo.studentName + '</h4>',
      '        <span class="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-700">' + rankInfo.rollNo + '</span>',
      '      </div>',
      '      <p class="text-xs text-muted mt-0.5">' + rankInfo.batchName + ' (' + rankInfo.branchName + ') · In ' + rankInfo.cohortName + '</p>',
      '    </div>',
      '    <div class="flex flex-wrap items-center gap-2">',
      '      <span class="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-2xs">',
      '        Rank <strong class="font-mono text-primary">#' + rankInfo.rankInCohort + '</strong> <span class="text-muted font-normal">of ' + rankInfo.cohortSize.toLocaleString() + '</span>',
      '      </span>',
      '      <span class="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-2xs">',
      '        Percentile <strong class="font-mono">' + rankInfo.percentile + 'th</strong>',
      '      </span>',
      '      <span class="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-2xs">',
      '        Score <strong class="font-mono text-primary">' + rankInfo.studentAvgPct + '%</strong>',
      '      </span>',
      '    </div>',
      '  </div>',
      '  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">',
      '    <div class="rounded-xl border border-border bg-surface p-4 shadow-2xs">',
      '      <span class="text-[11px] uppercase tracking-wider text-muted font-semibold">Delta vs Cohort Median</span>',
      '      <div class="mt-2 flex items-center justify-between">',
      '        <p class="text-lg font-mono font-bold ' + (rankInfo.deltaVsMedian >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">' + deltaSign + rankInfo.deltaVsMedian + 'pp</p>',
      '        <span class="text-xs text-muted">Median: <strong class="font-mono text-gray-900">' + rankInfo.cohortMedianPct + '%</strong></span>',
      '      </div>',
      '      <p class="text-xs text-muted mt-1">' + (rankInfo.deltaVsMedian >= 0 ? 'Outperforming cohort median by ' + rankInfo.deltaVsMedian + ' points' : 'Lagging cohort median') + '</p>',
      '    </div>',
      '    <div class="rounded-xl border border-border bg-surface p-4 shadow-2xs">',
      '      <span class="text-[11px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1">',
      '        <i class="ph-duotone ph-crown text-amber-500"></i> Gap to Top Scorer',
      '      </span>',
      '      <div class="mt-2 flex items-center justify-between">',
      '        <p class="text-lg font-mono font-bold ' + (rankInfo.gapToTop === 0 ? 'text-amber-600' : 'text-slate-800') + '">' + (rankInfo.gapToTop === 0 ? 'Top Scorer (#1)' : gapSign + rankInfo.gapToTop + 'pp') + '</p>',
      '        <span class="text-xs text-muted">#1 ' + rankInfo.topScorer.name + ' (' + rankInfo.topScorer.avgPct + '%)</span>',
      '      </div>',
      '      <p class="text-xs text-muted mt-1">' + (rankInfo.gapToTop === 0 ? 'Currently leading this cohort' : Math.abs(rankInfo.gapToTop) + ' points behind cohort topper') + '</p>',
      '    </div>',
      '  </div>',
      '  <div>',
      '    <h5 class="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">Subject Deltas vs Cohort Mean</h5>',
      '    <div class="space-y-3">',
      rankInfo.subjectDeltas.map(s => {
        const sign = s.delta >= 0 ? '+' : '';
        const tone = s.delta >= 0 ? 'text-emerald-600' : 'text-rose-600';
        const bgTone = s.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500';
        return [
          '<div class="space-y-1">',
          '  <div class="flex items-center justify-between text-xs">',
          '    <span class="font-semibold text-gray-900">' + s.subjectName + '</span>',
          '    <div class="flex items-center gap-2 font-mono text-xs">',
          '      <span>Student: <strong class="text-gray-900">' + s.studentPct + '%</strong></span>',
          '      <span class="text-muted">· Cohort: ' + s.cohortAvgPct + '%</span>',
          '      <span class="font-bold ' + tone + '">(' + sign + s.delta + 'pp)</span>',
          '    </div>',
          '  </div>',
          '  <div class="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">',
          '    <div class="h-full rounded-full ' + bgTone + '" style="width: ' + s.studentPct + '%;"></div>',
          '    <div class="absolute top-0 bottom-0 w-0.5 bg-gray-900" style="left: ' + s.cohortAvgPct + '%;" title="Cohort Avg: ' + s.cohortAvgPct + '%"></div>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '    </div>',
      '  </div>',
      '  <div class="pt-2 flex justify-end">',
      '    <a href="#student/' + rankInfo.studentId + '" onclick="currentActiveStudentId=\'' + rankInfo.studentId + '\'; switchView(\'student-detail\');" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs">',
      '      <span>Open Full Student Dossier</span> <i class="ph-bold ph-arrow-right text-xs"></i>',
      '    </a>',
      '  </div>',
      '</div>'
    ].join('');
  }

  // 7. Constituent Batches Comparison Table
  const batchesTbody = document.getElementById('cohort-batches-tbody');
  if (batchesTbody) {
    const activeCohort = list.find(c => c.cohortId === cohortsState.lookupCohort) || list[0];
    const constituentBatches = (activeCohort && activeCohort.batches) || [
      { batchId: 'b-srmpc-madhapur', name: 'SR MPC', branch: 'Madhapur', students: 78, avgPercentile: 74.2, finalAvg: 78.4, attendance: 91.2, topStudent: 'Bhagam Khyathi' },
      { batchId: 'b-srmpc-shamirpet', name: 'SR MPC', branch: 'Shamirpet', students: 84, avgPercentile: 71.5, finalAvg: 75.6, attendance: 89.4, topStudent: 'VISHWANATH AKSHAY KUMAR' },
      { batchId: 'b-srmpc-suchitra', name: 'SR MPC', branch: 'Suchitra', students: 68, avgPercentile: 68.4, finalAvg: 72.8, attendance: 87.5, topStudent: 'Nikhil Chowdary' },
      { batchId: 'b-srmpc-ecil', name: 'SR MPC', branch: 'ECIL', students: 72, avgPercentile: 67.2, finalAvg: 71.5, attendance: 88.0, topStudent: 'R PRANAV' },
      { batchId: 'b-srmpc-bachupally', name: 'SR MPC', branch: 'Bachupally', students: 64, avgPercentile: 65.8, finalAvg: 69.8, attendance: 86.4, topStudent: 'Ananya Sharma' }
    ];

    batchesTbody.innerHTML = constituentBatches.map(b => [
      '<tr class="border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
      '  <td class="px-5 py-3 font-semibold text-gray-900">',
      '    <a href="#batch/' + b.batchId + '" onclick="currentActiveBatchId=\'' + b.batchId + '\'; switchView(\'batch-detail\');" class="hover:text-primary hover:underline">' + b.name + '</a>',
      '  </td>',
      '  <td class="px-5 py-3 text-muted">' + b.branch + '</td>',
      '  <td class="px-5 py-3 text-center font-mono text-slate-800">' + b.students + '</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-emerald-600">' + b.avgPercentile + 'th</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-gray-900">' + b.finalAvg + '%</td>',
      '  <td class="px-5 py-3 text-center font-mono text-slate-700">' + b.attendance + '%</td>',
      '  <td class="px-5 py-3 font-medium text-slate-800">' + b.topStudent + '</td>',
      '  <td class="px-5 py-3 text-right">',
      '    <a href="#batch/' + b.batchId + '" onclick="currentActiveBatchId=\'' + b.batchId + '\'; switchView(\'batch-detail\');" class="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors">',
      '      <span>View Batch</span> <i class="ph-bold ph-arrow-right text-[10px]"></i>',
      '    </a>',
      '  </td>',
      '</tr>'
    ].join('')).join('');
  }
}

// ── Missing Utility & Modal Handlers ─────────────────────────────────────────

function filterStudentsTable() {
  renderStudentsTable();
}

function toggleAtRiskStudentsFilter() {
  toggleAtRiskFilter();
}

function openAskAnalyticsModal() {
  document.getElementById('ask-modal')?.classList.remove('hidden');
}

function closeAskAnalyticsModal() {
  document.getElementById('ask-modal')?.classList.add('hidden');
}

function initAskPresets() {
  const container = document.getElementById('ask-presets');
  if (!container) return;
  const presets = (APP_DATA.askDemo && APP_DATA.askDemo.presets) || [
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
  ];

  container.innerHTML = presets.map((p, idx) => `
    <button type="button" onclick="selectAskPreset(${idx})" class="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
      ${p.query}
    </button>
  `).join('');
}

function selectAskPreset(idx) {
  const presets = (APP_DATA.askDemo && APP_DATA.askDemo.presets) || [];
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

function submitAskQuery() {
  const input = document.getElementById('ask-input');
  const q = (input ? input.value : '').trim().toLowerCase();
  const presets = (APP_DATA.askDemo && APP_DATA.askDemo.presets) || [];
  const matched = presets.find(p => p.query.toLowerCase().includes(q) || q.includes(p.query.toLowerCase())) || presets[0];
  const ansCont = document.getElementById('ask-answer-container');
  const ansText = document.getElementById('ask-answer-text');
  if (ansCont && ansText) {
    ansCont.classList.remove('hidden');
    ansText.textContent = matched ? matched.answer : "According to the institutional model, the selected metric aligns with historical benchmarks within a ±3.2% deviation window.";
  }
}

function openFacultyImpactModal() {
  alert("Faculty Effectiveness:\n• Physics syllabus completion: 86.4%\n• Mathematics syllabus completion: 82.1%\n• Chemistry syllabus completion: 88.5%\n• Teacher-student interaction rating: 9.4/10");
}

function renderTabSyllabus() {
  // Batch syllabus tracker
}

// ── Overview Date Range Modal Handlers ─────────────────────────────────────
function openOverviewDateRangeModal() {
  document.getElementById("overview-datepicker-modal")?.classList.remove("hidden");
}

function closeOverviewDateRangeModal() {
  document.getElementById("overview-datepicker-modal")?.classList.add("hidden");
}

function setOverviewDateRange(label) {
  const lbl = document.getElementById("overview-daterange-label");
  if (lbl) lbl.textContent = label;
  document.querySelectorAll(".overview-date-preset-btn").forEach(btn => {
    if (btn.textContent.trim() === label) {
      btn.className = "overview-date-preset-btn text-left px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white border border-primary transition-colors";
    } else {
      btn.className = "overview-date-preset-btn text-left px-3 py-2 rounded-xl text-xs font-medium border border-border hover:border-primary hover:bg-primary/5 transition-colors";
    }
  });
  closeOverviewDateRangeModal();
}

// ── Student Assignment Developer Modal Handlers ────────────────────────────
function openAssignmentDeveloperModal(title, subtitle, status, score, completedAt) {
  const modal = document.getElementById("assignment-developer-modal");
  if (!modal) return;
  const titleEl = document.getElementById("assignment-modal-title");
  if (titleEl) titleEl.textContent = title || "Assignment Details";
  const subEl = document.getElementById("assignment-modal-subtitle");
  if (subEl) subEl.textContent = `${subtitle || 'Assignment'} · ${completedAt || 'Recent Activity'}`;
  const metaTitle = document.getElementById("assignment-modal-meta-title");
  if (metaTitle) metaTitle.textContent = title || "—";
  const metaType = document.getElementById("assignment-modal-meta-type");
  if (metaType) metaType.textContent = subtitle || "Assignment";
  const metaStatus = document.getElementById("assignment-modal-meta-status");
  if (metaStatus) metaStatus.textContent = status || "Done";
  const metaScore = document.getElementById("assignment-modal-meta-score");
  const scoreRow = document.getElementById("assignment-modal-meta-score-row");
  if (score) {
    if (metaScore) metaScore.textContent = `${score}%`;
    if (scoreRow) scoreRow.classList.remove("hidden");
  } else {
    if (scoreRow) scoreRow.classList.add("hidden");
  }
  modal.classList.remove("hidden");
}

function closeAssignmentDeveloperModal() {
  document.getElementById("assignment-developer-modal")?.classList.add("hidden");
}

// ── Overview Progressive Disclosure & Counseling Queue Handlers ────────────

let overviewExtraKpisVisible = false;

function toggleOverviewExtraKpis() {
  overviewExtraKpisVisible = !overviewExtraKpisVisible;
  const drawer = document.getElementById("overview-extra-kpis");
  const text = document.getElementById("text-toggle-extra-kpis");
  const icon = document.getElementById("icon-toggle-extra-kpis");
  if (!drawer) return;

  if (overviewExtraKpisVisible) {
    drawer.classList.remove("hidden");
    if (text) text.textContent = "Hide Extra Figures";
    if (icon) icon.className = "ph-bold ph-caret-up text-xs transition-transform";
  } else {
    drawer.classList.add("hidden");
    if (text) text.textContent = "Show 4 More Institutional Figures";
    if (icon) icon.className = "ph-bold ph-caret-down text-xs transition-transform";
  }
}

let overviewSubjectBreakdownVisible = false;

function toggleOverviewSubjectBreakdown() {
  overviewSubjectBreakdownVisible = !overviewSubjectBreakdownVisible;
  const drawer = document.getElementById("overview-subject-breakdown");
  const text = document.getElementById("text-toggle-subject");
  const icon = document.getElementById("icon-toggle-subject");
  if (!drawer) return;

  if (overviewSubjectBreakdownVisible) {
    drawer.classList.remove("hidden");
    if (text) text.textContent = "Hide Subject Breakdown";
    if (icon) icon.className = "ph-bold ph-caret-up text-xs transition-transform";
  } else {
    drawer.classList.add("hidden");
    if (text) text.textContent = "View Subject Breakdown (Physics, Chemistry, Maths/Bio)";
    if (icon) icon.className = "ph-bold ph-caret-down text-xs transition-transform";
  }
}

function focusOverviewAttentionList() {
  const target = document.getElementById("overview-attention-section");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("ring-2", "ring-red-400", "transition-all");
  setTimeout(() => {
    target.classList.remove("ring-2", "ring-red-400");
  }, 1800);
}

let currentOverviewAttentionFilter = 'all';

function filterOverviewAttention(filterType) {
  currentOverviewAttentionFilter = filterType;
  document.querySelectorAll("#overview-attention-tabs .attention-tab-btn").forEach(btn => {
    if (
      (filterType === 'all' && btn.textContent.includes('All')) ||
      (filterType === 'critical' && btn.textContent.includes('Critical')) ||
      (filterType === 'low_score' && btn.textContent.includes('Low Score')) ||
      (filterType === 'absent' && btn.textContent.includes('Absent'))
    ) {
      btn.className = "px-2.5 py-1 rounded-md bg-red-100 text-red-800 font-semibold attention-tab-btn active";
    } else {
      btn.className = "px-2.5 py-1 rounded-md text-muted hover:text-slate-900 attention-tab-btn";
    }
  });
  renderOverviewAttentionList();
}

function renderOverviewAttentionList() {
  const container = document.getElementById("overview-attention-list");
  if (!container) return;

  const allAtRisk = APP_DATA.institution?.atRiskStudents || [];
  
  const filtered = allAtRisk.filter(s => {
    if (currentOverviewAttentionFilter === 'critical') return s.severity === 'critical';
    if (currentOverviewAttentionFilter === 'low_score') return (s.percentile < 35 || (s.scores && s.scores[s.scores.length - 1] < 90));
    if (currentOverviewAttentionFilter === 'absent') return (s.daysSinceLogin >= 3);
    return true;
  });

  const badgeEl = document.getElementById("attention-badge-count");
  if (badgeEl) badgeEl.textContent = `${allAtRisk.length} Flagged`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs text-muted">
        No students found in this category.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isCritical = s.severity === 'critical';
    const tagBg = isCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200';
    const tagText = isCritical ? `Critical · Inactive ${s.daysSinceLogin}d` : `Warning · ${s.percentile}%ile`;
    const avatarBg = isCritical ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';

    return `
      <div class="py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${avatarBg}">
            ${s.name.slice(0, 2).toUpperCase()}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-semibold text-gray-900 truncate">${s.name}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded border font-medium ${tagBg}">${tagText}</span>
            </div>
            <p class="text-[11px] text-muted truncate">${s.batch} · ${s.branch} · Roll: ${s.rollNo}</p>
          </div>
        </div>
        <button onclick="openStudentModal('${s.studentId}')" class="shrink-0 px-2.5 py-1 rounded-lg border border-border text-[11px] font-semibold text-slate-700 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-2xs">
          View Profile
        </button>
      </div>
    `;
  }).join("");
}

let overviewBranchComparisonVisible = false;

function toggleOverviewBranchComparison() {
  overviewBranchComparisonVisible = !overviewBranchComparisonVisible;
  const container = document.getElementById("overview-branch-comparison-container");
  const text = document.getElementById("text-toggle-branches");
  const icon = document.getElementById("icon-toggle-branches");
  if (!container) return;

  if (overviewBranchComparisonVisible) {
    container.classList.remove("hidden");
    if (text) text.textContent = "Collapse Branch Comparison";
    if (icon) icon.className = "ph-bold ph-caret-up text-xs transition-transform";
    setTimeout(() => {
      charts.branchChart?.resize();
      charts.attendanceDonutChart?.resize();
    }, 60);
  } else {
    container.classList.add("hidden");
    if (text) text.textContent = "Expand Branch Comparison";
    if (icon) icon.className = "ph-bold ph-caret-down text-xs transition-transform";
  }
}


