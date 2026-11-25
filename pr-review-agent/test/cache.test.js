import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { cacheKey } from '../lib/cache.js';

const base = { repo: 'o/r', number: 1, commitSha: 'abc', mapGeneratedAt: '2026-11-18T00:00:00Z' };

test('cacheKey is deterministic and changes with head sha or map version', () => {
  assert.equal(cacheKey(base), cacheKey({ ...base }));
  assert.match(cacheKey(base), /^[0-9a-f]{40}$/);
  assert.notEqual(cacheKey(base), cacheKey({ ...base, commitSha: 'def' }));
  assert.notEqual(cacheKey(base), cacheKey({ ...base, mapGeneratedAt: '2026-11-19T00:00:00Z' }));
  assert.notEqual(cacheKey(base), cacheKey({ ...base, mapGeneratedAt: undefined }));
});

test('cacheKey expires at each sync boundary', () => {
  const synced = { ...base, syncedAt: '2026-11-20T10:00:00Z' };
  assert.notEqual(cacheKey(synced), cacheKey({ ...synced, syncedAt: '2026-11-20T11:00:00Z' }));
  assert.notEqual(cacheKey(synced), cacheKey(base));
});
