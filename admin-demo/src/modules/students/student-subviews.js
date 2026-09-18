/**
 * modules/students/student-subviews.js
 * Specialized Student Deep-Dive Sub-Views:
 * ERI, Heatmap, Predictive Path, Rank Predictor, Practice, Success Gap,
 * Weakness Improvement, Time vs Performance, Attendance Impact, and Answer Behavior.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart } from '../../core/chart-utils.js';
import { getStudentAnalyticsData } from './student-detail.js';

let currentHeatmapFilter = 'all';

// 1. ERI Sub-view
export function renderStudentEri(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
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
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const points = eri.velocityPoints || [];
    const chartInstance = new Chart(ctx, {
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
    registerChart('eriVelocityChart', chartInstance);
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
export function filterHeatmapSubject(subj) {
  currentHeatmapFilter = subj;
  document.querySelectorAll(".hm-filter-btn").forEach(btn => {
    btn.className = "hm-filter-btn rounded-lg px-3 py-1 text-muted hover:text-foreground";
  });
  const activeBtn = document.getElementById("hm-filter-" + subj);
  if (activeBtn) activeBtn.className = "hm-filter-btn rounded-lg px-3 py-1 bg-primary/10 text-primary";
  const sid = store.get('currentActiveStudentId') || 's-101';
  renderStudentHeatmap(sid);
}

export function renderStudentHeatmap(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
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
export function renderStudentPredictivePath(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  const pred = data.predictivePathData || {};

  const scoreEl = document.getElementById("pred-score");
  if (scoreEl) scoreEl.textContent = `${pred.forecastScore || 278} / 300`;
  const rangeEl = document.getElementById("pred-range");
  if (rangeEl) rangeEl.textContent = pred.forecastRange || "270 – 286";
  const pctEl = document.getElementById("pred-pct");
  if (pctEl) pctEl.textContent = `${pred.forecastPercentile || 99.1}%ile`;

  // Trajectory Canvas
  const canvas = document.getElementById("predictivePathChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");

    const points = pred.points || [];
    const labels = points.map(p => p.label);
    const actualScores = points.map(p => !p.predicted ? p.score : null);
    const projectedScores = points.map(p => p.predicted ? p.score : (p.label === 'Final Mock' ? p.score : null));

    const chartInstance = new Chart(ctx, {
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
    registerChart('predictivePathChart', chartInstance);
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
export function onWhatIfScoreChange(deltaMarks) {
  const delta = parseInt(deltaMarks, 10);
  const display = document.getElementById("whatif-delta-display");
  if (display) display.textContent = (delta >= 0 ? "+" : "") + delta + " marks";

  const baseRank = 1800;
  const simulatedRank = Math.max(120, Math.round(baseRank * Math.pow(0.95, delta)));
  const simEl = document.getElementById("whatif-simulated-rank");
  if (simEl) {
    const simPct = (100 - (simulatedRank / 15000)).toFixed(2);
    simEl.textContent = `Simulated AIR: ${simulatedRank.toLocaleString()} (~${simPct}%ile)`;
  }
}

export function renderStudentRankPredictor(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
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
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const history = rp.rankHistory || [];
    const chartInstance = new Chart(ctx, {
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
    registerChart('rankHistoryChart', chartInstance);
  }
}

// 5. Practice Analytics
export let currentPracticeTab = 'cadence';
let currentPracticeFilter = 'all';

export function switchPracticeTab(tabId) {
  currentPracticeTab = tabId || 'cadence';

  const tabs = [
    { id: 'cadence', btnId: 'practice-tab-btn-cadence', panelId: 'practice-tab-cadence-panel' },
    { id: 'mistakes', btnId: 'practice-tab-btn-mistakes', panelId: 'practice-tab-mistakes-panel' },
    { id: 'history', btnId: 'practice-tab-btn-history', panelId: 'practice-tab-history-panel' }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.btnId);
    const panel = document.getElementById(t.panelId);

    if (t.id === currentPracticeTab) {
      if (panel) panel.classList.remove('hidden');
      if (btn) {
        btn.className = 'practice-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all bg-orange-600 text-white shadow-xs';
      }
    } else {
      if (panel) panel.classList.add('hidden');
      if (btn) {
        btn.className = 'practice-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-medium text-muted transition-all hover:text-foreground hover:bg-slate-50';
      }
    }
  });

  if (currentPracticeTab === 'cadence') {
    setTimeout(() => {
      const sid = store.get('currentActiveStudentId') || 's-101';
      const data = getStudentAnalyticsData(sid);
      renderPracticeBreakdownChart(data.practiceData || {});
    }, 40);
  }
}

export function openPracticeWhatsAppModal() {
  const modal = document.getElementById("practice-whatsapp-modal");
  if (!modal) return;

  const sid = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  const prac = data.practiceData || {};
  const isNeverStarted = data.profile.name === 'HARINI RAO' || (prac.streakDays === 0) || (prac.dppCompletionRate === 0);

  const bodyEl = document.getElementById("practice-whatsapp-body");
  if (bodyEl) {
    if (isNeverStarted) {
      bodyEl.textContent = `Dear Parent,\nThis is an URGENT academic attendance & practice notification from Sri Chaitanya / Narayana Academic Operations Cell.\n\nYour ward *${data.profile.name}* (Roll: ${data.profile.rollNumber || '626045'}, Batch: ${data.profile.batchName || 'JR MPC'} · ${data.profile.branchName || 'LB Nagar'}) has logged *0 Daily Practice Problems (DPP)* submissions this week.\n\n⚠️ Current DPP Adherence: 0%\n⚠️ Current Active Streak: 0 Days\n\nDaily homework and question drill completion is mandatory to prepare for competitive examinations. Please ensure your ward attends daily evening study hours and clears pending DPP assignments immediately.\n\n— Academic Mentor & Student Discipline Cell`;
    } else {
      bodyEl.textContent = `Dear Parent,\nHere is the weekly self-study & practice update for your ward *${data.profile.name}* (Roll: ${data.profile.rollNumber || '225144'}, Batch: ${data.profile.batchName || 'SR MPC'} · ${data.profile.branchName || 'Madhapur'}):\n\n🔥 *Daily DPP Streak*: ${prac.streakDays || 19} Days Consecutive\n📊 *Practice Accuracy*: ${prac.overallAccuracy || 88.4}% (${(prac.totalQuestions || 1480).toLocaleString()} questions solved)\n⚖️ *Study Habit Balance*: ${prac.selfAssignedRatio || 65}% Self-Study vs ${100 - (prac.selfAssignedRatio || 65)}% Faculty DPPs\n📓 *Mistake Notebook*: ${prac.errorCorrection?.resolved || 74} of ${prac.errorCorrection?.flagged || 92} test mistakes re-drilled and cleared.\n\nYour ward is maintaining disciplined practice adherence. Keep up the encouragement at home!\n\n— Academic Mentor & Student Discipline Cell`;
    }
  }

  modal.classList.remove("hidden");
}

export function closePracticeWhatsAppModal() {
  const modal = document.getElementById("practice-whatsapp-modal");
  if (modal) modal.classList.add("hidden");
}

export function copyPracticeWhatsAppMessage() {
  const msgEl = document.getElementById("practice-whatsapp-body");
  const copyTextEl = document.getElementById("practice-whatsapp-copy-text");
  if (!msgEl) return;

  navigator.clipboard.writeText(msgEl.textContent || "").then(() => {
    if (copyTextEl) copyTextEl.textContent = "Copied!";
    setTimeout(() => {
      if (copyTextEl) copyTextEl.textContent = "Copy Text";
    }, 2000);
  }).catch(() => {
    if (copyTextEl) copyTextEl.textContent = "Copied!";
  });
}

export function sendPracticeWhatsAppDirect() {
  const msgEl = document.getElementById("practice-whatsapp-body");
  const text = msgEl ? msgEl.textContent : "";
  const encoded = encodeURIComponent(text);
  window.open(`https://web.whatsapp.com/send?text=${encoded}`, '_blank');
}

export function filterPracticeActivity(filterType) {
  currentPracticeFilter = filterType || 'all';

  const filterBtns = [
    { key: 'all', id: 'prac-filter-all' },
    { key: 'DPP', id: 'prac-filter-DPP' },
    { key: 'Chapter Test', id: 'prac-filter-Chapter' },
    { key: 'PYQ', id: 'prac-filter-PYQ' },
    { key: 'Self Practice', id: 'prac-filter-Self' }
  ];

  filterBtns.forEach(btn => {
    const el = document.getElementById(btn.id);
    if (!el) return;
    if (btn.key === currentPracticeFilter) {
      el.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary text-white shadow-xs';
    } else {
      el.className = 'px-2.5 py-1 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-slate-100 transition-colors';
    }
  });

  const sid = store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  renderPracticeActivityList(data.practiceData || {});
}

function renderPracticeActivityList(prac) {
  const listEl = document.getElementById("practice-activity-list");
  if (!listEl) return;

  const allItems = prac.activityDays || [];
  const filtered = currentPracticeFilter === 'all'
    ? allItems
    : allItems.filter(a => a.type.toLowerCase().includes(currentPracticeFilter.toLowerCase()));

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="py-8 text-center text-xs text-muted">
        No practice sessions recorded for "${currentPracticeFilter}".
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(a => {
    const isDPP = a.type.includes("DPP");
    const isPYQ = a.type.includes("PYQ");
    const isChapter = a.type.includes("Chapter");
    const badgeColor = isDPP ? 'bg-blue-100 text-blue-800' : isPYQ ? 'bg-amber-100 text-amber-800' : isChapter ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800';
    const acc = Math.round((a.correct / a.answered) * 100);
    const accBadge = acc >= 85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : acc >= 70
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-gray-900">${a.date}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeColor}">${a.type}</span>
            ${a.subject ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">${a.subject}</span>` : ''}
          </div>
          ${a.topic ? `<p class="text-[11px] text-muted">${a.topic}</p>` : ''}
        </div>
        <div class="flex items-center gap-3 self-end sm:self-center">
          <span class="text-muted text-[11px]"><i class="ph-bold ph-clock text-[10px] mr-1"></i>${a.minutes} mins</span>
          <span class="font-mono font-bold text-gray-800">${a.correct} / ${a.answered} correct</span>
          <span class="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${accBadge}">${acc}%</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderPracticeBreakdownChart(prac) {
  const canvas = document.getElementById("practiceBreakdownChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const types = prac.typeBreakdown || [
      { type: "Daily Practice Problems (DPP)", count: 520, percentage: 35, accuracy: 91, color: "#2563EB" },
      { type: "Chapter Practice Drills", count: 440, percentage: 30, accuracy: 86, color: "#10B981" },
      { type: "Previous Year Questions (PYQ)", count: 320, percentage: 22, accuracy: 93, color: "#F59E0B" },
      { type: "Self-Initiated Drills", count: 200, percentage: 13, accuracy: 80, color: "#8B5CF6" }
    ];

    const chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: types.map(t => t.type),
        datasets: [{
          label: "Questions Solved",
          data: types.map(t => t.count),
          backgroundColor: types.map(t => t.color || "#2563EB"),
          borderRadius: 8,
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
              label: (ctx) => {
                const item = types[ctx.dataIndex];
                return ` ${item.count} questions solved (${item.accuracy}% accuracy)`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: "#F1F5F9" } },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
    registerChart('practiceBreakdownChart', chartInstance);

    // Summary strip below chart
    const summaryEl = document.getElementById("practice-type-summary");
    if (summaryEl) {
      summaryEl.innerHTML = types.map(t => `
        <div class="p-2 rounded-xl bg-slate-50 border border-border/60 text-center">
          <p class="text-[10px] text-muted truncate font-medium">${t.type}</p>
          <p class="font-mono text-sm font-bold text-gray-900 mt-0.5">${t.count} Qs</p>
          <p class="text-[10px] font-semibold" style="color: ${t.color || '#2563EB'}">${t.accuracy}% acc · ${t.percentage}%</p>
        </div>
      `).join("");
    }
  }
}

export function renderStudentPractice(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  const prac = data.practiceData || {};
  const isNeverStarted = data.profile.name === 'HARINI RAO' || (prac.streakDays === 0) || (prac.dppCompletionRate === 0);

  // 1. Student Context Badge
  const infoEl = document.getElementById("practice-student-info");
  if (infoEl) {
    infoEl.textContent = `${data.profile.name} · ${data.profile.rollNumber || ''} · ${data.profile.batchName || 'SR MPC'} (${data.profile.branchName || 'Madhapur'}) · ${data.profile.targetExam || 'JEE Mains'}`;
  }

  // 2. Inactive Student Alert Banner (toggle dynamically)
  const banner = document.getElementById("practice-inactive-banner");
  if (banner) {
    if (isNeverStarted) {
      banner.classList.remove("hidden");
      const desc = document.getElementById("practice-inactive-desc");
      if (desc) {
        desc.textContent = `${data.profile.name} (${data.profile.batchName} · ${data.profile.branchName}) has not submitted any Daily Practice Problems. Adherence: 0% · Active Streak: 0 Days. Immediate parental counseling recommended.`;
      }
    } else {
      banner.classList.add("hidden");
    }
  }

  // 3. Primary Top 4 Pulse Metrics
  const streakEl = document.getElementById("practice-kpi-streak");
  if (streakEl) streakEl.textContent = isNeverStarted ? "0 Days" : `${prac.streakDays || 19} Days`;
  const streakSubEl = document.getElementById("practice-kpi-streak-sub");
  if (streakSubEl) streakSubEl.textContent = isNeverStarted ? "Never Started ⚠️" : `Longest: ${prac.longestStreakDays || (prac.streakDays || 19) + 5} Days`;

  const accEl = document.getElementById("practice-kpi-accuracy");
  if (accEl) accEl.textContent = isNeverStarted ? "0.0%" : `${prac.overallAccuracy || 88.4}%`;
  const solvedEl = document.getElementById("practice-kpi-solved");
  if (solvedEl) solvedEl.textContent = isNeverStarted ? "0" : (prac.totalQuestions || 1480).toLocaleString();

  const ratioEl = document.getElementById("practice-kpi-ratio");
  if (ratioEl) ratioEl.textContent = isNeverStarted ? "0 : 0" : `${prac.selfAssignedRatio || 65} : ${100 - (prac.selfAssignedRatio || 65)}`;

  const mistakeRateEl = document.getElementById("practice-kpi-mistake-rate");
  if (mistakeRateEl) {
    const flagged = prac.errorCorrection?.flagged || 92;
    const resolved = prac.errorCorrection?.resolved || 74;
    const rate = isNeverStarted ? 0 : Math.round((resolved / flagged) * 100);
    mistakeRateEl.textContent = `${rate}%`;
  }

  // 4. Habit & Cadence Metrics Strip
  const dppStreakEl = document.getElementById("practice-kpi-dpp-streak");
  if (dppStreakEl) dppStreakEl.textContent = isNeverStarted ? "0 days" : `${prac.dppStreak || prac.streakDays || 19} days`;
  const mockFreqEl = document.getElementById("practice-kpi-mock-freq");
  if (mockFreqEl) mockFreqEl.textContent = isNeverStarted ? "0.0 / wk" : `${prac.mockFrequency || 2.4} / wk`;
  const timeEl = document.getElementById("practice-kpi-time");
  if (timeEl) timeEl.textContent = isNeverStarted ? "0.0 hrs" : `${prac.totalHours || 48.5} hrs`;
  const adhEl = document.getElementById("practice-kpi-adherence");
  if (adhEl) adhEl.textContent = isNeverStarted ? "0.0%" : `${prac.dppCompletionRate || 94.2}%`;

  // 5. Practice Volume Breakdown Chart
  renderPracticeBreakdownChart(prac);

  // 6. Activity List (Tab 3)
  renderPracticeActivityList(prac);

  // 7. Error Correction Funnel & Pending Topics (Tab 2)
  const err = prac.errorCorrection || { flagged: 92, resolved: 74, pending: 18, avgTurnaroundDays: 2.8 };
  const flagEl = document.getElementById("practice-err-flagged");
  if (flagEl) flagEl.textContent = isNeverStarted ? 0 : err.flagged;
  const resEl = document.getElementById("practice-err-resolved");
  if (resEl) resEl.textContent = isNeverStarted ? 0 : err.resolved;
  const pendEl = document.getElementById("practice-err-pending");
  if (pendEl) pendEl.textContent = isNeverStarted ? 0 : err.pending;
  const turnEl = document.getElementById("practice-err-turnaround");
  if (turnEl) turnEl.textContent = isNeverStarted ? "—" : `${err.avgTurnaroundDays} Days`;

  // Populate Pending Topics List in Mistake Notebook
  const pendingTopicsList = document.getElementById("practice-pending-topics-list");
  if (pendingTopicsList) {
    const weakList = (data.weakAreas?.subjects || []).flatMap(s =>
      (s.topics || []).map(t => ({ subject: s.subjectName, topic: t.topicName, errors: t.errorCount || 4, diff: t.masteryLevel || 'Hard' }))
    ).slice(0, 4);

    const topics = weakList.length > 0 ? weakList : [
      { subject: "Physics", topic: "Rotational Dynamics — Pure Rolling & Inertia", errors: 8, diff: "Hard" },
      { subject: "Mathematics", topic: "Definite Integrals — Piecewise & Modulus", errors: 6, diff: "Medium" },
      { subject: "Chemistry", topic: "Coordination Compounds — CFT & Isomerism", errors: 5, diff: "Hard" },
      { subject: "Physics", topic: "Wave Optics — Path Difference & Fringe Width", errors: 4, diff: "Hard" }
    ];

    pendingTopicsList.innerHTML = topics.map(item => `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-slate-50/50 hover:bg-slate-50 transition-colors">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-800">${item.subject}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${item.diff === 'Hard' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">${item.diff}</span>
            <span class="text-xs font-bold text-gray-900">${item.topic}</span>
          </div>
          <p class="text-[11px] text-rose-600 font-medium">${item.errors} mistakes flagged in recent tests · Unresolved</p>
        </div>
        <button onclick="alert('Assigning 15 Concept Practice Drills for ' + '${item.topic}')" class="inline-flex items-center gap-1.5 self-end sm:self-center px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-all shadow-xs">
          <i class="ph-bold ph-plus-circle text-xs"></i>
          <span>Assign 15 Drills</span>
        </button>
      </div>
    `).join("");
  }

  // 8. Initialize Active Tab
  switchPracticeTab(currentPracticeTab);
}

// 6. Success Gap
export function renderStudentSuccessGap(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
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
export function renderStudentWeaknessImprovement(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
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
export function renderStudentTimeVsPerformance(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  const tp = data.timeVsPerformanceData || {};

  const canvas = document.getElementById("timePerformanceScatterChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const sessions = tp.sessions || [];
    const chartInstance = new Chart(ctx, {
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
    registerChart('timePerformanceScatterChart', chartInstance);
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
export function renderStudentAttendanceImpact(studentId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const data = getStudentAnalyticsData(sid);
  const att = data.attendanceImpactData || {};

  const canvas = document.getElementById("attendanceCorrelationChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const points = att.scatterPoints || [];
    const chartInstance = new Chart(ctx, {
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
    registerChart('attendanceCorrelationChart', chartInstance);
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

// 10. Student Answer Behavior
export function openStudentAnswerBehavior(studentId, examId) {
  const sid = studentId || 's-101';
  const eid = examId || 'ex-301';
  store.set('currentActiveStudentId', sid);
  store.set('currentActiveExamId', eid);
  router.navigate('student-answer-behavior');
}

export function renderStudentAnswerBehavior(studentId, examId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const eid = examId || store.get('currentActiveExamId') || 'ex-301';
  const key = `${sid}_${eid}`;
  const data = (store.studentAnswerBehavior && store.studentAnswerBehavior[key]) || 
               (store.studentAnswerBehavior && store.studentAnswerBehavior["s-101_ex-301"]);
  if (!data) return;

  const kpis = data.kpis || { changedCorrectToWrong: 0, flaggedQuestions: 2, avgVisitsPerQuestion: 1.15 };
  const elChanged = document.getElementById("ab-kpi-changed");
  if (elChanged) elChanged.textContent = kpis.changedCorrectToWrong;
  const elLost = document.getElementById("ab-kpi-marks-lost");
  if (elLost) elLost.textContent = `${data.totalMarksLost || 0} marks lost to second-guessing`;
  const elFlag = document.getElementById("ab-kpi-flagged");
  if (elFlag) elFlag.textContent = kpis.flaggedQuestions;
  const elVisits = document.getElementById("ab-kpi-visits");
  if (elVisits) elVisits.textContent = kpis.avgVisitsPerQuestion;

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

export const renderEriVelocity = renderStudentEri;
export const renderKnowledgeHeatmap = renderStudentHeatmap;
export const renderPredictivePath = renderStudentPredictivePath;
export const renderRankPredictor = renderStudentRankPredictor;
export const renderPracticeAnalytics = renderStudentPractice;
export const renderSuccessGap = renderStudentSuccessGap;
export const renderWeaknessImprovement = renderStudentWeaknessImprovement;
export const renderTimeVsPerformance = renderStudentTimeVsPerformance;
export const renderAttendanceImpact = renderStudentAttendanceImpact;

