// src/components/chat/UnifiedChatInterface.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import Link from 'next/link';
import ContactList from './ContactList';
import ChatArea from './ChatArea';
import { useChannel } from '@/providers/ChannelProvider';
// useChatContacts is no longer needed here
import { useChatMessages } from '@/hooks/useChatMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';

export default function UnifiedChatInterface() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isContactListOpen, setContactListOpen] = useState(true);
  const toggleContactList = () => setContactListOpen(prev => !prev);

  const { activeChannel } = useChannel();
  const queryClient = useQueryClient();

  const { mutate: deleteContact } = useMutation({
    mutationFn: api.deleteContact,
    onSuccess: (data, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', activeChannel?.id] });
      queryClient.removeQueries({ queryKey: ['messages', contactId] });
      setSelectedContactId(null); // Deselect contact after deletion
    }
  });

  const { messages, isLoadingMessages, sendMessage, isSendingMessage } = useChatMessages(
    selectedContactId,
    activeChannel?.id || null,
    activeChannel?.organization_id || null
  );

  // This component no longer holds the contacts list, so we can't find the selectedContact here.
  // We will pass the selectedContactId to ChatArea and it will fetch its own details if needed, or we adapt ChatArea.
  // For now, let's simplify and assume ChatArea can handle a contactId. We will adjust ChatArea if needed.

  useEffect(() => {
    setSelectedContactId(null);
  }, [activeChannel?.id]);

  const handleSendMessage = (text: string, platform: string, platformUserId: string, platformChannelId: string) => {
    if (!selectedContactId) return;
    sendMessage({
      contact_id: selectedContactId,
      content_type: 'text',
      text_content: text,
      platform: platform,
      platform_user_id: platformUserId,
      platform_channel_id: platformChannelId,
    });
  }

  const handleSendImageByUrl = (url: string, platform: string, platformUserId: string, platformChannelId: string) => {
    if (!selectedContactId) return;
    sendMessage({
      contact_id: selectedContactId,
      content_type: 'image',
      attachment_url: url,
      platform: platform,
      platform_user_id: platformUserId,
      platform_channel_id: platformChannelId,
    });
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

  if (!activeChannel) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Paper sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <QuestionAnswerIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
          <Typography variant="h5">No Channel Selected</Typography>
          <Button component={Link} href="/channels" variant="contained">
            Manage Channels
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      <Box
        sx={{
          width: isContactListOpen ? 320 : 0,
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.3s ease-in-out',
          height: '100%',
        }}
      >
        <ContactList
          selectedContactId={selectedContactId}
          onSelectContact={setSelectedContactId}
        />
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 0.5, backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Tooltip title={isContactListOpen ? "Hide Contacts" : "Show Contacts"}>
            <IconButton onClick={toggleContactList}>
              {isContactListOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          {/* We'll need to adapt ChatArea to work with just an ID */}
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