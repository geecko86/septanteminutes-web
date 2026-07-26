#!/bin/bash
# Exports Firestore -> public/js/data.json and, if the episode count changed,
# builds and deploys. Assumes scripts/fetch-episodes-rss.sh already ran
# (separately scheduled) so Firestore is up to date by the time this runs.

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

git pull origin main

old_ids=$(jq -r '.episodes | keys[]' public/js/data.json 2>/dev/null | sort)

node scripts/export-firestore-episodes.mjs septanteminutes-a0cde5efbc25.json

item_count=$(jq '.episodes | length' public/js/data.json)

# Read the current value of EPISODES_COUNT from .env if it exists
if [ -f .env ]; then
    current_count=$(grep 'EPISODES_COUNT=' .env | sed 's/EPISODES_COUNT=//')
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

if command -v gh >/dev/null 2>&1; then
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
git add firebase.json
git add public/transcripts
git commit -m "update data.json, .env and firebase.json"
git push origin main

# --only hosting: this scheduled job deploys the WEBSITE only. The Cloud
# Function getEpisodesFromRSS lives in a separate (non-public) project and is
# deployed independently — never from here.
yarn build && firebase --project septanteminutes deploy --only hosting --non-interactive

exit
