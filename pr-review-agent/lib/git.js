/**
 * lib/git.js
 *
 * Minimal `git` helper for the system-review (pass 2) scripts.
 * Returns stdout, or null on failure. `git grep` exits 1 on "no match"; pass
 * { allowExit1: true } to treat that as an empty result instead of a failure.
 */

import { spawnSync } from 'child_process';

// ─── git helper ───────────────────────────────────────────────────────────────

export const runGit = (cwd, argv, { allowExit1 = false } = {}) => {
  const r = spawnSync('git', ['-C', cwd, ...argv], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status === 0) return r.stdout;
  if (allowExit1 && r.status === 1) return '';
  return null;
};
