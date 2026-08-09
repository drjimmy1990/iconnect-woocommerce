# Docker Deployment — full runbook (verified 2026-08-09)

Deploys the three app services with `docker compose`, plus **n8n as a separate stack**.
aaPanel provides only the public HTTPS reverse proxy (Let's Encrypt) — see
[AAPANEL-DEPLOYMENT.md](AAPANEL-DEPLOYMENT.md). Host facts, the Odoo co-tenant, and the
security incident are in [SERVER-NOTES.md](SERVER-NOTES.md).

**Live deployment:** VPS `185.182.185.24`, app stack at `/www/wwwroot/iconnect`,
n8n stack at `/www/server/panel/data/compose/n8n` (aaPanel Docker GUI).

## Architecture
```
Internet ──► aaPanel nginx (:80/:443, Let's Encrypt)
                │
                ├─► dash.iconnect-intl.com ──► 127.0.0.1:3000  iconnect-dashboard
                └─► n8n.iconnect-intl.com  ──► 127.0.0.1:5678  iconnect-n8n
                                                    │
                              ┌── docker network: iconnect-network (external) ──┐
                              │                                                 │
                       semantic-search:8080                    woocommerce-wrapper:8081
                       (iconnect-semantic-search)              (iconnect-wc-wrapper)
                              │                                                 │
                       Supabase + Azure                              WooCommerce store

Untouched on the same host: Odoo 17 (:8070/:8072) + host PostgreSQL 16 (127.0.0.1:5432)
```

Every container binds **`127.0.0.1` only**. Backends A/B are never public — n8n reaches
them by Docker service name.

---

## Part 1 — App stack (backends A/B + dashboard)

### 1. Prerequisites
- Docker + Compose v2 (aaPanel → App Store → **Docker**)
```bash
docker --version && docker compose version
```
- Free ports: `3000`, `8080`, `8081`, `5678`. Check with `ss -tlnp`.
- ≥2 GB free RAM for the Next.js build (`free -h`).

### 2. Clone
```bash
git clone https://github.com/drjimmy1990/iconnect-woocommerce.git /www/wwwroot/iconnect
```
> Private repo: `git clone https://<GITHUB_TOKEN>@github.com/...`

### 3. Provide the `.env` (ONE file drives all three services)
`.env` is gitignored, so copy it separately. From your workstation:
```bash
scp .env root@<VPS_IP>:/www/wwwroot/iconnect/.env
```
```bash
chmod 600 /www/wwwroot/iconnect/.env
```
Template: [.env.example](.env.example). Keys required: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`EMBEDDING_*`, `WC_*`, `USER_AGENT`, `SYNC_*`, `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL`.

> ⚠️ **aaPanel:** `/www/wwwroot` holds website document roots. Never point a website's
> root at `/www/wwwroot/iconnect` — `.env` would become web-readable.

### 4. Create the shared network (ONCE — before `up`)
```bash
docker network create iconnect-network
```
It's declared `external:` in both compose files; `up` fails without it.

### 5. Build + start
```bash
cd /www/wwwroot/iconnect && docker compose up -d --build
```

### 6. Verify
```bash
docker compose ps
```
```bash
curl -s http://127.0.0.1:8080/health; echo; curl -s http://127.0.0.1:8081/health; echo; curl -s http://127.0.0.1:3000/api/health; echo
```
Expected — all three containers `(healthy)`:
```
{"status":"ok"}
{"status":"ok","service":"woocommerce-api-wrapper"}
{"status":"ok","service":"bot-dashboard"}
```

---

## Part 2 — n8n stack (separate)

n8n is **not** in the app compose. The tracked template is [n8n/docker-compose.yml](n8n/docker-compose.yml)
+ [n8n/.env.example](n8n/.env.example).

> **Live location:** deployed through the **aaPanel Docker GUI**, so its files live at
> `/www/server/panel/data/compose/n8n` — **`git pull` does NOT update it.** If you change
> the tracked template, paste the change into the aaPanel Compose project by hand.
> Find the live path any time with:
> ```bash
> docker inspect iconnect-n8n --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
> ```

### Deploy
```bash
mkdir -p /opt/n8n_public_files
```
Either use the aaPanel GUI (Docker → Compose → Create Project, paste both files), or CLI:
```bash
cd /www/wwwroot/iconnect/n8n && chmod 600 .env && docker compose up -d
```

### Verify — the decisive test
```bash
docker exec iconnect-n8n wget -qO- http://woocommerce-wrapper:8081/health; echo; docker exec iconnect-n8n wget -qO- http://semantic-search:8080/health
```
Both `{"status":"ok"…}` ⇒ the workflow's tool URLs will resolve.

Confirm the network membership and that Odoo's Postgres is untouched:
```bash
docker inspect iconnect-n8n --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'   # want: iconnect-network n8n_default
```
```bash
ss -tlnp | grep 5432    # must be ONE line: 127.0.0.1:5432 (Odoo's)
```

### Workflow tool URLs
Inside n8n, the 5 backend tools must use **service names** — not localhost, not a public domain:
- Backend A → `http://semantic-search:8080`
- Backend B → `http://woocommerce-wrapper:8081`

---

## Part 3 — Public HTTPS
DNS A-records → VPS IP, then aaPanel sites + Let's Encrypt.
Full steps (incl. the WebSocket/timeout config n8n needs): [AAPANEL-DEPLOYMENT.md](AAPANEL-DEPLOYMENT.md).

| Subdomain | Proxies to | Notes |
|---|---|---|
| `dash.iconnect-intl.com` | `http://127.0.0.1:3000` | plain proxy |
| `n8n.iconnect-intl.com` | `http://127.0.0.1:5678` | **WebSocket + 3600s timeouts required** |

Backends A/B get **no site** — they stay internal.

---

## 🔧 Troubleshooting — everything we actually hit

| Symptom | Root cause | Fix |
|---|---|---|
| `container iconnect-semantic-search is unhealthy` + log `Error: Node.js detected but native WebSocket not found` | `@supabase/supabase-js` requires **Node 22+**; Dockerfiles were `node:20-alpine` | All Dockerfiles now `node:22-alpine`. If you regress, that's the symptom. |
| `network iconnect-network declared as external, but could not be found` | Network not created | `docker network create iconnect-network` **before** `up` |
| `woocommerce-wrapper` stuck in `Created` | `depends_on: condition: service_healthy` — backend A wasn't healthy | Fix backend A; the wrapper then starts automatically |
| Dashboard `/api/health` → `307 Temporary Redirect` | Next.js auth middleware matched `/api/health` | `api/health` added to the matcher exclusion in `src/middleware.ts` |
| n8n can't resolve `woocommerce-wrapper` | n8n not on `iconnect-network` | Add the network — **and keep `default`**, or n8n loses its Postgres link |
| n8n reachable on `http://IP:5678` even though ufw blocks 5678 | **Docker publishes ports via its own iptables rules and bypasses ufw** | Bind `"127.0.0.1:5678:5678"` (all our services do this) |
| Port 5432 conflict with Odoo | An n8n-side Postgres publishing `5432:5432` | Don't publish it (our compose doesn't). Or map `5433:5432`. Docker fails loudly — no data risk. |
| `NEXT_PUBLIC_*` change has no effect | They're **build-time** args baked into the Next.js bundle | `docker compose up -d --build bot-dashboard` |
| `git pull` doesn't change n8n's behaviour | n8n's live compose is in the aaPanel dir, not the repo | Edit the aaPanel Compose project |
| Next.js build killed (`signal 9`) | OOM — this host has **no swap** | Free RAM first, or add swap, or cap the heap |
| Local (non-Docker) build misses TypeScript | npm skipped devDependencies | `npm install --include=dev` |
| Windows→Linux CRLF warnings on commit | Repo stores LF; working copy is CRLF | Harmless — checkout on Linux is LF |

### Useful commands
```bash
cd /www/wwwroot/iconnect && docker compose logs -f --tail=80 semantic-search woocommerce-wrapper bot-dashboard
```
```bash
docker compose ps -a; docker stats --no-stream
```

---

## Day-2 operations
```bash
cd /www/wwwroot/iconnect && git pull && docker compose up -d --build
```
```bash
docker compose up -d --build bot-dashboard    # rebuild one service
docker compose restart <service>
docker compose down                           # stop app stack (n8n unaffected)
```

**Backups:**
- App services are **stateless** (all data in Supabase) — only `.env` is worth keeping.
- **n8n `n8n-data` volume holds workflows + the encryption key** — back it up:
```bash
docker run --rm -v n8n_n8n-data:/data -v /root:/backup alpine tar czf /backup/n8n_data_$(date +%F).tgz -C /data .
```
(confirm the volume name with `docker volume ls`)

---

## Redeploying from scratch (new server, ~15 min)
1. Install Docker + aaPanel; confirm ports 3000/8080/8081/5678 free.
2. `docker network create iconnect-network`
3. `git clone … /www/wwwroot/iconnect`; copy `.env`; `chmod 600`.
4. `docker compose up -d --build` → verify the 3 health endpoints.
5. Deploy the n8n stack ([n8n/docker-compose.yml](n8n/docker-compose.yml)); copy `n8n/.env`; `mkdir -p /opt/n8n_public_files`.
6. Verify n8n → backends with the `docker exec … wget` test.
7. DNS A-records + aaPanel sites + Let's Encrypt for the two subdomains.
8. Import the workflow; set tool URLs to the service names; add credentials; register the Zernio webhook.
