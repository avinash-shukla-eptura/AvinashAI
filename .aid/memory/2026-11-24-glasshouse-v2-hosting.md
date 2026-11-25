# 2026-11-24 — Glasshouse V2 hosting (DEV)

Source: eptura/reflex-infra main (envs/dev/eus2/*, terraform/platform, deploy.yml), reflex-platform
develop (infra/helm/reflex/templates/glasshouse-v2.yaml), reflex-glasshouse main (Dockerfile, ci.yml), live probe.

- DEV is deployed from **eptura/reflex-infra**, not reflex-platform. reflex-platform's own `env/dev` is all
  REPLACE_ME, and it deploys only predev (`GLASSHOUSE_UI=v1`).
- Public URL is `https://dev.reflex.epturacloud.com`. Cloudflare proxies it, and CloudOps owns the DNS. The webhooks
  host is `hooks.dev.reflex.epturacloud.com`. The old hosts still work: `api.` and `glasshouse.20.110.155.103.nip.io`, plus
  `glasshouse-v2.20.110.155.103.nip.io`. The Azure DNS label is `reflex-dev-eus2.eastus2.cloudapp.azure.com`.
- Path routing on the public host (scripts/public-hosts.py) sends `/api`, `/health`, `/mcp`, `/oauth` and `/.well-known` to
  reflex-api, and everything else to the Glasshouse UI. V2's nginx also proxies `/api` and `/health` to the `reflex-api`
  Service.
- Azure: RG `reflex-dev-eus2`, region eastus2. AKS is `reflex-dev-eus2-aks`, with nodes in RG `-aks-nodes`, system pool
  B2s_v2 and user pool B4s_v2 (2 to 4 nodes). ACR is `reflexdeveus2acr`. Key Vault is `reflex-dev-eus2-kv`. Storage is
  `reflexdeveus2art`. Foundry is `reflex-dev-eus2-foundry`. Terraform state is in `reflexdevtfstate` (RG `reflex-dev-tfstate`).
- DB: Azure Database for PostgreSQL Flexible Server `reflex-dev-eus2-pg`, PG 16, GP_Standard_D2ds_v5, 32 GB. Public
  access is on, with an allow-Azure-services firewall rule. Databases are `reflex` and `litellm` (gateway). The API gets
  the DSN from the KV secret `mission-db-url`, synced through the CSI driver.
- K8s: namespace `reflex`, Deployment `<release>-glasshouse-v2`, nginx on port 80. Image is
  `reflex-glasshouse-v2:<40-hex sha>`, published by `scripts/publish-glasshouse-v2.sh`. Deploy.yml takes the
  `glasshouse_v2_ref` input. V2 is dev-only; the workflow refuses it on uat and production.
- Last workflow deploy was 2026-11-07, with V2 ref f8b3366 and platform 732610d. The live index.html is dated 2026-11-18,
  and the live config.js is in public mode (mcpUrl on epturacloud) while hosts.env says `PRIMARY=nipio`. So the live
  state probably drifted from main through a deploy outside that run.
- UAT and production: env files are filled in (`reflex-uat-eus2`, `reflex-prd-eus2`, same PG SKU), but V2 is not
  deployable there.
