import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { validateSystemReview, applyEvidenceGate } from '../lib/gate.js';

const BUNDLE = {
  siblingHits: [{ value: 'booking-events', repo: 'CondecoByEptura/Connect-Reports', path: 'src/Fn.cs', line: 12, text: 'x' }],
};

const finding = (evidence, extra = {}) => ({
  title: 't', severity: 'high', confidence: 'high', type: 'contract-break', detail: 'd', evidence, ...extra,
});

test('evidence gate keeps matching evidence (repo case-insensitive)', () => {
  const { kept, dropped } = applyEvidenceGate([finding([{ repo: 'condecobyeptura/connect-reports', path: 'src/Fn.cs', line: 12 }])], BUNDLE);
  assert.equal(kept.length, 1);
  assert.equal(dropped.length, 0);
});

test('evidence gate drops empty, invented-path and wrong-line evidence', () => {
  const { kept, dropped } = applyEvidenceGate([
    finding([]),
    finding([{ repo: 'CondecoByEptura/Connect-Reports', path: 'src/Invented.cs', line: 12 }]),
    finding([{ repo: 'CondecoByEptura/Connect-Reports', path: 'src/Fn.cs', line: 13 }]),
  ], BUNDLE);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 3);
});

test('validateSystemReview flags missing severity', () => {
  const review = { repo: 'a/b', number: 1, commitSha: 'abc', system: 'devicehub', findings: [finding([], { severity: undefined })] };
  assert.ok(validateSystemReview(review).some(e => e.includes('severity')));
  assert.deepEqual(validateSystemReview({ ...review, findings: [finding([])] }), []);
});
