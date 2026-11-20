/**
 * lib/map.js
 *
 * System map helpers: load, age/status against thresholds, neighbour lookup,
 * and markdown rendering. The map lives in the meta repo at
 * .aid/system-map.json (+ .aid/system-map.md) and is written by
 * build-system-map.js.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Load & age ───────────────────────────────────────────────────────────────

export const mapPaths = (metaPath) => ({
  json: join(metaPath, '.aid', 'system-map.json'),
  md:   join(metaPath, '.aid', 'system-map.md'),
});

export const loadMap = (metaPath) => {
  const { json } = mapPaths(metaPath);
  if (!existsSync(json)) return null;
  try { return JSON.parse(readFileSync(json, 'utf8')); } catch { return null; }
};

export const mapAgeDays = (map, now = new Date()) =>
  map?.generatedAt ? (now - new Date(map.generatedAt)) / 86_400_000 : null;

export const mapStatus = (ageDays, { warnAfterDays, ledgerOnlyAfterDays }) => {
  if (ageDays === null || ageDays === undefined) return 'missing';
  if (ageDays > ledgerOnlyAfterDays) return 'stale';
  if (ageDays > warnAfterDays) return 'warn';
  return 'fresh';
};

// ─── Neighbours ───────────────────────────────────────────────────────────────

export const neighbours = (map, values, excludeRepo) => {
  const wanted = new Set(values);
  const out = [];
  for (const [repo, entry] of Object.entries(map?.repos ?? {})) {
    if (excludeRepo && repo.toLowerCase() === excludeRepo.toLowerCase()) continue;
    for (const role of ['exposes', 'consumes', 'uses']) {
      for (const item of entry[role] ?? []) {
        if (wanted.has(item.value)) out.push({ repo, value: item.value, kind: item.kind, role });
      }
    }
  }
  return out;
};

// ─── Markdown ─────────────────────────────────────────────────────────────────

export const renderMapMarkdown = (map) => {
  const repos = Object.entries(map.repos ?? {});
  const lines = [
    `# System map — ${map.system}`,
    '',
    `Generated: ${map.generatedAt} · meta commit: ${map.metaCommit ?? 'unknown'} · repos: ${repos.length}`,
    '',
    '| Repo | Exposes | Consumes | Uses |',
    '|---|---|---|---|',
    ...repos.map(([r, e]) => `| ${r} | ${e.exposes?.length ?? 0} | ${e.consumes?.length ?? 0} | ${e.uses?.length ?? 0} |`),
    '',
    '## Shared contracts',
    '',
  ];
  const byValue = new Map();
  for (const [repo, e] of repos) {
    for (const role of ['exposes', 'consumes', 'uses']) {
      for (const item of e[role] ?? []) {
        if (!byValue.has(item.value)) byValue.set(item.value, { value: item.value, kinds: new Set(), exposes: new Set(), others: new Set() });
        const v = byValue.get(item.value);
        v.kinds.add(item.kind);
        (role === 'exposes' ? v.exposes : v.others).add(repo);
      }
    }
  }
  const shared = [...byValue.values()].filter(v => new Set([...v.exposes, ...v.others]).size >= 2);
  if (!shared.length) lines.push('_None detected._');
  for (const v of shared) {
    lines.push(`- \`${v.value}\` (${[...v.kinds].join(', ')}): ${[...v.exposes].join(', ') || '—'} → ${[...v.others].join(', ') || '—'}`);
  }
  lines.push('', 'See `.aid/knowledge/` in this meta repo for architecture and domain context.', '');
  return lines.join('\n');
};
