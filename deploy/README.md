# Deploy — Regen Bazaar beta (isolated stack on the HelpRent VPS)

> Status: **code-ready, not yet validated on a Docker host.** The web build, standalone output, and
> migration runner are verified locally; the container images and nginx wiring are validated only on
> first real deploy. Do a dry recon before `up`.

The stack is fully namespaced `regenbazaar_*` and reaches the public internet only through a new host
nginx server block. It must not touch HelpRent's containers, ports, nginx blocks, volumes, or files.

## What runs
| Service | Container | Exposure |
|---|---|---|
| Next.js web (standalone) | `regenbazaar_web` | `127.0.0.1:${WEB_PORT}` only → host nginx proxies the subdomain |
| Postgres 16 | `regenbazaar_postgres` | internal `regenbazaar_net` only (no host port) |
| Migrations (one-shot) | `regenbazaar_migrate` | runs Drizzle migrations, then exits; `web` waits for success |

Network `regenbazaar_net`, volume `regenbazaar_pgdata`. The on-chain layer (contracts, EAS, indexer)
and embedded-wallet onboarding are **not** in this stack yet — they are gated on the funded deployer key.

## Step 0 — Recon (before anything; AFFECTS ALL PROJECTS if ignored)
```sh
ss -tlnp                       # confirm chosen WEB_PORT (default 8010) is free; HelpRent uses 8002/8003
docker ps -a                   # confirm no name clash with regenbazaar_*; do NOT touch app_whatsapp_*
docker network ls              # regenbazaar_net must not already exist under another project
ls /etc/nginx/sites-enabled/   # confirm the subdomain isn't already served
df -h && free -m               # confirm headroom (Postgres volume + Node runtime)
```
Never run a global `docker system/volume/network/image prune` on this shared host.

## Step 1 — Configure
```sh
cd /root/regenbazaar           # our isolated dir (separate from /root/helprentbot)
cp deploy/.env.example deploy/.env
# edit deploy/.env: strong POSTGRES_PASSWORD, a free WEB_PORT, DEEPSEEK_API_KEY (optional)
```

## Step 2 — Build & start (migrations run automatically, then web)
```sh
cd deploy
docker compose --env-file .env up -d --build
docker compose logs -f migrate   # expect "migrations applied" then exit 0
docker compose ps                # regenbazaar_web healthy, listening on 127.0.0.1:${WEB_PORT}
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/   # expect 200
```

## Step 3 — Host nginx + TLS (new block only; never edit HelpRent's)
```sh
sudo cp deploy/nginx/regenbazaar.conf.example /etc/nginx/sites-available/regenbazaar.conf
# edit: set server_name to your subdomain and proxy_pass port to match WEB_PORT
sudo ln -s /etc/nginx/sites-available/regenbazaar.conf /etc/nginx/sites-enabled/regenbazaar.conf
sudo nginx -t                    # MUST pass before reload
sudo systemctl reload nginx
sudo certbot --nginx -d app.regenbazaar.com   # issue TLS; certbot adds the 443 block + redirect
```
Point the subdomain's DNS A record at the VPS before running certbot.

## Verify
- `docker ps` shows the new containers are **only** `regenbazaar_*`; HelpRent's `app_whatsapp_*` untouched.
- `ss -tlnp` shows our port bound on `127.0.0.1` only (not `0.0.0.0`).
- `https://<subdomain>/` returns 200 over TLS; submit → score → verify flow works end-to-end.
- HelpRent sites (helprentphangan.com, test.helprentphangan.com) still respond — compare before/after.

## Update a running deploy
```sh
git pull
cd deploy && docker compose --env-file .env up -d --build   # migrate re-runs (idempotent), web restarts
```

## Rollback / teardown (scoped to this stack only)
```sh
docker compose down                 # stop + remove our containers + network (keeps the data volume)
docker compose down -v              # IRREVERSIBLE: also deletes regenbazaar_pgdata (all off-chain data)
```
`down` targets only services in this compose project — it does not affect HelpRent.

## Secrets (never commit; server-side only)
`POSTGRES_PASSWORD`, `DEEPSEEK_API_KEY`, and later the deployer/LLM/storage keys live only in
`deploy/.env` on the server. `deploy/.env` is git-ignored. The browser never receives any of them.
