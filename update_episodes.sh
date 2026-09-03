#!/bin/bash
# Exports Firestore -> public/js/data.json and, when its content changed, opens
# a PR, approves and waits for its required build check, merges it, and
# explicitly dispatches the Firebase deployment.

set -euo pipefail

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

git pull origin main

old_ids=$(jq -r '.episodes | keys[]' public/js/data.json 2>/dev/null | sort)

# CI passes a key written outside the checkout, so it can never be swept into a
# commit. With no key the export falls back to application default credentials
# — locally, whoever ran `gcloud auth application-default login`.
if [ -n "${FIRESTORE_CREDENTIALS:-}" ]; then
    node scripts/export-firestore-episodes.mjs "$FIRESTORE_CREDENTIALS"
else
    node scripts/export-firestore-episodes.mjs
fi

item_count=$(jq '.episodes | length' public/js/data.json)

# Read the current value of EPISODES_COUNT from .env if it exists
if [ -f .env ]; then
    current_count=$(sed -n 's/^EPISODES_COUNT=//p' .env | head -1)
    current_count=${current_count:-0}
else
    current_count=0
fi

# Check if the current count is different from the new item count
if ! [[ "$item_count" =~ ^[0-9]+$ ]] || [ "$item_count" -le 0 ]; then
    echo "Invalid item count: $item_count. Exiting."
    exit 1
fi

echo "EPISODES_COUNT=$item_count" > .env

# Publish when the episode COUNT changed (new episode) OR when data.json's
# CONTENT changed at constant count (e.g. a youtubeLink backfilled in Firestore
# on an existing episode). Without the content check, field-level updates would
# sit in Firestore forever and never reach the deployed site.
# jq -S normalizes key order on both sides: Firestore does not guarantee field
# order across exports, and a byte-level diff would redeploy on every run.
if [ "$current_count" -eq "$item_count" ] && \
   diff -q <(jq -S . public/js/data.json) <(git show HEAD:public/js/data.json | jq -S .) >/dev/null 2>&1; then
    echo "Episode count unchanged and data.json content identical. No update needed."
    git checkout -- public/js/data.json
    exit 0
fi

# Transcripts are generated offline. Open a tracking issue per new episode
# (closed automatically by .github/workflows/close-transcript-issues.yml once
# public/transcripts/{num}.json is pushed) instead of only logging a reminder.
new_ids=$(jq -r '.episodes | keys[]' public/js/data.json | sort | comm -13 <(echo "$old_ids") -)

if command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ]; then
    for num in $new_ids; do
        title=$(jq -r --arg n "$num" '.episodes[$n].title' public/js/data.json)
        echo "Opening tracking issue for episode $num ($title)"
        gh issue create \
            --title "Transcrire l'épisode $num" \
            --label needs-transcript \
            --body "Nouvel épisode détecté : **$title** (épisode $num).

Pour transcrire : \`yarn transcribe $num\`, vérifier \`public/transcripts/$num.json\`, puis push sur main. Cette issue se ferme automatiquement une fois le transcript publié." \
            2>&1 || echo "Warning: failed to open tracking issue for episode $num"
    done
else
    echo "Reminder: new episode(s) detected ($new_ids) -> run 'yarn transcribe --all --missing', review public/transcripts/, then commit. (gh CLI not found, skipped issue creation)"
fi

git add .env
git add public/js/data.json
git commit -m "Update episode data"

update_branch=${EPISODE_UPDATE_BRANCH:-automation/episode-update-$(date -u +%Y%m%d%H%M%S)}
case "$update_branch" in
    automation/episode-update-*) ;;
    *) echo "Invalid episode update branch: $update_branch" >&2; exit 1 ;;
esac

# main is protected by CI's required `build` check. A PR created by GITHUB_TOKEN
# gets a pull_request workflow run, but GitHub initially marks that run as
# `action_required`. Approve that exact run, wait for its PR-associated check,
# and only then merge. The deploy is explicitly dispatched after the merge
# because GITHUB_TOKEN-authored merge events do not start other workflows.
git push origin "HEAD:refs/heads/$update_branch"
pr_url=$(gh pr create \
    --base main \
    --head "$update_branch" \
    --title "Update episode data" \
    --body "Automated Firestore episode export. The updater will merge this PR only after the required CI build passes.")
echo "Episode update PR created: $pr_url"

commit_sha=$(git rev-parse HEAD)

ci_run_id=""
for ((attempt = 1; attempt <= 30; attempt++)); do
    ci_run_id=$(gh run list \
        --workflow ci.yml \
        --branch "$update_branch" \
        --event pull_request \
        --limit 10 \
        --json databaseId,headSha \
        --jq "[.[] | select(.headSha == \"$commit_sha\")][0].databaseId // empty")
    [ -n "$ci_run_id" ] && break
    sleep 2
done

if [ -z "$ci_run_id" ]; then
    echo "Could not find the PR CI run for $commit_sha." >&2
    exit 1
fi

ci_conclusion=$(gh run view "$ci_run_id" --json conclusion --jq '.conclusion // empty')
if [ "$ci_conclusion" = "action_required" ]; then
    repository=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq '.nameWithOwner')}
    echo "Approving PR CI run $ci_run_id on $commit_sha"
    gh api --method POST "repos/$repository/actions/runs/$ci_run_id/approve" >/dev/null
fi

echo "Waiting for PR CI run $ci_run_id on $commit_sha"
gh run watch "$ci_run_id" --exit-status
gh pr merge --squash --delete-branch "$pr_url"
gh workflow run deploy-security.yml --ref main
echo "Episode update merged and production deployment dispatched."

exit
