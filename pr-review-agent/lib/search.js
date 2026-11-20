/**
 * lib/search.js
 *
 * Sibling search: one `git grep -F` per initialized sibling submodule against
 * its fetched ref, for all signal values at once. Bounded by caps so a noisy
 * value cannot flood the evidence bundle.
 */

import { runGit } from './git.js';
import { refFor } from './sync.js';

// ─── Parsing ──────────────────────────────────────────────────────────────────

export const parseGrepLine = (line, ref) => {
  const rest = line.startsWith(`${ref}:`) ? line.slice(ref.length + 1) : line;
  const m = rest.match(/^(.+?):(\d+):(.*)$/);
  if (!m) return null;
  return { path: m[1], line: Number(m[2]), text: m[3].trim().slice(0, 200) };
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchSiblings = ({ ctx, excludeFullName, values, maxValues = 20, maxHitsPerValue = 10, maxTotal = 60 }) => {
  const vals = [...new Set(values)].filter(v => v && v.length >= 3).slice(0, maxValues);
  const result = { hits: [], searchedRepos: [], unavailable: [] };
  if (!vals.length) return result;
  const perValue = new Map(vals.map(v => [v, 0]));
  const exclude = excludeFullName?.toLowerCase();

  for (const sub of ctx.submodules) {
    if (sub.fullName?.toLowerCase() === exclude) continue;
    if (!sub.initialized) { result.unavailable.push(sub.fullName ?? sub.name); continue; }
    if (result.hits.length >= maxTotal) break;
    const ref = refFor(sub);
    const argv = ['grep', '-n', '-I', '-F', ...vals.flatMap(v => ['-e', v]), ref];
    const out = runGit(sub.absPath, argv, { allowExit1: true });
    result.searchedRepos.push(sub.fullName ?? sub.name);
    if (!out) continue;
    for (const raw of out.split('\n')) {
      if (result.hits.length >= maxTotal) break;
      const hit = parseGrepLine(raw, ref);
      if (!hit) continue;
      const value = vals.find(v => raw.includes(v) && perValue.get(v) < maxHitsPerValue);
      if (!value) continue;
      perValue.set(value, perValue.get(value) + 1);
      result.hits.push({ value, repo: sub.fullName ?? sub.name, ...hit });
    }
  }
  return result;
};
