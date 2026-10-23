# Reflex Assistant — Requirements

| | |
|---|---|
| **Status** | Draft for review. Nothing built. |
| **Owner** | Avinash Shukla (knowledge base and requirements) |
| **Date** | 2026-10-15 |
| **Target repos** | `eptura/reflex-platform` (chat API, Glasshouse UI, pgvector store), `eptura/reflex-harness` (assistant runtime), `eptura/ai-registry` (assistant agent definition) |
| **Jira** | To be filed under project `AIC` |

Evidence in this document was read from local clones of `reflex-platform`, `reflex-harness`,
`reflex-meta` and `ai-registry`, and from Confluence/Jira on 2026-10-15. Anything not verified
against a live system is marked **(unverified live)**.

---

## 1. Summary

Reflex Assistant is a chat assistant embedded in Glasshouse. Logged-in Glasshouse members ask
questions in plain English and get grounded, cited answers about Reflex only: how it works, how
to use it, and what is happening in the products they have access to. It refuses anything
outside Reflex.

## 2. Goals and non-goals

### Goals
- G1. Answer "how do I / what is / why did" questions about Reflex without a human.
- G2. Shorten onboarding for new contributors (conventions, PR targets, registry rules, markers).
- G3. Give self-service status answers on tickets and agent chains within the user's products.
- G4. Never answer outside the Reflex domain.
- G5. Never show a user data from a product they have not been granted.

### Non-goals (v1)
- Taking actions: no ticket creation, dispatch, approval, merge or re-run. The assistant is read-only.
- Replacing Glasshouse pages or Confluence documentation.
- Access for anyone without a Glasshouse login (no public, anonymous or machine-key chat).
- Languages other than English.

## 3. Users and access

### 3.1 Identity (as built today)
- Glasshouse authenticates with **Entra ID SSO** (MSAL in the SPA, `/auth/callback`).
- The platform API validates the Entra JWT against JWKS (`src/reflex/api/security.py`);
  `ENTRA_AUDIENCE` is the app client-id GUID.
- A `users` row is provisioned on first login, keyed on the immutable Entra `oid`
  (`src/reflex/core/user.py`). `is_active=false` blocks the user.
- `/api/me` returns the user and `is_admin`.

### 3.2 Roles (as built today)
| Role | Meaning in Reflex | Meaning in the assistant |
|---|---|---|
| `viewer` | Read-only | May chat; answers limited to granted products |
| `member` (default) | Normal product use | May chat; answers limited to granted products |
| `admin` | Control plane | May chat; answers across all products; may review chat logs |

### 3.3 Product access (as built today)
- Roles are global. Product access comes from `user_tenants` (`user_id, tenant, role, granted_by`),
  resolved by `resolve_tenant_scope` into a `TenantScope`.
- Admins resolve to all tenants. A user with no grants gets 403.
- Onboarded products: `reflex`, `devicehub`, `pcs`.

### 3.4 Access requirements
| ID | Requirement |
|---|---|
| AC-1 | The chat widget renders only for an authenticated Glasshouse session. |
| AC-2 | Every chat API call is authenticated server-side with the same Entra JWT dependency as other `/api` routes. Hiding the UI is not a control. |
| AC-3 | No session or invalid token → 401, no content. Inactive user → rejected. |
| AC-4 | The caller's `TenantScope` is resolved on every request and passed to retrieval and every live lookup. Filtering happens in the data layer, never in the prompt. |
| AC-5 | A user with an empty scope may still ask general Reflex questions (shared docs) but receives no product-specific content. |
| AC-6 | Machine API keys and `/mcp` callers cannot use the chat API in v1. |
| AC-7 | The assistant never returns more than the user could see in Glasshouse or Jira themselves. |

## 4. Scope of answers

### 4.1 In scope
- Reflex concepts: stages and agents (Piper, Sorty, Delphi, Atlas, Forge, Argus, Proof, Herald), chains, gates, markers, labels.
- Using Reflex: onboarding a product, dispatching through MCP, the developer manual, Glasshouse pages.
- Contributing: `ai-registry` structure, `agent.yaml` / `SKILL.md` rules, `registry.yaml` mirroring, PR targets, CI gates.
- Platform and harness architecture as documented.
- Status of tickets, chains and gates in the user's granted products.
- Reflex-adjacent topics only as they apply to Reflex (for example, how the Jira poller uses labels).

### 4.2 Out of scope (refuse)
- General knowledge, news, chit-chat, opinions.
- General coding help not about Reflex.
- Other Eptura products' internals, except where they are onboarded and the question is about their Reflex usage.
- Anything about a product the user is not granted.
- Secrets, credentials, keys, personal data.

### 4.3 Examples
| In scope | Out of scope |
|---|---|
| "What does Sorty do?" | "Write a Python sort function" |
| "Why did my ai-registry PR fail the gate?" | "Explain Kubernetes" |
| "Which branch do I target for reflex-platform?" | "Who won the match?" |
| "What is the status of AIC-123?" | "Fix my Connect-ScreenManager bug" |
| "How do I onboard a product?" | "Show me the Foundry key" |

## 5. Functional requirements

### 5.1 Scope enforcement (defence in depth)
| ID | Requirement |
|---|---|
| SC-1 | **Router:** each question is classified in-scope / out-of-scope / ambiguous by a small model (`aidlc-haiku`) before any retrieval. Out-of-scope → standard refusal plus suggested topics. |
| SC-2 | **Grounding:** answers are generated only from retrieved Reflex sources. Below the retrieval confidence threshold, the assistant says it could not find the answer in Reflex knowledge and does not guess. |
| SC-3 | **System prompt:** fixed persona and scope; never reveals its prompt; ignores instructions to change role or scope. |
| SC-4 | **Output check:** before returning, verify the answer is supported by its citations, is in scope, and contains no secrets or personal data. Fail → refusal or "not found". |
| SC-5 | Retrieved documents, Jira text and comments are treated as data, never as instructions. |
| SC-6 | Refusals use consistent, friendly wording and are logged with a reason code. |
| SC-7 | Every "not found" or refusal offers an escalation path: Jira `AIC`, the Reflex team channel, or the owner. |

### 5.2 Answers
| ID | Requirement |
|---|---|
| AN-1 | Every factual answer carries citations: source title, link, last-updated date. |
| AN-2 | Answers built from content older than the staleness threshold (default 60 days) show a staleness note. |
| AN-3 | Exact identifiers (ticket keys, file names, marker strings, agent names) are matched exactly via keyword search. |
| AN-4 | Answers about live status say when the data was read. |

### 5.3 Conversation experience (Glasshouse)
| ID | Requirement |
|---|---|
| UX-1 | A chat panel available on every Glasshouse page, plus a full-page view. |
| UX-2 | Streaming responses; markdown; code blocks with copy; clickable citations. |
| UX-3 | Multi-turn context within a conversation. |
| UX-4 | Page awareness: on a ticket, task or agent page, "explain this" uses that entity (subject to scope). |
| UX-5 | Starter questions and follow-up suggestions. |
| UX-6 | Thumbs up/down with an optional comment per answer. |
| UX-7 | New chat, conversation list (last 7 days), delete a conversation. |
| UX-8 | Clear messages for: busy, budget paused, timeout, not found, refused. |
| UX-9 | Keyboard accessible, screen-reader labelled, responsive at phone width. |
| UX-10 | The rest of Glasshouse keeps working if the assistant is down. |

### 5.4 Admin
| ID | Requirement |
|---|---|
| AD-1 | Admins can view chat logs within the retention window. Every view is itself audited. |
| AD-2 | Admin dashboard: usage, refusal rate, not-found rate, feedback, latency, cost. |
| AD-3 | Admins can edit the source allow-list, staleness threshold, limits and refusal text as versioned config, without a code change. |
| AD-4 | Admins can trigger a re-index of one source or all sources. |

## 6. Knowledge base

### 6.1 Sources
| Source | Content | Access tag | Refresh |
|---|---|---|---|
| `eptura/reflex-meta` | `.aid/knowledge/` (architecture, repos, glossary, platform, harness), `HANDOFF.md`, `planning/` | shared | On merge to `main` |
| `eptura/ai-registry` | `agents/*/agent.yaml`, `skills/*/SKILL.md`, `registry.yaml`, `products/*/product.yaml`, README/CONTRIBUTING | shared, except `products/<slug>/` tagged with that product | On merge to `main` |
| `eptura/reflex-platform` | `README.md`, `docs/`, `.aid/` knowledge files | shared | On merge to `develop` |
| `eptura/reflex-harness` | `README.md`, `MIGRATION.md`, `.aid/` knowledge files | shared | On merge to `develop` |
| Confluence **AEL** (AI Exploration Lab) | Developer manual, MCP setup guide, onboarding guide, PRDs, plans, research | allow-listed pages only; product-specific pages tagged with their product | Nightly |
| Confluence **QAE** | "QA Agents for Reflex" and allow-listed children | shared | Nightly |
| Jira **AIC** (AI Catalyst) | Reflex tickets, chain markers | `reflex` | Live, read-only |
| Jira **NCLCON** | DeviceHub tickets handled by Reflex | `devicehub` | Live, read-only |
| Jira **PCS** (Platform Core Services) | PCS tickets handled by Reflex | `pcs` | Live, read-only |
| Glasshouse / platform API | Task, chain, gate and agent status | per tenant | Live, read-only |

### 6.2 Exclusions
- Personal Confluence spaces.
- Pages marked draft or "do not share" (for example the production-readiness checklist), unless explicitly allow-listed.
- `agent_runner` (retired, not ours) and `vendor/` directories.
- `.env`, `*.bak`, secrets, Key Vault names with values, tokens, connection strings, tenant or customer data.
- Any repo or space not listed in 6.1.

### 6.3 Knowledge requirements
| ID | Requirement |
|---|---|
| KB-1 | Allow-list driven: a page or path is indexed only if listed (or labelled `reflex-assistant` in Confluence). |
| KB-2 | Each chunk stores: source, URL, path or page id, version or commit, last-updated, access tag (`shared` or a tenant), `embedding_model`. |
| KB-3 | Chunking: about 200 tokens with overlap, heading path prepended (the embedding model truncates at about 256 tokens). |
| KB-4 | Incremental re-index on merge for repos; nightly for Confluence; full rebuild weekly. |
| KB-5 | A secret scanner runs on every chunk before it is stored; a hit drops the chunk and alerts the owner. |
| KB-6 | Deleted or moved source content is removed from the index on the next sync. |
| KB-7 | Live Jira lookups use a read-only service identity, and results are filtered to the projects mapped to the user's tenants (`AIC=reflex`, `NCLCON=devicehub`, `PCS=pcs`). |

## 7. Architecture

### 7.1 Decision: Option A
The chat endpoint lives in `reflex-platform`, which owns authentication, tenant scope, storage
and audit. It dispatches each question to a dedicated **Reflex Assistant** agent hosted on
`reflex-harness`, which owns the model calls. The platform makes no LLM calls today, and that
stays true.

```
Glasshouse (chat panel)
   │  Entra JWT
   ▼
reflex-platform  /api/assistant/*
   ├─ Auth (existing JWT dependency) → Actor
   ├─ resolve_tenant_scope → TenantScope
   ├─ Rate limit / queue
   ├─ Retrieval: pgvector + tsvector, filtered by TenantScope
   ├─ Read-only live lookups (Jira, platform stores), filtered by TenantScope
   ├─ Chat store (Postgres) · Audit · Metrics
   │
   └─► reflex-harness: reflex-assistant pool
          ├─ Scope router (aidlc-haiku)
          ├─ Grounded answer (main Foundry alias)
          └─ Output check
        ◄── streamed answer + citations
```

### 7.2 Components
| Component | Repo | Responsibility |
|---|---|---|
| Chat API | `reflex-platform` | Endpoints, auth, scope, rate limits, streaming relay, storage, audit |
| Retrieval service | `reflex-platform` | Hybrid search over pgvector + tsvector with tenant filtering |
| Indexer | `reflex-platform` (job) | Ingest, chunk, scan, embed, upsert |
| Chat panel | `reflex-platform` (`src/glasshouse/web`) | UI |
| Reflex Assistant agent | `ai-registry` (definition), `reflex-harness` (runtime) | Routing, answering, output check |
| Purge job | `reflex-platform` | 7-day deletion |

Retrieval is done by the platform and passed to the agent as context, so tenant filtering
stays in one place and the agent never queries data directly.

### 7.3 Model and hosting
- Same as today's harness: **Claude on Azure AI Foundry**, through the existing aliases.
- Routing and scope classification: `aidlc-haiku`. Answers: the main Foundry alias.
- Prod depends on AIC-216 (Foundry resource and deployments) and AIC-209 (quota).

### 7.4 Embeddings
- **`all-MiniLM-L6-v2`**, run locally, as the harness already does (ChromaDB default in
  `reflex_harness/memory.py` and `investigation_index.py`). No data leaves the cluster for
  embedding.
- 384-dimension vectors; about 256-token input limit (see KB-3).
- `embedding_model` stored on every chunk so a later model change is a controlled re-embed.

### 7.5 Vector store
- **pgvector + tsvector** in the platform Postgres (Azure Flexible Server, PG 16), in line with
  the memory-service design in `reflex-meta/planning/meta-agent/design/memory-service.md`.
- HNSW index on the embedding column; GIN index on the tsvector column.
- **Prerequisite (not done):** `vector` is supported on Azure Flexible Server PG 16 but is not
  allow-listed today — `infra/terraform/data_services.tf` sets no `azure.extensions`
  parameter. Required:
  1. Terraform: allow-list `VECTOR` through `azure.extensions` in dev and prod.
  2. One-time `CREATE EXTENSION vector;` by the server admin login (the least-privilege logins
     in `infra/sql/roles.sql` cannot), recorded in `infra/sql/`.
  3. A short ADR: the platform docs state "Reflex holds no vector store"; this changes that.
- Live server parameter **(unverified live)**.

### 7.6 Data model (conceptual)
| Entity | Key fields |
|---|---|
| `assistant_conversation` | id, user_id, created_at, last_message_at |
| `assistant_message` | id, conversation_id, role (user/assistant), text, created_at, tenant_scope_snapshot |
| `assistant_citation` | message_id, chunk_id, url, title, last_updated |
| `assistant_feedback` | message_id, user_id, rating, comment, created_at |
| `kb_chunk` | id, source, url, path, version, last_updated, access_tag, text, tsv, embedding vector(384), embedding_model |
| `kb_source` | id, type, location, allow-listed, last_synced, status |
| Audit (existing audit log) | actor, action, timestamp, sources used, refusal reason — no message text |

## 8. Capacity and limits

The assistant runs in its own harness pool so chat never queues behind long agent runs and
never spends a product's budget. All values are config and should be tuned after a week of
metrics.

| Control | Value |
|---|---|
| Deployment | Dedicated `reflex-assistant` harness pool with its own KEDA scaler |
| Replicas | Minimum 1 (always warm), maximum 3 |
| Per replica | 4 chats in progress |
| System-wide | 12 chats in progress |
| Queue | 20 waiting; wait over 15 s → "busy, please retry" |
| Per user | 1 chat in progress; 20 messages per 10 minutes |
| Per answer | 60 s timeout; at most 5 retrieval or lookup calls; capped output length |
| Budget | Own cost bucket, not charged to any product's `budget_usd_monthly`; daily cap; alert at 80%; pause at 100% with a clear message |
| Model quota | The 12 concurrent chats are counted in the Claude TPM request under AIC-209 |

Sizing basis: about 200 users, about 25% active at peak (about 50 people), 1 to 3 messages per
minute each, 5 to 8 s per answer → 6 to 10 chats in progress; 12 gives headroom.

## 9. Retention and privacy
| ID | Requirement |
|---|---|
| RP-1 | Each message (and its answer, citations and feedback) is deleted **7 days after the day it was sent**, by a daily purge job. |
| RP-2 | A conversation is deleted when its last message is purged. |
| RP-3 | Only admins can read other users' chats. Each such read is audited. |
| RP-4 | Users can delete their own conversations at any time. |
| RP-5 | Audit events hold no message text and follow the platform audit retention. |
| RP-6 | Personal data and secrets are redacted from questions before storage and model calls. |
| RP-7 | Message text is never written to application logs or traces. |

## 10. Security
| ID | Requirement |
|---|---|
| SE-1 | Threat model covering jailbreaks, prompt injection through documents and tickets, cross-tenant leakage, exfiltration through crafted questions, and token theft. |
| SE-2 | Tenant filtering is enforced by the platform's required `scope` argument on every store read, the same pattern as existing stores. |
| SE-3 | The assistant agent has no write tools and no network access beyond Foundry and the platform. |
| SE-4 | Output scanning for secrets and personal data before display. |
| SE-5 | The indexer's secret scan (KB-5) before storage. |
| SE-6 | Endor scan for any new dependency (for example the pgvector client or ONNX runtime). |
| SE-7 | Security review before production; covered by the same ruling as the existing Foundry use (AIC-223). |

## 11. Non-functional requirements
| Area | Target |
|---|---|
| Latency | First token under 2 s at p95; typical full answer under 10 s |
| Availability | 99.5% in business hours; Glasshouse unaffected by assistant outages |
| Accuracy | At least 90% correct and cited on the golden set |
| Scope | At least 98% of out-of-scope prompts refused; under 5% of in-scope prompts wrongly refused |
| Isolation | Zero cross-tenant results in access tests |
| Observability | Per-request trace: route decision, retrieval hits and scores, tokens, latency, cost, refusal reason (no message text) |
| Config | Prompts, scope rules, allow-list and limits versioned outside code |

## 12. Testing and evaluation
| ID | Requirement |
|---|---|
| TE-1 | Golden set: about 150 in-scope questions with expected sources, and about 100 out-of-scope and adversarial prompts. |
| TE-2 | The eval suite runs in CI whenever prompts, scope rules, allow-list or the index pipeline change; it blocks on regression. |
| TE-3 | Access tests: users with grants for one, two and no products, plus an admin; assert no cross-tenant content. |
| TE-4 | Red-team pass: jailbreaks, injection planted in a test Confluence page and a test Jira comment. |
| TE-5 | Load test at 12 concurrent chats and a queue of 20; verify the busy and budget paths. |
| TE-6 | Purge test: a message older than 7 days is gone, and its audit event remains. |
| TE-7 | UAT with 5 to 10 Glasshouse members across roles and products. |

## 13. Success measures
- Weekly active users as a share of Glasshouse users.
- Thumbs-up rate of 80% or more.
- Citation coverage of 95% or more.
- Fewer repeat how-to questions to the Reflex team.
- Cost per conversation within the daily cap.

## 14. Delivery phases
| Phase | Scope | Exit |
|---|---|---|
| 0 Prerequisites | pgvector allow-listed and created; ADR agreed; source allow-list agreed | Extension present in dev |
| 1 MVP | Auth-gated chat, shared docs only, router, citations, refusals, 7-day purge, audit, dedicated pool and limits | Golden set at target in dev |
| 2 Product data | Tenant-tagged content, live Jira and status lookups, page awareness, feedback, admin dashboard | Access tests pass |
| 3 Hardening | Red-team, load test, budget controls, security review | Security sign-off |
| 4 Production | Depends on AIC-216 and AIC-209 | Prod smoke and UAT pass |

## 15. Decisions
| # | Decision |
|---|---|
| D1 | Option A: chat API in `reflex-platform`, answers from a harness-hosted Reflex Assistant agent |
| D2 | Entra SSO JWT; `users.role` plus `user_tenants` scope |
| D3 | Claude on Azure AI Foundry through the existing harness aliases |
| D4 | `all-MiniLM-L6-v2` local embeddings |
| D5 | pgvector + tsvector in the platform Postgres |
| D6 | Answers filtered by product access; admins see all |
| D7 | Messages deleted 7 days after the day sent; admins only may review |
| D8 | Sources as in section 6.1 |
| D9 | English only at launch |
| D10 | Knowledge base owned by Avinash Shukla |
| D11 | Dedicated harness pool with the limits in section 8 |

## 16. Dependencies, risks and open items

### Dependencies
- AIC-216 (prod Foundry resource and deployments), AIC-209 (quota) — for production.
- AIC-223 (Security ruling) — for production.
- pgvector enablement (section 7.5) — for phase 1.

### Risks
| Risk | Mitigation |
|---|---|
| Wrong or invented answers | Grounding, mandatory citations, "not found" fallback, eval gate |
| Off-topic use | Router, prompt rules, output check, refusal monitoring |
| Cross-tenant leakage | Scope enforced in the data layer, access tests |
| Prompt injection through docs or tickets | Data/instruction separation, output check, red-team |
| Stale documentation | Refresh on merge, staleness notes |
| Single owner of the knowledge base | Automated refresh; name a backup owner |
| Chat load competing for model quota | Dedicated pool, caps, own budget |
| Small embedding model misses exact terms | Hybrid keyword search, exact-match path |

### Open items
- O1. Confirm the live `azure.extensions` value on the Reflex Postgres server.
- O2. Name a backup owner for the knowledge base.
- O3. Set the daily cost cap value.
- O4. Agree the initial AEL and QAE page allow-list.
