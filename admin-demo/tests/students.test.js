/**
 * tests/students.test.js
 * Unit tests for student roster filtering, risk classification, and state synchronization.
 */
import assert from 'node:assert/strict';
import { store } from '../src/core/state.js';

export async function runStudentsTests() {
  console.log('Running Students Tests...');

  const sampleStudents = [
    { studentId: 's-101', name: 'Aditya Verma', rollNo: 'EX-2026-001', branch: 'Madhapur', batch: 'SR-MPC-A1', section: 'Sec-A', avgScore: 285, percentile: 99.2, attendance: 98, risk: 'healthy' },
    { studentId: 's-102', name: 'Priya Sharma', rollNo: 'EX-2026-002', branch: 'Shamirpet', batch: 'SR-MPC-B1', section: 'Sec-B', avgScore: 172, percentile: 74.0, attendance: 82, risk: 'critical' },
    { studentId: 's-103', name: 'Rahul Reddy', rollNo: 'EX-2026-003', branch: 'Madhapur', batch: 'SR-MPC-A1', section: 'Sec-A', avgScore: 210, percentile: 85.5, attendance: 89, risk: 'warning' }
  ];

  store.init({
    students: sampleStudents,
    dpp: {
      students: [
        {
          studentId: 's-nev-4',
          name: 'HARINI RAO',
          rollNo: '626045',
          batchName: 'JR MPC',
          branchName: 'LB Nagar',
          section: 'Section B',
          daysDone: 0,
          streak: 0,
          status: 'Never Started'
        }
      ]
    }
  });

  function filterList({ q = '', branch = 'all', batch = 'all', section = 'all', filterAtRiskOnly = false }) {
    const students = store.students || [];
    return students.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.rollNo.includes(q)) return false;
      if (branch !== 'all' && s.branch !== branch) return false;
      if (batch !== 'all' && s.batch !== batch) return false;
      if (section !== 'all' && s.section && s.section !== section) return false;
      if (filterAtRiskOnly && s.risk !== 'critical' && s.risk !== 'warning') return false;
      return true;
    });
  }

  // Test 1: Search by name
  const resName = filterList({ q: 'aditya' });
  assert.equal(resName.length, 1);
  assert.equal(resName[0].studentId, 's-101');

  // Test 2: Search by rollNo
  const resRoll = filterList({ q: '002' });
  assert.equal(resRoll.length, 1);
  assert.equal(resRoll[0].studentId, 's-102');

  // Test 3: Filter by branch
  const resBranch = filterList({ branch: 'Madhapur' });
  assert.equal(resBranch.length, 2);

  // Test 4: Filter by at-risk only
  const resRisk = filterList({ filterAtRiskOnly: true });
  assert.equal(resRisk.length, 2); // 'critical' and 'warning'
  assert.ok(resRisk.every(s => s.risk === 'critical' || s.risk === 'warning'));

  // Test 5: Combined filter
  const resCombined = filterList({ branch: 'Madhapur', filterAtRiskOnly: true });
  assert.equal(resCombined.length, 1);
  assert.equal(resCombined[0].studentId, 's-103');

  console.log('  ✓ Student filtering (search, branch, risk, combined) verified');

  // Test 6: Student Detail Analytics Schema & Tab State
  const { getStudentAnalyticsData, currentStudentTab } = await import('../src/modules/students/student-detail.js');
  const studentData = getStudentAnalyticsData('s-101');
  assert.ok(studentData, 'Student analytics data must be returned');
  assert.equal(studentData.profile.name, 'Aditya Verma');
  assert.ok(studentData.scoreTrajectory.length >= 10, 'Must have at least 10 trajectory exams');
  assert.ok(studentData.recentExams.length >= 10, 'Must have at least 10 recent exams');
  assert.ok(studentData.assignmentData.length >= 7, 'Must have at least 7 DPP/assignments');
  assert.ok(studentData.weakAreas.subjects.length >= 3, 'Must have 3 weak subjects');
  assert.ok(studentData.rwl.questions.length >= 3, 'Must have at least 3 RWL questions');
  assert.equal(currentStudentTab, 'diagnostic', 'Default active student tab must be diagnostic');

  console.log('  ✓ Student analytics data generation & clinical 3-tab defaults verified');

  // Test 7: Practice Engine Practice Analytics Schema
  assert.ok(studentData.practiceData, 'Must have practiceData');
  assert.ok(studentData.practiceData.totalQuestions > 0, 'Must have totalQuestions solved');
  assert.ok(studentData.practiceData.overallAccuracy > 0, 'Must have overall accuracy');
  assert.ok(studentData.practiceData.streakDays > 0, 'Must have streak days');
  assert.ok(Array.isArray(studentData.practiceData.typeBreakdown) && studentData.practiceData.typeBreakdown.length >= 4, 'Must have 4 practice type breakdown categories');
  assert.ok(Array.isArray(studentData.practiceData.activityDays) && studentData.practiceData.activityDays.length >= 5, 'Must have at least 5 activity log sessions');
  assert.ok(studentData.practiceData.errorCorrection, 'Must have error correction stats');
  assert.ok(studentData.practiceData.errorCorrection.flagged > 0, 'Must have flagged count');
  assert.ok(studentData.practiceData.errorCorrection.resolved > 0, 'Must have resolved count');

  // Test 8: Practice 3-Tab State & Student Profile Resolution
  const { currentPracticeTab, switchPracticeTab } = await import('../src/modules/students/student-subviews.js');
  assert.equal(currentPracticeTab, 'cadence', 'Default practice tab must be cadence');

  const hariniData = getStudentAnalyticsData('s-nev-4');
  assert.ok(hariniData, 'Harini Rao data must be returned');
  assert.equal(hariniData.profile.rollNumber, '626045');
  assert.equal(hariniData.profile.batchName, 'JR MPC');
  assert.equal(hariniData.profile.branchName, 'LB Nagar');
  assert.ok(hariniData.practiceData, 'Harini must have practiceData payload');
  console.log('  ✓ Practice Engine Clinical 3-Tab defaults & Harini Rao profile verified');
}

