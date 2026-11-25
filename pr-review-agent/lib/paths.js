/**
 * lib/paths.js
 *
 * Location of pass 2 runtime data (gap ledger, evidence cache, sync markers).
 * Defaults to ~/.pr-review-agent so findings survive the throwaway worktrees
 * the scheduled automation runs in; override with PR_REVIEW_DATA_DIR.
 */

import { homedir } from 'os';
import { join, resolve } from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

export const resolveDataDir = (env = process.env) =>
  env.PR_REVIEW_DATA_DIR ? resolve(env.PR_REVIEW_DATA_DIR) : join(homedir(), '.pr-review-agent');

export const DATA_DIR = resolveDataDir();
