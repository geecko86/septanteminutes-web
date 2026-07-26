#!/bin/bash
# Polls GitHub for open "needs-transcript" issues and runs `yarn transcribe`
# locally for each one, using this machine's Claude subscription (via the
# `claude` CLI) and ElevenLabs API key. Meant to run from cron on a machine
# that has this repo cloned, `gh` authenticated, and `.env.local` set up
# with ELEVENLABS_API_KEY.
#
# Security notes:
#   - This script only ever makes outbound requests (poll GitHub, call
#     ElevenLabs/Claude, push to GitHub) — no inbound port is opened, unlike
#     a webhook receiver.
#   - Use a dedicated fine-grained GitHub PAT for `gh auth login` here, NOT
#     a broad admin token: grant only Contents (read/write), Issues (read),
#     Metadata (read) on this one repo. This script never needs to close
#     issues or touch repo/workflow settings — that's handled by
#     .github/workflows/close-transcript-issues.yml once the push lands.
#   - A lockfile prevents overlapping runs if a previous transcription is
#     still in progress when cron fires again.

set -euo pipefail

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")/.." ; pwd -P )
cd "$parent_path"

LOCK_FILE="/tmp/pi-transcribe-watcher.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another run is already in progress, exiting."
    exit 0
fi

git pull origin main
yarn install --frozen-lockfile

episodes=$(gh issue list --label needs-transcript --state open --json title --jq '.[].title' \
    | grep -oE '[0-9]+' || true)

if [ -z "$episodes" ]; then
    echo "No open needs-transcript issues."
    exit 0
fi

for num in $episodes; do
    if [ -f "public/transcripts/${num}.json" ]; then
        echo "Episode $num already has a transcript, skipping (issue should close on next push)."
        continue
    fi

    echo "Transcribing episode $num..."
    if yarn transcribe "$num"; then
        git add "public/transcripts/${num}.json" "public/transcripts/${num}.vtt" public/transcripts/manifest.json
        git commit -m "transcribe episode ${num}"
        git push origin main
    else
        echo "Transcription failed for episode $num, leaving issue open for retry."
    fi
done
