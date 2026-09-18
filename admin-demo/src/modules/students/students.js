/**
 * modules/students/students.js
 * Students Roster Table & Search/Filter Controller.
 */
import { store } from '../../core/state.js';
import { openStudentModal, openBatchModal } from '../../core/modals.js';

export function renderStudentsTable() {
  const tbody = document.getElementById("students-table-tbody");
  if (!tbody) return;

  const q = (document.getElementById("students-search")?.value || "").toLowerCase();
  const branch = document.getElementById("students-branch-filter")?.value || "all";
  const batch = document.getElementById("students-batch-filter")?.value || "all";
  const section = document.getElementById("students-section-filter")?.value || "all";
  const filterAtRiskOnly = store.get('filterAtRiskOnly') || false;

  const students = store.students || [];

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
        <td class="py-3 px-4 text-slate-600">
          <span onclick="event.stopPropagation(); openBatchModal()" class="hover:text-primary hover:underline cursor-pointer" title="View Batch Hub">
            ${s.batch} ${sectionBadge}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-600">${s.branch}</td>
        <td class="py-3 px-4 font-mono font-semibold text-slate-900">${s.avgScore}</td>
        <td class="py-3 px-4 font-mono font-bold text-success">${s.percentile}%</td>
        <td class="py-3 px-4 font-mono text-slate-700">${s.attendance}%</td>
        <td class="py-3 px-4">${riskBadge}</td>
      </tr>
    `;
  }).join("");
}

export function filterStudentsTable() {
  renderStudentsTable();
}

export function toggleAtRiskFilter() {
  const current = store.get('filterAtRiskOnly') || false;
  const next = !current;
  store.set('filterAtRiskOnly', next);

  const btn = document.getElementById("students-filter-atrisk");
  if (btn) {
    if (next) {
      btn.className = "px-3 py-1.5 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-bold";
    } else {
      btn.className = "px-3 py-1.5 rounded-xl border border-border bg-white text-slate-700 text-xs font-medium";
    }
  }
  renderStudentsTable();
}

export function toggleAtRiskStudentsFilter() {
  toggleAtRiskFilter();
}
