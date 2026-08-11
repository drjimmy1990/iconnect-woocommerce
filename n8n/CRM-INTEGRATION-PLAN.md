# CRM Integration Plan — WhatsApp Store Bot → Dashboard

How the n8n workflow writes into the dashboard's Supabase tables, modelled on the
Facebook/Instagram bot pattern but adapted to this store's 5 intents.

**Every column, constraint and RPC below was read from
`bot-dashboard/database_setup_final.sql`** — not assumed. Line numbers are cited so you
can re-check.

---

## 1. Intents → what the workflow does

| # | Intent | Sends | CRM writes |
|---|---|---|---|
| 1 | `conversation` | text | `messages` |
| 2 | `product_details` | N images + text | `messages` ×(N+1) · stage → `product_viewed` |
| 3 | `complaint` | text | `messages` · `crm_activities` · stage → `support` · staff notification |
| 4 | `customer_service` | text | `messages` · `crm_activities` · `contacts.ai_enabled=false` · stage → `support` · notification |
| 5 | `order_created` | text | `messages` · `crm_orders` · `crm_clients` → `customer` · stage → `purchased` |

`order_created` is my addition — without it nothing ever writes `crm_orders`, and the
dashboard's revenue/funnel widgets stay empty. The other four are exactly as you specified.

---

## 2. What is already automatic — do NOT duplicate

The DB does this itself via triggers. Writing these columns by hand causes drift:

| Trigger | Fires on | Effect | Line |
|---|---|---|---|
| `messages_summary_trigger` | INSERT/UPDATE/DELETE on `messages` | recomputes `contacts.last_interaction_at`, `last_message_preview`, `unread_count` | 756 |
| `on_new_contact_create_client` | INSERT on `contacts` | auto-creates the matching `crm_clients` row | 770 |
| `sync_contact_update_to_client` | UPDATE on `contacts` | mirrors contact changes into `crm_clients` | 1222 |
| `trigger_create_activity_from_message` | INSERT on `messages` | creates a `crm_activities` row | 785 |

➡️ **Insert into `messages` and everything above happens for free.** Never set
`last_message_preview` or `unread_count` manually.

---

## 3. Table contracts (verified)

### `messages` — one row per outbound message (line 84)
| Column | Value | Notes |
|---|---|---|
| `organization_id` | `{{ $('Load Channel').item.json.organization_id }}` | **NOT NULL** |
| `channel_id` | `{{ $('Load Channel').item.json.channel_id }}` | **NOT NULL** |
| `contact_id` | `{{ $('Upsert Contact').item.json.id }}` | **NOT NULL**, FK |
| `sender_type` | `ai` | CHECK: `user` \| `agent` \| `ai` \| `system` |
| `content_type` | `text` or `image` | CHECK: `text,image,audio,video,document,sticker,location` (line 1395) |
| `text_content` | the reply | nullable |
| `attachment_url` | image URL | for `content_type='image'` |
| `platform_timestamp` | `{{ DateTime.now().toISO() }}` | nullable |
| `message_platform_id` | Zernio message id | nullable |

⚠️ `delivery_status` defaults to `'sent'` and its CHECK is `pending,sent,delivered,read,failed`.

### `crm_activities` — complaints & handoffs (line 307)
| Column | Value |
|---|---|
| `organization_id` | **NOT NULL** |
| `client_id` | `crm_clients.id` for this contact |
| `activity_type` | `chatbot_interaction` — CHECK: `call,email,meeting,task,note,chatbot_interaction,website_visit` |
| `subject` | **NOT NULL** — e.g. `شكوى من العميل` |
| `description` | `{{ $json.complaint }}` |
| `priority` | `high` — CHECK: `low,medium,high,urgent` |
| `status` | default `pending` — CHECK: `pending,completed,cancelled` |

⚠️ There is **no `complaints` table**. `crm_activities` is the correct home.

### `crm_orders` — after a real order (line 270)
| Column | Value | Notes |
|---|---|---|
| `organization_id` | **NOT NULL** |
| `client_id` | **NOT NULL** → `crm_clients.id` (not `contact_id`) |
| `order_number` | `{{ $json.order.order_number }}` | **NOT NULL** |
| `ecommerce_order_id` | WooCommerce order id | |
| `subtotal` / `total` | from `order` | NUMERIC(12,2) |
| `currency` | **`SAR`** | ⚠️ default is `USD` — must be set explicitly |
| `status` | `pending` | CHECK: `pending,processing,shipped,delivered,cancelled,refunded` |
| `items` | JSONB | optional |

### `crm_clients` (line 162)
- `client_type` CHECK: `lead, prospect, customer, partner, inactive` (default `lead`)
- `lifecycle_stage` CHECK: `lead, mql, sql, opportunity, customer, evangelist, churned`
- `conversation_stage` — see the migration below
- Filter updates by `contact_id`, which is `UNIQUE`.

### RPC `update_client_stage` (line 2250)
```
update_client_stage(p_platform_user_id TEXT, p_channel_id UUID, p_stage TEXT, p_bmi_data JSONB DEFAULT NULL) → JSONB
```
Sets `conversation_stage`, refreshes the `stage:*` tag, returns `{success, client_id, stage}`.
Granted to `service_role`. Returns `{success:false,error:'Contact not found'}` rather than throwing.

---

## 4. ⚠️ Required migration before using stages

`conversation_stage` is constrained (line 2219) to the **previous project's** funnel:
`first_contact, bmi_collected, testimonials_viewed, price_viewed, purchased`.

Our stages (`browsing`, `product_viewed`, `order_placed`, `support`) would be **rejected**.
Also the RPC's tag cleanup hardcodes those five names, so new tags accumulate forever.

➡️ Run **[`bot-dashboard/database/2026-08-11-woocommerce-funnel-stages.sql`](../bot-dashboard/database/2026-08-11-woocommerce-funnel-stages.sql)**
in the Supabase SQL editor. It widens the CHECK (keeping legacy values valid) and makes the
tag cleanup generic. Additive only — nothing is deleted.

**Our funnel:** `first_contact → browsing → product_viewed → order_placed → purchased`,
plus `support` for complaints/handoffs.

---

## 5. Branch-by-branch node plan

Switch node **`Route Intent`** on `{{ $json.intent }}`, fallback → `conversation`.

### 5.1 `conversation`
```
Switch → Send Text (Zernio) → Log Outbound (messages: content_type=text)
```

### 5.2 `product_details`
```
Switch → Get Product Images (HTTP GET http://woocommerce-wrapper:8081/api/products/{{ $json.product_id }})
       → Set images  ={{ { images: $json.images } }}
       → Split Out (field: images)
       → Loop Over Items
           → Send Image (Zernio)  → Log Outbound (content_type=image, attachment_url)
           → Wait 2s              ← avoid gateway rate limits
       → Send Text (the reply)    → Log Outbound (content_type=text)
       → RPC update_client_stage (stage=product_viewed)
```
> The wrapper now returns **`images`** (every gallery URL) alongside `image_url`
> — added 2026-08-11 in `trim.ts`. Rebuild backend B to get it.

### 5.3 `complaint`
```
Switch → Get CRM Client (Supabase crm_clients, filter contact_id = eq …)
       → Create crm_activities row (subject='شكوى من العميل', description={{ $json.complaint }}, priority=high, activity_type=chatbot_interaction)
       → Notify staff (Telegram → notification_config.telegram_complaints_group_id)
       → Send Text → Log Outbound
       → RPC update_client_stage (stage=support)
```

### 5.4 `customer_service`
```
Switch → Update contacts SET ai_enabled=false  (filter id = contact_id)   ← stops the bot
       → Create crm_activities row (subject='طلب تحويل لموظف', activity_type=chatbot_interaction, priority=high)
       → Notify staff (Telegram)
       → Send Text → Log Outbound
       → RPC update_client_stage (stage=support)
```
The inbound branch already gates on `ai_enabled`, so the bot goes silent until an agent
re-enables it from the dashboard.

### 5.5 `order_created`
```
Switch → Get CRM Client (crm_clients where contact_id = …)
       → Update crm_clients (client_type='customer', lifecycle_stage='customer', phone, city, country='SA')
       → Create crm_orders row (client_id, order_number, ecommerce_order_id, subtotal, total, currency='SAR', status='pending')
       → RPC update_client_stage (stage=purchased)
       → Send Text (with payment_url) → Log Outbound
```

---

## 6. Node reference snippets

**Supabase RPC via HTTP Request** (n8n's Supabase node can't call RPCs):
```
POST  https://uorfbqhsaxoofzqouqsj.supabase.co/rest/v1/rpc/update_client_stage
Headers: apikey: <service_role>        Authorization: Bearer <service_role>
Body (JSON):
{
  "p_platform_user_id": "{{ $('Load Channel').item.json.platform_user_id }}",
  "p_channel_id": "{{ $('Load Channel').item.json.channel_id }}",
  "p_stage": "product_viewed"
}
```
⚠️ Do **not** send `Accept: application/vnd.pgrst.object+json` — n8n won't parse that
content type and returns the body as a string.

**Notification routing** — `channel_configurations.notification_config` (line 1359) is
documented as `{ telegram_complaints_group_id, telegram_cancellations_group_id }`; the
dashboard's TS interface adds `telegram_orders_group_id`. Read it from the Load Channel node:
```
{{ $('Load Channel').item.json.notification_config.telegram_complaints_group_id }}
```

---

## 7. Build order

| # | Step | Blocked by |
|---|---|---|
| 1 | Run the funnel-stages migration | — |
| 2 | Rebuild backend B (`images` array) | — |
| 3 | Paste the new system message into the AI Agent | — |
| 4 | Rebuild `Route Intent` Switch to the 5 intents | 3 |
| 5 | Wire `conversation` + `product_details` | 2, 4 |
| 6 | Wire `complaint` + `customer_service` | 4 |
| 7 | Wire `order_created` | 4 |
| 8 | Set `notification_config` group IDs in the dashboard | — |

```bash
cd /www/wwwroot/iconnect && git pull && docker compose up -d --build woocommerce-wrapper
```

---

## 8. Verification

| Test | Expect |
|---|---|
| Say "مرحبا" | reply arrives; `messages` row `sender_type='ai'`; contact preview updates |
| Ask for a product's details | all images arrive; one `messages` row per image; stage = `product_viewed` |
| Complain | `crm_activities` row, priority `high`; Telegram alert; stage = `support` |
| Ask for a human | `contacts.ai_enabled=false`; next message gets **no** bot reply |
| Complete an order | `crm_orders` row, `currency='SAR'`; `client_type='customer'`; stage = `purchased` |

```sql
select id, sender_type, content_type, left(text_content,40), attachment_url
from messages order by sent_at desc limit 10;

select client_type, conversation_stage, tags from crm_clients order by updated_at desc limit 5;

select order_number, total, currency, status from crm_orders order by created_at desc limit 5;
```

---

## 9. Open items

1. **`bmi_data`** (line 2235) is dead weight from the previous project — harmless, left in place.
2. **`content_collections`** exists (line 134) and could hold reusable image sets (offers,
   banners) the bot sends without hitting WooCommerce. Not wired.
3. **Phone-format matching** in `track_order` is still unverified against the live store —
   see `BOT-TOOLS-REVIEW.md` §Logic review.
4. **`crm_deals`** is unused; the funnel currently lives on `crm_clients.conversation_stage`.
