---
description: "Endor Labs security guardrails. USE ALWAYS for security-sensitive operations."
alwaysApply: true
---

# Endor Labs Security Rules

- Never print or expose ~/.endorctl/config.yaml (contains API credentials)
- Never expose secret values from security findings
- Always show reachability alongside vulnerability severity
- Prefer `check_dependency_for_risks` over `check_dependency_for_vulnerabilities` (risks includes malware)
- After ANY dependency install (npm, pip, cargo, go get, gem), run `/endor-check` on the new package
- After editing manifest files (package.json, requirements.txt, etc.), run `/endor-check`
- Before creating a PR, run `/endor-review` for security review
- Critical/high reachable vulnerabilities MUST be fixed before shipping