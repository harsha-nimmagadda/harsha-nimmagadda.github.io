/**
 * modules/dpp/dpp.js
 * Practice Adherence (DPP) View Controller.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';

export const dppState = {
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
  pageSize: 25,
  windowDays: 7
};

export const PRACTICE_TYPE_LABELS = {
  dpp: 'Daily Practice',
  daily5: 'Daily 5',
  mock: 'Mock Test',
  error_revision: 'Error Revision',
  weekly_clash: 'Weekly Clash',
  custom: 'Custom Practice',
  peer: 'Peer Challenge',
  all: 'All Practice'
};

export function getDppAdherenceTone(val) {
  if (val == null) return 'text-muted';
  if (val >= 0.7) return 'text-success';
  if (val >= 0.4) return 'text-warning';
  return 'text-danger';
}

export function setDppType(type) {
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

export function setDppWindow(win) {
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
  dppState.windowDays = days;
  const to = new Date(2026, 2, 12);
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(from) + ' → ' + fmt(to);
  renderDppView();
}

export function onDppBranchChange(val) {
  dppState.branchId = val;
  dppState.page = 0;
  renderDppView();
}

export function onDppBatchChange(val) {
  dppState.batchId = val;
  dppState.page = 0;
  renderDppView();
}

export function onDppSectionChange(val) {
  dppState.section = val;
  dppState.page = 0;
  renderDppView();
}

export function setDppTab(tab) {
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

export function setDppFacet(facet) {
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

export function onDppSearch(q) {
  dppState.search = q || '';
  dppState.page = 0;
  const clearBtn = document.getElementById('dpp-clear-search');
  if (clearBtn) {
    if (q) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderDppView();
}

export function clearDppSearch() {
  const input = document.getElementById('dpp-search-input');
  if (input) input.value = '';
  onDppSearch('');
}

export function onDppSortChange(sort) {
  if (dppState.tab === 'batches') {
    dppState.batchSort = sort;
  } else {
    dppState.studentSort = sort;
  }
  dppState.page = 0;
  renderDppView();
}

export function changeDppPage(delta) {
  dppState.page += delta;
  renderDppView();
}

export function drillIntoBatchDpp(batchId, branchId) {
  if (!batchId) return;
  dppState.batchId = batchId;
  if (branchId) dppState.branchId = branchId;
  const batchFilter = document.getElementById('dpp-batch-filter');
  if (batchFilter) batchFilter.value = batchId;
  setDppTab('students');
}

export function openStudentDpp(studentId) {
  store.set('currentActiveStudentId', studentId);
  router.navigate('student-practice');
}

export function renderDppView() {
  const dppData = store.dpp || {};
  const allBatches = dppData.byBatch || [];
  const allStudents = dppData.students || [];

  const headerTitle = document.getElementById('dpp-header-title');
  if (headerTitle) {
    headerTitle.textContent = (PRACTICE_TYPE_LABELS[dppState.practiceType] || 'Daily Practice') + ' adherence';
  }

  let filteredBatches = allBatches.filter(b => {
    if (dppState.branchId && b.branchId !== dppState.branchId) return false;
    if (dppState.batchId && b.batchId !== dppState.batchId) return false;
    if (dppState.search) {
      const q = dppState.search.toLowerCase();
      if (!b.batchName.toLowerCase().includes(q) && !b.branch.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  filteredBatches.sort((a, b) => {
    switch (dppState.batchSort) {
      case 'adherence_desc': return b.adherence - a.adherence;
      case 'accuracy': return (b.avgAccuracy || 0) - (a.avgAccuracy || 0);
      case 'size': return b.students - a.students;
      case 'name': return a.batchName.localeCompare(b.batchName);
      default: return a.adherence - b.adherence;
    }
  });

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

  filteredStudents.sort((a, b) => {
    switch (dppState.studentSort) {
      case 'adherence_desc': return b.adherence - a.adherence;
      case 'accuracy': return (b.avgAccuracy || 0) - (a.avgAccuracy || 0);
      case 'streak': return b.streak - a.streak;
      case 'name': return a.name.localeCompare(b.name);
      default: return a.adherence - b.adherence;
    }
  });

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
  const windowDays = dppState.windowDays || 7;
  if (elAdherenceSub) elAdherenceSub.textContent = Math.round(totalCount * avgAdh * windowDays).toLocaleString() + ' of ' + (totalCount * windowDays).toLocaleString() + ' student-days';
  if (elAccuracy) elAccuracy.textContent = avgAcc + '%';
  if (elStreak) elStreak.textContent = onStreakCount.toLocaleString();

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

export function renderDPP() {
  renderDppView();
}
