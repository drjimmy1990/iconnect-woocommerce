// src/hooks/useChatMessages.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

// REMOVED: Hardcoded ID constants. We will get these from arguments.

// 1. Hook now accepts channelId and organizationId
export const useChatMessages = (contactId: string | null, channelId: string | null, organizationId: string | null) => {
  const queryClient = useQueryClient();

  // REMOVED: Validation for old hardcoded IDs

  // --- QUERY ---
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<api.Message[]>({
    queryKey: ['messages', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      await Promise.all([
        api.markChatAsRead(contactId),
        // 2. Invalidate the dynamic contacts query key
        queryClient.invalidateQueries({ queryKey: ['contacts', channelId] })
      ]);

      return api.getMessagesForContact(contactId);
    },
    // 3. Query is enabled only when we have all necessary IDs
    enabled: !!contactId && !!channelId,
  });

  // --- MUTATION for sending a message ---
  const sendMessageMutation = useMutation({
    // The mutation function's variables are defined by what we pass to `mutate()`
    mutationFn: (vars: {
      contact_id: string;
      content_type: 'text' | 'image' | 'audio' | 'video' | 'document';
      text_content?: string;
      attachment_url?: string;
      attachment_metadata?: {
        mime_type?: string;
        file_size?: number;
        duration_seconds?: number;
        file_name?: string;
      };
      platform: string;
      platform_user_id: string;
      platform_channel_id: string;
    }) => {
      // Critical: Ensure channelId and organizationId are passed to the API call
      if (!channelId || !organizationId) {
        return Promise.reject(new Error("Cannot send message: channel or organization ID is missing."));
      }
      return api.sendMessage({
        ...vars,
        channel_id: channelId,
        organization_id: organizationId,
      });
    },
    // Optimistic update: show message immediately with local data
    onMutate: async (vars) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', contactId] });

      const previousMessages = queryClient.getQueryData<api.Message[]>(['messages', contactId]);

      // Build a temporary message from the local data we already have
      const optimisticMessage: api.Message = {
        id: `temp-${Date.now()}`,
        contact_id: vars.contact_id,
        sender_type: 'agent',
        content_type: vars.content_type,
        text_content: vars.text_content || null,
        attachment_url: vars.attachment_url || null,
        attachment_metadata: vars.attachment_metadata || null,
        sent_at: new Date().toISOString(),
        delivery_status: 'pending',
      };

      queryClient.setQueryData(['messages', contactId], (old: api.Message[] | undefined) =>
        old ? [...old, optimisticMessage] : [optimisticMessage]
      );

      return { previousMessages };
    },
    // If the mutation fails, roll back to the previous messages
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', contactId], context.previousMessages);
      }
    },
    // After success or error, refetch to get the real data from DB
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', channelId] });
    },
  });

  // --- REALTIME ---
  useEffect(() => {
    // 6. Do nothing if contactId or channelId is missing
    if (!contactId || !channelId) return;

    const channel = supabase
      .channel(`public-messages-contact-${contactId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contactId}` },
        (payload) => {
          console.log('New message via realtime:', payload);
          const newMessage = payload.new as api.Message;

          queryClient.setQueryData(['messages', contactId], (oldData: api.Message[] | undefined) => {
            if (!oldData) return [newMessage];
            // Skip if we already have this exact message
            if (oldData.find(msg => msg.id === newMessage.id)) return oldData;
            
            // If this is an agent message, replace any temp optimistic messages
            if (newMessage.sender_type === 'agent') {
              const withoutTemp = oldData.filter(msg => !msg.id.startsWith('temp-'));
              return [...withoutTemp, newMessage];
            }
            
            return [...oldData, newMessage];
          });

          if (document.hasFocus()) {
            api.markChatAsRead(contactId)
              // 7. Invalidate the dynamic contacts query key
              .then(() => queryClient.invalidateQueries({ queryKey: ['contacts', channelId] }));
          } else {
            queryClient.invalidateQueries({ queryKey: ['contacts', channelId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // 8. Add channelId to the dependency array
  }, [contactId, queryClient, channelId]);


  return {
    messages,
    isLoadingMessages,
    sendMessage: sendMessageMutation.mutate,
    isSendingMessage: sendMessageMutation.isPending,
  };
};