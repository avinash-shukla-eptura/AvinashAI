import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { findingId, appendLedger, readLedger } from '../lib/ledger.js';

const f = (evidence) => ({ title: 'gap', evidence });
const A = { repo: 'o/a', path: 'x.cs', line: 1 };
const B = { repo: 'o/b', path: 'y.cs', line: 2 };

test('findingId is stable across evidence order and differs per PR', () => {
  assert.equal(findingId('o/r#1', f([A, B])), findingId('o/r#1', f([B, A])));
  assert.notEqual(findingId('o/r#1', f([A])), findingId('o/r#2', f([A])));
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
