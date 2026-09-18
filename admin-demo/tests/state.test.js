/**
 * tests/state.test.js
 * Unit tests for central reactive store.
 */
import assert from 'node:assert/strict';
import { store } from '../src/core/state.js';

export async function runStateTests() {
  console.log('Running State Tests...');

  // Mock initial dataset
  const mockData = {
    institution: { name: 'Excellencia Junior College', totalStudents: 450 },
    branches: [
      { id: 'b-madhapur', name: 'Madhapur Campus', studentsCount: 150 },
      { id: 'b-shamirpet', name: 'Shamirpet Campus', studentsCount: 300 }
    ],
    batches: [
      { id: 'b-srmpc-madhapur', name: 'SR-MPC-A1', branchId: 'b-madhapur', studentsCount: 45 },
      { id: 'b-srmpc-shamirpet', name: 'SR-MPC-B1', branchId: 'b-shamirpet', studentsCount: 50 }
    ],
    students: [
      { studentId: 's-101', name: 'Aditya Verma', rollNo: 'EX-2026-001', batchId: 'b-srmpc-madhapur', risk: 'healthy' },
      { studentId: 's-102', name: 'Priya Sharma', rollNo: 'EX-2026-002', batchId: 'b-srmpc-shamirpet', risk: 'critical' }
    ],
    exams: [
      { id: 'ex-301', name: 'JEE Advanced Full Mock 04', purpose: 'jee_advanced', status: 'results_released' }
    ],
    studentAnalytics: {
      's-101': { eri: { currentScore: 84, trajectory: 'accelerating' } }
    }
  };

  // Test 1: Store initialization
  store.init(mockData);
  assert.equal(store.data.institution.name, 'Excellencia Junior College');
  assert.equal(store.branches.length, 2);
  assert.equal(store.batches.length, 2);
  assert.equal(store.students.length, 2);
  assert.equal(store.exams.length, 1);
  assert.ok(store.studentAnalytics['s-101']);
  console.log('  ✓ Store initialization and getters verified');

  // Test 2: Helper lookups
  const batch = store.batchById('b-srmpc-madhapur');
  assert.ok(batch);
  assert.equal(batch.name, 'SR-MPC-A1');

  const student = store.studentById('s-101');
  assert.ok(student);
  assert.equal(student.name, 'Aditya Verma');

  const exam = store.examById('ex-301');
  assert.ok(exam);
  assert.equal(exam.name, 'JEE Advanced Full Mock 04');
  console.log('  ✓ Helper lookups (batchById, studentById, examById) verified');

  // Test 3: Reactive set & get
  store.set('currentScopeBranch', 'b-madhapur');
  assert.equal(store.get('currentScopeBranch'), 'b-madhapur');

  store.set('currentActiveStudentId', 's-102');
  assert.equal(store.get('currentActiveStudentId'), 's-102');
  console.log('  ✓ Reactive set & get verified');

  // Test 4: Subscriptions
  let notificationReceived = null;
  const unsubscribe = store.subscribe('currentScopeBranch', (val) => {
    notificationReceived = val;
  });

  store.set('currentScopeBranch', 'b-shamirpet');
  assert.equal(notificationReceived, 'b-shamirpet');

  // Unsubscribe
  unsubscribe();
  store.set('currentScopeBranch', 'all');
  assert.equal(notificationReceived, 'b-shamirpet'); // Should not update after unsubscribe
  console.log('  ✓ Store subscribe & unsubscribe lifecycle verified');

  // Test 5: Role level state transitions
  assert.equal(store.currentUserRole, 'super_admin');
  store.set('currentUserRole', 'principal');
  assert.equal(store.currentUserRole, 'principal');
  store.set('currentUserRole', 'faculty');
  assert.equal(store.currentUserRole, 'faculty');
  store.set('currentUserRole', 'super_admin');
  assert.equal(store.currentUserRole, 'super_admin');
  console.log('  ✓ Role level state transitions (super_admin, principal, faculty) verified');
}
