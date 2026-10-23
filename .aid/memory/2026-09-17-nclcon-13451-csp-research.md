---
date: 2026-09-17
verified: 2026-09-17
type: investigation
symptom: Both Self Service and Admin Portal serve only frame-ancestors 'self' CSP — no XSS protection
root-cause: Azure Front Door ResponseRuleSet appends a single-directive CSP; prior NCLCON-13049 fix was reverted because it broke B2C login, Power BI reports, and styled-components styling by applying script-src 'self' without auditing external resources; Connect-SelfService additionally has two inline <script> blocks in index.html that must be extracted before script-src 'self' can be applied
category: Configuration + Missing Validation
files:
  - devicehub-adminportal/Condeco.Connect.DevicehubAdminPortal.AzureDeploy/AzureDevOps/Templates/Variables/parameters.frontdoor.json
  - Connect-SelfService/src/Condeco.Connect.Fabric.SelfService.AzureDeploy/AzureDevOps/Templates/Variables/parameters.frontdoor.json
  - Connect-SelfService/src/Condeco.Connect.Fabric.SelfService/ClientSource/index.html
confidence: high
related: []
---

# Investigation: NCLCON-13451 — Implement CSP in Self Service and Admin Portal

## Symptom
Both portals serve `Content-Security-Policy: frame-ancestors 'self'` only.
This single directive blocks clickjacking via framing but provides no XSS or data-injection
mitigation. The vulnerable instance is https://connectv2-qa.condecodev.com/portal/

## Prior Attempt History (CRITICAL — tribal knowledge)
Two rounds of CSP hardening in both repos, both reverted:

### devicehub-adminportal
- **NCLCON-12867** (`97a800f`) — comprehensive CSP added, then reverted (`2f4dc74`)
- **NCLCON-13049** (`4a3e505`) — second attempt, merged PR #71, then REVERTED (`a6cc929`, PR #74, 2026-09-16)
  - Reverted because: `script-src 'self'` without connect-src/frame-src/style-src broke:
    1. MSAL B2C login (XHR to `*.b2clogin.com` blocked)
    2. Power BI Reports iframe (frame-src `app.powerbi.com` not allowed)
    3. styled-components v5 runtime style injection (style-src blocked)
  - The `index.html` is CLEAN — no inline scripts (React build outputs external chunks only, verified in commit message)

### Connect-SelfService
- **NCLCON-12867** frontdoor changes, reverted (`e0df112b9`)
- CSP syntax fix for frame-ancestors quoting (`cd7f0b0ad`)

## Root Cause
**Where:** Azure Front Door ResponseRuleSet (parameters.frontdoor.json in both repos)
**What:** Only `frame-ancestors 'self'` is set — one directive, no XSS coverage
**Why reverted:** Prior fix applied `script-src 'self'` without:
  1. Auditing all external resources loaded by each app
  2. Adding correct connect-src/frame-src/style-src allowlists
  3. Addressing inline scripts in Connect-SelfService's index.html

## Shared Front Door Ruleset Constraint (CRITICAL)
Both portals' pipelines write to the SAME Front Door ruleset. Whichever pipeline deploys last
overwrites the previous CSP value. The CSP must therefore be the UNION of all external
dependencies from both portals, and must be set identically in both parameters.frontdoor.json files.

## Correct Fix per App

### devicehub-adminportal (React, react-scripts 5.0.1)
- Dev branch: `origin/develop`
- index.html: CLEAN — no inline scripts
- External dependencies requiring allowlist:
  - styled-components v5 → `style-src 'self' 'unsafe-inline'`
  - MSAL B2C: `connectv2qa.b2clogin.com` (QA), `*.b2clogin.com` pattern → `connect-src 'self' https://*.b2clogin.com https://*.msauth.net https://login.microsoftonline.com`
  - Power BI embed iframe → `frame-src https://app.powerbi.com`
  - font-src needs data: for any base64-encoded fonts in bundled CSS

Target CSP value for parameters.frontdoor.json:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src https://app.powerbi.com; frame-ancestors 'none'; connect-src 'self' https://*.b2clogin.com https://*.msauth.net https://login.microsoftonline.com; object-src 'none'; base-uri 'self'
```

### Connect-SelfService (Angular 12+, angular-oauth2-oidc)
- Dev branch: `origin/develop` (also `origin/Development`)
- index.html: HAS TWO INLINE SCRIPTS — must be extracted FIRST
  - Block 1 (lines 20-47): OIDC implicit callback handler (postMessage hash to parent iframe)
  - Block 2 (lines 48-69): Feedback button creator (opens ideas.eptura.com)
- External stylesheet CDNs (require style-src + font-src):
  - `https://fonts.googleapis.com` (2x stylesheet links)
  - `https://fonts.gstatic.com` (font files)
  - `https://cdnjs.cloudflare.com` (font-awesome, simple-line-icons)
  - `https://cdn.linearicons.com` (linear icons)
  - `https://cdn.jsdelivr.net` (Angular Material prebuilt theme)
- B2C auth via angular-oauth2-oidc: OIDC issuer fetched dynamically from API — likely `*.b2clogin.com`
  - Silent refresh iframe loads `document.baseURI` (same origin) → `frame-src 'self'` covers it
- Power BI dashboard: `https://app.powerbi.com/reportEmbed` → `frame-src 'self' https://app.powerbi.com`
- Angular inline styles: requires `style-src 'unsafe-inline'`

**Pre-condition:** Extract inline scripts from index.html before applying CSP:
  → Move lines 20-47 to `assets/js/oidc-callback.js`
  → Move lines 48-69 to `assets/js/feedback-button.js`
  → Replace inline blocks with `<script src="assets/js/oidc-callback.js"></script>` etc.

Target CSP value for parameters.frontdoor.json:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.linearicons.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.linearicons.com https://cdn.jsdelivr.net; frame-src 'self' https://app.powerbi.com; frame-ancestors 'none'; connect-src 'self' https://*.b2clogin.com https://login.microsoftonline.com; object-src 'none'; base-uri 'self'
```

## Common (Union) CSP — identical value in BOTH parameters.frontdoor.json
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.linearicons.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.linearicons.com https://cdn.jsdelivr.net; frame-src 'self' https://app.powerbi.com; frame-ancestors 'none'; connect-src 'self' https://*.b2clogin.com https://*.msauth.net https://login.microsoftonline.com; object-src 'none'; base-uri 'self'
```

## Test Coverage Required
- Login flow (B2C redirect + silent refresh) must work after CSP applied
- Power BI reports page must render iframe
- Styled-components (adminportal) must render correctly
- Angular Material + CDN fonts/icons must load (SelfService)
- Feedback button must open (SelfService) — now as external script

## Regression Test
Re-use the test structure from NCLCON-13049's deleted `src/security/csp-headers.test.ts` in adminportal.
Write equivalent for SelfService.

## Pattern
Applying `script-src 'self'` without first:
1. Auditing ALL external resources (CDN, auth, embeds)
2. Extracting any inline scripts from index.html
This breaks apps in QA and forces an emergency revert.

## Prevention
- Always run full QA regression (login, reports, CDN assets) before merging CSP changes
- CSP test file reads parameters.frontdoor.json and asserts multi-directive policy (prevents silent revert)
- Add `Here Be Dragons` entry for parameters.frontdoor.json in both repos
