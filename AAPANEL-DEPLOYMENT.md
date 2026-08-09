# aaPanel — sites, reverse proxy & SSL

aaPanel's **only** role in this project is the public HTTPS front door. Everything runs in
Docker on `127.0.0.1` ([DOCKER-DEPLOY.md](DOCKER-DEPLOY.md)); aaPanel terminates TLS and
proxies inward. Host facts and the Odoo co-tenant: [SERVER-NOTES.md](SERVER-NOTES.md).

| Subdomain | → | WebSocket? |
|---|---|---|
| `dash.iconnect-intl.com` | `http://127.0.0.1:3000` (dashboard) | no |
| `n8n.iconnect-intl.com` | `http://127.0.0.1:5678` (n8n) | **yes** |

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
```
Must return the server's IP before you request a certificate.

## 2. Create each site
**Website → Add site** → bind the subdomain → static / no PHP / no database.

## 3. Reverse proxy
Open the site → **Reverse Proxy → Add**:
- **Target URL:** `http://127.0.0.1:3000` (dashboard) or `http://127.0.0.1:5678` (n8n)
- **Send Domain:** `$host`
- Enable the **WebSocket** toggle for n8n

Then open that proxy's config file and ensure these directives exist — **required for n8n**:
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
> binding to `0.0.0.0` "to test" — that publishes it to the internet immediately.

## Reaching a service before DNS/SSL exists
Use an SSH tunnel rather than opening a port. From your workstation:
```bash
ssh -L 5678:127.0.0.1:5678 root@185.182.185.24
```
Then browse `http://localhost:5678` while the session stays open.
