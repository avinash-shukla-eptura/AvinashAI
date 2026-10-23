# Onboarding a Product to Reflex

## What is it?

Reflex is Eptura's system where AI agents help deliver work, from writing requirements to code, review, testing and release. Onboarding means connecting a product (such as DeviceHub or PCS) so these agents can work on it.

## Who is already onboarded?

- **Reflex**
- **DeviceHub**
- **PCS**

## What you need before you start

- A name for the product (lowercase, no spaces, e.g. `pcs`)
- A private GitHub repo holding the product's knowledge, e.g. `eptura/pcs-meta`
- The list of code repos the agents will work on, and the main branch of each
- A Jira project for the product
- The technology stack (.NET + Angular, Python + Node, or Node)

## The steps

1. **Register the product.** Add one file, `products/<name>/product.yaml`, to the `ai-registry` repo and open a pull request. Once it is merged, Reflex connects the agents automatically.
2. **Set up the infrastructure.** The platform team generates the deployment files and creates the secrets and access the agents need.
3. **Set up the product's account in Reflex.** Create the product, set its monthly budget and choose who approves agent work. Do this before the first task, because without it agents run with no budget limit and no approvers.
4. **Connect Jira.** Link the Jira project so tickets with Reflex labels are picked up by the agents.
5. **Test it.** Run one ticket from start to finish and confirm it works.

## Who does what

| Person | Role |
|---|---|
| Product owner | Provides the repos and the Jira project, and runs the final test |
| Registry maintainer | Registers the product (step 1) |
| Platform team | Infrastructure, secrets, product account and Jira connection (steps 2–4) |

## Good to know

- Agents work on a ticket in stages, driven by Jira labels like `reflex:plan`.
- Repos under `eptura/*` always need a human to approve each task.
- Never put passwords or keys in any file. Secrets go in Key Vault only.

## Need help?

Ask the Reflex platform team, or see the detailed guide in `reflex-meta`: `.aid/knowledge/onboarding-a-product.md`.
