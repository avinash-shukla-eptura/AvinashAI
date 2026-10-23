# Meta Repository Guide (e.g. devicehub-meta)

## What is a meta repo?

A meta repo is a **knowledge repo for a product**. It holds no product code. It holds what people and AI agents need to understand the product: how it is built, how it is released, how to run and test it, and which repos it is made of.

Example: `devicehub-meta` describes DeviceHub, which is made of about 60 separate repos.

## Why does it matter for Reflex?

When a product is onboarded to Reflex, its meta repo is the `knowledge_repo` in `product.yaml`. Reflex agents read it at the start of every task, so they learn the product from it.

## What is inside?

| Item | What it is for |
|---|---|
| `README` / `AGENTS.md` | Entry point and rules for AI agents working here |
| `.aid/PROJECT.md` | What the product is and why it exists |
| `.aid/ARCHITECTURE.md` | How the services fit together |
| `.aid/CONVENTIONS.md` | Coding and team rules |
| `.aid/MEMORY.md` | Lessons learned and important findings |
| `.aid/knowledge/` | Topic guides: product, architecture, release, operations, QA, team, glossary, repo list |
| `.aid/memory/` | Dated notes from past investigations |
| `.aid/delivery.yaml` | Which Jira project and board new tickets go to |
| `.aid/observability.yaml` | What to watch in production (optional) |
| `repos/` and `repos.json` | The list of the product's repos (linked as submodules) |

## How to create one for a new product

1. Create a **private** GitHub repo named `<product>-meta` under `eptura`.
2. Add the repo list of the product's code repos, with the main branch of each.
3. Add the basics: what the product is, how it is built, how it is released, how to test it.
4. Add `delivery.yaml` with the Jira project and board.
5. Add `observability.yaml` only if you want production monitoring.
6. Give the repo to the platform team so it can be named in `product.yaml` during Reflex onboarding.

## How to keep it healthy

- Update it when the product changes (new repo, new release process, new lesson learned).
- Record what you learn in `.aid/memory/` with the date in the file name.
- Never store passwords, keys or tokens in it.
- Treat it as an index: link to Confluence and the code repos instead of copying them.

## Need help?

Look at `devicehub-meta` or `reflex-meta` as working examples, or ask the Reflex platform team.
