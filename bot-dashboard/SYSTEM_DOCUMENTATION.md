# System Documentation & Data Guide

This document provides a comprehensive overview of the data recorded in the CRM system and the analytics charts available. Use this guide when building workflows or writing system messages for AI agents to understand what data is available and how to interpret it.

---

## 1. Core Data Entities (What We Record)

### 👤 CRM Clients (`crm_clients`)
The central profile for every person or company you interact with.
*   **Identity**: Name, Company Name, Email, Phone, Secondary Phone.
*   **Location**: Street, City, State, Postal Code, Country.
*   **Status**:
    *   `Lifecycle Stage`: Lead, MQL (Marketing Qualified), SQL (Sales Qualified), Opportunity, Customer, Evangelist, Churned.
    *   `Client Type`: Lead, Prospect, Customer, Partner, Inactive.
    *   `Lead Quality`: Hot, Warm, Cold.
*   **Team**: `Assigned Team` (Group handling the client) and `Assigned To` (Specific agent).
*   **Metrics**: Total Orders, Total Revenue, Average Order Value (Auto-calculated from Orders).
*   **Marketing**: Source (e.g., "Facebook Ads"), UTM Data, Tags.
*   **Timestamps**: First Contact, Last Contact, Next Follow-up.

### 💼 Deals (`crm_deals`)
Sales opportunities in the pipeline.
*   **Basics**: Name, Description, Value, Currency.
*   **Progress**:
    *   `Stage`: Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost.
    *   `Probability`: 0-100% chance of closing.
*   **Dates**: Expected Close Date, Actual Close Date.
*   **Ownership**: Assigned Team, Owner (Agent).
*   **Outcome**: Won Reason, Lost Reason, Competitor info.

### 🛒 Orders (`crm_orders`)
Transactional data (useful for E-commerce integrations).
*   **Details**: Order Number, Subtotal, Tax, Shipping, Discount, Total, Currency.
*   **Status**: 
    *   `status`: pending, processing, shipped, delivered, cancelled, refunded.
    *   `fulfillment_status`: unfulfilled, preparing, ready, fulfilled.
*   **Items**: JSON array of products with name, quantity, price.
*   **Shipping**: JSONB address field (street, city, state, postal_code, country).

### 📅 Activities (`crm_activities`)
Log of all interactions with a client.
*   **Types**: Call, Email, Meeting, Task, Note, Chatbot Interaction, Website Visit.
*   **Details**: Subject, Description, Status (Pending/Completed), Priority.
*   **Urgency**: Items with `priority: 'urgent'` are highlighted in the UI with red accents.
*   **Dates**: Due Date, Completed At.

### 🔔 System Notifications (`system_notifications`)
**Real-time alerts for agents** (popups, sounds, bell badge).
*   **Purpose**: Temporary alerts that trigger instant UI feedback.
*   **Fields**: `type` (handoff/alert/info), `title`, `message`, `is_read`, `client_id`.
*   **State**: Tracks read/unread status per notification.
*   **Security**: RLS policies restrict access to organization members only.

### 💬 Contacts & Messages (`contacts`, `messages`)
Raw chat data from connected channels.
*   **Channels**: WhatsApp, Facebook, Instagram.
*   **Messages**: Text content, Attachments, Sender (User/Agent/AI), Read Status.
*   **AI**: Whether the contact has `AI Enabled` (Bot replies automatically).

---

## 2. Analytics & Charts (What We Visualize)

### 📊 Dashboard Summary
**Purpose**: High-level snapshot of business health.
*   **Total Revenue**: All-time earnings from valid orders.
*   **Active Leads**: Count of clients in Lead lifecycle stage.
*   **Open Deals Value**: Potential revenue currently in the pipeline.
*   **Pending Tasks**: Activities requiring attention.
*   **Messages**: Total chat volume across channels.
*   **AI Rate**: Percentage of messages handled by AI.

### 📉 Conversion Funnel
**Purpose**: Track how well you move people from "Lead" to "Customer".
*   **Visual**: Bar chart showing counts at each `Lifecycle Stage`.
*   **Usage**: Identify bottlenecks. If you have many "Leads" but few "MQLs", your initial engagement needs work.

### 📈 Revenue Trends
**Purpose**: Analyze financial growth over time.
*   **Visual**: Line chart showing Revenue vs. Time (Daily/Weekly/Monthly).
*   **Data Points**: Total Revenue, Order Count, Average Order Value.
*   **Usage**: Spot seasonal trends or the impact of marketing campaigns.

### 📊 Deal Pipeline Snapshot
**Purpose**: View the current state of your sales team.
*   **Visual**: Bar chart showing Total Value per Deal Stage.
*   **Usage**: "We have $50k in Negotiation—let's focus on closing those this week."

### 📈 Deal Trends (Velocity)
**Purpose**: Measure sales activity.
*   **Visual**: Line chart showing New Deals Created vs. Time.
*   **Usage**: Are we generating enough new opportunities to meet future targets?

### 💬 Message Volume Trends
**Purpose**: Monitor support/chat load and AI efficiency.
*   **Visual**: Multi-line chart showing Total Messages, AI Responses, and Agent Responses.
*   **Usage**:
    *   High AI Responses + Low Agent Responses = Bot is handling the load well.
    *   Spike in Total Messages = Potential viral event or issue.

### 📢 Channel Performance
**Purpose**: Compare effectiveness of different platforms.
*   **Visual**: Pie chart comparing WhatsApp vs. Facebook vs. Instagram.
*   **Metrics**: Total Contacts, Total Messages, Engagement Rate.
*   **Usage**: "Most of our leads come from WhatsApp; let's increase ad spend there."

---

## 3. Usage Guide for Agents & Workflows

### System Prompts
When designing an AI agent, you can give it context based on this data:

*   **Role**: "You are a sales assistant for [Organization Name]."
*   **Context**: "You are talking to [Client Name], who is currently a [Lifecycle Stage]. They have spent $[Total Revenue] with us."
*   **Goal**:
    *   If `Lifecycle Stage` is 'Lead' -> "Qualify them and move to MQL."
    *   If `Lifecycle Stage` is 'Customer' -> "Upsell new products or ask for a referral."
    *   If `Lead Quality` is 'Hot' -> "Prioritize immediate response and schedule a meeting."

### Workflow Triggers
Use these data points to trigger automations (e.g., in n8n):

1.  **New Lead**: When a new `contact` is created -> Create a `crm_client` -> Send welcome message.
2.  **High Value Deal**: When a `deal` value > $10,000 -> Notify the "VIP Sales Team" (using `assigned_team`).
3.  **Stalled Deal**: When a deal stays in 'Proposal' stage for > 7 days -> Create a `crm_activity` (Task) for the agent to follow up.
4.  **Churn Risk**: When a 'Customer' hasn't had an `activity` or `message` in > 90 days -> Tag as 'At Risk' and alert success team.
5.  **Handoff Request**: **(See Section 6 for the Dual-Write Integration Pattern)**.

### Team Assignment
*   **Routing**: You can route clients to specific teams based on `city`, `country`, or `source`.
    *   *Example*: "If Country is 'USA', assign to 'US Sales Team'."

---

## 4. Client Lifecycle & Management Logic

This section details the logic flow of a client from initial creation to becoming a loyal customer.

### A. Creation (Entry Points)
1.  **Automatic (Inbound)**:
    *   **Trigger**: A new user sends a message via WhatsApp, Facebook, or Instagram.
    *   **System Action**:
        *   Creates a `Contact` record.
        *   Database Trigger (`create_client_on_new_contact`) automatically creates a linked `CRM Client` profile.
    *   **Initial State**: `Lifecycle Stage` = 'Lead', `Client Type` = 'Lead'.
2.  **Manual (Outbound)**:
    *   **Trigger**: Agent manually adds a person.
    *   **Usage**: For cold calling or importing lists.

### B. Modification & Enrichment
Agents and Systems continuously enrich the client profile:
*   **Profile Updates**: Agents use the "Edit Client" modal to add:
    *   **Address**: Street, City, Country (Crucial for logistics and geo-segmentation).
    *   **Tags**: Flexible labels (e.g., "VIP", "Wholesale", "Urgent") for filtering.
    *   **Team Assignment**: Handing off the client to a specialized team.
*   **Automatic Updates**:
    *   **Last Contact**: Automatically updated whenever a new Message or Activity is logged.
    *   **Revenue Metrics**: Automatically recalculated when a `CRM Order` is added or updated.

### C. Lifecycle Stages (The Recommended Flow)

1.  **Lead** (Default)
    *   *Definition*: New contact, unverified interest.
    *   *Goal*: Engage and qualify.
2.  **MQL (Marketing Qualified Lead)**
    *   *Definition*: User has shown specific interest (e.g., asked about pricing, clicked ad).
    *   *Action*: Tag as 'MQL', notify Sales Team.
3.  **SQL (Sales Qualified Lead)**
    *   *Definition*: Sales team has verified budget and intent.
    *   *Action*: **Create a Deal**.
4.  **Opportunity**
    *   *Definition*: Active negotiation in progress.
    *   *Logic*: The client has an open Deal.
5.  **Customer**
    *   *Definition*: Deal won or Purchase made.
    *   *Logic*: System auto-updates revenue. Agent moves stage to 'Customer'.
6.  **Evangelist**
    *   *Definition*: Loyal customer who refers others.
    *   *Action*: Add to "VIP" tag, invite to referral program.
7.  **Churned**
    *   *Definition*: Customer who stopped buying or cancelled.
    *   *Action*: Trigger re-engagement campaign.

### D. Deal & Order Logic
*   **Deals**: Represents the *process* of selling.
    *   *Note*: Changing a Deal Stage (e.g., to 'Closed Won') does *not* automatically change the Client Stage to 'Customer'. This is intentional to allow flexibility.
    *   *Best Practice*: Manually update Client Stage to match the Deal status.
*   **Orders**: Represents the *result* of selling.
    *   *Automation*: The database automatically sums up all valid orders to keep the Client's `LTV` (Lifetime Value) up to date.

---

## 5. Order Management System

### Order Manager (Client Profile Tab)
A dedicated "Orders" tab in the Client Profile allows agents to:
*   **View Order History**: See all orders for a client with expandable details
*   **Create New Orders**: Full order form with line items, financial breakdown, and shipping

### Order Data Structure
*   **Financial Fields**: Subtotal, Tax, Shipping, Discount, Total, Currency
*   **Status Tracking**: 
    *   `status`: pending, processing, shipped, delivered, cancelled, refunded
    *   `fulfillment_status`: unfulfilled, preparing, ready, fulfilled
*   **Line Items**: Array of products with name, quantity, price
*   **Shipping Address**: JSONB field with street, city, state, postal_code, country
*   **Dates**: Order Date, Shipped Date, Delivered Date

### Usage
1. Navigate to Client Profile → Orders tab
2. Click "Create Order" to add new orders
3. Expand rows to see full order details including line items and shipping info

---

## 6. Notification System (Real-Time Alerts)

### Overview
Real-time notification system for agent handoffs, urgent tasks, and system alerts powered by **Supabase Realtime**.

### ⚠️ The "Dual-Write" Integration Pattern (CRITICAL)

For critical events like **Handoffs**, your n8n workflow **MUST write to TWO tables** to ensure the system works correctly:

| Step | Table | Purpose | Key Fields |
|------|-------|---------|------------|
| 1. **The Record** | `crm_activities` | Permanent entry in Client Timeline | `activity_type: 'task'`, `priority: 'urgent'`, `subject: 'Handoff Required'` |
| 2. **The Alert** | `system_notifications` | Triggers popup, sound, and badge | `type: 'handoff'`, `title: 'Human Needed'`, `is_read: false` |

**Why Both?**
*   If you only write to `crm_activities`: No popup or sound. Agent might miss the handoff.
*   If you only write to `system_notifications`: No permanent record. History is lost after clearing notifications.

### n8n SQL Example
```sql
-- Step 1: Create the permanent record (Timeline)
INSERT INTO crm_activities (client_id, organization_id, activity_type, subject, description, priority, status)
VALUES ('client-uuid', 'org-uuid', 'task', 'Handoff Required', 'Client requested human agent', 'urgent', 'pending');

-- Step 2: Create the instant alert (Popup)
INSERT INTO system_notifications (client_id, organization_id, type, title, message)
VALUES ('client-uuid', 'org-uuid', 'handoff', 'Human Needed', 'Client requested to speak with a manager');
```

### Notification Types
| Type | Description | Icon |
|------|-------------|------|
| `handoff` | AI requests human agent takeover | 🔴 Priority High |
| `alert` | System warnings or issues | ⚠️ Warning |
| `info` | General information | ℹ️ Info |

### Features
*   **Real-Time**: Instant popup when new notification arrives (via Supabase Realtime)
*   **Mute Toggle**: Agents can enable "Do Not Disturb" mode
    *   ⚠️ **Note**: This preference is stored in **Browser LocalStorage**. If an agent switches computers/browsers, they will need to mute again.
*   **Sound Alert**: Optional notification sound (`/sounds/notification.mp3`)
*   **Click-to-Navigate**: Clicking a notification opens the relevant client profile
*   **Mark as Read**: Individual or bulk mark-as-read functionality

### Database Schema
```sql
CREATE TABLE system_notifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES crm_clients(id) ON DELETE SET NULL,
    type TEXT NOT NULL,        -- 'handoff', 'alert', 'info'
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies ensure users only see their organization's notifications
-- Realtime is enabled for instant delivery
```

---

## 7. Analytics Dashboard

### Overview
Comprehensive analytics with tabbed interface and real-time filtering.

### Tabs
1. **Overview**: Key metrics + Revenue/Deal/Funnel/Channel charts
2. **Sales & Revenue**: Deep-dive into revenue trends and deal analysis
3. **Channels & AI**: Message volume, AI effectiveness, channel comparison
4. **Clients**: Client metrics and segmentation data

### Filtering Controls
*   **Period**: Daily / Weekly / Monthly aggregation
*   **Date Range**: Last 7/30/90 days or Custom range
*   **Channel Filter**: Filter all data by specific channel

### Metrics Grid (3×2 Layout)
| Metric | Description | Gradient |
|--------|-------------|----------|
| Revenue | Total from closed deals/orders | Purple → Violet |
| Leads | Count of clients in Lead stage | Teal → Green |
| Open Deals | Total value of deals in pipeline | Blue → Cyan |
| Tasks | Pending activities count | Pink → Red |
| Messages | Total messages across channels | Pink → Yellow |
| AI Rate | Percentage of AI-handled responses | Lavender → Pink |

### Empty States
All charts display styled empty states with:
*   Relevant icon in colored circular background
*   Descriptive title (e.g., "No Revenue Data Yet")
*   Helpful subtitle explaining what will appear

---

## 8. Client Timeline & Urgent Highlighting

### Timeline Features
The Client Timeline shows all activities and optionally messages in chronological order.

### Filters
*   **Type Chips**: All, Notes, Calls, Deals
*   **Message Toggle**: Show/hide raw chat messages interleaved with activities

### Urgent Item Highlighting
Activities with `priority: 'urgent'` receive special visual treatment:
*   **Red accent bar** on the left border (`borderLeft: 4px solid error.main`)
*   **Priority High icon** (red exclamation mark)
*   **Light red background** for visibility

### Usage in n8n
When AI requests handoff, create an urgent activity:
```sql
INSERT INTO crm_activities (client_id, organization_id, activity_type, subject, description, priority)
VALUES ('client-uuid', 'org-uuid', 'task', 'Human Intervention Needed', 'Client requested manager', 'urgent');
```

---

## 9. UI/UX Design Patterns

### Card Styling
*   Border radius: `borderRadius: 3` (12px)
*   Border: `1px solid divider`
*   Hover effect: `translateY(-2px)` + subtle shadow (`0 8px 25px rgba(0,0,0,0.08)`)

### Gradient Icons (Metrics)
Used on metric card icons to distinguish categories visually.

### Loading States
*   Skeleton animations for charts and cards
*   Consistent `Skeleton` component usage from MUI
*   Circular skeleton for pie charts

### Responsive Layout
*   Mobile: 2 columns (`xs: 6`)
*   Tablet: 3 columns (`sm: 4`)
*   Desktop: 3 columns (`md: 4`)

### Empty State Pattern
```tsx
<Paper sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.1 }}>
        <Icon sx={{ fontSize: 48, color: 'primary.main' }} />
    </Box>
    <Typography variant="h6">No Data Yet</Typography>
    <Typography variant="body2" color="text.disabled">Helpful explanation</Typography>
</Paper>
```

---

## 10. File Structure Reference

### Providers (`src/providers/`)
| File | Purpose |
|------|---------|
| `AuthProvider.tsx` | Authentication context |
| `ChannelProvider.tsx` | Active channel state |
| `NotificationProvider.tsx` | Realtime subscription, sounds, toasts |
| `QueryProvider.tsx` | TanStack Query setup |
| `UIProvider.tsx` | Sidebar state |

### Key Components
| Location | Purpose |
|----------|---------|
| `src/components/layout/AppHeader.tsx` | Top bar with NotificationBell |
| `src/components/layout/NotificationBell.tsx` | Notification dropdown |
| `src/components/crm/OrderDialog.tsx` | Create order modal |

### Analytics Components (`src/app/(app)/analytics/components/`)
| File | Chart Type |
|------|------------|
| `DashboardMetricsGrid.tsx` | 3×2 metrics cards |
| `RevenueAnalytics.tsx` | Revenue line chart |
| `ConversionFunnel.tsx` | Funnel bar chart |
| `DealAnalytics.tsx` | Pipeline + trend charts |
| `ChannelPerformance.tsx` | Channel pie chart |
| `MessageDistributionChart.tsx` | Message volume trends |

### Client Profile Components (`src/app/(app)/clients/[id]/components/`)
| File | Purpose |
|------|---------|
| `ClientOrders.tsx` | Orders tab with expandable history |
| `ClientTimeline.tsx` | Activity timeline with urgent highlighting |

---

## Appendix A: Complete Database Enum Types

All supported values for CHECK constraint fields in the database schema.

### Messages (`messages`)
| Field | Allowed Values |
|-------|----------------|
| `sender_type` | `user`, `agent`, `ai`, `system` |
| `content_type` | `text`, `image`, `audio`, `video`, `document`, `location`, `sticker` |

### CRM Clients (`crm_clients`)
| Field | Allowed Values |
|-------|----------------|
| `client_type` | `lead`, `prospect`, `customer`, `partner`, `inactive` |
| `lifecycle_stage` | `lead`, `mql`, `sql`, `opportunity`, `customer`, `evangelist`, `churned` |
| `lead_quality` | `hot`, `warm`, `cold` |

### CRM Deals (`crm_deals`)
| Field | Allowed Values |
|-------|----------------|
| `stage` | `prospecting`, `qualification`, `proposal`, `negotiation`, `closed_won`, `closed_lost` |
| `probability` | `0` to `100` (integer) |

### CRM Orders (`crm_orders`)
| Field | Allowed Values |
|-------|----------------|
| `status` | `pending`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded` |
| `fulfillment_status` | `unfulfilled`, `preparing`, `ready`, `fulfilled` |

### CRM Activities (`crm_activities`)
| Field | Allowed Values |
|-------|----------------|
| `activity_type` | `call`, `email`, `meeting`, `task`, `note`, `chatbot_interaction`, `website_visit` |
| `status` | `pending`, `completed`, `cancelled` |
| `priority` | `low`, `medium`, `high`, `urgent` |

### CRM Notes (`crm_notes`)
| Field | Allowed Values |
|-------|----------------|
| `note_type` | `general`, `call_log`, `meeting_summary`, `important` |

### System Notifications (`system_notifications`)
| Field | Allowed Values |
|-------|----------------|
| `type` | `handoff`, `alert`, `info` |

### Channels (`channels`)
| Field | Supported Values |
|-------|------------------|
| `platform` | `whatsapp`, `facebook`, `instagram`, `telegram`, `web` |

---

## Appendix B: JSONB Field Structures

### Address (Client/Shipping)
```json
{
  "street": "123 Main St",
  "city": "Cairo",
  "state": "Cairo Governorate",
  "postal_code": "11511",
  "country": "Egypt"
}
```

### Order Items (`crm_orders.items`)
```json
[
  {
    "name": "Product Name",
    "quantity": 2,
    "price": 99.99,
    "sku": "SKU-001"
  }
]
```

### UTM Data (`crm_clients.utm_data`)
```json
{
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "utm_term": "discount",
  "utm_content": "banner_ad"
}
```

### Custom Fields (`crm_clients.custom_fields`)
```json
{
  "preferred_language": "ar",
  "loyalty_tier": "gold",
  "birthday": "1990-05-15"
}
```

### Attachment Metadata (`messages.attachment_metadata`)
```json
{
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 1048576
}
```
