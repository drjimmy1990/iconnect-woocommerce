# VPS Deployment — Backends A + B (asra3.com)

Deploy the two Node backends onto the same VPS that runs n8n (`n8n.asra3.com`) so the workflow can reach them. Supabase and Azure are already cloud-hosted; this only covers A + B.

**Target:** `search.asra3.com` → Backend A (:8080), `api.asra3.com` → Backend B (:8081), both over HTTPS.

## Prerequisites (on the VPS)
- Node.js 20+ and npm
- `pm2` (`npm i -g pm2`)
- nginx + certbot (for the subdomains + TLS)
- DNS A-records for `search.asra3.com` and `api.asra3.com` → the VPS IP

## Step 1 — Get the code + env onto the VPS
Copy `semantic-search-backend/` and `woocommerce-api-wrapper/` (including their `.env` files — they are gitignored, so copy them separately). Example with scp from your machine:
```bash
scp -r "semantic-search-backend" "woocommerce-api-wrapper" user@YOUR_VPS:/opt/iconnect/
```
Then SSH into the VPS: `ssh user@YOUR_VPS` and `cd /opt/iconnect`.

## Step 2 — Backend A (semantic search, :8080)
```bash
cd /opt/iconnect/semantic-search-backend && npm install --include=dev && npm run build && pm2 start dist/index.js --name backend-a
```
Verify: `curl http://localhost:8080/health` → `{"status":"ok"}`

> `.env` already has the Azure embedding config + Supabase keys. No re-index needed — Supabase already holds the 708 indexed products.

## Step 3 — Backend B (WooCommerce wrapper, :8081)
```bash
cd /opt/iconnect/woocommerce-api-wrapper && npm install --include=dev && npm run build && pm2 start dist/index.js --name backend-b
```
Verify:
```bash
curl http://localhost:8081/health
curl "http://localhost:8081/api/products?per_page=2&search=cat6"
```
> `.env` already has `WC_COOKIE=humans_21909=1` + full UA, so the origin's cookie/406/409 guards are handled.

## Step 4 — Persist pm2 across reboots
```bash
pm2 save && pm2 startup   # run the command it prints
```

## Step 5 — nginx reverse proxy + HTTPS
Create `/etc/nginx/sites-available/iconnect-backends`:
```nginx
server {
  server_name search.asra3.com;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
  server_name api.asra3.com;
  location / { proxy_pass http://127.0.0.1:8081; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```
Enable + TLS:
```bash
ln -s /etc/nginx/sites-available/iconnect-backends /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d search.asra3.com -d api.asra3.com
```
Verify from anywhere:
```bash
curl https://search.asra3.com/health
curl https://api.asra3.com/health
```

## Step 6 — Point the n8n workflow at prod URLs
In the WhatsApp workflow, the backend tool base URLs become:
- Backend A: `https://search.asra3.com`
- Backend B: `https://api.asra3.com`

(These are set when Task 5 tools are built. Until then, nothing in the workflow calls them.)

## Security
- The backends hold the WooCommerce keys + Azure key + Supabase service key in `.env`. Keep `.env` at `chmod 600`, never commit.
- Optionally firewall :8080/:8081 so only nginx (localhost) reaches them.
- Rotate the WooCommerce `ck_/cs_` keys and consider a fresh Azure key before going fully public (they were shared during setup).

## Quick reference
| Service | Local | Public |
|---|---|---|
| Backend A (search) | `:8080` | `https://search.asra3.com` |
| Backend B (wrapper) | `:8081` | `https://api.asra3.com` |
| n8n | — | `https://n8n.asra3.com` |
| pm2 | `pm2 status`, `pm2 logs backend-a`, `pm2 restart backend-b` | |
