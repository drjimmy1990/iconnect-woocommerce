-- Migration: append_client_category
-- Purpose: Appends unique product categories to crm_clients.tags without duplicates
--          and preserves existing client_type (e.g. customer stays customer) unless explicitly changed.

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
  IF p_category IS NOT NULL AND TRIM(p_category) != '' THEN
    UPDATE crm_clients
    SET 
      tags = ARRAY(
        SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY[TRIM(p_category)])
      ),
      client_type = CASE 
        WHEN p_client_status IS NOT NULL AND TRIM(p_client_status) != '' THEN TRIM(p_client_status)
        WHEN client_type = 'new' THEN 'interested'
        ELSE client_type
      END,
      updated_at = NOW()
    WHERE contact_id = p_contact_id;
  ELSE
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

GRANT EXECUTE ON FUNCTION append_client_category(UUID, TEXT, TEXT) TO authenticated, service_role, anon;
