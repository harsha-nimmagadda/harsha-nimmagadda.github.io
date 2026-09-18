/**
 * tests/overview.test.js
 * Unit tests for Faculty Command Center data calculations and scope transitions.
 */
import assert from 'node:assert/strict';
import { store } from '../src/core/state.js';

export async function runOverviewTests() {
  console.log('Running Overview Tests...');

  const mockInstitution = {
    name: 'Excellencia Junior College',
    totalStudents: 4765,
    totalExams: 36920,
    avgPercentile: 54.2,
    activeBatches: 76,
    attendanceSummary: { overallRate: 88.5 },
    atRiskStudents: [
      { id: 's-1', name: 'Student 1' },
      { id: 's-2', name: 'Student 2' }
    ]
  };

  const mockBranches = [
    { id: 'b-madhapur', name: 'Madhapur', studentCount: 1200, avgScore: 62.4, batchCount: 18 },
    { id: 'b-shamirpet', name: 'Shamirpet', studentCount: 1500, avgScore: 58.1, batchCount: 22 }
  ];

  store.init({
    institution: mockInstitution,
    branches: mockBranches
  });

  // Test 1: Scope transition in store
  store.set('currentScopeBranch', 'all');
  assert.equal(store.get('currentScopeBranch'), 'all');
  assert.equal(store.institution.totalStudents, 4765);

  store.set('currentScopeBranch', 'b-madhapur');
  const currentBranch = store.branches.find(b => b.id === store.get('currentScopeBranch'));
  assert.ok(currentBranch);
  assert.equal(currentBranch.name, 'Madhapur');
  assert.equal(currentBranch.studentCount, 1200);
  console.log('  ✓ Scope transitions and branch data lookups verified');

  // Test 2: At-risk count logic
  const atRiskCount = store.institution.atRiskStudents?.length || 0;
  assert.equal(atRiskCount, 2);
  console.log('  ✓ At-risk student queue count calculation verified');

  // Test 3: HomeV2 data access for unified insights and movers
  store.set('homeV2', {
    insights: [{ id: 'ins-1', title: 'Test Insight' }],
    countdowns: [{ targetExam: 'JEE Mains', daysAway: 18 }],
    risers: [{ studentId: 's-101', name: 'Student 1', delta: 2.5 }],
    fallers: [{ studentId: 's-risk-1', name: 'Student 2', delta: -4.2 }]
  });
  assert.equal(store.homeV2.insights.length, 1);
  assert.equal(store.homeV2.countdowns.length, 1);
  assert.equal(store.homeV2.risers.length, 1);
  assert.equal(store.homeV2.fallers.length, 1);
  console.log('  ✓ HomeV2 unified insights and movers store integration verified');
}
