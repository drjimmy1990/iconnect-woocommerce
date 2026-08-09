# Server Notes — `185.182.185.24` (Contabo `vmi2117789`)

Everything about the host itself: what else runs on it, what must not be touched, and the
security incident of 2026-08-09. Deployment steps are in [DOCKER-DEPLOY.md](DOCKER-DEPLOY.md).

## Specs
Ubuntu 20.04.6 LTS · 6 vCPU · 15.6 GB RAM · 391 GB disk · **no swap** · SSH on port 22.

## Port map (who owns what)
| Port | Service | Notes |
|---|---|---|
| 22 | sshd | fail2ban active |
| 25 / 110 / 143 / 993 / 995 | postfix + dovecot | aaPanel mail stack |
| 53 | pdns_server | aaPanel DNS |
| 80 / 443 | nginx (aaPanel) | public entry point + Let's Encrypt |
| 888 | nginx (aaPanel) | phpMyAdmin |
| 3306 | MariaDB (aaPanel) | unrelated to our stack |
| **5432** | **PostgreSQL 16 (host)** | **Odoo's databases — DO NOT TOUCH.** `127.0.0.1` only |
| 6379 | Redis (aaPanel) | |
| **8070 / 8072** | **Odoo 17** | HTTP + longpolling |
| 30184 | aaPanel panel | |
| 3000 / 8080 / 8081 / 5678 | **our stack** | all `127.0.0.1` only |

## ⚠️ The Odoo co-tenant — do not disturb
The owner's production Odoo 17 shares this box. **Nothing in our project connects to it**
(we use Supabase cloud), but be aware:

- Install: `/odoo` · venv `/odoo/venv17` · config `/odoo/odoo17.conf` · user `odoo17`
- Service: `odoo.service` (now **enabled** — see below)
- **HTTP port is 8070**, not 8017. The owner believed 8017; `http_port = 8070` in the config.
- 7 databases owned by `odoo17`: `Alseba3y`, `ORA`, `demo`, `i_connect`, `i_connect4`, `logistics`, `mostafa_test`
- Filestore (attachments) is **not** in `pg_dump` — back up `/odoo/.local/share/Odoo/filestore/` separately
- `pg_path` in the config wrongly points at `postgresql/12/bin` (host runs **16**) → Odoo's
  UI-driven backup/restore will fail until corrected

### Why Odoo went down on 2026-08-09
The server rebooted at 15:19 and `odoo.service` was **`disabled`**, so it never came back.
Fixed with `systemctl enable odoo`. Not caused by aaPanel, Docker, or our deployment —
Odoo was already stopped when we first inspected the box on Aug 6.

## 🚨 Security incident — 2026-08-09
The server was found running a **Monero miner (XMRig)**, ~95% CPU and 12 GB RAM (load 31/6 cores).

**Indicators:** `/var/tmp/.odoo_pg_health` (+ `.json` config) → pool `pool.hashvault.pro`,
wallet `89bsxF3D7pvJ…`, rig-id `oo3`. Binary dated **Jul 4 2026**; `/var/tmp/.ladyg0g0`
dated **Sep 3 2024** ⇒ intrusion roughly **2 years old**, long before this project.

**Persistence found (4 mechanisms):**
1. `postgres` crontab — every minute, fetched `/var/tmp/.bg_payload` from C2 `http://111.90.145.139:8080/target.txt`
2. `odoo17` crontab — 5 entries running `/var/tmp/86e39fd9/2538cc74`
3. Odoo `ir_cron` **`_db_health_monitor`** ×2 (every 5 min) inside the **`Alseba3y`** database — the launcher
4. SSH backdoor key **`ElPatrono1337`** in `/odoo/.ssh/authorized_keys` (Nov 23 2025)

The miner only ran while Odoo ran (#3 was the trigger) — which is why the box looked idle
while Odoo was stopped.

**Remediation performed:** crontabs removed (evidence copied to `/root/ioc-backup/`),
payloads deleted from `/var/tmp` `/tmp` `/dev/shm`, `_db_health_monitor` set `active = false`,
backdoor key removed, C2 IP blocked (`ufw deny out to 111.90.145.139`). Verified: load 31 → 0.2,
RAM 13 GB → 1.2 GB, nothing regenerated, no `ld.so.preload`, shell profiles clean.
**No data was deleted** — the only DB write was that single `UPDATE ir_cron` (2 rows, reversible).
Full dump taken: `/root/odoo_all_2026-08-09_1827.sql.gz`.

**Entry vector:** weak credentials in `/odoo/odoo17.conf` — `db_password = odoo17` (identical
to the username), `admin_passwd = iconnect2024`, `list_db = True`, on a host that had ufw disabled.

### ❗ Still owed by the owner
1. Rotate the PostgreSQL password off `odoo17` (DB **and** `/odoo/odoo17.conf`)
2. Change `admin_passwd`; set `list_db = False`
3. Rotate the WooCommerce `ck_`/`cs_` keys (they're in this repo's git history)
4. Consider a clean rebuild — a ~2-year-old compromise can't be *proven* clean
5. Assume all 7 Odoo databases were readable by the attacker for that period

## Firewall
ufw is **active**. Allowed: `20, 21, 22, 80, 443, 888, 8070, 5432, 30184, 39000-40000`.

> ⚠️ **Docker bypasses ufw.** Published container ports are inserted into iptables ahead of
> ufw's INPUT chain, so a `0.0.0.0` binding is internet-reachable regardless of ufw rules.
> This is why every container in this project binds `127.0.0.1` explicitly.

## Useful health checks
```bash
uptime; free -h; docker ps --format 'table {{.Names}}\t{{.Ports}}'
```
```bash
ls -la /dev/shm /tmp /var/tmp | grep -iE 'pg_health|worker_monitor|payload|ladyg'   # must be EMPTY
```
```bash
ss -tlnp | grep 5432    # must be ONE line: 127.0.0.1:5432 (Odoo's)
```
