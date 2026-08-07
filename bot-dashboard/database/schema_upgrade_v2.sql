-- ====================================================================
--          SCHEMA UPGRADE V2 — Bot Dashboard Modernization
--          Safe, additive migration. Deletes NOTHING.
-- ====================================================================

-- ====================================================================
-- 1. MESSAGE QUEUE TABLE (Required by n8n workflow for message batching)
-- ====================================================================
-- The workflow batches rapid-fire user messages before processing with AI.
-- This table was missing from the original schema.

CREATE TABLE IF NOT EXISTS public.queue (
    id BIGSERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

-- Service-role-only access (workflow uses service_role key)
-- No RLS policy needed for authenticated users — they don't access this table.
CREATE INDEX IF NOT EXISTS idx_queue_sender_id ON public.queue(sender_id);
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON public.queue(created_at);

-- ====================================================================
-- 2. CONTENT TYPE CONSTRAINT ON MESSAGES
-- ====================================================================
-- Formalize allowed content types including video, document, sticker, location.

-- First check if the constraint already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_content_type' AND conrelid = 'public.messages'::regclass
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT chk_content_type
        CHECK (content_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location'));
    END IF;
END $$;

-- ====================================================================
-- 3. DELIVERY STATUS ON MESSAGES
-- ====================================================================
-- Track message delivery lifecycle: pending → sent → delivered → read → failed

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_delivery_status' AND conrelid = 'public.messages'::regclass
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT chk_delivery_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));
    END IF;
END $$;

-- ====================================================================
-- 4. MEDIA UPLOADS TABLE (Supabase Storage tracking)
-- ====================================================================
-- Tracks files uploaded by agents (images, voice recordings, documents)

CREATE TABLE IF NOT EXISTS public.media_uploads (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage media in their org"
ON public.media_uploads FOR ALL
USING (organization_id = get_my_organization_id())
WITH CHECK (organization_id = get_my_organization_id());

CREATE INDEX IF NOT EXISTS idx_media_uploads_message ON public.media_uploads(message_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_org ON public.media_uploads(organization_id);

-- ====================================================================
-- 5. CHECK CONSTRAINTS (Schema Hardening)
-- ====================================================================

-- profiles.role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_profile_role' AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT chk_profile_role
        CHECK (role IN ('admin', 'agent', 'viewer'));
    END IF;
END $$;

-- channels.platform
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_channel_platform' AND conrelid = 'public.channels'::regclass
    ) THEN
        ALTER TABLE public.channels
        ADD CONSTRAINT chk_channel_platform
        CHECK (platform IN ('whatsapp', 'facebook', 'instagram', 'telegram', 'webchat'));
    END IF;
END $$;

-- contacts.platform
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_contact_platform' AND conrelid = 'public.contacts'::regclass
    ) THEN
        ALTER TABLE public.contacts
        ADD CONSTRAINT chk_contact_platform
        CHECK (platform IN ('whatsapp', 'facebook', 'instagram', 'telegram', 'webchat'));
    END IF;
END $$;

-- crm_orders.fulfillment_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_fulfillment_status' AND conrelid = 'public.crm_orders'::regclass
    ) THEN
        ALTER TABLE public.crm_orders
        ADD CONSTRAINT chk_fulfillment_status
        CHECK (fulfillment_status IN ('unfulfilled', 'preparing', 'ready', 'fulfilled'));
    END IF;
END $$;

-- system_notifications.type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_notification_type' AND conrelid = 'public.system_notifications'::regclass
    ) THEN
        ALTER TABLE public.system_notifications
        ADD CONSTRAINT chk_notification_type
        CHECK (type IN ('handoff', 'alert', 'info', 'new_contact', 'order_created', 'error'));
    END IF;
END $$;

-- ====================================================================
-- 6. SYSTEM NOTIFICATIONS ENHANCEMENTS
-- ====================================================================
-- Add channel_id and contact_id for quick navigation from notifications

ALTER TABLE public.system_notifications
ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;

ALTER TABLE public.system_notifications
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.system_notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_contact ON public.system_notifications(contact_id);

-- ====================================================================
-- 7. MISSING UPDATED_AT TRIGGERS
-- ====================================================================

-- contacts.updated_at trigger
DROP TRIGGER IF EXISTS trigger_contacts_updated_at ON public.contacts;
CREATE TRIGGER trigger_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- channels - add updated_at column first if missing, then trigger
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_channels_updated_at ON public.channels;
CREATE TRIGGER trigger_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- channel_configurations.updated_at trigger (already has the column)
DROP TRIGGER IF EXISTS trigger_channel_config_updated_at ON public.channel_configurations;
CREATE TRIGGER trigger_channel_config_updated_at
BEFORE UPDATE ON public.channel_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- 8. SECURITY FIX: sync_contact_update_to_client search_path
-- ====================================================================

ALTER FUNCTION public.sync_contact_update_to_client() SET search_path = '';

-- ====================================================================
-- 9. ADDITIONAL INDEXES FOR PERFORMANCE
-- ====================================================================

-- Messages: filter by sender_type (analytics)
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON public.messages(sender_type);

-- Messages: filter by content_type for media browsing (skip text)
CREATE INDEX IF NOT EXISTS idx_messages_content_type ON public.messages(content_type) WHERE content_type != 'text';

-- Messages: delivery status for tracking
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON public.messages(delivery_status) WHERE delivery_status != 'sent';

-- Contacts: composite for the main chat query
CREATE INDEX IF NOT EXISTS idx_contacts_channel_unread ON public.contacts(channel_id, unread_count DESC, last_interaction_at DESC);

-- CRM clients: lifecycle funnel queries
CREATE INDEX IF NOT EXISTS idx_crm_clients_lifecycle ON public.crm_clients(organization_id, lifecycle_stage);

-- CRM deals: per-client queries
CREATE INDEX IF NOT EXISTS idx_crm_deals_client ON public.crm_deals(client_id);

-- ====================================================================
-- 10. VERIFICATION
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Schema Upgrade V2 applied successfully.';
    RAISE NOTICE '  ✓ queue table created';
    RAISE NOTICE '  ✓ content_type CHECK constraint added';
    RAISE NOTICE '  ✓ delivery_status column added to messages';
    RAISE NOTICE '  ✓ media_uploads table created';
    RAISE NOTICE '  ✓ CHECK constraints added (profile role, platform, fulfillment, notifications)';
    RAISE NOTICE '  ✓ system_notifications enhanced with channel_id, contact_id';
    RAISE NOTICE '  ✓ Missing updated_at triggers added';
    RAISE NOTICE '  ✓ Security: search_path hardened on sync function';
    RAISE NOTICE '  ✓ Performance indexes added';
END $$;
