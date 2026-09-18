/**
 * scripts/run-tests.js
 * Fast, zero-dependency unit test runner for the Admin Analytics modules.
 */
import { performance } from 'node:perf_hooks';
import { runStateTests } from '../tests/state.test.js';
import { runRouterTests } from '../tests/router.test.js';
import { runExamsTests } from '../tests/exams.test.js';
import { runDppTests } from '../tests/dpp.test.js';
import { runStudentsTests } from '../tests/students.test.js';
import { runCohortsTests } from '../tests/cohorts.test.js';
import { runOverviewTests } from '../tests/overview.test.js';

const suites = [
  { name: 'Reactive State Store', fn: runStateTests },
  { name: 'Declarative Router', fn: runRouterTests },
  { name: 'Exams & Presets Formatter', fn: runExamsTests },
  { name: 'DPP Practice Adherence', fn: runDppTests },
  { name: 'Students Roster & Filters', fn: runStudentsTests },
  { name: 'Cohort Comparison', fn: runCohortsTests },
  { name: 'Faculty Overview Pulse', fn: runOverviewTests }
];

async function main() {
  console.log('========================================================');
  console.log('  Excellencia AI — Admin Analytics Test Runner');
  console.log('========================================================\n');

  const startTime = performance.now();
  let passedSuites = 0;
  let failedSuites = 0;

  for (const suite of suites) {
    try {
      await suite.fn();
      passedSuites++;
      console.log(`[PASS] Suite "${suite.name}" passed\n`);
    } catch (err) {
      failedSuites++;
      console.error(`[FAIL] Suite "${suite.name}" failed:`);
      console.error(err);
      console.log('');
    }
  }

  const durationMs = (performance.now() - startTime).toFixed(2);
  console.log('========================================================');
  console.log(`Summary: ${passedSuites} passed, ${failedSuites} failed in ${durationMs}ms`);
  console.log('========================================================');

  if (failedSuites > 0) {
    process.exit(1);
  }
}

main();
