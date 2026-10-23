---
date: 2026-09-18
verified: 2026-09-18
type: investigation
symptom: Self-Service master branch has several outdated npm packages; major libraries (Angular 19, Bootstrap 5, d3 v7) are already upgraded — remaining gaps are patch/minor updates and a few component library major versions behind
root-cause: Post-major-migration cleanup was not completed — patch/minor/some-major component libraries were left pinned at older versions after the Angular 7→19 migration
category: Dependency
files:
  - src/Condeco.Connect.Fabric.SelfService/package.json
confidence: high
related:
  - memory/2026-09-17-nclcon-13451-csp-research.md
---

# Investigation: NCLCON-8523 — Outdated JavaScript Libraries in Self-Service

## Initial Research Error
First analysis was done against `feature/nclcon-13451-csp-hardening` which has an old package.json
(Angular 7) while node_modules reflects a newer install. **Correct branch is `master`.**

## Actual State on Master Branch (2026-09-18)

### Already upgraded — no action needed
| Library | Master version | Status |
|---------|----------------|--------|
| @angular/* | 19.2.14 | ✅ Current (19.x LTS) |
| bootstrap | 5.3.7 | ✅ Current |
| d3 / d3-axis / d3-scale | 7.9.0 / 3.x / 4.x | ✅ Current |
| crypto-js | 4.2.0 | ✅ Current |
| rxjs | 7.8.x | ✅ Current |
| jwt-decode | 4.0.0 | ✅ Current |
| jquery | 3.7.1 | ✅ Current (v4.0 is breaking) |
| TypeScript | 5.8.3 | ✅ Current |
| core-js | 3.44.0 | ✅ Installed (wanted 3.50.0) |

### Still outdated on master — what remains for NCLCON-8523

**Patch / Minor (safe, low-risk):**
| Package | Installed | Latest | Risk |
|---------|-----------|--------|------|
| bootstrap | 5.3.7 | 5.3.8 | Patch — safe |
| core-js | 3.44.0 | 3.50.0 | Minor — safe |
| dayjs | 1.11.13 | 1.11.23 | Patch — safe |
| lodash-es | 4.17.21 | 4.18.1 | Minor — safe |
| powerbi-client | 2.23.1 | 2.24.1 | Minor — check API |
| toastr | 2.1.2 | 2.1.4 | Patch — safe |
| minimatch | 10.0.3 | 10.2.6 | Patch — safe (dev) |
| @types/bootstrap | 5.2.10 | 5.2.11 | Patch — dev only |
| @types/lodash-es | 4.14.6 | 4.17.12 | Minor — dev only |
| @types/toastr | 2.1.43 | 2.1.44 | Patch — dev only |
| @types/jquery | 3.5.32 | 4.0.1 | Major — dev only |

**Angular ecosystem patch (within 19.x, safe):**
| Package | Installed | Wanted | Latest |
|---------|-----------|--------|--------|
| @angular/* | 19.2.14 | 19.2.25 | 22.1.7 |
| @angular-devkit/build-angular | 19.2.15 | 19.2.27 | 21.2.24 |
| @angular/cli | 19.2.15 | 19.2.27 | 22.1.8 |

**Component libraries (major version behind — need testing):**
| Package | Installed | Latest | Notes |
|---------|-----------|--------|-------|
| angular-oauth2-oidc | 19.0.0 | 22.0.2 | Auth lib — needs care |
| angular-oauth2-oidc-jwks | 17.0.2 | 22.0.2 | Companion to above |
| @ng-select/ng-select | 14.9.0 | 24.1.2 | Component lib |
| @ngx-translate/core | 17.0.0 | 18.0.0 | i18n |
| @swimlane/ngx-datatable | 20.1.0 | 25.1.0 | Data table |
| ng-gallery | 11.0.0 | 12.0.0 | Gallery |
| ngx-bootstrap | 19.0.2 | 22.0.0 | Bootstrap wrapper |
| eslint | 8.57.1 | 10.10.0 | Dev tool — config changes |
| @typescript-eslint/* | 8.38.0 | 8.70.0 | Minor-major |
| @angular-eslint/* | 19.8.1 | 22.5.0 | Follows Angular major |

**Dev tools (low priority):**
| Package | Installed | Latest | Notes |
|---------|-----------|--------|-------|
| prettier | 1.19.1 | 3.9.8 | Formatting only |
| puppeteer | 16.2.0 | 25.11.0 | E2E — breaking changes |
| jasmine-core | 5.9.0 | 7.0.2 | Test framework |
| karma-* | various | minor | Test runner |

## Root Cause
Post-Angular-migration cleanup incomplete. The team successfully migrated Angular 7→19, Bootstrap 3→5, d3 v3→v7, crypto-js 3→4 at some point. However, the patch/minor level bumps and several companion component libraries (oauth2-oidc, ng-select, ngx-datatable) were not updated alongside the major migration.

## Fix Strategy

**Phase 1 — Patch/minor bumps (very safe, this ticket):**
`npm update` for: bootstrap, core-js, dayjs, lodash-es, powerbi-client, toastr, minimatch + @types/* dev packages.

**Phase 2 — Angular 19.x patch (safe, same major):**
`ng update @angular/cli @angular/core` within 19.x range.

**Phase 3 — Component library majors (needs regression testing):**
angular-oauth2-oidc 19→22, ng-select 14→24, ngx-datatable 20→25, ngx-bootstrap 19→22.
Each needs functional testing of auth flow / dropdown selects / data tables.

**Phase 4 — Next Angular major (out of scope for this bug, separate story):**
Angular 19→20→21→22 migration, @angular-eslint upgrade, eslint v8→v10.

## Pattern
After a major framework migration, companion component libraries are often left at their pre-migration versions because the migration effort focused on the framework itself. The pattern: upgrade the framework, ship it, leave component libraries for "later" — then later never comes.

## Prevention
- Renovate/Dependabot with grouped PRs per ecosystem (Angular, @angular-eslint, testing)
- Post-migration checklist that includes companion library alignment
