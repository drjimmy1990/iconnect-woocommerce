-- Migration to add follow-up toggles to channels and contacts

-- 1. Add to channel_configurations
ALTER TABLE public.channel_configurations 
ADD COLUMN IF NOT EXISTS is_followup_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add to contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_followup_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Note: We default to TRUE so existing users don't suddenly stop receiving follow-ups.
