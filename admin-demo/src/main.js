/**
 * src/main.js
 * Primary bootstrap entrypoint for the modularized Admin Analytics app.
 * Native ES module importing domain modules and binding window handlers.
 */

// Core imports
import { store, APP_DATA, DATA, charts, CHARTS } from './core/state.js';
import { router, switchView, toggleAnalyticsGroup, filterNavItems } from './core/router.js';
import { getChartContext, getCanvasCtx, registerChart, createVerticalGradient, makeGradient, resizeAllCharts } from './core/chart-utils.js';
import {
  openStudentModal,
  closeStudentModal,
  toggleStudentView1,
  toggleStudentView2,
  openBatchModal,
  closeBatchModal,
  toggleBatchView1,
  toggleBatchView2,
  openExamModal,
  closeExamModal,
  openAskAnalyticsModal,
  closeAskAnalyticsModal,
  initAskPresets,
  selectAskPreset,
  submitAskQuery,
  openOverviewDateRangeModal,
  closeOverviewDateRangeModal,
  setOverviewDateRange,
  openAssignmentDeveloperModal,
  closeAssignmentDeveloperModal,
  openFacultyImpactModal,
  openFullStudentAnalytics,
  openStudentFullDossier,
  openFullBatchAnalytics
} from './core/modals.js';

// Domain modules
import {
  renderOverview,
  toggleOverviewExtraKpis,
  toggleOverviewBranchComparison,
  toggleOverviewAllBatches,
  toggleOverviewSubjectBreakdown,
  filterOverviewAttention,
  focusOverviewAttentionList,
  openSelectedBatchHub,
  filterPerformersTab,
  onBatchFilterChange,
  onScopeChange,
  renderStrategicInsights,
  renderExamCountdowns,
  renderRisersList,
  renderFallersList,
  filterStudentMovementTab,
  onRoleChange,
  applyRoleUI
} from './modules/overview/overview.js';

import {
  renderHome
} from './modules/home/home.js';

import {
  renderStudentsTable,
  filterStudentsTable,
  toggleAtRiskFilter,
  toggleAtRiskStudentsFilter
} from './modules/students/students.js';

import {
  renderStudentDetail,
  switchStudentTab,
  openStudentWhatsApp,
  closeStudentWhatsAppModal,
  copyWhatsAppMessage,
  sendWhatsAppDirect,
  openStudentPtmNotes,
  setStudentTimeRange,
  changeStudentExamsPage,
  navigateToStudentDeepDive,
  refreshStudentAnalytics
} from './modules/students/student-detail.js';

import {
  renderStudentTestAnalysis,
  openStudentTestAnalysis,
  filterStudentQuestions,
  selectStudentTestQuestion
} from './modules/students/test-analysis.js';

import {
  renderStudentEri,
  renderStudentHeatmap,
  renderStudentPredictivePath,
  renderStudentRankPredictor,
  renderStudentPractice,
  renderStudentSuccessGap,
  renderStudentWeaknessImprovement,
  renderStudentTimeVsPerformance,
  renderStudentAttendanceImpact,
  renderEriVelocity,
  renderKnowledgeHeatmap,
  filterHeatmapSubject,
  renderPredictivePath,
  onWhatIfScoreChange,
  renderRankPredictor,
  renderPracticeAnalytics,
  filterPracticeActivity,
  switchPracticeTab,
  currentPracticeTab,
  openPracticeWhatsAppModal,
  closePracticeWhatsAppModal,
  copyPracticeWhatsAppMessage,
  sendPracticeWhatsAppDirect,
  renderSuccessGap,
  renderWeaknessImprovement,
  renderTimeVsPerformance,
  renderAttendanceImpact,
  renderStudentAnswerBehavior,
  openStudentAnswerBehavior
} from './modules/students/student-subviews.js';

import {
  renderExamsView,
  renderExamsTable,
  changeExamsPage,
  onExamsBranchChange,
  onExamsBatchChange,
  onExamsTypeChange,
  onExamsStatusChange,
  onExamsDateRangeInputChange,
  toggleExamDatePopover,
  applyExamDatePreset,
  clearExamDateFilter,
  onDirectExamsDateChange
} from './modules/exams/exams.js';

import {
  renderExamDetail,
  onExamDetailFilterChange,
  sortExamScorers,
  changeExamScorersPage,
  onExamScorersSearch,
  toggleExamScorersFlagged,
  setExamAtRiskSeverity,
  setExamQaView,
  sortExamTopics,
  toggleExamInsights,
  filterExamMixedPerformance,
  openFullExamAnalytics,
  openExamQuestionDetailModal,
  closeExamQuestionDetailModal,
  navigateExamQuestionModal,
  jumpToExamQuestion,
  changeExamSubjPage,
  selectExamQuestion,
  switchExamTab,
  currentExamTab,
  openExamAbsenteeWhatsApp,
  closeExamAbsenteeWhatsAppModal,
  copyExamAbsenteeMessage,
  sendExamAbsenteeWhatsAppDirect
} from './modules/exams/exam-detail.js';

import {
  renderBatchDiscrimination,
  openBatchDiscrimination
} from './modules/exams/batch-discrimination.js';

import {
  renderBatchDetail,
  switchBatchTab,
  filterBloomsSubject,
  onStudentLookupInput,
  sortBatchStudents,
  selectStudentLookup
} from './modules/batches/batch-detail.js';

import {
  toggleDppCalendar,
  closeDppCalendar,
  selectDppCalendarPreset,
  shiftDppCalendarMonth,
  applyDppCustomRange,
  onDppCalendarDayClick,
  onDppCalendarDayHover
} from './modules/dpp/calendar-picker.js';

import {
  renderDppView,
  renderDPP,
  setDppTab,
  setDppType,
  setDppWindow,
  setDppFacet,
  onDppBranchChange,
  onDppBatchChange,
  onDppSectionChange,
  onDppSearch,
  clearDppSearch,
  onDppSortChange,
  changeDppPage,
  drillIntoBatchDpp,
  openStudentDpp
} from './modules/dpp/dpp.js';

import {
  renderCohorts,
  renderCohortsView,
  onCohortStudentSearch,
  clearCohortStudentSearch,
  selectCohortStudent,
  drillIntoCohort,
  toggleCohortVisibility,
  setCohortPerformerTab,
  setCohortLookupTab,
  selectCohortRail,
  toggleCohortDrawer,
  jumpToCohortSection,
  openCohortWhatsAppModal,
  closeCohortWhatsAppModal,
  copyCohortWhatsAppMessage,
  sendCohortWhatsAppDirect,
  assignCohortDrills,
  exportCohortBatchReport
} from './modules/cohorts/cohorts.js';

import {
  renderBranches
} from './modules/branches/branches.js';

import {
  renderCompareView,
  renderCompareMatrix,
  toggleCompareSort,
  toggleCompareSelectAll,
  toggleCompareExam,
  toggleCompareRow
} from './modules/compare/compare.js';

// Convenient Aliases
export const renderStudents = renderStudentsTable;
export const renderExams = renderExamsView;
export const renderDpp = renderDppView;
export const renderCompare = renderCompareView;

/**
 * Register all application routes with the declarative Router.
 */
export function registerRoutes() {
  router.register('overview', {
    sectionId: 'section-overview',
    navId: 'nav-overview',
    onEnter: () => renderOverview()
  });

  router.register('home', {
    sectionId: 'section-overview',
    navId: 'nav-overview',
    onEnter: () => renderOverview()
  });

  router.register('insights', {
    sectionId: 'section-overview',
    navId: 'nav-overview',
    onEnter: () => renderOverview()
  });

  router.register('students', {
    sectionId: 'section-students',
    navId: 'nav-students',
    onEnter: () => renderStudentsTable()
  });

  router.register('student-detail', {
    sectionId: 'section-student-detail',
    navId: 'nav-students',
    onEnter: (p) => renderStudentDetail(p?.studentId || p?.id)
  });

  router.register('student-test-analysis', {
    sectionId: 'section-student-test-analysis',
    navId: 'nav-students',
    onEnter: (p) => renderStudentTestAnalysis(p?.studentId || p?.id, p?.examId)
  });

  router.register('student-answer-behavior', {
    sectionId: 'section-student-answer-behavior',
    navId: 'nav-students',
    onEnter: (p) => renderStudentAnswerBehavior(p?.studentId || p?.id, p?.examId)
  });

  // Student Subviews
  router.register('student-eri', {
    sectionId: 'section-student-eri',
    navId: 'nav-students',
    onEnter: (p) => renderStudentEri(p?.studentId || p?.id)
  });
  router.register('student-heatmap', {
    sectionId: 'section-student-heatmap',
    navId: 'nav-students',
    onEnter: (p) => renderStudentHeatmap(p?.studentId || p?.id)
  });
  router.register('student-predictive-path', {
    sectionId: 'section-student-predictive-path',
    navId: 'nav-students',
    onEnter: (p) => renderStudentPredictivePath(p?.studentId || p?.id)
  });
  router.register('student-rank-predictor', {
    sectionId: 'section-student-rank-predictor',
    navId: 'nav-students',
    onEnter: (p) => renderStudentRankPredictor(p?.studentId || p?.id)
  });
  router.register('student-practice', {
    sectionId: 'section-student-practice',
    navId: 'nav-students',
    onEnter: (p) => renderStudentPractice(p?.studentId || p?.id)
  });
  router.register('student-success-gap', {
    sectionId: 'section-student-success-gap',
    navId: 'nav-students',
    onEnter: (p) => renderStudentSuccessGap(p?.studentId || p?.id)
  });
  router.register('student-weakness-improvement', {
    sectionId: 'section-student-weakness-improvement',
    navId: 'nav-students',
    onEnter: (p) => renderStudentWeaknessImprovement(p?.studentId || p?.id)
  });
  router.register('student-time-vs-performance', {
    sectionId: 'section-student-time-vs-performance',
    navId: 'nav-students',
    onEnter: (p) => renderStudentTimeVsPerformance(p?.studentId || p?.id)
  });
  router.register('student-attendance-impact', {
    sectionId: 'section-student-attendance-impact',
    navId: 'nav-students',
    onEnter: (p) => renderStudentAttendanceImpact(p?.studentId || p?.id)
  });

  // Exams
  router.register('exams', {
    sectionId: 'section-exams',
    navId: 'nav-exams',
    onEnter: () => renderExamsView()
  });
  router.register('exam-detail', {
    sectionId: 'section-exam-detail',
    navId: 'nav-exams',
    onEnter: (p) => renderExamDetail(p?.examId || p?.id)
  });
  router.register('batch-discrimination', {
    sectionId: 'section-batch-discrimination',
    navId: 'nav-exams',
    onEnter: (p) => renderBatchDiscrimination(p?.batchId || p?.id, p?.examId)
  });

  // Batches
  router.register('batches', {
    sectionId: 'section-batch-detail',
    navId: 'nav-cohorts',
    onEnter: (p) => renderBatchDetail(p?.batchId || p?.id)
  });
  router.register('batch-detail', {
    sectionId: 'section-batch-detail',
    navId: 'nav-cohorts',
    onEnter: (p) => renderBatchDetail(p?.batchId || p?.id)
  });

  // DPP / Adherence
  router.register('dpp', {
    sectionId: 'section-dpp',
    navId: 'nav-dpp',
    onEnter: () => renderDppView()
  });

  // Cohorts
  router.register('cohorts', {
    sectionId: 'section-cohorts',
    navId: 'nav-cohorts',
    onEnter: () => renderCohortsView()
  });

  // Branches
  router.register('branches', {
    sectionId: 'section-branches',
    navId: 'nav-branches',
    onEnter: () => renderBranches()
  });

  // Compare
  router.register('compare', {
    sectionId: 'section-compare',
    navId: 'nav-compare',
    onEnter: () => renderCompareView()
  });
}

/**
 * Bind all functions and reactive objects to window to preserve 100% fidelity
 * with existing inline HTML handlers (onclick, onchange, onkeyup, etc.).
 */
export function bindWindowHandlers() {
  if (typeof window === 'undefined') return;

  const bindings = {
    // Store & state
    store,
    APP_DATA: store.data,
    DATA: store.data,
    charts: store.charts,
    CHARTS: store.charts,
    router,

    // Router & navigation
    switchView,
    toggleAnalyticsGroup,
    filterNavItems,

    // Modals
    openStudentModal,
    closeStudentModal,
    toggleStudentView1,
    toggleStudentView2,
    openBatchModal,
    closeBatchModal,
    toggleBatchView1,
    toggleBatchView2,
    openExamModal,
    closeExamModal,
    openAskAnalyticsModal,
    closeAskAnalyticsModal,
    initAskPresets,
    selectAskPreset,
    submitAskQuery,
    openOverviewDateRangeModal,
    closeOverviewDateRangeModal,
    setOverviewDateRange,
    openAssignmentDeveloperModal,
    closeAssignmentDeveloperModal,
    openFacultyImpactModal,
    openExamQuestionDetailModal,
    closeExamQuestionDetailModal,
    navigateExamQuestionModal,
    openFullStudentAnalytics,
    openStudentFullDossier,
    openFullBatchAnalytics,

    // Overview
    renderOverview,
    toggleOverviewExtraKpis,
    toggleOverviewBranchComparison,
    toggleOverviewAllBatches,
    toggleOverviewSubjectBreakdown,
    filterOverviewAttention,
    focusOverviewAttentionList,
    openSelectedBatchHub,
    filterPerformersTab,
    onBatchFilterChange,
    onScopeChange,
    renderStrategicInsights,
    renderExamCountdowns,
    renderRisersList,
    renderFallersList,
    filterStudentMovementTab,
    onRoleChange,
    applyRoleUI,

    // Home / Scope
    renderHome,

    // Students
    renderStudentsTable,
    renderStudents,
    filterStudentsTable,
    toggleAtRiskFilter,
    toggleAtRiskStudentsFilter,

    // Student Detail
    renderStudentDetail,
    switchStudentTab,
    openStudentWhatsApp,
    closeStudentWhatsAppModal,
    copyWhatsAppMessage,
    sendWhatsAppDirect,
    openStudentPtmNotes,
    setStudentTimeRange,
    changeStudentExamsPage,
    navigateToStudentDeepDive,
    refreshStudentAnalytics,

    // Student Test Analysis
    renderStudentTestAnalysis,
    openStudentTestAnalysis,
    filterStudentQuestions,
    selectStudentTestQuestion,

    // Student Subviews
    renderStudentEri,
    renderStudentHeatmap,
    renderStudentPredictivePath,
    renderStudentRankPredictor,
    renderStudentPractice,
    renderStudentSuccessGap,
    renderStudentWeaknessImprovement,
    renderStudentTimeVsPerformance,
    renderStudentAttendanceImpact,
    renderEriVelocity,
    renderKnowledgeHeatmap,
    filterHeatmapSubject,
    renderPredictivePath,
    onWhatIfScoreChange,
    renderRankPredictor,
    renderPracticeAnalytics,
    filterPracticeActivity,
    switchPracticeTab,
    currentPracticeTab,
    openPracticeWhatsAppModal,
    closePracticeWhatsAppModal,
    copyPracticeWhatsAppMessage,
    sendPracticeWhatsAppDirect,
    renderSuccessGap,
    renderWeaknessImprovement,
    renderTimeVsPerformance,
    renderAttendanceImpact,
    renderStudentAnswerBehavior,
    openStudentAnswerBehavior,

    // Exams
    renderExamsView,
    renderExamsTable,
    renderExams,
    changeExamsPage,
    onExamsBranchChange,
    onExamsBatchChange,
    onExamsTypeChange,
    onExamsStatusChange,
    onExamsDateRangeInputChange,
    toggleExamDatePopover,
    applyExamDatePreset,
    clearExamDateFilter,
    onDirectExamsDateChange,

    // Exam Detail
    renderExamDetail,
    onExamDetailFilterChange,
    sortExamScorers,
    changeExamScorersPage,
    onExamScorersSearch,
    toggleExamScorersFlagged,
    setExamAtRiskSeverity,
    setExamQaView,
    sortExamTopics,
    toggleExamInsights,
    filterExamMixedPerformance,
    openFullExamAnalytics,
    jumpToExamQuestion,
    changeExamSubjPage,
    selectExamQuestion,
    switchExamTab,
    currentExamTab,
    openExamAbsenteeWhatsApp,
    closeExamAbsenteeWhatsAppModal,
    copyExamAbsenteeMessage,
    sendExamAbsenteeWhatsAppDirect,

    // Batch Discrimination
    renderBatchDiscrimination,
    openBatchDiscrimination,

    // Batches
    renderBatchDetail,
    switchBatchTab,
    filterBloomsSubject,
    onStudentLookupInput,
    sortBatchStudents,
    selectStudentLookup,

    // DPP
    toggleDppCalendar,
    closeDppCalendar,
    selectDppCalendarPreset,
    shiftDppCalendarMonth,
    applyDppCustomRange,
    onDppCalendarDayClick,
    onDppCalendarDayHover,
    renderDppView,
    renderDPP,
    renderDpp,
    setDppTab,
    setDppType,
    setDppWindow,
    setDppFacet,
    onDppBranchChange,
    onDppBatchChange,
    onDppSectionChange,
    onDppSearch,
    clearDppSearch,
    onDppSortChange,
    changeDppPage,
    drillIntoBatchDpp,
    openStudentDpp,

    // Cohorts
    renderCohorts,
    renderCohortsView,
    onCohortStudentSearch,
    clearCohortStudentSearch,
    selectCohortStudent,
    drillIntoCohort,
    toggleCohortVisibility,
    setCohortPerformerTab,
    setCohortLookupTab,
    selectCohortRail,
    toggleCohortDrawer,
    jumpToCohortSection,
    openCohortWhatsAppModal,
    closeCohortWhatsAppModal,
    copyCohortWhatsAppMessage,
    sendCohortWhatsAppDirect,
    assignCohortDrills,
    exportCohortBatchReport,

    // Branches
    renderBranches,

    // Compare
    renderCompareView,
    renderCompareMatrix,
    renderCompare,
    toggleCompareSort,
    toggleCompareSelectAll,
    toggleCompareExam,
    toggleCompareRow
  };

  Object.assign(window, bindings);
}

/**
 * Initialize application lifecycle.
 */
export function initApp() {
  const rawData = window.__DEMO_DATA__ || window.APP_DATA || {};
  if (Object.keys(rawData).length > 0) {
    store.init(rawData);
  }

  registerRoutes();
  bindWindowHandlers();

  // Apply default user role configuration
  try {
    applyRoleUI(store.get('currentUserRole') || 'super_admin');
  } catch (e) {
    console.warn('Initial applyRoleUI deferred:', e);
  }

  // Populate initial DOM views
  try {
    renderOverview();
  } catch (e) {
    console.warn('Initial renderOverview deferred:', e);
  }
  try {
    renderHome();
  } catch (e) {
    console.warn('Initial renderHome deferred:', e);
  }
  try {
    renderStudentsTable();
  } catch (e) {
    console.warn('Initial renderStudentsTable deferred:', e);
  }
  try {
    renderExamsView();
  } catch (e) {
    console.warn('Initial renderExamsView deferred:', e);
  }
  try {
    renderBranches();
  } catch (e) {
    console.warn('Initial renderBranches deferred:', e);
  }
  try {
    renderDppView();
  } catch (e) {
    console.warn('Initial renderDppView deferred:', e);
  }
  try {
    renderCohortsView();
  } catch (e) {
    console.warn('Initial renderCohortsView deferred:', e);
  }

  // Initialize hash listener and load current route
  router.initHashRouting();
}

// Auto-run on DOM ready or immediate if already loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
