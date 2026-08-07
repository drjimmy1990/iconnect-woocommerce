-- Content Images storage bucket
-- Used by the dashboard to upload images into Content Collections (e.g. product_images,
-- testimonials_1) so they can be served to n8n / Facebook / Instagram via public URLs.
--
-- Run this once in the Supabase SQL Editor. Idempotent: safe to re-run.

-- 1. Create the bucket (public so external platforms can fetch the images).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-images',
  'content-images',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Public read access (n8n / Facebook / Instagram fetch these URLs unauthenticated).
DROP POLICY IF EXISTS "Public read content-images" ON storage.objects;
CREATE POLICY "Public read content-images" ON storage.objects
FOR SELECT USING (bucket_id = 'content-images');

-- 3. Authenticated upload (any logged-in dashboard user may upload).
DROP POLICY IF EXISTS "Authenticated upload content-images" ON storage.objects;
CREATE POLICY "Authenticated upload content-images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'content-images');