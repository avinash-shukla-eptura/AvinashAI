/**
 * lib/systems.js
 *
 * Routing for the system review: which meta repo (system) does a PR's repo
 * belong to? The meta repo's .gitmodules is the source of truth — no
 * hand-maintained repo list.
 *
 * Meta root discovery: env PR_REVIEW_META_ROOT, else walk up from this repo
 * until a directory containing <metaRepo>/.gitmodules is found (a bare
 * <metaRepo> folder, e.g. an empty worktree container, is ignored).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve }   from 'path';
import { fileURLToPath }            from 'url';

const AGENT_DIR    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYSTEMS_FILE = join(AGENT_DIR, 'systems.json');

// ─── Parsing ──────────────────────────────────────────────────────────────────

const fullNameFromUrl = (url) => {
  const m = url.match(/github\.com[:/]+([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
};

export const parseGitmodules = (text) => {
  const subs = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const head = line.match(/^\[submodule\s+"([^"]+)"\]$/);
    if (head) {
      cur = { name: head[1].split('/').pop(), path: null, url: null, branch: null, fullName: null };
      subs.push(cur);
      continue;
    }
    const kv = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!cur || !kv) continue;
    if (kv[1] === 'path')   cur.path = kv[2];
    if (kv[1] === 'url')    { cur.url = kv[2]; cur.fullName = fullNameFromUrl(kv[2]); }
    if (kv[1] === 'branch') cur.branch = kv[2];
  }
  return subs;
};

// ─── Routing ──────────────────────────────────────────────────────────────────

export const loadSystems = () => JSON.parse(readFileSync(SYSTEMS_FILE, 'utf8')).systems;

export const findMetaRoot = (metaRepo, start = AGENT_DIR) => {
  const isMetaRoot = (dir) => existsSync(join(dir, metaRepo, '.gitmodules'));
  const env = process.env.PR_REVIEW_META_ROOT;
  if (env && isMetaRoot(env)) return resolve(env);
  let dir = resolve(start);
  for (;;) {
    if (isMetaRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

/** Pure: systemsWithSubmodules = [{ id, system, submodules: [...] }] */
export const matchSystem = (nameWithOwner, systemsWithSubmodules) => {
  const target = nameWithOwner.toLowerCase();
  for (const s of systemsWithSubmodules) {
    const submodule = s.submodules.find(sub => sub.fullName?.toLowerCase() === target);
    if (submodule) return { id: s.id, system: s.system, submodule };
  }
  return null;
};

const loadSystemContext = (id, system) => {
  const root = findMetaRoot(system.metaRepo);
  if (!root) return { id, system, metaPath: null, submodules: [] };
  const metaPath = join(root, system.metaRepo);
  const gm = join(metaPath, '.gitmodules');
  const submodules = existsSync(gm)
    ? parseGitmodules(readFileSync(gm, 'utf8')).map(sub => ({
        ...sub,
        absPath: join(metaPath, sub.path),
        initialized: existsSync(join(metaPath, sub.path, '.git')),
      }))
    : [];
  return { id, system, metaPath, submodules };
};

/** Returns { id, system, metaPath, submodules, submodule } or null when unrouted. */
export const resolveSystem = (nameWithOwner) => {
  const contexts = Object.entries(loadSystems()).map(([id, system]) => loadSystemContext(id, system));
  const hit = matchSystem(nameWithOwner, contexts);
  if (!hit) return null;
  const ctx = contexts.find(c => c.id === hit.id);
  return { ...ctx, submodule: hit.submodule };
};

export const systemContextById = (id) => {
  const system = loadSystems()[id];
  return system ? loadSystemContext(id, system) : null;
};
