/**
 * Zero-dependency Local Demo Server for Parent Demo Package
 * 
 * Usage:
 *   node server.js
 * 
 * Opens at:
 *   http://localhost:3304
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3304;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${reqPath}\nPlease check file path.`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`👨‍👩‍👧 EXCELLENCIA / ANTIGRAVITY — PARENT INTELLIGENCE DEMO`);
  console.log(`📡 Local server running at: http://localhost:${PORT}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`🌟 Flagship Parent V2:  http://localhost:${PORT}/parent-v2.html`);
  console.log(`📌 Baseline Parent V1:  http://localhost:${PORT}/parent-v1.html`);
  console.log(`👉 Default Entry Point: http://localhost:${PORT}/index.html`);
  console.log(`📖 Developer Spec:      http://localhost:${PORT}/DATA_PRESENTATION_SPEC.md`);
  console.log(`📄 Readme:              http://localhost:${PORT}/README.md`);
  console.log(`================================================================`);
  console.log(`💡 Note: You can also double-click index.html or parent-v1.html / parent-v2.html`);
  console.log(`   to run directly offline via file:/// with zero server required!`);
  console.log(`================================================================`);
});
