---
name: Yarn engine check workaround
description: Yarn (Homebrew) picks up /usr/bin/env node (Node 25) not nvm's Node 22 — use .yarnrc ignore-engines
type: feedback
---

Yarn is installed via Homebrew and resolves `node` through `/usr/bin/env`, which returns Node 25 (Homebrew), not the Node 22 active via nvm. Running yarn commands with `nvm use` in the same shell does NOT fix this because nvm's shim is not on `/usr/bin/env`'s PATH.

**Why:** The `engines` field in package.json constrains to `>=22 <23`. Homebrew's Node 25 fails that check, blocking all yarn install/upgrade/build/test commands.

**How to apply:** A `.yarnrc` file at repo root with `ignore-engines true` silently suppresses the check for all yarn invocations in this directory — no per-command flags needed. This is the reliable fix; do not try nvm-based workarounds.
