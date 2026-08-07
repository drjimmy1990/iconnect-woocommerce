# Database Schema Documentation

## Overview

This document provides a complete reference for the database schema used in the Chat Dashboard application. The database is built on **PostgreSQL** with **Supabase** and includes comprehensive CRM and analytics capabilities.

## Architecture

- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Row-Level Security (RLS)**: Enabled on all tables
- **Extensions**: `uuid-ossp` for UUID generation
- **Total Tables**: 17 core tables + 5 materialized views

---

## Core Tables

### 1. organizations

Stores organization/company information. Each user belongs to one organization.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique organization identifier |
| name | TEXT | NOT NULL | Organization name |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

**RLS Policies**:
- Users can manage their own organization
- Policy: `organization_id = get_my_organization_id()`

---

### 2. profiles

User profiles linked to Supabase auth users. One profile per user.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE | User ID from Supabase Auth |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization membership |
| full_name | TEXT | NULL | User's full name |
| role | TEXT | NOT NULL, DEFAULT 'admin' | User role |

**RLS Policies**:
- Users can manage their own profile
- Policy: `id = auth.uid()`

**Triggers**:
- `on_auth_user_created`: Automatically creates organization and profile when user signs up

---

### 3. channels

Communication channels (WhatsApp, Facebook, Instagram).

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Channel identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Owner organization |
| name | TEXT | NOT NULL | Channel display name |
| platform | TEXT | NOT NULL | Platform type (whatsapp, facebook, instagram) |
| platform_channel_id | TEXT | UNIQUE | External platform channel ID |
| credentials | JSONB | NULL | Platform API credentials (encrypted) |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Channel active status |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

**RLS Policies**:
- Users can manage channels in their organization

**Related Functions**:
- `create_channel_and_config()`: Creates channel and default configuration

---

### 4. contacts

Individual contacts/users communicating through channels.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Contact identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| channel_id | UUID | NOT NULL, REFERENCES channels(id) ON DELETE CASCADE | Associated channel |
| platform | TEXT | NOT NULL | Platform type |
| platform_user_id | TEXT | NOT NULL | External user ID |
| name | TEXT | NULL | Contact name |
| avatar_url | TEXT | NULL | Profile picture URL |
| ai_enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | AI bot enabled for this contact |
| last_interaction_at | TIMESTAMPTZ | DEFAULT NOW() | Last message timestamp |
| last_message_preview | TEXT | NULL | Preview of last message |
| unread_count | INTEGER | NOT NULL, DEFAULT 0 | Number of unread messages |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Constraints**:
- UNIQUE: `(channel_id, platform_user_id)` - One contact per platform user per channel

**Indexes**:
- `idx_contacts_channel`: On `channel_id`
- `idx_contacts_platform_user`: On `platform_user_id`

**RLS Policies**:
- Users can manage contacts in their organization

**Triggers**:
- `on_new_contact_create_client`: Automatically creates CRM client record
- `messages_summary_trigger`: Updates contact summary when messages change

---

### 5. messages

All messages exchanged in conversations.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Message identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| channel_id | UUID | NOT NULL, REFERENCES channels(id) ON DELETE CASCADE | Channel |
| contact_id | UUID | NOT NULL, REFERENCES contacts(id) ON DELETE CASCADE | Contact |
| message_platform_id | TEXT | NULL | External platform message ID |
| sender_type | TEXT | NOT NULL, CHECK (user, agent, ai, system) | Who sent the message |
| content_type | TEXT | NOT NULL, DEFAULT 'text' | Message type (text, image, audio) |
| text_content | TEXT | NULL | Text content |
| attachment_url | TEXT | NULL | Media attachment URL |
| attachment_metadata | JSONB | NULL | Media metadata |
| is_read_by_agent | BOOLEAN | NOT NULL, DEFAULT FALSE | Read status |
| sent_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Send timestamp |
| platform_timestamp | TIMESTAMPTZ | NULL | Platform's timestamp |

**Indexes**:
- `idx_messages_contact`: On `contact_id`
- `idx_messages_channel`: On `channel_id`
- `idx_messages_sent_at`: On `sent_at`

**RLS Policies**:
- Users can manage messages in their organization

**Triggers**:
- Updates contact summary (last_interaction_at, last_message_preview, unread_count)

---

### 6. channel_configurations

Bot/AI configuration per channel.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| channel_id | UUID | PRIMARY KEY, REFERENCES channels(id) ON DELETE CASCADE | Channel |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| ai_model | TEXT | NOT NULL, DEFAULT 'models/gemini-1.5-flash' | AI model to use |
| ai_temperature | NUMERIC(2,1) | NOT NULL, DEFAULT 0.7 | AI temperature setting |
| is_bot_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Bot active status |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

**RLS Policies**:
- Users can manage configurations in their organization

---

### 7. agent_prompts

AI agent system prompts per channel.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Prompt identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| channel_id | UUID | NOT NULL, REFERENCES channels(id) ON DELETE CASCADE | Channel |
| agent_id | TEXT | NOT NULL | Agent identifier (e.g., 'main_sales_agent') |
| name | TEXT | NOT NULL | Agent display name |
| description | TEXT | NULL | Agent description |
| system_prompt | TEXT | NOT NULL | System prompt for AI |

**Constraints**:
- UNIQUE: `(channel_id, agent_id)`

**RLS Policies**:
- Users can manage agent prompts in their organization

---

### 8. content_collections

Collections of content items for AI responses.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Collection identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| channel_id | UUID | NOT NULL, REFERENCES channels(id) ON DELETE CASCADE | Channel |
| collection_id | TEXT | NOT NULL | Collection identifier |
| name | TEXT | NOT NULL | Collection display name |
| items | TEXT[] | NULL | Array of content items |

**Constraints**:
- UNIQUE: `(channel_id, collection_id)`

**RLS Policies**:
- Users can manage content collections in their organization

---

### 9. keyword_actions

Keyword-based automation rules.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Action identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| channel_id | UUID | NOT NULL, REFERENCES channels(id) ON DELETE CASCADE | Channel |
| keyword | TEXT | NOT NULL | Trigger keyword |
| action_type | TEXT | NOT NULL | Action to perform (e.g., DISABLE_AI, ENABLE_AI) |

**Constraints**:
- UNIQUE: `(channel_id, keyword)`

**RLS Policies**:
- Users can manage keyword actions in their organization

---

## CRM Tables

### 10. crm_clients

Core CRM client/customer records.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Client identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| contact_id | UUID | UNIQUE, REFERENCES contacts(id) ON DELETE SET NULL | Associated contact |
| client_type | TEXT | NOT NULL, DEFAULT 'lead', CHECK | Client type (lead, prospect, customer, partner, inactive) |
| company_name | TEXT | NULL | Company name |
| email | TEXT | NULL | Email address |
| phone | TEXT | NULL | Phone number |
| secondary_phone | TEXT | NULL | Secondary phone |
| address | JSONB | NULL | Address object |
| ecommerce_customer_id | TEXT | NULL | E-commerce platform customer ID |
| total_orders | INTEGER | DEFAULT 0 | Total number of orders |
| total_revenue | NUMERIC(12,2) | DEFAULT 0 | Total revenue generated |
| average_order_value | NUMERIC(12,2) | DEFAULT 0 | Average order value |
| source | TEXT | NULL | Lead source |
| source_details | JSONB | NULL | Additional source details |
| utm_data | JSONB | NULL | UTM tracking data |
| lifecycle_stage | TEXT | DEFAULT 'lead', CHECK | Lifecycle stage (lead, mql, sql, opportunity, customer, evangelist, churned) |
| lead_score | INTEGER | DEFAULT 0 | Lead scoring value |
| lead_quality | TEXT | CHECK | Quality rating (hot, warm, cold) |
| assigned_to | UUID | REFERENCES profiles(id) ON DELETE SET NULL | Assigned agent |
| tags | TEXT[] | NULL | Array of tags |
| custom_fields | JSONB | NULL | Custom field data |
| platform_user_id | TEXT | NULL | Platform user ID (from contact) |
| first_contact_date | TIMESTAMPTZ | DEFAULT NOW() | First contact timestamp |
| last_contact_date | TIMESTAMPTZ | NULL | Last contact timestamp |
| next_follow_up_date | TIMESTAMPTZ | NULL | Next follow-up date |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Constraints**:
- UNIQUE: `(organization_id, ecommerce_customer_id)` when not null

**Indexes**:
- `idx_crm_clients_organization`: On `organization_id`
- `idx_crm_clients_contact`: On `contact_id`
- `idx_crm_clients_type`: On `client_type`
- `idx_crm_clients_assigned`: On `assigned_to`
- `idx_crm_clients_lifecycle`: On `lifecycle_stage`
- `idx_crm_clients_email`: On `email`
- `idx_crm_clients_ecommerce`: On `ecommerce_customer_id`
- `idx_crm_clients_platform_user_id`: On `platform_user_id`

**RLS Policies**:
- Users can manage CRM clients in their organization

**Triggers**:
- `trigger_crm_clients_updated_at`: Auto-updates `updated_at`
- `trigger_update_client_revenue`: Updates revenue metrics when orders change

---

### 11. crm_deals

Sales deals/opportunities.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Deal identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| client_id | UUID | NOT NULL, REFERENCES crm_clients(id) ON DELETE CASCADE | Associated client |
| name | TEXT | NOT NULL | Deal name |
| description | TEXT | NULL | Deal description |
| deal_value | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Deal value |
| currency | TEXT | NOT NULL, DEFAULT 'USD' | Currency code |
| stage | TEXT | NOT NULL, DEFAULT 'prospecting', CHECK | Deal stage (prospecting, qualification, proposal, negotiation, closed_won, closed_lost) |
| probability | INTEGER | DEFAULT 0, CHECK (0-100) | Win probability percentage |
| expected_close_date | DATE | NULL | Expected close date |
| actual_close_date | DATE | NULL | Actual close date |
| products | JSONB | NULL | Products in deal |
| owner_id | UUID | REFERENCES profiles(id) ON DELETE SET NULL | Deal owner |
| lost_reason | TEXT | NULL | Reason if lost |
| lost_reason_details | TEXT | NULL | Additional loss details |
| won_reason | TEXT | NULL | Reason if won |
| competitor | TEXT | NULL | Competitor name |
| tags | TEXT[] | NULL | Deal tags |
| custom_fields | JSONB | NULL | Custom field data |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |
| stage_changed_at | TIMESTAMPTZ | DEFAULT NOW() | Last stage change timestamp |

**Indexes**:
- `idx_crm_deals_organization`: On `organization_id`
- `idx_crm_deals_client`: On `client_id`
- `idx_crm_deals_stage`: On `stage`
- `idx_crm_deals_owner`: On `owner_id`
- `idx_crm_deals_close_date`: On `expected_close_date`

**RLS Policies**:
- Users can manage deals in their organization

**Triggers**:
- `trigger_track_deal_stage_change`: Tracks stage changes to history table

---

### 12. crm_deal_stages_history

Historical record of deal stage changes.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | History record identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| deal_id | UUID | NOT NULL, REFERENCES crm_deals(id) ON DELETE CASCADE | Deal |
| from_stage | TEXT | NULL | Previous stage |
| to_stage | TEXT | NOT NULL | New stage |
| changed_by | UUID | REFERENCES profiles(id) ON DELETE SET NULL | User who made change |
| notes | TEXT | NULL | Change notes |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Change timestamp |

**Indexes**:
- `idx_deal_stages_history_deal`: On `deal_id`
- `idx_deal_stages_history_created`: On `created_at`

**RLS Policies**:
- Users can view deal history in their organization

---

### 13. crm_products

Product catalog for deals and orders.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Product identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| name | TEXT | NOT NULL | Product name |
| description | TEXT | NULL | Product description |
| sku | TEXT | NULL | Stock keeping unit |
| category | TEXT | NULL | Product category |
| price | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Product price |
| cost | NUMERIC(12,2) | NULL | Product cost |
| currency | TEXT | NOT NULL, DEFAULT 'USD' | Currency code |
| ecommerce_product_id | TEXT | NULL | E-commerce platform product ID |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Product active status |
| custom_fields | JSONB | NULL | Custom field data |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Constraints**:
- UNIQUE: `(organization_id, ecommerce_product_id)` when not null

**Indexes**:
- `idx_crm_products_organization`: On `organization_id`
- `idx_crm_products_active`: On `is_active`
- `idx_crm_products_ecommerce`: On `ecommerce_product_id`

**RLS Policies**:
- Users can manage products in their organization

**Triggers**:
- `trigger_crm_products_updated_at`: Auto-updates `updated_at`

---

### 14. crm_orders

Customer orders (E-commerce integration).

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Order identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| client_id | UUID | NOT NULL, REFERENCES crm_clients(id) ON DELETE CASCADE | Client |
| deal_id | UUID | REFERENCES crm_deals(id) ON DELETE SET NULL | Associated deal |
| order_number | TEXT | NOT NULL | Order number |
| ecommerce_order_id | TEXT | NULL | E-commerce platform order ID |
| subtotal | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Order subtotal |
| tax | NUMERIC(12,2) | DEFAULT 0 | Tax amount |
| shipping | NUMERIC(12,2) | DEFAULT 0 | Shipping cost |
| discount | NUMERIC(12,2) | DEFAULT 0 | Discount amount |
| total | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Order total |
| currency | TEXT | NOT NULL, DEFAULT 'USD' | Currency code |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK | Order status (pending, processing, shipped, delivered, cancelled, refunded) |
| items | JSONB | NULL | Order items array |
| shipping_address | JSONB | NULL | Shipping address |
| tracking_number | TEXT | NULL | Shipping tracking number |
| order_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Order date |
| shipped_date | TIMESTAMPTZ | NULL | Shipping date |
| delivered_date | TIMESTAMPTZ | NULL | Delivery date |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Constraints**:
- UNIQUE: `(organization_id, order_number)`

**Indexes**:
- `idx_crm_orders_organization`: On `organization_id`
- `idx_crm_orders_client`: On `client_id`
- `idx_crm_orders_status`: On `status`
- `idx_crm_orders_date`: On `order_date`
- `idx_crm_orders_ecommerce`: On `ecommerce_order_id`

**RLS Policies**:
- Users can manage orders in their organization

**Triggers**:
- `trigger_crm_orders_updated_at`: Auto-updates `updated_at`
- `trigger_update_client_revenue`: Updates client revenue metrics

---

### 15. crm_activities

Activity log (calls, meetings, tasks, chatbot interactions).

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Activity identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| client_id | UUID | REFERENCES crm_clients(id) ON DELETE CASCADE | Associated client |
| deal_id | UUID | REFERENCES crm_deals(id) ON DELETE CASCADE | Associated deal |
| message_id | UUID | REFERENCES messages(id) ON DELETE SET NULL | Associated message |
| activity_type | TEXT | NOT NULL, CHECK | Activity type (call, email, meeting, task, note, chatbot_interaction, website_visit) |
| subject | TEXT | NOT NULL | Activity subject |
| description | TEXT | NULL | Activity description |
| status | TEXT | DEFAULT 'pending', CHECK | Status (pending, completed, cancelled) |
| priority | TEXT | CHECK | Priority (low, medium, high, urgent) |
| due_date | TIMESTAMPTZ | NULL | Due date for tasks |
| completed_at | TIMESTAMPTZ | NULL | Completion timestamp |
| assigned_to | UUID | REFERENCES profiles(id) ON DELETE SET NULL | Assigned user |
| created_by | UUID | REFERENCES profiles(id) ON DELETE SET NULL | Creator |
| metadata | JSONB | NULL | Additional metadata |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_crm_activities_organization`: On `organization_id`
- `idx_crm_activities_client`: On `client_id`
- `idx_crm_activities_deal`: On `deal_id`
- `idx_crm_activities_type`: On `activity_type`
- `idx_crm_activities_assigned`: On `assigned_to`
- `idx_crm_activities_due`: On `due_date`
- `idx_crm_activities_status`: On `status`

**RLS Policies**:
- Users can manage activities in their organization

**Triggers**:
- `trigger_crm_activities_updated_at`: Auto-updates `updated_at`
- `trigger_update_last_contact`: Updates client's last_contact_date
- `trigger_create_activity_from_message` (DISABLED): Creates activity from AI messages

---

### 16. crm_notes

Notes attached to clients or deals.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Note identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| client_id | UUID | REFERENCES crm_clients(id) ON DELETE CASCADE | Associated client |
| deal_id | UUID | REFERENCES crm_deals(id) ON DELETE CASCADE | Associated deal |
| title | TEXT | NULL | Note title |
| content | TEXT | NOT NULL | Note content |
| note_type | TEXT | CHECK | Note type (general, call_log, meeting_summary, important) |
| is_pinned | BOOLEAN | DEFAULT FALSE | Pinned status |
| tags | TEXT[] | NULL | Note tags |
| created_by | UUID | REFERENCES profiles(id) ON DELETE SET NULL | Note creator |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_crm_notes_organization`: On `organization_id`
- `idx_crm_notes_client`: On `client_id`
- `idx_crm_notes_deal`: On `deal_id`
- `idx_crm_notes_pinned`: On `is_pinned`

**RLS Policies**:
- Users can manage notes in their organization

**Triggers**:
- `trigger_crm_notes_updated_at`: Auto-updates `updated_at`

---

### 17. crm_tags

Reusable tags for categorization.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Tag identifier |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization |
| name | TEXT | NOT NULL | Tag name |
| color | TEXT | DEFAULT '#3B82F6' | Tag color (hex) |
| category | TEXT | NULL | Tag category |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Constraints**:
- UNIQUE: `(organization_id, name)`

**Indexes**:
- `idx_crm_tags_organization`: On `organization_id`
- `idx_crm_tags_category`: On `category`

**RLS Policies**:
- Users can manage tags in their organization

---

## Analytics Materialized Views

### analytics_deal_metrics

Aggregated deal metrics for reporting.

**Columns**:
- `organization_id`: UUID
- `stage`: TEXT
- `owner_id`: UUID
- `deal_count`: BIGINT
- `total_value`: NUMERIC
- `avg_deal_size`: NUMERIC
- `won_value`: NUMERIC
- `lost_value`: NUMERIC
- `avg_probability`: NUMERIC
- `avg_deal_cycle_days`: NUMERIC
- `period_month`: TIMESTAMPTZ

**Unique Index**: `(organization_id, stage, owner_id, period_month)`

---

### analytics_client_metrics

Aggregated client metrics by lifecycle stage, type, and source.

**Columns**:
- `organization_id`: UUID
- `lifecycle_stage`: TEXT
- `client_type`: TEXT
- `source`: TEXT
- `assigned_to`: UUID
- `client_count`: BIGINT
- `total_revenue`: NUMERIC
- `avg_revenue_per_client`: NUMERIC
- `avg_orders_per_client`: NUMERIC
- `avg_order_value`: NUMERIC
- `avg_lead_score`: NUMERIC
- `period_month`: TIMESTAMPTZ

**Unique Index**: `(organization_id, lifecycle_stage, client_type, source, assigned_to, period_month)`

---

### analytics_revenue_metrics

Revenue metrics by time period.

**Columns**:
- `organization_id`: UUID
- `total_revenue`: NUMERIC
- `unique_customers`: BIGINT
- `order_count`: BIGINT
- `avg_order_value`: NUMERIC
- `delivered_revenue`: NUMERIC
- `lost_revenue`: NUMERIC
- `period_day`: TIMESTAMPTZ
- `period_week`: TIMESTAMPTZ
- `period_month`: TIMESTAMPTZ
- `period_year`: TIMESTAMPTZ

**Unique Index**: `(organization_id, period_day)`

---

### analytics_chatbot_effectiveness

Chatbot interaction metrics.

**Columns**:
- `organization_id`: UUID
- `unique_clients_engaged`: BIGINT
- `total_chatbot_interactions`: BIGINT
- `successful_interactions`: BIGINT
- `avg_interaction_duration_minutes`: NUMERIC
- `period_day`: TIMESTAMPTZ

**Unique Index**: `(organization_id, period_day)`

---

### analytics_channel_performance

Channel performance metrics.

**Columns**:
- `organization_id`: UUID
- `channel_id`: UUID
- `channel_name`: TEXT
- `platform`: TEXT
- `total_contacts`: BIGINT
- `total_messages`: BIGINT
- `incoming_messages`: BIGINT
- `agent_responses`: BIGINT
- `ai_responses`: BIGINT
- `period_month`: TIMESTAMPTZ

**Unique Index**: `(organization_id, channel_id, period_month)`

---

## Database Functions

### Authentication & Authorization

#### `handle_new_user()`
- **Type**: Trigger Function (SECURITY DEFINER)
- **Purpose**: Automatically creates organization and profile when new user signs up
- **Trigger**: `on_auth_user_created` on `auth.users`

#### `get_my_organization_id()`
- **Type**: SQL Function (STABLE)
- **Returns**: UUID
- **Purpose**: Returns current user's organization_id for RLS policies

---

### Channel Management

#### `create_channel_and_config(channel_name, channel_platform, platform_id)`
- **Type**: PL/pgSQL Function (SECURITY INVOKER)
- **Returns**: JSONB with `{id, organization_id}`
- **Purpose**: Creates new channel and its default configuration

---

### Contact Management

#### `update_contact_summary_on_message()`
- **Type**: Trigger Function (SECURITY DEFINER)
- **Purpose**: Updates contact's last_interaction_at, last_message_preview, and unread_count
- **Trigger**: `messages_summary_trigger` on `messages`

#### `get_contacts_for_channel(p_channel_id, p_search_term)`
- **Type**: PL/pgSQL Function
- **Returns**: TABLE with contact data + crm_client_id
- **Purpose**: Fetches contacts with joined CRM client data (solves RLS join issues)

---

### CRM Functions

#### `create_client_on_new_contact()`
- **Type**: Trigger Function (SECURITY DEFINER)
- **Purpose**: Automatically creates CRM client when contact is created
- **Trigger**: `on_new_contact_create_client` on `contacts`

#### `update_client_revenue()`
- **Type**: Trigger Function
- **Purpose**: Updates client's total_orders, total_revenue, average_order_value
- **Trigger**: `trigger_update_client_revenue` on `crm_orders`

#### `track_deal_stage_change()`
- **Type**: Trigger Function
- **Purpose**: Logs deal stage changes to history table
- **Trigger**: `trigger_track_deal_stage_change` on `crm_deals`

#### `create_activity_from_message()`
- **Type**: Trigger Function
- **Purpose**: Creates activity record from AI messages (CURRENTLY DISABLED)
- **Trigger**: `trigger_create_activity_from_message` on `messages` (DISABLED)

#### `update_last_contact()`
- **Type**: Trigger Function
- **Purpose**: Updates client's last_contact_date when activity is logged
- **Trigger**: `trigger_update_last_contact` on `crm_activities`

#### `update_updated_at()`
- **Type**: Trigger Function
- **Purpose**: Auto-updates updated_at timestamp
- **Triggers**: On `crm_clients`, `crm_products`, `crm_orders`, `crm_activities`, `crm_notes`

---

### Analytics Functions

#### `calculate_client_ltv(client_uuid)`
- **Type**: PL/pgSQL Function (STABLE)
- **Returns**: NUMERIC
- **Purpose**: Calculates lifetime value for a client

#### `calculate_win_rate(org_id, start_date, end_date)`
- **Type**: PL/pgSQL Function (STABLE)
- **Returns**: NUMERIC
- **Purpose**: Calculates win rate percentage for an organization

#### `refresh_all_analytics()`
- **Type**: PL/pgSQL Function
- **Purpose**: Refreshes all materialized views concurrently

#### `get_crm_dashboard_summary(org_id)`
- **Type**: PL/pgSQL Function (SECURITY DEFINER, STABLE)
- **Returns**: TABLE with dashboard KPIs
- **Purpose**: Returns summary metrics for CRM dashboard

#### `get_conversion_funnel(org_id)`
- **Type**: PL/pgSQL Function (SECURITY DEFINER, STABLE)
- **Returns**: TABLE with funnel data
- **Purpose**: Returns conversion funnel metrics by lifecycle stage

---

## Row-Level Security (RLS)

All tables have RLS enabled with organization-based policies. The standard pattern:

```sql
CREATE POLICY "Users can manage data in their organization"
  ON table_name
  FOR ALL
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
```

**Exceptions**:
- `profiles`: Policy uses `id = auth.uid()`
- `organizations`: Policy uses `id = get_my_organization_id()`

---

## Security Hardening

All functions have been hardened with `SET search_path = ''` to prevent SQL injection attacks via search path manipulation.

---

## Schema Version

**Version**: V12 - FEATURE RESTORATION
**Last Updated**: Per database-setup.sql file
**Status**: ✅ Production Ready

---

## Common Query Patterns

### Get all contacts with CRM data
```sql
SELECT * FROM get_contacts_for_channel('channel-uuid', 'search-term');
```

### Get client 360 view
```sql
-- Fetch client
SELECT * FROM crm_clients WHERE id = 'client-uuid';

-- Fetch activities
SELECT * FROM crm_activities WHERE client_id = 'client-uuid' ORDER BY created_at DESC;

-- Fetch notes
SELECT * FROM crm_notes WHERE client_id = 'client-uuid' ORDER BY created_at DESC;
```

### Refresh analytics
```sql
SELECT refresh_all_analytics();
```

---

## Migration Notes

- Tables are created in dependency order
- All foreign keys use `ON DELETE CASCADE` or `ON DELETE SET NULL` appropriately
- Triggers are ordered to prevent conflicts
- Materialized views require manual refresh or scheduled jobs

---

## TypeScript Type Definitions

See `src/lib/api.ts` for complete TypeScript interfaces matching this schema.

---

**End of Schema Documentation**
