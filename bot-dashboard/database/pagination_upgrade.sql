-- ====================================================================
-- PAGINATION UPGRADE — Infinite Scroll + Sorting for Contacts
-- ====================================================================
-- Updates: get_contacts_for_channel RPC with pagination and sorting
-- Run this AFTER all previous migrations.
-- ====================================================================

-- Drop ALL old versions to avoid PostgREST overload conflict (PGRST203)
DROP FUNCTION IF EXISTS public.get_contacts_for_channel(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_contacts_for_channel(UUID, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.get_contacts_for_channel(UUID, TEXT, INT, INT, TEXT);

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
GRANT EXECUTE ON FUNCTION public.get_contacts_for_channel(UUID, TEXT, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contacts_for_channel(UUID, TEXT, INT, INT, TEXT) TO service_role;

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
