#!/bin/sh
set -eu

environment_file="$HOME/.config/septanteminutes/storyboard-proxy.env"
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT

set -a
. "$environment_file"
set +a
proxy_origin="http://$STORYBOARD_PROXY_HOST:$STORYBOARD_PROXY_PORT"

unauthorized_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$proxy_origin/v1/storyboards/pE5sH0hRFl8/m13")
authenticated_status=$(curl --silent --show-error --output "$temporary" --write-out '%{http_code}' \
  --header "Authorization: Bearer $STORYBOARD_PROXY_TOKEN" \
  "$proxy_origin/v1/storyboards/pE5sH0hRFl8/m13")

printf 'Unauthenticated status: %s\n' "$unauthorized_status"
printf 'Authenticated status: %s\n' "$authenticated_status"
file "$temporary"

test "$unauthorized_status" = "401"
test "$authenticated_status" = "200"
