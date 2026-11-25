import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { extractFromDiff, extractFromLine, GREP_KEYWORDS } from '../lib/signals.js';

const DOTNET_DIFF = `diff --git a/src/BookingFunction.cs b/src/BookingFunction.cs
--- a/src/BookingFunction.cs
+++ b/src/BookingFunction.cs
@@ -10,3 +10,3 @@
-    [HttpTrigger(AuthorizationLevel.Function, "get", Route = "bookings/{id}")] HttpRequest req,
+    [ServiceBusTrigger("booking-events", "sub")] string message,
diff --git a/src/appsettings.json b/src/appsettings.json
--- a/src/appsettings.json
+++ b/src/appsettings.json
@@ -1,1 +1,1 @@
-  "Timeout": 10
+  "Timeout": 20
`;

test('dotnet: added SB trigger, removed route, config file signal', () => {
  const s = extractFromDiff(DOTNET_DIFF, 'dotnet');
  assert.ok(s.some(x => x.kind === 'sb-consume' && x.value === 'booking-events' && x.change === 'added'));
  assert.ok(s.some(x => x.kind === 'sb-consume' && x.value === 'sub'));
  assert.ok(s.some(x => x.kind === 'http-route' && x.value === 'bookings/{id}' && x.change === 'removed'));
  assert.ok(s.some(x => x.kind === 'file' && x.value === 'src/appsettings.json'));
});

const PY_DIFF = `diff --git a/app/api.py b/app/api.py
--- a/app/api.py
+++ b/app/api.py
@@ -1,0 +1,3 @@
+@router.post("/tasks")
+class TaskIn(BaseModel):
+token = os.getenv("REFLEX_TOKEN")
`;

test('python: route, model and env signals', () => {
  const s = extractFromDiff(PY_DIFF, 'python');
  assert.deepEqual(s.map(x => `${x.kind}:${x.value}`).sort(),
    ['env:REFLEX_TOKEN', 'http-route:/tasks', 'model:TaskIn']);
});

test('README-only diff yields no signals', () => {
  const diff = `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,1 +1,1 @@
-old
+new
`;
  assert.deepEqual(extractFromDiff(diff, 'dotnet'), []);
  assert.deepEqual(extractFromDiff(diff, 'python'), []);
});

test('GREP_KEYWORDS prefilter matches every line extractFromLine recognizes', () => {
  const samples = {
    dotnet: [
      '[HttpGet("bookings/{id}")]', '[HttpPost("rooms")]', '[HttpPut("a")]', '[HttpDelete("b")]', '[HttpPatch("c")]',
      '[Route("api/x")]', 'Route = "api/y"', '[ServiceBusTrigger("q")]', 'client.CreateSender("t")',
      'GetContainer(db, "c1")', 'CosmosDBTrigger("db", "c2")',
      '<PackageReference Include="Condeco.Core" />', '<PackageId>Condeco.X</PackageId>',
    ],
    python: [
      '@app.get("/x")', '@router.post("/y")', 'class A(BaseModel):', 'class S(BaseSettings):',
      'os.environ.get("K")', 'os.getenv("K")', 'os.environ["K"]',
    ],
  };
  for (const [stack, lines] of Object.entries(samples)) {
    for (const line of lines) {
      assert.ok(extractFromLine(line, stack).length > 0, `pattern should match: ${line}`);
      assert.ok(GREP_KEYWORDS[stack].some(k => line.includes(k)), `prefilter misses: ${line}`);
    }
  }
});

test('config-only diff yields changed leaf keys with old/new source', () => {
  const diff = `diff --git a/src/appsettings.json b/src/appsettings.json
--- a/src/appsettings.json
+++ b/src/appsettings.json
@@ -1,4 +1,4 @@
   "Values": {
-    "RetryCount": 3,
+    "RetryCount": 5,
+    "Nested": {
`;
  const keys = extractFromDiff(diff, 'dotnet').filter(x => x.kind === 'config-key');
  assert.deepEqual(keys.map(k => `${k.change}:${k.value}:${k.source}`),
    ['removed:RetryCount:"RetryCount": 3,', 'added:RetryCount:"RetryCount": 5,']);
});

test('GET->POST on the same route keeps both distinct signals with source', () => {
  const diff = `diff --git a/src/C.cs b/src/C.cs
--- a/src/C.cs
+++ b/src/C.cs
@@ -1,1 +1,1 @@
-[HttpGet("rooms")]
+[HttpPost("rooms")]
+[HttpPut("rooms")]
`;
  const r = extractFromDiff(diff, 'dotnet').filter(x => x.value === 'rooms');
  assert.deepEqual(r.map(x => `${x.change}:${x.source}`),
    ['removed:[HttpGet("rooms")]', 'added:[HttpPost("rooms")]', 'added:[HttpPut("rooms")]']);
});
