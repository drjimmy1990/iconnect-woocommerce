-- ============================================================================
-- Migration: adapt the CRM conversation funnel to the WooCommerce store bot
-- Date: 2026-08-11
-- Target: Supabase project uorfbqhsaxoofzqouqsj (the dashboard DB)
--
-- WHY:
--   database_setup_final.sql (STEP 1, ~line 2212) locks crm_clients.conversation_stage
--   to a funnel from a DIFFERENT project (a weight-loss bot):
--       'first_contact', 'bmi_collected', 'testimonials_viewed', 'price_viewed', 'purchased'
--   'bmi_collected' and 'testimonials_viewed' are meaningless for a network-cable store,
--   and any other value is REJECTED by the CHECK constraint — so update_client_stage()
--   would fail for our stages.
--
--   Also, update_client_stage() cleans old "stage:*" tags with a HARDCODED list of those
--   five names, so new stage names would leave stale tags behind forever.
--
-- SAFE TO RUN: additive + widening only. No data is deleted. Existing rows keep their
-- values ('first_contact' and 'purchased' remain valid). Run it in the Supabase SQL editor.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Widen the allowed funnel stages
--    Old values are kept so existing rows stay valid; legacy ones can be dropped
--    later once no row uses them.
-- ----------------------------------------------------------------------------
ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_conversation_stage_check;

ALTER TABLE public.crm_clients
ADD CONSTRAINT crm_clients_conversation_stage_check CHECK (
    conversation_stage IN (
        -- WooCommerce store funnel (this project)
        'first_contact',      -- first inbound message
        'browsing',           -- searched / listed categories
        'product_viewed',     -- asked for a specific product's details + images
        'order_placed',       -- order created, payment link sent (unpaid)
        'purchased',          -- payment confirmed
        'support',            -- complaint or handed off to a human
        -- legacy values from the previous project, retained so old rows stay valid
        'bmi_collected',
        'testimonials_viewed',
        'price_viewed'
    )
);

COMMENT ON COLUMN public.crm_clients.conversation_stage IS
  'Bot sales funnel stage. WooCommerce store: first_contact -> browsing -> product_viewed -> order_placed -> purchased. "support" = complaint/human handoff. Legacy values from the previous project are still accepted.';

-- ----------------------------------------------------------------------------
-- 2. Make the stage-tag cleanup generic
--    The original body removed exactly five hardcoded 'stage:*' tags. Replaced with
--    a filter that strips ANY 'stage:%' tag, so the tag list can never drift again.
--    Signature is unchanged, so existing n8n calls keep working.
-- ----------------------------------------------------------------------------
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
      bmi_data           = COALESCE(p_bmi_data, bmi_data),
      last_contact_date  = NOW(),
      updated_at         = NOW()
  WHERE id = v_client_id;

  -- Strip every existing 'stage:*' tag, then apply the current one.
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

GRANT EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_client_stage (TEXT, UUID, TEXT, JSONB) TO authenticated;

COMMIT;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conname = 'crm_clients_conversation_stage_check';
--
-- SELECT public.update_client_stage('<platform_user_id>', '<channel_uuid>'::uuid, 'browsing');
