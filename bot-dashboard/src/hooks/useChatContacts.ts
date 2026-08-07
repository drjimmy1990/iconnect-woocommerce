// src/hooks/useChatContacts.ts
'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

const PAGE_SIZE = 30;

export type SortOption = 'recent' | 'unread' | 'name';

// --- DEBOUNCING UTILITY ---
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

// A new interface for the data returned by our RPC function
interface ContactWithClient extends api.Contact {
  crm_client_id: string | null;
}

export const useChatContacts = (channelId: string | null, searchTerm?: string, sortBy: SortOption = 'recent') => {
  const queryClient = useQueryClient();
  const debouncedSearchTerm = useDebounce(searchTerm || '', 300);
  const queryKey = ['contacts', channelId, debouncedSearchTerm, sortBy];

  const {
    data,
    isLoading: isLoadingContacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ContactWithClient[]>({
    queryKey: queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      if (!channelId) return [];

      const { data, error } = await supabase.rpc('get_contacts_for_channel', {
        p_channel_id: channelId,
        p_search_term: debouncedSearchTerm,
        p_limit: PAGE_SIZE,
        p_offset: pageParam as number,
        p_sort: sortBy,
      });

      if (error) {
        console.error("Error calling get_contacts_for_channel RPC:", error);
        throw new Error(error.message);
      }
      return data || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
    enabled: !!channelId,
  });

  // Flatten all pages into a single contacts array
  const contacts = data?.pages.flat() ?? [];

  // (Mutations remain the same)
  const updateNameMutation = useMutation({ mutationFn: api.updateContactName, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts', channelId] }); }, });
  const toggleAiMutation = useMutation({ mutationFn: api.toggleAiStatus, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts', channelId] }); }, });
  const deleteContactMutation = useMutation({ mutationFn: api.deleteContact, onSuccess: (data, contactId) => { queryClient.invalidateQueries({ queryKey: ['contacts', channelId] }); queryClient.removeQueries({ queryKey: ['messages', contactId] }); } });

  // (Realtime logic remains the same)
  useEffect(() => {
    if (!channelId) return;
    const subscriptionChannel: RealtimeChannel = supabase
      .channel(`public:contacts:channel_id=eq.${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `channel_id=eq.${channelId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['contacts', channelId] });
      }).subscribe();
    return () => { supabase.removeChannel(subscriptionChannel); };
  }, [queryClient, channelId]);

  // Scroll handler
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    contacts,
    isLoadingContacts,
    updateName: updateNameMutation.mutate,
    toggleAi: toggleAiMutation.mutate,
    deleteContact: deleteContactMutation.mutate,
    loadMore,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
};