/**
 * tests/dpp.test.js
 * Unit tests for practice adherence (DPP) status colors and practice types.
 */
import assert from 'node:assert/strict';
import {
  getDppAdherenceTone,
  PRACTICE_TYPE_LABELS,
  dppState
} from '../src/modules/dpp/dpp.js';

export async function runDppTests() {
  console.log('Running DPP / Practice Adherence Tests...');

  // Test 1: Adherence Tone Thresholds
  assert.equal(getDppAdherenceTone(0.85), 'text-success');
  assert.equal(getDppAdherenceTone(0.70), 'text-success');
  assert.equal(getDppAdherenceTone(0.69), 'text-warning');
  assert.equal(getDppAdherenceTone(0.40), 'text-warning');
  assert.equal(getDppAdherenceTone(0.39), 'text-danger');
  assert.equal(getDppAdherenceTone(0.0), 'text-danger');
  assert.equal(getDppAdherenceTone(null), 'text-muted');
  console.log('  ✓ getDppAdherenceTone color thresholds verified');

  // Test 2: Practice Type Labels
  assert.equal(PRACTICE_TYPE_LABELS.dpp, 'Daily Practice');
  assert.equal(PRACTICE_TYPE_LABELS.mock, 'Mock Test');
  assert.equal(PRACTICE_TYPE_LABELS.error_revision, 'Error Revision');
  assert.equal(PRACTICE_TYPE_LABELS.weekly_clash, 'Weekly Clash');
  console.log('  ✓ PRACTICE_TYPE_LABELS dictionary verified');

  // Test 3: DPP State Defaults
  assert.equal(dppState.practiceType, 'dpp');
  assert.equal(dppState.pageSize, 25);
  console.log('  ✓ dppState defaults verified');
}
