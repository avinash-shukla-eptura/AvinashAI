---
paths:
  - "src/api/**"
  - "src/routes/**"
activation: auto
---

# API Route Rules

<!-- This is an example path-scoped rule file. -->
<!-- Rules in this file only apply when AI is working on files matching the paths above. -->
<!-- Create separate rule files for different areas of the codebase. -->

<!-- activation modes: -->
<!--   auto    — loaded automatically when matching files are in context -->
<!--   manual  — only loaded when explicitly referenced -->
<!--   always  — loaded every session regardless of file context -->

## Rules

- Every route handler MUST validate request body using the shared schema validator
- Every route MUST return standardized error responses using `ApiError` class
- DO NOT put business logic in route handlers — delegate to service layer
- Every new endpoint MUST have a corresponding integration test in /test/integration/api/
- Rate limiting is applied at the middleware level — do not implement per-route rate limits

## Patterns

```
// Standard route handler pattern:
router.post('/resource', validate(createResourceSchema), async (req, res, next) => {
  try {
    const result = await resourceService.create(req.body, req.user);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});
```
