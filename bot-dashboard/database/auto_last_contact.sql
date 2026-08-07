-- Auto-update crm_clients.last_contact_date when a new message arrives
-- Run this ONCE in Supabase SQL Editor

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION update_client_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_contact_date on the crm_client linked to this contact
  UPDATE crm_clients
  SET last_contact_date = COALESCE(NEW.platform_timestamp, NEW.sent_at, NOW())
  WHERE contact_id = NEW.contact_id
    AND (last_contact_date IS NULL 
         OR last_contact_date < COALESCE(NEW.platform_timestamp, NEW.sent_at, NOW()));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger (fires on every new message insert)
DROP TRIGGER IF EXISTS trg_update_last_contact ON messages;
CREATE TRIGGER trg_update_last_contact
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_contact();

-- Step 3: Backfill existing data — set last_contact_date from the latest message
UPDATE crm_clients cc
SET last_contact_date = latest.max_ts
FROM (
  SELECT contact_id, MAX(COALESCE(platform_timestamp, sent_at)) AS max_ts
  FROM messages
  GROUP BY contact_id
) latest
WHERE cc.contact_id = latest.contact_id
  AND (cc.last_contact_date IS NULL OR cc.last_contact_date < latest.max_ts);
