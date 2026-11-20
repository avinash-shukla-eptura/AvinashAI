---
date: 2026-11-18
verified: 2026-11-18
type: plan
feature: System-aware PR review (pass 2) — rollout phases 1-2
approach: A — Deterministic evidence pipeline + Copilot judgment
status: implemented
files: [pr-review-agent/package.json, pr-review-agent/.gitignore, pr-review-agent/systems.json, pr-review-agent/lib/gh.js, pr-review-agent/lib/git.js, pr-review-agent/lib/systems.js, pr-review-agent/lib/signals.js, pr-review-agent/lib/sync.js, pr-review-agent/lib/map.js, pr-review-agent/lib/search.js, pr-review-agent/lib/cache.js, pr-review-agent/lib/ledger.js, pr-review-agent/lib/gate.js, pr-review-agent/lib/render.js, pr-review-agent/build-system-map.js, pr-review-agent/system-context.js, pr-review-agent/post-system-review.js, pr-review-agent/test/systems.test.js, pr-review-agent/test/signals.test.js, pr-review-agent/test/map.test.js, pr-review-agent/test/search.test.js, pr-review-agent/test/gate.test.js, pr-review-agent/test/render.test.js, pr-review-agent/LOOP_PROMPT.md, pr-review-agent/README.md, .aid/ARCHITECTURE.md, .aid/CONVENTIONS.md, .aid/COVERAGE.md]
confidence: high
related: [.aid/memory/2026-11-18-innovate-cross-repo-pr-review.md, .aid/memory/2026-09-03-pr-review-agent-added.md, .aid/memory/2026-11-18-cross-repo-pr-review-execution.md, .aid/memory/2026-11-20-cross-repo-pr-review-review.md, .aid/memory/2026-11-20-cross-repo-pr-review-qa.md]
---

# Plan: System-aware PR review (pass 2) — rollout phases 1-2

## Requirement
pr-review-agent reviews PRs with same-repo context only. Add a second, system-level pass that
judges each PR against its meta repo (devicehub-meta for CondecoByEptura DeviceHub repos,
reflex-meta for eptura Reflex repos), records cross-repo gaps to a ledger, and — in this
phase — runs SILENT (ledger only, no GitHub posting). Pass 1 must be unchanged.

Scope = innovate rollout phases 1-2: gap systems #7 routing, #2 sync, #1 map + refresher,
#6 trigger filter + cache, #4 evidence gate, #5 post-only-on-findings, plus ledger writes.
Out of scope (follow-up plans): #9 rollup view + enabling posting, #3 coverage net,
#8 linked-PR detector, Reflex tuning beyond routing/signals.

## Approach Chosen
A — Node scripts do everything deterministic (routing, sync, map, diff-signal extraction,
sibling `git grep`, cache) and emit an evidence bundle per PR. Copilot only judges gaps from
that bundle and writes `system-review-<n>.json`. A poster applies the evidence gate (every
citation must match a hit in the bundle), writes the ledger, and posts only when mode=post
and kept findings > 0. Pass 2 runs strictly after pass 1 posts, so its failure only skips pass 2.

## Alternatives Considered
- **B — Prompt-driven lookups** (Copilot greps meta checkout itself) — rejected: nondeterministic,
  token-heavy, gaps #4/#6 not enforceable in code, hard to test.
- **C — Same scripts, separate automation** — rejected for now: two schedules/states to keep in
  sync and lag between passes. Cheap to adopt later because scripts are identical.

## Key Decisions
- **Routing from meta `.gitmodules`** — the meta repo's submodule URLs are the source of truth for
  "which repo belongs to which system" (no hand-maintained repo list). Case-insensitive match.
- **Meta root discovery** — env `PR_REVIEW_META_ROOT`, else walk up ancestors of the repo root
  until `<dir>/<metaRepo>` exists. No absolute paths committed (CONVENTIONS).
- **Read-only sync** — never mutate the user's meta working trees: `git fetch origin <branch>`
  per initialized submodule; search runs against `origin/<branch>` tree-ish via `git grep`
  (fallback `HEAD`). Throttled to once per 60 min per system. Uninitialized submodules are
  reported as unavailable, not errors.
- **Map** — `build-system-map.js` writes `<meta>/.aid/system-map.json` (+ `system-map.md`) with
  `generatedAt`, `metaCommit`, per-repo `{ref, commit, exposes, consumes, uses}`. Auto-rebuilt
  inside `system-context.js` when age > `warnAfterDays` (7). If rebuild fails: 7-30d = warning,
  > `ledgerOnlyAfterDays` (30) = forced ledger-only. Committing the map to the meta repo is a
  manual PR in this phase.
- **Single regex source** — `lib/signals.js` patterns are used both for diff signals and for the
  map scan (coarse `git grep -F` keyword prefilter, then JS regex per line — ERE lacks `\s`/`(?:)`).
- **Signals scanned on added AND removed lines** — removals are likely breaks.
- **Trigger filter** — pass 2 runs only if the diff yields >= 1 signal; else status `no-signals`.
- **Cache** — whole bundle keyed by sha1(`repo#number@headSha|mapGeneratedAt`) under `cache/`.
  (Simplification of the innovate answer: no per-surface partial reuse.)
- **Evidence gate in code** — a finding is kept only if every evidence `{repo,path,line}` matches
  a bundle sibling hit (same repo+path, same line). Invented citations are dropped and logged
  as `dropped-no-evidence`.
- **Citations, not quotes** (gap #11 seed) — posted bodies cite `repo:path:line` only.
- **Mode per system** in `systems.json`: `"silent"` for both in this phase.
- **Testing** — introduce Node built-in `node:test` (`npm test` = `node --test test/`), zero deps.
- **No change to `fetch-pending.js` / `post-review.js`** — new `lib/gh.js` duplicates the tiny gh
  helper to keep pass 1 untouched.

## Architecture Impact
- New pass-2 pipeline inside `pr-review-agent/`: `system-context.js` → Copilot →
  `post-system-review.js` → `gap-ledger.jsonl`; `build-system-map.js` writes into meta repos.
- New dependency on local meta checkouts (devicehub-meta, reflex-meta) — read + `git fetch` +
  writing `.aid/system-map.*`.
- New pattern: `lib/` shared modules and `node:test` tests.
- Update ARCHITECTURE.md (data flow), CONVENTIONS.md + COVERAGE.md (tests now exist).

## Testing Strategy
- **Unit (node:test):** gitmodules parsing + routing; dotnet/python signal extraction (added,
  removed, file rules, none); map age/status + neighbours + markdown render; grep-line parsing;
  evidence gate + schema validation; review body render (confidence tiers, citations only).
- **Integration (manual smoke):** `build-system-map.js --system devicehub` against real
  devicehub-meta; `system-context.js` on one real DeviceHub PR (signals + hits) and one
  non-meta repo PR (`unrouted`); `post-system-review.js` in silent mode writes ledger and posts
  nothing.
- **Manual:** one scheduled cycle of PR auto-review — pass 1 posts as before; pass 2 logs.
- **Regression risk:** pass 1 files untouched; LOOP_PROMPT step 1-3 text unchanged (step 4 appended).

## Rollback Plan
- **How to undo:** remove Step 4 from `LOOP_PROMPT.md` (pass 2 stops instantly) or revert commit.
- **Data safety:** only additive — new untracked ledger/cache, new `.aid/system-map.*` in meta
  checkouts (deletable). `state.json` gains a new key; existing keys untouched.
- **Blast radius:** silent mode → nothing posted to GitHub; worst case extra tokens/time per cycle.
- **Point of no return:** none.

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Fetching ~65 submodules slows the cycle | Med | Low | 60-min throttle; fetch only initialized submodules; failures non-fatal |
| Regex signals miss or over-match | Med | Med | Silent mode for a week; ledger review; tunable patterns; tests |
| Copilot invents citations | Med | High | Code-enforced evidence gate against bundle hits |
| Pass 2 failure disrupts pass 1 | Low | High | Step 4 runs after Step 3 posted; pass-2 errors only logged |
| Writing map into meta checkout surprises user | Low | Low | Only `.aid/system-map.*`; documented; manual commit |
| Meta root not found on another machine | Low | Low | `PR_REVIEW_META_ROOT` env override; status `meta-unavailable` |

## Success Criteria
- [ ] `npm test` passes in `pr-review-agent/`
- [ ] `build-system-map.js --system devicehub` produces a map listing >= 1 exposed route/topic
- [ ] `system-context.js` returns `ok` with signals + sibling hits for a real DeviceHub contract PR,
      and `unrouted` for a non-meta repo
- [ ] Silent mode: ledger lines appended, zero GitHub posts from pass 2
- [ ] Pass 1 behaviour unchanged (same scripts, same prompt steps 1-3)

## Checklist

- [ ] **1. Add test script and ignore runtime files**
  Files: `pr-review-agent/package.json`, `pr-review-agent/.gitignore`
  Details: add `"test": "node --test test/"` to scripts; append `gap-ledger.jsonl`, `cache/`,
  `system-review-*.json` to `.gitignore`.
  Verify: `git diff` shows both; JSON parses.

- [ ] **2. Create routing registry**
  Files: `pr-review-agent/systems.json`
  Details: `{ "systems": { "devicehub": { "metaRepo": "devicehub-meta", "stack": "dotnet",
  "mode": "silent", "warnAfterDays": 7, "ledgerOnlyAfterDays": 30, "syncThrottleMinutes": 60 },
  "reflex": { "metaRepo": "reflex-meta", "stack": "python", "mode": "silent", ...same thresholds } } }`.
  Verify: `node -e "JSON.parse(require('fs').readFileSync('pr-review-agent/systems.json','utf8'))"`.

- [ ] **3. Add gh helper**
  Files: `pr-review-agent/lib/gh.js`
  Details: banner; export `runGh(argv)` (spawnSync gh, 50MB buffer, stderr log `[system-review]`,
  null on non-zero) and `ghJson(argv)` (parse or null). Same semantics as fetch-pending.js.
  Verify: `node -e "import('./pr-review-agent/lib/gh.js').then(m=>console.log(!!m.runGh(['--version'])))"` → true.

- [ ] **4. Add git helper**
  Files: `pr-review-agent/lib/git.js`
  Details: export `runGit(cwd, argv, {allowExit1=false})` → stdout string or null (exit 1 returns
  '' when allowExit1, for `git grep` no-match).
  Verify: `runGit('.', ['rev-parse','HEAD'])` returns a SHA.

- [ ] **5. Implement gitmodules parsing and routing**
  Files: `pr-review-agent/lib/systems.js`
  Details: export `parseGitmodules(text)` → `[{name, path, url, branch, fullName}]` (fullName =
  `owner/repo` from https/ssh URL, `.git` stripped); `loadSystems()` reads systems.json;
  `findMetaRoot(metaRepo, start)` (env `PR_REVIEW_META_ROOT` first, then ancestor walk);
  `matchSystem(nameWithOwner, systemsWithSubmodules)` pure, case-insensitive → `{id, system,
  submodule}` or null; `resolveSystem(nameWithOwner)` wires them (reads `<meta>/.gitmodules`,
  adds `metaPath`, `submodules` with `initialized = existsSync(<path>/.git)`).
  Verify: task 6 tests.

- [ ] **6. Test routing**
  Files: `pr-review-agent/test/systems.test.js`
  Details: parseGitmodules on a 2-entry fixture (https + ssh URLs, branch present/absent);
  matchSystem hits case-insensitively; unknown repo → null.
  Verify: `npm test` green.

- [ ] **7. Implement signal patterns and extractor**
  Files: `pr-review-agent/lib/signals.js`
  Details: export `PATTERNS.dotnet` — http-route (`Route\s*=\s*"..."`, `[Http(Get|Post|Put|Delete|Patch)|Route("...")]`) role exposes;
  sb-consume (`ServiceBusTrigger\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?`) role consumes;
  sb-produce (`CreateSender\(\s*"([^"]+)"`) role exposes; cosmos (`GetContainer\(\s*[^,]+,\s*"([^"]+)"`,
  `CosmosDBTrigger\(...containerName...`) role uses; package-ref (`PackageReference Include="(Condeco\.[^"]+)"`) consumes;
  package-id (`<PackageId>([^<]+)</PackageId>`) exposes.
  `PATTERNS.python` — route (`@(app|router)\.(get|post|put|delete|patch)\(\s*["']([^"']+)`) exposes;
  model (`class (\w+)\((?:BaseModel|BaseSettings)\)`) exposes; env (`os\.(environ\.get|getenv)\(\s*["']([A-Z0-9_]+)`, `os\.environ\[["']([A-Z0-9_]+)`) uses.
  `FILE_RULES` per stack (dotnet: `\.bicep$`, `appsettings.*\.json$`, `local\.settings\.json$`,
  `(^|/)Migrations/`, `\.sql$`, `(swagger|openapi).*\.(json|ya?ml)$`; python: `\.tf$`,
  `(alembic|migrations)/`, `SKILL\.md$`, `AGENTS\.md$`, `permissions\.py$`).
  `GREP_KEYWORDS` per stack (fixed strings for prefilter). `extractFromLine(line, stack)` →
  `[{kind, value, role}]`; `extractFromDiff(diff, stack)` → dedup `[{kind, value, role, change:
  'added'|'removed', file}]` + `{kind:'file', value:path, role:'uses', change:'modified'}` for FILE_RULES.
  Verify: tasks 8-9.

- [ ] **8. Test dotnet signals**
  Files: `pr-review-agent/test/signals.test.js`
  Details: diff fixture with added `[ServiceBusTrigger("booking-events","sub")]`, removed
  `Route = "bookings/{id}"`, and an `appsettings.json` change → expects sb-consume added,
  http-route removed, file signal.
  Verify: `npm test` green.

- [ ] **9. Test python and empty signals**
  Files: `pr-review-agent/test/signals.test.js`
  Details: `@router.post("/tasks")` + `class TaskIn(BaseModel)` + `os.getenv("REFLEX_TOKEN")`
  → 3 signals; a README-only diff → `[]`.
  Verify: `npm test` green.

- [ ] **10. Implement read-only sync**
  Files: `pr-review-agent/lib/sync.js`
  Details: export `refFor(sub)` → `origin/<branch>` if `git rev-parse --verify` ok else `HEAD`;
  `syncSystem(ctx, {cacheDir, throttleMinutes, now})` → skips if `cache/sync-<id>.json`
  lastSyncAt within throttle; else `git fetch --quiet origin <branch>` per initialized submodule;
  returns `{skipped, fetched, failed:[name], unavailable:[name]}`; writes lastSyncAt.
  Verify: run once against devicehub-meta in smoke (task 26).

- [ ] **11. Implement map load/age/neighbours**
  Files: `pr-review-agent/lib/map.js`
  Details: export `mapPaths(metaPath)`; `loadMap(metaPath)` → json|null; `mapAgeDays(map, now)`;
  `mapStatus(ageDays, {warnAfterDays, ledgerOnlyAfterDays})` → `fresh|warn|stale|missing`;
  `neighbours(map, values, excludeRepo)` → `[{repo, value, role}]`.
  Verify: task 12.

- [ ] **12. Test map helpers**
  Files: `pr-review-agent/test/map.test.js`
  Details: age 3/10/40/null → fresh/warn/stale/missing; neighbours finds a consuming repo and
  excludes the PR repo.
  Verify: `npm test` green.

- [ ] **13. Implement map markdown renderer**
  Files: `pr-review-agent/lib/map.js`
  Details: export `renderMapMarkdown(map)` → header (system, generatedAt, metaCommit, repo count),
  table `repo | exposes | consumes | uses` counts, "Shared contracts" list of values with
  >= 2 repos (producers → consumers), pointer to `.aid/knowledge/`.
  Verify: task 14.

- [ ] **14. Test map renderer**
  Files: `pr-review-agent/test/map.test.js`
  Details: 2-repo map sharing a topic → markdown contains the topic under Shared contracts.
  Verify: `npm test` green.

- [ ] **15. Create map builder CLI**
  Files: `pr-review-agent/build-system-map.js`
  Details: banner + dividers; `--system <id>`; export `buildMap(ctx)`: for each initialized
  submodule, `ref = refFor`, `git grep -n -I -F -e <kw>... <ref>` (allowExit1), run
  `extractFromLine` per hit, aggregate into `exposes/consumes/uses` sets per repo; record
  `commit` via `git rev-parse <ref>`; map = `{system, generatedAt, metaCommit, repos}`; write
  `<meta>/.aid/system-map.json` + `system-map.md`; CLI prints summary; exit 1 if meta missing.
  Verify: smoke task 26.

- [ ] **16. Implement sibling search**
  Files: `pr-review-agent/lib/search.js`
  Details: export `parseGrepLine(line, ref)` → `{path, line, text}` (strip `<ref>:` prefix,
  text trimmed to 200 chars); `searchSiblings({ctx, excludeFullName, values, maxValues=20,
  maxHitsPerValue=10, maxTotal=60})` — one `git grep -n -I -F -e v1 -e v2 … <ref>` per
  initialized sibling; attribute hits to values by `includes`; returns `{hits:[{value, repo,
  path, line, text}], searchedRepos, unavailable}`.
  Verify: task 17.

- [ ] **17. Test grep parsing**
  Files: `pr-review-agent/test/search.test.js`
  Details: `origin/master:src/A.cs:42:  var x = "booking-events";` → path/line/text; path with
  colons in text preserved.
  Verify: `npm test` green.

- [ ] **18. Implement cache**
  Files: `pr-review-agent/lib/cache.js`
  Details: export `cacheKey({repo, number, commitSha, mapGeneratedAt})` sha1 hex;
  `readCache(key)` / `writeCache(key, obj)` under `pr-review-agent/cache/` (mkdir recursive).
  Verify: covered in smoke + gate test uses bundle object directly.

- [ ] **19. Create evidence-bundle CLI**
  Files: `pr-review-agent/system-context.js`
  Details: banner; args `--repo --number --sha`; `resolveSystem` → null ⇒ print
  `{status:'unrouted'}`; meta missing ⇒ `meta-unavailable`; `gh pr diff` ⇒ `extractFromDiff`;
  none ⇒ `no-signals`; `syncSystem`; load map, if status warn/stale/missing → `buildMap`
  (try/catch, record `mapRebuildError`); recompute status; cache hit ⇒ print cached; else
  `searchSiblings` with signal values, `neighbours`, `mapSummary` (system-map.md ≤ 6000 chars),
  `knowledgeExcerpt` (`.aid/knowledge/architecture.md` ≤ 4000 chars); bundle `{key, repo,
  number, commitSha, system, mode, status:'ok', mapStatus, mapAgeDays, sync, signals,
  siblingHits, neighbours, mapSummary, knowledgeExcerpt}`; write cache; stdout JSON. Always
  exit 0 with a status (pass 2 is advisory).
  Verify: smoke task 26.

- [ ] **20. Implement ledger**
  Files: `pr-review-agent/lib/ledger.js`
  Details: export `findingId(prKey, finding)` sha1 of prKey+title+evidence paths;
  `appendLedger(entries, file=gap-ledger.jsonl)` one JSON per line; `readLedger(file)`.
  Verify: used in task 23 smoke.

- [ ] **21. Implement schema validation and evidence gate**
  Files: `pr-review-agent/lib/gate.js`
  Details: export `validateSystemReview(obj)` → errors[] (required repo, number, commitSha,
  system, findings[]; each finding title, severity∈{high,medium,low}, confidence∈{high,medium,low},
  type∈{contract-break,missing-counterpart,config-drift,schema-drift,other}, detail,
  evidence[] of {repo,path,line}); `applyEvidenceGate(findings, bundle)` → `{kept, dropped}`,
  kept iff evidence non-empty and every item matches a `siblingHits` entry (repo
  case-insensitive, path exact, line equal).
  Verify: task 22.

- [ ] **22. Test gate**
  Files: `pr-review-agent/test/gate.test.js`
  Details: matching evidence kept; empty evidence dropped; invented path dropped; wrong line
  dropped; missing `severity` → validation error.
  Verify: `npm test` green.

- [ ] **23. Implement review body renderer**
  Files: `pr-review-agent/lib/render.js`
  Details: export `renderSystemReviewBody(kept, bundle)` → `## System review (<system>)`,
  high/medium-confidence findings as list with severity, type, detail, citations
  `` `repo:path:line` `` (no code text), low-confidence inside `<details>`, footer with map age
  and "evidence-gated".
  Verify: task 24.

- [ ] **24. Test renderer**
  Files: `pr-review-agent/test/render.test.js`
  Details: low-confidence finding appears inside `<details>`; body contains citation and does
  not contain the hit `text`.
  Verify: `npm test` green.

- [ ] **25. Create poster CLI**
  Files: `pr-review-agent/post-system-review.js`
  Details: banner; arg = system-review file; validate (errors ⇒ exit 1); rebuild key from bundle
  inputs — read bundle via `readCache` using `system-review.bundleKey` (Copilot copies `key`
  from bundle) ⇒ missing ⇒ exit 1; gate; ledger append kept (`status:'open'`) + dropped
  (`status:'dropped-no-evidence'`) with `mode`; effective mode = `silent` if systems mode
  silent or bundle.mapStatus === 'stale'; if `post` and kept > 0 ⇒ `gh api
  repos/<repo>/pulls/<n>/reviews` POST `{commit_id, event:'COMMENT', body}` via temp file;
  update `state.json.systemReviewedPRs[key] = {commitSha, at, kept, dropped, mode}`; print summary.
  Verify: smoke task 27.

- [ ] **26. Smoke the context pipeline**
  Files: none (manual)
  Details: `node pr-review-agent/build-system-map.js --system devicehub`; then
  `node pr-review-agent/system-context.js` on one real CondecoByEptura Connect-* PR touching a
  contract and on one non-meta repo PR.
  Verify: map has ≥1 exposed route/topic; first bundle `status: ok` with siblingHits; second `unrouted`.

- [ ] **27. Smoke the silent poster**
  Files: none (manual; temp `system-review-<n>.json` deleted after)
  Details: hand-write a review citing one real hit + one invented path; run poster.
  Verify: ledger gets 1 `open` + 1 `dropped-no-evidence`; nothing posted on GitHub.

- [ ] **28. Append Step 4 to the loop prompt**
  Files: `pr-review-agent/LOOP_PROMPT.md`
  Details: after Step 3 (pass 1 posted): run `system-context.js --repo --number --sha`; if
  status ≠ ok, log and continue; else judge gaps using only `signals`, `siblingHits`,
  `neighbours`, `mapSummary`, `knowledgeExcerpt`; write `system-review-<n>.json` (schema incl.
  `bundleKey`, citations only from `siblingHits`); run `post-system-review.js`; pass-2
  errors never retry pass 1. Steps 1-3 text unchanged.
  Verify: `git diff` shows append only.

- [ ] **29. Document system pass**
  Files: `pr-review-agent/README.md`
  Details: "System review (pass 2)" section: flow, systems.json, `PR_REVIEW_META_ROOT`, map
  build command, silent vs post mode, ledger/cache files, `npm test`; add rows to file table.
  Verify: README renders; repo-relative paths only.

- [ ] **30. Update AID docs**
  Files: `.aid/ARCHITECTURE.md`, `.aid/CONVENTIONS.md`, `.aid/COVERAGE.md`
  Details: add pass-2 data flow; replace "no test framework" with `node:test` via `npm test`;
  list new tests in COVERAGE.
  Verify: no stale "no test framework" statement remains.

- [ ] **31. Run full test suite**
  Files: none
  Details: `cd pr-review-agent; npm test`.
  Verify: all tests pass; record output for REVIEW.

## Amendment 1 (2026-11-20): QA defect fix, approved by user
QA (`memory/2026-11-20-cross-repo-pr-review-qa.md`) found that `findMetaRoot` stops at the first
ancestor holding a folder named `<metaRepo>`. From a Copilot worktree that is the app's empty
`copilot-worktrees\devicehub-meta` container. The user chose "Fix findMetaRoot only (amend plan,
execute, re-QA, ship)".

- [ ] **32. Require `.gitmodules` when discovering the meta root**
  Files: `pr-review-agent/lib/systems.js`, `pr-review-agent/test/systems.test.js`
  Details: `findMetaRoot` accepts a candidate (the env override or a walk-up ancestor) only if
  `<dir>/<metaRepo>/.gitmodules` exists. Update the header comment to match. Add a test: a temp
  tree with an empty decoy `<metaRepo>` dir closer to `start` than the real one; the result must
  be the real root. A tree with no meta repo returns null.
  Verify: `npm test` green. `system-context.js` on Connect-ReportService#99 returns `ok` WITHOUT
  `PR_REVIEW_META_ROOT`.
