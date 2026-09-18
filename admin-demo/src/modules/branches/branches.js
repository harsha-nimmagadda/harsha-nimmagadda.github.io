/**
 * modules/branches/branches.js
 * Branches & Campus Roster View Controller.
 */
import { store } from '../../core/state.js';
import { onScopeChange } from '../overview/overview.js';

export function renderBranches() {
  const tbody = document.getElementById("branches-table-tbody");
  if (!tbody) return;

  const branches = store.branches || [];

  tbody.innerHTML = branches.map(b => `
    <tr class="border-b border-border hover:bg-slate-50 transition-colors">
      <td class="py-3 px-4 font-semibold text-slate-900">${b.name}</td>
      <td class="py-3 px-4 font-mono text-xs text-muted">${b.code || 'HYD'}</td>
      <td class="py-3 px-4 font-mono text-slate-800">${Number(b.studentCount || b.students).toLocaleString()}</td>
      <td class="py-3 px-4 font-mono text-slate-800">${b.batchCount || 4}</td>
      <td class="py-3 px-4 font-mono font-bold text-primary">${b.avgScore || b.percentile}%</td>
      <td class="py-3 px-4 text-right">
        <button onclick="onScopeChange('${b.id}')" class="px-3 py-1 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5">
          Scope View &rarr;
        </button>
      </td>
    </tr>
  `).join("");
}
