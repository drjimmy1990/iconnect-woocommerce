// src/hooks/useMediaUpload.ts
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface UseMediaUploadReturn {
  uploadFile: (file: File, channelId: string) => Promise<UploadResult>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

const BUCKET_NAME = 'chat-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
};

const ALL_ALLOWED_TYPES = Object.values(ALLOWED_TYPES).flat();

export function getContentTypeFromMime(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  const baseMime = mimeType.split(';')[0].trim();
  for (const [contentType, mimes] of Object.entries(ALLOWED_TYPES)) {
    if (mimes.includes(baseMime)) {
      return contentType as 'image' | 'audio' | 'video' | 'document';
    }
  }
  return 'document'; // fallback
}

export const useMediaUpload = (): UseMediaUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, channelId: string): Promise<UploadResult> => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      }

      // Validate file type — strip codec params (e.g., "audio/webm;codecs=opus" → "audio/webm")
      const baseMimeType = file.type.split(';')[0].trim();
      if (!ALL_ALLOWED_TYPES.includes(baseMimeType)) {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      // Generate unique path: channel_id/timestamp_filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${channelId}/${timestamp}_${sanitizedName}`;

      setUploadProgress(20);

      // Upload to Supabase Storage
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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      setUploadProgress(100);

      return {
        url: urlData.publicUrl,
        path: storagePath,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, uploadProgress, error };
};
