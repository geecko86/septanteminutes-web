#!/bin/bash

# Function to fetch content from URL and store it in a variable
fetch_content() {
    content=$(curl -sS "$1")
    echo "$content"
}

# Main script
retry_count=0
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
        break
    fi
done

if [ $retry_count -eq $max_retries ]; then
    echo "Maximum retries reached. Failed to fetch content."
    exit -1
fi

sleep 70

npx -p node-firestore-import-export firestore-export -a septanteminutes-a0cde5efbc25.json -b public/js/data.json
sed -i '' -E 's/^.{19}//; s/.$//; s/{}},"/{}},\n"/g' public/js/data.json

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

git add .env
git add public/js/data.json
git add firebase.json
git commit -m "update data.json, .env and firebase.json"

exit
