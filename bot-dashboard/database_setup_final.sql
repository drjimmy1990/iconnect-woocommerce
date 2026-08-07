-- ====================================================================
--          DEFINITIVE MASTER SCHEMA (FINAL INTEGRATED VERSION)
--          Includes: Core, CRM, Analytics, Automation, RLS, & Permissions
-- ====================================================================

-- ====================================================================
-- SECTION 1: EXTENSIONS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- ====================================================================
-- SECTION 2: CORE TABLES & AUTH
-- ====================================================================

-- 1. Organizations
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 1.5. Teams (New Feature)
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. Profiles (Linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    team_id UUID REFERENCES public.teams (id) ON DELETE SET NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Channels
CREATE TABLE public.channels (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_channel_id TEXT UNIQUE,
    credentials JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- 4. Contacts
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    unread_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_contact_per_channel UNIQUE (channel_id, platform_user_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 5. Messages
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
    message_platform_id TEXT,
    sender_type TEXT NOT NULL CHECK (
        sender_type IN (
            'user',
            'agent',
            'ai',
            'system'
        )
    ),
    content_type TEXT NOT NULL DEFAULT 'text',
    text_content TEXT,
    attachment_url TEXT,
    attachment_metadata JSONB,
    is_read_by_agent BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    platform_timestamp TIMESTAMPTZ
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. AI & Configuration Tables
CREATE TABLE public.channel_configurations (
    channel_id UUID PRIMARY KEY REFERENCES public.channels (id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    ai_model TEXT NOT NULL DEFAULT 'models/gemini-1.5-flash',
    ai_temperature NUMERIC(2, 1) NOT NULL DEFAULT 0.7,
    is_bot_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.channel_configurations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agent_prompts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    UNIQUE (channel_id, agent_id)
);

ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.content_collections (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL,
    name TEXT NOT NULL,
    items TEXT[],
    UNIQUE(channel_id, collection_id)
);

ALTER TABLE public.content_collections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.keyword_actions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    action_type TEXT NOT NULL,
    UNIQUE (channel_id, keyword)
);

ALTER TABLE public.keyword_actions ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- SECTION 3: CRM CORE TABLES
-- ====================================================================

-- 1. CRM Clients
CREATE TABLE public.crm_clients (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID UNIQUE REFERENCES public.contacts(id) ON DELETE SET NULL,
  client_type TEXT NOT NULL DEFAULT 'lead' CHECK (client_type IN ('lead', 'prospect', 'customer', 'partner', 'inactive')),
  company_name TEXT,
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  address JSONB,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  platform_user_id TEXT, -- Added specifically for V3 logic
  ecommerce_customer_id TEXT,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(12, 2) DEFAULT 0,
  average_order_value NUMERIC(12, 2) DEFAULT 0,
  source TEXT,
  source_details JSONB,
  utm_data JSONB,
  lifecycle_stage TEXT DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'churned')),
  lead_score INTEGER DEFAULT 0,
  lead_quality TEXT CHECK (lead_quality IN ('hot', 'warm', 'cold')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_team UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tags TEXT[],
  custom_fields JSONB,
  first_contact_date TIMESTAMPTZ DEFAULT NOW(),
  last_contact_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_ecommerce_customer UNIQUE (organization_id, ecommerce_customer_id)
);

ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

-- 2. CRM Deals
CREATE TABLE public.crm_deals (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    deal_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    stage TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    products JSONB,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_team UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    lost_reason TEXT,
    lost_reason_details TEXT,
    won_reason TEXT,
    competitor TEXT,
    tags TEXT[],
    custom_fields JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stage_changed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- 3. CRM Deal History
CREATE TABLE public.crm_deal_stages_history (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES public.crm_deals (id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_deal_stages_history ENABLE ROW LEVEL SECURITY;

-- 4. CRM Products
CREATE TABLE public.crm_products (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    category TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost NUMERIC(12, 2),
    currency TEXT NOT NULL DEFAULT 'USD',
    ecommerce_product_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    custom_fields JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_ecommerce_product UNIQUE (
        organization_id,
        ecommerce_product_id
    )
);

ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;

-- 5. CRM Orders
CREATE TABLE public.crm_orders (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.crm_clients (id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals (id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    ecommerce_order_id TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(12, 2) DEFAULT 0,
    shipping NUMERIC(12, 2) DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded'
        )
    ),
    items JSONB,
    shipping_address JSONB,
    tracking_number TEXT,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shipped_date TIMESTAMPTZ,
    delivered_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_order_number UNIQUE (organization_id, order_number)
);

ALTER TABLE public.crm_orders ENABLE ROW LEVEL SECURITY;

-- 6. CRM Activities
CREATE TABLE public.crm_activities (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.crm_clients (id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals (id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages (id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (
        activity_type IN (
            'call',
            'email',
            'meeting',
            'task',
            'note',
            'chatbot_interaction',
            'website_visit'
        )
    ),
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'completed',
            'cancelled'
        )
    ),
    priority TEXT CHECK (
        priority IN (
            'low',
            'medium',
            'high',
            'urgent'
        )
    ),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- 7. CRM Notes
CREATE TABLE public.crm_notes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    note_type TEXT CHECK (note_type IN ('general', 'call_log', 'meeting_summary', 'important')),
    is_pinned BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

-- 8. CRM Tags
CREATE TABLE public.crm_tags (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tag_per_org UNIQUE (organization_id, name)
);

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- SECTION 4: INDEXES
-- ====================================================================

-- CRM & Contacts Indexes
CREATE INDEX idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);

CREATE INDEX idx_crm_clients_company_name_trgm ON public.crm_clients USING gin (company_name gin_trgm_ops);

CREATE INDEX idx_messages_sent_at_contact ON public.messages (contact_id, sent_at DESC);

CREATE INDEX idx_crm_activities_created_at_client ON public.crm_activities (client_id, created_at DESC);

CREATE INDEX idx_crm_clients_organization ON public.crm_clients (organization_id);

CREATE INDEX idx_crm_clients_contact ON public.crm_clients (contact_id);

CREATE INDEX idx_crm_clients_email ON public.crm_clients (email);

CREATE INDEX idx_crm_clients_platform_user_id ON public.crm_clients (platform_user_id);

CREATE INDEX idx_crm_deals_organization ON public.crm_deals (organization_id);

CREATE INDEX idx_crm_deals_stage ON public.crm_deals (stage);

CREATE INDEX idx_crm_orders_organization ON public.crm_orders (organization_id);

CREATE INDEX idx_crm_activities_organization ON public.crm_activities (organization_id);

-- ====================================================================
-- SECTION 5: FUNCTIONS (CORE, HELPERS, & ANALYTICS)
-- ====================================================================

-- 1. Get Organization ID (Helper)
CREATE OR REPLACE FUNCTION public.get_my_organization_id() 
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ 
    SELECT organization_id FROM public.profiles WHERE id = auth.uid(); 
$$;

-- 1.5. Get Team Members (Helper)
CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id UUID)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        u.email::TEXT,
        p.role
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.team_id = p_team_id;
END;
$$;

-- 2. Handle New User (Auth Hook)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ 
DECLARE new_org_id UUID; 
BEGIN 
    INSERT INTO public.organizations (name) VALUES (NEW.email || '''s Organization') RETURNING id INTO new_org_id; 
    INSERT INTO public.profiles (id, organization_id) VALUES (NEW.id, new_org_id); 
    RETURN NEW; 
END; 
$$;

-- 3. Create Channel Helper
CREATE OR REPLACE FUNCTION public.create_channel_and_config(channel_name TEXT, channel_platform TEXT, platform_id TEXT) 
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE caller_org_id UUID; new_channel_id UUID;
BEGIN
    SELECT organization_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN RAISE EXCEPTION 'Could not determine organization for the current user.'; END IF;
    INSERT INTO public.channels (organization_id, name, platform, platform_channel_id) VALUES (caller_org_id, channel_name, channel_platform, platform_id) RETURNING id INTO new_channel_id;
    INSERT INTO public.channel_configurations (channel_id, organization_id) VALUES (new_channel_id, caller_org_id);
    RETURN jsonb_build_object('id', new_channel_id, 'organization_id', caller_org_id);
END;
$$;

-- 4. RPC: Get Contacts with CRM ID
CREATE OR REPLACE FUNCTION get_contacts_for_channel(p_channel_id UUID, p_search_term TEXT DEFAULT '')
RETURNS TABLE (
  id UUID, organization_id UUID, channel_id UUID, platform TEXT, platform_user_id TEXT, name TEXT, avatar_url TEXT, ai_enabled BOOLEAN, last_interaction_at TIMESTAMPTZ, last_message_preview TEXT, unread_count INTEGER, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, crm_client_id UUID
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.organization_id, c.channel_id, c.platform, c.platform_user_id, c.name, c.avatar_url, c.ai_enabled, c.last_interaction_at, c.last_message_preview, c.unread_count, c.created_at, c.updated_at, cc.id AS crm_client_id
  FROM public.contacts AS c
  LEFT JOIN public.crm_clients AS cc ON c.id = cc.contact_id
  WHERE c.channel_id = p_channel_id AND (p_search_term = '' OR c.name ILIKE '%' || p_search_term || '%' OR c.platform_user_id ILIKE '%' || p_search_term || '%')
  ORDER BY c.unread_count DESC, c.last_interaction_at DESC LIMIT 100;
END;
$$;

-- 5. CRM: Calculate LTV
CREATE OR REPLACE FUNCTION public.calculate_client_ltv(client_uuid UUID) RETURNS NUMERIC LANGUAGE plpgsql STABLE SET search_path = '' AS $$ 
DECLARE ltv NUMERIC; 
BEGIN 
    SELECT COALESCE(SUM(total), 0) INTO ltv FROM public.crm_orders WHERE client_id = client_uuid AND status NOT IN ('cancelled', 'refunded'); 
    RETURN ltv; 
END; 
$$;

-- 6. CRM: Calculate Win Rate
CREATE OR REPLACE FUNCTION public.calculate_win_rate(org_id UUID, start_date TIMESTAMPTZ DEFAULT NULL, end_date TIMESTAMPTZ DEFAULT NULL) RETURNS NUMERIC LANGUAGE plpgsql STABLE SET search_path = '' AS $$ 
DECLARE win_rate NUMERIC; 
BEGIN 
    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE (COUNT(*) FILTER (WHERE stage = 'closed_won')::NUMERIC / COUNT(*)::NUMERIC) * 100 END INTO win_rate FROM public.crm_deals WHERE organization_id = org_id AND stage IN ('closed_won', 'closed_lost') AND (start_date IS NULL OR created_at >= start_date) AND (end_date IS NULL OR created_at <= end_date); 
    RETURN ROUND(win_rate, 2); 
END; 
$$;

-- 7. Analytics: Refresh All Views
CREATE OR REPLACE FUNCTION public.refresh_all_analytics() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.analytics_channel_performance;
  REFRESH MATERIALIZED VIEW public.analytics_deal_metrics;
  REFRESH MATERIALIZED VIEW public.analytics_revenue_metrics;
  REFRESH MATERIALIZED VIEW public.analytics_chatbot_effectiveness;
END;
$$;

-- 8. Analytics: Dashboard Summaries & Trends
-- A. Dashboard Summary
CREATE OR REPLACE FUNCTION public.get_crm_dashboard_summary(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    total_clients BIGINT, 
    total_customers BIGINT, 
    total_leads BIGINT, 
    total_deals BIGINT, 
    open_deals_value NUMERIC, 
    closed_won_deals BIGINT, 
    total_revenue NUMERIC, 
    avg_order_value NUMERIC, 
    pending_activities BIGINT
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type = 'customer' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type = 'lead' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_deals d LEFT JOIN public.crm_clients c ON d.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE d.organization_id = org_id AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR d.created_at >= start_date) AND (end_date IS NULL OR d.created_at <= end_date)), 
        (SELECT COALESCE(SUM(d.deal_value), 0) FROM public.crm_deals d LEFT JOIN public.crm_clients c ON d.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE d.organization_id = org_id AND d.stage NOT IN ('closed_won', 'closed_lost') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR d.created_at >= start_date) AND (end_date IS NULL OR d.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_deals d LEFT JOIN public.crm_clients c ON d.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE d.organization_id = org_id AND d.stage = 'closed_won' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR d.created_at >= start_date) AND (end_date IS NULL OR d.created_at <= end_date)), 
        (SELECT COALESCE(SUM(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COALESCE(AVG(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_activities a LEFT JOIN public.crm_clients c ON a.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE a.organization_id = org_id AND a.status = 'pending' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR a.created_at >= start_date) AND (end_date IS NULL OR a.created_at <= end_date)); 
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- B. Conversion Funnel
CREATE OR REPLACE FUNCTION public.get_conversion_funnel(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (lifecycle_stage TEXT, count BIGINT, percentage NUMERIC) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        c.lifecycle_stage, 
        COUNT(*) as count, 
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage 
    FROM public.crm_clients c 
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE c.organization_id = org_id 
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR c.created_at >= start_date)
      AND (end_date IS NULL OR c.created_at <= end_date)
    GROUP BY c.lifecycle_stage;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- C. Revenue Trends
CREATE OR REPLACE FUNCTION public.get_revenue_trends(
    org_id UUID, 
    period_type TEXT, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    date TIMESTAMPTZ, 
    revenue NUMERIC, 
    order_count BIGINT, 
    avg_order_value NUMERIC
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        DATE_TRUNC(period_type, o.order_date) as date,
        SUM(o.total) as revenue,
        COUNT(*) as order_count,
        CASE WHEN COUNT(*) > 0 THEN SUM(o.total) / COUNT(*) ELSE 0 END as avg_order_value
    FROM public.crm_orders o
    LEFT JOIN public.crm_clients c ON o.client_id = c.id
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE o.organization_id = org_id
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR o.order_date >= start_date)
      AND (end_date IS NULL OR o.order_date <= end_date)
    GROUP BY 1
    ORDER BY 1;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- D. Deal Trends
CREATE OR REPLACE FUNCTION public.get_deal_trends(
    org_id UUID, 
    period_type TEXT, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    date TIMESTAMPTZ, 
    new_deals_count BIGINT, 
    new_deals_value NUMERIC
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        DATE_TRUNC(period_type, d.created_at) as date,
        COUNT(*) as new_deals_count,
        COALESCE(SUM(d.deal_value), 0) as new_deals_value
    FROM public.crm_deals d
    LEFT JOIN public.crm_clients c ON d.client_id = c.id
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE d.organization_id = org_id
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR d.created_at >= start_date)
      AND (end_date IS NULL OR d.created_at <= end_date)
    GROUP BY 1
    ORDER BY 1;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- E. Message Volume Trends
CREATE OR REPLACE FUNCTION public.get_message_volume_trends(
    org_id UUID, 
    period_type TEXT, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    date TIMESTAMPTZ, 
    total_messages BIGINT,
    ai_responses BIGINT,
    agent_responses BIGINT
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        DATE_TRUNC(period_type, m.sent_at) as date,
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE m.sender_type = 'ai') as ai_responses,
        COUNT(*) FILTER (WHERE m.sender_type = 'agent') as agent_responses
    FROM public.messages m
    LEFT JOIN public.contacts co ON m.contact_id = co.id
    WHERE m.organization_id = org_id
      AND (p_channel_id IS NULL OR m.channel_id = p_channel_id)
      AND (start_date IS NULL OR m.sent_at >= start_date)
      AND (end_date IS NULL OR m.sent_at <= end_date)
    GROUP BY 1
    ORDER BY 1;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- F. Deal Pipeline Snapshot (Filtered)
CREATE OR REPLACE FUNCTION public.get_deal_pipeline_snapshot(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    stage TEXT, 
    count BIGINT, 
    value NUMERIC
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        d.stage,
        COUNT(*) as count,
        COALESCE(SUM(d.deal_value), 0) as value
    FROM public.crm_deals d
    LEFT JOIN public.crm_clients c ON d.client_id = c.id
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE d.organization_id = org_id
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR d.created_at >= start_date)
      AND (end_date IS NULL OR d.created_at <= end_date)
    GROUP BY d.stage;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- G. Channel Performance Snapshot (Filtered)
CREATE OR REPLACE FUNCTION public.get_channel_performance_snapshot(
    org_id UUID, 
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    organization_id UUID,
    channel_id UUID,
    channel_name TEXT,
    platform TEXT,
    total_contacts BIGINT,
    total_messages BIGINT,
    incoming_messages BIGINT,
    agent_responses BIGINT,
    ai_responses BIGINT,
    period_month TEXT
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        ch.organization_id,
        ch.id as channel_id,
        ch.name as channel_name,
        ch.platform,
        (SELECT COUNT(*) FROM public.contacts co 
         WHERE co.channel_id = ch.id 
         AND (start_date IS NULL OR co.created_at >= start_date) 
         AND (end_date IS NULL OR co.created_at <= end_date)
        ) as total_contacts,
        COUNT(m.id) as total_messages,
        COUNT(m.id) FILTER (WHERE m.sender_type = 'user') as incoming_messages,
        COUNT(m.id) FILTER (WHERE m.sender_type = 'agent') as agent_responses,
        COUNT(m.id) FILTER (WHERE m.sender_type = 'ai') as ai_responses,
        TO_CHAR(NOW(), 'YYYY-MM') as period_month
    FROM public.channels ch
    LEFT JOIN public.messages m ON m.channel_id = ch.id 
        AND (start_date IS NULL OR m.sent_at >= start_date)
        AND (end_date IS NULL OR m.sent_at <= end_date)
    WHERE ch.organization_id = org_id
    GROUP BY ch.organization_id, ch.id, ch.name, ch.platform;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ====================================================================
-- SECTION 6: AUTOMATION & TRIGGERS
-- ====================================================================

-- 1. Contact Summary Updater (Updates preview & unread count)
CREATE OR REPLACE FUNCTION public.update_contact_summary_on_message() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contact_id UUID;
BEGIN
    v_contact_id := COALESCE(NEW.contact_id, OLD.contact_id);
    UPDATE public.contacts SET 
        last_interaction_at = (SELECT MAX(m.sent_at) FROM public.messages m WHERE m.contact_id = v_contact_id),
        last_message_preview = (SELECT CASE WHEN sub.content_type = 'text' THEN LEFT(sub.text_content, 70) ELSE '[' || INITCAP(sub.content_type) || ']' END FROM public.messages sub WHERE sub.contact_id = v_contact_id ORDER BY sub.sent_at DESC LIMIT 1),
        unread_count = (SELECT COUNT(*) FROM public.messages m WHERE m.contact_id = v_contact_id AND m.sender_type = 'user' AND m.is_read_by_agent = FALSE)
    WHERE id = v_contact_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER messages_summary_trigger AFTER INSERT OR UPDATE OR DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_contact_summary_on_message();

-- 2. Auth Trigger
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Auto-Create CRM Client on New Contact (V3)
CREATE OR REPLACE FUNCTION public.create_client_on_new_contact() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.crm_clients (organization_id, contact_id, company_name, email, platform_user_id, source, first_contact_date)
  VALUES (NEW.organization_id, NEW.id, NEW.name, CASE WHEN NEW.name ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$' THEN NEW.name ELSE NULL END, NEW.platform_user_id, NEW.platform, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_contact_create_client AFTER INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.create_client_on_new_contact();

-- 4. Create Activity from Message (AI Only - DISABLED BY DEFAULT)
CREATE OR REPLACE FUNCTION public.create_activity_from_message() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE client_record_id UUID;
BEGIN
  SELECT id INTO client_record_id FROM public.crm_clients WHERE contact_id = NEW.contact_id LIMIT 1;
  IF client_record_id IS NOT NULL THEN
    INSERT INTO public.crm_activities (organization_id, client_id, message_id, activity_type, subject, description, status, created_by)
    VALUES (NEW.organization_id, client_record_id, NEW.id, 'chatbot_interaction', 'AI Message on ' || (SELECT platform FROM public.channels WHERE id = NEW.channel_id), LEFT(NEW.text_content, 500), 'completed', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
-- Creating the trigger but DISABLING it immediately as requested
CREATE TRIGGER trigger_create_activity_from_message AFTER INSERT ON public.messages FOR EACH ROW WHEN (NEW.sender_type = 'ai') EXECUTE FUNCTION public.create_activity_from_message();

ALTER TABLE public.messages DISABLE TRIGGER trigger_create_activity_from_message;

-- 5. Standard Updated_At Timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trigger_crm_clients_updated_at BEFORE UPDATE ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_crm_products_updated_at BEFORE UPDATE ON public.crm_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_crm_orders_updated_at BEFORE UPDATE ON public.crm_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_crm_activities_updated_at BEFORE UPDATE ON public.crm_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_crm_notes_updated_at BEFORE UPDATE ON public.crm_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. CRM Logic Triggers (Revenue, Stage History, Last Contact)
CREATE OR REPLACE FUNCTION public.update_client_revenue() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN UPDATE public.crm_clients SET total_orders = (SELECT COUNT(*) FROM public.crm_orders WHERE client_id = NEW.client_id AND status NOT IN ('cancelled', 'refunded')), total_revenue = (SELECT COALESCE(SUM(total), 0) FROM public.crm_orders WHERE client_id = NEW.client_id AND status NOT IN ('cancelled', 'refunded')), average_order_value = (SELECT COALESCE(AVG(total), 0) FROM public.crm_orders WHERE client_id = NEW.client_id AND status NOT IN ('cancelled', 'refunded')), last_contact_date = NOW(), updated_at = NOW() WHERE id = NEW.client_id; RETURN NEW; END; $$;

CREATE TRIGGER trigger_update_client_revenue AFTER INSERT OR UPDATE ON public.crm_orders FOR EACH ROW EXECUTE FUNCTION public.update_client_revenue();

CREATE OR REPLACE FUNCTION public.track_deal_stage_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN IF OLD.stage IS DISTINCT FROM NEW.stage THEN INSERT INTO public.crm_deal_stages_history (organization_id, deal_id, from_stage, to_stage, changed_by) VALUES (NEW.organization_id, NEW.id, OLD.stage, NEW.stage, auth.uid()); NEW.stage_changed_at = NOW(); END IF; NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trigger_track_deal_stage_change BEFORE UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.track_deal_stage_change();

CREATE OR REPLACE FUNCTION public.update_last_contact() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN UPDATE public.crm_clients SET last_contact_date = NEW.created_at WHERE id = NEW.client_id; RETURN NEW; END; $$;

CREATE TRIGGER trigger_update_last_contact AFTER INSERT ON public.crm_activities FOR EACH ROW WHEN (NEW.client_id IS NOT NULL) EXECUTE FUNCTION public.update_last_contact();

-- ====================================================================
-- SECTION 7: MATERIALIZED VIEWS (ANALYTICS)
-- ====================================================================

-- 1. Channel Performance (Snapshot)
CREATE MATERIALIZED VIEW public.analytics_channel_performance AS
SELECT
    ch.organization_id,
    ch.id as channel_id,
    ch.name as channel_name,
    ch.platform,
    COUNT(DISTINCT c.id) as total_contacts,
    COUNT(m.id) as total_messages,
    COUNT(m.id) FILTER (
        WHERE
            m.sender_type = 'user'
    ) as incoming_messages,
    COUNT(m.id) FILTER (
        WHERE
            m.sender_type = 'agent'
    ) as agent_responses,
    COUNT(m.id) FILTER (
        WHERE
            m.sender_type = 'ai'
    ) as ai_responses
FROM public.channels ch
    LEFT JOIN public.contacts c ON c.channel_id = ch.id
    LEFT JOIN public.messages m ON m.channel_id = ch.id
GROUP BY
    ch.organization_id,
    ch.id,
    ch.name,
    ch.platform;

CREATE INDEX idx_analytics_channel_perf_org ON public.analytics_channel_performance (organization_id);

-- 2. Deal Metrics (Snapshot by Stage)
CREATE MATERIALIZED VIEW public.analytics_deal_metrics AS
SELECT
    d.organization_id,
    co.channel_id,
    d.stage,
    COUNT(*) as deal_count,
    SUM(d.deal_value) as total_value,
    AVG(d.deal_value) as avg_deal_size
FROM public.crm_deals d
    LEFT JOIN public.crm_clients c ON d.client_id = c.id
    LEFT JOIN public.contacts co ON c.contact_id = co.id
GROUP BY
    d.organization_id,
    co.channel_id,
    d.stage;

CREATE INDEX idx_analytics_deal_metrics_org ON public.analytics_deal_metrics (organization_id);

-- 3. Revenue Metrics (Snapshot by Day)
CREATE MATERIALIZED VIEW public.analytics_revenue_metrics AS
SELECT
    o.organization_id,
    co.channel_id,
    SUM(o.total) as total_revenue,
    COUNT(*) as order_count,
    DATE_TRUNC ('day', o.order_date) as period_day
FROM public.crm_orders o
    LEFT JOIN public.crm_clients c ON o.client_id = c.id
    LEFT JOIN public.contacts co ON c.contact_id = co.id
GROUP BY
    o.organization_id,
    co.channel_id,
    DATE_TRUNC ('day', o.order_date);

CREATE INDEX idx_analytics_revenue_metrics_org ON public.analytics_revenue_metrics (organization_id);

-- 4. Chatbot Effectiveness (Snapshot)
CREATE MATERIALIZED VIEW public.analytics_chatbot_effectiveness AS
SELECT
    a.organization_id,
    m.channel_id,
    COUNT(DISTINCT a.client_id) as unique_clients_engaged,
    COUNT(*) as total_chatbot_interactions,
    COUNT(
        DISTINCT CASE
            WHEN a.status = 'completed' THEN a.client_id
        END
    ) as successful_interactions,
    AVG(
        EXTRACT(
            EPOCH
            FROM (a.completed_at - a.created_at)
        ) / 60
    ) as avg_interaction_duration_minutes,
    DATE_TRUNC ('day', a.created_at) as period_day
FROM public.crm_activities a
    LEFT JOIN public.messages m ON a.message_id = m.id
WHERE
    a.activity_type = 'chatbot_interaction'
GROUP BY
    a.organization_id,
    m.channel_id,
    DATE_TRUNC ('day', a.created_at);

CREATE INDEX idx_analytics_chatbot_effectiveness_org ON public.analytics_chatbot_effectiveness (organization_id);

-- ====================================================================
-- SECTION 8: ROW-LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Organizations & Profiles
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL USING (id = auth.uid ())
WITH
    CHECK (id = auth.uid ());

CREATE POLICY "Users can manage their own organization" ON public.organizations FOR ALL USING (
    id = get_my_organization_id ()
)
WITH
    CHECK (
        id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage teams in their organization" ON public.teams FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

-- Core Channels/Contacts/Messages
CREATE POLICY "Users can manage channels" ON public.channels FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage contacts" ON public.contacts FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage messages" ON public.messages FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

-- Configurations
CREATE POLICY "Users can manage config" ON public.channel_configurations FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage prompts" ON public.agent_prompts FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage content" ON public.content_collections FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage keywords" ON public.keyword_actions FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

-- CRM Tables
CREATE POLICY "Users can manage CRM clients" ON public.crm_clients FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM deals" ON public.crm_deals FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM history" ON public.crm_deal_stages_history FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM products" ON public.crm_products FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM orders" ON public.crm_orders FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM activities" ON public.crm_activities FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM notes" ON public.crm_notes FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE POLICY "Users can manage CRM tags" ON public.crm_tags FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

-- ====================================================================
-- SECTION 9: PERMISSIONS & BACKFILL
-- ====================================================================

-- 1. Grant Access
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON public.analytics_deal_metrics TO authenticated;

GRANT SELECT ON public.analytics_revenue_metrics TO authenticated;

GRANT
SELECT ON public.analytics_channel_performance TO authenticated;

GRANT
SELECT ON public.analytics_chatbot_effectiveness TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_revenue_trends(UUID, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_deal_trends (
    UUID,
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_message_volume_trends (
    UUID,
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_crm_dashboard_summary (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_conversion_funnel (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_deal_pipeline_snapshot (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_channel_performance_snapshot (
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.refresh_all_analytics () TO authenticated;

-- 2. CRM Backfill (Safe for existing data)
-- This ensures that if you load this on a database that already has contacts,
-- they get corresponding CRM entries.
INSERT INTO
    public.crm_clients (
        organization_id,
        contact_id,
        company_name,
        email,
        client_type,
        lifecycle_stage,
        total_revenue,
        last_contact_date,
        created_at,
        updated_at
    )
SELECT c.organization_id, c.id, c.name, NULL, 'lead', 'lead', 0, c.last_interaction_at, c.created_at, c.updated_at
FROM public.contacts c
WHERE
    NOT EXISTS (
        SELECT 1
        FROM public.crm_clients cc
        WHERE
            cc.contact_id = c.id
    );

-- 3. Initial Analytics Refresh
SELECT public.refresh_all_analytics ();

-- ====================================================================
--          FIX FINAL DATABASE LINTS
-- ====================================================================

-- 1. Fix "Extension in Public" for pg_trgm
-- If pg_trgm was installed in 'public', this moves it to 'extensions'.
CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 2. Fix "Function Search Path Mutable" for create_activity_from_message
-- This function is a trigger function.
ALTER FUNCTION public.create_activity_from_message() SET search_path = '';

-- 3. Fix "Function Search Path Mutable" for get_contacts_for_channel
-- This function takes (UUID, TEXT).
ALTER FUNCTION public.get_contacts_for_channel(UUID, TEXT) SET search_path = '';

-- 4. Verify
DO $$
BEGIN
    RAISE NOTICE 'Moved pg_trgm to extensions and hardened function search paths.';
END $$;

-- ====================================================================
-- SAFE UPDATE: SYNC & UTILITIES
-- This script adds functionality. It deletes NOTHING.
-- ====================================================================

-- 1. Ensure the sync function exists
-- This function keeps the CRM Name updated if the Contact Name changes in chat
CREATE OR REPLACE FUNCTION public.sync_contact_update_to_client()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only update if the CRM name is currently empty OR matches the old contact name
  -- This prevents overwriting manual edits made by agents in the CRM
  UPDATE public.crm_clients
  SET 
    company_name = NEW.name, 
    updated_at = NOW()
  WHERE contact_id = NEW.id
  AND (company_name IS NULL OR company_name = OLD.name);
  
  RETURN NEW;
END;
$$;

-- 2. Safely add the trigger (Drop first to avoid "already exists" error, then recreate)
DROP TRIGGER IF EXISTS on_contact_update_sync_client ON public.contacts;

CREATE TRIGGER on_contact_update_sync_client
AFTER UPDATE OF name ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_update_to_client();

-- 3. Safely add a column to Order table to tracking status easier
-- This helps if you want to track "Preparing", "Cooking", "Ready"
ALTER TABLE public.crm_orders
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled';

-- 4. Safely add a generic search index to help find clients faster
CREATE INDEX IF NOT EXISTS idx_crm_clients_search_safe ON public.crm_clients (email, phone, company_name);

-- ====================================================================
-- SAFE UPDATE: ANALYTICS
-- This script adds functionality. It deletes NOTHING.
-- ====================================================================
-- Increase timeout specifically for this function to 60 seconds

CREATE OR REPLACE FUNCTION public.refresh_all_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '60s' -- <-- THIS IS THE FIX (Allow 60 seconds)
AS $$
BEGIN
  -- We refresh the views one by one
  REFRESH MATERIALIZED VIEW public.analytics_channel_performance;
  REFRESH MATERIALIZED VIEW public.analytics_deal_metrics;
  REFRESH MATERIALIZED VIEW public.analytics_revenue_metrics;
  REFRESH MATERIALIZED VIEW public.analytics_chatbot_effectiveness;
END;
$$;

-- Re-apply permissions to be safe
GRANT
EXECUTE ON FUNCTION public.refresh_all_analytics () TO authenticated;

GRANT
EXECUTE ON FUNCTION public.refresh_all_analytics () TO service_role;

ALTER FUNCTION public.refresh_all_analytics() OWNER TO postgres;

-- ====================================================================
-- NOTIFICATION SYSTEM
-- Realtime notification table for handoffs, alerts, etc.
-- ====================================================================

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.crm_clients (id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- e.g., 'handoff', 'alert', 'info'
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (Security)
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can only see notifications for their organization
DROP POLICY IF EXISTS "Users can view org notifications" ON public.system_notifications;

CREATE POLICY "Users can view org notifications" ON public.system_notifications FOR
SELECT USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE
                id = auth.uid ()
        )
    );

-- 4. Policy: Users can update (mark as read) notifications
DROP POLICY IF EXISTS "Users can update org notifications" ON public.system_notifications;

CREATE POLICY "Users can update org notifications" ON public.system_notifications FOR
UPDATE USING (
    organization_id = (
        SELECT organization_id
        FROM public.profiles
        WHERE
            id = auth.uid ()
    )
);

-- 5. Enable Realtime (Crucial for the popup to work instantly)
ALTER PUBLICATION supabase_realtime
ADD
TABLE public.system_notifications;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_org_read ON public.system_notifications (organization_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.system_notifications (created_at DESC);

-- Grant refresh permissions to the function owner
ALTER MATERIALIZED VIEW public.analytics_channel_performance OWNER TO postgres;

ALTER MATERIALIZED VIEW public.analytics_deal_metrics OWNER TO postgres;

ALTER MATERIALIZED VIEW public.analytics_revenue_metrics OWNER TO postgres;

ALTER MATERIALIZED VIEW public.analytics_chatbot_effectiveness OWNER TO postgres;

-- Make sure the refresh function runs as postgres (owner)
ALTER FUNCTION public.refresh_all_analytics() OWNER TO postgres;

-- Grant execute to authenticated users
GRANT
EXECUTE ON FUNCTION public.refresh_all_analytics () TO authenticated;

GRANT
EXECUTE ON FUNCTION public.refresh_all_analytics () TO service_role;

-- ====================================================================
-- SETTINGS PAGE V2 — New Channel Configuration Columns
-- ====================================================================
-- Adds configurable fields that are currently hardcoded in n8n workflows.
-- n8n already fetches channel_configurations via its startup query, so
-- any value stored here is automatically available to the workflow.

-- 1. Agent Webhook URL (for agent-initiated message sending via n8n)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS agent_webhook_url TEXT;

COMMENT ON COLUMN public.channel_configurations.agent_webhook_url IS 'n8n webhook URL for sending agent-initiated messages (text, media, voice)';

-- 2. E-Commerce Integration Config (for order creation via external API)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS ecommerce_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.channel_configurations.ecommerce_config IS 'E-commerce platform credentials: { api_url, api_key, login_email, login_password }';

-- 3. Notification Config (Telegram group IDs for escalations)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS notification_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.channel_configurations.notification_config IS 'Notification routing config: { telegram_complaints_group_id, telegram_cancellations_group_id }';

-- ====================================================================
--          SCHEMA UPGRADE V2 — Bot Dashboard Modernization
--          Safe, additive migration. Deletes NOTHING.
-- ====================================================================

-- ====================================================================
-- 1. MESSAGE QUEUE TABLE (Required by n8n workflow for message batching)
-- ====================================================================
-- The workflow batches rapid-fire user messages before processing with AI.
-- This table was missing from the original schema.

CREATE TABLE IF NOT EXISTS public.queue (
    id BIGSERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

-- Service-role-only access (workflow uses service_role key)
-- No RLS policy needed for authenticated users — they don't access this table.
CREATE INDEX IF NOT EXISTS idx_queue_sender_id ON public.queue (sender_id);

CREATE INDEX IF NOT EXISTS idx_queue_created_at ON public.queue (created_at);

-- ====================================================================
-- 2. CONTENT TYPE CONSTRAINT ON MESSAGES
-- ====================================================================
-- Formalize allowed content types including video, document, sticker, location.

-- First check if the constraint already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_content_type' AND conrelid = 'public.messages'::regclass
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT chk_content_type
        CHECK (content_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location'));

END IF;

END $$;

-- ====================================================================
-- 3. DELIVERY STATUS ON MESSAGES
-- ====================================================================
-- Track message delivery lifecycle: pending → sent → delivered → read → failed

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_delivery_status' AND conrelid = 'public.messages'::regclass
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT chk_delivery_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));
    END IF;
END $$;

-- ====================================================================
-- 4. MEDIA UPLOADS TABLE (Supabase Storage tracking)
-- ====================================================================
-- Tracks files uploaded by agents (images, voice recordings, documents)

CREATE TABLE IF NOT EXISTS public.media_uploads (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages (id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage media in their org" ON public.media_uploads FOR ALL USING (
    organization_id = get_my_organization_id ()
)
WITH
    CHECK (
        organization_id = get_my_organization_id ()
    );

CREATE INDEX IF NOT EXISTS idx_media_uploads_message ON public.media_uploads (message_id);

CREATE INDEX IF NOT EXISTS idx_media_uploads_org ON public.media_uploads (organization_id);

-- ====================================================================
-- 5. CHECK CONSTRAINTS (Schema Hardening)
-- ====================================================================

-- profiles.role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_profile_role' AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT chk_profile_role
        CHECK (role IN ('admin', 'agent', 'viewer'));

END IF;

END $$;

-- channels.platform
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_channel_platform' AND conrelid = 'public.channels'::regclass
    ) THEN
        ALTER TABLE public.channels
        ADD CONSTRAINT chk_channel_platform
        CHECK (platform IN ('whatsapp', 'facebook', 'instagram', 'telegram', 'webchat'));
    END IF;
END $$;

-- contacts.platform
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_contact_platform' AND conrelid = 'public.contacts'::regclass
    ) THEN
        ALTER TABLE public.contacts
        ADD CONSTRAINT chk_contact_platform
        CHECK (platform IN ('whatsapp', 'facebook', 'instagram', 'telegram', 'webchat'));
    END IF;
END $$;

-- crm_orders.fulfillment_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_fulfillment_status' AND conrelid = 'public.crm_orders'::regclass
    ) THEN
        ALTER TABLE public.crm_orders
        ADD CONSTRAINT chk_fulfillment_status
        CHECK (fulfillment_status IN ('unfulfilled', 'preparing', 'ready', 'fulfilled'));
    END IF;
END $$;

-- system_notifications.type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_notification_type' AND conrelid = 'public.system_notifications'::regclass
    ) THEN
        ALTER TABLE public.system_notifications
        ADD CONSTRAINT chk_notification_type
        CHECK (type IN ('handoff', 'alert', 'info', 'new_contact', 'order_created', 'error'));
    END IF;
END $$;

-- ====================================================================
-- 6. SYSTEM NOTIFICATIONS ENHANCEMENTS
-- ====================================================================
-- Add channel_id and contact_id for quick navigation from notifications

ALTER TABLE public.system_notifications
ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels (id) ON DELETE SET NULL;

ALTER TABLE public.system_notifications
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.system_notifications (channel_id);

CREATE INDEX IF NOT EXISTS idx_notifications_contact ON public.system_notifications (contact_id);

-- ====================================================================
-- 7. MISSING UPDATED_AT TRIGGERS
-- ====================================================================

-- contacts.updated_at trigger
DROP TRIGGER IF EXISTS trigger_contacts_updated_at ON public.contacts;

CREATE TRIGGER trigger_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- channels - add updated_at column first if missing, then trigger
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_channels_updated_at ON public.channels;

CREATE TRIGGER trigger_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- channel_configurations.updated_at trigger (already has the column)
DROP TRIGGER IF EXISTS trigger_channel_config_updated_at ON public.channel_configurations;

CREATE TRIGGER trigger_channel_config_updated_at
BEFORE UPDATE ON public.channel_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- 8. SECURITY FIX: sync_contact_update_to_client search_path
-- ====================================================================

ALTER FUNCTION public.sync_contact_update_to_client() SET search_path = '';

-- ====================================================================
-- 9. ADDITIONAL INDEXES FOR PERFORMANCE
-- ====================================================================

-- Messages: filter by sender_type (analytics)
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON public.messages (sender_type);

-- Messages: filter by content_type for media browsing (skip text)
CREATE INDEX IF NOT EXISTS idx_messages_content_type ON public.messages (content_type)
WHERE
    content_type != 'text';

-- Messages: delivery status for tracking
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON public.messages (delivery_status)
WHERE
    delivery_status != 'sent';

-- Contacts: composite for the main chat query
CREATE INDEX IF NOT EXISTS idx_contacts_channel_unread ON public.contacts (
    channel_id,
    unread_count DESC,
    last_interaction_at DESC
);

-- CRM clients: lifecycle funnel queries
CREATE INDEX IF NOT EXISTS idx_crm_clients_lifecycle ON public.crm_clients (
    organization_id,
    lifecycle_stage
);

-- CRM deals: per-client queries
CREATE INDEX IF NOT EXISTS idx_crm_deals_client ON public.crm_deals (client_id);

-- ====================================================================
-- 10. VERIFICATION
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Schema Upgrade V2 applied successfully.';
    RAISE NOTICE '  ✓ queue table created';
    RAISE NOTICE '  ✓ content_type CHECK constraint added';
    RAISE NOTICE '  ✓ delivery_status column added to messages';
    RAISE NOTICE '  ✓ media_uploads table created';
    RAISE NOTICE '  ✓ CHECK constraints added (profile role, platform, fulfillment, notifications)';
    RAISE NOTICE '  ✓ system_notifications enhanced with channel_id, contact_id';
    RAISE NOTICE '  ✓ Missing updated_at triggers added';
    RAISE NOTICE '  ✓ Security: search_path hardened on sync function';
    RAISE NOTICE '  ✓ Performance indexes added';
END $$;












-- ====================================================================
-- RBAC MIGRATION — Role-Based Access Control
-- ====================================================================
-- Adds: user_permissions, user_channel_access tables
-- Adds: get_my_role(), can_access_channel() helper functions
-- Updates: RLS policies to be role-aware
-- Updates: handle_new_user() to default new users to 'agent' role
-- ====================================================================

-- ====================================================================
-- 1. NEW TABLES
-- ====================================================================

-- Per-user page permission overrides
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Per-user channel access (junction table)
CREATE TABLE IF NOT EXISTS public.user_channel_access (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, channel_id)
);

ALTER TABLE public.user_channel_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_access_user ON public.user_channel_access (user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_access_channel ON public.user_channel_access (channel_id);

-- ====================================================================
-- 2. HELPER FUNCTIONS
-- ====================================================================

-- Get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if the current user can access a specific channel
CREATE OR REPLACE FUNCTION public.can_access_channel(p_channel_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN TRUE
        ELSE EXISTS (
            SELECT 1 FROM public.user_channel_access
            WHERE user_id = auth.uid() AND channel_id = p_channel_id
        )
    END;
$$;

-- Get all profiles in the caller's org (for admin team management)
CREATE OR REPLACE FUNCTION public.get_org_members()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    team_id UUID
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        u.email::TEXT,
        p.role,
        p.team_id
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    ORDER BY p.full_name;
END;
$$;

-- ====================================================================
-- 3. UPDATE DEFAULT ROLE FOR NEW USERS
-- ====================================================================
-- Change the handle_new_user trigger to default new users to 'agent'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_org_id UUID;
BEGIN
    -- Check if an organization already exists for the invited user
    -- (when admin invites a user, they set the org_id in user metadata)
    IF NEW.raw_user_meta_data ->> 'organization_id' IS NOT NULL THEN
        -- User was invited to an existing organization
        INSERT INTO public.profiles (id, organization_id, role, full_name)
        VALUES (
            NEW.id,
            (NEW.raw_user_meta_data ->> 'organization_id')::UUID,
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'agent'),
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
        );
    ELSE
        -- Self-signup: create a new organization
        INSERT INTO public.organizations (name)
        VALUES (NEW.email || '''s Organization')
        RETURNING id INTO new_org_id;

        INSERT INTO public.profiles (id, organization_id, role)
        VALUES (NEW.id, new_org_id, 'admin');
    END IF;

    RETURN NEW;
END;
$$;

-- ====================================================================
-- 4. RLS POLICIES — Role-Aware
-- ====================================================================

-- --- user_permissions table ---
CREATE POLICY "Admins can manage permissions" ON public.user_permissions FOR ALL USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
)
WITH
    CHECK (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

CREATE POLICY "Users can read own permissions" ON public.user_permissions FOR
SELECT USING (user_id = auth.uid ());

-- --- user_channel_access table ---
CREATE POLICY "Admins can manage channel access" ON public.user_channel_access FOR ALL USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
)
WITH
    CHECK (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

CREATE POLICY "Users can read own channel access" ON public.user_channel_access FOR
SELECT USING (user_id = auth.uid ());

-- --- Channels: Replace existing policy ---
-- (Run these ONLY after dropping the old policy)
-- DROP POLICY IF EXISTS "Users can manage channels" ON public.channels;

-- Admins can do everything, others can only SELECT their assigned channels
-- CREATE POLICY "Channel access by role" ON public.channels
--   FOR ALL USING (
--     organization_id = public.get_my_organization_id()
--     AND (public.get_my_role() = 'admin' OR public.can_access_channel(id))
--   ) WITH CHECK (
--     organization_id = public.get_my_organization_id()
--     AND public.get_my_role() = 'admin'
--   );

-- NOTE: The commented policies above should replace existing ones.
-- For safety, we keep them commented. Run them manually after verifying
-- the current policies with: SELECT * FROM pg_policies WHERE tablename = 'channels';

-- --- Profiles: Allow admins to read all org profiles ---
-- The existing policy only allows users to manage their OWN profile.
-- We need admins to see all profiles in their org for team management.

CREATE POLICY "Admins can read org profiles" ON public.profiles FOR
SELECT USING (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

CREATE POLICY "Admins can update org profiles" ON public.profiles FOR
UPDATE USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID;

-- ====================================================================
-- PAGINATION UPGRADE — Infinite Scroll for Contacts
-- ====================================================================
-- Updates: get_contacts_for_channel RPC to support LIMIT/OFFSET pagination
-- Run this AFTER all previous migrations.
-- ====================================================================

-- Drop the OLD 2-parameter version to avoid PostgREST overload conflict (PGRST203)
DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT);

-- Replace with pagination-enabled version

-- Replace the existing function with pagination support
-- The old function returns ALL contacts; this one paginates.
-- ====================================================================
-- PAGINATION UPGRADE — Infinite Scroll + Sorting for Contacts
-- ====================================================================
-- Updates: get_contacts_for_channel RPC with pagination and sorting
-- Run this AFTER all previous migrations.
-- ====================================================================

-- Drop ALL old versions to avoid PostgREST overload conflict (PGRST203)
DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT);

DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT, INT, INT);

DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT);

-- Create with pagination + sorting support
CREATE OR REPLACE FUNCTION public.get_contacts_for_channel(
    p_channel_id UUID,
    p_search_term TEXT DEFAULT '',
    p_limit INT DEFAULT 30,
    p_offset INT DEFAULT 0,
    p_sort TEXT DEFAULT 'recent'
)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    channel_id UUID,
    platform TEXT,
    platform_user_id TEXT,
    name TEXT,
    ai_enabled BOOLEAN,
    unread_count INT,
    last_message_preview TEXT,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    crm_client_id UUID
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.organization_id,
        c.channel_id,
        c.platform,
        c.platform_user_id,
        c.name,
        c.ai_enabled,
        c.unread_count,
        c.last_message_preview,
        c.last_interaction_at,
        c.created_at,
        cl.id AS crm_client_id
    FROM public.contacts c
    LEFT JOIN public.crm_clients cl ON cl.contact_id = c.id
    WHERE c.channel_id = p_channel_id
      AND (
          p_search_term = ''
          OR c.name ILIKE '%' || p_search_term || '%'
          OR c.platform_user_id ILIKE '%' || p_search_term || '%'
      )
    ORDER BY
        CASE WHEN p_sort = 'recent' THEN c.last_interaction_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'unread' THEN c.unread_count END DESC,
        CASE WHEN p_sort = 'unread' THEN c.last_interaction_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'name' THEN c.name END ASC NULLS LAST,
        CASE WHEN p_sort = 'name' THEN c.platform_user_id END ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant access
GRANT
EXECUTE ON FUNCTION public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT) TO service_role;

-- ====================================================================
-- VERIFICATION
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Pagination + Sorting Upgrade applied successfully.';
    RAISE NOTICE '  ✓ get_contacts_for_channel updated with p_sort parameter';
    RAISE NOTICE '  ✓ Sort options: recent (default), unread, name';
    RAISE NOTICE '  ✓ Pagination: p_limit (default 30), p_offset (default 0)';
END $$;

-- ====================================================================
-- STEP 1: Drop old CHECK constraint first (it blocks new values)
-- ====================================================================
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_client_type_check;

-- ====================================================================
-- STEP 2: Migrate existing client_type values to new values
-- ====================================================================
UPDATE public.crm_clients
SET
    client_type = 'new'
WHERE
    client_type = 'lead';

UPDATE public.crm_clients
SET
    client_type = 'interested'
WHERE
    client_type = 'prospect';

UPDATE public.crm_clients
SET
    client_type = 'customer'
WHERE
    client_type = 'partner';
-- 'customer' stays 'customer', 'inactive' stays 'inactive'

-- ====================================================================
-- STEP 3: Add new CHECK constraint
-- ====================================================================
ALTER TABLE public.crm_clients
ADD CONSTRAINT crm_clients_client_type_check CHECK (
    client_type IN (
        'new',
        'interested',
        'customer',
        'repeat_customer',
        'inactive'
    )
);

-- Update default
ALTER TABLE public.crm_clients
ALTER COLUMN client_type
SET DEFAULT 'new';

-- ====================================================================
-- STEP 3: Drop lifecycle_stage column
-- ====================================================================
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_lifecycle_stage_check;

ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS lifecycle_stage;

-- ====================================================================
-- STEP 4: Drop unused e-commerce columns
-- ====================================================================
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS unique_ecommerce_customer;

ALTER TABLE public.crm_clients
DROP COLUMN IF EXISTS ecommerce_customer_id;

ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS total_orders;

ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS total_revenue;

ALTER TABLE public.crm_clients
DROP COLUMN IF EXISTS average_order_value;

ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS utm_data;

ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS source_details;

-- ====================================================================
-- STEP 5: Remove deal_id from related tables BEFORE dropping deals
-- ====================================================================
ALTER TABLE public.crm_orders DROP COLUMN IF EXISTS deal_id;

ALTER TABLE public.crm_activities DROP COLUMN IF EXISTS deal_id;

ALTER TABLE public.crm_notes DROP COLUMN IF EXISTS deal_id;

-- ====================================================================
-- STEP 6: Drop deal tables (stages history first due to FK)
-- ====================================================================
DROP TABLE IF EXISTS public.crm_deal_stages_history CASCADE;

DROP TABLE IF EXISTS public.crm_deals CASCADE;

-- ====================================================================
-- STEP 7: Drop deal-related indexes
-- ====================================================================
DROP INDEX IF EXISTS public.idx_crm_deals_organization;

DROP INDEX IF EXISTS public.idx_crm_deals_stage;

-- ====================================================================
-- STEP 8: Change currency defaults from USD to EGP
-- ====================================================================
ALTER TABLE public.crm_orders
ALTER COLUMN currency
SET DEFAULT 'EGP';

ALTER TABLE public.crm_products
ALTER COLUMN currency
SET DEFAULT 'EGP';

-- ====================================================================
-- STEP 9: Update auto-create trigger to use 'new' instead of 'lead'
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_client_on_new_contact() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.crm_clients (organization_id, contact_id, company_name, email, platform_user_id, source, first_contact_date, client_type)
  VALUES (
    NEW.organization_id, 
    NEW.id, 
    NEW.name, 
    CASE WHEN NEW.name ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$' THEN NEW.name ELSE NULL END, 
    NEW.platform_user_id, 
    NEW.platform, 
    NOW(),
    'new'
  );
  RETURN NEW;
END;
$$;

-- ====================================================================
-- STEP 10: Drop deal-related functions
-- ====================================================================
DROP FUNCTION IF EXISTS public.calculate_win_rate (
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
);

DROP FUNCTION IF EXISTS public.get_deal_trends (
    UUID,
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
);

DROP FUNCTION IF EXISTS public.get_deal_pipeline_snapshot (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
);

-- ====================================================================
-- STEP 11: Update dashboard summary (remove deal references)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_crm_dashboard_summary(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    total_clients BIGINT, 
    total_customers BIGINT, 
    total_leads BIGINT, 
    total_deals BIGINT, 
    open_deals_value NUMERIC, 
    closed_won_deals BIGINT, 
    total_revenue NUMERIC, 
    avg_order_value NUMERIC, 
    pending_activities BIGINT
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type IN ('customer', 'repeat_customer') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type = 'new' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        0::BIGINT,  -- deals removed
        0::NUMERIC, -- deals removed
        0::BIGINT,  -- deals removed
        (SELECT COALESCE(SUM(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COALESCE(AVG(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_activities a LEFT JOIN public.crm_clients c ON a.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE a.organization_id = org_id AND a.status = 'pending' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR a.created_at >= start_date) AND (end_date IS NULL OR a.created_at <= end_date)); 
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ====================================================================
-- STEP 12: Update conversion funnel to use client_type instead of lifecycle_stage
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_conversion_funnel(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (lifecycle_stage TEXT, count BIGINT, percentage NUMERIC) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        c.client_type AS lifecycle_stage, 
        COUNT(*) as count, 
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as percentage 
    FROM public.crm_clients c 
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE c.organization_id = org_id 
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR c.created_at >= start_date)
      AND (end_date IS NULL OR c.created_at <= end_date)
    GROUP BY c.client_type;
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ====================================================================
-- STEP 13: Update refresh_all_analytics (remove deal materialized view)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.refresh_all_analytics() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.analytics_channel_performance;
  -- analytics_deal_metrics view removed
  REFRESH MATERIALIZED VIEW public.analytics_revenue_metrics;
  REFRESH MATERIALIZED VIEW public.analytics_chatbot_effectiveness;
END;
$$;

-- Drop the deal metrics materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.analytics_deal_metrics;

-- ====================================================================
-- ADD FALLBACK MODEL & TEMPERATURE TO CHANNEL CONFIGURATIONS
-- Run this in Supabase SQL Editor
-- ====================================================================

ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS fallback_model TEXT,
ADD COLUMN IF NOT EXISTS fallback_temperature REAL;

COMMENT ON COLUMN public.channel_configurations.fallback_model IS 'Fallback AI model used when the primary model fails or is unavailable';

COMMENT ON COLUMN public.channel_configurations.fallback_temperature IS 'Temperature setting for the fallback AI model (0.0 to 1.0)';

-- ====================================================================
-- UPDATE DEFAULT KEYWORD ACTIONS: start/stop → 9/8
-- Run this in Supabase SQL Editor
-- ====================================================================

-- Change 'stop' → '8' (DISABLE_AI)
UPDATE public.keyword_actions
SET
    keyword = '8'
WHERE
    keyword = 'stop'
    AND action_type = 'DISABLE_AI';

-- Change 'start' → '9' (ENABLE_AI)
UPDATE public.keyword_actions
SET
    keyword = '9'
WHERE
    keyword = 'start'
    AND action_type = 'ENABLE_AI';

-- ====================================================================
-- ANALYTICS OVERHAUL: Conversation Stage Tracking + BMI Data + Funnel
-- Run this in Supabase SQL Editor
-- ====================================================================

-- ====================================================================
-- STEP 1: Add conversation_stage to crm_clients
-- ====================================================================
ALTER TABLE public.crm_clients
ADD COLUMN IF NOT EXISTS conversation_stage TEXT DEFAULT 'first_contact';

-- Add check constraint (drop first if exists to be safe)
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_conversation_stage_check;

ALTER TABLE public.crm_clients
ADD CONSTRAINT crm_clients_conversation_stage_check CHECK (
    conversation_stage IN (
        'first_contact',
        'bmi_collected',
        'testimonials_viewed',
        'price_viewed',
        'purchased'
    )
);

COMMENT ON COLUMN public.crm_clients.conversation_stage IS 'Tracks where the client is in the bot sales conversation funnel';

-- ====================================================================
-- STEP 2: Add bmi_data JSONB column
-- ====================================================================
ALTER TABLE public.crm_clients
ADD COLUMN IF NOT EXISTS bmi_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.crm_clients.bmi_data IS 'Stores BMI data from the bot: {"weight": 87, "height": 175, "age": 30, "bmi": 28.4}';

-- ====================================================================
-- STEP 3: Index for conversation_stage analytics queries
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_crm_clients_conversation_stage ON public.crm_clients (
    organization_id,
    conversation_stage
);

-- ====================================================================
-- STEP 4: RPC — update_client_stage (for n8n bot to call)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.update_client_stage(
  p_platform_user_id TEXT,
  p_channel_id UUID,
  p_stage TEXT,
  p_bmi_data JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contact_id UUID;
  v_client_id UUID;
  v_result JSONB;
BEGIN
  -- Find the contact by platform_user_id + channel_id
  SELECT id INTO v_contact_id
  FROM public.contacts
  WHERE platform_user_id = p_platform_user_id
    AND channel_id = p_channel_id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  -- Find the CRM client linked to this contact
  SELECT id INTO v_client_id
  FROM public.crm_clients
  WHERE contact_id = v_contact_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CRM client not found');
  END IF;

  -- Update the stage (and BMI data if provided)
  UPDATE public.crm_clients
  SET 
    conversation_stage = p_stage,
    bmi_data = COALESCE(p_bmi_data, bmi_data),
    updated_at = NOW()
  WHERE id = v_client_id;

  -- Also add stage as a tag for filtering
  UPDATE public.crm_clients
  SET tags = array_remove(
    array_remove(
      array_remove(
        array_remove(
          array_remove(COALESCE(tags, '{}'), 'stage:first_contact'),
          'stage:bmi_collected'),
        'stage:testimonials_viewed'),
      'stage:price_viewed'),
    'stage:purchased') || ARRAY['stage:' || p_stage]
  WHERE id = v_client_id;

  RETURN jsonb_build_object(
    'success', true, 
    'client_id', v_client_id,
    'stage', p_stage
  );
END;
$$;

-- Grant access to service_role (for n8n bot calls)
GRANT
EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT, JSONB) TO service_role;

GRANT
EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT, JSONB) TO authenticated;

-- ====================================================================
-- STEP 5: RPC — get_conversation_funnel (for analytics dashboard)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_conversation_funnel(
  org_id UUID,
  p_channel_id UUID DEFAULT NULL,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  stage TEXT,
  total BIGINT,
  completed BIGINT,
  dropped BIGINT,
  completion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stage_order TEXT[] := ARRAY[
    'first_contact',
    'bmi_collected',
    'testimonials_viewed',
    'price_viewed',
    'purchased'
  ];
  i INT;
  v_current_count BIGINT;
  v_next_count BIGINT;
BEGIN
  FOR i IN 1..array_length(stage_order, 1) LOOP
    -- Count clients who reached this stage or any later stage
    SELECT COUNT(*) INTO v_current_count
    FROM public.crm_clients c
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE c.organization_id = org_id
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR c.created_at >= start_date)
      AND (end_date IS NULL OR c.created_at <= end_date)
      AND array_position(stage_order, c.conversation_stage) >= i;

    -- Count clients who reached the NEXT stage or later
    IF i < array_length(stage_order, 1) THEN
      SELECT COUNT(*) INTO v_next_count
      FROM public.crm_clients c
      LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date IS NULL OR c.created_at <= end_date)
        AND array_position(stage_order, c.conversation_stage) >= (i + 1);
    ELSE
      v_next_count := v_current_count; -- Last stage has no drop-off
    END IF;

    stage := stage_order[i];
    total := v_current_count;
    completed := v_next_count;
    dropped := v_current_count - v_next_count;
    completion_rate := CASE WHEN v_current_count > 0 
      THEN ROUND(v_next_count * 100.0 / v_current_count, 1) 
      ELSE 0 END;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT
EXECUTE ON FUNCTION public.get_conversation_funnel (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_conversation_funnel (
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO service_role;

-- ====================================================================
-- STEP 6: Update get_crm_dashboard_summary — remove deal fields
-- Must DROP first because return type is changing (removed deal columns)
-- ====================================================================
DROP FUNCTION IF EXISTS public.get_crm_dashboard_summary (
    uuid,
    uuid,
    timestamp
    with
        time zone,
        timestamp
    with
        time zone
);

CREATE OR REPLACE FUNCTION public.get_crm_dashboard_summary(
    org_id UUID, 
    p_channel_id UUID DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
) 
RETURNS TABLE (
    total_clients BIGINT, 
    total_customers BIGINT, 
    total_leads BIGINT, 
    total_revenue NUMERIC, 
    avg_order_value NUMERIC, 
    pending_activities BIGINT,
    bmi_collected_count BIGINT,
    price_viewed_count BIGINT
) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type IN ('customer', 'repeat_customer') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.client_type = 'new' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)), 
        (SELECT COALESCE(SUM(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COALESCE(AVG(o.total), 0) FROM public.crm_orders o LEFT JOIN public.crm_clients c ON o.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR o.order_date >= start_date) AND (end_date IS NULL OR o.order_date <= end_date)), 
        (SELECT COUNT(*) FROM public.crm_activities a LEFT JOIN public.crm_clients c ON a.client_id = c.id LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE a.organization_id = org_id AND a.status = 'pending' AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR a.created_at >= start_date) AND (end_date IS NULL OR a.created_at <= end_date)),
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.conversation_stage IN ('bmi_collected', 'testimonials_viewed', 'price_viewed', 'purchased') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date)),
        (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id WHERE c.organization_id = org_id AND c.conversation_stage IN ('price_viewed', 'purchased') AND (p_channel_id IS NULL OR co.channel_id = p_channel_id) AND (start_date IS NULL OR c.created_at >= start_date) AND (end_date IS NULL OR c.created_at <= end_date));
END; 
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Auto-update crm_clients.last_contact_date when a new message arrives
-- Run this ONCE in Supabase SQL Editor

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION update_client_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_contact_date on the crm_client linked to this contact
  UPDATE crm_clients
  SET last_contact_date = COALESCE(NEW.platform_timestamp, NEW.sent_at, NOW())
  WHERE contact_id = NEW.contact_id
    AND (last_contact_date IS NULL 
         OR last_contact_date < COALESCE(NEW.platform_timestamp, NEW.sent_at, NOW()));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger (fires on every new message insert)
DROP TRIGGER IF EXISTS trg_update_last_contact ON messages;

CREATE TRIGGER trg_update_last_contact
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_contact();

-- Step 3: Backfill existing data — set last_contact_date from the latest message
UPDATE crm_clients cc
SET
    last_contact_date = latest.max_ts
FROM (
        SELECT contact_id, MAX(
                COALESCE(platform_timestamp, sent_at)
            ) AS max_ts
        FROM messages
        GROUP BY
            contact_id
    ) latest
WHERE
    cc.contact_id = latest.contact_id
    AND (
        cc.last_contact_date IS NULL
        OR cc.last_contact_date < latest.max_ts
    );

-- Create the chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','audio/webm','audio/ogg','audio/mp3','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read chat-attachments" ON storage.objects FOR
SELECT USING (
        bucket_id = 'chat-attachments'
    );

-- Allow authenticated upload
CREATE POLICY "Authenticated upload chat-attachments" ON storage.objects FOR
INSERT
WITH
    CHECK (
        bucket_id = 'chat-attachments'
    );

-- Create the content-images storage bucket (for Content Collections image uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-images',
  'content-images',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (so n8n / Facebook / Instagram can fetch the images)
CREATE POLICY "Public read content-images" ON storage.objects FOR
SELECT USING (
        bucket_id = 'content-images'
    );

-- Allow authenticated upload
CREATE POLICY "Authenticated upload content-images" ON storage.objects FOR
INSERT
WITH
    CHECK (
        bucket_id = 'content-images'
    );

-- Message Templates — Per-user quick replies
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own templates
CREATE POLICY "Users manage own templates" ON public.message_templates FOR ALL USING (user_id = auth.uid ())
WITH
    CHECK (user_id = auth.uid ());

CREATE INDEX IF NOT EXISTS idx_message_templates_user ON public.message_templates (user_id);

-- Migration to add follow-up toggles to channels and contacts

-- 1. Add to channel_configurations
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS is_followup_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add to contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS is_followup_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Note: We default to TRUE so existing users don't suddenly stop receiving follow-ups.

-- Fix the update_client_revenue trigger to only update columns that still exist
CREATE OR REPLACE FUNCTION public.update_client_revenue() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ 
BEGIN 
  UPDATE public.crm_clients 
  SET 
    last_contact_date = NOW(), 
    updated_at = NOW() 
  WHERE id = NEW.client_id; 
  RETURN NEW; 
END; 
$$;

-- ====================================================================
-- RBAC MIGRATION — Role-Based Access Control
-- ====================================================================
-- Adds: user_permissions, user_channel_access tables
-- Adds: get_my_role(), can_access_channel() helper functions
-- Updates: RLS policies to be role-aware
-- Updates: handle_new_user() to default new users to 'agent' role
-- ====================================================================

-- ====================================================================
-- 1. NEW TABLES
-- ====================================================================

-- Per-user page permission overrides
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Per-user channel access (junction table)
CREATE TABLE IF NOT EXISTS public.user_channel_access (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4 (),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, channel_id)
);

ALTER TABLE public.user_channel_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_access_user ON public.user_channel_access (user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_access_channel ON public.user_channel_access (channel_id);

-- ====================================================================
-- 2. HELPER FUNCTIONS
-- ====================================================================

-- Get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if the current user can access a specific channel
CREATE OR REPLACE FUNCTION public.can_access_channel(p_channel_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN TRUE
        ELSE EXISTS (
            SELECT 1 FROM public.user_channel_access
            WHERE user_id = auth.uid() AND channel_id = p_channel_id
        )
    END;
$$;

-- Get all profiles in the caller's org (for admin team management)
CREATE OR REPLACE FUNCTION public.get_org_members()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    team_id UUID
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        u.email::TEXT,
        p.role,
        p.team_id
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    ORDER BY p.full_name;
END;
$$;

-- ====================================================================
-- 3. UPDATE DEFAULT ROLE FOR NEW USERS
-- ====================================================================
-- Change the handle_new_user trigger to default new users to 'agent'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_org_id UUID;
BEGIN
    -- Check if an organization already exists for the invited user
    -- (when admin invites a user, they set the org_id in user metadata)
    IF NEW.raw_user_meta_data ->> 'organization_id' IS NOT NULL THEN
        -- User was invited to an existing organization
        INSERT INTO public.profiles (id, organization_id, role, full_name)
        VALUES (
            NEW.id,
            (NEW.raw_user_meta_data ->> 'organization_id')::UUID,
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'agent'),
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
        );
    ELSE
        -- Self-signup: create a new organization
        INSERT INTO public.organizations (name)
        VALUES (NEW.email || '''s Organization')
        RETURNING id INTO new_org_id;

        INSERT INTO public.profiles (id, organization_id, role)
        VALUES (NEW.id, new_org_id, 'admin');
    END IF;

    RETURN NEW;
END;
$$;

-- ====================================================================
-- 4. RLS POLICIES — Role-Aware
-- ====================================================================

-- --- user_permissions table ---
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;

CREATE POLICY "Admins can manage permissions" ON public.user_permissions FOR ALL USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
)
WITH
    CHECK (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_permissions;

CREATE POLICY "Users can read own permissions" ON public.user_permissions FOR
SELECT USING (user_id = auth.uid ());

-- --- user_channel_access table ---
DROP POLICY IF EXISTS "Admins can manage channel access" ON public.user_channel_access;

CREATE POLICY "Admins can manage channel access" ON public.user_channel_access FOR ALL USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
)
WITH
    CHECK (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

DROP POLICY IF EXISTS "Users can read own channel access" ON public.user_channel_access;

CREATE POLICY "Users can read own channel access" ON public.user_channel_access FOR
SELECT USING (user_id = auth.uid ());

-- --- Channels: Replace existing policy ---
-- (Run these ONLY after dropping the old policy)
-- DROP POLICY IF EXISTS "Users can manage channels" ON public.channels;

-- Admins can do everything, others can only SELECT their assigned channels
-- CREATE POLICY "Channel access by role" ON public.channels
--   FOR ALL USING (
--     organization_id = public.get_my_organization_id()
--     AND (public.get_my_role() = 'admin' OR public.can_access_channel(id))
--   ) WITH CHECK (
--     organization_id = public.get_my_organization_id()
--     AND public.get_my_role() = 'admin'
--   );

-- NOTE: The commented policies above should replace existing ones.
-- For safety, we keep them commented. Run them manually after verifying
-- the current policies with: SELECT * FROM pg_policies WHERE tablename = 'channels';

-- --- Profiles: Allow admins to read all org profiles ---
-- The existing policy only allows users to manage their OWN profile.
-- We need admins to see all profiles in their org for team management.

DROP POLICY IF EXISTS "Admins can read org profiles" ON public.profiles;

CREATE POLICY "Admins can read org profiles" ON public.profiles FOR
SELECT USING (
        organization_id = public.get_my_organization_id ()
        AND public.get_my_role () = 'admin'
    );

DROP POLICY IF EXISTS "Admins can update org profiles" ON public.profiles;

CREATE POLICY "Admins can update org profiles" ON public.profiles FOR
UPDATE USING (
    organization_id = public.get_my_organization_id ()
    AND public.get_my_role () = 'admin'
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID;

-- ====================================================================
-- PAGINATION UPGRADE — Infinite Scroll + Sorting for Contacts
-- ====================================================================
-- Updates: get_contacts_for_channel RPC with pagination and sorting
-- Run this AFTER all previous migrations.
-- ====================================================================

-- Drop ALL old versions to avoid PostgREST overload conflict (PGRST203)
DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT);

DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT, INT, INT);

DROP FUNCTION IF EXISTS public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT);

-- Create with pagination + sorting support
CREATE OR REPLACE FUNCTION public.get_contacts_for_channel(
    p_channel_id UUID,
    p_search_term TEXT DEFAULT '',
    p_limit INT DEFAULT 30,
    p_offset INT DEFAULT 0,
    p_sort TEXT DEFAULT 'recent'
)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    channel_id UUID,
    platform TEXT,
    platform_user_id TEXT,
    name TEXT,
    ai_enabled BOOLEAN,
    unread_count INT,
    last_message_preview TEXT,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    crm_client_id UUID
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.organization_id,
        c.channel_id,
        c.platform,
        c.platform_user_id,
        c.name,
        c.ai_enabled,
        c.unread_count,
        c.last_message_preview,
        c.last_interaction_at,
        c.created_at,
        cl.id AS crm_client_id
    FROM public.contacts c
    LEFT JOIN public.crm_clients cl ON cl.contact_id = c.id
    WHERE c.channel_id = p_channel_id
      AND (
          p_search_term = ''
          OR c.name ILIKE '%' || p_search_term || '%'
          OR c.platform_user_id ILIKE '%' || p_search_term || '%'
      )
    ORDER BY
        CASE WHEN p_sort = 'recent' THEN c.last_interaction_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'unread' THEN c.unread_count END DESC,
        CASE WHEN p_sort = 'unread' THEN c.last_interaction_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'name' THEN c.name END ASC NULLS LAST,
        CASE WHEN p_sort = 'name' THEN c.platform_user_id END ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant access
GRANT
EXECUTE ON FUNCTION public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.get_contacts_for_channel (UUID, TEXT, INT, INT, TEXT) TO service_role;

-- ====================================================================
-- VERIFICATION
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Pagination + Sorting Upgrade applied successfully.';
    RAISE NOTICE '  ✓ get_contacts_for_channel updated with p_sort parameter';
    RAISE NOTICE '  ✓ Sort options: recent (default), unread, name';
    RAISE NOTICE '  ✓ Pagination: p_limit (default 30), p_offset (default 0)';
END $$;

-- ====================================================================
-- ADD FALLBACK MODEL & TEMPERATURE TO CHANNEL CONFIGURATIONS
-- Run this in Supabase SQL Editor
-- ====================================================================

ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS fallback_model TEXT,
ADD COLUMN IF NOT EXISTS fallback_temperature REAL;

COMMENT ON COLUMN public.channel_configurations.fallback_model IS 'Fallback AI model used when the primary model fails or is unavailable';

COMMENT ON COLUMN public.channel_configurations.fallback_temperature IS 'Temperature setting for the fallback AI model (0.0 to 1.0)';

-- ====================================================================
-- UPDATE DEFAULT KEYWORD ACTIONS: start/stop → 9/8
-- Run this in Supabase SQL Editor
-- ====================================================================

-- Change 'stop' → '8' (DISABLE_AI)
UPDATE public.keyword_actions
SET
    keyword = '8'
WHERE
    keyword = 'stop'
    AND action_type = 'DISABLE_AI';

-- Change 'start' → '9' (ENABLE_AI)
UPDATE public.keyword_actions
SET
    keyword = '9'
WHERE
    keyword = 'start'
    AND action_type = 'ENABLE_AI';