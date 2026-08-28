// src/components/chat/ChatArea.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Alert, Snackbar,
  Chip, Menu, MenuItem, alpha, Stack, FormControlLabel, Switch, ListItemIcon, ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import { Contact, Message, toggleFollowupStatus } from '@/lib/api';
import { CLIENT_STATUS_CONFIG, PRODUCT_CATEGORIES, getCategoryMeta } from '@/lib/categories';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useMediaUpload, getContentTypeFromMime } from '@/hooks/useMediaUpload';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useChannel } from '@/providers/ChannelProvider';

type ContactWithClient = Contact & {
  crm_clients: {
    id: string;
    client_type: string;
    conversation_stage: string | null;
    phone: string | null;
    tags: string[] | null;
    lead_quality: string | null;
  } | null;
  channels: { platform_channel_id: string } | null;
};

interface ChatAreaProps {
  contactId: string | null;
  messages: Message[];
  isLoadingMessages: boolean;
  onSendMessage: (text: string, platform: string, platformUserId: string, platformChannelId: string) => void;
  onSendImageByUrl: (url: string, platform: string, platformUserId: string, platformChannelId: string) => void;
  onSendMedia: (params: {
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
  }) => void;
  isSendingMessage: boolean;
  onDeleteContact: (id: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  contactId,
  messages,
  isLoadingMessages,
  onSendMessage,
  onSendImageByUrl,
  onSendMedia,
  isSendingMessage,
  onDeleteContact,
}) => {
  const router = useRouter();
  const [messageText, setMessageText] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const scrollableContainerRef = useRef<null | HTMLDivElement>(null);

  // Media upload hook
  const { uploadFile, isUploading, uploadProgress, error: uploadError } = useMediaUpload();

  // Voice recorder hook
  const {
    isRecording, duration: recordingDuration,
    startRecording, stopRecording, cancelRecording,
    error: recorderError,
  } = useVoiceRecorder();

  // Get the real platform_channel_id from the channel provider
  const { activeChannel } = useChannel();
  const resolvedPlatformChannelId = activeChannel?.platform_channel_id || null;

  const queryClient = useQueryClient();
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [tagMenuAnchor, setTagMenuAnchor] = useState<null | HTMLElement>(null);

  const { data: contact, isLoading: isLoadingContact } = useQuery<ContactWithClient>({
    queryKey: ['contact-details', contactId],
    queryFn: async () => {
      const { data: directData, error: directError } = await supabase
        .from('contacts')
        .select('*, crm_clients!contact_id(id, client_type, conversation_stage, phone, tags, lead_quality), channels!channel_id(platform_channel_id)')
        .eq('id', contactId!)
        .single();

      if (directError) throw new Error(directError.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const crmRaw = directData.crm_clients as any;
      const reshapedData = {
        ...directData,
        crm_clients: crmRaw ? {
          id: crmRaw.id,
          client_type: crmRaw.client_type || 'new',
          conversation_stage: crmRaw.conversation_stage || null,
          phone: crmRaw.phone || null,
          tags: crmRaw.tags || null,
          lead_quality: crmRaw.lead_quality || null,
        } : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channels: directData.channels ? { platform_channel_id: (directData.channels as any).platform_channel_id } : null,
      };

      return reshapedData as ContactWithClient;
    },
    enabled: !!contactId,
  });

  const { mutate: toggleFollowup, isPending: isTogglingFollowup } = useMutation({
    mutationFn: toggleFollowupStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
      setSnackbar({ open: true, message: 'Follow-up status updated', severity: 'success' });
    },
    onError: (err: Error) => {
      setSnackbar({ open: true, message: err.message || 'Error updating status', severity: 'error' });
    }
  });

  const scrollToBottom = () => { if (scrollableContainerRef.current) { scrollableContainerRef.current.scrollTop = scrollableContainerRef.current.scrollHeight; } };
  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { setMessageText(''); }, [contactId]);

  // Show errors as snackbar
  useEffect(() => {
    if (uploadError) {
      setSnackbar({ open: true, message: uploadError, severity: 'error' });
    }
  }, [uploadError]);
  useEffect(() => {
    if (recorderError) {
      setSnackbar({ open: true, message: recorderError, severity: 'error' });
    }
  }, [recorderError]);

  const handleSend = () => {
    if (messageText.trim() && contact) {
      onSendMessage(messageText, contact.platform, contact.platform_user_id, resolvedPlatformChannelId || contact.channel_id);
      setMessageText('');
    }
  };

  const handleDelete = () => {
    if (contactId && window.confirm("Are you sure you want to delete this contact and all their messages? This action cannot be undone.")) {
      onDeleteContact(contactId);
    }
  };

  const handleViewProfile = () => {
    if (contact && contact.crm_clients?.id) {
      router.push(`/clients/${contact.crm_clients.id}`);
    }
  };

  // Status update handler
  const handleUpdateStatus = async (newStatus: string) => {
    setStatusMenuAnchor(null);
    if (!contact?.crm_clients?.id) return;
    const { error } = await supabase
      .from('crm_clients')
      .update({ client_type: newStatus })
      .eq('id', contact.crm_clients.id);

    if (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    } else {
      const label = CLIENT_STATUS_CONFIG[newStatus]?.label || newStatus;
      setSnackbar({ open: true, message: `Status updated to ${label}`, severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
    }
  };

  // Tag add/remove handlers
  const handleToggleTag = async (tagName: string) => {
    setTagMenuAnchor(null);
    if (!contact?.crm_clients?.id) return;
    const currentTags: string[] = contact.crm_clients.tags || [];
    const exists = currentTags.includes(tagName);
    const updatedTags = exists ? currentTags.filter((t) => t !== tagName) : [...currentTags, tagName];

    const { error } = await supabase
      .from('crm_clients')
      .update({ tags: updatedTags })
      .eq('id', contact.crm_clients.id);

    if (error) {
      setSnackbar({ open: true, message: 'Failed to update tags', severity: 'error' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!contact?.crm_clients?.id) return;
    const currentTags: string[] = contact.crm_clients.tags || [];
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);

    const { error } = await supabase
      .from('crm_clients')
      .update({ tags: updatedTags })
      .eq('id', contact.crm_clients.id);

    if (error) {
      setSnackbar({ open: true, message: 'Failed to remove tag', severity: 'error' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
    }
  };

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!contact) return;

    try {
      const result = await uploadFile(file, contact.channel_id);
      const contentType = getContentTypeFromMime(file.type);

      onSendMedia({
        platform: contact.platform,
        platform_user_id: contact.platform_user_id,
        platform_channel_id: resolvedPlatformChannelId || contact.channel_id,
        content_type: contentType,
        attachment_url: result.url,
        attachment_metadata: {
          mime_type: result.mimeType,
          file_size: result.fileSize,
          file_name: result.fileName,
        },
      });

      setSnackbar({ open: true, message: 'File sent successfully!', severity: 'success' });
    } catch {
      // Error is already set via the hook's error state
    }
  };

  // Voice recording handler
  const handleStopRecording = async () => {
    if (!contact) return;

    const blob = await stopRecording();
    if (!blob) return;

    try {
      const extension = blob.type.includes('wav') ? 'wav' : blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'wav';
      const fileName = `voice_${Date.now()}.${extension}`;
      const file = new File([blob], fileName, { type: blob.type });

      const result = await uploadFile(file, contact.channel_id);

      onSendMedia({
        platform: contact.platform,
        platform_user_id: contact.platform_user_id,
        platform_channel_id: resolvedPlatformChannelId || contact.channel_id,
        content_type: 'audio',
        attachment_url: result.url,
        attachment_metadata: {
          mime_type: result.mimeType,
          file_size: result.fileSize,
          duration_seconds: recordingDuration,
          file_name: result.fileName,
        },
      });

      setSnackbar({ open: true, message: 'Voice message sent!', severity: 'success' });
    } catch {
      // Error handled by hook
    }
  };

  if (!contactId) {
    return (
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent' }}>
          <ChatIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
          <Typography variant="h5">Select a Conversation</Typography>
          <Typography color="text.secondary">Choose a contact from the list on the left to view their messages.</Typography>
        </Paper>
      </Box>
    );
  }

  if (isLoadingContact) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>;
  }

  if (!contact) return <Alert severity="error">Could not load contact details.</Alert>;

  const currentStatusKey = contact.crm_clients?.client_type || 'new';
  const statusCfg = CLIENT_STATUS_CONFIG[currentStatusKey] || CLIENT_STATUS_CONFIG.new;
  const currentTags = contact.crm_clients?.tags || [];

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        {/* Row 1: Name + Unified Status + Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {contact.name || 'Unknown Contact'}
            </Typography>

            {/* Single Unified Client Status Chip */}
            {contact.crm_clients && (
              <Chip
                label={`${statusCfg.emoji} ${statusCfg.label}`}
                size="small"
                onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 26,
                  bgcolor: alpha(statusCfg.color, 0.12),
                  color: statusCfg.color,
                  border: `1px solid ${alpha(statusCfg.color, 0.35)}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(statusCfg.color, 0.22) },
                }}
              />
            )}
          </Box>

          <Stack direction="row" spacing={0} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={contact.is_followup_active}
                  onChange={(e) => toggleFollowup({ contactId: contact.id, newStatus: e.target.checked })}
                  disabled={isTogglingFollowup}
                  color="success"
                />
              }
              label={
                <Typography variant="caption" sx={{ fontWeight: 500, mr: 1 }}>
                  Follow-ups
                </Typography>
              }
              labelPlacement="start"
              sx={{ m: 0, mr: 1 }}
            />
            <Tooltip title="View CRM Profile">
              <span>
                <IconButton onClick={handleViewProfile} disabled={!contact.crm_clients?.id} aria-label="view profile" size="small">
                  <PersonIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete Contact">
              <IconButton onClick={handleDelete} color="error" aria-label="delete contact" size="small">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Row 2: Metadata & Category Interest Tags */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            {contact.platform_user_id}
          </Typography>
          {contact.crm_clients?.phone && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <PhoneIcon sx={{ fontSize: 12 }} /> {contact.crm_clients.phone}
            </Typography>
          )}

          {/* Product Category & Interest Tags */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}>
            <LocalOfferIcon sx={{ fontSize: 13, color: 'text.disabled', ml: 0.5 }} />
            {currentTags.map((tag) => {
              const catMeta = getCategoryMeta(tag);
              return (
                <Chip
                  key={tag}
                  label={catMeta ? `${catMeta.emoji} ${catMeta.name}` : tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{
                    fontSize: '0.7rem',
                    height: 22,
                    fontWeight: 500,
                    bgcolor: catMeta ? alpha(catMeta.color, 0.1) : 'action.hover',
                    color: catMeta ? catMeta.color : 'text.primary',
                    border: `1px solid ${catMeta ? alpha(catMeta.color, 0.3) : 'divider'}`,
                    '& .MuiChip-deleteIcon': {
                      fontSize: 14,
                      color: catMeta ? catMeta.color : 'text.secondary',
                      '&:hover': { color: 'error.main' },
                    },
                  }}
                />
              );
            })}

            {/* Add Category / Tag Button */}
            <Chip
              icon={<AddIcon sx={{ fontSize: '13px !important' }} />}
              label="Add Category"
              size="small"
              variant="outlined"
              onClick={(e) => setTagMenuAnchor(e.currentTarget)}
              sx={{
                fontSize: '0.68rem',
                height: 22,
                cursor: 'pointer',
                borderStyle: 'dashed',
                color: 'text.secondary',
                '&:hover': { bgcolor: 'action.hover', color: 'primary.main', borderColor: 'primary.main' },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Unified Status Change Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={() => setStatusMenuAnchor(null)}
      >
        {Object.entries(CLIENT_STATUS_CONFIG).map(([key, cfg]) => (
          <MenuItem
            key={key}
            selected={currentStatusKey === key}
            onClick={() => handleUpdateStatus(key)}
            sx={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <span>{cfg.emoji}</span>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: currentStatusKey === key ? 700 : 400 }}>
                {cfg.label}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Product Categories / Tags Menu */}
      <Menu
        anchorEl={tagMenuAnchor}
        open={Boolean(tagMenuAnchor)}
        onClose={() => setTagMenuAnchor(null)}
        PaperProps={{ sx: { maxHeight: 360, width: 280 } }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
          Select Product Categories:
        </Typography>
        {PRODUCT_CATEGORIES.map((cat) => {
          const isSelected = currentTags.includes(cat.id);
          return (
            <MenuItem
              key={cat.id}
              onClick={() => handleToggleTag(cat.id)}
              sx={{ fontSize: '0.82rem', py: 0.8 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {cat.emoji}
              </ListItemIcon>
              <ListItemText
                primary={cat.name}
                secondary={cat.nameAr}
                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 400 }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
              />
              {isSelected && <CheckIcon fontSize="small" color="primary" />}
            </MenuItem>
          );
        })}
      </Menu>

      <Box ref={scrollableContainerRef} sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }} className="chat-background">
        {isLoadingMessages ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          messages.map((msg) => (<MessageBubble key={msg.id} message={msg} platform={contact.platform} />))
        )}
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <MessageInput
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onSendText={handleSend}
          onSendImageByUrl={(url) => onSendImageByUrl(url, contact.platform, contact.platform_user_id, contact.channel_id)}
          onSendFileUpload={handleFileUpload}
          onSendVoice={() => { /* Handled via onStopRecording */ }}
          disabled={isLoadingMessages}
          isSending={isSendingMessage}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          onStartRecording={startRecording}
          onStopRecording={handleStopRecording}
          onCancelRecording={cancelRecording}
          onSetValue={setMessageText}
        />
      </Box>

      {/* Error/Success Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChatArea;