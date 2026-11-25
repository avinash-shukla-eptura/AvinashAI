import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { buildMap } from '../build-system-map.js';

test('buildMap throws when git grep fails instead of producing an empty "fresh" map', () => {
  const notRepo = mkdtempSync(join(tmpdir(), 'prra-notgit-'));
  try {
    const ctx = {
      id: 't', metaPath: notRepo, system: { stack: 'dotnet' },
      submodules: [{ name: 'svc', fullName: 'o/svc', absPath: notRepo, initialized: true }],
    };
    assert.throws(() => buildMap(ctx), /git grep failed in o\/svc/);
  } finally {
    rmSync(notRepo, { recursive: true, force: true });
  }
});
