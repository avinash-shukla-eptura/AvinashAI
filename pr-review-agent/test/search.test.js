import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { parseGrepLine } from '../lib/search.js';

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
