# aaPanel + Docker Compose Deployment Guide

This guide details how to deploy the **iConnect WooCommerce AI & CRM Platform** using **Docker Compose** on an **aaPanel** server, with aaPanel handling SSL certificates (Let's Encrypt) and Reverse Proxying.

---

## 1. Prerequisites on aaPanel
- Install **Docker Manager** from aaPanel App Store (if not already installed).
- Point your domain DNS records to your aaPanel server IP:
  - `bot.asra3.com` -> VPS IP
  - `search.asra3.com` -> VPS IP
  - `api.asra3.com` -> VPS IP
  - `n8n.asra3.com` -> VPS IP

---

## 2. Deploy Containers via Docker Compose

1. **Upload / Git Clone project to VPS:**
   ```bash
   cd /opt
   git clone https://github.com/drjimmy1990/iconnect-woocommerce.git
   cd iconnect-woocommerce
   ```

2. **Configure `.env` file:**
   Copy `.env.docker.example` to `.env` and fill in your actual credentials:
   ```bash
   cp .env.docker.example .env
   nano .env
   ```

3. **Start the Stack:**
   ```bash
   docker compose up -d --build
   ```

4. **Verify Containers:**
   ```bash
   docker compose ps
   ```
   All 4 services will run bound to local ports:
   - `bot-dashboard`: `127.0.0.1:3000`
   - `semantic-search`: `127.0.0.1:8080`
   - `woocommerce-wrapper`: `127.0.0.1:8081`
   - `n8n`: `127.0.0.1:5678`

---

## 3. Configure aaPanel Reverse Proxies & SSL

For each of your subdomains in aaPanel:

### A. Create Website Entries in aaPanel
1. Go to **aaPanel Panel** -> **Website** -> **Add Site**.
2. Create site for `bot.asra3.com` (Pure Static / PHP irrelevant).
3. Repeat for `search.asra3.com`, `api.asra3.com`, and `n8n.asra3.com`.

### B. Enable SSL (Let's Encrypt)
1. Click **Conf** next to each site in aaPanel.
2. Go to **SSL** tab -> Select **Let's Encrypt** -> Check domain -> Click **Apply**.
3. Enable **Force HTTPS**.

### C. Set Up Reverse Proxy in aaPanel
Go to site **Conf** -> **Reverse Proxy** -> **Add reverse proxy**:

| Subdomain | Proxy Name | Target URL |
|---|---|---|
| `bot.asra3.com` | `DashboardProxy` | `http://127.0.0.1:3000` |
| `search.asra3.com` | `SearchProxy` | `http://127.0.0.1:8080` |
| `api.asra3.com` | `WrapperProxy` | `http://127.0.0.1:8081` |
| `n8n.asra3.com` | `N8NProxy` | `http://127.0.0.1:5678` |

> **Note for WebSocket Support (Live Chat / n8n):**
> Under **Advanced Configuration** of `bot.asra3.com` and `n8n.asra3.com` reverse proxies in aaPanel, ensure the following headers are included for WebSockets:
> ```nginx
> proxy_http_version 1.1;
> proxy_set_header Upgrade $http_upgrade;
> proxy_set_header Connection "upgrade";
> ```

---

## 4. Verification

From terminal or browser, verify all services:
```bash
curl https://search.asra3.com/health
curl https://api.asra3.com/health
curl https://bot.asra3.com/api/health
```

All 3 should return `{"status":"ok"}` over HTTPS!
