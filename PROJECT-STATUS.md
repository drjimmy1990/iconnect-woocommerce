# iConnect WhatsApp Store Bot — Project Status (Master Tracker)

**Last updated:** 2026-08-09
**Single source of truth** for the whole project. Other docs are linked below.

> **🚀 Deployed 2026-08-09** — backends A+B and the dashboard now run in Docker on the
> owner's Contabo VPS `185.182.185.24` at `/www/wwwroot/iconnect`, all three `healthy`.
> See [DOCKER-DEPLOY.md](DOCKER-DEPLOY.md).

## What we're building
A WhatsApp AI shopping assistant for the WooCommerce store `iconnect-intl.com/store`, managed through a CRM/chat dashboard. Customers chat on WhatsApp → an n8n AI agent searches products (semantic + catalog), places orders (→ Telr payment link), tracks orders, and hands off to humans. A Next.js dashboard shows conversations, clients, and analytics.

## Architecture
```
Customer (WhatsApp)
      │
   Zernio gateway  ──►  n8n workflow "WhatsApp Store Bot (Zernio)"  ◄── Dashboard (Next.js) manual replies
                              │  (the brain: AI agent + tools)
        ┌─────────────────────┼───────────────────────────┐
        ▼                     ▼                           ▼
  Supabase (DB)        Backend B (:8081)            Backend A (:8080)
  CRM + chat +         WooCommerce wrapper          semantic search
  documents index      (catalog/orders/track)       (hybrid, 708 products)
                              │                           │
                       WooCommerce store          Azure OpenAI embeddings
                       (cookie+UA+keys)            (text-embedding-3-large@512)
```
Everything is per-channel **config-driven** from Supabase (`channels`/`channel_configurations`/`agent_prompts`), so new WhatsApp numbers need only a dashboard channel row — no workflow edits.

## Components & status
| Component | Location | Status |
|---|---|---|
| Backend A — semantic search | `semantic-search-backend/` | ✅ **Deployed** on VPS (Docker, internal `127.0.0.1:8080`), healthy. 708 products indexed. |
| Backend B — WooCommerce wrapper | `woocommerce-api-wrapper/` | ✅ **Deployed** on VPS (Docker, internal `127.0.0.1:8081`), healthy. |
| Supabase DB (search) | project `uorfbqhsaxoofzqouqsj` | ✅ `documents` table + pgvector + RLS. |
| Supabase DB (dashboard/CRM) | same project | ✅ `database_setup_final.sql` run; all tables present. |
| Dashboard (Next.js) | `bot-dashboard/` | ✅ **Deployed** on VPS (Docker, `127.0.0.1:3000`), healthy. Needs `dash.ai4eg.com` DNS + SSL to be public. |
| WhatsApp workflow (n8n) | n8n id `qz1II8EwuKTJiQDy` | ✅ Built (39 nodes) & **active** — full FB-parity (minus comments): debounce/waiting queue, Postgres memory, media handling (image **vision** + audio **transcription** + text), **intent Switch** (6 branches incl. real send-image), auto dashboard-table recording via DB triggers. Needs credentials + VPS to go live. |

## WhatsApp workflow build progress (plan: `docs/superpowers/plans/2026-08-06-whatsapp-workflow.md`)
| Task | Status |
|---|---|
| 1. Zernio webhook + echo filter + normalize | ✅ done & tested |
| 2. Load channel + upsert contact + ai_enabled gate | ✅ done & tested |
| 3. Log inbound message | ✅ built (debounce + keyword toggle deferred as enhancements) |
| 4. AI agent + JSON-output prompt + placeholder chat model | ✅ built (attach model credential to run) |
| 5. 5 backend tools (search/catalog/product/order/track) | ✅ built → prod URLs (`search`/`api`.asra3.com) |
| 6–7. Parse output + handoff routing + Zernio send + log outbound | ✅ built |
| 8. Product image | ✅ image URL rides in reply text (Zernio media fallback) |
| 9. Dashboard `/wa-agent-send` webhook | ✅ built |
| 10. Error handling (retry-on-fail on external calls) | ✅ built |
| 11. Go-live wiring | ⏳ user: add credentials + deploy backends + register webhooks |

**Webhook URLs:** inbound `https://n8n.asra3.com/webhook/wa-zernio-inbound` · dashboard `https://n8n.asra3.com/webhook/wa-agent-send`

**To go live:** (1) attach an AI model credential to the "OpenAI Chat Model" node (agent) **and** the "Analyze Image" node (media vision) — or swap them for your provider; (2) attach a **Postgres credential** to the "Postgres Chat Memory" node (Supabase → Settings → Database → connection info + DB password) — or swap it for "Simple Memory" to skip the credential; (3) deploy backends A+B to the VPS ([VPS-DEPLOYMENT.md](VPS-DEPLOYMENT.md)); (4) put the real Zernio token into the test channel's `credentials.zernio_token` (via dashboard) + register the Zernio inbound webhook + set the dashboard `agent_webhook_url`.

**Optional further FB-parity (not built):** inbound media handling (audio transcription / image description), contact `last_message_preview`/`last_interaction_at` updates, keyword AI-toggle. Ask if you want these added.

## Deployment (VPS `185.182.185.24`, Contabo, Ubuntu 20.04)
Docker Compose at `/www/wwwroot/iconnect` (repo cloned from GitHub; one root `.env`, gitignored).
All app ports bind **`127.0.0.1` only**; aaPanel nginx does the public HTTPS.

| Service | Container | Port (internal) | Public |
|---|---|---|---|
| Backend A | `iconnect-semantic-search` | 8080 | — (internal) |
| Backend B | `iconnect-wc-wrapper` | 8081 | — (internal) |
| Dashboard | `iconnect-dashboard` | 3000 | `dash.iconnect-intl.com` (pending DNS+SSL) |
| n8n | `iconnect-n8n` (+ `iconnect-n8n-db`) | 5678 | `n8n.iconnect-intl.com` (pending DNS+SSL) |

Shared Docker network **`iconnect-network`** (external) lets n8n reach the backends by
service name — **verified working 2026-08-09**: `http://semantic-search:8080`,
`http://woocommerce-wrapper:8081` both answer from inside the n8n container.

**n8n lives in its own stack**, deployed through the aaPanel Docker GUI at
**`/www/server/panel/data/compose/n8n`** (NOT under the git repo — `git pull` does not
update it; the tracked template is `n8n/docker-compose.yml`, kept in sync by hand).
Its Postgres (`iconnect-n8n-db`) is unpublished, so it never collides with the host's
Odoo PostgreSQL on `127.0.0.1:5432`.

**Also on this box (do not disturb):** the owner's Odoo 17 (`:8070`/`:8072`) + host PostgreSQL 16
(`127.0.0.1:5432`, 7 databases), aaPanel (`:80/:443/:888/:30184`), MariaDB (`:3306`).

> ⚠️ **Security incident 2026-08-09:** this VPS was found running an XMRig Monero miner
> (`/var/tmp/.odoo_pg_health` → `pool.hashvault.pro`) plus two malicious crontabs and an SSH
> backdoor key (`ElPatrono1337`) dating to Sep 2024. Cleaned: crontabs removed, payloads deleted,
> malicious Odoo `ir_cron` `_db_health_monitor` disabled in the `Alseba3y` DB, C2 `111.90.145.139`
> blocked. Entry vector = weak Odoo/Postgres creds (`db_password = odoo17`, `admin_passwd = iconnect2024`).
> **Still to do (owner):** rotate those passwords, set `list_db = False`. Evidence in `/root/ioc-backup/`.

## Blockers (needed from the user)
1. **DNS A-records** `n8n.ai4eg.com` + `dash.ai4eg.com` → `185.182.185.24`, then aaPanel SSL.
2. **Deploy n8n** (own compose) joined to `iconnect-network`, then import workflow + repoint tool URLs.
3. **Zernio bearer token + store WhatsApp `accountId`** — unblocks sending.
4. **AI model credential in n8n** — for the agent chat model + Analyze Image + Transcribe nodes.

## Key facts & identifiers
- **Store:** `https://iconnect-intl.com/store` — Classic API `/wp-json/wc/v3` (auth) + Store API `/wp-json/wc/store/v1`.
- **Origin protection:** Cloudflare removed; now needs `Cookie: humans_21909=1` + full browser User-Agent (else 409/406). Handled inside Backend B.
- **Payment:** Telr only (`wctelr`) → order returns `payment_url`. Shipping: Saudi Arabia only. Currency SAR.
- **Supabase:** project `uorfbqhsaxoofzqouqsj`; org id `07f3fa59-4241-4bd4-9828-a9efa5ed57a1`.
- **Azure embeddings:** `https://claude-foundry-5mspxyof.services.ai.azure.com/openai/v1`, model `text-embedding-3-large` @ 512 dims.
- **n8n:** `https://n8n.asra3.com` (v2.68). Workflow `qz1II8EwuKTJiQDy`. Supabase credential id `2JDO9miI0AkoGavz`. **Note:** this instance caps `httpRequest` at typeVersion **4.2** (not 4.4).
- **WhatsApp gateway (Zernio):** send text `POST https://zernio.com/api/v1/inbox/conversations/{conversationId}/messages` body `{accountId, message}`; auth `Bearer <token>`.
- **Test channel seeded:** `channels.platform_channel_id='acc123'` (id `c94eb132-5d1e-41e6-a79f-708f708b59d6`).

## Documentation index
| Doc | Purpose |
|---|---|
| [PROJECT-STATUS.md](PROJECT-STATUS.md) | This file — master tracker |
| [VPS-DEPLOYMENT.md](VPS-DEPLOYMENT.md) | Deploy backends A+B to the VPS |
| [SETUP-STEPS-VPS.md](SETUP-STEPS-VPS.md) | Original backend bring-up steps |
| [docs/superpowers/specs/2026-08-06-whatsapp-workflow-design.md](docs/superpowers/specs/2026-08-06-whatsapp-workflow-design.md) | WhatsApp workflow design spec |
| [docs/superpowers/plans/2026-08-06-whatsapp-workflow.md](docs/superpowers/plans/2026-08-06-whatsapp-workflow.md) | WhatsApp workflow implementation plan |
| [curls-n8n-VERIFIED.md](curls-n8n-VERIFIED.md) | Verified WooCommerce API curls |
| [README.md](README.md) | Original semantic-system README (backends A/B) |
| `bot-dashboard/` docs (DATABASE_SCHEMA.md, etc.) | Dashboard internals |

## Security to-do before public launch
- Rotate WooCommerce `ck_/cs_` keys; consider fresh Azure + Supabase keys (all were shared during setup).
- Move Zernio token into an n8n credential (never inline).
- Lock down backend ports to nginx-only.
