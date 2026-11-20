/**
 * lib/ledger.js
 *
 * Append-only gap ledger (gap-ledger.jsonl, one JSON object per line).
 * Every system-review finding lands here — kept ones as `open`, gate-rejected
 * ones as `dropped-no-evidence` — regardless of silent/post mode.
 */

import { createHash } from 'crypto';
import { appendFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const LEDGER_FILE = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'gap-ledger.jsonl');

// ─── Ledger ───────────────────────────────────────────────────────────────────

export const findingId = (prKey, finding) =>
  createHash('sha1')
    .update([prKey, finding.title, ...(finding.evidence ?? []).map(e => `${e.repo}:${e.path}`).sort()].join('|'))
    .digest('hex')
    .slice(0, 16);

export const appendLedger = (entries, file = LEDGER_FILE) => {
  if (!entries.length) return;
  appendFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
};

export const readLedger = (file = LEDGER_FILE) =>
  existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
