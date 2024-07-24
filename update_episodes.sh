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

npx -p node-firestore-import-export firestore-export -a septanteminutes-a0cde5efbc25.json -b public/js/data.json
sed -i '' -E 's/^.{19}//; s/.$//; s/{}},"/{}},\n"/g' public/js/data.json

item_count=$(jq '.episodes | length' public/js/data.json)
rewrites=""

for ((i=1; i<=item_count; i++)); do
    rewrites+="{ \"source\": \"/$i\", \"destination\": \"/$i.html\" }, "
done
rewrites="${rewrites%,}"
rewrites=$'\\n      '+$rewrites

sed -i '' '/1.html/d' firebase.json
sed -i '' -E "s#\"rewrites\": \[#\"rewrites\": [$rewrites_formatted#" firebase.json

echo "EPISODES_COUNT=$item_count" > .env

git add .env
git add public/js/data.json
git add firebase.json
git commit -m "update data.json, .env and firebase.json"

exit

# sed -i '' -E 's/^.{19}//; s/.$//' public/js/data.json
