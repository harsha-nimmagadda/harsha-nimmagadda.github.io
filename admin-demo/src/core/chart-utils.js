/**
 * core/chart-utils.js
 * Chart.js lifecycle management, gradients, and utility functions.
 */
import { store } from './state.js';

export function getChartContext(canvasId) {
  if (typeof document === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  return canvas ? canvas.getContext('2d') : null;
}

export function destroyChart(key) {
  if (store.charts[key] && typeof store.charts[key].destroy === 'function') {
    try {
      store.charts[key].destroy();
    } catch (_) {}
  }
  delete store.charts[key];
}

export function registerChart(key, chartInstance) {
  destroyChart(key);
  store.charts[key] = chartInstance;
  return chartInstance;
}

export function createVerticalGradient(ctx, topColor, bottomColor, height = 240) {
  if (!ctx || typeof ctx.createLinearGradient !== 'function') return topColor;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  return grad;
}

export function resizeAllCharts() {
  Object.values(store.charts).forEach(c => {
    if (c && typeof c.resize === 'function') {
      c.resize();
    }
  });
}

export const getCanvasCtx = getChartContext;
export const makeGradient = createVerticalGradient;
