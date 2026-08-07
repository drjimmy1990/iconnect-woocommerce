# iConnect WhatsApp Store Bot — Project Status (Master Tracker)

**Last updated:** 2026-08-06
**Single source of truth** for the whole project. Other docs are linked below.

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
| Backend A — semantic search | `semantic-search-backend/` | ✅ Built, tested. 708 products indexed in Supabase. Runs locally; **needs VPS deploy**. |
| Backend B — WooCommerce wrapper | `woocommerce-api-wrapper/` | ✅ Built, tested (cookie/UA/order/track). Runs locally; **needs VPS deploy**. |
| Supabase DB (search) | project `uorfbqhsaxoofzqouqsj` | ✅ `documents` table + pgvector + RLS. |
| Supabase DB (dashboard/CRM) | same project | ✅ `database_setup_final.sql` run; all tables present. |
| Dashboard (Next.js) | `bot-dashboard/` | ✅ Running locally (:3000), admin logged in. |
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

## Blockers (needed from the user)
1. **Deploy backends A + B to the VPS** — see [VPS-DEPLOYMENT.md](VPS-DEPLOYMENT.md). Unblocks Task 5.
2. **Zernio bearer token + store WhatsApp `accountId`** — unblocks Tasks 6–9 (sending).
3. **AI model choice + n8n credential** — unblocks Task 4 (the agent).

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
