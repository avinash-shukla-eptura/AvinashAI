import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { parseGrepLine, searchSiblings } from '../lib/search.js';

test('parseGrepLine strips ref prefix and parses path/line/text', () => {
  assert.deepEqual(
    parseGrepLine('origin/master:src/A.cs:42:  var x = "booking-events";', 'origin/master'),
    { path: 'src/A.cs', line: 42, text: 'var x = "booking-events";' },
  );
});

test('parseGrepLine keeps colons inside the matched text', () => {
  const hit = parseGrepLine('HEAD:cfg/app.json:7:  "Url": "https://x:443/api"', 'HEAD');
  assert.equal(hit.path, 'cfg/app.json');
  assert.equal(hit.line, 7);
  assert.equal(hit.text, '"Url": "https://x:443/api"');
});

test('parseGrepLine returns null for non-match lines', () => {
  assert.equal(parseGrepLine('', 'HEAD'), null);
});

test('parseGrepLine keeps full text so long lines are not truncated for map extraction', () => {
  const long = 'x'.repeat(250) + ' [HttpGet("late/route")]';
  assert.equal(parseGrepLine(`HEAD:src/A.cs:1:${long}`, 'HEAD').text, long);
});

test('searchSiblings reports a failed grep as unavailable, not searched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'notgit-'));
  try {
    const ctx = { submodules: [{ name: 'Broken', fullName: 'o/broken', initialized: true, absPath: dir }] };
    const r = searchSiblings({ ctx, excludeFullName: 'o/self', values: ['booking-events'] });
    assert.deepEqual(r.unavailable, ['o/broken']);
    assert.deepEqual(r.searchedRepos, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
