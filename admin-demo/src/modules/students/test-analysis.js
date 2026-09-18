/**
 * modules/students/test-analysis.js
 * Student Test Analysis, Question Review & Telemetry Controller.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';

let taSelectedFilter = 'all';
let taSelectedQIdx = 0;

export function openStudentTestAnalysis(studentId, examId) {
  const sid = studentId || 's-101';
  const eid = examId || 'ex-301';
  store.set('currentActiveStudentId', sid);
  store.set('currentActiveExamId', eid);
  router.switchView(`student/${sid}/test-analysis/${eid}`);
}

export function renderStudentTestAnalysis(studentId, examId) {
  const sid = studentId || store.get('currentActiveStudentId') || 's-101';
  const eid = examId || store.get('currentActiveExamId') || 'ex-301';
  const key = `${sid}_${eid}`;
  const data = (store.studentExamAnalytics && store.studentExamAnalytics[key]) || 
               (store.studentExamAnalytics && store.studentExamAnalytics["s-101_ex-301"]);
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
  const elTabs = document.getElementById("ta-tel-tabs");
  if (elTabs) elTabs.textContent = tel.tabSwitchCount ?? 1;
  const elRevis = document.getElementById("ta-tel-revisits");
  if (elRevis) elRevis.textContent = tel.totalRevisits ?? 4;
  const elFlag = document.getElementById("ta-tel-flagged");
  if (elFlag) elFlag.textContent = tel.flaggedCount ?? 2;
  const elChanges = document.getElementById("ta-tel-changes");
  if (elChanges) elChanges.textContent = tel.totalAnswerChanges ?? 1;
  const el2nd = document.getElementById("ta-tel-2ndguess");
  if (el2nd) el2nd.textContent = tel.secondGuessedToWrong ?? 0;
  const elAvg = document.getElementById("ta-tel-avgtime");
  if (elAvg) elAvg.textContent = `${tel.avgTimePerQuestionSeconds ?? 129}s`;

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

export function filterStudentQuestions(filter) {
  taSelectedFilter = filter;
  document.querySelectorAll('.ta-q-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.className = "ta-q-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary";
    } else {
      btn.className = "ta-q-filter-btn px-2.5 py-1 text-xs font-medium rounded-lg text-muted hover:text-foreground";
    }
  });

  const sid = store.get('currentActiveStudentId') || 's-101';
  const eid = store.get('currentActiveExamId') || 'ex-301';
  const key = `${sid}_${eid}`;
  const data = (store.studentExamAnalytics && store.studentExamAnalytics[key]) || 
               (store.studentExamAnalytics && store.studentExamAnalytics["s-101_ex-301"]);
  if (!data) return;

  const rawList = data.questionResults || [];

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

export function selectStudentTestQuestion(idx) {
  taSelectedQIdx = idx;
  const sid = store.get('currentActiveStudentId') || 's-101';
  const eid = store.get('currentActiveExamId') || 'ex-301';
  const key = `${sid}_${eid}`;
  const data = (store.studentExamAnalytics && store.studentExamAnalytics[key]) || 
               (store.studentExamAnalytics && store.studentExamAnalytics["s-101_ex-301"]);
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
