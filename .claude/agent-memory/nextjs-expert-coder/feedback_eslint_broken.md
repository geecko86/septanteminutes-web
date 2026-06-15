---
name: feedback-eslint-broken
description: ESLint crashes with ajv TypeError before parsing any file — pre-existing environment issue, not a code problem
metadata:
  type: feedback
---

`yarn lint` crashes with `TypeError: Cannot set properties of undefined (setting 'defaultMeta')` in `@eslint/eslintrc`. This happens on ANY file, including untouched ones. It is a pre-existing dependency/environment issue (ajv version conflict in node_modules), not caused by code changes.

**Why:** Node 25 (Homebrew) + latest ajv version conflict with eslintrc's schema validation code.

**How to apply:** Do not waste time trying to fix lint errors from `yarn lint` — the command is broken at the infrastructure level. Use `npx tsc --noEmit` instead to validate TypeScript correctness. The build (`yarn build`) is the real gate.
