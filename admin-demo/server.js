/**
 * Zero-dependency local demo server for Admin Analytics Demo
 * Serves static files and mock API routes
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const BASE_DIR = path.dirname(__filename);
const PORT = process.env.PORT || 3400;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = urlObj.pathname;

  // Mock API endpoints
  if (pathname.startsWith('/api/v1/')) {
    res.setHeader('Content-Type', 'application/json');
    const apiPath = pathname.replace('/api/v1/', '');

    // Simple router for mock data
    if (apiPath === 'analytics/institution' || apiPath === 'analytics/institution/trends') {
      const data = apiPath === 'analytics/institution'
        ? require('./data/institution.json')
        : require('./data/institution_trends.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    if (apiPath === 'analytics/v3/home') {
      const data = require('./data/insights.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    if (apiPath === 'analytics/v3/institution/cohorts') {
      const data = require('./data/cohorts.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    if (apiPath === 'batches') {
      const data = require('./data/batches.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    if (apiPath.startsWith('analytics/batch/')) {
      const data = require('./data/batch_analytics.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    if (apiPath.startsWith('analytics/student/')) {
      const data = require('./data/student_dossier.json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
      return;
    }
  }

  // Default to index.html for root or unknown HTML routes
  if (pathname === '/' || !path.extname(pathname)) {
    pathname = '/index.html';
  }

  const filePath = path.join(BASE_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return index.html for SPA routing fallback
      const fallbackPath = path.join(BASE_DIR, 'index.html');
      fs.readFile(fallbackPath, (fbErr, fbContent) => {
        if (fbErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(fbContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Excellencia AI — Admin Analytics Demo Server Running `);
  console.log(` URL: http://localhost:${PORT}                           `);
  console.log(` Base Directory: ${BASE_DIR}                           `);
  console.log(`=======================================================`);
});
