-- ============================================================================
-- Migration: replace the legacy (weight-loss bot) CRM funnel with the
--            WooCommerce store funnel, and remove the BMI feature entirely.
-- Date: 2026-08-11
-- Target: Supabase project uorfbqhsaxoofzqouqsj (the dashboard DB)
--
-- WHAT THIS CHANGES
--   1. crm_clients.conversation_stage  -> new 6-value funnel (legacy values migrated)
--   2. crm_clients.bmi_data            -> DROPPED
--   3. update_client_stage()           -> p_bmi_data parameter removed (3 args now)
--   4. get_conversation_funnel()       -> new stage order
--   5. get_crm_dashboard_summary()     -> bmi/price counts renamed to store metrics
--                                         + fixes total_leads always returning 0
--
-- ⚠️ DESTRUCTIVE: step 2 drops the bmi_data column and its contents. This project
--    never wrote to it. If unsure, run the audit query at the bottom FIRST.
--
-- Run in the Supabase SQL editor. The whole migration is one transaction.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Migrate existing rows off the legacy stage values
--    Must run BEFORE the new CHECK, or existing rows would violate it.
--      bmi_collected / testimonials_viewed -> browsing     (mid-funnel engagement)
--      price_viewed                        -> order_placed (intent to buy)
--      first_contact / purchased           -> unchanged (still valid)
-- ----------------------------------------------------------------------------
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_conversation_stage_check;

UPDATE public.crm_clients
SET conversation_stage = CASE conversation_stage
        WHEN 'bmi_collected'       THEN 'browsing'
        WHEN 'testimonials_viewed' THEN 'browsing'
        WHEN 'price_viewed'        THEN 'order_placed'
        ELSE conversation_stage
    END
WHERE conversation_stage IN ('bmi_collected', 'testimonials_viewed', 'price_viewed');

-- Clean the matching 'stage:*' tags left behind by the old RPC
UPDATE public.crm_clients
SET tags = (
      SELECT COALESCE(array_agg(t), '{}')
      FROM unnest(COALESCE(tags, '{}')) AS t
      WHERE t NOT LIKE 'stage:%'
    ) || ARRAY['stage:' || conversation_stage]
WHERE tags && ARRAY['stage:bmi_collected', 'stage:testimonials_viewed', 'stage:price_viewed'];

-- ----------------------------------------------------------------------------
-- 2. Drop the BMI column (feature removed)
-- ----------------------------------------------------------------------------
ALTER TABLE public.crm_clients
DROP COLUMN IF EXISTS bmi_data;

-- ----------------------------------------------------------------------------
-- 3. The WooCommerce store funnel
--    first_contact -> browsing -> product_viewed -> order_placed -> purchased
--    'support' is a valid stage but sits OUTSIDE the funnel order (complaints /
--    human handoff), so it is excluded from funnel conversion maths by design.
-- ----------------------------------------------------------------------------
ALTER TABLE public.crm_clients
ADD CONSTRAINT crm_clients_conversation_stage_check CHECK (
    conversation_stage IN (
        'first_contact',   -- first inbound message
        'browsing',        -- searched products / listed categories
        'product_viewed',  -- asked for a specific product's details + images
        'order_placed',    -- order created, payment link sent (unpaid)
        'purchased',       -- payment confirmed
        'support'          -- complaint or handed off to a human (off-funnel)
    )
);

COMMENT ON COLUMN public.crm_clients.conversation_stage IS
  'Bot sales funnel: first_contact -> browsing -> product_viewed -> order_placed -> purchased. "support" = complaint/human handoff (off-funnel).';

-- ----------------------------------------------------------------------------
-- 4. update_client_stage() without the BMI parameter
--    The old 4-arg version must be DROPPED explicitly: Postgres overloads on
--    signature, so CREATE OR REPLACE with 3 args would leave both versions live.
--    The stage-tag cleanup is now generic ('stage:%') instead of a hardcoded list.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_client_stage (TEXT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_client_stage (TEXT, UUID, TEXT);

CREATE FUNCTION public.update_client_stage(
  p_platform_user_id TEXT,
  p_channel_id UUID,
  p_stage TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contact_id UUID;
  v_client_id UUID;
BEGIN
  SELECT id INTO v_contact_id
  FROM public.contacts
  WHERE platform_user_id = p_platform_user_id
    AND channel_id = p_channel_id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  SELECT id INTO v_client_id
  FROM public.crm_clients
  WHERE contact_id = v_contact_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CRM client not found');
  END IF;

  UPDATE public.crm_clients
  SET conversation_stage = p_stage,
      last_contact_date  = NOW(),
      updated_at         = NOW()
  WHERE id = v_client_id;

  UPDATE public.crm_clients
  SET tags = (
        SELECT COALESCE(array_agg(t), '{}')
        FROM unnest(COALESCE(tags, '{}')) AS t
        WHERE t NOT LIKE 'stage:%'
      ) || ARRAY['stage:' || p_stage]
  WHERE id = v_client_id;

  RETURN jsonb_build_object(
    'success',   true,
    'client_id', v_client_id,
    'stage',     p_stage
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. get_conversation_funnel() — new stage order
--    Return type is unchanged, so CREATE OR REPLACE is safe.
--    'support' is deliberately absent: array_position() returns NULL for it, so
--    those clients drop out of the funnel counts instead of skewing them.
-- ----------------------------------------------------------------------------
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
    'browsing',
    'product_viewed',
    'order_placed',
    'purchased'
  ];
  i INT;
  v_current_count BIGINT;
  v_next_count BIGINT;
BEGIN
  FOR i IN 1..array_length(stage_order, 1) LOOP
    SELECT COUNT(*) INTO v_current_count
    FROM public.crm_clients c
    LEFT JOIN public.contacts co ON c.contact_id = co.id
    WHERE c.organization_id = org_id
      AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
      AND (start_date IS NULL OR c.created_at >= start_date)
      AND (end_date   IS NULL OR c.created_at <= end_date)
      AND array_position(stage_order, c.conversation_stage) >= i;

    IF i < array_length(stage_order, 1) THEN
      SELECT COUNT(*) INTO v_next_count
      FROM public.crm_clients c
      LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date)
        AND array_position(stage_order, c.conversation_stage) >= (i + 1);
    ELSE
      v_next_count := v_current_count;
    END IF;

    stage           := stage_order[i];
    total           := v_current_count;
    completed       := v_next_count;
    dropped         := v_current_count - v_next_count;
    completion_rate := CASE WHEN v_current_count > 0
                            THEN ROUND((v_next_count::NUMERIC / v_current_count) * 100, 2)
                            ELSE 0 END;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_funnel (UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_funnel (UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. get_crm_dashboard_summary() — store metrics instead of BMI metrics
--    Renames two output columns, so the function must be DROPPED first
--    (CREATE OR REPLACE cannot change a function's return type).
--
--    Also fixes two pre-existing bugs:
--      * total_leads filtered client_type = 'new'  -> not a valid value, always 0.
--        crm_clients.client_type CHECK is: lead, prospect, customer, partner, inactive.
--      * total_customers included 'repeat_customer' -> also not a valid value.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_crm_dashboard_summary (UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION public.get_crm_dashboard_summary(
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
    engaged_count BIGINT,        -- reached browsing or later
    order_placed_count BIGINT    -- reached order_placed or later
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date)),
    (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id AND c.client_type = 'customer'
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date)),
    (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id AND c.client_type = 'lead'
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date)),
    (SELECT COALESCE(SUM(o.total), 0) FROM public.crm_orders o
       LEFT JOIN public.crm_clients c ON o.client_id = c.id
       LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded')
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR o.order_date >= start_date)
        AND (end_date   IS NULL OR o.order_date <= end_date)),
    (SELECT COALESCE(AVG(o.total), 0) FROM public.crm_orders o
       LEFT JOIN public.crm_clients c ON o.client_id = c.id
       LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE o.organization_id = org_id AND o.status NOT IN ('cancelled', 'refunded')
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR o.order_date >= start_date)
        AND (end_date   IS NULL OR o.order_date <= end_date)),
    (SELECT COUNT(*) FROM public.crm_activities a
       LEFT JOIN public.crm_clients c ON a.client_id = c.id
       LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE a.organization_id = org_id AND a.status = 'pending'
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR a.created_at >= start_date)
        AND (end_date   IS NULL OR a.created_at <= end_date)),
    (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id
        AND c.conversation_stage IN ('browsing', 'product_viewed', 'order_placed', 'purchased')
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date)),
    (SELECT COUNT(*) FROM public.crm_clients c LEFT JOIN public.contacts co ON c.contact_id = co.id
      WHERE c.organization_id = org_id
        AND c.conversation_stage IN ('order_placed', 'purchased')
        AND (p_channel_id IS NULL OR co.channel_id = p_channel_id)
        AND (start_date IS NULL OR c.created_at >= start_date)
        AND (end_date   IS NULL OR c.created_at <= end_date));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_dashboard_summary (UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_dashboard_summary (UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMIT;

-- ============================================================================
-- AUDIT (run BEFORE the migration if you want to check nothing is lost)
-- ============================================================================
-- SELECT COUNT(*) FILTER (WHERE bmi_data IS NOT NULL) AS rows_with_bmi FROM public.crm_clients;
-- SELECT conversation_stage, COUNT(*) FROM public.crm_clients GROUP BY 1 ORDER BY 2 DESC;
--
-- VERIFY (run AFTER)
-- ============================================================================
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conname = 'crm_clients_conversation_stage_check';
-- SELECT conversation_stage, COUNT(*) FROM public.crm_clients GROUP BY 1;
-- SELECT public.update_client_stage('<platform_user_id>', '<channel_uuid>'::uuid, 'browsing');
-- SELECT * FROM public.get_conversation_funnel('<org_uuid>'::uuid);
-- SELECT * FROM public.get_crm_dashboard_summary('<org_uuid>'::uuid);
