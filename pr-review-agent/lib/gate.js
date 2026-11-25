/**
 * lib/gate.js
 *
 * system-review-<n>.json schema validation + the evidence gate. The gate is
 * the code-enforced guard against invented citations: a finding is kept only
 * if it has evidence AND every evidence item matches a `siblingHits` entry in
 * the PR's evidence bundle (repo case-insensitive, same path, same line).
 */

const SEVERITIES  = ['high', 'medium', 'low'];
const CONFIDENCES = ['high', 'medium', 'low'];
const TYPES       = ['contract-break', 'missing-counterpart', 'config-drift', 'schema-drift', 'other'];

// ─── Validation ───────────────────────────────────────────────────────────────

export const validateSystemReview = (obj) => {
  const errors = [];
  if (!obj || typeof obj !== 'object') return ['review is not an object'];
  for (const f of ['repo', 'number', 'commitSha', 'system']) if (obj[f] === undefined || obj[f] === '') errors.push(`missing ${f}`);
  if (!Array.isArray(obj.findings)) { errors.push('findings must be an array'); return errors; }
  obj.findings.forEach((f, i) => {
    const p = `findings[${i}]`;
    for (const k of ['title', 'detail']) if (!f?.[k]) errors.push(`${p}: missing ${k}`);
    if (!SEVERITIES.includes(f?.severity))    errors.push(`${p}: severity must be one of ${SEVERITIES.join('|')}`);
    if (!CONFIDENCES.includes(f?.confidence)) errors.push(`${p}: confidence must be one of ${CONFIDENCES.join('|')}`);
    if (!TYPES.includes(f?.type))             errors.push(`${p}: type must be one of ${TYPES.join('|')}`);
    if (!Array.isArray(f?.evidence))          errors.push(`${p}: evidence must be an array`);
    else f.evidence.forEach((e, j) => {
      if (!e?.repo || !e?.path || !Number.isInteger(e?.line)) errors.push(`${p}.evidence[${j}]: needs repo, path, integer line`);
    });
  });
  return errors;
};

// ─── Evidence gate ────────────────────────────────────────────────────────────

const matchesHit = (e, hits) =>
  hits.some(h => h.repo.toLowerCase() === e.repo.toLowerCase() && h.path === e.path && h.line === e.line);

export const applyEvidenceGate = (findings, bundle) => {
  const hits = bundle?.siblingHits ?? [];
  const kept = [];
  const dropped = [];
  for (const f of findings) {
    const ok = f.evidence?.length > 0 && f.evidence.every(e => matchesHit(e, hits));
    (ok ? kept : dropped).push(f);
  }
  return { kept, dropped };
};
