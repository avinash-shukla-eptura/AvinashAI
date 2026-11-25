/**
 * lib/signals.js
 *
 * Contract-surface signal extraction. The SAME patterns are used for:
 *   - PR diffs (added AND removed lines — removals are likely breaks), and
 *   - the system-map scan (git grep -F keyword prefilter, then these regexes,
 *     because git grep's ERE has no \s or (?:) support).
 *
 * role: exposes (this repo provides it) | consumes (depends on it) | uses (shared resource)
 */

// ─── Patterns ─────────────────────────────────────────────────────────────────

export const PATTERNS = {
  dotnet: [
    { kind: 'http-route',  role: 'exposes',  re: /Route\s*=\s*"([^"]+)"/g },
    { kind: 'http-route',  role: 'exposes',  re: /\[(?:Http(?:Get|Post|Put|Delete|Patch)|Route)\(\s*"([^"]+)"/g },
    { kind: 'sb-consume',  role: 'consumes', re: /ServiceBusTrigger\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g },
    { kind: 'sb-produce',  role: 'exposes',  re: /CreateSender\(\s*"([^"]+)"/g },
    { kind: 'cosmos',      role: 'uses',     re: /GetContainer\(\s*[^,()]+,\s*"([^"]+)"/g },
    { kind: 'cosmos',      role: 'uses',     re: /CosmosDBTrigger\(\s*(?:databaseName:\s*)?"[^"]+"\s*,\s*(?:containerName:\s*)?"([^"]+)"/g },
    { kind: 'package-ref', role: 'consumes', re: /PackageReference\s+Include="(Condeco\.[^"]+)"/g },
    { kind: 'package-id',  role: 'exposes',  re: /<PackageId>([^<]+)<\/PackageId>/g },
  ],
  python: [
    { kind: 'http-route',  role: 'exposes',  re: /@(?:app|router)\.(?:get|post|put|delete|patch)\(\s*["']([^"']+)/g },
    { kind: 'model',       role: 'exposes',  re: /class\s+(\w+)\((?:BaseModel|BaseSettings)\)/g },
    { kind: 'env',         role: 'uses',     re: /os\.(?:environ\.get|getenv)\(\s*["']([A-Z0-9_]+)/g },
    { kind: 'env',         role: 'uses',     re: /os\.environ\[\s*["']([A-Z0-9_]+)/g },
  ],
};

export const FILE_RULES = {
  dotnet: [/\.bicep$/i, /appsettings.*\.json$/i, /local\.settings\.json$/i, /(^|\/)Migrations\//, /\.sql$/i, /(swagger|openapi).*\.(json|ya?ml)$/i],
  python: [/\.tf$/i, /(^|\/)(alembic|migrations)\//, /SKILL\.md$/, /AGENTS\.md$/, /permissions\.py$/],
};

export const GREP_KEYWORDS = {
  // Must stay a superset of PATTERNS: a line no keyword matches never reaches extraction.
  dotnet: ['Route', 'HttpGet', 'HttpPost', 'HttpPut', 'HttpDelete', 'HttpPatch', 'ServiceBusTrigger', 'CreateSender', 'GetContainer', 'CosmosDBTrigger', 'PackageReference', 'PackageId'],
  python: ['@app.', '@router.', 'BaseModel', 'BaseSettings', 'environ', 'getenv'],
};

// Diff-only: changed leaf keys in JSON config files become searchable signals
// (a key opening an object/array is structure, not a setting).
export const CONFIG_FILES = /(appsettings.*|local\.settings)\.json$/i;
const CONFIG_KEY = /^\s*"([A-Za-z_][\w.:-]*)"\s*:\s*(?![\s{[])/;
const MAX_SOURCE = 200;

// ─── Extraction ───────────────────────────────────────────────────────────────

export const extractFromLine = (line, stack) => {
  const out = [];
  for (const { kind, role, re } of PATTERNS[stack] ?? []) {
    for (const m of line.matchAll(re)) {
      for (const value of m.slice(1)) if (value) out.push({ kind, value, role });
    }
  }
  return out;
};

export const extractFromDiff = (diff, stack) => {
  const out = [];
  const seen = new Set();
  // `source` keeps old/new detail (GET vs POST, package version, setting value)
  // and is part of the dedupe key so distinct contracts sharing a value survive.
  const push = (s) => {
    const k = `${s.kind}|${s.value}|${s.change}|${s.file}|${s.source ?? ''}`;
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  };
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      const m = line.match(/ b\/(.+)$/);
      file = m ? m[1].trim() : null;
      if (file && (FILE_RULES[stack] ?? []).some(r => r.test(file))) {
        push({ kind: 'file', value: file, role: 'uses', change: 'modified', file });
      }
      continue;
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    const change = line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : null;
    if (!change || !file) continue;
    const source = line.slice(1).trim().slice(0, MAX_SOURCE);
    for (const s of extractFromLine(line.slice(1), stack)) push({ ...s, change, file, source });
    const key = CONFIG_FILES.test(file) && line.slice(1).match(CONFIG_KEY);
    if (key) push({ kind: 'config-key', value: key[1], role: 'uses', change, file, source });
  }
  return out;
};
