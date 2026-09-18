/**
 * modules/exams/exam-detail.js
 * Comprehensive Exam Deep Dive Workspace Controller.
 * Manages distributions, scorers leaderboard, question analysis palette, topic breakdown,
 * subject RWL, absent lists, and full question detail modal.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart } from '../../core/chart-utils.js';
import { openStudentModal } from '../../core/modals.js';
import { openStudentTestAnalysis } from '../students/test-analysis.js';

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

let examQaView = "palette";
let modalViewingQNum = 1;
let currentExamSelectedQIdx = 0;
export let currentExamTab = 'results';

export function openFullExamAnalytics(examId) {
  if (examId) {
    store.set('currentActiveExamId', examId);
  }
  const modal = document.getElementById("exam-modal");
  if (modal) modal.classList.add("hidden");
  router.navigate(`exam/${examId || 'ex-301'}`);
}

export function getExamAnalyticsData(examId) {
  const targetId = examId || store.get('currentActiveExamId') || 'ex-301';
  if (store.examAnalytics && store.examAnalytics[targetId]) {
    return store.examAnalytics[targetId];
  }
  const primary = (store.examAnalytics && store.examAnalytics['ex-301']) || {};
  const found = (store.exams || []).find(e => e.id === targetId);

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

export function renderExamDetail(examId) {
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
  const spreadEl = document.getElementById("exam-kpi-spread");
  if (spreadEl) spreadEl.textContent = `${data.lowestScore || 42} – ${data.highestScore || 284}`;
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

  // 6. Charts
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

  // 13. Question Analysis
  renderExamQuestionAnalysis(data);

  // 14. Subject-wise RWL Bars
  renderExamSubjectRwl(data);

  // 15. Absent Students List
  renderExamAbsentList(data);

  // 16. Initialize 3-Tab Command Center Active Tab
  switchExamTab(currentExamTab);
}

export function switchExamTab(tabId) {
  currentExamTab = tabId || 'results';

  const tabs = [
    { id: 'results', btnId: 'exam-tab-btn-results', panelId: 'exam-tab-results-panel' },
    { id: 'forensic', btnId: 'exam-tab-btn-forensic', panelId: 'exam-tab-forensic-panel' },
    { id: 'interventions', btnId: 'exam-tab-btn-interventions', panelId: 'exam-tab-interventions-panel' }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.btnId);
    const panel = document.getElementById(t.panelId);

    if (t.id === currentExamTab) {
      if (panel) panel.classList.remove('hidden');
      if (btn) {
        btn.className = 'exam-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all bg-indigo-600 text-white shadow-xs';
      }
    } else {
      if (panel) panel.classList.add('hidden');
      if (btn) {
        btn.className = 'exam-tab-btn flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-medium text-muted transition-all hover:text-foreground hover:bg-slate-50';
      }
    }
  });

  if (currentExamTab === 'results') {
    setTimeout(() => {
      const eid = store.get('currentActiveExamId') || 'ex-301';
      renderExamDistributionCharts(getExamAnalyticsData(eid));
    }, 40);
  }
}

export function toggleExamInsights() {
  const content = document.getElementById("exam-insights-content");
  const caret = document.getElementById("exam-insights-caret");
  if (!content) return;
  content.classList.toggle("hidden");
  if (caret) caret.classList.toggle("rotate-180");
}

export function jumpToExamQuestion(qIdx) {
  switchExamTab('forensic');
  currentExamSelectedQIdx = qIdx;
  setExamQaView("palette");
  setTimeout(() => {
    document.getElementById("question-analysis")?.scrollIntoView({ behavior: "smooth" });
  }, 50);
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamQuestionAnalysis(getExamAnalyticsData(eid));
}

export function renderExamDistributionCharts(data) {
  const histCanvas = document.getElementById("examDistributionChart");
  if (histCanvas && typeof Chart !== 'undefined') {
    const ctx = histCanvas.getContext("2d");
    const dist = data.scoreDistribution || [
      { range: "0-60", count: 18 },
      { range: "61-120", count: 84 },
      { range: "121-180", count: 268 },
      { range: "181-240", count: 214 },
      { range: "241-300", count: 88 }
    ];
    const chartInstance = new Chart(ctx, {
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
    registerChart('examDistributionChart', chartInstance);
  }

  const accCanvas = document.getElementById("examSubjectAccuracyChart");
  if (accCanvas && typeof Chart !== 'undefined') {
    const ctx = accCanvas.getContext("2d");
    const accData = data.subjectRadarData || [
      { subject: "Chemistry", accuracy: 70 },
      { subject: "Physics", accuracy: 63 },
      { subject: "Mathematics", accuracy: 53 }
    ];
    const chartInstance = new Chart(ctx, {
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
    registerChart('examSubjectAccuracyChart', chartInstance);
  }
}

export function onExamScorersSearch(val) {
  examScorersQuery = (val || "").trim().toLowerCase();
  examScorersPage = 1;
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamScorersTable(getExamAnalyticsData(eid));
}

export function toggleExamScorersFlagged() {
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
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamScorersTable(getExamAnalyticsData(eid));
}

export function sortExamScorers(field) {
  if (examScorersSortField === field) {
    examScorersSortDir = examScorersSortDir === "asc" ? "desc" : "asc";
  } else {
    examScorersSortField = field;
    examScorersSortDir = (field === "name" || field === "rank") ? "asc" : "desc";
  }
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamScorersTable(getExamAnalyticsData(eid));
}

export function changeExamScorersPage(delta) {
  examScorersPage += delta;
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamScorersTable(getExamAnalyticsData(eid));
}

export function renderExamScorersTable(data) {
  const tbody = document.getElementById("exam-scorers-table-body");
  if (!tbody) return;

  const rawScorers = data.topScorers || [];
  const flaggedCount = rawScorers.filter(s => s.flagged).length || 3;
  const flagBadge = document.getElementById("exam-scorers-flagged-count");
  if (flagBadge) flagBadge.textContent = flaggedCount;

  let filtered = rawScorers.filter(s => {
    if (examScorersFlaggedOnly && !s.flagged) return false;
    if (examScorersQuery && !s.name.toLowerCase().includes(examScorersQuery) && !s.rollNo.includes(examScorersQuery)) return false;
    return true;
  });

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

  const pageInfo = document.getElementById("exam-scorers-page-info");
  if (pageInfo) pageInfo.textContent = `Showing ${startIdx + 1} - ${endIdx} of ${filtered.length}`;
  const pageInd = document.getElementById("exam-scorers-page-indicator");
  if (pageInd) pageInd.textContent = `Page ${examScorersPage} / ${totalPages}`;
  const prevBtn = document.getElementById("exam-scorers-prev-btn");
  if (prevBtn) prevBtn.disabled = examScorersPage <= 1;
  const nextBtn = document.getElementById("exam-scorers-next-btn");
  if (nextBtn) nextBtn.disabled = examScorersPage >= totalPages;

  const eid = store.get('currentActiveExamId') || 'ex-301';

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
              <button type="button" onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')" class="font-semibold text-primary hover:underline text-left text-sm">
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

export function setExamAtRiskSeverity(sev) {
  examAtRiskSeverity = sev;
  document.querySelectorAll('.exam-risk-filter-btn').forEach(btn => {
    if (btn.dataset.severity === sev) {
      btn.className = 'exam-risk-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary';
    } else {
      btn.className = 'exam-risk-filter-btn px-2.5 py-1 text-xs font-medium rounded-lg text-muted hover:text-foreground';
    }
  });
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamAtRiskSection(getExamAnalyticsData(eid));
}

export function renderExamAtRiskSection(data) {
  const grid = document.getElementById("exam-at-risk-grid");
  if (!grid) return;

  const list = (data.atRiskStudents || []).filter(s => {
    if (examAtRiskSeverity !== "all" && s.severity !== examAtRiskSeverity) return false;
    return true;
  });

  const eid = store.get('currentActiveExamId') || 'ex-301';

  grid.innerHTML = list.map(s => {
    const sevBadge = s.severity === "critical" ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700">Critical</span>' :
                     s.severity === "warning" ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Warning</span>' :
                     '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">Watch</span>';

    return `
      <div class="rounded-xl border border-border bg-white p-4 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-gray-900 hover:text-primary cursor-pointer" onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')">${s.name}</p>
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
          <button onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')" class="text-xs text-muted hover:text-slate-900">
            <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

export function filterExamMixedPerformance() {
  examMixedStrongFilter = document.getElementById("exam-mixed-strong")?.value || "all";
  examMixedWeakFilter = document.getElementById("exam-mixed-weak")?.value || "all";
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamMixedPerformance(getExamAnalyticsData(eid));
}

export function renderExamMixedPerformance(data) {
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

  const eid = store.get('currentActiveExamId') || 'ex-301';

  grid.innerHTML = list.map(p => `
    <div onclick="openStudentTestAnalysis('${p.studentId}', '${eid}')" class="group rounded-xl border border-border bg-white p-4 transition-all hover:border-primary/40 hover:shadow-xs cursor-pointer">
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

export function renderExamSubjectRankings(data) {
  const container = document.getElementById("exam-subject-rankings-grid");
  if (!container) return;

  const eid = store.get('currentActiveExamId') || 'ex-301';
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
                  <button onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')" class="font-medium text-gray-900 hover:text-primary transition-colors text-left">
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

export function changeExamSubjPage(subjectId, delta) {
  examSubjectRankPages[subjectId] = (examSubjectRankPages[subjectId] || 1) + delta;
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamSubjectRankings(getExamAnalyticsData(eid));
}

export function renderExamOrgRankings(data) {
  const eid = store.get('currentActiveExamId') || 'ex-301';

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
                <button onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')" class="font-medium text-gray-900 hover:text-primary text-left">
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
                <button onclick="openStudentTestAnalysis('${s.studentId}', '${eid}')" class="font-medium text-gray-900 hover:text-primary text-left">
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

let examTopicSortField = "accuracy";
let examTopicSortDir = "desc";

export function sortExamTopics(field) {
  if (examTopicSortField === field) {
    examTopicSortDir = examTopicSortDir === "asc" ? "desc" : "asc";
  } else {
    examTopicSortField = field;
    examTopicSortDir = (field === "topic" || field === "subject") ? "asc" : "desc";
  }
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamTopicBreakdown(getExamAnalyticsData(eid));
}

export function renderExamTopicBreakdown(data) {
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

export function setExamQaView(viewMode) {
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

  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamQuestionAnalysis(getExamAnalyticsData(eid));
}

export function selectExamQuestion(qIdx) {
  currentExamSelectedQIdx = qIdx;
  const eid = store.get('currentActiveExamId') || 'ex-301';
  renderExamQuestionAnalysis(getExamAnalyticsData(eid));
}

export function renderExamQuestionAnalysis(data) {
  const list = data.questionAnalysis || [];
  if (list.length === 0) return;

  const currentQ = list[currentExamSelectedQIdx] || list[0];

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

    const panel = document.getElementById("exam-question-detail-panel");
    if (panel && currentQ) {
      const diffColor = currentQ.difficulty === 'Hard' ? 'bg-rose-100 text-rose-800' : currentQ.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
      const opt = currentQ.optionDistribution || { A: 25, B: 25, C: 25, D: 25 };

      panel.innerHTML = `
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

        <div class="p-4 rounded-xl bg-slate-50 border border-border">
          <p class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Question Item</p>
          <div class="text-sm text-gray-900 leading-relaxed font-sans">${currentQ.questionText || 'Question statement'}</div>
        </div>

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

        <div class="rounded-xl border border-border bg-slate-50/50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Option Selection Distribution</p>
          <div class="flex h-6 w-full overflow-hidden rounded-lg bg-slate-200 font-mono text-[10px] text-white font-bold">
            <div class="bg-blue-500 flex items-center justify-center" style="width: ${opt.A || 25}%" title="Option A: ${opt.A}%">A (${opt.A}%)</div>
            <div class="bg-purple-500 flex items-center justify-center" style="width: ${opt.B || 25}%" title="Option B: ${opt.B}%">B (${opt.B}%)</div>
            <div class="bg-amber-500 flex items-center justify-center" style="width: ${opt.C || 25}%" title="Option C: ${opt.C}%">C (${opt.C}%)</div>
            <div class="bg-emerald-500 flex items-center justify-center" style="width: ${opt.D || 25}%" title="Option D: ${opt.D}%">D (${opt.D}%)</div>
          </div>
        </div>

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

export function renderExamSubjectRwl(data) {
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

export function renderExamAbsentList(data) {
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

export function openExamQuestionDetailModal(qNum) {
  modalViewingQNum = qNum || 1;
  const modal = document.getElementById("exam-question-detail-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  updateExamQuestionModalContent();
}

export function closeExamQuestionDetailModal() {
  document.getElementById("exam-question-detail-modal")?.classList.add("hidden");
}

export function navigateExamQuestionModal(delta) {
  modalViewingQNum = Math.max(1, Math.min(75, modalViewingQNum + delta));
  updateExamQuestionModalContent();
}

export function updateExamQuestionModalContent() {
  const eid = store.get('currentActiveExamId') || 'ex-301';
  const data = getExamAnalyticsData(eid);
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

export function onExamDetailFilterChange() {
  const br = document.getElementById("exam-detail-branch-filter")?.value;
  const ba = document.getElementById("exam-detail-batch-filter")?.value;
  const sc = document.getElementById("exam-detail-section-filter")?.value;
  console.log("Exam detail facet changed:", { branch: br, batch: ba, section: sc });
}

export function openExamAbsenteeWhatsApp() {
  const modal = document.getElementById("exam-absentee-whatsapp-modal");
  if (!modal) return;

  const eid = store.get('currentActiveExamId') || 'ex-301';
  const data = getExamAnalyticsData(eid);
  const title = data.title || "Mock Test — JEE Mains";
  const dateStr = data.scheduledStart ? new Date(data.scheduledStart).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : "today";

  const msgBodyEl = document.getElementById("exam-absentee-message-body");
  if (msgBodyEl) {
    msgBodyEl.textContent = `Dear Parent,\nThis is an urgent academic attendance notification from the Academic Operations Cell.\n\nYour ward was marked ABSENT for today's scheduled competitive test:\n📋 *${title}* (${dateStr})\n\nRegular participation in weekend mock tests is vital for national rank estimation and tracking weak chapter topics. Please connect with your ward's Batch Mentor immediately to schedule a re-attempt.\n\n— Academic Operations & Student Discipline Cell`;
  }

  modal.classList.remove("hidden");
}

export function closeExamAbsenteeWhatsAppModal() {
  const modal = document.getElementById("exam-absentee-whatsapp-modal");
  if (modal) modal.classList.add("hidden");
}

export function copyExamAbsenteeMessage() {
  const msgEl = document.getElementById("exam-absentee-message-body");
  const copyTextEl = document.getElementById("exam-absentee-copy-text");
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

export function sendExamAbsenteeWhatsAppDirect() {
  const msgEl = document.getElementById("exam-absentee-message-body");
  const text = msgEl ? msgEl.textContent : "";
  const encoded = encodeURIComponent(text);
  window.open(`https://web.whatsapp.com/send?text=${encoded}`, '_blank');
}

