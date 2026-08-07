// src/hooks/useMessageTemplates.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';

export interface MessageTemplate {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  content: string;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CreateTemplateInput {
  name: string;
  content: string;
  category?: string;
}

interface UpdateTemplateInput {
  id: string;
  name?: string;
  content?: string;
  category?: string;
  sort_order?: number;
}

const QUERY_KEY = ['message-templates'];

export function useMessageTemplates() {
  const { user } = useAuth();

  return useQuery<MessageTemplate[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useCreateTemplate() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!user || !profile) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id,
          organization_id: profile.organization_id,
          name: input.name,
          content: input.content,
          category: input.category || 'general',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTemplateInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('message_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
