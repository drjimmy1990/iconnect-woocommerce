-- ====================================================================
-- STEP 1: Drop old CHECK constraint first (it blocks new values)
-- ====================================================================
ALTER TABLE public.crm_clients DROP CONSTRAINT IF EXISTS crm_clients_client_type_check;

-- ====================================================================
-- STEP 2: Migrate existing client_type values to new values
-- ====================================================================
UPDATE public.crm_clients SET client_type = 'new' WHERE client_type = 'lead';
UPDATE public.crm_clients SET client_type = 'interested' WHERE client_type = 'prospect';
UPDATE public.crm_clients SET client_type = 'customer' WHERE client_type = 'partner';
-- 'customer' stays 'customer', 'inactive' stays 'inactive'

-- ====================================================================
-- STEP 3: Add new CHECK constraint
-- ====================================================================
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_client_type_check 
  CHECK (client_type IN ('new', 'interested', 'customer', 'repeat_customer', 'inactive'));

-- Update default
ALTER TABLE public.crm_clients ALTER COLUMN client_type SET DEFAULT 'new';

-- ====================================================================
-- STEP 3: Drop lifecycle_stage column
-- ====================================================================
ALTER TABLE public.crm_clients DROP CONSTRAINT IF EXISTS crm_clients_lifecycle_stage_check;
ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS lifecycle_stage;

-- ====================================================================
-- STEP 4: Drop unused e-commerce columns
-- ====================================================================
ALTER TABLE public.crm_clients DROP CONSTRAINT IF EXISTS unique_ecommerce_customer;
ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS ecommerce_customer_id;
ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS total_orders;
ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS total_revenue;
ALTER TABLE public.crm_clients DROP COLUMN IF EXISTS average_order_value;
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
ALTER TABLE public.crm_orders ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE public.crm_products ALTER COLUMN currency SET DEFAULT 'EGP';

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
DROP FUNCTION IF EXISTS public.calculate_win_rate(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_deal_trends(UUID, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_deal_pipeline_snapshot(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);

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
