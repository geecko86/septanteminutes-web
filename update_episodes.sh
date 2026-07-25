#!/bin/bash

# Function to fetch content from URL and store it in a variable
fetch_content() {
    content=$(curl -sS "$1")
    echo "$content"
}

# Main script
retry_count=0
success_count=0
max_retries=3

while [ $retry_count -lt $max_retries ]; do
    echo "Fetching content from URL..."
    fetched_content=$(fetch_content "https://europe-west1-septanteminutes.cloudfunctions.net/getEpisodesFromRSS")

    # Check if fetched content contains "error" (case insensitive)
    if [[ $fetched_content =~ [Ee][Rr][Rr][Oo][Rr] ]]; then
        echo "Fetched content contains error, retrying..."
        ((retry_count++))
    else
        echo "Content fetched successfully."
        ((success_count++))
        if [ $success_count -eq 1 ]; then
            echo "Doing it one more time in 70s"
            sleep 70
            ((retry_count++))
            ((max_retries++))
        else
            break
        fi
    fi
done

if [ $retry_count -eq $max_retries ]; then
    echo "Maximum retries reached. Failed to fetch content."
    exit -1
fi

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

git pull origin main

npx -p node-firestore-import-export firestore-export -a septanteminutes-a0cde5efbc25.json -b public/js/data.json
sed -E 's/^.{19}//; s/.$//; s/\{\}\},"/\{\}\},\'$'\n\"/g' public/js/data.json > /tmp/data.json && mv /tmp/data.json public/js/data.json

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
