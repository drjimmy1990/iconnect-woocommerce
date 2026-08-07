# Docker Deployment — one-command bring-up (Contabo box)

Runs all 4 services with `docker compose`. aaPanel is used **only** for the public
HTTPS reverse proxy (Let's Encrypt) in front of the containers. The owner's
PostgreSQL 16 (Odoo) on `127.0.0.1:5432` is **never touched** — no container connects to it.

## Build vs pull — read this first
- **Built from your source** (need the folders on the VPS): `semantic-search`, `woocommerce-wrapper`, `bot-dashboard`.
- **Pulled image**: `n8n` only.
- ➜ So you can't just paste the YAML. Upload the **whole project folder**, then `up -d --build` (builds the 3, pulls n8n, starts all 4).

---

## Step 1 — Install Docker (aaPanel → App Store → **Docker**)
Installs Docker Engine + Compose v2 with a GUI. Verify in a terminal:
```bash
docker --version && docker compose version
```

## Step 2 — Put the WHOLE project on the VPS
Not just the compose file — the three source folders + Dockerfiles too. From your machine:
```bash
scp -r "C:/Users/LOQ/Desktop/CLI/emirates mostafa/woocommerce" root@<VPS_IP>:/opt/iconnect
```
Result on the box: `/opt/iconnect/docker-compose.yml`, `/opt/iconnect/semantic-search-backend/`, `.../woocommerce-api-wrapper/`, `.../bot-dashboard/`.
> `.dockerignore` files (added) keep your Windows `node_modules`/`.next` out of the build — important, they'd otherwise break the Linux images.

## Step 3 — Create the real `.env` (one file powers everything)
```bash
cd /opt/iconnect
cp .env.example .env
nano .env          # fill in the real values (Supabase, Azure, WC keys, domain)
```
Fill especially:
- `N8N_HOST` / `WEBHOOK_URL` → the owner's real domain (e.g. `n8n.<DOMAIN>` / `https://n8n.<DOMAIN>/`)
- `N8N_VERSION` → pin to your tested n8n version (not `latest`)
- `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL` → `https://n8n.<DOMAIN>/webhook/wa-agent-send` (or leave blank and set it per-channel in the dashboard UI)

`.env` sits next to `docker-compose.yml`, so compose loads it automatically — including the `NEXT_PUBLIC_*` **build args** the dashboard needs at build time.

## Step 4 — Build + pull + start (the "and so on")
```bash
cd /opt/iconnect
docker compose config -q          # validate (silent = OK)
docker compose build              # builds A, B, dashboard (first run is slow — Next build + 3× npm ci)
docker compose pull               # pulls the n8n image
docker compose up -d              # start all 4 detached
```
Or all in one: `docker compose up -d --build`.

**In the aaPanel GUI instead:** Docker → Compose → Create Project → point it at `/opt/iconnect` (where the compose file **and** the source folders **and** `.env` live) → Deploy. Same result; the source must be in that folder.

## Step 5 — Verify
```bash
docker compose ps                                  # all "healthy"
curl http://127.0.0.1:8080/health                  # backend A
curl http://127.0.0.1:8081/health                  # backend B
curl -I http://127.0.0.1:3000/api/health           # dashboard
curl -I http://127.0.0.1:5678                      # n8n
docker compose logs -f --tail=50 woocommerce-wrapper   # follow a service
```
Containers publish on `127.0.0.1` only — not reachable from the internet yet (that's Step 6).

## Step 6 — aaPanel reverse proxy + SSL (only n8n + dashboard are public)
For each public subdomain, in aaPanel:
1. **Website → Add site** → bind `n8n.<DOMAIN>` (repeat for `dash.<DOMAIN>`), type static/no-DB.
2. Site → **Reverse Proxy → Add** → target:
   - `n8n.<DOMAIN>`  → `http://127.0.0.1:5678`
   - `dash.<DOMAIN>` → `http://127.0.0.1:3000`
   - Send Domain: `$host`. For **n8n**, enable **WebSocket** and raise timeouts:
     ```nginx
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_read_timeout 3600s;
     proxy_send_timeout 3600s;
     ```
3. Site → **SSL → Let's Encrypt** → apply → **Force HTTPS** + auto-renew.

**Backends A + B get NO site** — they stay internal (n8n reaches them over the Docker network).

## Step 7 — Firewall (aaPanel → Security)
Open only `22`, `80`, `443`, and the panel port. Do **not** open `8080/8081/3000/5678/5432`.
(Containers bind to `127.0.0.1`, so this is belt-and-suspenders — good either way.)

## Step 8 — Point the workflow at the Docker service names
When you migrate workflow `qz1II8EwuKTJiQDy` into this n8n, set the 5 backend tool URLs to the **compose service names** (same network, no localhost, no `*.asra3.com`):
- Backend A → `http://semantic-search:8080`
- Backend B → `http://woocommerce-wrapper:8081`

## Day-2 operations
```bash
cd /opt/iconnect
docker compose pull && docker compose up -d          # update n8n image
docker compose up -d --build backend? bot-dashboard  # rebuild an app after code change
docker compose restart <service>
docker compose logs -f --tail=100 <service>
docker compose down                                  # stop all (volumes/data kept)
```
**Back up** the `n8n_data` volume (holds n8n's encryption key + workflows):
```bash
docker run --rm -v woocommerce_n8n_data:/data -v /root:/backup alpine tar czf /backup/n8n_data_$(date +%F).tgz -C /data .
```
*(Volume name is `<projectdir>_n8n_data`; confirm with `docker volume ls`.)*
