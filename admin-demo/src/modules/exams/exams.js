/**
 * modules/exams/exams.js
 * Exam Evaluation & Aggregate Analytics Roster View Controller.
 */
import { store } from '../../core/state.js';
import { openExamModal } from '../../core/modals.js';
import { openFullExamAnalytics } from './exam-detail.js';

export const PURPOSE_LABELS = {
  mock_test: "Mock Test",
  unit_test: "Unit Test",
  chapter_test: "Chapter Test",
  practice: "Practice",
  assignment: "Assignment",
  dpp: "DPP",
  jee_mains: "JEE Mains",
  jee_advanced: "JEE Advanced",
  neet: "NEET",
  clat: "CLAT",
  ipmat_indore: "IPMAT Indore",
  ipmat_rohtak: "IPMAT Rohtak",
  bitsat: "BITSAT",
  custom: "Custom",
};

export function formatPurpose(purpose) {
  if (!purpose) return "Custom";
  return PURPOSE_LABELS[purpose] || purpose.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function getStatusBadge(status) {
  switch (status) {
    case "results_released":
      return { label: "Released", color: "bg-emerald-50 text-emerald-700" };
    case "completed":
      return { label: "Completed", color: "bg-blue-50 text-blue-700" };
    case "in_progress":
      return { label: "In Progress", color: "bg-amber-50 text-amber-700" };
    case "scheduled":
      return { label: "Scheduled", color: "bg-purple-50 text-purple-700" };
    case "draft":
      return { label: "Draft", color: "bg-gray-50 text-gray-500" };
    case "grading":
      return { label: "Grading", color: "bg-orange-50 text-orange-700" };
    default:
      return { label: (status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "bg-gray-50 text-gray-500" };
  }
}

export function getAppearanceColor(rate) {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

export function rangeForPreset(key) {
  const today = new Date();
  const to = toIsoDate(today);
  const back = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  };
  switch (key) {
    case "today": return { from: to, to };
    case "7d": return { from: back(6), to };
    case "30d": return { from: back(29), to };
    case "90d": return { from: back(89), to };
    case "month": return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "year": return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to };
    default: return { from: "", to: "" };
  }
}

export function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function detectPreset(from, to) {
  if (!from && !to) return "all";
  for (const p of DATE_PRESETS) {
    if (p.key === "all") continue;
    const r = rangeForPreset(p.key);
    if (r.from === from && r.to === to) return p.key;
  }
  return "custom";
}

let examsSelectedBranchId = "all";
let examsSelectedBatchId = "all";
let examsSelectedType = "all";
let examsSelectedStatus = "all";
let examsDateFrom = "";
let examsDateTo = "";
let examsCurrentPage = 1;
const EXAMS_PAGE_SIZE = 10;
let examsDatePopoverOpen = false;

export function onExamsBranchChange(branchId) {
  examsSelectedBranchId = branchId;
  examsSelectedBatchId = "all";
  examsCurrentPage = 1;
  updateExamsBatchSelectOptions();
  renderExamsView();
}

export function onExamsBatchChange(batchId) {
  examsSelectedBatchId = batchId;
  examsCurrentPage = 1;
  renderExamsView();
}

export function onExamsTypeChange(type) {
  examsSelectedType = type;
  examsCurrentPage = 1;
  renderExamsView();
}

export function onExamsStatusChange(status) {
  examsSelectedStatus = status;
  examsCurrentPage = 1;
  renderExamsView();
}

export function changeExamsPage(delta) {
  examsCurrentPage += delta;
  renderExamsView();
}

export function toggleExamDatePopover(e) {
  if (e) e.stopPropagation();
  examsDatePopoverOpen = !examsDatePopoverOpen;
  const popover = document.getElementById("exams-date-popover");
  const caret = document.getElementById("exams-date-caret");
  if (popover) {
    if (examsDatePopoverOpen) {
      popover.classList.remove("hidden");
      if (caret) caret.classList.add("rotate-180");
    } else {
      popover.classList.add("hidden");
      if (caret) caret.classList.remove("rotate-180");
    }
  }
}

export function closeExamDatePopover() {
  examsDatePopoverOpen = false;
  const popover = document.getElementById("exams-date-popover");
  const caret = document.getElementById("exams-date-caret");
  if (popover) popover.classList.add("hidden");
  if (caret) caret.classList.remove("rotate-180");
}

export function applyExamDatePreset(presetKey) {
  if (presetKey === "all") {
    examsDateFrom = "";
    examsDateTo = "";
  } else {
    const r = rangeForPreset(presetKey);
    examsDateFrom = r.from;
    examsDateTo = r.to;
  }
  examsCurrentPage = 1;
  syncExamDateInputs();
  closeExamDatePopover();
  renderExamsView();
}

export function clearExamDateFilter(e) {
  if (e) e.stopPropagation();
  examsDateFrom = "";
  examsDateTo = "";
  examsCurrentPage = 1;
  syncExamDateInputs();
  closeExamDatePopover();
  renderExamsView();
}

export function onExamsDateRangeInputChange() {
  const f = document.getElementById("exams-filter-from")?.value || "";
  const t = document.getElementById("exams-filter-to")?.value || "";
  examsDateFrom = f;
  examsDateTo = t;
  examsCurrentPage = 1;
  syncExamDateInputs();
  renderExamsView();
}

export function onDirectExamsDateChange() {
  const f = document.getElementById("exams-date-from")?.value || "";
  const t = document.getElementById("exams-date-to")?.value || "";
  examsDateFrom = f;
  examsDateTo = t;
  examsCurrentPage = 1;
  syncExamDateInputs();
  renderExamsView();
}

export function syncExamDateInputs() {
  const fEl1 = document.getElementById("exams-date-from");
  const tEl1 = document.getElementById("exams-date-to");
  const fEl2 = document.getElementById("exams-filter-from");
  const tEl2 = document.getElementById("exams-filter-to");
  if (fEl1) fEl1.value = examsDateFrom;
  if (tEl1) tEl1.value = examsDateTo;
  if (fEl2) fEl2.value = examsDateFrom;
  if (tEl2) tEl2.value = examsDateTo;

  const btn = document.getElementById("exams-date-preset-btn");
  const labelEl = document.getElementById("exams-date-btn-label");
  const clearBtn = document.getElementById("exams-date-clear-btn");
  const customActiveTag = document.getElementById("exams-custom-range-active");
  const icon = document.getElementById("exams-date-icon");

  const active = !!(examsDateFrom || examsDateTo);
  const preset = detectPreset(examsDateFrom, examsDateTo);

  if (labelEl) {
    if (!active) {
      labelEl.textContent = "All time";
    } else if (preset !== "custom") {
      const pObj = DATE_PRESETS.find(p => p.key === preset);
      labelEl.textContent = pObj ? pObj.label : "Custom";
    } else if (examsDateFrom && examsDateTo) {
      labelEl.textContent = `${formatDateLabel(examsDateFrom)} – ${formatDateLabel(examsDateTo)}`;
    } else if (examsDateFrom) {
      labelEl.textContent = `From ${formatDateLabel(examsDateFrom)}`;
    } else {
      labelEl.textContent = `Until ${formatDateLabel(examsDateTo)}`;
    }
  }

  if (clearBtn) {
    if (active) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  if (btn) {
    if (active) {
      btn.className = "flex h-[42px] items-center gap-2 rounded-xl border border-primary/50 bg-primary/[0.04] px-3.5 text-sm font-medium text-primary shadow-xs outline-none transition-all";
      if (icon) icon.className = "ph-duotone ph-calendar-blank text-base text-primary";
    } else {
      btn.className = "flex h-[42px] items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-foreground shadow-xs outline-none transition-all hover:border-primary/60";
      if (icon) icon.className = "ph-duotone ph-calendar-blank text-base text-muted";
    }
  }

  if (customActiveTag) {
    if (preset === "custom") customActiveTag.classList.remove("hidden");
    else customActiveTag.classList.add("hidden");
  }

  document.querySelectorAll("#exams-date-popover .preset-btn").forEach(pBtn => {
    const key = pBtn.dataset.preset;
    if (key === preset) {
      pBtn.className = "preset-btn rounded-lg px-3 py-2 text-left text-sm font-medium bg-primary/10 text-primary transition-colors";
    } else {
      pBtn.className = "preset-btn rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/5 transition-colors";
    }
  });
}

export function updateExamsBatchSelectOptions() {
  const batchSelect = document.getElementById("exams-filter-batch");
  if (!batchSelect) return;

  const batches = store.batches || [];
  const visible = examsSelectedBranchId === "all"
    ? batches
    : batches.filter(b => b.branchId === examsSelectedBranchId || b.branchName?.toLowerCase() === examsSelectedBranchId.toLowerCase());

  const currentVal = examsSelectedBatchId;
  let html = '<option value="all">All Batches</option>';
  visible.forEach(b => {
    const isSelected = b.id === currentVal ? "selected" : "";
    html += `<option value="${b.id}" ${isSelected}>${b.name} (${b.branchName || ''})</option>`;
  });
  batchSelect.innerHTML = html;
}

export function initExamsFilterSelects() {
  const branchSelect = document.getElementById("exams-filter-branch");
  if (branchSelect && branchSelect.options.length <= 1) {
    const branches = store.branches || [];
    branches.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      branchSelect.appendChild(opt);
    });
  }

  updateExamsBatchSelectOptions();

  const typeSelect = document.getElementById("exams-filter-type");
  if (typeSelect && typeSelect.options.length <= 1) {
    const allExams = store.exams || [];
    const uniquePurposes = Array.from(new Set(allExams.map(e => e.purpose))).sort();
    uniquePurposes.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = formatPurpose(p);
      typeSelect.appendChild(opt);
    });
  }
}

export function renderExamsView() {
  initExamsFilterSelects();
  syncExamDateInputs();

  const exams = store.exams || [];

  const filtered = exams.filter(e => {
    if (examsSelectedBranchId !== "all") {
      const matchesBranch = (e.assignedBatches || []).some(b => {
        const fullBatch = (store.batches || []).find(bo => bo.id === b.id);
        return fullBatch && (fullBatch.branchId === examsSelectedBranchId || fullBatch.branchName?.toLowerCase() === examsSelectedBranchId.toLowerCase());
      });
      if (!matchesBranch) return false;
    }

    if (examsSelectedBatchId !== "all") {
      const matchesBatch = (e.assignedBatches || []).some(b => b.id === examsSelectedBatchId);
      if (!matchesBatch) return false;
    }

    if (examsSelectedType !== "all" && e.purpose !== examsSelectedType) {
      return false;
    }

    if (examsSelectedStatus !== "all" && e.status !== examsSelectedStatus) {
      return false;
    }

    if (examsDateFrom) {
      if (!e.scheduledStart) return false;
      const fromMs = new Date(`${examsDateFrom}T00:00:00`).getTime();
      const examMs = new Date(e.scheduledStart).getTime();
      if (examMs < fromMs) return false;
    }

    if (examsDateTo) {
      if (!e.scheduledStart) return false;
      const toMs = new Date(`${examsDateTo}T23:59:59.999`).getTime();
      const examMs = new Date(e.scheduledStart).getTime();
      if (examMs > toMs) return false;
    }

    return true;
  });

  const conducted = filtered.filter(e => e.status !== "draft" && e.status !== "scheduled");
  const totalConducted = conducted.length;
  const avgAppearance = totalConducted > 0
    ? Math.round(conducted.reduce((s, e) => s + (e.appearanceRate || 0), 0) / totalConducted)
    : 0;
  const withScores = conducted.filter(e => (e.averageScore || 0) > 0);
  const avgScore = withScores.length > 0
    ? (Math.round((withScores.reduce((s, e) => s + e.averageScore, 0) / withScores.length) * 10) / 10).toFixed(1)
    : "0";
  const pending = filtered.filter(e =>
    e.status === "completed" || e.status === "grading" || e.status === "in_progress"
  ).length;

  const countBadge = document.getElementById("exams-count-badge");
  if (countBadge) countBadge.textContent = `(${filtered.length} exams)`;

  const kpiCond = document.getElementById("exams-kpi-conducted");
  if (kpiCond) kpiCond.textContent = totalConducted;

  const kpiApp = document.getElementById("exams-kpi-appearance");
  if (kpiApp) kpiApp.textContent = `${avgAppearance}%`;

  const kpiAvg = document.getElementById("exams-kpi-avgscore");
  if (kpiAvg) kpiAvg.textContent = `${avgScore}%`;

  const kpiPend = document.getElementById("exams-kpi-pending");
  if (kpiPend) kpiPend.textContent = pending;

  const tableCard = document.getElementById("exams-table-card");
  const emptyState = document.getElementById("exams-empty-state");

  if (filtered.length === 0) {
    if (tableCard) tableCard.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  } else {
    if (tableCard) tableCard.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / EXAMS_PAGE_SIZE));
  if (examsCurrentPage > totalPages) examsCurrentPage = totalPages;
  if (examsCurrentPage < 1) examsCurrentPage = 1;

  const startIdx = (examsCurrentPage - 1) * EXAMS_PAGE_SIZE;
  const endIdx = Math.min(startIdx + EXAMS_PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(startIdx, endIdx);

  const pageInfo = document.getElementById("exams-pagination-info");
  if (pageInfo) {
    pageInfo.innerHTML = `Showing <span class="font-mono font-medium text-gray-700">${startIdx + 1}</span> - <span class="font-mono font-medium text-gray-700">${endIdx}</span> of <span class="font-mono font-medium text-gray-700">${filtered.length}</span>`;
  }

  const curPageEl = document.getElementById("exams-current-page-display");
  if (curPageEl) curPageEl.textContent = examsCurrentPage;

  const totPageEl = document.getElementById("exams-total-pages-display");
  if (totPageEl) totPageEl.textContent = totalPages;

  const prevBtn = document.getElementById("exams-prev-page-btn");
  if (prevBtn) prevBtn.disabled = examsCurrentPage <= 1;

  const nextBtn = document.getElementById("exams-next-page-btn");
  if (nextBtn) nextBtn.disabled = examsCurrentPage >= totalPages;

  const tbody = document.getElementById("exams-table-tbody");
  if (!tbody) return;

  tbody.innerHTML = paginated.map(exam => {
    const statusInfo = getStatusBadge(exam.status);
    const dateFormatted = exam.scheduledStart
      ? new Date(exam.scheduledStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "—";

    const batchList = exam.assignedBatches || [];
    let batchesHtml = '<span class="text-muted text-xs">No batches</span>';
    if (batchList.length > 0) {
      const allNames = batchList.map(b => b.name).join(", ");
      const displayStr = batchList.length === 1 ? batchList[0].name : `${batchList[0].name} +${batchList.length - 1}`;
      batchesHtml = `<div class="block max-w-[200px] truncate text-muted text-xs" title="${allNames}">${displayStr}</div>`;
    }

    const rateColor = getAppearanceColor(exam.appearanceRate);

    return `
      <tr class="group border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer" onclick="openExamModal('${exam.id}')">
        <td class="max-w-[260px] px-4 py-3.5">
          <a href="javascript:void(0)" onclick="openExamModal('${exam.id}')" class="block truncate font-medium text-gray-900 group-hover:text-primary">
            ${exam.title}
          </a>
          ${exam.omrEnabled ? `
            <span class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
              <i class="ph-duotone ph-scan text-xs"></i>
              OMR ${exam.omrProcessed ? '<i class="ph-fill ph-check-circle text-emerald-500 text-xs"></i>' : '<i class="ph-bold ph-clock text-amber-500 text-xs"></i>'}
            </span>
          ` : ''}
        </td>
        <td class="whitespace-nowrap px-4 py-3.5 text-muted text-sm">
          ${dateFormatted}
        </td>
        <td class="px-4 py-3.5">
          <span class="inline-flex rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
            ${formatPurpose(exam.purpose)}
          </span>
        </td>
        <td class="px-4 py-3.5 align-middle">
          ${batchesHtml}
        </td>
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-900">
          ${exam.totalSubmissions}/${exam.totalAssigned}
        </td>
        <td class="whitespace-nowrap px-4 py-3.5">
          <span class="font-mono text-sm font-semibold ${rateColor}">
            ${exam.totalAssigned > 0 ? `${exam.appearanceRate}%` : "—"}
          </span>
        </td>
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm font-semibold text-gray-900">
          ${exam.averageScore > 0 ? `${exam.averageScore}%` : "—"}
        </td>
        <td class="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-900">
          ${exam.passRate > 0 ? `${exam.passRate}%` : "—"}
        </td>
        <td class="px-4 py-3.5">
          <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </td>
        <td class="px-4 py-3.5 text-right">
          <button type="button" onclick="event.stopPropagation(); openFullExamAnalytics('${exam.id}')" title="Open Full Analytics Page" class="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100">
            <i class="ph-bold ph-arrow-right text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

export function renderExamsTable() {
  renderExamsView();
}
