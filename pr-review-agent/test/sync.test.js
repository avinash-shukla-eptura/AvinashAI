import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { syncSystem } from '../lib/sync.js';

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
