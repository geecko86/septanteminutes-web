#!/bin/sh
set -eu

service_dir="$HOME/services/septante-storyboard-proxy"
config_dir="$HOME/.config/septanteminutes"
environment_file="$config_dir/storyboard-proxy.env"

mkdir -p "$service_dir" "$config_dir" "$HOME/.config/systemd/user"

if [ ! -s "$environment_file" ]; then
  token=$(openssl rand -hex 32)
  umask 077
  {
    printf 'STORYBOARD_PROXY_TOKEN=%s\n' "$token"
    printf 'STORYBOARD_PROXY_HOST=127.0.0.1\n'
    printf 'STORYBOARD_PROXY_PORT=8787\n'
  } > "$environment_file"
  unset token
fi
chmod 600 "$environment_file"

systemctl --user daemon-reload
systemctl --user enable --now septante-storyboard-proxy.service
systemctl --user --no-pager --full status septante-storyboard-proxy.service
