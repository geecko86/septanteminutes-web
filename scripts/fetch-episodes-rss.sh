#!/bin/bash
# Triggers the Cloud Function that syncs the podcast RSS feed into Firestore.
# Runs as its own scheduled job, separate from update_episodes.sh, because the
# Cloud Function's completion time is indeterminate: this job is scheduled to
# run ~10 minutes before the Firestore export job, giving it time to finish.
#
# The function requires IAM auth (roles/cloudfunctions.invoker), so the caller
# presents a short-lived Google-signed identity token. In CI the identity comes
# from RSS_TRIGGER_KEY_FILE; locally it falls back to whoever gcloud is already
# logged in as.
set -uo pipefail

FUNCTION_URL="https://europe-west1-septanteminutes.cloudfunctions.net/getEpisodesFromRSS"

if [ -n "${RSS_TRIGGER_KEY_FILE:-}" ]; then
    gcloud auth activate-service-account --key-file="$RSS_TRIGGER_KEY_FILE" --quiet || {
        echo "Could not activate the RSS trigger service account." >&2
        exit 1
    }
fi

# The audience must be the exact function URL or the token is rejected.
id_token=$(gcloud auth print-identity-token --audiences="$FUNCTION_URL" 2>/dev/null)
if [ -z "$id_token" ]; then
    echo "No identity token: set RSS_TRIGGER_KEY_FILE, or run 'gcloud auth login' locally." >&2
    exit 1
fi

retry_count=0
max_retries=3

while [ $retry_count -lt $max_retries ]; do
    echo "Fetching content from URL..."
    # Check the status separately. Now that the function is private, an
    # unauthorised call answers 403 with a body that would not match the error
    # test below — a silent "success" would leave Firestore stale for hours.
    response=$(curl -sS -w '\n%{http_code}' \
        -H "Authorization: Bearer ${id_token}" \
        "$FUNCTION_URL")
    status=$(printf '%s' "$response" | tail -n1)
    fetched_content=$(printf '%s' "$response" | sed '$d')

    if [ "$status" = "401" ] || [ "$status" = "403" ]; then
        echo "The function rejected our token (HTTP $status) — check the invoker binding." >&2
        exit 1
    fi

    if [ "$status" != "200" ] || [[ $fetched_content =~ [Ee][Rr][Rr][Oo][Rr] ]]; then
        echo "Fetch failed (HTTP $status), retrying..."
        ((retry_count++))
    else
        echo "Content fetched successfully."
        exit 0
    fi
done

echo "Maximum retries reached. Failed to fetch content."
exit 1
