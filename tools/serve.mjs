#!/usr/bin/env node
/**
 * Serveur statique minimal pour tester en local.
 *
 *   node tools/serve.mjs        → http://localhost:8000
 *   node tools/serve.mjs 3000   → autre port
 *
 * Aucune dépendance. Sans ça, ouvrir index.html en double-clic (file://)
 * empêche la lecture des fichiers JSON.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, path.normalize(rel));

    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) { res.writeHead(404).end('Not found'); return; }

    const body = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.json' ? 'no-store' : 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Erreur serveur : ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`RadQuizz → http://localhost:${PORT}`);
  console.log('Ctrl+C pour arrêter.');
});
