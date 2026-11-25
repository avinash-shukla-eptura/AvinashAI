#!/usr/bin/env node
/**
 * post-system-review.js
 *
 * Pass 2 poster. Takes a Copilot-written system-review-<n>.json, validates it,
 * loads the matching evidence bundle from cache (by `bundleKey`), applies the
 * evidence gate, appends every finding to gap-ledger.jsonl, and — only when
 * the system's mode is `post`, the map is not stale, AND >= 1 finding
 * survived the gate — posts a COMMENT review to the PR.
 *
 * Usage:
 *   node post-system-review.js system-review-123.json
 *
 * Safety: in `silent` mode (the default in systems.json) NOTHING is posted to
 * GitHub; findings go to the ledger only. Pass 1 state (`reviewedPRs`) is
 * never touched — pass 2 records under `systemReviewedPRs`.
 *
 * Exit codes: 0 = processed, 1 = invalid review, missing bundle, or post failed.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname }    from 'path';
import { fileURLToPath }    from 'url';
import { runGh }            from './lib/gh.js';
import { loadSystems }      from './lib/systems.js';
import { readCache }        from './lib/cache.js';
import { validateSystemReview, applyEvidenceGate } from './lib/gate.js';
import { findingId, appendLedger } from './lib/ledger.js';
import { renderSystemReviewBody }  from './lib/render.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, 'state.json');

// ─── State helpers ────────────────────────────────────────────────────────────

const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { reviewedPRs: {} });
const saveState = (s) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

// ─── Main ─────────────────────────────────────────────────────────────────────

const fail = (msg) => { console.error(`[system-review] ${msg}`); process.exit(1); };

const main = () => {
  const file = process.argv[2];
  if (!file || !existsSync(file)) fail(`review file not found: ${file ?? '<missing arg>'}`);

  let review;
  try { review = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`invalid JSON: ${e.message}`); }
  const errors = validateSystemReview(review);
  if (!review.bundleKey) errors.push('missing bundleKey');
  if (errors.length) fail(`invalid review:\n  - ${errors.join('\n  - ')}`);

  const bundle = readCache(review.bundleKey);
  if (!bundle) fail(`evidence bundle not found in cache for bundleKey ${review.bundleKey}`);

  const { kept, dropped } = applyEvidenceGate(review.findings, bundle);
  const prKey = `${bundle.repo}#${bundle.number}`;
  const systemMode = loadSystems()[bundle.system]?.mode ?? 'silent';
  const mode = systemMode === 'silent' || bundle.mapStatus === 'stale' ? 'silent' : 'post';
  const at = new Date().toISOString();

  const entry = (f, status) => ({
    id: findingId(prKey, f), at, status, mode,
    system: bundle.system, repo: bundle.repo, number: bundle.number, commitSha: bundle.commitSha,
    title: f.title, severity: f.severity, confidence: f.confidence, type: f.type, detail: f.detail,
    evidence: f.evidence,
  });
  appendLedger([...kept.map(f => entry(f, 'open')), ...dropped.map(f => entry(f, 'dropped-no-evidence'))]);

  let posted = false;
  if (mode === 'post' && kept.length > 0) {
    const tmpFile = join(__dirname, '.tmp_system_review_payload.json');
    writeFileSync(tmpFile, JSON.stringify({
      commit_id: bundle.commitSha,
      event: 'COMMENT',
      body: renderSystemReviewBody(kept, bundle),
    }));
    const out = runGh(['api', `repos/${bundle.repo}/pulls/${bundle.number}/reviews`, '--method', 'POST', '--input', tmpFile]);
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    if (out === null) fail(`posting system review to ${prKey} failed (ledger already written)`);
    posted = true;
  }

  const state = loadState();
  state.systemReviewedPRs ??= {};
  state.systemReviewedPRs[prKey] = { commitSha: bundle.commitSha, at, kept: kept.length, dropped: dropped.length, mode };
  saveState(state);

  console.log(JSON.stringify({ pr: prKey, system: bundle.system, mode, kept: kept.length, dropped: dropped.length, posted }, null, 2));
};

main();
