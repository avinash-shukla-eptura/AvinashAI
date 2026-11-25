#!/usr/bin/env node
/**
 * system-context.js
 *
 * Pass 2 (system review) evidence bundle for ONE PR. Deterministic: routes
 * the repo to its system (meta repo), extracts contract signals from the PR
 * diff, syncs the meta checkout read-only, refreshes the system map when
 * stale, and greps sibling repos for every signal value. Copilot judges gaps
 * from this bundle only; post-system-review.js enforces that its citations
 * match `siblingHits`.
 *
 * Usage:
 *   node system-context.js --repo CondecoByEptura/Connect-Core --number 123 --sha <headSha>
 *
 * Output (stdout, JSON) always carries `status`:
 *   bad-args | unrouted | meta-unavailable | head-moved | diff-unavailable | no-signals | ok | error
 * Always exits 0 — pass 2 is advisory and must never break the cycle.
 */

import { readFileSync, existsSync } from 'fs';
import { join }                     from 'path';
import { runGh, ghJson }            from './lib/gh.js';
import { resolveSystem }            from './lib/systems.js';
import { extractFromDiff }          from './lib/signals.js';
import { syncSystem }               from './lib/sync.js';
import { loadMap, mapAgeDays, mapStatus, mapPaths, neighbours } from './lib/map.js';
import { searchSiblings }           from './lib/search.js';
import { cacheKey, readCache, writeCache, CACHE_DIR } from './lib/cache.js';
import { buildMap, writeMap }       from './build-system-map.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const excerpt = (file, max) => (existsSync(file) ? readFileSync(file, 'utf8').slice(0, max) : null);

const emit = (obj) => { console.log(JSON.stringify(obj, null, 2)); process.exit(0); };

// ─── Main ─────────────────────────────────────────────────────────────────────

const main = () => {
  const repo = arg('repo');
  const number = Number(arg('number'));
  const commitSha = arg('sha');
  if (!repo || !number || !commitSha) {
    emit({ status: 'bad-args', error: 'usage: --repo <owner/name> --number <n> --sha <headSha>' });
  }
  const base = { repo, number, commitSha };

  const ctx = resolveSystem(repo);
  if (!ctx) emit({ ...base, status: 'unrouted' });
  const { system } = ctx;
  if (!ctx.metaPath) emit({ ...base, system: ctx.id, status: 'meta-unavailable' });

  const headSha = () => ghJson(['pr', 'view', String(number), '--repo', repo, '--json', 'headRefOid'])?.headRefOid ?? null;
  const headMatches = (sha) => sha?.toLowerCase() === commitSha.toLowerCase();
  // `gh pr diff` always returns the CURRENT head; check before and after so the
  // diff provably belongs to --sha (an author push in between would misattribute it).
  const headBefore = headSha();
  if (!headMatches(headBefore)) emit({ ...base, system: ctx.id, status: 'head-moved', currentHead: headBefore });
  const diff = runGh(['pr', 'diff', String(number), '--repo', repo]);
  if (diff === null) emit({ ...base, system: ctx.id, status: 'diff-unavailable' });
  const headAfter = headSha();
  if (!headMatches(headAfter)) emit({ ...base, system: ctx.id, status: 'head-moved', currentHead: headAfter });
  const signals = extractFromDiff(diff, system.stack);
  if (!signals.length) emit({ ...base, system: ctx.id, status: 'no-signals' });

  const sync = syncSystem(ctx, { cacheDir: CACHE_DIR, throttleMinutes: system.syncThrottleMinutes });

  const thresholds = { warnAfterDays: system.warnAfterDays, ledgerOnlyAfterDays: system.ledgerOnlyAfterDays };
  let map = loadMap(ctx.metaPath);
  let mapRebuildError = null;
  if (mapStatus(mapAgeDays(map), thresholds) !== 'fresh') {
    try {
      const rebuilt = buildMap(ctx);
      writeMap(ctx, rebuilt);
      map = rebuilt;
    } catch (e) {
      mapRebuildError = e.message;
    }
  }
  const ageDays = mapAgeDays(map);
  const status = mapStatus(ageDays, thresholds);

  const mapMeta = {
    mapStatus: status,
    mapAgeDays: ageDays === null ? null : Number(ageDays.toFixed(2)),
    mapRebuildError,
    sync,
  };

  const key = cacheKey({ repo, number, commitSha, mapGeneratedAt: map?.generatedAt, syncedAt: sync.lastSyncAt });
  const cached = readCache(key);
  if (cached) {
    // Re-persist current map/sync state: the poster reloads the bundle from disk.
    const refreshed = { ...cached, ...mapMeta };
    writeCache(key, refreshed);
    emit({ ...refreshed, cacheHit: true });
  }

  const values = [...new Set(signals.map(s => s.value))];
  const search = searchSiblings({ ctx, excludeFullName: ctx.submodule.fullName, values });

  const bundle = {
    key,
    ...base,
    system: ctx.id,
    mode: system.mode,
    status: 'ok',
    ...mapMeta,
    signals,
    siblingHits: search.hits,
    searchedRepos: search.searchedRepos,
    unavailableRepos: search.unavailable,
    neighbours: map ? neighbours(map, values, repo) : [],
    mapSummary: excerpt(mapPaths(ctx.metaPath).md, 6000),
    knowledgeExcerpt: excerpt(join(ctx.metaPath, '.aid', 'knowledge', 'architecture.md'), 4000),
  };
  writeCache(key, bundle);
  emit(bundle);
};

try {
  main();
} catch (e) {
  emit({ status: 'error', error: e.message });
}
