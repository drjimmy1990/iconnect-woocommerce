# Docker Deployment — bring up the 3 app services (Contabo box)

Runs **Backend A + Backend B + dashboard** with `docker compose`. **n8n is deployed
separately** (your own compose) — it just needs to share the `iconnect-network` so it
can reach the backends by name. aaPanel is used **only** for the public HTTPS reverse
proxy (Let's Encrypt). The owner's PostgreSQL 16 (Odoo) on `127.0.0.1:5432` is **never
touched** — no container connects to it.

## Everything here is BUILT from source (nothing is pulled)
- `semantic-search`, `woocommerce-wrapper`, `bot-dashboard` → all `build:` from your repo folders.
- ➜ You can't just paste the YAML — the **source folders must be on the VPS**. Clone the repo, then `up -d --build`.
- Backends are **stateless** (all data lives in Supabase), so there are no volumes to back up here — only your `.env`.

---

## Step 1 — Install Docker (aaPanel → App Store → **Docker**)
Installs Docker Engine + Compose v2 with a GUI. Verify:
```bash
docker --version && docker compose version
```

## Step 2 — Clone the repo onto the VPS (git)
```bash
git clone https://github.com/drjimmy1990/iconnect-woocommerce.git /www/wwwroot/iconnect
cd /www/wwwroot/iconnect
```
> **Private repo?** `git clone https://<GITHUB_TOKEN>@github.com/drjimmy1990/iconnect-woocommerce.git /www/wwwroot/iconnect`
> (or an SSH deploy key). Public repo → the plain command works.

> `.dockerignore` files keep `node_modules`/`.next` out of the build (a host-built `node_modules` would break the Linux images). Checkout is **LF** on Linux, so scripts run fine despite Windows CRLF warnings.

## Step 3 — Create the real `.env`
```bash
cd /www/wwwroot/iconnect
cp .env.example .env
nano .env          # or scp your ready-made .env into /www/wwwroot/iconnect/.env
```
Fill: Supabase keys, Azure embedding key, WooCommerce `ck_`/`cs_`. `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL` is optional — leave blank and set the webhook per-channel in the dashboard UI, or set it to `https://<your-n8n-domain>/webhook/wa-agent-send` (baked at **build** time → rebuild the dashboard if you change it later).
> `.env` is **gitignored** — create it once; future `git pull`s never touch it.
> Lock it down: `chmod 600 /www/wwwroot/iconnect/.env`
> ⚠️ **aaPanel note:** `/www/wwwroot` is where aaPanel puts website document roots. Never point a website's root at `/www/wwwroot/iconnect` — the `.env` holds live secrets and would become web-readable. We only reverse-proxy to the container port, so no site root ever touches this folder.

## Step 4 — Create the shared network, then build + start
The network is **external** (shared with your n8n compose), so create it once first — otherwise `up` errors with "network iconnect-network not found":
```bash
docker network create iconnect-network      # once; ignore "already exists"
cd /www/wwwroot/iconnect
docker compose config -q                     # validate (silent = OK)
docker compose up -d --build                 # build the 3 images + start (first run is slow)
```

**In the aaPanel GUI instead:** Docker → Compose → Create Project → point it at `/www/wwwroot/iconnect` (compose file + source folders + `.env` all there) → Deploy. (Still create the network first.)

## Step 5 — Verify
```bash
docker compose ps                                  # all "healthy"
curl http://127.0.0.1:8080/health                  # backend A
curl http://127.0.0.1:8081/health                  # backend B
curl -I http://127.0.0.1:3000/api/health           # dashboard
docker compose logs -f --tail=50 woocommerce-wrapper   # follow a service
```
Containers publish on `127.0.0.1` only — not reachable from the internet yet (Step 6).

## Step 6 — aaPanel reverse proxy + SSL (the dashboard)
1. **Website → Add site** → bind `dash.<DOMAIN>` (type static/no-DB).
2. Site → **Reverse Proxy → Add** → target `http://127.0.0.1:3000`, Send Domain `$host`.
3. Site → **SSL → Let's Encrypt** → apply → **Force HTTPS** + auto-renew.

**Backends A + B get NO site** — internal only (n8n reaches them over the shared network).
> Your **n8n** gets the same treatment in its own setup: an aaPanel site for `n8n.<DOMAIN>` → `http://127.0.0.1:5678`, with **WebSocket** enabled + long timeouts:
> ```nginx
> proxy_http_version 1.1;
> proxy_set_header Upgrade $http_upgrade;
> proxy_set_header Connection "upgrade";
> proxy_read_timeout 3600s;
> proxy_send_timeout 3600s;
> ```

## Step 7 — Firewall (aaPanel → Security)
Open only `22`, `80`, `443`, and the panel port. Do **not** open `8080/8081/3000/5678/5432`.
(Containers bind to `127.0.0.1` — belt-and-suspenders.)

## Step 8 — Connect your n8n to the backends + fix the workflow tool URLs
1. In **your n8n compose**, attach the n8n service to the shared network:
   ```yaml
   services:
     n8n:
       # ...your n8n config...
       networks: [iconnect-network]
   networks:
     iconnect-network:
       external: true
   ```
2. When you migrate workflow `qz1II8EwuKTJiQDy` into that n8n, set the 5 backend tool URLs to the **compose service names** (no localhost, no `*.asra3.com`):
   - Backend A → `http://semantic-search:8080`
   - Backend B → `http://woocommerce-wrapper:8081`
3. Quick check from inside n8n's container: `docker exec -it <n8n_container> wget -qO- http://woocommerce-wrapper:8081/health` → should return OK.

## Day-2 operations — update from git
```bash
cd /www/wwwroot/iconnect
git pull                                    # fetch latest code (never touches .env)
docker compose up -d --build                # rebuild changed apps + restart
# handy:
docker compose up -d --build bot-dashboard  # rebuild one app after a code change
docker compose restart <service>
docker compose logs -f --tail=100 <service>
docker compose down                         # stop the 3 (network + your n8n untouched)
```
> If `git pull` complains about local changes, you edited a tracked file on the server — the only file you should edit is `.env` (gitignored).
> Nothing to back up here (backends are stateless → Supabase). Just keep a copy of `.env`.
