-- REVERT: Restore source to the platform name (facebook/instagram) from the channel
-- The channel name is displayed from the join, source should stay as the platform

UPDATE crm_clients cc
SET source = ch.platform
FROM contacts co
JOIN channels ch ON co.channel_id = ch.id
WHERE cc.contact_id = co.id
  AND cc.source IS DISTINCT FROM ch.platform;
