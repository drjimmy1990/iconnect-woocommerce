# CRM Simplification — Changelog

> **Date:** 2026-05-22  
> **Branch:** feature/rbac-media-upgrades  
> **⚠️ Run the SQL migration BEFORE deploying the frontend**

---

## What Changed

### 1. Client Types (Simplified)

Old values → New values:

| Old | New |
|-----|-----|
| `lead` | `new` |
| `prospect` | `interested` |
| `customer` | `customer` (no change) |
| `partner` | _(removed)_ |
| `inactive` | `inactive` (no change) |
| _(new)_ | `repeat_customer` |

### 2. Lifecycle Stage — Removed

The `lifecycle_stage` column (`lead → mql → sql → opportunity → customer → evangelist → churned`) has been **dropped entirely**. `client_type` now serves as the single status field.

### 3. Deals Pipeline — Removed

- `crm_deals` table dropped
- `crm_deal_stages_history` table dropped
- `deal_id` column removed from `crm_orders`, `crm_activities`, `crm_notes`
- All deal-related SQL functions dropped (`calculate_win_rate`, `get_deal_trends`, `get_deal_pipeline_snapshot`)
- Deal materialized view dropped (`analytics_deal_metrics`)
- "Deals" tab removed from client detail page
- DealAnalytics removed from analytics dashboard

### 4. E-Commerce Fields — Removed from `crm_clients`

These columns were dropped (never used):

- `ecommerce_customer_id`
- `total_orders`
- `total_revenue`
- `average_order_value`
- `utm_data`
- `source_details`

### 5. Currency — Changed to EGP

All currency displays and defaults changed from `USD` to `EGP`:
- Database defaults on `crm_orders` and `crm_products`
- Dashboard metrics grid
- Client header stats
- PDF export report

### 6. Conversion Funnel — Updated

The conversion funnel now uses `client_type` instead of `lifecycle_stage`. Shows: `new → interested → customer → repeat_customer → inactive`.

---

## Files Changed

### SQL Migration (run first)

| File | What |
|------|------|
| `database/crm_simplification.sql` | Full migration script — run in Supabase SQL Editor |

### Frontend — Types

| File | What |
|------|------|
| `src/lib/api.ts` | Updated `CrmClient` type, removed `CrmDeal` |

### Frontend — Hooks

| File | What |
|------|------|
| `src/hooks/useClient.ts` | Removed deals fetch |
| `src/hooks/useClientList.ts` | Removed lifecycle & revenue filters |
| `src/hooks/useAnalytics.ts` | Removed `useDealMetrics` and `useDealTrends` |

### Frontend — CRM Pages

| File | What |
|------|------|
| `src/app/(app)/clients/page.tsx` | New type colors, replaced lifecycle+revenue columns with source |
| `src/app/(app)/clients/components/ClientFilters.tsx` | Removed lifecycle filter, removed revenue filter, new type options |
| `src/app/(app)/clients/[id]/page.tsx` | Removed "Deals" tab |
| `src/app/(app)/clients/[id]/components/ClientHeader.tsx` | Shows `client_type` instead of `lifecycle_stage` |
| `src/app/(app)/clients/[id]/components/ClientEditModal.tsx` | Removed lifecycle dropdown, new type options |
| `src/app/(app)/clients/[id]/components/ClientOverview.tsx` | Replaced revenue/deals cards with type/source/messages |
| `src/app/(app)/clients/[id]/components/ClientDeals.tsx` | Stubbed out (placeholder) |

### Frontend — CRM Components (embedded chat view)

| File | What |
|------|------|
| `src/components/crm/ClientHeader.tsx` | EGP currency, new type chip colors, removed revenue stat |
| `src/components/crm/tabs/ClientProfile.tsx` | New type dropdown, removed lifecycle dropdown |

### Frontend — Analytics

| File | What |
|------|------|
| `src/app/(app)/analytics/page.tsx` | Removed DealAnalytics component |
| `src/app/(app)/analytics/components/DashboardMetricsGrid.tsx` | EGP currency, "Avg Order" replaces "Open Deals" |
| `src/app/(app)/analytics/components/ExportButton.tsx` | EGP currency, removed deals from PDF |
| `src/app/(app)/analytics/components/DealAnalytics.tsx` | Inlined type (dead code, kept for reference) |

---

## Deploy Steps

```bash
# 1. Run SQL migration in Supabase SQL Editor
#    Copy contents of: database/crm_simplification.sql

# 2. Deploy frontend
cd /www/wwwroot/dashboard
git pull origin feature/rbac-media-upgrades
npm run build
pm2 restart dashboard
rm -rf /www/server/nginx/proxy_cache_dir/*
```
