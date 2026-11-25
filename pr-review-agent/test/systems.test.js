import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join }   from 'path';
import { tmpdir } from 'os';
import { parseGitmodules, matchSystem, findMetaRoot } from '../lib/systems.js';

const FIXTURE = `[submodule "repos/Connect-Core"]
	path = repos/Connect-Core
	url = https://github.com/CondecoByEptura/Connect-Core.git
	branch = master
[submodule "repos/reflex-harness"]
	path = repos/reflex-harness
	url = git@github.com:eptura/reflex-harness.git
`;

test('parseGitmodules reads https and ssh urls, optional branch', () => {
  const subs = parseGitmodules(FIXTURE);
  assert.equal(subs.length, 2);
  assert.deepEqual(subs[0], {
    name: 'Connect-Core', path: 'repos/Connect-Core',
    url: 'https://github.com/CondecoByEptura/Connect-Core.git',
    branch: 'master', fullName: 'CondecoByEptura/Connect-Core',
  });
  assert.equal(subs[1].fullName, 'eptura/reflex-harness');
  assert.equal(subs[1].branch, null);
});

test('matchSystem routes case-insensitively and returns null for unknown repos', () => {
  const subs = parseGitmodules(FIXTURE);
  const systems = [
    { id: 'devicehub', system: {}, submodules: [subs[0]] },
    { id: 'reflex',    system: {}, submodules: [subs[1]] },
  ];
  assert.equal(matchSystem('condecobyeptura/connect-core', systems).id, 'devicehub');
  assert.equal(matchSystem('eptura/reflex-harness', systems).id, 'reflex');
  assert.equal(matchSystem('eptura/unknown-repo', systems), null);
});

test('findMetaRoot skips a nearer empty <metaRepo> folder and needs .gitmodules', () => {
  const root = mkdtempSync(join(tmpdir(), 'meta-root-'));
  const saved = process.env.PR_REVIEW_META_ROOT;
  delete process.env.PR_REVIEW_META_ROOT;
  try {
    const worktrees = join(root, 'copilot-worktrees');
    const start = join(worktrees, 'AvinashAI', 'wt', 'pr-review-agent');
    mkdirSync(start, { recursive: true });
    mkdirSync(join(worktrees, 'devicehub-meta'));
    assert.equal(findMetaRoot('devicehub-meta', start), null);

    mkdirSync(join(root, 'devicehub-meta'));
    writeFileSync(join(root, 'devicehub-meta', '.gitmodules'), '');
    assert.equal(findMetaRoot('devicehub-meta', start), root);
  } finally {
    if (saved === undefined) delete process.env.PR_REVIEW_META_ROOT;
    else process.env.PR_REVIEW_META_ROOT = saved;
    rmSync(root, { recursive: true, force: true });
  }
});
