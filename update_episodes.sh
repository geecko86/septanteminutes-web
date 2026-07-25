#!/bin/bash
# Exports Firestore -> public/js/data.json and, if the episode count changed,
# builds and deploys. Assumes scripts/fetch-episodes-rss.sh already ran
# (separately scheduled) so Firestore is up to date by the time this runs.

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

git pull origin main

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

if [ "$current_count" -eq "$item_count" ]; then
    echo "EPISODES_COUNT is the same as the current count. No update needed."
    exit 0
fi

# Transcripts are generated offline: after a new episode lands, run
# `yarn transcribe --all --missing`, review the output and commit it.
echo "Reminder: new episode detected -> run 'yarn transcribe --all --missing', review public/transcripts/, then commit."

git add .env
git add public/js/data.json
git add firebase.json
git add public/transcripts
git commit -m "update data.json, .env and firebase.json"
git push origin main

yarn build && firebase --project septanteminutes deploy --non-interactive

exit
