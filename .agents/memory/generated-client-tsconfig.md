---
name: Generated client TypeScript compatibility
description: Orval's generated fetch client uses Headers.entries(), which needs DOM.Iterable in the client library TypeScript lib list.
---

When generated API client typechecking reports that `Headers.entries()` is missing, include `dom.iterable` alongside `dom` in the client package's TypeScript `lib` configuration.

**Why:** The generated client is valid browser code, but TypeScript's DOM collection methods are not included by `dom` alone.

**How to apply:** Check the generated client package tsconfig before changing generated files or pinning a different codegen version.