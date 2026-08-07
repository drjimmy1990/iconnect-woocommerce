-- ====================================================================
-- ANALYTICS OVERHAUL: Conversation Stage Tracking + BMI Data + Funnel
-- Run this in Supabase SQL Editor
-- ====================================================================

-- ====================================================================
-- STEP 1: Add conversation_stage to crm_clients
-- ====================================================================
ALTER TABLE public.crm_clients 
ADD COLUMN IF NOT EXISTS conversation_stage TEXT 
DEFAULT 'first_contact';

-- Add check constraint (drop first if exists to be safe)
ALTER TABLE public.crm_clients 
DROP CONSTRAINT IF EXISTS crm_clients_conversation_stage_check;

ALTER TABLE public.crm_clients 
ADD CONSTRAINT crm_clients_conversation_stage_check 
CHECK (conversation_stage IN (
  'first_contact',
  'bmi_collected',
  'testimonials_viewed',
  'price_viewed',
  'purchased'
));

COMMENT ON COLUMN public.crm_clients.conversation_stage IS 
  'Tracks where the client is in the bot sales conversation funnel';

-- ====================================================================
-- STEP 2: Add bmi_data JSONB column
-- ====================================================================
ALTER TABLE public.crm_clients 
ADD COLUMN IF NOT EXISTS bmi_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.crm_clients.bmi_data IS 
  'Stores BMI data from the bot: {"weight": 87, "height": 175, "age": 30, "bmi": 28.4}';

-- ====================================================================
-- STEP 3: Index for conversation_stage analytics queries
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_crm_clients_conversation_stage 
ON public.crm_clients (organization_id, conversation_stage);

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
GRANT EXECUTE ON FUNCTION public.update_client_stage(TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_client_stage(TEXT, UUID, TEXT, JSONB) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.get_conversation_funnel(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_funnel(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ====================================================================
-- STEP 6: Update get_crm_dashboard_summary — remove deal fields
-- Must DROP first because return type is changing (removed deal columns)
-- ====================================================================
DROP FUNCTION IF EXISTS public.get_crm_dashboard_summary(uuid, uuid, timestamp with time zone, timestamp with time zone);

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
