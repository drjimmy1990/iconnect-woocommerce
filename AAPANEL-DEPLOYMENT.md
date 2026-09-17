# aaPanel — sites, reverse proxy & SSL

aaPanel's **only** role in this project is the public HTTPS front door. Everything runs in
Docker on `127.0.0.1` ([DOCKER-DEPLOY.md](DOCKER-DEPLOY.md)); aaPanel terminates TLS and
proxies inward. Host facts and the Odoo co-tenant: [SERVER-NOTES.md](SERVER-NOTES.md).

| Subdomain | → | WebSocket? |
|---|---|---|
| `dash.iconnect-intl.com` | `http://127.0.0.1:3000` (dashboard) | no |
| `n8n.iconnect-intl.com` | `http://127.0.0.1:5678` (n8n) | **yes** |
| `supabase.iconnect-intl.com` | `http://127.0.0.1:8000` (Supabase Studio & APIs) | **yes** |

Backends A (`:8080`) and B (`:8081`) get **no site** — they're internal only, reached by n8n
over the `iconnect-network` Docker network.

---

## 0. Installing aaPanel (only if starting fresh)
```bash
URL=https://www.aapanel.com/script/install_7.0_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO "$URL";else wget --no-check-certificate -O install_7.0_en.sh "$URL";fi;bash install_7.0_en.sh aapanel
```
- Save the panel URL / user / password / security path printed at the end (shown once).
- **Close** the one-click LNMP popup on first login → Software Store → install **Nginx** only.
- Install **Docker** from the App Store.
- You do **not** need MySQL/MariaDB or PHP for this project (aaPanel may install them anyway;
  harmless — MariaDB uses 3306 and never touches Odoo's PostgreSQL on 5432).

## 1. DNS first
A-records → the VPS IP. Let's Encrypt fails otherwise:
```bash
dig +short n8n.iconnect-intl.com
dig +short dash.iconnect-intl.com
dig +short supabase.iconnect-intl.com
```
Must return the server's IP before you request a certificate.

## 2. Create each site
**Website → Add site** → bind the subdomain → static / no PHP / no database.

## 3. Reverse proxy
Open the site → **Reverse Proxy → Add**:
- **Dashboard:** Target URL: `http://127.0.0.1:3000` | Send Domain: `$host` | WebSocket: off
- **n8n:** Target URL: `http://127.0.0.1:5678` | Send Domain: `$host` | **WebSocket: ON**
- **Supabase:** Target URL: `http://127.0.0.1:8000` | Send Domain: `$host` | **WebSocket: ON**

### Required Nginx Directives for n8n:
Open n8n site → **URL Proxy** → Config / ConfigFile:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_buffering off;
```

**Why each matters for n8n:**
- `Upgrade` / `Connection` — n8n runs `N8N_PUSH_BACKEND=websocket`; without them the editor
  shows a permanent "Connection lost" banner.
- `proxy_read_timeout 3600s` — aaPanel defaults to ~60 s, which kills long executions mid-run.
- `X-Forwarded-Proto` — pairs with `N8N_PROXY_HOPS=1` so n8n generates correct `https://` URLs.
- `proxy_buffering off` — keeps live execution updates streaming.

### Required Nginx Directives for Supabase (CRITICAL for Studio Login):
Open Supabase site → **URL Proxy** → **Config** (Proxy Catalog):
```nginx
proxy_hide_header www-authenticate;
add_header www-authenticate 'Basic realm="Supabase"' always;
proxy_set_header X-Forwarded-Proto $scheme;
```

**Why this matters for Supabase:**
- **The "User authentication failed. Missing username and password" bug:** Envoy protects Supabase Studio with HTTP Basic Auth (`DASHBOARD_USERNAME` & `DASHBOARD_PASSWORD`). On 401 challenges, Envoy automatically generates a header with `realm="http://supabase.iconnect-intl.com/"`.
- Modern browsers (Chrome, Edge) **block the native login prompt** if an HTTPS website presents an insecure `http://` realm, showing only raw text errors.
- `proxy_hide_header www-authenticate;` and `add_header www-authenticate 'Basic realm="Supabase"' always;` replace the invalid realm with a secure string, prompting the browser login popup immediately!

## 4. SSL
Site → **SSL → Let's Encrypt** → select the domain → Apply → enable **Force HTTPS**.
aaPanel handles renewal automatically.

## 5. Verify
```bash
curl -sI https://n8n.iconnect-intl.com | head -3
```
```bash
curl -sI https://dash.iconnect-intl.com | head -3
```
Open n8n in a browser — the editor must load with **no "Connection lost"** banner (WebSocket proof).

## 6. Firewall
aaPanel → **Security**: allow only `22`, `80`, `443`, the panel port (`30184`), plus Odoo's
`8070`. Do **not** open `3000 / 8080 / 8081 / 5678` — they're localhost-bound and proxied.

> ⚠️ Docker's published ports bypass ufw entirely. The protection comes from binding
> `127.0.0.1` in the compose files, not from firewall rules. Never change a container
## 7. Supabase Database Initialisation
1. Open Supabase Studio in your browser: `https://supabase.iconnect-intl.com`
2. Log in with your `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.
3. Go to **SQL Editor** ➔ **New Query**.
4. Open [databasefull.sql](databasefull.sql) in your project, copy the entire file content, paste it into the editor, and click **Run**.
5. All extensions, tables, RPC search functions (`match_documents`, `hybrid_search_documents`), triggers, CRM e-commerce funnel, and RLS policies are now initialized and verified with 0 errors!

## Reaching a service before DNS/SSL exists
Use an SSH tunnel rather than opening a port. From your workstation:
```bash
ssh -L 5678:127.0.0.1:5678 root@185.182.185.24
```
Then browse `http://localhost:5678` while the session stays open.

