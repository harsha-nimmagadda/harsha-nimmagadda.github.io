import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SLICES = [
  { file: 'src/modules/overview/overview.html', startLine: 195, endLine: 664 },
  { file: 'src/modules/home/home.html', startLine: 665, endLine: 791 },
  { file: 'src/modules/students/students.html', startLine: 792, endLine: 885 },
  { file: 'src/modules/exams/exams.html', startLine: 886, endLine: 1104 },
  { file: 'src/modules/exams/exam-detail.html', startLine: 1105, endLine: 1618 },
  { file: 'src/modules/students/test-analysis.html', startLine: 1619, endLine: 1774 },
  { file: 'src/modules/students/answer-behavior.html', startLine: 1775, endLine: 1861 },
  { file: 'src/modules/exams/batch-discrimination.html', startLine: 1862, endLine: 1949 },
  { file: 'src/modules/exams/question-detail-modal.html', startLine: 1950, endLine: 1995 },
  { file: 'src/modules/compare/compare.html', startLine: 1996, endLine: 2035 },
  { file: 'src/modules/branches/branches.html', startLine: 2036, endLine: 2074 },
  { file: 'src/modules/dpp/dpp.html', startLine: 2075, endLine: 2359 },
  { file: 'src/modules/cohorts/cohorts.html', startLine: 2360, endLine: 2489 },
  { file: 'src/modules/batches/batch-detail.html', startLine: 2490, endLine: 2995 },
  { file: 'src/modules/students/student-detail.html', startLine: 2996, endLine: 3438 },
  { file: 'src/modules/students/student-subviews.html', startLine: 3439, endLine: 4004 },
  { file: 'src/core/modals.html', startLine: 4009, endLine: 4390 }
];

function extractSlices() {
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const lines = indexHtml.split('\n');

  console.log('Extracting modular HTML slices...');
  SLICES.forEach(slice => {
    const chunk = lines.slice(slice.startLine - 1, slice.endLine).join('\n');
    const targetPath = path.join(ROOT_DIR, slice.file);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, chunk + '\n', 'utf8');
    console.log(`  ✓ Extracted ${slice.file} (${slice.endLine - slice.startLine + 1} lines)`);
  });

  // Construct index.shell.html
  const topShell = lines.slice(0, 194).join('\n');
  const midShell = lines.slice(4004, 4008).join('\n');
  const bottomShell = lines.slice(4390).join('\n')
    .replace('<script src="app.js?v=16"></script>', '<script type="module" src="src/main.js"></script>');

  const shellIncludes = SLICES.map(s => {
    if (s.file === 'src/core/modals.html') {
      return `\n${midShell}\n\n  <!-- @include ${s.file} -->`;
    }
    return `      <!-- @include ${s.file} -->`;
  }).join('\n\n');

  const shellContent = `${topShell}\n\n${shellIncludes}\n\n${bottomShell}`;
  fs.writeFileSync(path.join(ROOT_DIR, 'index.shell.html'), shellContent, 'utf8');
  console.log('  ✓ Generated index.shell.html');
}

function buildHtml() {
  const shellPath = path.join(ROOT_DIR, 'index.shell.html');
  if (!fs.existsSync(shellPath)) {
    console.log('index.shell.html not found, extracting first...');
    extractSlices();
  }

  let shellContent = fs.readFileSync(shellPath, 'utf8');
  const includeRegex = /<!--\s*@include\s+([a-zA-Z0-9_\-\/.]+)\s*-->/g;

  shellContent = shellContent.replace(includeRegex, (match, relPath) => {
    const filePath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Included file not found: ${filePath}`);
      return match;
    }
    return fs.readFileSync(filePath, 'utf8').trimEnd();
  });

  // Ensure main.js module is loaded
  if (!shellContent.includes('src/main.js')) {
    shellContent = shellContent.replace('app.js?v=16', 'src/main.js" type="module');
  }

  fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), shellContent, 'utf8');
  console.log('✓ Successfully assembled index.html from modular templates.');
}

const args = process.argv.slice(2);
if (args.includes('--extract')) {
  extractSlices();
} else {
  if (!fs.existsSync(path.join(ROOT_DIR, 'index.shell.html'))) {
    extractSlices();
  }
  buildHtml();
}
