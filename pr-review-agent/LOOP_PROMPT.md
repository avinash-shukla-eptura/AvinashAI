# PR Review Agent — Loop Prompt

Used by the GitHub Copilot app automation "PR auto-review" (every 2 hours).
Can also be pasted into Claude Code after typing `/loop 2h`:

---

You are acting as a code reviewer on behalf of Avinash Shukla (Senior Engineer, Eptura).

**Step 1 — Fetch pending PRs**

From the repo root, run this command and parse its JSON output:

```
node pr-review-agent/fetch-pending.js
```

If the output is `[]`, print "✓ No pending PRs." and stop.

**Step 2 — Review each PR**

For each PR object in the JSON array:

1. Read `pr.title`, `pr.author`, `pr.body`, `pr.files`, `pr.addedLines`, and `pr.diff`.
2. Write a thorough review covering all four dimensions:
   - **Correctness & Bugs** — logic errors, null refs, off-by-one, missing error handling, race conditions
   - **Security** — injection risks, exposed secrets, insecure defaults, auth gaps, unsafe deserialization
   - **Code Style & Simplification** — naming, dead code, unnecessary complexity, idiomatic C#/TS
   - **Architecture & Design** — coupling, SRP violations, API contract changes, breaking changes
3. Decide the verdict:
   - `APPROVE` — solid code, only minor/optional suggestions
   - `REQUEST_CHANGES` — real bugs, security issues, or significant design problems
   - `COMMENT` — neutral questions or non-blocking observations
4. For inline comments, you **must** use only line numbers from `pr.addedLines[filename]`. Never invent line numbers.
   Limit inline comments to the 5 most impactful observations.

**Step 3 — Post each review**

Write your review to a temporary JSON file at:
`pr-review-agent/review-<number>.json`

The file must match this schema exactly:
```json
{
  "repo":     "<pr.repo>",
  "number":   <pr.number>,
  "commitSha": "<pr.commitSha>",
  "event":    "APPROVE|REQUEST_CHANGES|COMMENT",
  "body":     "consolidated markdown review summary (3-6 paragraphs): overview, findings per dimension, verdict rationale",
  "inlineComments": [
    { "path": "<exact filename from addedLines>", "line": <integer from addedLines[filename]>, "body": "markdown" }
  ]
}
```

Then run:
```
node pr-review-agent/post-review.js pr-review-agent/review-<number>.json
```

Report the result (success URL or error) for each PR.

**Step 4 — System review (pass 2, advisory)**

Run this only AFTER Step 3 has posted the PR's review. Pass 2 is advisory: any
pass-2 error is logged and skipped — never retry or re-post the Step 3 review.

For each PR reviewed in Step 3, run:
```
node pr-review-agent/system-context.js --repo <pr.repo> --number <pr.number> --sha <pr.commitSha>
```

Parse the JSON. If `status` is not `ok` (e.g. `unrouted`, `meta-unavailable`,
`head-moved`, `no-signals`), print `[system] <repo>#<number>: <status>` and move on.

If `status` is `ok`, judge cross-repo gaps using ONLY these bundle fields:
`signals`, `siblingHits`, `neighbours`, `mapSummary`, `knowledgeExcerpt`.
Each signal's `source` is the changed line; pair `removed`/`added` signals in the
same file to see what actually changed (e.g. GET→POST, a version bump, a setting value).
Look for: contract breaks (a removed/changed route, topic, package or model that
siblings still use), missing counterparts (new producer with no consumer or vice
versa), config drift and schema drift. Do not read other repos yourself.

Write `pr-review-agent/system-review-<number>.json`:
```json
{
  "repo":      "<bundle.repo>",
  "number":    <bundle.number>,
  "commitSha": "<bundle.commitSha>",
  "system":    "<bundle.system>",
  "bundleKey": "<bundle.key>",
  "findings": [
    {
      "title":      "short gap title",
      "severity":   "high|medium|low",
      "confidence": "high|medium|low",
      "type":       "contract-break|missing-counterpart|config-drift|schema-drift|other",
      "detail":     "why this is a cross-repo gap; no quoted code",
      "evidence":   [ { "repo": "<siblingHits[i].repo>", "path": "<siblingHits[i].path>", "line": <siblingHits[i].line> } ]
    }
  ]
}
```
Every `evidence` item MUST be copied from a `siblingHits` entry — invented
citations are dropped by the evidence gate. Use `"findings": []` if no gaps.

Then run:
```
node pr-review-agent/post-system-review.js pr-review-agent/system-review-<number>.json
```

Report its summary line (`mode`, `kept`, `dropped`, `posted`). In `silent` mode
nothing is posted to GitHub; findings go to `~/.pr-review-agent/gap-ledger.jsonl`
(or `$PR_REVIEW_DATA_DIR/gap-ledger.jsonl`).
