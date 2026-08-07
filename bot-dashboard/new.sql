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
CREATE INDEX IF NOT EXISTS idx_crm_clients_search_safe 
ON public.crm_clients (email, phone, company_name);

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
GRANT EXECUTE ON FUNCTION public.refresh_all_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_analytics() TO service_role;
ALTER FUNCTION public.refresh_all_analytics() OWNER TO postgres;







-- ====================================================================
-- NOTIFICATION SYSTEM
-- Realtime notification table for handoffs, alerts, etc.
-- ====================================================================

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.crm_clients(id) ON DELETE SET NULL,
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
CREATE POLICY "Users can view org notifications"
ON public.system_notifications
FOR SELECT
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Policy: Users can update (mark as read) notifications
DROP POLICY IF EXISTS "Users can update org notifications" ON public.system_notifications;
CREATE POLICY "Users can update org notifications"
ON public.system_notifications
FOR UPDATE
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Enable Realtime (Crucial for the popup to work instantly)
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_org_read ON public.system_notifications(organization_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.system_notifications(created_at DESC);







-- Grant refresh permissions to the function owner
ALTER MATERIALIZED VIEW public.analytics_channel_performance OWNER TO postgres;
ALTER MATERIALIZED VIEW public.analytics_deal_metrics OWNER TO postgres;
ALTER MATERIALIZED VIEW public.analytics_revenue_metrics OWNER TO postgres;
ALTER MATERIALIZED VIEW public.analytics_chatbot_effectiveness OWNER TO postgres;

-- Make sure the refresh function runs as postgres (owner)
ALTER FUNCTION public.refresh_all_analytics() OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.refresh_all_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_analytics() TO service_role;