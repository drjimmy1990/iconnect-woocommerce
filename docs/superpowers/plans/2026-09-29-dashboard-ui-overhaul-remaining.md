# Dashboard UI/UX Overhaul: Remaining Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the visual and functional UI/UX modernization of the remaining `bot-dashboard` pages (Home `/`, Channels `/channels`, Analytics `/analytics`) into a luxury AI SaaS interface with Electric Indigo & Emerald glassmorphic aesthetics, guaranteed zero regressions to Supabase queries, webhooks, or existing bot functionality.

**Architecture:** Build on the existing Next.js App Router, Material UI v6 theme, and Supabase client layer. The overhaul preserves all database queries, RPC contracts (`get_crm_dashboard_summary`, `get_channel_performance_snapshot`, etc.), and channel state toggles while wrapping them in sleek card grids, real-time activity feeds, platform brand cards, and harmonized chart tokens.

**Tech Stack:** Next.js 15 (Turbopack), React 19, Material UI v6 (Emotion), TanStack React Query v5, Supabase Client, TypeScript, Recharts.

---

## Safety & Non-Breaking Invariants

1. **Schema & RPC Immutability:** Never modify or rename any database tables, Supabase RPC functions (`get_crm_dashboard_summary`, `get_revenue_trends`, etc.), or RPC parameters.
2. **Webhook & Channel Contract Safety:** Channel status update logic (`channels.update({ is_active })`) and webhook URLs must remain strictly functional and unchanged.
3. **Hydration Error Prevention:** No HTML `<p>` tags inside `<p>` or `<Typography>` (e.g. MUI `ListItemText` must always specify `component="div"` when holding structured elements).
4. **Bilingual / Arabic Support:** Any user-generated string (customer names, last message preview, order notes) must render with automatic text direction (`dir="auto"`) and proper alignment.
5. **Validation Pipeline:** Every phase requires:
   - GitNexus `impact({ direction: "upstream" })` pre-check
   - `npx tsc --noEmit` clean compilation (zero errors)
   - Visual verification via browser subagent/screenshot on `http://localhost:3000`
   - GitNexus `detect_changes()` post-check
   - Git commit & push to `origin/main`

---

## File Modification Map

- **Phase 5: Home Command Center (`/`)**
  - Modify: `bot-dashboard/src/app/(app)/analytics/components/DashboardMetricsGrid.tsx` (luxury glassmorphic cards, trend badges, gradient borders)
  - Create: `bot-dashboard/src/components/dashboard/RecentActivityFeed.tsx` (live order & message stream with status chips)
  - Modify: `bot-dashboard/src/app/(app)/page.tsx` (AI system status header banner, executive metrics, quick actions with live badges, activity feed)
- **Phase 6: Channels Management Overhaul (`/channels`)**
  - Modify: `bot-dashboard/src/app/(app)/channels/page.tsx` (modern grid of channel cards, platform brand headers, 1-click webhook copy, live active toggle)
- **Phase 7: Analytics & Funnel Polish (`/analytics`)**
  - Modify: `bot-dashboard/src/app/(app)/analytics/page.tsx` (modernized filter control bar, luxury tab pills, harmonized chart backgrounds)

---

### Task 1: Phase 5.1 — Modernize DashboardMetricsGrid with Glassmorphism & Micro-Badges

**Files:**
- Modify: `bot-dashboard/src/app/(app)/analytics/components/DashboardMetricsGrid.tsx`

- [ ] **Step 1: Run GitNexus pre-change impact analysis**
Run `impact` on `DashboardMetricsGrid` to verify blast radius:
Direction: `upstream`, Target: `DashboardMetricsGrid`, Repo: `iconnect-woocommerce`.
Expected risk: `LOW` (used in `page.tsx` and `analytics/page.tsx`).

- [ ] **Step 2: Update DashboardMetricsGrid styling with luxury tokens**
Enhance `DashboardMetricsGrid.tsx`:
- Add subtle 1px border `rgba(255, 255, 255, 0.08)` / `divider` with backdrop filter.
- Modernize hover micro-interaction (`transform: translateY(-3px)`, glow shadow).
- Add secondary helper text for metrics (e.g. "Total Sales", "Active Pipeline", "Auto-Handled").
- Retain exact same props `data`, `channelPerformance`, `selectedChannelId`, `isLoading` and calculation logic.

- [ ] **Step 3: Run TypeScript compilation check**
Run: `npx tsc --noEmit` from `bot-dashboard` directory.
Expected: Exit code 0, zero errors.

- [ ] **Step 4: Verify visually on http://localhost:3000**
Take browser screenshot of `http://localhost:3000` to confirm all 6 metric cards render with sleek icons and typography.

- [ ] **Step 5: Git commit and push**
```bash
git add bot-dashboard/src/app/(app)/analytics/components/DashboardMetricsGrid.tsx
git commit -m "feat(dashboard): modernize DashboardMetricsGrid with glassmorphism and elevated typography"
git push origin main
```

---

### Task 2: Phase 5.2 — Create RecentActivityFeed Component

**Files:**
- Create: `bot-dashboard/src/components/dashboard/RecentActivityFeed.tsx`

- [ ] **Step 1: Create RecentActivityFeed component**
Build `RecentActivityFeed.tsx` that:
- Queries the latest 5 WooCommerce orders (`crm_orders`) with `order_number`, `total`, `currency`, `status`, `created_at`.
- Queries the latest 5 recent customer interactions (`contacts` with `last_interaction_at`, `name`, `platform`, `last_message_preview`).
- Provides tabbed or split view: "Recent Orders" and "Live Conversations".
- Displays order status chips (`pending` warning, `processing` info, `delivered` success).
- Renders customer messages with `dir="auto"` for Arabic readability.
- Has clickable links directly to `/chat` and `/clients`.

- [ ] **Step 2: Run TypeScript compilation check**
Run: `npx tsc --noEmit` from `bot-dashboard` directory.
Expected: Exit code 0, zero errors.

- [ ] **Step 3: Git commit**
```bash
git add bot-dashboard/src/components/dashboard/RecentActivityFeed.tsx
git commit -m "feat(dashboard): create RecentActivityFeed component for orders and messages"
```

---

### Task 3: Phase 5.3 — Upgrade Home Dashboard (`/`) Page Layout

**Files:**
- Modify: `bot-dashboard/src/app/(app)/page.tsx`

- [ ] **Step 1: Run GitNexus pre-change impact analysis**
Run `impact` on `HomePage` to verify blast radius:
Direction: `upstream`, Target: `HomePage`, Repo: `iconnect-woocommerce`.
Expected risk: `LOW`.

- [ ] **Step 2: Integrate executive header, live badges, and RecentActivityFeed into page.tsx**
Update `page.tsx`:
- Header banner: Greeting with store overview, AI Bot Status indicator ("All Systems Operational" with pulsing emerald dot).
- Quick Action cards: Replace plain cards with gradient-tinted luxury action cards with hover lift, badge counters, and direct navigation.
- Embed `RecentActivityFeed` alongside quick actions.
- Ensure 100% responsive grid (`xs: 12, md: 6, lg: 4`).

- [ ] **Step 3: Run TypeScript compilation check**
Run: `npx tsc --noEmit` from `bot-dashboard` directory.
Expected: Exit code 0, zero errors.

- [ ] **Step 4: Visual verification on http://localhost:3000**
Take browser screenshot of `http://localhost:3000` to verify:
- Metrics grid renders properly without layout shift.
- AI status banner looks premium.
- Quick actions and recent activity stream load smoothly.

- [ ] **Step 5: Git commit and push**
```bash
git add bot-dashboard/src/app/(app)/page.tsx
git commit -m "feat(dashboard): transform root page into luxury AI executive command center"
git push origin main
```

---

### Task 4: Phase 6 — Channels Management Modernization (`/channels`)

**Files:**
- Modify: `bot-dashboard/src/app/(app)/channels/page.tsx`

- [ ] **Step 1: Run GitNexus pre-change impact analysis**
Run `impact` on `ChannelsPage` to verify blast radius:
Direction: `upstream`, Target: `ChannelsPage`, Repo: `iconnect-woocommerce`.
Expected risk: `LOW`.

- [ ] **Step 2: Redesign ChannelsPage into a Modern Channel Cards Grid**
Transform `channels/page.tsx`:
- Replace old `Paper > List > ListItem` with a responsive `Grid` of luxury Channel Cards.
- Each Card features:
  - Platform brand color accent bar (WhatsApp Emerald `#25D366`, Instagram Gradient `#E1306C` to `#833AB4`, Facebook `#1877F2`).
  - Channel name, avatar, and platform badge.
  - Channel ID with 1-click copy-to-clipboard button and tooltip.
  - Live AI Bot Switch (`BotToggle`) with clear `ONLINE / ACTIVE` vs `PAUSED` pill badge.
  - Direct action buttons: "⚙️ Configure AI Bot" (links to `/channels/[id]/settings`) and "💬 Open Live Chat".
- Add empty state with modern illustration and "Connect Channel" CTA.
- Keep `handleAddChannel` and `ChannelForm` dialog untouched so channel creation remains 100% intact.

- [ ] **Step 3: Run TypeScript compilation check**
Run: `npx tsc --noEmit` from `bot-dashboard` directory.
Expected: Exit code 0, zero errors.

- [ ] **Step 4: Visual verification on http://localhost:3000/channels**
Navigate to `http://localhost:3000/channels` and capture screenshot:
- Verify channel cards render in grid.
- Verify Bot toggle state and configuration links work properly.

- [ ] **Step 5: Git commit and push**
```bash
git add bot-dashboard/src/app/(app)/channels/page.tsx
git commit -m "feat(channels): overhaul channels page with luxury platform cards and status badges"
git push origin main
```

---

### Task 5: Phase 7 — Analytics & Funnel Polish (`/analytics`)

**Files:**
- Modify: `bot-dashboard/src/app/(app)/analytics/page.tsx`

- [ ] **Step 1: Run GitNexus pre-change impact analysis**
Run `impact` on `AnalyticsPage` to verify blast radius:
Direction: `upstream`, Target: `AnalyticsPage`, Repo: `iconnect-woocommerce`.
Expected risk: `LOW`.

- [ ] **Step 2: Polish AnalyticsPage controls and tab styling**
Update `analytics/page.tsx`:
- Upgrade filter control bar into a sleek floating control deck with rounded pills.
- Style tabs with modern active indicator and smooth background contrast.
- Ensure all chart cards have rounded corners `borderRadius: 3` and subtle border lines matching the rest of the application.
- Preserve all existing date range state, hooks, and export buttons.

- [ ] **Step 3: Run TypeScript compilation check**
Run: `npx tsc --noEmit` from `bot-dashboard` directory.
Expected: Exit code 0, zero errors.

- [ ] **Step 4: Visual verification on http://localhost:3000/analytics**
Navigate to `http://localhost:3000/analytics` and capture screenshots of:
- Overview tab.
- Sales & Revenue tab.
- Channels & AI tab.

- [ ] **Step 5: Git commit and push**
```bash
git add bot-dashboard/src/app/(app)/analytics/page.tsx
git commit -m "feat(analytics): polish analytics control deck, luxury tab navigation, and chart card borders"
git push origin main
```

---

## Verification Checklist

| Phase | Target Area | Key Test | Expected Result |
|---|---|---|---|
| Phase 5 | `/` Home Dashboard | `npx tsc --noEmit` & browser inspection | Metrics + Quick Actions + Recent Activity load without hydration error |
| Phase 6 | `/channels` Management | Toggle bot switch & verify link | Toggle updates Supabase `is_active` correctly; Configure navigates to `/channels/[id]/settings` |
| Phase 7 | `/analytics` Dashboard | Change date range & switch tabs | Charts re-render smoothly with Electric Indigo & Emerald palette |
| Final | Scope Verification | GitNexus `detect_changes()` | Only planned dashboard files modified; no database or backend disruption |
