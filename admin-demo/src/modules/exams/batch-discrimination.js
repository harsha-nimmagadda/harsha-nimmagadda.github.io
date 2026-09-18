/**
 * modules/exams/batch-discrimination.js
 * Batch Item Discrimination Index (DI) View Controller.
 */
import { store } from '../../core/state.js';
import { router } from '../../core/router.js';
import { registerChart } from '../../core/chart-utils.js';

export function openBatchDiscrimination(batchId, examId) {
  const bid = batchId || 'b-srmpc-madhapur';
  const eid = examId || 'ex-301';
  store.set('currentActiveBatchId', bid);
  store.set('currentActiveExamId', eid);
  router.navigate('batch-discrimination');
}

export function renderBatchDiscrimination(batchId, examId) {
  const bid = batchId || store.get('currentActiveBatchId') || 'b-srmpc-madhapur';
  const eid = examId || store.get('currentActiveExamId') || 'ex-301';
  const key = `${bid}_${eid}`;
  const data = (store.batchDiscrimination && store.batchDiscrimination[key]) || 
               (store.batchDiscrimination && store.batchDiscrimination["b-srmpc-madhapur_ex-301"]);
  if (!data) return;

  const elBatch = document.getElementById("disc-batch-name");
  if (elBatch) elBatch.textContent = data.batchName;
  const elExam = document.getElementById("disc-exam-name");
  if (elExam) elExam.textContent = data.examName;
  const elAvg = document.getElementById("disc-kpi-avg");
  if (elAvg) elAvg.textContent = data.averageDiscrimination;
  const elFlag = document.getElementById("disc-kpi-flagged");
  if (elFlag) elFlag.textContent = data.flaggedCount;

  // Chart
  const canvas = document.getElementById("batchDiscriminationChart");
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext("2d");
    const qs = data.questions || [];
    const chartInstance = new Chart(ctx, {
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
    registerChart('batchDiscriminationChart', chartInstance);
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
