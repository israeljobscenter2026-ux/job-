import http from 'node:http';
import { runFacebookGroupScan } from './scan-facebook-groups.js';

const HOST = '127.0.0.1';
const PORT = 4545;
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/israel-jobs-center2026\.netlify\.app$/
];

let activeScan = null;

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  writeCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(isAllowedOrigin(origin) ? 204 : 403);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/scan-facebook-groups') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (origin && !isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: 'Origin is not allowed' });
    return;
  }

  if (activeScan) {
    sendJson(res, 409, { error: 'A Facebook group scan is already running' });
    return;
  }

  try {
    activeScan = runFacebookGroupScan({ interactive: false });
    const summary = await activeScan;
    sendJson(res, 200, {
      found: summary.found,
      added: summary.added,
      skipped: summary.skipped
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Facebook group scan failed' });
  } finally {
    activeScan = null;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local scan server is running at http://${HOST}:${PORT}/`);
  console.log('Endpoint: POST /scan-facebook-groups');
});

function writeCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
