import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { syncSystem, pickRef } from '../lib/sync.js';

const ctx = { id: 'demo', submodules: [{ name: 'Missing', initialized: false }] };

test('syncSystem throttles within the window and re-syncs after it', () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'sync-'));
  try {
    const t0 = new Date('2026-11-20T10:00:00Z');
    const first = syncSystem(ctx, { cacheDir, throttleMinutes: 60, now: t0 });
    assert.equal(first.skipped, false);
    assert.deepEqual(first.unavailable, ['Missing']);

    const within = syncSystem(ctx, { cacheDir, throttleMinutes: 60, now: new Date('2026-11-20T10:59:00Z') });
    assert.equal(within.skipped, true);
    assert.equal(within.lastSyncAt, t0.toISOString());

    const after = syncSystem(ctx, { cacheDir, throttleMinutes: 60, now: new Date('2026-11-20T11:01:00Z') });
    assert.equal(after.skipped, false);
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('pickRef prefers origin/<branch>, then origin/HEAD for branchless, then HEAD', () => {
  const only = (...ok) => (ref) => ok.includes(ref);
  assert.equal(pickRef('main', only('origin/main', 'origin/HEAD')), 'origin/main');
  assert.equal(pickRef(null, only('origin/HEAD')), 'origin/HEAD');
  assert.equal(pickRef(undefined, only()), 'HEAD');
  assert.equal(pickRef('gone', only('origin/HEAD')), 'HEAD');
});

test('throttled syncs reuse the last real sync failures', () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'sync-'));
  try {
    const t0 = new Date('2026-11-20T10:00:00Z');
    const broken = { id: 'demo', submodules: [{ name: 'Gone', initialized: true, absPath: join(cacheDir, 'nope') }] };
    const first = syncSystem(broken, { cacheDir, throttleMinutes: 60, now: t0 });
    assert.deepEqual(first.failed, ['Gone']);
    const again = syncSystem(broken, { cacheDir, throttleMinutes: 60, now: new Date(t0.getTime() + 60_000) });
    assert.equal(again.skipped, true);
    assert.deepEqual(again.failed, ['Gone']);
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
