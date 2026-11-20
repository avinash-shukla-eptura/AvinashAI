/**
 * lib/cache.js
 *
 * Evidence-bundle cache keyed by sha1(repo#number@headSha|mapGeneratedAt).
 * Files live under pr-review-agent/cache/ (gitignored).
 */

import { createHash }  from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const CACHE_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'cache');

// ─── Cache ────────────────────────────────────────────────────────────────────

export const cacheKey = ({ repo, number, commitSha, mapGeneratedAt }) =>
  createHash('sha1').update(`${repo}#${number}@${commitSha}|${mapGeneratedAt ?? 'none'}`).digest('hex');

export const readCache = (key) => {
  const f = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
};

export const writeCache = (key, obj) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(obj, null, 2));
};
