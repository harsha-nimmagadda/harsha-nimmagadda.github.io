/**
 * core/state.js
 * Scoped reactive store and data provider.
 * Eliminates raw window pollution while providing deterministic state access.
 */

class StateStore {
  constructor() {
    this._data = (typeof window !== 'undefined' && window.__DEMO_DATA__) ? window.__DEMO_DATA__ : {};
    
    this._state = {
      currentUserRole: 'super_admin', // 'super_admin' | 'principal' | 'faculty'
      currentScopeBranch: 'all',
      currentActiveStudentId: 's-101',
      currentActiveExamId: 'ex-301',
      currentActiveBatchId: 'b-srmpc-madhapur',
      currentStudentTimeRange: 'all',
      currentStudentExamsPage: 1,
      currentPerformerTab: 'all',
      currentDppSubTab: 'heatmap',
      filterAtRiskOnly: false,
      activeView: 'overview',
      
      // Overview-specific state
      overviewExtraKpisVisible: false,
      overviewSubjectBreakdownVisible: false,
      overviewBranchComparisonVisible: false,
      overviewShowAllBatches: false,
      currentOverviewAttentionFilter: 'all',

      // DPP Calendar state
      dppDateRange: {
        startDate: '2026-02-13',
        endDate: '2026-03-12',
        label: '13 Feb 2026 → 12 Mar 2026'
      },

      // Cohort Rank Lookup state
      currentCohortLookupId: 'c-jee-2026'
    };

    this.charts = {};
    this._listeners = new Map();
  }

  get data() {
    if (!this._data || Object.keys(this._data).length === 0) {
      if (typeof window !== 'undefined' && window.__DEMO_DATA__) {
        this._data = window.__DEMO_DATA__;
      }
    }
    return this._data;
  }

  set data(newData) {
    this._data = newData;
    this._emit('data', newData);
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    const prev = this._state[key];
    this._state[key] = value;
    if (prev !== value) {
      this._emit(key, value, prev);
    }
  }

  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => this._listeners.get(key).delete(callback);
  }

  _emit(key, value, prev) {
    if (this._listeners.has(key)) {
      this._listeners.get(key).forEach(cb => cb(value, prev));
    }
    if (this._listeners.has('*')) {
      this._listeners.get('*').forEach(cb => cb(key, value, prev));
    }
  }

  // Entity convenience accessors
  get institution() { return this.data.institution || {}; }
  get branches() { return this.data.branches || []; }
  get batches() { return this.data.batches || []; }
  get students() { return this.data.students || []; }
  get exams() { return this.data.exams || []; }
  get cohorts() { return this.data.cohorts || []; }
  get dpp() { return this.data.dpp || {}; }
  get trends() { return this.data.trends || {}; }
  get studentDossier() { return this.data.studentDossier || {}; }
  get studentExamAnalytics() { return this.data.studentExamAnalytics || {}; }
  get studentAnalytics() { return this.data.studentAnalytics || {}; }
  get batchAnalytics() { return this.data.batchAnalytics || {}; }
  get homeV2() { return this.get('homeV2') || this.data.homeV2 || {}; }
  get home() { return this.get('homeV2') || this.data.homeV2 || {}; }
  get compareMatrix() { return this.data.compareMatrix || {}; }
  get askDemo() { return this.data.askDemo || {}; }
  get examAnalytics() { return this.data.examAnalytics || {}; }
  get studentAnswerBehavior() { return this.data.studentAnswerBehavior || {}; }
  get batchDiscrimination() { return this.data.batchDiscrimination || {}; }
  get currentUserRole() { return this.get('currentUserRole') || 'super_admin'; }

  init(newData) {
    if (newData) {
      this._data = newData;
      this._emit('data', newData);
    }
    return this;
  }

  getStudent(id) {
    return this.students.find(s => s.studentId === id) || this.studentDossier;
  }

  getExam(id) {
    return this.exams.find(e => e.id === id || e.examId === id) || this.exams[0];
  }

  getBatch(id) {
    return this.batches.find(b => b.id === id || b.batchId === id) || this.batches[0];
  }

  batchById(id) {
    return this.batches.find(b => b.id === id || b.batchId === id) || null;
  }

  studentById(id) {
    return this.students.find(s => s.studentId === id || s.id === id) || null;
  }

  examById(id) {
    return this.exams.find(e => e.id === id || e.examId === id) || null;
  }
}

export const store = new StateStore();
export const APP_DATA = store.data;
export const DATA = store.data;
export const charts = store.charts;
export const CHARTS = store.charts;
export { StateStore };
export default store;
