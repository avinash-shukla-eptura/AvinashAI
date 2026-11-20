/**
 * lib/render.js
 *
 * Renders the pass-2 PR review body from evidence-gated findings. Citations
 * only (`repo:path:line`) — never quotes sibling code. Low-confidence
 * findings are collapsed inside <details>.
 */

// ─── Render ───────────────────────────────────────────────────────────────────

const cite = (e) => `\`${e.repo}:${e.path}:${e.line}\``;

const item = (f) =>
  `- **[${f.severity}] ${f.title}** _(${f.type})_\n  ${f.detail}\n  Evidence: ${f.evidence.map(cite).join(', ')}`;

export const renderSystemReviewBody = (kept, bundle) => {
  const main = kept.filter(f => f.confidence !== 'low');
  const low  = kept.filter(f => f.confidence === 'low');
  const lines = [`## System review (${bundle.system})`, ''];
  if (main.length) lines.push(...main.map(item), '');
  if (low.length) {
    lines.push('<details><summary>Low-confidence findings</summary>', '', ...low.map(item), '', '</details>', '');
  }
  const age = bundle.mapAgeDays === null || bundle.mapAgeDays === undefined ? 'unknown' : `${bundle.mapAgeDays}d`;
  lines.push('---', `_System map age: ${age} · evidence-gated (every citation verified against sibling repos)_`);
  return lines.join('\n');
};
