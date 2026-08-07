# aaPanel Deployment — all services on the Contabo box (co-located)

Deploy **n8n + dashboard + Backend A + Backend B** onto the single Contabo VPS
(`vmi2117789`, Ubuntu 20.04, 6 vCPU / 15 GB RAM), with **aaPanel** managing Nginx +
Let's Encrypt SSL (auto-renew). The owner's existing **PostgreSQL 16 (Odoo data)** on
`127.0.0.1:5432` is **left completely untouched** — nothing here connects to it.

> Replace `<DOMAIN>` with the owner's domain and `<VPS_IP>` with the box's public IP
> (`curl -s ifconfig.me`). Suggested subdomains: `n8n.<DOMAIN>`, `dash.<DOMAIN>`.

> **⚡ Deployment method = Docker Compose** (see [DOCKER-DEPLOY.md](DOCKER-DEPLOY.md)).
> aaPanel's role is now **SSL reverse proxy only** — it fronts the containers on
> `127.0.0.1:5678` (n8n) and `127.0.0.1:3000` (dashboard) and issues Let's Encrypt.
> **Use:** Step 0 (backup), Step 1 (aaPanel+Nginx), Step 2 (DNS), Step 9 (reverse proxy + SSL),
> Step 10 (firewall). **Skip** Steps 3–8 (Node/pm2/npm) — those are the non-Docker fallback;
> `docker compose up -d --build` replaces them.

## Final architecture
| Service | Port | Exposure | URL |
|---|---|---|---|
| n8n (runs the WhatsApp workflow) | 5678 | **public** (SSL) | `https://n8n.<DOMAIN>` |
| bot-dashboard (Next.js) | 3000 | **public** (SSL) | `https://dash.<DOMAIN>` |
| Backend A — semantic search | 8080 | **internal only** | `http://127.0.0.1:8080` |
| Backend B — WooCommerce wrapper | 8081 | **internal only** | `http://127.0.0.1:8081` |
| PostgreSQL 16 (owner's Odoo DB) | 5432 | localhost only — **DO NOT TOUCH** | — |

---

## Step 0 — Backup done first (prerequisite)
- Contabo snapshot (if panel access), **and/or**
- `sudo -u postgres pg_dumpall | gzip > /root/odoo_pg_backup_$(date +%F).sql.gz`

## Step 1 — aaPanel + Nginx (prerequisite)
- aaPanel installed; on first login **close** the LNMP one-click popup.
- **Software Store → install Nginx only.** Do **NOT** install MySQL/MariaDB or PHP (not needed — everything uses Supabase cloud + the existing Postgres).
- Save the panel URL / user / password / security-path.

## Step 2 — DNS
Create two A-records at the domain's DNS:
```
n8n.<DOMAIN>    A    <VPS_IP>
dash.<DOMAIN>   A    <VPS_IP>
```
Wait for them to resolve (`ping n8n.<DOMAIN>` shows `<VPS_IP>`) before issuing SSL.

## Step 3 — Node 20 LTS + PM2
Easiest via aaPanel: **App Store → "PM2 Manager"** (installs a Node version + pm2 with a GUI).
Or via CLI:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs && sudo npm i -g pm2 && node -v
```

## Step 4 — Get the code + env files onto the box
From your machine (envs are gitignored — copy them explicitly):
```bash
scp -r "semantic-search-backend" "woocommerce-api-wrapper" "bot-dashboard" root@<VPS_IP>:/opt/iconnect/
```
(Or `git clone` each, then `scp` just the `.env` / `.env.local` files.)

## Step 5 — Backend A (semantic search, internal :8080)
```bash
cd /opt/iconnect/semantic-search-backend && npm install --include=dev && npm run build && pm2 start dist/index.js --name backend-a
curl http://localhost:8080/health    # -> {"status":"ok"}
```
`.env` already holds Azure embedding + Supabase keys. No re-index (Supabase already has the 708 products).

## Step 6 — Backend B (WooCommerce wrapper, internal :8081)
```bash
cd /opt/iconnect/woocommerce-api-wrapper && npm install --include=dev && npm run build && pm2 start dist/index.js --name backend-b
curl http://localhost:8081/health
curl "http://localhost:8081/api/products?per_page=2&search=cat6"
```
`.env` already has `WC_COOKIE=humans_21909=1` + full UA + `SEMANTIC_BACKEND_URL=http://localhost:8080`.

## Step 7 — Dashboard (Next.js, public :3000)
Set the n8n webhook **before building** (NEXT_PUBLIC_* is baked at build time):
```bash
cd /opt/iconnect/bot-dashboard
# in .env.local set:  NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL=https://n8n.<DOMAIN>/webhook/wa-agent-send
npm install && npm run build && pm2 start npm --name dashboard -- start   # serves on :3000
```

## Step 8 — n8n (public :5678)
```bash
sudo npm install -g n8n
# create /root/.n8n-env  (pm2 will load these):
```
Env for running behind the aaPanel HTTPS reverse proxy:
```
N8N_HOST=n8n.<DOMAIN>
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_EDITOR_BASE_URL=https://n8n.<DOMAIN>/
WEBHOOK_URL=https://n8n.<DOMAIN>/
N8N_PROXY_HOPS=1
GENERIC_TIMEZONE=Asia/Riyadh
N8N_SECURE_COOKIE=true
```
Start under pm2 (data + encryption key persist in `/root/.n8n` — back that folder up):
```bash
pm2 start n8n --name n8n
pm2 save && pm2 startup   # run the line it prints, so all 4 survive reboot
```

## Step 9 — aaPanel reverse-proxy sites + SSL (the SSL you wanted)
For **each** public subdomain (`dash.<DOMAIN>` → 3000, `n8n.<DOMAIN>` → 5678):
1. **Website → Add site** → bind the subdomain (pick "static/pure" — no PHP, no DB).
2. Open the site → **Reverse Proxy → Add**:
   - Target URL: `http://127.0.0.1:3000` (dashboard) or `http://127.0.0.1:5678` (n8n)
   - Send Domain: `$host`
3. Open the site → **SSL → Let's Encrypt** → select the domain → **Apply**. Turn on **Force HTTPS** + auto-renew (aaPanel renews automatically).

**n8n needs WebSocket + long timeouts** — in the n8n site's Reverse Proxy config (Conf), ensure:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```
(aaPanel's "WebSocket" toggle in the reverse-proxy dialog sets the first three; add the timeouts if long executions get cut.)

## Step 10 — Firewall lockdown (aaPanel → Security)
Allow **only**: `22` (SSH), `80`, `443`, and the **panel port**. Leave `8080`, `8081`, `5678`, `3000`, `5432` **not** open to the internet (they're reached via Nginx or localhost). Postgres is already localhost-only.

## Step 11 — Migrate the WhatsApp workflow to the new n8n
1. In the **old** n8n (`n8n.asra3.com`) export workflow `qz1II8EwuKTJiQDy` (⋯ → Download).
2. In the **new** n8n import it.
3. Repoint the 5 backend tool URLs: `https://search.asra3.com` → `http://127.0.0.1:8080`, `https://api.asra3.com` → `http://127.0.0.1:8081`.
4. Recreate credentials on the new n8n: Supabase (REST), the AI model (chat + Analyze Image + Transcribe), Postgres Chat Memory (or swap to Simple Memory), Zernio token in the channel.
5. Register the Zernio inbound webhook → `https://n8n.<DOMAIN>/webhook/wa-zernio-inbound`.
6. Set the dashboard channel's `agent_webhook_url` → `https://n8n.<DOMAIN>/webhook/wa-agent-send`.

## Security checklist
- `.env` files `chmod 600`; never commit.
- Rotate WooCommerce `ck_/cs_`, and consider fresh Azure/Supabase keys before public launch.
- Back up `/root/.n8n` (holds the n8n encryption key — losing it makes saved credentials unreadable).
- aaPanel: strong panel password + keep the random security-path; consider IP-allowlisting the panel port.

## Quick reference
| Service | pm2 name | Local | Public |
|---|---|---|---|
| Backend A | `backend-a` | `:8080` | internal |
| Backend B | `backend-b` | `:8081` | internal |
| Dashboard | `dashboard` | `:3000` | `https://dash.<DOMAIN>` |
| n8n | `n8n` | `:5678` | `https://n8n.<DOMAIN>` |

`pm2 status` · `pm2 logs <name>` · `pm2 restart <name>`
