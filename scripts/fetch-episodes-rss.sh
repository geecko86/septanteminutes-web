#!/bin/bash
# Triggers the Cloud Function that syncs the podcast RSS feed into Firestore.
# Runs as its own scheduled job, separate from update_episodes.sh, because the
# Cloud Function's completion time is indeterminate: this job is scheduled to
# run ~10 minutes before the Firestore export job, giving it time to finish.

fetch_content() {
    curl -sS "$1"
}

retry_count=0
max_retries=3

while [ $retry_count -lt $max_retries ]; do
    echo "Fetching content from URL..."
    fetched_content=$(fetch_content "https://europe-west1-septanteminutes.cloudfunctions.net/getEpisodesFromRSS")

    if [[ $fetched_content =~ [Ee][Rr][Rr][Oo][Rr] ]]; then
        echo "Fetched content contains error, retrying..."
        ((retry_count++))
    else
        echo "Content fetched successfully."
        exit 0
    fi
done

echo "Maximum retries reached. Failed to fetch content."
exit 1
