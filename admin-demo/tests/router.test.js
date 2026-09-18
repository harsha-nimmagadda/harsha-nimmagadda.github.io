/**
 * tests/router.test.js
 * Unit tests for declarative Router pattern matching and param extraction.
 */
import assert from 'node:assert/strict';
import { Router } from '../src/core/router.js';

export async function runRouterTests() {
  console.log('Running Router Tests...');

  const testRouter = new Router();

  // Register representative routes
  testRouter.register('overview', { sectionId: 'section-overview' });
  testRouter.register('students', { sectionId: 'section-students' });
  testRouter.register('student/:id', { sectionId: 'section-student-detail' });
  testRouter.register('student/:id/test-analysis/:examId', { sectionId: 'section-student-test-analysis' });
  testRouter.register('exams', { sectionId: 'section-exams' });
  testRouter.register('exam/:id', { sectionId: 'section-exam-detail' });
  testRouter.register('batch/:id', { sectionId: 'section-batch-detail' });
  testRouter.register('batch/:id/discrimination/:examId', { sectionId: 'section-batch-discrimination' });

  // Test 1: Static Route Matching
  const mOverview = testRouter.match('overview');
  assert.equal(mOverview.pattern, 'overview');
  assert.equal(mOverview.config.sectionId, 'section-overview');

  const mStudents = testRouter.match('#students');
  assert.equal(mStudents.pattern, 'students');
  assert.equal(mStudents.config.sectionId, 'section-students');
  console.log('  ✓ Static route matching (overview, students) verified');

  // Test 2: Parameterized Route Matching
  const mStudent = testRouter.match('student/s-105');
  assert.equal(mStudent.params.id, 's-105');

  const mExam = testRouter.match('#/exam/ex-402');
  assert.equal(mExam.params.id, 'ex-402');
  console.log('  ✓ Single param route matching (student/:id, exam/:id) verified');

  // Test 3: Multi-parameter Route Matching
  const mAnalysis = testRouter.match('student/s-101/test-analysis/ex-301');
  assert.equal(mAnalysis.params.id, 's-101');
  assert.equal(mAnalysis.params.examId, 'ex-301');

  const mDiscrim = testRouter.match('batch/b-madhapur/discrimination/ex-301');
  assert.equal(mDiscrim.params.id, 'b-madhapur');
  assert.equal(mDiscrim.params.examId, 'ex-301');
  console.log('  ✓ Multi-param route matching (test-analysis, discrimination) verified');

  // Test 4: Default Fallback
  const mFallback = testRouter.match('');
  assert.equal(mFallback.pattern, 'overview');
  console.log('  ✓ Empty hash fallback to overview verified');

  // Test 5: Unified route aliases (home & insights -> overview)
  const mHome = testRouter.match('home');
  assert.equal(mHome.pattern, 'overview');
  const mInsights = testRouter.match('insights');
  assert.equal(mInsights.pattern, 'overview');
  console.log('  ✓ Unified route aliases (home, insights -> overview) verified');
}
