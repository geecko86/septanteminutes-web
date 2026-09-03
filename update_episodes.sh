#!/bin/bash
# Exports Firestore -> public/js/data.json and, when its content changed, opens
# an auto-merge PR. CI supplies main's required build check; the push of the
# merged data commit then triggers the test-gated Firebase deployment.

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

if command -v gh >/dev/null 2>&1 && [ -n "${ISSUES_GH_TOKEN:-${GH_TOKEN:-}}" ]; then
    for num in $new_ids; do
        title=$(jq -r --arg n "$num" '.episodes[$n].title' public/js/data.json)
        echo "Opening tracking issue for episode $num ($title)"
        GH_TOKEN="${ISSUES_GH_TOKEN:-$GH_TOKEN}" gh issue create \
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

# main is protected by CI's required `build` check. Publish a branch and let
# auto-merge land it only after that check passes; never deploy an unpushed
# runner-local commit.
git push origin "HEAD:refs/heads/$update_branch"
pr_url=$(gh pr create \
    --base main \
    --head "$update_branch" \
    --title "Update episode data" \
    --body "Automated Firestore episode export. This PR will merge after the required CI build passes.")
gh pr merge --auto --squash --delete-branch "$pr_url"
echo "Episode update PR created: $pr_url"

exit
