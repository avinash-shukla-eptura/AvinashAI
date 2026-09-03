#!/usr/bin/env node
/**
 * post-review.js  <path-to-review.json>
 *
 * Reads a review JSON file written by Claude and posts it to GitHub as a
 * proper PR review (body + inline comments).  Updates state.json on success
 * so fetch-pending.js won't return this PR again.
 *
 * Review JSON schema:
 * {
 *   "repo":     "CondecoByEptura/Connect-BookingManager",
 *   "number":   35,
 *   "commitSha": "abc123...",
 *   "event":    "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
 *   "body":     "markdown review body",
 *   "inlineComments": [
 *     { "path": "src/Foo.cs", "line": 42, "body": "markdown comment" }
 *   ]
 * }
 *
 * Usage:
 *   node post-review.js D:\...\pr-review-agent\review-35.json
 */

import { spawnSync }                        from 'child_process';
import { readFileSync, writeFileSync,
         existsSync, unlinkSync }           from 'fs';
import { join, dirname }                    from 'path';
import { fileURLToPath }                    from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, 'state.json');

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  return { reviewedPRs: {} };
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── gh POST helper ───────────────────────────────────────────────────────────

function ghPost(endpoint, payload) {
  const tmpFile = join(__dirname, '.tmp_post_payload.json');
  writeFileSync(tmpFile, JSON.stringify(payload));

  const r = spawnSync(
    'gh',
    ['api', endpoint, '--method', 'POST', '--input', tmpFile],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );

  try { unlinkSync(tmpFile); } catch { /* ignore */ }

  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || '').trim() };
  }
  try {
    return { ok: true, data: JSON.parse(r.stdout) };
  } catch {
    return { ok: true, data: r.stdout };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const reviewFile = process.argv[2];
  if (!reviewFile) {
    console.error('Usage: node post-review.js <path-to-review.json>');
    process.exit(1);
  }

  let review;
  try {
    review = JSON.parse(readFileSync(reviewFile, 'utf8'));
  } catch (err) {
    console.error(`Could not read review file: ${err.message}`);
    process.exit(1);
  }

  const { repo, number, commitSha, event, body, inlineComments = [] } = review;

  if (!repo || !number || !commitSha || !event || !body) {
    console.error('Review JSON is missing required fields (repo, number, commitSha, event, body).');
    process.exit(1);
  }

  const endpoint = `repos/${repo}/pulls/${number}/reviews`;
  const comments = inlineComments.map(c => ({
    path: c.path,
    line: c.line,
    body: c.body,
    side: 'RIGHT',
  }));

  console.log(`Posting ${event} review to ${repo}#${number} (${comments.length} inline comment(s))…`);

  // Attempt 1: review with inline comments
  let result = ghPost(endpoint, { commit_id: commitSha, body, event, comments });

  // Attempt 2: fall back to body-only if GitHub rejected any inline comment
  if (!result.ok && comments.length > 0) {
    console.warn('Inline comments rejected by GitHub — retrying without them…');
    const fallbackBody =
      body +
      '\n\n---\n> ⚠️ *Inline comments could not be attached (line-number mismatch with the diff). ' +
      'All feedback is in this review body.*';
    result = ghPost(endpoint, { commit_id: commitSha, body: fallbackBody, event, comments: [] });
  }

  if (result.ok && result.data?.html_url) {
    const state = loadState();
    state.reviewedPRs[`${repo}#${number}`] = new Date().toISOString();
    saveState(state);
    console.log(`✅ Review posted: ${result.data.html_url}`);
  } else {
    console.error(`❌ Failed to post review:\n${result.error ?? JSON.stringify(result.data)}`);
    process.exit(1);
  }
}

main();
