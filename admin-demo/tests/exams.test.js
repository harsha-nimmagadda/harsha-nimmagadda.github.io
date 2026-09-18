/**
 * tests/exams.test.js
 * Unit tests for exams formatters, status badges, appearance rates, and date presets.
 */
import assert from 'node:assert/strict';
import {
  formatPurpose,
  getStatusBadge,
  getAppearanceColor,
  rangeForPreset,
  detectPreset,
  toIsoDate
} from '../src/modules/exams/exams.js';

export async function runExamsTests() {
  console.log('Running Exams Tests...');

  // Test 1: Purpose Formatter
  assert.equal(formatPurpose('jee_advanced'), 'JEE Advanced');
  assert.equal(formatPurpose('jee_mains'), 'JEE Mains');
  assert.equal(formatPurpose('neet'), 'NEET');
  assert.equal(formatPurpose('mock_test'), 'Mock Test');
  assert.equal(formatPurpose('unit_test'), 'Unit Test');
  assert.equal(formatPurpose('dpp'), 'DPP');
  assert.equal(formatPurpose('custom_assessment'), 'Custom Assessment');
  assert.equal(formatPurpose(''), 'Custom');
  console.log('  ✓ formatPurpose mapping and fallback verified');

  // Test 2: Status Badges
  const released = getStatusBadge('results_released');
  assert.equal(released.label, 'Released');
  assert.ok(released.color.includes('emerald'));

  const inProg = getStatusBadge('in_progress');
  assert.equal(inProg.label, 'In Progress');
  assert.ok(inProg.color.includes('amber'));

  const scheduled = getStatusBadge('scheduled');
  assert.equal(scheduled.label, 'Scheduled');
  assert.ok(scheduled.color.includes('purple'));
  console.log('  ✓ getStatusBadge label and colors verified');

  // Test 3: Appearance Rate Color Thresholds
  assert.equal(getAppearanceColor(85), 'text-emerald-600');
  assert.equal(getAppearanceColor(80), 'text-emerald-600');
  assert.equal(getAppearanceColor(70), 'text-amber-600');
  assert.equal(getAppearanceColor(60), 'text-amber-600');
  assert.equal(getAppearanceColor(59), 'text-red-600');
  assert.equal(getAppearanceColor(20), 'text-red-600');
  console.log('  ✓ getAppearanceColor threshold grades verified');

  // Test 4: Date Presets & Detection
  const range7d = rangeForPreset('7d');
  assert.ok(range7d.from);
  assert.ok(range7d.to);
  assert.equal(range7d.to, toIsoDate(new Date()));

  const rangeToday = rangeForPreset('today');
  assert.equal(rangeToday.from, rangeToday.to);

  assert.equal(detectPreset('', ''), 'all');
  assert.equal(detectPreset(range7d.from, range7d.to), '7d');
  console.log('  ✓ rangeForPreset and detectPreset calculations verified');

  // Test 5: Exam Detail 3-Tab Command Center & Data Schema
  const { currentExamTab, getExamAnalyticsData } = await import('../src/modules/exams/exam-detail.js');
  assert.equal(currentExamTab, 'results', 'Default active exam tab must be results');

  const examData = getExamAnalyticsData('ex-301');
  assert.ok(examData, 'Exam analytics data must be returned');
  assert.equal(typeof examData.highestScore, 'number');
  assert.equal(typeof examData.lowestScore, 'number');
  assert.ok(examData.highestScore >= examData.lowestScore, 'Highest score must be >= lowest score');
  assert.ok(Array.isArray(examData.scoreDistribution), 'scoreDistribution must be an array');
  assert.ok(Array.isArray(examData.killerQuestions), 'killerQuestions must be an array');
  assert.ok(Array.isArray(examData.skippedQuestions), 'skippedQuestions must be an array');
  assert.ok(Array.isArray(examData.absentStudents), 'absentStudents must be an array');
  assert.ok(Array.isArray(examData.atRiskStudents), 'atRiskStudents must be an array');
  assert.ok(Array.isArray(examData.questionAnalysis), 'questionAnalysis must be an array');
  console.log('  ✓ Exam Detail 3-tab state and analytics schema verified');
}

