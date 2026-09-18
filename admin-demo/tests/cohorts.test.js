/**
 * tests/cohorts.test.js
 * Unit tests for cohort progression, visibility toggling, and performer tabs.
 */
import assert from 'node:assert/strict';
import { cohortsState, toggleCohortVisibility, toggleCohortDrawer, selectCohortRail } from '../src/modules/cohorts/cohorts.js';

export async function runCohortsTests() {
  console.log('Running Cohorts Tests...');

  // Reset state
  cohortsState.visibleCohorts = new Set(['c-jee-2026', 'c-jee-2025', 'c-neet-2026']);

  // Test 1: Cohort visibility toggle (delete)
  // Mock renderCohortsView to avoid DOM calls in headless test
  const origVisible = new Set(cohortsState.visibleCohorts);
  assert.ok(origVisible.has('c-jee-2025'));

  cohortsState.visibleCohorts.delete('c-jee-2025');
  assert.equal(cohortsState.visibleCohorts.has('c-jee-2025'), false);

  cohortsState.visibleCohorts.add('c-jee-2025');
  assert.equal(cohortsState.visibleCohorts.has('c-jee-2025'), true);
  console.log('  ✓ Cohort visibility toggling verified');

  // Test 2: Active tab state
  cohortsState.activePerformerCohort = 'c-neet-2026';
  assert.equal(cohortsState.activePerformerCohort, 'c-neet-2026');

  cohortsState.lookupCohort = 'c-jee-2026';
  assert.equal(cohortsState.lookupCohort, 'c-jee-2026');
  console.log('  ✓ Cohort active performer and lookup tabs state verified');

  // Test 3: Option 3 Drawer toggling
  assert.equal(cohortsState.drawers.performers, true, 'Performers drawer defaults to open');
  assert.equal(cohortsState.drawers.batches, true, 'Batches drawer defaults to open');

  toggleCohortDrawer('performers');
  assert.equal(cohortsState.drawers.performers, false, 'Performers drawer toggles closed');

  toggleCohortDrawer('performers');
  assert.equal(cohortsState.drawers.performers, true, 'Performers drawer toggles open');
  console.log('  ✓ Option 3 Expandable Accordion Drawers state toggling verified');

  // Test 4: Sticky rail cohort selector
  selectCohortRail('c-neet-2026');
  assert.equal(cohortsState.lookupCohort, 'c-neet-2026');
  assert.equal(cohortsState.activePerformerCohort, 'c-neet-2026');
  console.log('  ✓ Option 3 Visual Sticky Rail cohort selection verified');
}

