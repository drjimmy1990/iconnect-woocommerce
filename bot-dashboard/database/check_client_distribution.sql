-- Check the distribution of client creation dates
SELECT 
    DATE(created_at) as creation_date, 
    COUNT(*) as client_count 
FROM public.crm_clients 
GROUP BY DATE(created_at) 
ORDER BY creation_date DESC;
