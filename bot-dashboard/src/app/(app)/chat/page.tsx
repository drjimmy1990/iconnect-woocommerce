// src/app/(app)/chat/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
// 1. Import useSearchParams
import { useSearchParams } from 'next/navigation';
import { Box, IconButton, Tooltip, CircularProgress } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ContactList from "@/components/chat/ContactList";
import ChatArea from "@/components/chat/ChatArea";
import { useChannel } from '@/providers/ChannelProvider';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabaseClient'; // Import supabase directly

export default function ChatPage() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isContactListOpen, setContactListOpen] = useState(true);
  // 2. Get Search Params
  const searchParams = useSearchParams();
  const linkedClientId = searchParams.get('clientId');
  const [isResolvingLink, setIsResolvingLink] = useState(!!linkedClientId);

  const toggleContactList = () => setContactListOpen(prev => !prev);
  const { activeChannel } = useChannel();
  const queryClient = useQueryClient();

  // 3. EFFECT: Resolve Client ID to Contact ID
  useEffect(() => {
    async function resolveContact() {
      if (!linkedClientId) return;

      try {
        // Query the DB to find which contact belongs to this client
        const { data, error: _error } = await supabase
          .from('crm_clients')
          .select('contact_id')
          .eq('id', linkedClientId)
          .single();

        if (data && data.contact_id) {
          setSelectedContactId(data.contact_id);
        }
      } catch (error) {
        console.error("Error resolving client link:", error);
      } finally {
        setIsResolvingLink(false);
      }
    }

    resolveContact();
  }, [linkedClientId]);

  const { mutate: deleteContact } = useMutation({
    mutationFn: api.deleteContact,
    onSuccess: (data, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', activeChannel?.id] });
      queryClient.removeQueries({ queryKey: ['messages', contactId] });
      setSelectedContactId(null);
    }
  });

  const { messages, isLoadingMessages, sendMessage, isSendingMessage } = useChatMessages(
    selectedContactId,
    activeChannel?.id || null,
    activeChannel?.organization_id || null
  );

  useEffect(() => {
    // Only reset if we aren't currently trying to link a client from the URL
    if (!linkedClientId) {
      setSelectedContactId(null);
    }
  }, [activeChannel?.id, linkedClientId]);

  const handleSendMessage = (text: string, platform: string, platformUserId: string, platformChannelId: string) => {
    if (!selectedContactId) return;
    sendMessage({ contact_id: selectedContactId, content_type: 'text', text_content: text, platform, platform_user_id: platformUserId, platform_channel_id: platformChannelId });
  }

  const handleSendImageByUrl = (url: string, platform: string, platformUserId: string, platformChannelId: string) => {
    if (!selectedContactId) return;
    sendMessage({ contact_id: selectedContactId, content_type: 'image', attachment_url: url, platform, platform_user_id: platformUserId, platform_channel_id: platformChannelId });
  }

  const handleSendMedia = (params: {
    platform: string;
    platform_user_id: string;
    platform_channel_id: string;
    content_type: 'image' | 'audio' | 'video' | 'document';
    attachment_url: string;
    attachment_metadata?: {
      mime_type?: string;
      file_size?: number;
      duration_seconds?: number;
      file_name?: string;
    };
  }) => {
    if (!selectedContactId) return;
    sendMessage({
      contact_id: selectedContactId,
      content_type: params.content_type,
      attachment_url: params.attachment_url,
      platform: params.platform,
      platform_user_id: params.platform_user_id,
      platform_channel_id: params.platform_channel_id,
    });
  }

  // 4. Show loading state while resolving the link
  if (isResolvingLink) {
    return (
      <Box sx={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      <Box
        sx={{
          width: isContactListOpen ? 320 : 0,
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.2s ease-in-out',
          height: '100%',
        }}
      >
        <ContactList
          selectedContactId={selectedContactId}
          onSelectContact={setSelectedContactId}
        />
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 0.5, backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, height: '49px' }}>
          <Tooltip title={isContactListOpen ? "Hide Contacts" : "Show Contacts"}>
            <IconButton onClick={toggleContactList}>
              {isContactListOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          <ChatArea
            contactId={selectedContactId}
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            onSendMessage={handleSendMessage}
            onSendImageByUrl={handleSendImageByUrl}
            onSendMedia={handleSendMedia}
            isSendingMessage={isSendingMessage}
            onDeleteContact={deleteContact}
          />
        </Box>
      </Box>
    </Box>
  );
}