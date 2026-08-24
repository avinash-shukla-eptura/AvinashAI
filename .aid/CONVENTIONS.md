# Conventions

Rules AI must follow when working in this repository.

## Authoring Skills and Rules

- DO follow existing SKILL.md YAML frontmatter patterns exactly (name, description, applyTo)
- DO NOT create skill files without the standard frontmatter block
- DO keep skill files under 500 lines — split complex skills into phases
- DO NOT hardcode protocol version numbers; read from `aid.json` or skill frontmatter
- DO name skill directories using `aid-<name>` kebab-case matching the install convention

## Authoring Memory Files

- DO name memory files with actual git-sourced dates: `YYYY-MM-DD-descriptive-name.md`
- DO NOT use sequential numbers or approximate dates as file names
- DO include the standard YAML frontmatter (type, tags, status, date, verified, source, confidence)
- DO mark init-generated entries with `source: init-scan`
- DO mark real investigations with `source: investigation`
- DO NOT exceed 15 memory files without archiving older ones

## Authoring .aid/ Knowledge Files

- DO write facts you can verify from code, config, or git — never infer or assume
- DO NOT say "formerly X" or "renamed from Y" without explicit evidence
- DO NOT leave placeholder TODO content — write real content or omit the section
- DO keep PROJECT.md under 50 lines, CONVENTIONS.md under 100 lines
- DO keep MEMORY.md under 200 lines — archive to memory/*.md when it grows

## JSON Config Files (aid.json, mcp.json)

- DO NOT modify the `version` field in `aid.json` — it is stamped by the installer
- DO NOT add MCP server entries without verifying the package name and version exist
- DO quote all MCP command args as JSON strings (no bare numbers)

## Git Conventions

- DO write commit messages in imperative mood ("Add feature" not "Added feature")
- DO keep commits atomic — one logical change per commit
- DO NOT commit `.aid-local/` contents (gitignored — contains private user data)
- DO NOT force push to main

## Security

- DO run Endor scan before shipping any change that touches `.mcp.json` or `mcp.json`
- DO NOT pin MCP server packages to versions with known CVEs
- DO NOT expose credential values in any committed file

## Testing

- DO write tests for new functionality before marking a PR as ready
- DO use the existing test helpers and factories — do not create new ones without reason
- DO NOT mock what you don't own — use integration tests for external service boundaries
- DO keep unit tests fast (under 100ms each) — move slow tests to integration suite
- DO name tests as "should [expected behavior] when [condition]"

## Documentation

- DO update MEMORY.md after significant investigations or architecture changes
- DO add JSDoc/docstrings to public functions and API endpoints
- DO NOT write documentation that restates the code — explain WHY, not WHAT
- DO keep API documentation co-located with the route definitions

## Deployment

- DO verify changes in staging before requesting production deploy
- DO NOT deploy on Fridays unless it's a critical hotfix
- DO check monitoring dashboards for 15 minutes after production deploy
- DO rollback immediately if error rate increases above baseline

## Security

- DO NOT commit secrets, tokens, API keys, or credentials
- DO NOT log PII (personally identifiable information) at INFO level or above
- DO validate all user input at the API boundary
- DO use parameterized queries — never construct SQL from user input
