/**
 * lib/gh.js
 *
 * Minimal `gh` CLI helpers for the system-review (pass 2) scripts.
 * Deliberately duplicated from fetch-pending.js so pass 1 stays untouched.
 * Helpers return null on failure instead of throwing — callers MUST check.
 */

import { spawnSync } from 'child_process';

// ─── gh helpers ───────────────────────────────────────────────────────────────

export const runGh = (argv) => {
  const r = spawnSync('gh', argv, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(`[system-review] gh ${argv.slice(0, 4).join(' ')}… failed: ${(r.stderr || '').trim()}\n`);
    return null;
  }
  return r.stdout;
};

export const ghJson = (argv) => {
  const out = runGh(argv);
  if (!out) return null;
  try { return JSON.parse(out); } catch { return null; }
};
