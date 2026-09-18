/**
 * modules/home/home.js
 * Automated Insights & Operational Pulse View Controller.
 */
import { store } from '../../core/state.js';
import { registerChart } from '../../core/chart-utils.js';
import { openStudentModal, openBatchModal } from '../../core/modals.js';

export function renderHome() {
  const home = (store.homeV2 && Object.keys(store.homeV2).length > 0) 
    ? store.homeV2 
    : (store.data?.homeV2 || {});

  // Pulse Strip (6 tiles)
  if (home.pulse) {
    const p = home.pulse;
    const elActive = document.getElementById("pulse-active");
    if (elActive) elActive.textContent = (p.activeStudents || 4120).toLocaleString();

    const elAvg = document.getElementById("pulse-avg");
    if (elAvg) elAvg.innerHTML = `${p.avgScore7d || 58.4}% <span class="text-xs font-normal text-emerald-700">+${p.avgScoreDelta || 2.1} pts</span>`;

    const elAtt = document.getElementById("pulse-att");
    if (elAtt) elAtt.innerHTML = `${p.attendance7d || 89.2}% <span class="text-xs font-normal text-success">+${p.attendanceDelta || 1.4} pts</span>`;

    const elRisk = document.getElementById("pulse-atrisk");
    if (elRisk) elRisk.textContent = p.atRiskCount || 14;

    const elTests = document.getElementById("pulse-tests");
    if (elTests) elTests.textContent = p.testsThisWeek || 18;

    const elSub = document.getElementById("pulse-submissions");
    if (elSub) elSub.textContent = (p.submissions24h || 342).toLocaleString();
  }
  
  const canvas = document.getElementById("home30dChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (store.charts.home30dChart && typeof store.charts.home30dChart.destroy === 'function') {
        store.charts.home30dChart.destroy();
      }
      const data = home.trend30d || [];
      const chartInstance = new Chart(ctx, {
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
      registerChart('home30dChart', chartInstance);
    }
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

  // Batch Health Grid
  const batchHealthGrid = document.getElementById("home-batch-health-grid");
  if (batchHealthGrid) {
    const batches = home.batches || store.batches || [];
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
