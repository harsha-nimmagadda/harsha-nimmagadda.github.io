/**
 * modules/overview/overview.js
 * Faculty Command Center & Institution Overview Controller.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { getChartContext, registerChart, createVerticalGradient } from '../../core/chart-utils.js';
import { openBatchModal, openStudentModal } from '../../core/modals.js';

export function onRoleChange(role) {
  store.set('currentUserRole', role);
  applyRoleUI(role);
}

export function applyRoleUI(role) {
  // Sync dropdowns
  const sidebarSelect = document.getElementById('sidebar-role-select');
  if (sidebarSelect && sidebarSelect.value !== role) sidebarSelect.value = role;

  const overviewSelect = document.getElementById('overview-role-select');
  if (overviewSelect && overviewSelect.value !== role) overviewSelect.value = role;

  const sidebarBadge = document.getElementById('sidebar-role-badge');
  const overviewBadge = document.getElementById('overview-role-badge');

  // User profile footer elements in sidebar
  const userAvatar = document.getElementById('user-profile-avatar');
  const userName = document.getElementById('user-profile-name');
  const userRoleText = document.getElementById('user-profile-role');

  // Directive banner elements
  const dirBanner = document.getElementById('role-directive-banner');
  const dirBadge = document.getElementById('role-directive-badge');
  const dirTitle = document.getElementById('role-directive-title');
  const dirDesc = document.getElementById('role-directive-description');
  const dirIcon = document.getElementById('role-directive-icon');
  const dirIconBox = document.getElementById('role-directive-icon-container');

  if (role === 'faculty') {
    // 1. Sidebar Badge & Profile
    if (sidebarBadge) {
      sidebarBadge.textContent = 'Faculty';
      sidebarBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200';
    }
    if (userAvatar) userAvatar.textContent = 'FC';
    if (userName) userName.textContent = 'Prof. K. V. Rao';
    if (userRoleText) userRoleText.textContent = 'Senior Physics Faculty · SR MPC';

    // 2. Overview Role Tag
    if (overviewBadge) {
      overviewBadge.innerHTML = '<i class="ph-bold ph-chalkboard-teacher"></i> Faculty View';
      overviewBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60';
    }

    // 3. Directive Banner
    if (dirBanner) dirBanner.className = 'p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-start gap-3 transition-colors';
    if (dirBadge) {
      dirBadge.textContent = 'Role Mode: Subject Faculty & Class Teacher';
      dirBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800 uppercase tracking-wide';
    }
    if (dirTitle) dirTitle.textContent = 'Classroom Pulse & Teaching Remediation Mode';
    if (dirDesc) dirDesc.innerHTML = 'Showing <strong>Classroom Teaching View</strong>: Classroom pulse, immediate student counseling queue, and <em>Subject Performance Breakdown drawer</em> auto-expanded with topic remediation notes. Cross-campus administrative comparison is collapsed.';
    if (dirIconBox) dirIconBox.className = 'h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700';
    if (dirIcon) dirIcon.className = 'ph-fill ph-chalkboard-teacher text-lg';

    // 4. Drawer & Section Adaptations
    store.set('overviewSubjectBreakdownVisible', true);
    const subjDrawer = document.getElementById('overview-subject-breakdown');
    if (subjDrawer) subjDrawer.classList.remove('hidden');
    const subjText = document.getElementById('text-toggle-subject');
    if (subjText) subjText.textContent = 'Hide Subject Breakdown';
    const subjIcon = document.getElementById('icon-toggle-subject');
    if (subjIcon) subjIcon.className = 'ph-bold ph-caret-up text-xs transition-transform';

    store.set('overviewBranchComparisonVisible', false);
    const branchDrawer = document.getElementById('overview-branch-comparison-container');
    if (branchDrawer) branchDrawer.classList.add('hidden');
    const branchText = document.getElementById('text-toggle-branches');
    if (branchText) branchText.textContent = 'Expand Branch Comparison';
    const branchIcon = document.getElementById('icon-toggle-branches');
    if (branchIcon) branchIcon.className = 'ph-bold ph-caret-down text-xs transition-transform';

    // Scope to classroom campus
    onScopeChange('b-madhapur', false);
    const titleEl = document.getElementById('overview-title');
    if (titleEl) titleEl.textContent = 'Faculty Command Center · SR MPC';
    const subtitleEl = document.getElementById('overview-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Daily classroom pulse, test score trajectory, rotational motion concept drill, and counseling queue.';

    filterStudentMovementTab('rankers');
  } else if (role === 'principal') {
    // 1. Sidebar Badge & Profile
    if (sidebarBadge) {
      sidebarBadge.textContent = 'Principal';
      sidebarBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200';
    }
    if (userAvatar) userAvatar.textContent = 'PR';
    if (userName) userName.textContent = 'Dr. Ramesh Sharma';
    if (userRoleText) userRoleText.textContent = 'Principal · Madhapur Campus';

    // 2. Overview Role Tag
    if (overviewBadge) {
      overviewBadge.innerHTML = '<i class="ph-bold ph-buildings"></i> Principal View';
      overviewBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60';
    }

    // 3. Directive Banner
    if (dirBanner) dirBanner.className = 'p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex items-start gap-3 transition-colors';
    if (dirBadge) {
      dirBadge.textContent = 'Role Mode: Principal / Branch Head';
      dirBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 text-blue-800 uppercase tracking-wide';
    }
    if (dirTitle) dirTitle.textContent = 'Campus Operations & Section Leaderboard Mode';
    if (dirDesc) dirDesc.innerHTML = 'Showing <strong>Campus Leadership View</strong>: Scoped to Madhapur Campus. Batch Health & Section Leaderboards expanded, campus attendance distribution highlighted, and counseling queue filtered to campus roster.';
    if (dirIconBox) dirIconBox.className = 'h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-700';
    if (dirIcon) dirIcon.className = 'ph-fill ph-buildings text-lg';

    // 4. Drawer & Section Adaptations
    store.set('overviewSubjectBreakdownVisible', false);
    const subjDrawer = document.getElementById('overview-subject-breakdown');
    if (subjDrawer) subjDrawer.classList.add('hidden');
    const subjText = document.getElementById('text-toggle-subject');
    if (subjText) subjText.textContent = 'View Subject Breakdown (Physics, Chemistry, Maths/Bio)';
    const subjIcon = document.getElementById('icon-toggle-subject');
    if (subjIcon) subjIcon.className = 'ph-bold ph-caret-down text-xs transition-transform';

    store.set('overviewShowAllBatches', true);
    const btnBatches = document.getElementById('btn-toggle-all-batches');
    if (btnBatches) btnBatches.textContent = 'Show Top 4 Only ▴';

    onScopeChange('b-madhapur', false);
    const titleEl = document.getElementById('overview-title');
    if (titleEl) titleEl.textContent = 'Principal Command Center · Madhapur Campus';
    const subtitleEl = document.getElementById('overview-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Campus operational pulse, section rankings, syllabus coverage, and counseling queue.';
  } else {
    // Super Admin
    // 1. Sidebar Badge & Profile
    if (sidebarBadge) {
      sidebarBadge.textContent = 'Super Admin';
      sidebarBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200';
    }
    if (userAvatar) userAvatar.textContent = 'SA';
    if (userName) userName.textContent = 'Super Admin';
    if (userRoleText) userRoleText.textContent = 'super_admin · Executive';

    // 2. Overview Role Tag
    if (overviewBadge) {
      overviewBadge.innerHTML = '<i class="ph-bold ph-shield-check"></i> Super Admin View';
      overviewBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200/60';
    }

    // 3. Directive Banner
    if (dirBanner) dirBanner.className = 'p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 flex items-start gap-3 transition-colors';
    if (dirBadge) {
      dirBadge.textContent = 'Role Mode: Super Admin (Executive)';
      dirBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-800 uppercase tracking-wide';
    }
    if (dirTitle) dirTitle.textContent = 'Unified Command Center · Institution Executive Mode';
    if (dirDesc) dirDesc.innerHTML = 'Showing <strong>Super Admin View</strong>: Full multi-campus pulse across all 10 branches, <em>Cross-Campus Benchmark Comparison expanded</em>, automated strategic AI insights, and complete batch health matrix.';
    if (dirIconBox) dirIconBox.className = 'h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700';
    if (dirIcon) dirIcon.className = 'ph-fill ph-user-gear text-lg';

    // 4. Drawer & Section Adaptations
    store.set('overviewBranchComparisonVisible', true);
    const branchDrawer = document.getElementById('overview-branch-comparison-container');
    if (branchDrawer) branchDrawer.classList.remove('hidden');
    const branchText = document.getElementById('text-toggle-branches');
    if (branchText) branchText.textContent = 'Collapse Branch Comparison';
    const branchIcon = document.getElementById('icon-toggle-branches');
    if (branchIcon) branchIcon.className = 'ph-bold ph-caret-up text-xs transition-transform';
    setTimeout(() => {
      store.charts.branchChart?.resize();
      store.charts.attendanceDonutChart?.resize();
    }, 60);

    onScopeChange('all', false);
    const titleEl = document.getElementById('overview-title');
    if (titleEl) titleEl.textContent = 'Executive Command Center · Institution Overview';
    const subtitleEl = document.getElementById('overview-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Full institutional pulse across 10 campuses, 76 batches, 4,765 students, and cross-center benchmarks.';
  }

  // Re-render overview lists to apply scope/role filters
  renderTopBatchesList();
  renderTopPerformersList();
  renderRisersList();
  renderFallersList();
  renderOverviewAttentionList();
  renderStrategicInsights();
}

export function onScopeChange(branchId, triggerNavigation = true) {
  store.set('currentScopeBranch', branchId);
  const branchSelect = document.getElementById('sidebar-branch-select');
  if (branchSelect) branchSelect.value = branchId;

  const breadcrumb = document.getElementById('branch-breadcrumb');
  const breadcrumbName = document.getElementById('breadcrumb-branch-name');
  const title = document.getElementById('overview-title');
  const subtitle = document.getElementById('overview-subtitle');
  const scopeKpi = document.getElementById('ov-scope');
  const currentRole = store.get('currentUserRole') || 'super_admin';

  if (branchId === 'all') {
    if (breadcrumb) breadcrumb.classList.add('hidden');
    if (title) {
      title.textContent = currentRole === 'super_admin'
        ? 'Executive Command Center · Institution Overview'
        : 'Faculty Command Center';
    }
    if (subtitle) {
      subtitle.textContent = currentRole === 'super_admin'
        ? 'Full institutional pulse across 10 campuses, 76 batches, 4,765 students, and cross-center benchmarks.'
        : 'Daily classroom pulse, test score trajectory, and immediate student counseling queue.';
    }
    if (scopeKpi) scopeKpi.textContent = 'Institution';
    
    const inst = store.institution || {};
    const elStudents = document.getElementById('ov-students');
    if (elStudents) elStudents.textContent = Number(inst.totalStudents || 4765).toLocaleString();
    const elExams = document.getElementById('ov-exams');
    if (elExams) elExams.textContent = Number(inst.totalExams || 36920).toLocaleString();
    const elScore = document.getElementById('ov-score');
    if (elScore) elScore.textContent = `${inst.avgPercentile || 54.2}%`;
    const elAtt = document.getElementById('ov-attendance');
    if (elAtt) elAtt.textContent = `${inst.attendanceSummary?.overallRate || 88.5}%`;
    const elBatches = document.getElementById('ov-batches');
    if (elBatches) elBatches.textContent = inst.activeBatches || 76;
    
    const atRiskCount = inst.atRiskStudents?.length || 14;
    const attCountEl = document.getElementById('ov-attention-count');
    if (attCountEl) attCountEl.textContent = atRiskCount;
    const alertTitle = document.getElementById('alert-card-title');
    if (alertTitle) alertTitle.textContent = `${atRiskCount} Students with low scores or absent ↓`;
  } else {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : branchId;

    if (breadcrumb) breadcrumb.classList.remove('hidden');
    if (breadcrumbName) breadcrumbName.textContent = branchName;
    if (title) {
      title.textContent = currentRole === 'faculty'
        ? 'Faculty Command Center · SR MPC'
        : currentRole === 'principal'
        ? `Principal Command Center · ${branchName} Campus`
        : `${branchName} Command Center`;
    }
    if (subtitle) {
      subtitle.textContent = currentRole === 'faculty'
        ? 'Daily classroom pulse, test score trajectory, rotational motion concept drill, and counseling queue.'
        : `${branchName} campus operations, pulse, and counseling priorities.`;
    }
    if (scopeKpi) scopeKpi.textContent = branchName;

    if (branch) {
      const elStudents = document.getElementById('ov-students');
      if (elStudents) elStudents.textContent = Number(branch.studentCount || 0).toLocaleString();
      const elExams = document.getElementById('ov-exams');
      if (elExams) elExams.textContent = branch.examCount || branch.exams || 24;
      const elScore = document.getElementById('ov-score');
      if (elScore) elScore.textContent = `${branch.avgScore || branch.percentile || 55.4}%`;
      const elAtt = document.getElementById('ov-attendance');
      if (elAtt) elAtt.textContent = `${Math.round((branch.avgScore || 55) * 0.9 + 40)}%`;
      const elBatches = document.getElementById('ov-batches');
      if (elBatches) elBatches.textContent = branch.batchCount || 4;

      const allAtRisk = store.institution?.atRiskStudents || [];
      const branchAtRisk = allAtRisk.filter(s => s.branch === branchName);
      const branchAtRiskCount = branchAtRisk.length > 0 ? branchAtRisk.length : 3;

      const attCountEl = document.getElementById('ov-attention-count');
      if (attCountEl) attCountEl.textContent = branchAtRiskCount;
      const alertTitle = document.getElementById('alert-card-title');
      if (alertTitle) alertTitle.textContent = `${branchAtRiskCount} Students with low scores or absent ↓`;
    }
  }

  renderStrategicInsights();
  renderExamCountdowns();
  renderTopBatchesList();
  renderTopPerformersList();
  renderRisersList();
  renderFallersList();
  renderOverviewAttentionList();

  if (triggerNavigation) {
    router.switchView('overview');
  }
}

export function onBatchFilterChange(batchId) {
  const btn = document.getElementById('btn-open-batch-hub');
  if (!btn) return;
  if (batchId) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

export function openSelectedBatchHub() {
  const batchId = document.getElementById('overview-batch-filter')?.value;
  if (batchId) {
    openBatchModal(batchId);
  }
}

export function renderOverview() {
  const currentRole = store.get('currentUserRole') || 'super_admin';
  const roleBadge = document.getElementById('overview-role-badge');
  if (roleBadge) {
    if (currentRole === 'faculty') {
      roleBadge.innerHTML = '<i class="ph-bold ph-chalkboard-teacher"></i> Faculty View';
      roleBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60';
    } else if (currentRole === 'principal') {
      roleBadge.innerHTML = '<i class="ph-bold ph-buildings"></i> Principal View';
      roleBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60';
    } else {
      roleBadge.innerHTML = '<i class="ph-bold ph-shield-check"></i> Super Admin View';
      roleBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200/60';
    }
  }

  const roleSelect = document.getElementById('overview-role-select');
  if (roleSelect && roleSelect.value !== currentRole) roleSelect.value = currentRole;

  const d = store.institution || {};
  
  const elStudents = document.getElementById('ov-students');
  if (elStudents && d.totalStudents) elStudents.textContent = Number(d.totalStudents).toLocaleString();
  const elExams = document.getElementById('ov-exams');
  if (elExams && d.totalExams) elExams.textContent = Number(d.totalExams).toLocaleString();
  const elScore = document.getElementById('ov-score');
  if (elScore && d.avgPercentile) elScore.textContent = `${d.avgPercentile}%`;
  const elAtt = document.getElementById('ov-attendance');
  if (elAtt && d.attendanceSummary) elAtt.textContent = `${d.attendanceSummary.overallRate}%`;
  const elBatches = document.getElementById('ov-batches');
  if (elBatches && d.activeBatches) elBatches.textContent = d.activeBatches;
  
  if (d.atRiskStudents) {
    const el = document.getElementById('ov-attention-count');
    if (el) el.textContent = d.atRiskStudents.length;
    const alertTitle = document.getElementById('alert-card-title');
    if (alertTitle) alertTitle.textContent = `${d.atRiskStudents.length} Students with low scores or absent ↓`;
  }

  renderTrendChart();
  renderBranchChart();
  renderAttendanceDonut();
  renderStrategicInsights();
  renderExamCountdowns();
  renderTopBatchesList();
  renderTopPerformersList();
  renderRisersList();
  renderFallersList();
  renderBatchOverviewRows();
  renderOverviewAttentionList();
}

export function renderTrendChart() {
  const ctx = getChartContext('trendChart');
  if (!ctx) return;

  const trends = store.trends?.trends || [];
  const labels = trends.map(t => t.month);
  const scoreData = trends.map(t => t.avgScore);
  const pctData = trends.map(t => t.avgPercentile);

  const gradient = createVerticalGradient(ctx, 'rgba(37, 99, 235, 0.22)', 'rgba(37, 99, 235, 0.00)', 240);

  const chart = new Chart(ctx, {
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
          fill: false,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#64748B' }
        },
        y: {
          min: 40,
          max: 80,
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { size: 11 },
            color: '#64748B',
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });

  registerChart('trendChart', chart);
}

export function renderBranchChart() {
  const ctx = getChartContext('branchChart');
  if (!ctx) return;

  const branches = store.branches || [];
  const labels = branches.map(b => b.name);
  const data = branches.map(b => b.avgScore || b.percentile || 55);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Average Percentile',
        data,
        backgroundColor: '#2563EB',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` Average: ${ctx.parsed.y}%ile`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#64748B' }
        },
        y: {
          min: 40,
          max: 70,
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { size: 10 },
            color: '#64748B',
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });

  registerChart('branchChart', chart);
}

export function renderAttendanceDonut() {
  const ctx = getChartContext('attendanceDonutChart');
  if (!ctx) return;

  const att = store.institution?.attendanceSummary || { present: 88, absent: 8, late: 4 };

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent', 'Late'],
      datasets: [{
        data: [att.present, att.absent, att.late],
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
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  });

  registerChart('attendanceDonutChart', chart);
}

export function toggleOverviewAllBatches() {
  const next = !store.get('overviewShowAllBatches');
  store.set('overviewShowAllBatches', next);
  const btn = document.getElementById('btn-toggle-all-batches');
  if (btn) {
    btn.textContent = next ? 'Show Top 4 Only ▴' : 'Show All Batches ▾';
  }
  renderTopBatchesList();
}

export function renderTopBatchesList() {
  const container = document.getElementById('top-batches-list');
  if (!container) return;
  const allBatches = store.institution?.topBatches || [];
  const branchId = store.get('currentScopeBranch') || 'all';

  let batches = allBatches;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      const matches = allBatches.filter(b => b.branch === branchName);
      if (matches.length > 0) batches = matches;
    }
  }

  const showAll = store.get('overviewShowAllBatches');
  const displayBatches = showAll ? batches : batches.slice(0, 4);

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
  }).join('');
}

export function renderTopPerformersList() {
  const container = document.getElementById('top-performers-list');
  if (!container) return;
  const allPerformers = store.institution?.topPerformers || [];
  const branchId = store.get('currentScopeBranch') || 'all';

  let performers = allPerformers;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      const matches = allPerformers.filter(p => p.branch === branchName);
      if (matches.length > 0) performers = matches;
    }
  }

  const tab = store.get('currentPerformerTab');
  const filtered = (!tab || tab === 'all') 
    ? performers 
    : performers.filter(p => p.batch.includes(tab));

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
  }).join('');
}

export function filterPerformersTab(tab) {
  store.set('currentPerformerTab', tab);
  document.querySelectorAll('#top-performers-tabs .tab-btn').forEach(btn => {
    if (btn.textContent.includes(tab) || (tab === 'all' && btn.textContent.includes('All'))) {
      btn.className = "px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary font-semibold tab-btn active";
    } else {
      btn.className = "px-2 py-0.5 rounded text-[11px] text-muted hover:text-slate-900 tab-btn";
    }
  });
  renderTopPerformersList();
}

export function renderStrategicInsights() {
  const container = document.getElementById('insights-list');
  if (!container) return;

  const home = (store.homeV2 && Object.keys(store.homeV2).length > 0)
    ? store.homeV2
    : (store.data?.homeV2 || {});
  const rawInsights = home.insights || [];
  const branchId = store.get('currentScopeBranch') || 'all';

  let insights = rawInsights;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      insights = rawInsights.map(ins => {
        if (ins.title.includes('Madhapur') && branchName !== 'Madhapur') {
          return {
            ...ins,
            title: ins.title.replace('Madhapur', branchName),
            body: ins.body.replace('Madhapur', branchName)
          };
        }
        return ins;
      });
    }
  }

  const badgeCount = document.getElementById('insights-badge-count');
  if (badgeCount) badgeCount.textContent = `${insights.length} Active`;

  container.innerHTML = insights.map(ins => {
    const colorClass = ins.severity === 'warning'
      ? 'border-amber-200 bg-amber-50/70 text-amber-900'
      : ins.severity === 'celebrate'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
      : 'border-blue-200 bg-blue-50/70 text-blue-900';

    const iconClass = ins.severity === 'warning'
      ? 'ph-bold ph-warning-circle text-amber-600'
      : ins.severity === 'celebrate'
      ? 'ph-bold ph-trend-up text-emerald-600'
      : 'ph-bold ph-info text-blue-600';

    return `
      <div class="p-4 rounded-xl border ${colorClass} transition-all">
        <div class="flex items-start gap-2.5">
          <i class="${iconClass} text-base mt-0.5 shrink-0"></i>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-xs text-slate-900 mb-1">${ins.title}</div>
            <p class="text-xs text-slate-700 leading-relaxed mb-3">${ins.body}</p>
            <div class="flex flex-wrap gap-2">
              ${(ins.recommendedActions || []).map(a => `
                <button type="button" class="px-2.5 py-1 text-xs rounded-lg border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-800 font-medium shadow-2xs transition-colors">
                  ${a.label}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function renderExamCountdowns() {
  const container = document.getElementById('countdowns-list');
  if (!container) return;

  const home = (store.homeV2 && Object.keys(store.homeV2).length > 0)
    ? store.homeV2
    : (store.data?.homeV2 || {});
  const countdowns = home.countdowns || [];

  container.innerHTML = countdowns.map(c => `
    <div class="p-3.5 rounded-xl border border-border bg-surface flex items-center justify-between shadow-2xs hover:border-amber-300 transition-colors">
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
          <i class="ph-duotone ph-calendar text-base"></i>
        </div>
        <div>
          <div class="text-xs font-semibold text-slate-900">${c.targetExam}</div>
          <div class="text-[11px] text-muted">Target: ${c.scheduledStart}</div>
        </div>
      </div>
      <div class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-xs shrink-0">
        ${c.daysAway}d remaining
      </div>
    </div>
  `).join('');
}

export function renderRisersList() {
  const container = document.getElementById('risers-list');
  if (!container) return;

  const home = (store.homeV2 && Object.keys(store.homeV2).length > 0)
    ? store.homeV2
    : (store.data?.homeV2 || {});
  const risers = home.risers || [];
  const branchId = store.get('currentScopeBranch') || 'all';

  let filtered = risers;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      const matches = risers.filter(r => {
        const st = (store.students || []).find(s => s.id === r.studentId);
        return (st && st.branch === branchName) || r.batchName?.includes(branchName);
      });
      if (matches.length > 0) filtered = matches;
    }
  }

  container.innerHTML = filtered.map(r => `
    <div class="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition-colors" onclick="openStudentModal('${r.studentId}')">
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
          ${r.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-900">${r.name}</p>
          <p class="text-[11px] text-muted">${r.batchName} · Prior: ${r.prior}%</p>
        </div>
      </div>
      <div class="text-right font-mono">
        <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
          +${r.delta} pts
        </span>
        <p class="text-[11px] text-muted mt-0.5">${r.recent}%</p>
      </div>
    </div>
  `).join('');
}

export function renderFallersList() {
  const container = document.getElementById('fallers-list');
  if (!container) return;

  const home = (store.homeV2 && Object.keys(store.homeV2).length > 0)
    ? store.homeV2
    : (store.data?.homeV2 || {});
  const fallers = home.fallers || [];
  const branchId = store.get('currentScopeBranch') || 'all';

  let filtered = fallers;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      const matches = fallers.filter(f => {
        const st = (store.students || []).find(s => s.id === f.studentId);
        return (st && st.branch === branchName) || f.batchName?.includes(branchName);
      });
      if (matches.length > 0) filtered = matches;
    }
  }

  container.innerHTML = filtered.map(f => `
    <div class="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition-colors" onclick="openStudentModal('${f.studentId}')">
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-xs shrink-0">
          ${f.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-900">${f.name}</p>
          <p class="text-[11px] text-muted">${f.batchName} · Prior: ${f.prior}%</p>
        </div>
      </div>
      <div class="text-right font-mono">
        <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
          ${f.delta} pts
        </span>
        <p class="text-[11px] text-muted mt-0.5">${f.recent}%</p>
      </div>
    </div>
  `).join('');
}

export function filterStudentMovementTab(tabName) {
  store.set('currentStudentMovementTab', tabName);

  const btnRankers = document.getElementById('tab-btn-rankers');
  const btnRisers = document.getElementById('tab-btn-risers');
  const btnFallers = document.getElementById('tab-btn-fallers');

  const boxRankers = document.getElementById('container-movement-rankers');
  const boxRisers = document.getElementById('container-movement-risers');
  const boxFallers = document.getElementById('container-movement-fallers');

  const activeBtnClass = 'px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 font-semibold movement-tab-btn active flex items-center gap-1.5';
  const inactiveBtnClass = 'px-2.5 py-1 rounded-md text-muted hover:text-slate-900 movement-tab-btn flex items-center gap-1.5';

  if (btnRankers) btnRankers.className = tabName === 'rankers' ? activeBtnClass : inactiveBtnClass;
  if (btnRisers) btnRisers.className = tabName === 'risers' ? activeBtnClass : inactiveBtnClass;
  if (btnFallers) btnFallers.className = tabName === 'fallers' ? activeBtnClass : inactiveBtnClass;

  if (boxRankers) {
    if (tabName === 'rankers') boxRankers.classList.remove('hidden');
    else boxRankers.classList.add('hidden');
  }
  if (boxRisers) {
    if (tabName === 'risers') boxRisers.classList.remove('hidden');
    else boxRisers.classList.add('hidden');
  }
  if (boxFallers) {
    if (tabName === 'fallers') boxFallers.classList.remove('hidden');
    else boxFallers.classList.add('hidden');
  }
}

export function renderBatchOverviewRows() {
  const container = document.getElementById('batch-overview-rows');
  if (!container) return;
  const batches = store.batches || [];

  container.innerHTML = batches.map(b => {
    const pct = Math.min(100, Math.round(b.avgScore || 60));
    const status = pct >= 65 ? "Healthy" : pct >= 50 ? "Warning" : "Critical";
    const statusClass = pct >= 65 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
    const barClass = pct >= 65 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

    return `
      <div class="grid sm:grid-cols-[1fr_80px_1fr_100px] items-center gap-4 p-3 rounded-xl border border-border/50 hover:bg-slate-50 transition-colors cursor-pointer" onclick="openBatchModal('${b.id || b.batchId}')">
        <div>
          <p class="text-sm font-semibold text-gray-900">${b.name}</p>
          <p class="text-xs text-muted">${b.branch} · ${b.targetExam || 'JEE Mains'}</p>
        </div>
        <div class="text-center font-mono text-xs font-medium text-slate-700">
          ${b.students || 48}
        </div>
        <div class="flex items-center gap-3">
          <div class="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
            <div class="h-full rounded-full ${barClass}" style="width: ${pct}%"></div>
          </div>
          <span class="font-mono text-xs font-bold text-slate-900 w-10 text-right">${pct}%</span>
        </div>
        <div class="text-center">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${statusClass}">${status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Progressive Disclosure Handlers ─────────────────────────────────────────

export function toggleOverviewExtraKpis() {
  const visible = !store.get('overviewExtraKpisVisible');
  store.set('overviewExtraKpisVisible', visible);

  const drawer = document.getElementById('overview-extra-kpis');
  const text = document.getElementById('text-toggle-extra-kpis');
  const icon = document.getElementById('icon-toggle-extra-kpis');
  if (!drawer) return;

  if (visible) {
    drawer.classList.remove('hidden');
    if (text) text.textContent = 'Hide Extra Figures';
    if (icon) icon.className = 'ph-bold ph-caret-up text-xs transition-transform';
  } else {
    drawer.classList.add('hidden');
    if (text) text.textContent = 'Show 4 More Institutional Figures';
    if (icon) icon.className = 'ph-bold ph-caret-down text-xs transition-transform';
  }
}

export function toggleOverviewSubjectBreakdown() {
  const visible = !store.get('overviewSubjectBreakdownVisible');
  store.set('overviewSubjectBreakdownVisible', visible);

  const drawer = document.getElementById('overview-subject-breakdown');
  const text = document.getElementById('text-toggle-subject');
  const icon = document.getElementById('icon-toggle-subject');
  if (!drawer) return;

  if (visible) {
    drawer.classList.remove('hidden');
    if (text) text.textContent = 'Hide Subject Breakdown';
    if (icon) icon.className = 'ph-bold ph-caret-up text-xs transition-transform';
  } else {
    drawer.classList.add('hidden');
    if (text) text.textContent = 'View Subject Breakdown (Physics, Chemistry, Maths/Bio)';
    if (icon) icon.className = 'ph-bold ph-caret-down text-xs transition-transform';
  }
}

export function focusOverviewAttentionList() {
  const target = document.getElementById('overview-attention-section');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('ring-2', 'ring-red-400', 'transition-all');
  setTimeout(() => {
    target.classList.remove('ring-2', 'ring-red-400');
  }, 1800);
}

export function filterOverviewAttention(filterType) {
  store.set('currentOverviewAttentionFilter', filterType);
  document.querySelectorAll('#overview-attention-tabs .attention-tab-btn').forEach(btn => {
    if (
      (filterType === 'all' && btn.textContent.includes('All')) ||
      (filterType === 'critical' && btn.textContent.includes('Critical')) ||
      (filterType === 'low_score' && btn.textContent.includes('Low Score')) ||
      (filterType === 'absent' && btn.textContent.includes('Absent'))
    ) {
      btn.className = 'px-2.5 py-1 rounded-md bg-red-100 text-red-800 font-semibold attention-tab-btn active';
    } else {
      btn.className = 'px-2.5 py-1 rounded-md text-muted hover:text-slate-900 attention-tab-btn';
    }
  });
  renderOverviewAttentionList();
}

export function renderOverviewAttentionList() {
  const container = document.getElementById('overview-attention-list');
  if (!container) return;

  const allAtRisk = store.institution?.atRiskStudents || [];
  const filterType = store.get('currentOverviewAttentionFilter');
  const branchId = store.get('currentScopeBranch') || 'all';

  let scopedAtRisk = allAtRisk;
  if (branchId !== 'all') {
    const branch = (store.branches || []).find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    if (branchName) {
      const match = allAtRisk.filter(s => s.branch === branchName);
      if (match.length > 0) scopedAtRisk = match;
    }
  }
  
  const filtered = scopedAtRisk.filter(s => {
    if (filterType === 'critical') return s.severity === 'critical';
    if (filterType === 'low_score') return (s.percentile < 35 || (s.scores && s.scores[s.scores.length - 1] < 90));
    if (filterType === 'absent') return (s.daysSinceLogin >= 3);
    return true;
  });

  const badgeEl = document.getElementById('attention-badge-count');
  if (badgeEl) badgeEl.textContent = `${scopedAtRisk.length} Flagged`;

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
  }).join('');
}

export function toggleOverviewBranchComparison() {
  const visible = !store.get('overviewBranchComparisonVisible');
  store.set('overviewBranchComparisonVisible', visible);

  const container = document.getElementById('overview-branch-comparison-container');
  const text = document.getElementById('text-toggle-branches');
  const icon = document.getElementById('icon-toggle-branches');
  if (!container) return;

  if (visible) {
    container.classList.remove('hidden');
    if (text) text.textContent = 'Collapse Branch Comparison';
    if (icon) icon.className = 'ph-bold ph-caret-up text-xs transition-transform';
    setTimeout(() => {
      store.charts.branchChart?.resize();
      store.charts.attendanceDonutChart?.resize();
    }, 60);
  } else {
    container.classList.add('hidden');
    if (text) text.textContent = 'Expand Branch Comparison';
    if (icon) icon.className = 'ph-bold ph-caret-down text-xs transition-transform';
  }
}
