/**
 * lib/sync.js
 *
 * Read-only sync of a system's meta checkout. NEVER mutates working trees:
 * only `git fetch origin <branch>` per initialized submodule. Searches then
 * run against the fetched `origin/<branch>` tree-ish (fallback HEAD).
 * Throttled per system via cache/sync-<id>.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join }   from 'path';
import { runGit } from './git.js';

// ─── Refs ─────────────────────────────────────────────────────────────────────

export const refFor = (sub) => {
  if (sub.branch && runGit(sub.absPath, ['rev-parse', '--verify', '--quiet', `origin/${sub.branch}`]) !== null) {
    return `origin/${sub.branch}`;
  }
  return 'HEAD';
};

// ─── Sync ─────────────────────────────────────────────────────────────────────

export const syncSystem = (ctx, { cacheDir, throttleMinutes = 60, now = new Date() }) => {
  const marker = join(cacheDir, `sync-${ctx.id}.json`);
  if (existsSync(marker)) {
    const { lastSyncAt } = JSON.parse(readFileSync(marker, 'utf8'));
    if (now - new Date(lastSyncAt) < throttleMinutes * 60_000) {
      return { skipped: true, lastSyncAt, fetched: 0, failed: [], unavailable: [] };
    }
  }
  const result = { skipped: false, lastSyncAt: now.toISOString(), fetched: 0, failed: [], unavailable: [] };
  for (const sub of ctx.submodules) {
    if (!sub.initialized) { result.unavailable.push(sub.name); continue; }
    const argv = sub.branch ? ['fetch', '--quiet', 'origin', sub.branch] : ['fetch', '--quiet', 'origin'];
    if (runGit(sub.absPath, argv) === null) result.failed.push(sub.name);
    else result.fetched++;
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(marker, JSON.stringify({ lastSyncAt: result.lastSyncAt }, null, 2));
  return result;
};
