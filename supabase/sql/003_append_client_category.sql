-- ============================================================================
-- Migration: 003_append_client_category
-- Purpose: Appends unique product categories to crm_clients.tags without duplicates
--          and preserves existing client_type (e.g. customer stays customer) unless explicitly changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION append_client_category(
  p_contact_id UUID,
  p_category TEXT DEFAULT NULL,
  p_client_status TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. If category is provided and non-empty, append uniquely to tags array
  IF p_category IS NOT NULL AND TRIM(p_category) != '' THEN
    UPDATE crm_clients
    SET 
      tags = ARRAY(
        SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY[TRIM(p_category)])
      ),
      client_type = CASE 
        -- If an explicit status was passed, use it
        WHEN p_client_status IS NOT NULL AND TRIM(p_client_status) != '' THEN TRIM(p_client_status)
        -- Otherwise, if client was 'new', promote to 'interested'
        WHEN client_type = 'new' THEN 'interested'
        -- Otherwise, KEEP current status (e.g. customer remains customer!)
        ELSE client_type
      END,
      updated_at = NOW()
    WHERE contact_id = p_contact_id;
  ELSE
    -- 2. If no category provided, only update client_type if an explicit status is passed
    IF p_client_status IS NOT NULL AND TRIM(p_client_status) != '' THEN
      UPDATE crm_clients
      SET 
        client_type = TRIM(p_client_status),
        updated_at = NOW()
      WHERE contact_id = p_contact_id;
    END IF;
  END IF;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION append_client_category(UUID, TEXT, TEXT) TO authenticated, service_role, anon;
