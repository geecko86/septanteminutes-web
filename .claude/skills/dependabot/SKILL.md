---
name: dependabot
description: Check GitHub Dependabot security alerts for this repo and fix them (yarn upgrade/resolutions, verify, PR). Use when the user asks about Dependabot, security alerts, vulnerable dependencies, or wants CVEs/advisories fixed.
---

# Dependabot alerts for septanteminutes-web

Repo: `geecko86/septanteminutes-web`. Auth: `gh auth status` (token has `repo` + `read:org` scopes, stored in keyring — should already work; if not, ask the user to run `gh auth login` themselves).

This project uses **yarn**, not npm — always fix/update dependencies with yarn commands (see memory: use yarn).

## 1. List open alerts

```bash
gh api -X GET repos/geecko86/septanteminutes-web/dependabot/alerts -f state=open --paginate \
  --jq '.[] | {number, package: .dependency.package.name, ecosystem: .dependency.package.ecosystem, severity: .security_advisory.severity, summary: .security_advisory.summary, manifest: .dependency.manifest_path, scope: .dependency.scope, range: .security_vulnerability.vulnerable_version_range, patched: .security_vulnerability.first_patched_version.identifier}'
```

Note the `-X GET` — without it, `-f` params make `gh api` default to POST and you'll get a 404.

Group by package: several alert numbers often point at the same dependency (e.g. one transitive package can have 5+ CVEs) — dedupe by package+patched version before planning fixes, one upgrade usually resolves all of them at once.

## 2. Inspect one alert in detail

```bash
gh api repos/geecko86/septanteminutes-web/dependabot/alerts/<number>
```

Useful fields: `dependency.manifest_path` (which lockfile), `dependency.relationship` (direct vs transitive), `security_vulnerability.first_patched_version`.

## 3. Check for existing Dependabot PRs first

Dependabot may have already opened a PR for the fix — don't duplicate work:

```bash
gh pr list --search "author:app/dependabot" --state open --json number,title,url
```

If a PR exists and just needs CI to pass / a merge, review and merge it (`gh pr view <n>`, `gh pr merge <n> --squash`) instead of hand-rolling the same bump — but always ask the user before merging.

## 4. Fix manually (when no Dependabot PR exists, or it's stale)

For a **direct** dependency in `package.json`:

```bash
yarn up <package>@<patched-version>
```

For a **transitive** dependency (shows up only in `yarn.lock`, not `package.json`) — add a `resolutions` entry to force the version across the whole tree, then reinstall:

```json
// package.json
"resolutions": {
  "<package>": "<patched-version>"
}
```

```bash
yarn install
```

After any bump:
1. `yarn install` to confirm lockfile resolves cleanly.
2. Run the project's build/typecheck (`yarn build` / `yarn tsc --noEmit` as applicable) to catch breaking changes from the bump.
3. Re-run the alert list — the fixed alerts should disappear from `state=open` (GitHub auto-closes them once the patched version lands on the default branch, no manual dismissal needed).

## 5. Dismissing an alert (false positive / accepted risk / not applicable)

Only do this when the user explicitly says to — don't dismiss on your own judgment:

```bash
gh api -X PATCH repos/geecko86/septanteminutes-web/dependabot/alerts/<number> \
  -f state=dismissed \
  -f dismissed_reason="<tolerable_risk|inaccurate|not_used|no_bandwidth|fix_started>" \
  -f dismissed_comment="<why>"
```

## 6. The push-time warning is stale — don't panic and don't re-fix

When you `git push` a fix, GitHub's remote hook often prints something like:

```
remote: GitHub found 1 vulnerability on <repo>'s default branch (1 high). To find out more, visit:
remote:      https://github.com/<owner>/<repo>/security/dependabot/<n>
```

...even for the alert you *just* fixed in the commit you're pushing. This is expected: that message is generated from the pre-push scan state, before GitHub has re-scanned the newly pushed manifest/lockfile. It does **not** mean the fix failed.

After pushing, wait ~15-30s and re-run the alert list (step 1) to confirm — don't re-diagnose or re-patch based on the push message alone:

```bash
sleep 20 && gh api -X GET repos/geecko86/septanteminutes-web/dependabot/alerts -f state=open --paginate --jq '.[] | {number, package: .dependency.package.name, severity: .security_advisory.severity}'
```

If the alert is truly still open after the re-check, only then treat it as a real remaining issue.

## 7. Reporting back to the user

Summarize as: package → severity range → single patched version needed → whether it's one upgrade fixing N alerts. Don't just dump raw JSON.
