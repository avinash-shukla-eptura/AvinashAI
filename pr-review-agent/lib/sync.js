/**
 * lib/sync.js
 *
 * Read-only sync of a system's meta checkout. NEVER mutates working trees:
 * only `git fetch origin <branch>` per initialized submodule. Searches then
 * run against the fetched `origin/<branch>` (or `origin/HEAD` for branchless
 * submodules) tree-ish, falling back to HEAD.
 * Throttled per system via cache/sync-<id>.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join }   from 'path';
import { runGit } from './git.js';

// ─── Refs ─────────────────────────────────────────────────────────────────────

// Pure: picks the first resolvable candidate. Branchless submodules prefer the
// fetched remote default (origin/HEAD) because fetch never advances local HEAD.
export const pickRef = (branch, resolves) => {
  const candidates = branch ? [`origin/${branch}`] : ['origin/HEAD'];
  return candidates.find(resolves) ?? 'HEAD';
};

export const refFor = (sub) =>
  pickRef(sub.branch, (ref) => runGit(sub.absPath, ['rev-parse', '--verify', '--quiet', ref]) !== null);

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
