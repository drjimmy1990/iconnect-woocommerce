-- ====================================================================
-- UPDATE DEFAULT KEYWORD ACTIONS: start/stop → 9/8
-- Run this in Supabase SQL Editor
-- ====================================================================

-- Change 'stop' → '8' (DISABLE_AI)
UPDATE public.keyword_actions
SET keyword = '8'
WHERE keyword = 'stop' AND action_type = 'DISABLE_AI';

-- Change 'start' → '9' (ENABLE_AI)
UPDATE public.keyword_actions
SET keyword = '9'
WHERE keyword = 'start' AND action_type = 'ENABLE_AI';
