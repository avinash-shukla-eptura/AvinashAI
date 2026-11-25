import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir, homedir } from 'os';
import { findingId, appendLedger, readLedger } from '../lib/ledger.js';
import { resolveDataDir } from '../lib/paths.js';

const f = (evidence) => ({ title: 'gap', evidence });
const A = { repo: 'o/a', path: 'x.cs', line: 1 };
const B = { repo: 'o/b', path: 'y.cs', line: 2 };

test('findingId is stable across evidence order and differs per PR', () => {
  assert.equal(findingId('o/r#1', f([A, B])), findingId('o/r#1', f([B, A])));
  assert.notEqual(findingId('o/r#1', f([A])), findingId('o/r#2', f([A])));
});

test('appendLedger creates a missing data directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const file = join(dir, 'nested', 'gap-ledger.jsonl');
  try {
    appendLedger([{ id: '1' }], file);
    assert.deepEqual(readLedger(file), [{ id: '1' }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveDataDir honours PR_REVIEW_DATA_DIR, else ~/.pr-review-agent', () => {
  assert.equal(resolveDataDir({ PR_REVIEW_DATA_DIR: join(tmpdir(), 'prd') }), resolve(join(tmpdir(), 'prd')));
  assert.equal(resolveDataDir({}), join(homedir(), '.pr-review-agent'));
});

test('appendLedger skips empty batches and round-trips entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const file = join(dir, 'gap-ledger.jsonl');
  try {
    appendLedger([], file);
    assert.equal(existsSync(file), false);
    const entries = [{ id: '1', status: 'open' }, { id: '2', status: 'dropped-no-evidence' }];
    appendLedger(entries.slice(0, 1), file);
    appendLedger(entries.slice(1), file);
    assert.deepEqual(readLedger(file), entries);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
