import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// Uploaded PDFs are written to static/uploads at runtime. On the adapter-node
// build, static assets are served from build/client (copied at build time), so
// files uploaded AFTER the build 404 when served statically. This route reads
// them from the live uploads directory instead, so /uploads/<file> always works.
const UPLOAD_DIR = path.resolve('static/uploads');

const TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

export async function GET({ params }) {
  // params.file is everything after /uploads/ — normalise and block traversal.
  const rel = (params.file || '').replace(/\\/g, '/');
  const filepath = path.resolve(UPLOAD_DIR, rel);
  if (!filepath.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
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
