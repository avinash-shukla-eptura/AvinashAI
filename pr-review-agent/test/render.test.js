import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { renderSystemReviewBody } from '../lib/render.js';

const BUNDLE = {
  system: 'devicehub',
  mapAgeDays: 1.5,
  siblingHits: [{ value: 'booking-events', repo: 'CondecoByEptura/Connect-Reports', path: 'src/Fn.cs', line: 12, text: 'SECRET_SIBLING_CODE' }],
};

const ev = [{ repo: 'CondecoByEptura/Connect-Reports', path: 'src/Fn.cs', line: 12 }];

test('low-confidence findings render inside <details>; citations only', () => {
  const body = renderSystemReviewBody([
    { title: 'High one', severity: 'high', confidence: 'high', type: 'contract-break', detail: 'd1', evidence: ev },
    { title: 'Low one',  severity: 'low',  confidence: 'low',  type: 'other',          detail: 'd2', evidence: ev },
  ], BUNDLE);
  const details = body.slice(body.indexOf('<details>'), body.indexOf('</details>'));
  assert.match(details, /Low one/);
  assert.doesNotMatch(details, /High one/);
  assert.match(body, /`CondecoByEptura\/Connect-Reports:src\/Fn\.cs:12`/);
  assert.doesNotMatch(body, /SECRET_SIBLING_CODE/);
  assert.match(body, /## System review \(devicehub\)/);
});
