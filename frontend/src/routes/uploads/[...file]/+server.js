import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// Uploaded PDFs are written to UPLOAD_DIR at runtime. On the adapter-node
// build, static assets are served from build/client (copied at build time), so
// files uploaded AFTER the build 404 when served statically. This route reads
// them from the live uploads directory instead, so /uploads/<file> always works.
//
// UPLOAD_DIR must match the create endpoint. On staging/prod it is a persistent
// path outside the repo; in dev it defaults to static/uploads. We also fall back
// to the in-repo static/uploads so committed seed PDFs keep serving.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'static/uploads');
const SEED_DIR = path.resolve('static/uploads');

const TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

// Resolve a request path to a real file inside one of the allowed dirs, or null.
function resolveInDir(dir, name) {
  const filepath = path.resolve(dir, name);
  if (!filepath.startsWith(dir + path.sep)) return null; // traversal guard
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) return null;
  return filepath;
}

export async function GET({ params }) {
  // Keys are flat (uploads/<filename>); use the basename and block traversal.
  const name = path.basename((params.file || '').replace(/\\/g, '/'));
  const filepath = resolveInDir(UPLOAD_DIR, name) || resolveInDir(SEED_DIR, name);
  if (!filepath) {
    throw error(404, 'File not found');
  }

  const data = fs.readFileSync(filepath);
  const type = TYPES[path.extname(filepath).toLowerCase()] || 'application/octet-stream';
  return new Response(data, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filepath))}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
