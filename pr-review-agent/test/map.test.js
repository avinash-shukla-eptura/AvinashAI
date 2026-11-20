import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mapStatus, mapAgeDays, neighbours, renderMapMarkdown } from '../lib/map.js';

const T = { warnAfterDays: 7, ledgerOnlyAfterDays: 30 };

test('mapStatus thresholds', () => {
  assert.equal(mapStatus(3, T), 'fresh');
  assert.equal(mapStatus(10, T), 'warn');
  assert.equal(mapStatus(40, T), 'stale');
  assert.equal(mapStatus(null, T), 'missing');
  assert.equal(mapAgeDays(null), null);
  assert.equal(Math.round(mapAgeDays({ generatedAt: '2026-11-01T00:00:00Z' }, new Date('2026-11-11T00:00:00Z'))), 10);
});

const MAP = {
  system: 'devicehub',
  generatedAt: '2026-11-18T00:00:00Z',
  metaCommit: 'abc',
  repos: {
    'CondecoByEptura/Connect-Booking':  { exposes: [{ kind: 'sb-produce', value: 'booking-events' }], consumes: [], uses: [] },
    'CondecoByEptura/Connect-Reports':  { exposes: [], consumes: [{ kind: 'sb-consume', value: 'booking-events' }], uses: [] },
  },
};

test('neighbours finds consumers and excludes the PR repo', () => {
  const n = neighbours(MAP, ['booking-events'], 'condecobyeptura/connect-booking');
  assert.deepEqual(n, [{ repo: 'CondecoByEptura/Connect-Reports', value: 'booking-events', kind: 'sb-consume', role: 'consumes' }]);
});

test('renderMapMarkdown lists shared contracts', () => {
  const md = renderMapMarkdown(MAP);
  assert.match(md, /## Shared contracts/);
  assert.match(md, /`booking-events` \(sb-produce, sb-consume\): CondecoByEptura\/Connect-Booking → CondecoByEptura\/Connect-Reports/);
});
