# Raspberry Pi storyboard proxy

GitHub's hosted runners sometimes receive a YouTube player page without its
storyboard specification. This service performs only the missing operation from
a Raspberry Pi: given a valid YouTube video ID, it downloads and returns that
video's M13 image sheet. It cannot forward arbitrary URLs.

## Security model

- The Node process binds to `127.0.0.1` by default. Put it behind an HTTPS
  reverse proxy or outbound tunnel; do not expose port 8787 directly.
- Every request requires a bearer token of at least 32 characters.
- Only `GET /v1/storyboards/<11-character-video-id>/m13` is accepted.
- Responses are limited to 8 MiB by the shared YouTube fetcher, are marked
  `no-store`, and at most two upstream requests run concurrently.

Generate the shared token on the Pi:

```sh
openssl rand -hex 32
```

Store it in a user-readable environment file with mode `0600`, at
`~/.config/septanteminutes/storyboard-proxy.env`:

```ini
STORYBOARD_PROXY_TOKEN=replace-with-the-generated-token
STORYBOARD_PROXY_HOST=127.0.0.1
STORYBOARD_PROXY_PORT=8787
```

The proxy itself has no package dependencies and works with the Pi's existing
Node 20 installation. Copy `scripts/storyboard-proxy.mjs` and
`scripts/youtube-storyboard.mjs` into the same directory on the Pi, then run:

```sh
set -a
. ~/.config/septanteminutes/storyboard-proxy.env
set +a
node storyboard-proxy.mjs
```

For unattended operation, install
`ops/systemd/septante-storyboard-proxy.service` as a user service:

```sh
mkdir -p ~/.config/systemd/user
cp ops/systemd/septante-storyboard-proxy.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now septante-storyboard-proxy.service
```

Expose `http://127.0.0.1:8787` through an HTTPS-only tunnel or reverse proxy.
Cloudflare Tunnel is a convenient option because it makes an outbound
connection from the Pi and requires no router port-forward. The bearer token is
still required even when a tunnel is used.

Finally, add these Actions repository secrets:

- `STORYBOARD_PROXY_URL`: the public HTTPS origin, optionally with a fixed path
- `STORYBOARD_PROXY_TOKEN`: the same random token stored on the Pi

Both deployment workflows pass these values only to `yarn build`. If either is
absent, local and CI builds remain functional and move on to the deployed-frame
and maxres2 fallbacks after the direct YouTube request fails.
Environment-based proxy use additionally requires GitHub Actions' built-in
`GITHUB_ACTIONS=true`; local builds ignore the proxy variables even if present.

When `cloudflared` runs in Docker rather than on the host, bind the proxy to the
tunnel container network's bridge gateway instead of `127.0.0.1`. For example,
the Pi's `cfedge` network uses `172.20.0.1`; this address is reachable from that
private Docker network but does not expose port 8787 on the LAN interface.
