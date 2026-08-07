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
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, channel_id)
);
ALTER TABLE public.user_channel_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_access_user ON public.user_channel_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_access_channel ON public.user_channel_access(channel_id);

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
CREATE POLICY "Admins can manage permissions" ON public.user_permissions
    FOR ALL USING (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    ) WITH CHECK (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    );

DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_permissions;
CREATE POLICY "Users can read own permissions" ON public.user_permissions
    FOR SELECT USING (user_id = auth.uid());

-- --- user_channel_access table ---
DROP POLICY IF EXISTS "Admins can manage channel access" ON public.user_channel_access;
CREATE POLICY "Admins can manage channel access" ON public.user_channel_access
    FOR ALL USING (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    ) WITH CHECK (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    );

DROP POLICY IF EXISTS "Users can read own channel access" ON public.user_channel_access;
CREATE POLICY "Users can read own channel access" ON public.user_channel_access
    FOR SELECT USING (user_id = auth.uid());

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
CREATE POLICY "Admins can read org profiles" ON public.profiles
    FOR SELECT USING (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    );

DROP POLICY IF EXISTS "Admins can update org profiles" ON public.profiles;
CREATE POLICY "Admins can update org profiles" ON public.profiles
    FOR UPDATE USING (
        organization_id = public.get_my_organization_id()
        AND public.get_my_role() = 'admin'
    );



ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID;