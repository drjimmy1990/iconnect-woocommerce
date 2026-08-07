-- ====================================================================
-- SETTINGS PAGE V2 — New Channel Configuration Columns
-- ====================================================================
-- Adds configurable fields that are currently hardcoded in n8n workflows.
-- n8n already fetches channel_configurations via its startup query, so
-- any value stored here is automatically available to the workflow.

-- 1. Agent Webhook URL (for agent-initiated message sending via n8n)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS agent_webhook_url TEXT;

COMMENT ON COLUMN public.channel_configurations.agent_webhook_url IS
  'n8n webhook URL for sending agent-initiated messages (text, media, voice)';

-- 2. E-Commerce Integration Config (for order creation via external API)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS ecommerce_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.channel_configurations.ecommerce_config IS
  'E-commerce platform credentials: { api_url, api_key, login_email, login_password }';

-- 3. Notification Config (Telegram group IDs for escalations)
ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS notification_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.channel_configurations.notification_config IS
  'Notification routing config: { telegram_complaints_group_id, telegram_cancellations_group_id }';
