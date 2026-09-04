#!/usr/bin/env node
/**
 * fetch-pending.js
 *
 * Queries GitHub for open PRs where you (@me) are a requested reviewer
 * across the CondecoByEptura and eptura orgs, filters out already-reviewed
 * ones (tracked in state.json), then fetches the diff + file metadata for
 * each new PR.
 *
 * Outputs a JSON array to stdout — each element is everything Claude needs
 * to write a review.  If nothing is pending it outputs [].
 *
 * Usage:
 *   node fetch-pending.js
 *   node fetch-pending.js --list   # titles only, no diffs (fast summary)
 */

import { spawnSync }                        from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname }                    from 'path';
import { fileURLToPath }                    from 'url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const STATE_FILE  = join(__dirname, 'state.json');
const MAX_DIFF_CHARS = 80_000;  // ~20k tokens
const ORGS        = ['CondecoByEptura', 'eptura'];
const LIST_ONLY   = process.argv.includes('--list');

// GitHub login of the human reviewer — PRs they've already reviewed are skipped.
const MY_GITHUB_LOGIN = 'avinash-shukla-eptura';

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  return { reviewedPRs: {} };
}

// ─── gh helpers ───────────────────────────────────────────────────────────────

function runGh(argv) {
  const r = spawnSync('gh', argv, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(`[fetch-pending] gh ${argv.slice(0,4).join(' ')}… failed: ${(r.stderr||'').trim()}\n`);
    return null;
  }
  return r.stdout;
}

function ghJson(argv) {
  const out = runGh(argv);
  if (!out) return null;
  try { return JSON.parse(out); } catch { return null; }
}

// ─── Diff parser ──────────────────────────────────────────────────────────────

/**
 * Returns { "path/to/file.cs": [newLineNum, ...] } for every added line.
 * Claude must only use these line numbers for inline comments — GitHub
 * will reject any line that isn't part of the diff context.
 */
function parseAddedLines(diffText) {
  const map = {};
  let file = null, newLine = 0;

  for (const line of diffText.split('\n')) {
    // File header — start tracking a new file
    if (line.startsWith('+++ b/')) {
      file = line.slice(6).trim();
      map[file] = [];
    }
    // Diff metadata lines — never part of file content, must be skipped before
    // the catch-all context branch below or they'd shift line counters.
    else if (
      line.startsWith('diff --git') ||
      line.startsWith('--- ')       ||
      line.startsWith('index ')     ||
      line.startsWith('new file ')  ||
      line.startsWith('deleted file ') ||
      line.startsWith('old mode ')  ||
      line.startsWith('new mode ')  ||
      line.startsWith('rename ')    ||
      line.startsWith('similarity index') ||
      line === '\\ No newline at end of file'
    ) {
      /* skip — not real file content */
    }
    // Hunk header — sets the starting new-file line number
    else if (line.startsWith('@@ ')) {
      const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) newLine = parseInt(m[1], 10) - 1;
    }
    // File content lines
    else if (file) {
      if (line.startsWith('+'))       { newLine++; map[file].push(newLine); }
      else if (!line.startsWith('-')) { newLine++; }   // context line
    }
  }
  return map;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const state  = loadState();
  const result = [];

  for (const org of ORGS) {
    const prs = ghJson([
      'search', 'prs',
      '--review-requested=@me', '--state=open',
      `--owner=${org}`,
      '--json', 'number,title,body,author,repository',
      '--limit', '50',
    ]) ?? [];

    for (const pr of prs) {
      const nameWithOwner =
        pr.repository?.nameWithOwner ??
        (pr.repository?.owner?.login
          ? `${pr.repository.owner.login}/${pr.repository.name}`
          : null);

      if (!nameWithOwner) continue;

      const key = `${nameWithOwner}#${pr.number}`;
      if (state.reviewedPRs[key]) continue;   // already reviewed by the agent

      // Skip if YOU have already submitted a review on GitHub
      const existingReviews = ghJson([
        'api', `repos/${nameWithOwner}/pulls/${pr.number}/reviews`,
        '--paginate',
      ]) ?? [];
      const alreadyReviewedByMe = existingReviews.some(
        r => r.user?.login === MY_GITHUB_LOGIN &&
             ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(r.state)
      );
      if (alreadyReviewedByMe) {
        process.stderr.write(`[fetch-pending] ${key} already reviewed by ${MY_GITHUB_LOGIN}, skipping\n`);
        continue;
      }

      if (LIST_ONLY) {
        result.push({ key, title: pr.title, author: pr.author?.login });
        continue;
      }

      // ── Fetch commit SHA ───────────────────────────────────────────────────
      const detail = ghJson([
        'pr', 'view', String(pr.number),
        '--repo', nameWithOwner,
        '--json', 'headRefOid',
      ]);
      const commitSha = detail?.headRefOid;
      if (!commitSha) {
        process.stderr.write(`[fetch-pending] Could not get commitSha for ${key}, skipping\n`);
        continue;
      }

      // ── Fetch diff ─────────────────────────────────────────────────────────
      const rawDiff = runGh(['pr', 'diff', String(pr.number), '--repo', nameWithOwner]);
      if (!rawDiff?.trim()) {
        process.stderr.write(`[fetch-pending] Empty diff for ${key}, skipping\n`);
        continue;
      }
      const diff = rawDiff.length > MAX_DIFF_CHARS
        ? rawDiff.slice(0, MAX_DIFF_CHARS) +
          '\n\n[... diff truncated — see the full PR on GitHub for remaining changes ...]'
        : rawDiff;

      // ── Fetch file list (paginated — PRs with >30 files need --paginate) ──
      const files = ghJson([
        'api', `repos/${nameWithOwner}/pulls/${pr.number}/files`,
        '--paginate',
      ]) ?? [];

      result.push({
        key,
        repo:      nameWithOwner,
        number:    pr.number,
        title:     pr.title,
        author:    pr.author?.login ?? 'unknown',
        body:      pr.body ?? '',
        commitSha,
        files:     files.map(f => ({
          filename:  f.filename,
          additions: f.additions,
          deletions: f.deletions,
          status:    f.status,
        })),
        addedLines: parseAddedLines(rawDiff),
        diff,
      });
    }
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => { process.stderr.write(err.message + '\n'); process.exit(1); });
