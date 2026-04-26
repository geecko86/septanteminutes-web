---
name: ESLint rule availability
description: Which ESLint rules are and are not configured in this project
type: feedback
---

`@typescript-eslint/no-explicit-any` is NOT installed/configured in this project.
Using `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments causes build failures
("Definition for rule was not found" = ESLint treats unknown rules as errors).

**Why:** The project uses a minimal ESLint config — only the Next.js built-in rules are active.
**How to apply:** Never add eslint-disable comments for rules not in the project's eslint config.
Check `.eslintrc*` or the `eslintConfig` key in package.json before adding any disable comment.
