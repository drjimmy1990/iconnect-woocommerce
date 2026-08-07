// src/hooks/useContentImageUpload.ts
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const BUCKET_NAME = 'content-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (matches the bucket's file_size_limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export interface ContentImageUploadResult {
  url: string;
  path: string;
  fileName: string;
}

interface UseContentImageUploadReturn {
  uploadImage: (file: File, channelId: string, collectionId: string) => Promise<ContentImageUploadResult>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

/**
 * Detects whether a collection item is an image URL (uploaded via the dashboard
 * or pasted as a direct image link). Used to decide whether to render a thumbnail.
 */
export function isImageUrl(value: string): boolean {
  if (!value) return false;
  return /^https?:\/\/.+\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(value.trim());
}

/**
 * Uploads an image file into the public `content-images` bucket under
 * `{channelId}/{collectionId}/{timestamp}_{filename}` and returns its public URL.
 * The URL is what gets stored in `content_collections.items` and consumed by n8n.
 */
export function useContentImageUpload(): UseContentImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (
    file: File,
    channelId: string,
    collectionId: string,
  ): Promise<ContentImageUploadResult> => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const baseMimeType = file.type.split(';')[0].trim();
      if (!ALLOWED_TYPES.includes(baseMimeType)) {
        throw new Error(
          `Unsupported image type: ${file.type || 'unknown'}. Allowed: JPEG, PNG, GIF, WebP.`,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeCollectionId = collectionId.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${channelId}/${safeCollectionId}/${timestamp}_${sanitizedName}`;

      setUploadProgress(20);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(80);

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      setUploadProgress(100);

      return {
        url: urlData.publicUrl,
        path: storagePath,
        fileName: file.name,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadImage, isUploading, uploadProgress, error };
}