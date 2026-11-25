/**
 * lib/cache.js
 *
 * Evidence-bundle cache keyed by sha1(repo#number@headSha|mapGeneratedAt|syncedAt),
 * so sibling evidence expires at every sync boundary.
 * Files live under <DATA_DIR>/cache/ (see lib/paths.js).
 */

import { createHash }  from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './paths.js';

export const CACHE_DIR = join(DATA_DIR, 'cache');

// ─── Cache ────────────────────────────────────────────────────────────────────

export const cacheKey = ({ repo, number, commitSha, mapGeneratedAt, syncedAt }) =>
  createHash('sha1').update(`${repo}#${number}@${commitSha}|${mapGeneratedAt ?? 'none'}|${syncedAt ?? 'none'}`).digest('hex');

export const readCache = (key) => {
  const f = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
};

export const writeCache = (key, obj) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(obj, null, 2));
};
