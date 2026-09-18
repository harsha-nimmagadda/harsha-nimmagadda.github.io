/**
 * modules/cohorts/cohorts.js
 * Cohort Progression, Batch Comparison & Student Standing Lookup View Controller.
 * Option 3: Unified Single-Page with Visual Sticky Filter Rail & Expandable Drawers.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart } from '../../core/chart-utils.js';

export const cohortsState = {
  visibleCohorts: new Set(['c-jee-2026', 'c-jee-2025', 'c-neet-2026']),
  activePerformerCohort: 'c-jee-2026',
  lookupCohort: 'c-jee-2026',
  selectedStudentId: 's-104',
  drawers: {
    performers: true,
    batches: true
  }
};

export function toggleCohortVisibility(cohortId) {
  if (cohortsState.visibleCohorts.has(cohortId)) {
    if (cohortsState.visibleCohorts.size > 1) {
      cohortsState.visibleCohorts.delete(cohortId);
    }
  } else {
    cohortsState.visibleCohorts.add(cohortId);
  }
  renderCohortsView();
}

export function setCohortPerformerTab(cohortId) {
  cohortsState.activePerformerCohort = cohortId;
  renderCohortsView();
}

export function setCohortLookupTab(cohortId) {
  cohortsState.lookupCohort = cohortId;
  const cohortsData = store.cohorts || {};
  const c = (cohortsData.cohorts || []).find(x => x.cohortId === cohortId);
  if (c && c.topPerformers && c.topPerformers[0]) {
    cohortsState.selectedStudentId = c.topPerformers[0].studentId;
  }
  renderCohortsView();
}

export function drillIntoCohort(cohortId) {
  cohortsState.lookupCohort = cohortId;
  setCohortPerformerTab(cohortId);
  renderCohortsView();
  jumpToCohortSection('lookup');
}

export function selectCohortRail(cohortId) {
  cohortsState.lookupCohort = cohortId;
  cohortsState.activePerformerCohort = cohortId;
  renderCohortsView();
}

export function toggleCohortDrawer(drawerId) {
  if (!cohortsState.drawers) {
    cohortsState.drawers = { performers: true, batches: true };
  }
  const current = cohortsState.drawers[drawerId] !== false;
  cohortsState.drawers[drawerId] = !current;
  
  if (typeof document === 'undefined') return;

  const content = document.getElementById('cohort-drawer-' + drawerId + '-content');
  const chevron = document.getElementById('cohort-drawer-' + drawerId + '-chevron');
  
  if (content) {
    if (cohortsState.drawers[drawerId]) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  }
  if (chevron) {
    if (cohortsState.drawers[drawerId]) {
      chevron.classList.remove('-rotate-90');
      chevron.classList.add('rotate-0');
    } else {
      chevron.classList.remove('rotate-0');
      chevron.classList.add('-rotate-90');
    }
  }
}

export function jumpToCohortSection(sectionId) {
  if (sectionId === 'performers' || sectionId === 'lookup') {
    if (!cohortsState.drawers.performers) {
      toggleCohortDrawer('performers');
    }
  }
  if (sectionId === 'batches') {
    if (!cohortsState.drawers.batches) {
      toggleCohortDrawer('batches');
    }
  }

  let el = null;
  if (sectionId === 'trajectory') el = document.getElementById('cohort-section-trajectory');
  else if (sectionId === 'distribution') el = document.getElementById('cohort-section-distribution');
  else if (sectionId === 'performers') el = document.getElementById('cohort-drawer-performers');
  else if (sectionId === 'lookup') el = document.getElementById('cohort-section-lookup');
  else if (sectionId === 'batches') el = document.getElementById('cohort-drawer-batches');

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function onCohortStudentSearch(query) {
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

  const students = store.students || [];
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

export function clearCohortStudentSearch() {
  const input = document.getElementById('cohort-student-search-input');
  if (input) input.value = '';
  const dropdown = document.getElementById('cohort-student-search-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  const clearBtn = document.getElementById('cohort-student-clear-search');
  if (clearBtn) clearBtn.classList.add('hidden');
}

export function selectCohortStudent(studentId, studentName) {
  cohortsState.selectedStudentId = studentId;
  const input = document.getElementById('cohort-student-search-input');
  if (input) input.value = studentName;
  const dropdown = document.getElementById('cohort-student-search-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  renderCohortsView();
}

// ── 1-Click WhatsApp Batch Notice Modal & Action Handlers ────

export function openCohortWhatsAppModal() {
  const modal = document.getElementById('cohort-whatsapp-modal');
  const bodyEl = document.getElementById('cohort-whatsapp-message-body');
  if (!modal || !bodyEl) return;

  const cohortsData = store.cohorts || {};
  const list = cohortsData.cohorts || [];
  const activeCohort = list.find(c => c.cohortId === cohortsState.lookupCohort) || list[0] || {
    name: 'JEE 2026 Cohort',
    targetExam: 'JEE Mains',
    academicYear: '2025-26',
    studentCount: 1420,
    latestAvgPct: 74.5,
    atRiskCount: 18,
    batches: []
  };

  const batches = (activeCohort && activeCohort.batches) || [
    { name: 'SR MPC', branch: 'Madhapur', finalAvg: 78.4, attendance: 91.2 },
    { name: 'SR MPC', branch: 'Bachupally', finalAvg: 69.8, attendance: 86.4 }
  ];

  const topBatch = batches[0] || { name: 'SR MPC', branch: 'Madhapur', finalAvg: 78.4, attendance: 91.2 };
  const lowestBatch = batches[batches.length - 1] || { name: 'SR MPC', branch: 'Bachupally', finalAvg: 69.8, attendance: 86.4 };
  const gap = (topBatch.finalAvg - lowestBatch.finalAvg).toFixed(1);
  const atRisk = activeCohort.atRiskCount != null ? activeCohort.atRiskCount : 18;

  bodyEl.value = `*Excellencia AI · Batch Comparison & Faculty Huddle Notice*
*Cohort*: ${activeCohort.name} (${activeCohort.targetExam} · ${activeCohort.academicYear || '2025-26'})
*Overall Benchmark*: ${activeCohort.latestAvgPct || 74.5}% across ${(activeCohort.studentCount || 1420).toLocaleString()} students

🏆 *Top Performing Section*: ${topBatch.name} (${topBatch.branch}) — Avg ${topBatch.finalAvg}%, ${topBatch.attendance}% Attendance
⚠️ *Section Spread Gap*: ${gap} pp spread between leading and foundation sections (${topBatch.branch} vs ${lowestBatch.branch})
🚨 *At-Risk Action Queue*: ${atRisk} students requiring targeted academic counseling

*Recommended Action*: 15 remedial problem-solving drills have been scheduled for sections currently below the 72% cohort benchmark. Please review Section Diagnostics.

— Academic Dean & Examination Cell`;

  modal.classList.remove('hidden');
}

export function closeCohortWhatsAppModal() {
  const modal = document.getElementById('cohort-whatsapp-modal');
  if (modal) modal.classList.add('hidden');
}

export function copyCohortWhatsAppMessage() {
  const bodyEl = document.getElementById('cohort-whatsapp-message-body');
  const btn = document.getElementById('cohort-copy-whatsapp-btn');
  if (!bodyEl) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(bodyEl.value);
  }
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph-bold ph-check text-emerald-600 text-sm"></i> <span>Copied!</span>';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  }
}

export function sendCohortWhatsAppDirect() {
  const bodyEl = document.getElementById('cohort-whatsapp-message-body');
  if (!bodyEl) return;
  const text = encodeURIComponent(bodyEl.value);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

export function assignCohortDrills() {
  const cohortsData = store.cohorts || {};
  const list = cohortsData.cohorts || [];
  const activeCohort = list.find(c => c.cohortId === cohortsState.lookupCohort) || list[0];
  const name = activeCohort ? activeCohort.name : 'JEE 2026';
  alert(`🎯 15 Targeted Revision Drills assigned to all underperforming sections in ${name}. Pushed to student practice queues.`);
}

export function exportCohortBatchReport() {
  const cohortsData = store.cohorts || {};
  const list = cohortsData.cohorts || [];
  const activeCohort = list.find(c => c.cohortId === cohortsState.lookupCohort) || list[0];
  const batches = (activeCohort && activeCohort.batches) || [];
  
  let csv = 'Batch Name,Branch,Enrolled,Avg Percentile,Final Avg,Attendance,Top Student\n';
  batches.forEach(b => {
    csv += `"${b.name}","${b.branch}",${b.students},${b.avgPercentile},${b.finalAvg},${b.attendance},"${b.topStudent}"\n`;
  });

  if (navigator.clipboard) {
    navigator.clipboard.writeText(csv);
    alert('📋 Batch comparison standings copied to clipboard as CSV!');
  } else {
    alert('📋 Batch comparison standings exported.');
  }
}

// ── Main View Renderer ──────────────────────────────────────

export function renderCohortsView() {
  if (typeof document === 'undefined') return;
  const cohortsData = store.cohorts || {};
  const list = cohortsData.cohorts || [];
  const activeCohort = list.find(c => c.cohortId === cohortsState.lookupCohort) || list[0];

  // Header Badge
  const badgeEl = document.getElementById('cohort-active-badge');
  if (badgeEl && activeCohort) {
    badgeEl.textContent = activeCohort.name;
  }

  // Constituent Batches Fallback
  const constituentBatches = (activeCohort && activeCohort.batches) || [
    { batchId: 'b-srmpc-madhapur', name: 'SR MPC', branch: 'Madhapur', students: 78, avgPercentile: 74.2, finalAvg: 78.4, attendance: 91.2, topStudent: 'Bhagam Khyathi' },
    { batchId: 'b-srmpc-shamirpet', name: 'SR MPC', branch: 'Shamirpet', students: 84, avgPercentile: 71.5, finalAvg: 75.6, attendance: 89.4, topStudent: 'VISHWANATH AKSHAY KUMAR' },
    { batchId: 'b-srmpc-suchitra', name: 'SR MPC', branch: 'Suchitra', students: 68, avgPercentile: 68.4, finalAvg: 72.8, attendance: 87.5, topStudent: 'Nikhil Chowdary' },
    { batchId: 'b-srmpc-ecil', name: 'SR MPC', branch: 'ECIL', students: 72, avgPercentile: 67.2, finalAvg: 71.5, attendance: 88.0, topStudent: 'R PRANAV' },
    { batchId: 'b-srmpc-bachupally', name: 'SR MPC', branch: 'Bachupally', students: 64, avgPercentile: 65.8, finalAvg: 69.8, attendance: 86.4, topStudent: 'Ananya Sharma' }
  ];

  const topBatch = constituentBatches[0];
  const lowestBatch = constituentBatches[constituentBatches.length - 1];

  // Pulse Vital Signs (Rule 2: 5-Second Rapid Comprehension)
  const topBatchEl = document.getElementById('cohort-kpi-top-batch');
  const topScoreEl = document.getElementById('cohort-kpi-top-score');
  const topAttEl = document.getElementById('cohort-kpi-top-att');
  if (topBatchEl && topBatch) topBatchEl.textContent = `${topBatch.name} · ${topBatch.branch}`;
  if (topScoreEl && topBatch) topScoreEl.textContent = `${topBatch.finalAvg}%`;
  if (topAttEl && topBatch) topAttEl.textContent = `${topBatch.attendance}%`;

  const gapEl = document.getElementById('cohort-kpi-gap');
  if (gapEl && topBatch && lowestBatch) {
    gapEl.textContent = `${(topBatch.finalAvg - lowestBatch.finalAvg).toFixed(1)} pp`;
  }

  const benchmarkEl = document.getElementById('cohort-kpi-benchmark');
  const enrolledEl = document.getElementById('cohort-kpi-enrolled');
  if (benchmarkEl && activeCohort) {
    benchmarkEl.textContent = `${activeCohort.latestAvgPct || 74.5}%`;
  }
  if (enrolledEl && activeCohort) {
    enrolledEl.textContent = `${(activeCohort.studentCount || 1420).toLocaleString()} students active`;
  }

  const atRiskEl = document.getElementById('cohort-kpi-at-risk');
  if (atRiskEl && activeCohort) {
    atRiskEl.textContent = `${activeCohort.atRiskCount || 18} Students`;
  }

  // Sticky Visual Filter Rail Selector Pills
  const railSelector = document.getElementById('cohort-rail-selector');
  if (railSelector) {
    railSelector.innerHTML = [
      '<span class="text-[11px] font-bold uppercase tracking-wider text-muted mr-1 hidden sm:inline">Cohort:</span>',
      ...list.map(c => {
        const isActive = c.cohortId === cohortsState.lookupCohort;
        return `
          <button type="button" onclick="selectCohortRail('${c.cohortId}')" class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            isActive 
              ? 'bg-emerald-600 text-white shadow-2xs' 
              : 'border border-border bg-white text-slate-700 hover:bg-slate-100'
          }">
            <span class="h-2 w-2 rounded-full ${isActive ? 'bg-white' : ''}" style="${isActive ? '' : 'background-color: ' + c.color}"></span>
            <span>${c.name}</span>
            <span class="text-[10px] opacity-80">(${(c.studentCount || 0).toLocaleString()})</span>
          </button>
        `;
      })
    ].join('');
  }

  // 1. Summary Cards
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
        '        <p class="mt-0.5 text-[11px] uppercase tracking-wider text-muted font-semibold">' + c.targetExam + ' · ' + (c.academicYear || '2025-26') + '</p>',
        '      </div>',
        '      <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-semibold">',
        '        <i class="ph-bold ph-users text-xs"></i> ' + (c.studentCount || 0).toLocaleString() + '',
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
        '        <a href="#student/' + topScorer.studentId + '" onclick="switchView(\'student-detail\')" class="mt-1 block truncate text-xs font-semibold text-primary hover:underline" title="' + topScorer.name + ' · ' + topScorer.avgPct + '%">',
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
  if (chartCanvas && typeof Chart !== 'undefined') {
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

    const chartInstance = new Chart(chartCanvas, {
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
    registerChart('cohortLineChart', chartInstance);
  }

  // 4. Distribution Quartile Bars & Benchmark Bands
  const distContainer = document.getElementById('cohort-distribution-container');
  if (distContainer) {
    const visibleCohorts = list.filter(c => cohortsState.visibleCohorts.has(c.cohortId));
    distContainer.innerHTML = visibleCohorts.map(c => {
      const d = c.distribution || { min: 38, q1: 58.4, median: 74.5, q3: 88.2, max: 98.4 };
      return [
        '<div class="rounded-xl border border-border bg-slate-50/50 p-4">',
        '  <div class="flex items-center justify-between text-xs font-semibold mb-2">',
        '    <span class="text-gray-900 font-bold">' + c.name + '</span>',
        '    <span class="text-muted">Cohort Median: <strong class="text-gray-900 font-mono">' + d.median + '%</strong></span>',
        '  </div>',
        '  <div class="h-4 w-full bg-slate-200/80 rounded-full overflow-hidden relative flex items-center">',
        '    <div class="absolute h-0.5 bg-slate-400" style="left: ' + d.min + '%; width: ' + (d.max - d.min) + '%;"></div>',
        '    <div class="absolute h-full rounded-md shadow-xs" style="left: ' + d.q1 + '%; width: ' + (d.q3 - d.q1) + '%; background-color: ' + c.color + '; opacity: 0.85;"></div>',
        '    <div class="absolute h-full w-1.5 bg-gray-900 z-10" style="left: ' + d.median + '%;"></div>',
        '  </div>',
        '  <div class="flex justify-between text-[10px] text-muted font-mono mt-2">',
        '    <span title="Foundation Push Zone">Needs Push: ' + d.min + '%</span>',
        '    <span>25th Pct: ' + d.q1 + '%</span>',
        '    <span class="font-bold text-gray-900">Median: ' + d.median + '%</span>',
        '    <span>75th Pct: ' + d.q3 + '%</span>',
        '    <span title="Elite Zone" class="text-emerald-700 font-bold">Elite: ' + d.max + '%</span>',
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
        (active ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold' : 'border-border text-muted hover:text-foreground') + '">',
        c.name,
        '</button>'
      ].join('');
    }).join('');
  }

  const perfTbody = document.getElementById('cohort-top-performers-tbody');
  if (perfTbody) {
    const activeCohortPerf = list.find(c => c.cohortId === cohortsState.activePerformerCohort) || list[0];
    const performers = (activeCohortPerf && activeCohortPerf.topPerformers) || [];
    perfTbody.innerHTML = performers.map(p => [
      '<tr class="border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
      '  <td class="px-5 py-3 font-mono font-bold text-muted tabular-nums">#' + p.rank + '</td>',
      '  <td class="px-5 py-3 font-semibold text-gray-900">',
      '    <a href="#student/' + (p.studentId || 's-101') + '" onclick="switchView(\'student-detail\')" class="hover:text-primary hover:underline">' + p.name + '</a>',
      '  </td>',
      '  <td class="px-5 py-3 text-muted">' + p.batch + '</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-gray-900 tabular-nums">' + p.score + '%</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-emerald-600 tabular-nums">' + p.percentile + 'th</td>',
      '</tr>'
    ].join('')).join('');
  }

  // 6. Student-vs-Cohort Lookup
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
      '    <a href="#student/' + rankInfo.studentId + '" onclick="switchView(\'student-detail\')" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs">',
      '      <span>Open Full Student Dossier</span> <i class="ph-bold ph-arrow-right text-xs"></i>',
      '    </a>',
      '  </div>',
      '</div>'
    ].join('');
  }

  // 7. Constituent Batches Table
  const batchesTbody = document.getElementById('cohort-batches-tbody');
  if (batchesTbody) {
    batchesTbody.innerHTML = constituentBatches.map(b => [
      '<tr class="border-b border-border/60 hover:bg-slate-50 transition-colors text-xs">',
      '  <td class="px-5 py-3 font-semibold text-gray-900">',
      '    <a href="#batch/' + b.batchId + '" onclick="switchView(\'batch-detail\')" class="hover:text-primary hover:underline">' + b.name + '</a>',
      '  </td>',
      '  <td class="px-5 py-3 text-muted">' + b.branch + '</td>',
      '  <td class="px-5 py-3 text-center font-mono text-slate-800">' + b.students + '</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-emerald-600">' + b.avgPercentile + 'th</td>',
      '  <td class="px-5 py-3 text-right font-mono font-bold text-gray-900">' + b.finalAvg + '%</td>',
      '  <td class="px-5 py-3 text-center font-mono text-slate-700">' + b.attendance + '%</td>',
      '  <td class="px-5 py-3 font-medium text-slate-800">' + b.topStudent + '</td>',
      '  <td class="px-5 py-3 text-right">',
      '    <a href="#batch/' + b.batchId + '" onclick="switchView(\'batch-detail\')" class="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors">',
      '      <span>View Batch</span> <i class="ph-bold ph-arrow-right text-[10px]"></i>',
      '    </a>',
      '  </td>',
      '</tr>'
    ].join('')).join('');
  }
}

export function renderCohorts() {
  renderCohortsView();
}
