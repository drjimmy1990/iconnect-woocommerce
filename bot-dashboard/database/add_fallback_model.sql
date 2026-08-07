-- ====================================================================
-- ADD FALLBACK MODEL & TEMPERATURE TO CHANNEL CONFIGURATIONS
-- Run this in Supabase SQL Editor
-- ====================================================================

ALTER TABLE public.channel_configurations
ADD COLUMN IF NOT EXISTS fallback_model TEXT,
ADD COLUMN IF NOT EXISTS fallback_temperature REAL;

COMMENT ON COLUMN public.channel_configurations.fallback_model IS 
  'Fallback AI model used when the primary model fails or is unavailable';
COMMENT ON COLUMN public.channel_configurations.fallback_temperature IS 
  'Temperature setting for the fallback AI model (0.0 to 1.0)';
