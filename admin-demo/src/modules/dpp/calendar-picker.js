/**
 * modules/dpp/calendar-picker.js
 * Google Calendar-style Two-Pane Interactive Date Range Picker for DPP Adherence.
 */
import { dppState, renderDppView } from './dpp.js';

export const dppCalendarState = {
  open: false,
  cursorYear: 2026,
  cursorMonth: 2, // March (0-indexed)
  draftFrom: '2026-02-13',
  draftTo: '2026-03-12',
  hoverDay: null
};

export function toggleDppCalendar() {
  dppCalendarState.open = !dppCalendarState.open;
  const popover = document.getElementById('dpp-calendar-popover');
  if (popover) {
    if (dppCalendarState.open) {
      popover.classList.remove('hidden');
      renderDppCalendar();
    } else {
      popover.classList.add('hidden');
    }
  }
}

export function closeDppCalendar() {
  dppCalendarState.open = false;
  const popover = document.getElementById('dpp-calendar-popover');
  if (popover) popover.classList.add('hidden');
}

export function shiftDppCalendarMonth(delta) {
  dppCalendarState.cursorMonth += delta;
  if (dppCalendarState.cursorMonth < 0) {
    dppCalendarState.cursorMonth = 11;
    dppCalendarState.cursorYear -= 1;
  } else if (dppCalendarState.cursorMonth > 11) {
    dppCalendarState.cursorMonth = 0;
    dppCalendarState.cursorYear += 1;
  }
  renderDppCalendar();
}

export function selectDppCalendarPreset(presetKey, days) {
  dppState.rangeKey = presetKey;
  dppState.windowDays = days;
  const to = new Date(2026, 2, 12);
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  dppCalendarState.draftFrom = ymd(from);
  dppCalendarState.draftTo = ymd(to);
  
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(from) + ' → ' + fmt(to);

  ['7d', '14d', '30d'].forEach(w => {
    const btn = document.getElementById('dpp-win-' + w);
    if (btn) {
      if (w === presetKey) {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums border-primary bg-primary/10 text-primary';
      } else {
        btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-foreground';
      }
    }
  });

  closeDppCalendar();
  renderDppView();
}

export function onDppCalendarDayClick(year, month, day) {
  const pad = n => String(n).padStart(2, '0');
  const clickedYmd = `${year}-${pad(month + 1)}-${pad(day)}`;

  if (!dppCalendarState.draftFrom || dppCalendarState.draftTo) {
    dppCalendarState.draftFrom = clickedYmd;
    dppCalendarState.draftTo = '';
  } else {
    if (clickedYmd < dppCalendarState.draftFrom) {
      dppCalendarState.draftFrom = clickedYmd;
      dppCalendarState.draftTo = '';
    } else {
      dppCalendarState.draftTo = clickedYmd;
    }
  }
  renderDppCalendar();
}

export function onDppCalendarDayHover(year, month, day) {
  if (dppCalendarState.draftFrom && !dppCalendarState.draftTo) {
    const pad = n => String(n).padStart(2, '0');
    dppCalendarState.hoverDay = `${year}-${pad(month + 1)}-${pad(day)}`;
    renderDppCalendar();
  }
}

export function applyDppCustomRange() {
  if (!dppCalendarState.draftFrom) return;
  const fromStr = dppCalendarState.draftFrom;
  const toStr = dppCalendarState.draftTo || dppCalendarState.draftFrom;
  
  const fromD = new Date(fromStr);
  const toD = new Date(toStr);
  const diffDays = Math.max(1, Math.round((toD - fromD) / 86400000) + 1);

  dppState.rangeKey = 'custom';
  dppState.customFrom = fromStr;
  dppState.customTo = toStr;
  dppState.windowDays = diffDays;

  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lbl = document.getElementById('dpp-date-range-label');
  if (lbl) lbl.textContent = fmt(fromD) + ' → ' + fmt(toD);

  ['7d', '14d', '30d'].forEach(w => {
    const btn = document.getElementById('dpp-win-' + w);
    if (btn) btn.className = 'rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-foreground';
  });

  closeDppCalendar();
  renderDppView();
}

export function renderDppCalendar() {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthLbl = document.getElementById('dpp-cal-month-label');
  if (monthLbl) {
    monthLbl.textContent = `${monthNames[dppCalendarState.cursorMonth]} ${dppCalendarState.cursorYear}`;
  }

  ['7d', '14d', '30d', '90d'].forEach(p => {
    const el = document.getElementById('dpp-cal-preset-' + p);
    if (el) {
      if (dppState.rangeKey === p) {
        el.className = 'w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary transition-colors';
      } else {
        el.className = 'w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors';
      }
    }
  });

  const grid = document.getElementById('dpp-cal-days-grid');
  if (!grid) return;

  const firstDayOfMonth = new Date(dppCalendarState.cursorYear, dppCalendarState.cursorMonth, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const startDate = new Date(dppCalendarState.cursorYear, dppCalendarState.cursorMonth, 1 - startDayOfWeek);

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const effectiveEnd = dppCalendarState.draftTo || (dppCalendarState.draftFrom && dppCalendarState.hoverDay && dppCalendarState.hoverDay >= dppCalendarState.draftFrom ? dppCalendarState.hoverDay : dppCalendarState.draftFrom);

  let cellsHtml = '';
  for (let i = 0; i < 42; i++) {
    const current = new Date(startDate.getTime() + i * 86400000);
    const currYmd = ymd(current);
    const isCurrentMonth = current.getMonth() === dppCalendarState.cursorMonth;
    const isStart = currYmd === dppCalendarState.draftFrom;
    const isEnd = currYmd === dppCalendarState.draftTo;
    const isInRange = dppCalendarState.draftFrom && effectiveEnd && currYmd >= dppCalendarState.draftFrom && currYmd <= effectiveEnd;

    let cellClass = 'h-7 w-7 mx-auto flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer select-none ';
    let wrapperClass = 'p-0.5 relative ';

    if (isStart || isEnd) {
      cellClass += 'bg-primary text-white font-bold shadow-xs';
    } else if (isInRange) {
      cellClass += 'text-primary font-semibold';
      wrapperClass += 'bg-primary/10 ';
      if (currYmd === dppCalendarState.draftFrom) wrapperClass += 'rounded-l-full ';
      if (currYmd === effectiveEnd) wrapperClass += 'rounded-r-full ';
    } else if (isCurrentMonth) {
      cellClass += 'text-gray-900 hover:bg-slate-100';
    } else {
      cellClass += 'text-muted/40 hover:bg-slate-50';
    }

    cellsHtml += `
      <div class="${wrapperClass}" 
           onclick="onDppCalendarDayClick(${current.getFullYear()}, ${current.getMonth()}, ${current.getDate()})"
           onmouseenter="onDppCalendarDayHover(${current.getFullYear()}, ${current.getMonth()}, ${current.getDate()})">
        <div class="${cellClass}">${current.getDate()}</div>
      </div>
    `;
  }
  grid.innerHTML = cellsHtml;

  const sumEl = document.getElementById('dpp-cal-summary-text');
  if (sumEl) {
    if (dppCalendarState.draftFrom) {
      const d1 = new Date(dppCalendarState.draftFrom);
      const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (dppCalendarState.draftTo) {
        const d2 = new Date(dppCalendarState.draftTo);
        const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
        sumEl.textContent = `${fmt(d1)} → ${fmt(d2)} (${days} days)`;
      } else {
        sumEl.textContent = `${fmt(d1)} → Pick end date`;
      }
    } else {
      sumEl.textContent = 'Select start and end dates';
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const container = document.getElementById('dpp-calendar-container');
    if (container && !container.contains(e.target)) {
      closeDppCalendar();
    }
  });
}
