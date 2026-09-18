/**
 * core/router.js
 * Declarative Router and View Switcher.
 * Matches 100% of legacy routing behaviors and URL hash paths.
 */
import { store } from './state.js';

export class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.currentParams = {};
  }

  /**
   * Register a route handler with an onEnter callback.
   * @param {string} routeName e.g. 'overview', 'student-detail', 'student-eri', etc.
   * @param {object} config { sectionId, onEnter, navId }
   */
  register(routeName, config) {
    this.routes.set(routeName, config);
  }

  /**
   * Resolve a raw URL hash or view name into normalized route and entity IDs.
   */
  resolveView(rawPath) {
    let clean = (rawPath || 'overview').replace(/^#\/?/, '').trim();
    if (!clean) clean = 'overview';

    let viewName = clean;
    let studentId = store.get('currentActiveStudentId') || 's-101';
    let examId = store.get('currentActiveExamId') || 'ex-301';
    let batchId = store.get('currentActiveBatchId') || 'b-srmpc-madhapur';

    if (clean.startsWith('batch/') && clean.includes('/discrimination/')) {
      const parts = clean.replace('batch/', '').split('/');
      batchId = parts[0] || batchId;
      examId = parts[2] || examId;
      viewName = 'batch-discrimination';
    } else if (clean.startsWith('batch/')) {
      batchId = clean.replace('batch/', '');
      viewName = 'batch-detail';
    } else if (clean === 'batches') {
      viewName = 'batch-detail';
    } else if (clean.startsWith('student/')) {
      const parts = clean.replace('student/', '').split('/');
      studentId = parts[0] || studentId;
      const subAction = parts[1];
      if (subAction === 'test-analysis') {
        viewName = 'student-test-analysis';
        if (parts[2]) examId = parts[2];
      } else if (subAction === 'answer-behavior') {
        viewName = 'student-answer-behavior';
        if (parts[2]) examId = parts[2];
      } else if (subAction) {
        // e.g. student/s-101/eri -> student-eri
        viewName = subAction.startsWith('student-') ? subAction : `student-${subAction}`;
      } else {
        viewName = 'student-detail';
      }
    } else if (clean.startsWith('exam/')) {
      examId = clean.replace('exam/', '');
      viewName = 'exam-detail';
    } else if (clean === 'insights' || clean === 'home') {
      viewName = 'overview';
    }

    return { viewName, studentId, examId, batchId, cleanPath: clean };
  }

  /**
   * Main view navigation routine.
   * Compatible with legacy switchView(viewName, updateHash).
   */
  switchView(viewName, updateHash = true) {
    const { viewName: normalizedView, studentId, examId, batchId, cleanPath } = this.resolveView(viewName);

    store.set('currentActiveStudentId', studentId);
    store.set('currentActiveExamId', examId);
    store.set('currentActiveBatchId', batchId);
    store.set('activeView', normalizedView);

    let entityId = studentId;
    if (normalizedView === 'exam-detail') entityId = examId;
    else if (normalizedView === 'batch-detail' || normalizedView === 'batch-discrimination') entityId = batchId;

    this.currentRoute = normalizedView;
    this.currentParams = { id: entityId, studentId, examId, batchId };

    const targetSectionId = `section-${normalizedView}`;

    if (typeof document !== 'undefined') {
      // Hide all sections
      document.querySelectorAll('.section-view').forEach(el => el.classList.add('hidden'));

      // Show target section
      const target = document.getElementById(targetSectionId);
      if (target) {
        target.classList.remove('hidden');
      }

      // Update Nav active classes
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

      if (normalizedView === 'overview') {
        document.getElementById('nav-overview')?.classList.add('active');
        document.getElementById('nav-home')?.classList.add('active');
      } else if (normalizedView === 'batch-detail') {
        document.getElementById('analytics-subnav')?.classList.remove('hidden');
        const caret = document.getElementById('analytics-caret');
        if (caret) caret.className = 'ph-bold ph-caret-down text-xs ml-auto';
        document.getElementById('nav-cohorts')?.classList.add('active');
      } else if (normalizedView.startsWith('student-') || normalizedView === 'students') {
        document.getElementById('analytics-subnav')?.classList.remove('hidden');
        document.getElementById('nav-students')?.classList.add('active');
      } else if (normalizedView === 'exams' || normalizedView === 'exam-detail' || normalizedView === 'batch-discrimination') {
        document.getElementById('analytics-subnav')?.classList.remove('hidden');
        document.getElementById('nav-exams')?.classList.add('active');
      } else {
        const directNav = document.getElementById(`nav-${normalizedView}`);
        if (directNav) directNav.classList.add('active');
        document.getElementById('analytics-subnav')?.classList.remove('hidden');
      }

      // Keep subnav open when inside analytics subviews
      if (normalizedView !== 'overview') {
        document.getElementById('analytics-subnav')?.classList.remove('hidden');
        const caret = document.getElementById('analytics-caret');
        if (caret) caret.className = 'ph-bold ph-caret-down text-xs ml-auto';
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Execute registered route onEnter lifecycle hook
    const routeConfig = this.routes.get(normalizedView) || this.routes.get(cleanPath);
    if (routeConfig && typeof routeConfig.onEnter === 'function') {
      routeConfig.onEnter({ id: studentId, studentId, examId, batchId });
    }

    // Update URL hash
    if (updateHash && typeof window !== 'undefined') {
      if (normalizedView === 'batch-detail') {
        window.location.hash = `batch/${batchId}`;
      } else if (normalizedView === 'student-detail') {
        window.location.hash = `student/${studentId}`;
      } else if (normalizedView === 'student-test-analysis') {
        window.location.hash = `student/${studentId}/test-analysis/${examId}`;
      } else if (normalizedView === 'student-answer-behavior') {
        window.location.hash = `student/${studentId}/answer-behavior/${examId}`;
      } else if (normalizedView.startsWith('student-')) {
        const dd = normalizedView.replace('student-', '');
        window.location.hash = `student/${studentId}/${dd}`;
      } else if (normalizedView === 'exam-detail') {
        window.location.hash = `exam/${examId}`;
      } else if (normalizedView === 'batch-discrimination') {
        window.location.hash = `batch/${batchId}/discrimination/${examId}`;
      } else {
        window.location.hash = normalizedView;
      }
    }

    // Trigger Chart.js resizes
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        Object.values(store.charts).forEach(c => c && typeof c.resize === 'function' && c.resize());
      }, 60);
    }
  }

  /**
   * Alias for switchView.
   */
  navigate(viewName, updateHash = true) {
    return this.switchView(viewName, updateHash);
  }

  match(rawPath) {
    const { viewName, studentId, examId, batchId, cleanPath } = this.resolveView(rawPath);
    let entityId = studentId;
    if (viewName === 'exam-detail') entityId = examId;
    else if (viewName === 'batch-detail' || viewName === 'batch-discrimination') entityId = batchId;
    return {
      pattern: viewName,
      config: this.routes.get(viewName) || {},
      params: { id: entityId, studentId, examId, batchId },
      rawPath: cleanPath
    };
  }

  /**
   * Listen to hashchange on window.
   */
  initHashRouting() {
    if (typeof window === 'undefined') return;

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash) {
        this.switchView(hash, false);
      }
    });

    const initial = window.location.hash.replace(/^#\/?/, '') || 'overview';
    this.switchView(initial, false);
  }
}

export const router = new Router();
export const switchView = (v, u) => router.switchView(v, u);

export function toggleAnalyticsGroup() {
  const subnav = document.getElementById('analytics-subnav');
  const caret = document.getElementById('analytics-caret');
  if (!subnav) return;

  if (subnav.classList.contains('hidden')) {
    subnav.classList.remove('hidden');
    if (caret) caret.className = 'ph-bold ph-caret-down text-xs ml-auto';
  } else {
    switchView('overview');
  }
}

export function filterNavItems(query) {
  const q = (query || '').toLowerCase().trim();
  const subnav = document.getElementById('analytics-subnav');
  if (!subnav) return;

  const childButtons = subnav.querySelectorAll('.nav-child');
  childButtons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  });

  if (q) {
    subnav.classList.remove('hidden');
  }
}

export default router;
