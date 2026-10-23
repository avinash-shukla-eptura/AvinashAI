#!/usr/bin/env node
/**
 * token-report.js
 *
 * Reports token usage of the "PR auto-review" app automation runs. Each run is a
 * Copilot session under ~/.copilot/session-state/<id>/; its final accounting is
 * written to events.jsonl as a `session.shutdown` event once the session ends.
 *
 * Prints a Markdown table of every finished review run for the day plus totals,
 * and appends new runs (deduped by session id) to a CSV log that lives outside
 * the repo, because each automation run uses a throwaway worktree.
 *
 * Usage:
 *   node pr-review-agent/token-report.js                 # today (local time)
 *   node pr-review-agent/token-report.js --date 2026-10-23
 *   node pr-review-agent/token-report.js --no-log        # don't write the CSV
 *
 * Env:
 *   COPILOT_SESSION_STATE_DIR  default ~/.copilot/session-state
 *   PR_REVIEW_USAGE_LOG        default ~/.pr-review-agent/usage-log.csv
 */

import { readFileSync, readdirSync, existsSync, appendFileSync, mkdirSync, openSync, readSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const SESSION_DIR = process.env.COPILOT_SESSION_STATE_DIR || join(homedir(), '.copilot', 'session-state');
const LOG_FILE    = process.env.PR_REVIEW_USAGE_LOG || join(homedir(), '.pr-review-agent', 'usage-log.csv');
// Start of the automation prompt — identifies review-run sessions.
const PROMPT_MARKER = 'Review GitHub PRs where I (@avinash-shukla-eptura) am tagged';
const HEAD_BYTES    = 256 * 1024;
const NO_LOG        = process.argv.includes('--no-log');

const CSV_COLUMNS = [
  'date', 'startTime', 'sessionId', 'models', 'requests', 'inputTokens', 'outputTokens',
  'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens', 'aiCredits', 'premiumRequests', 'apiSeconds',
];

// ─── Args ─────────────────────────────────────────────────────────────────────

const localDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function targetDate() {
  const i = process.argv.indexOf('--date');
  if (i === -1) return localDate(new Date());
  const v = process.argv[i + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) {
    console.error('--date must be YYYY-MM-DD');
    process.exit(1);
  }
  return v;
}

// ─── Session parsing ──────────────────────────────────────────────────────────

const readHead = (file) => {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.toString('utf8', 0, n);
  } finally {
    closeSync(fd);
  }
};

const parseLines = (text) => text.split('\n').flatMap((line) => {
  if (!line.trim()) return [];
  try { return [JSON.parse(line)]; } catch { return []; }
});

function parseRun(sessionId) {
  const file = join(SESSION_DIR, sessionId, 'events.jsonl');
  if (!existsSync(file)) return null;

  const head = readHead(file);
  if (!head.includes(PROMPT_MARKER)) return null;

  const events = parseLines(readFileSync(file, 'utf8'));
  const firstUser = events.find((e) => e.type === 'user.message');
  if (!firstUser?.data?.content?.startsWith(PROMPT_MARKER)) return null;

  const start = events.find((e) => e.type === 'session.start')?.data?.startTime;
  if (!start) return null;

  // Snapshot is cumulative; the last shutdown wins if the session was resumed.
  const shutdown = events.filter((e) => e.type === 'session.shutdown').pop();
  const snap = shutdown?.data?.accountingSnapshot;
  const run = { sessionId, startTime: new Date(start), finished: Boolean(snap) };
  if (!snap) return run;

  const metrics = Object.entries(snap.modelMetrics || {});
  const sum = (pick) => metrics.reduce((acc, [, m]) => acc + (pick(m) || 0), 0);

  return {
    ...run,
    models: metrics.map(([id]) => id).join(' + ') || 'unknown',
    requests: sum((m) => m.requests?.count),
    inputTokens: sum((m) => m.usage?.inputTokens),
    outputTokens: sum((m) => m.usage?.outputTokens),
    cacheReadTokens: sum((m) => m.usage?.cacheReadTokens),
    cacheWriteTokens: sum((m) => m.usage?.cacheWriteTokens),
    reasoningTokens: sum((m) => m.usage?.reasoningTokens),
    aiCredits: (snap.totalNanoAiu || 0) / 1e9,
    premiumRequests: snap.totalPremiumRequestCost || 0,
    apiSeconds: Math.round((snap.totalApiDurationMs || 0) / 1000),
  };
}

function collectRuns(date) {
  if (!existsSync(SESSION_DIR)) return [];
  return readdirSync(SESSION_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      try { return parseRun(d.name); } catch { return null; }
    })
    .filter((r) => r && localDate(r.startTime) === date)
    .sort((a, b) => a.startTime - b.startTime);
}

// ─── CSV log ──────────────────────────────────────────────────────────────────

function loggedSessionIds() {
  if (!existsSync(LOG_FILE)) return new Set();
  return new Set(readFileSync(LOG_FILE, 'utf8').split('\n').slice(1).map((l) => l.split(',')[2]).filter(Boolean));
}

function appendToLog(runs, date) {
  const seen = loggedSessionIds();
  const fresh = runs.filter((r) => r.finished && !seen.has(r.sessionId));
  if (!fresh.length) return 0;

  mkdirSync(dirname(LOG_FILE), { recursive: true });
  if (!existsSync(LOG_FILE)) appendFileSync(LOG_FILE, CSV_COLUMNS.join(',') + '\n');
  const rows = fresh.map((r) => CSV_COLUMNS.map((c) => {
    if (c === 'date') return date;
    if (c === 'startTime') return r.startTime.toISOString();
    if (c === 'aiCredits') return r.aiCredits.toFixed(2);
    return String(r[c]).replace(/,/g, ' ');
  }).join(','));
  appendFileSync(LOG_FILE, rows.join('\n') + '\n');
  return fresh.length;
}

// ─── Output ───────────────────────────────────────────────────────────────────

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const time = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function main() {
  const date = targetDate();
  const runs = collectRuns(date);
  const done = runs.filter((r) => r.finished);
  const running = runs.length - done.length;

  console.log(`## PR auto-review token usage — ${date}\n`);
  if (!runs.length) {
    console.log('No PR auto-review runs found for this date.');
    return;
  }

  console.log('| Start | Session | Model | Requests | Input | Output | Cache read | Cache write | AI credits |');
  console.log('|---|---|---|--:|--:|--:|--:|--:|--:|');
  for (const r of runs) {
    if (!r.finished) {
      console.log(`| ${time(r.startTime)} | ${r.sessionId.slice(0, 8)} | _still running_ | | | | | | |`);
      continue;
    }
    console.log(`| ${time(r.startTime)} | ${r.sessionId.slice(0, 8)} | ${r.models} | ${r.requests} | ${fmt(r.inputTokens)} | ${fmt(r.outputTokens)} | ${fmt(r.cacheReadTokens)} | ${fmt(r.cacheWriteTokens)} | ${r.aiCredits.toFixed(2)} |`);
  }

  const total = (k) => done.reduce((acc, r) => acc + r[k], 0);
  console.log(`| **Total (${done.length} runs)** | | | **${total('requests')}** | **${fmt(total('inputTokens'))}** | **${fmt(total('outputTokens'))}** | **${fmt(total('cacheReadTokens'))}** | **${fmt(total('cacheWriteTokens'))}** | **${total('aiCredits').toFixed(2)}** |`);
  if (running) console.log(`\n${running} run(s) still in progress — not counted in totals.`);

  if (!NO_LOG) {
    const added = appendToLog(runs, date);
    console.log(`\nLogged ${added} new run(s) to ${LOG_FILE}`);
  }
}

main();
