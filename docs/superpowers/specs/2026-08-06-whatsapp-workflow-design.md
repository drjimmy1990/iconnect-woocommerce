# WhatsApp (Zernio) n8n Workflow — Design Spec

**Date:** 2026-08-06
**Status:** Approved (design)
**Owner:** iConnect store bot project

## 1. Goal

Build the n8n workflow that turns the WooCommerce store (`iconnect-intl.com/store`) into a WhatsApp shopping assistant. It receives WhatsApp messages via the **Zernio** gateway, runs an AI agent that searches products, places orders, and tracks shipments through our two backends, logs everything into the bot-dashboard's Supabase database, and hands off to human agents when needed.

This is a **clean, tailored build** that reuses the proven patterns of the existing Facebook workflow (`facebook-dashboard-workflow.json`) — debounce, intent routing, DB-driven config, CRM logging — but is built fresh for Zernio + our backends, with none of the Facebook-specific parts (Messenger Graph API, comment/feed subsystem, Instagram, the `bestlifeeg` POS API).

## 2. Scope (v1 capabilities)

1. **Product search & browse** — semantic (backend A) + catalog (backend B).
2. **Send product images** on request.
3. **Place order → Telr payment link** (backend B `POST /api/orders` → `payment_url`).
4. **Order tracking** (backend B `GET /api/orders/track`).
5. **Human handoff** — agent takeover from the dashboard; AI pauses per-contact via `ai_enabled`.
6. **Services inquiry → auto-handoff** — if a customer asks about *services* (not products), set `ai_enabled=false` and route to a human.

**Out of scope (v1):** multi-store, comment/social features, automated marketing broadcasts, voice-call handling. Media *receiving* (image/audio) is supported as a secondary path (describe/transcribe) but is not the focus.

## 3. Architecture — end-to-end flow

Two entry points, both n8n webhooks.

### 3.1 Customer message (Zernio → bot)
```
Zernio webhook
  → drop echoes            (message.direction == "outgoing" OR message.sender_type == "agent")
  → normalize              (phone, text, conversationId, accountId, media, name, timestamp)
  → load channel config    (by accountId → system prompt, backend A/B URLs, Zernio creds, keyword_actions)
  → upsert contact         (by phone + channel_id); read ai_enabled
  → GATE: ai_enabled==false → log message only, STOP (human is handling)
  → keyword check          (enable/disable-AI keywords toggle ai_enabled)
  → [media] image→describe · audio→transcribe   (optional)
  → debounce queue         (merge rapid consecutive messages → single AI reply)
  → log inbound → messages (sender_type=user)
  → AI Agent (+ Postgres memory + tools) → { intent, reply, ... }
  → Switch by intent → send reply via Zernio → log outbound → messages (sender_type=ai)
```

### 3.2 Human agent reply (dashboard → customer)
```
dashboard "Send" → POST /agent-send webhook → send via Zernio → log to messages (sender_type=agent)
```
The dashboard's `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL` / per-channel `agent_webhook_url` points at this webhook.

### 3.3 Key design choices
- **`ai_enabled` gate** is the handoff mechanism: off → bot silent for that contact, human drives from the dashboard.
- **Debounce** prevents multiple replies to rapid consecutive messages.
- **Per-channel config-driven**: one workflow serves multiple WhatsApp numbers; adding a number = one channel row, no workflow edits.

## 4. AI agent + tools

- **AI Agent** node with a **swappable Chat Model sub-node** (model TBD — chosen later; does not affect the design), **Postgres chat memory** (per-contact), and a **DB-driven system prompt** from `agent_prompts` (editable in the dashboard).
- Tools (map to our validated backends):

| Tool | Backend call | Purpose |
|---|---|---|
| `semantic_search` | A `POST /search` (hybrid) | NL/fuzzy/cross-lingual product discovery |
| `search_catalog` | B `GET /api/products` | Exact/filtered browse (keyword, category, price, SKU, on_sale) |
| `get_product` | B `GET /api/products/:id` | Full details + `image_url` (feeds send_product_image) |
| `place_order` | B `POST /api/orders` | Create order → returns Telr `payment_url` |
| `track_order` | B `GET /api/orders/track` | Look up order by number / phone / email |

**Purchase flow inside the agent:** search → present 1–3 options with price → customer picks → collect name/phone/address → confirm summary → `place_order` → reply with Telr link.

The agent never handles WooCommerce keys, the `humans_21909` cookie, or Zernio tokens — those live in backend B and the channel config.

## 5. Intents & routing

Agent emits `intent`; a Switch routes it:

| Intent | Action |
|---|---|
| `conversation` | Send text reply via Zernio |
| `send_product_image` | Send image via Zernio (see §8 media gap) |
| `place_order` | Send the Telr payment link (agent already called `place_order`) |
| `track_order` | Send status text |
| `services_inquiry` | Set `ai_enabled=false` + "transferring to our team" message + optional staff alert → human takeover |
| `human_handoff` | Explicit human request → same as services_inquiry |

**Re-enable after handoff:** agent clicks "resume AI" on the contact in the dashboard (or a configured keyword) → `ai_enabled=true`.

## 6. Data model (Supabase — already created by `database_setup_final.sql`)

| Table | Role |
|---|---|
| `channels` + `channel_configurations` | Per-number config: Zernio accountId+token, backend A/B URLs, notification config, keyword_actions, `agent_webhook_url` |
| `agent_prompts` | System prompt (dashboard-editable) |
| `contacts` | One per customer (phone + channel_id); holds `ai_enabled`, name |
| `messages` | Every message logged; `sender_type` = user / ai / agent (dashboard chat source) |
| *(Postgres chat memory table)* | Agent conversation memory |

## 7. External contracts (reference)

### 7.1 Zernio (WhatsApp gateway)
- **Auth:** `Authorization: Bearer sk_...` (per account; store in n8n credential, not hardcoded).
- **Send text:** `POST https://zernio.com/api/v1/inbox/conversations/{conversationId}/messages` — body `{ accountId, message }`.
- **List conversations:** `GET https://zernio.com/api/v1/inbox/conversations?accountId=<id>&limit=<n>`.
- **Inbound webhook payload:** `message.text`, `message.direction` (drop `outgoing`), `message.sender_type` (drop `agent`), `message.attachments[]` (media), `conversation.id` (reply target), `conversation.participantUsername` (customer phone, strip `+`), `conversation.participantName`, `account.accountId`.

### 7.2 Backend B — WooCommerce wrapper (holds WC keys + cookie + UA)
Base URL: VPS `https://api.asra3.com` (or `http://localhost:8081` in dev).
- `GET /api/products` (search, category, per_page, price, sku, on_sale, …)
- `GET /api/products/:id`
- `POST /api/orders` → `{ id, payment_url, order_key, ... }` (Telr)
- `GET /api/orders/track` (order_id+order_key | email | phone)
- `GET /api/categories`, `GET /api/payment-gateways`, `GET /api/shipping-zones`

### 7.3 Backend A — semantic search
Base URL: VPS `https://search.asra3.com` (or `http://localhost:8080` in dev).
- `POST /search` — body `{ query, top_k, mode:"hybrid", filters? }` → `{ results:[{id, score, metadata}] }`.

## 8. Open items

- **Zernio image-send (media gap):** the reference (salon) workflow received on Zernio but sent images via a second gateway (Evolution). Resolution order during build: (1) confirm a Zernio media/attachment endpoint and use it; (2) else send the WooCommerce image URL in the message (WhatsApp link preview); (3) else wire a fallback media gateway. Does not block other work.
- **AI model:** deferred by the user; plugged in as a Chat Model sub-node later. No design impact.
- **Optional staff notifications** (Telegram/WhatsApp alert on handoff/new order): supported via `channel_configurations.notification_config` like the FB workflow; include as a small optional sub-flow, default off.

## 9. Error handling

- Every external call (A, B, Zernio) uses retry-on-fail + a graceful fallback message ("عذراً، لحظة من فضلك") + error logging; no silent failures or crashes.
- Backend B internally handles WooCommerce origin quirks (cookie/UA/406/409 retries) — invisible to the agent.
- Echo-filter + debounce prevent reply loops and duplicate sends.

## 10. Testing

1. **Tools** — A/B endpoints already validated live (708 products indexed; order→`payment_url`; tracking). ✅
2. **Integration** — feed a sample Zernio inbound payload into the webhook → verify normalize → agent → reply.
3. **Handoff** — "services" message → confirm `ai_enabled` flips off, message logged, appears in dashboard.
4. **Order** — simulate a purchase → confirm `place_order` returns the Telr link.
5. **Live** — real WhatsApp message once Zernio creds + webhook are wired.

## 11. Go-live prerequisites (post-build)

1. Deploy backends A + B to the VPS (subdomains `search.asra3.com` / `api.asra3.com`).
2. Create a **channel** in the dashboard with Zernio creds + backend URLs + system prompt.
3. Point the **Zernio webhook** at the n8n workflow's webhook URL.
4. Set the dashboard's `agent_webhook_url` (and `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL`).
