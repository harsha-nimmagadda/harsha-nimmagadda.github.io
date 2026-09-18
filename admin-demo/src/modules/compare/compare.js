/**
 * modules/compare/compare.js
 * Batch & Student Score Matrix Comparison Explorer View Controller.
 * Note: Marked as "Leave as it is in the existing app" per developer directives.
 */
import { store } from '../../core/state.js';
import { registerChart } from '../../core/chart-utils.js';

export const compareState = {
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

export function setCompareGrain(grain) {
  compareState.grain = grain;
  compareState.page = 1;
  compareState.selectedRows.clear();
  const studBtn = document.getElementById('compare-grain-students');
  const batchBtn = document.getElementById('compare-grain-batches');
  const bandRows = document.getElementById('compare-band-rows');
  const searchInput = document.getElementById('compare-search-input');
  if (grain === 'students') {
    if (studBtn) studBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-white text-primary shadow-xs';
    if (batchBtn) batchBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
    if (bandRows) bandRows.textContent = 'Students — tick up to 10 at a time to plot on the chart';
    if (searchInput) searchInput.placeholder = 'Search students…';
  } else {
    if (batchBtn) batchBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-white text-primary shadow-xs';
    if (studBtn) studBtn.className = 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
    if (bandRows) bandRows.textContent = 'Batches — tick up to 10 at a time to plot on the chart';
    if (searchInput) searchInput.placeholder = 'Search batches…';
  }
  renderCompareView();
}

export function setCompareChartMode(mode) {
  compareState.chartMode = mode;
  const barsBtn = document.getElementById('compare-mode-bars');
  const linesBtn = document.getElementById('compare-mode-lines');
  if (mode === 'bars') {
    if (barsBtn) barsBtn.className = 'rounded-md px-2.5 py-1 text-xs font-semibold bg-white text-primary shadow-xs';
    if (linesBtn) linesBtn.className = 'rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900';
  } else {
    if (linesBtn) linesBtn.className = 'rounded-md px-2.5 py-1 text-xs font-semibold bg-white text-primary shadow-xs';
    if (barsBtn) barsBtn.className = 'rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900';
  }
  renderCompareView();
}

export function setCompareSubject(subject) {
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

export function onCompareSearch(q) {
  compareState.search = q || '';
  compareState.page = 1;
  renderCompareView();
}

export function setComparePageSize(size) {
  compareState.pageSize = Number(size) || 25;
  compareState.page = 1;
  renderCompareView();
}

export function changeComparePage(delta) {
  compareState.page += delta;
  renderCompareView();
}

export function toggleCompareExam(id) {
  if (compareState.excludedExams.has(id)) {
    compareState.excludedExams.delete(id);
  } else {
    compareState.excludedExams.add(id);
  }
  renderCompareView();
}

export function toggleCompareRow(id) {
  if (compareState.selectedRows.has(id)) {
    compareState.selectedRows.delete(id);
  } else {
    if (compareState.selectedRows.size < 10) {
      compareState.selectedRows.add(id);
    }
  }
  renderCompareView();
}

export function clearComparePlots() {
  compareState.selectedRows.clear();
  renderCompareView();
}

export function toggleCompareSort(key) {
  if (compareState.sort === key) {
    compareState.dir = compareState.dir === 'desc' ? 'asc' : 'desc';
  } else {
    compareState.sort = key;
    compareState.dir = 'desc';
  }
  renderCompareView();
}

export function toggleCompareSelectAll() {
  if (compareState.selectedRows.size > 0) {
    compareState.selectedRows.clear();
  } else {
    const all = window.__currentCompareSortedRows || [];
    all.slice(0, 10).forEach(r => compareState.selectedRows.add(r.id));
  }
  renderCompareView();
}

export function getCompareAccuracyColor(pct) {
  if (pct == null) return '';
  if (pct >= 70) return '#10B981';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
}

export function renderCompareView() {
  // Marked as: "Leave as it is in the existing app" (Developer directive)
}

export function renderCompareHeaders(exams, includedIdx) {
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

export function renderCompareTableBody(rows, exams, includedIdx, subjIdx) {
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

export function renderCompareChart(exams, includedIdx, allRows, subjIdx) {
  const canvas = document.getElementById('matrixChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const selectedRowsList = allRows.filter(r => compareState.selectedRows.has(r.id));
  const palette = [
    '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#84CC16'
  ];

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

    const chartInstance = new Chart(canvas, {
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
    registerChart('matrixChart', chartInstance);
  } else {
    const datasets = selectedRowsList.map((r, idx) => ({
      label: r.name,
      data: includedIdx.map(ei => r.effectiveMarks[ei]),
      backgroundColor: palette[idx % palette.length],
      borderRadius: 4,
      barPercentage: 0.8
    }));

    const chartInstance = new Chart(canvas, {
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
    registerChart('matrixChart', chartInstance);
  }
}

export function renderCompareMatrix() {
  renderCompareView();
}
