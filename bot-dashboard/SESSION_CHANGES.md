# Session Changes — May 22–23, 2026

## Summary of All Changes Made

---

## 1. Fallback AI Model & Temperature

**Files Changed:**
- `src/hooks/useChannelConfig.ts` — Added `fallback_model` and `fallback_temperature` to `ChannelConfig` interface
- `src/components/settings/GeneralSettings.tsx` — Added fallback model text field + temperature slider below a divider in the General Settings section

**SQL Migration Required:**
- `database/add_fallback_model.sql` — Adds `fallback_model TEXT` and `fallback_temperature REAL` columns to `channel_configurations`

---

## 2. Bot On/Off Toggle in Channel List

**Files Changed:**
- `src/app/(app)/channels/page.tsx` — Added a green toggle switch (`<Switch>`) next to each channel's "Configure" button
  - Reads `is_bot_active` from `channel_configurations`
  - Optimistic toggle with rollback on error
  - Tooltip shows current state ("Bot is ON/OFF")
  - No SQL needed — uses existing `is_bot_active` column

---

## 3. Default Keywords Changed: start/stop → 9/8

**Files Changed:**
- `src/hooks/useChannels.ts` — Default keywords for new channels changed from `start`→ENABLE_AI / `stop`→DISABLE_AI to `9`→ENABLE_AI / `8`→DISABLE_AI

**SQL Migration Required:**
- `database/update_default_keywords.sql` — Updates existing channels' keyword_actions from `start`/`stop` to `9`/`8`

---

## 4. Keyword Actions Manager Redesign

**Files Changed:**
- `src/components/settings/KeywordActionsManager.tsx` — Complete redesign:
  - **AI Control Keywords** (top section): Protected with lock icon, can't be deleted, can edit the trigger keyword
    - 🔒 Stop AI (red chip) — keyword `8` → DISABLE_AI
    - 🔒 Start AI (green chip) — keyword `9` → ENABLE_AI
  - **Custom Variables** (middle): Clean Name/Value layout with edit + delete buttons
  - **Add New Variable** (bottom): Name + Value fields with Add button

---

## 5. Analytics Overhaul — Conversation Funnel + BMI Tracking

### Database Changes (SQL Migration Required)
- `database/analytics_overhaul.sql`:
  - **`conversation_stage`** column on `crm_clients` — tracks where client is in the bot sales funnel:
    - `first_contact` → `bmi_collected` → `testimonials_viewed` → `price_viewed` → `purchased`
  - **`bmi_data`** JSONB column — stores `{"weight": 87, "height": 175, "age": 30, "bmi": 28.4}`
  - **`update_client_stage()`** RPC function — for n8n bot to push stage updates + BMI data via HTTP
  - **`get_conversation_funnel()`** RPC function — powers the analytics funnel chart (with drop-off tracking)
  - **Updated `get_crm_dashboard_summary()`** — removed dead deal fields, added `bmi_collected_count` and `price_viewed_count`

### Frontend Changes
- `src/hooks/useAnalytics.ts`:
  - Removed deal fields from `DashboardSummary` interface (`total_deals`, `open_deals_value`, `closed_won_deals`)
  - Added `bmi_collected_count` and `price_viewed_count` to `DashboardSummary`
  - Added `useConversationFunnel` hook
  - Added `useClientTypeDistribution` hook
  - Added `ConversationFunnelStep` and `ClientTypeDistribution` interfaces

- `src/app/(app)/analytics/components/ConversationFunnelChart.tsx` — **NEW**
  - Horizontal bar funnel chart showing each stage with drop-off rates
  - Color-coded transition chips at bottom (green >50%, yellow >25%, red <25%)
  - Overall conversion rate chip in header

- `src/app/(app)/analytics/components/ClientMetrics.tsx` — **NEW** (was missing, causing build error)
  - Pie chart showing client type distribution (new/interested/customer/repeat_customer/inactive)
  - Conversation funnel chart side-by-side

- `src/app/(app)/analytics/page.tsx` — Updated `ClientMetrics` to receive filter props (channel, date range)

---

## n8n Bot Integration — Stage Update API

The bot should call this endpoint at each conversation milestone:

```
POST https://<project>.supabase.co/rest/v1/rpc/update_client_stage
Headers:
  Authorization: Bearer <service_role_key>
  apikey: <anon_key>
  Content-Type: application/json
```

### Stage Transitions:

| When | Call with |
|------|----------|
| Bot collects weight/height/age | `{"p_platform_user_id": "ID", "p_channel_id": "UUID", "p_stage": "bmi_collected", "p_bmi_data": {"weight": 87, "height": 175, "age": 30, "bmi": 28.4}}` |
| Bot shows testimonials | `{"p_platform_user_id": "ID", "p_channel_id": "UUID", "p_stage": "testimonials_viewed"}` |
| Bot shows price | `{"p_platform_user_id": "ID", "p_channel_id": "UUID", "p_stage": "price_viewed"}` |
| Client purchases | `{"p_platform_user_id": "ID", "p_channel_id": "UUID", "p_stage": "purchased"}` |

---

## SQL Migrations to Run (in order)

1. `database/add_fallback_model.sql` — Fallback AI model columns
2. `database/update_default_keywords.sql` — Update existing keywords 8/9
3. `database/analytics_overhaul.sql` — Conversation stage, BMI data, funnel functions

## Deploy Steps

```bash
# 1. Run SQL migrations in Supabase SQL Editor (3 files above)

# 2. Deploy frontend
cd /www/wwwroot/dashboard
git pull origin feature/rbac-media-upgrades
npm run build
pm2 restart dashboard
rm -rf /www/server/nginx/proxy_cache_dir/*
```
