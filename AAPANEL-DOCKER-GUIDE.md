# ⛔ SUPERSEDED — see DOCKER-DEPLOY.md

This early guide no longer matches the deployed system. Following it will not work.

**Use instead:**
| Doc | For |
|---|---|
| **[DOCKER-DEPLOY.md](DOCKER-DEPLOY.md)** | The deployment runbook (app stack + n8n stack, troubleshooting, redeploy checklist) |
| **[AAPANEL-DEPLOYMENT.md](AAPANEL-DEPLOYMENT.md)** | aaPanel sites, reverse proxy, Let's Encrypt |
| **[SERVER-NOTES.md](SERVER-NOTES.md)** | Host facts, port map, Odoo co-tenant, security incident |

## What changed since this was written
| This guide said | Reality (2026-08-09) |
|---|---|
| Domains `bot.` / `search.` / `api.` / `n8n.asra3.com` | Only **two** public subdomains: `dash.iconnect-intl.com` and `n8n.iconnect-intl.com` |
| Backends A + B get public subdomains + SSL | Backends are **internal only** (`127.0.0.1:8080/8081`), reached by n8n over the `iconnect-network` Docker network — no public URL, no certificate |
| Clone to `/opt/iconnect-woocommerce` | `/www/wwwroot/iconnect` (aaPanel convention) |
| `cp .env.docker.example .env` | The template is **`.env.example`** |
| n8n included in the main compose | n8n is a **separate stack** ([n8n/docker-compose.yml](n8n/docker-compose.yml)), deployed via the aaPanel Docker GUI at `/www/server/panel/data/compose/n8n` |
| — | `docker network create iconnect-network` is a **required prerequisite** |
| — | Base images must be **`node:22-alpine`** (`@supabase/supabase-js` requires Node 22+) |
| — | All containers bind **`127.0.0.1`** — Docker's published ports bypass ufw |
