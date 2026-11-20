#!/usr/bin/env node
/**
 * build-system-map.js
 *
 * Builds the system map for one system (meta repo): for every initialized
 * submodule, scans its fetched ref (origin/<branch>, fallback HEAD) with a
 * `git grep -F` keyword prefilter, then applies the lib/signals.js regexes
 * per line to collect what each repo exposes / consumes / uses.
 *
 * Writes <meta>/.aid/system-map.json and <meta>/.aid/system-map.md.
 * Never mutates submodule working trees (read-only: grep + rev-parse).
 * Committing the map to the meta repo is a manual step.
 *
 * Usage:
 *   node build-system-map.js --system devicehub
 *
 * Exit codes: 0 = map written, 1 = unknown system or meta repo not found.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve }         from 'path';
import { fileURLToPath }            from 'url';
import { runGit }                   from './lib/git.js';
import { refFor }                   from './lib/sync.js';
import { systemContextById }        from './lib/systems.js';
import { extractFromLine, GREP_KEYWORDS } from './lib/signals.js';
import { mapPaths, renderMapMarkdown }    from './lib/map.js';
import { parseGrepLine }            from './lib/search.js';

// ─── Build ────────────────────────────────────────────────────────────────────

export const buildMap = (ctx) => {
  const stack = ctx.system.stack;
  const keywords = GREP_KEYWORDS[stack] ?? [];
  const repos = {};
  for (const sub of ctx.submodules) {
    if (!sub.initialized) continue;
    const ref = refFor(sub);
    const commit = runGit(sub.absPath, ['rev-parse', ref])?.trim() ?? null;
    const entry = { ref, commit, exposes: [], consumes: [], uses: [] };
    const seen = new Set();
    const out = keywords.length
      ? runGit(sub.absPath, ['grep', '-n', '-I', '-F', ...keywords.flatMap(k => ['-e', k]), ref], { allowExit1: true })
      : '';
    for (const raw of (out ?? '').split('\n')) {
      const hit = parseGrepLine(raw, ref);
      if (!hit) continue;
      for (const s of extractFromLine(hit.text, stack)) {
        const k = `${s.role}|${s.kind}|${s.value}`;
        if (seen.has(k)) continue;
        seen.add(k);
        entry[s.role].push({ kind: s.kind, value: s.value });
      }
    }
    repos[sub.fullName ?? sub.name] = entry;
  }
  return {
    system: ctx.id,
    generatedAt: new Date().toISOString(),
    metaCommit: runGit(ctx.metaPath, ['rev-parse', 'HEAD'])?.trim() ?? null,
    repos,
  };
};

export const writeMap = (ctx, map) => {
  const p = mapPaths(ctx.metaPath);
  mkdirSync(dirname(p.json), { recursive: true });
  writeFileSync(p.json, JSON.stringify(map, null, 2));
  writeFileSync(p.md, renderMapMarkdown(map));
  return p;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const summarize = (ctx, map) => {
  const repos = Object.values(map.repos);
  const count = (role) => repos.reduce((n, r) => n + r[role].length, 0);
  return {
    system: ctx.id,
    generatedAt: map.generatedAt,
    repos: repos.length,
    exposes: count('exposes'),
    consumes: count('consumes'),
    uses: count('uses'),
    unavailable: ctx.submodules.filter(s => !s.initialized).map(s => s.name),
    written: mapPaths(ctx.metaPath),
  };
};

const main = () => {
  const i = process.argv.indexOf('--system');
  const id = i > -1 ? process.argv[i + 1] : null;
  const ctx = id ? systemContextById(id) : null;
  if (!ctx || !ctx.metaPath) {
    console.error(`[system-map] unknown system or meta repo not found: ${id ?? '<missing --system>'}`);
    process.exit(1);
  }
  const map = buildMap(ctx);
  writeMap(ctx, map);
  console.log(JSON.stringify(summarize(ctx, map), null, 2));
};

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
