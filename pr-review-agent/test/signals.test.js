import { test }   from 'node:test';
import assert     from 'node:assert/strict';
import { extractFromDiff } from '../lib/signals.js';

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
