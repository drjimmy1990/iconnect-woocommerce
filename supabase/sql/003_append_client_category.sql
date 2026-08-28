-- ============================================================================
-- Migration: 003_append_client_category
-- Purpose: Appends unique product categories to crm_clients.tags without duplicates
--          and updates client_type lifecycle status seamlessly.
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
      client_type = COALESCE(
        NULLIF(TRIM(p_client_status), ''),
        CASE WHEN client_type = 'new' THEN 'interested' ELSE client_type END
      ),
      updated_at = NOW()
    WHERE contact_id = p_contact_id;
  ELSE
    -- 2. If no category provided, only update client_type if a status is passed
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

-- Grant execution permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION append_client_category(UUID, TEXT, TEXT) TO authenticated, service_role, anon;
