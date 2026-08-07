-- Test 1: Get summary for ALL TIME (no date filter)
-- Expectation: Should return the total count of all clients (e.g., 44)
SELECT total_clients, total_leads, total_customers 
FROM public.get_crm_dashboard_summary(
  (SELECT id FROM organizations LIMIT 1), -- Gets your Org ID automatically
  NULL, -- No channel filter
  NULL, -- No start date
  NULL  -- No end date
);

-- Test 2: Get summary for LAST 7 DAYS
-- Expectation: Should return a smaller number (e.g., 2, based on your data)
SELECT total_clients, total_leads, total_customers 
FROM public.get_crm_dashboard_summary(
  (SELECT id FROM organizations LIMIT 1),
  NULL,
  NOW() - INTERVAL '7 days', -- Start date: 7 days ago
  NOW()                      -- End date: Now
);
