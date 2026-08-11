// src/components/chat/ChatArea.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Alert, Snackbar,
  Chip, Menu, MenuItem, alpha, Stack, FormControlLabel, Switch,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { Contact, Message, toggleFollowupStatus } from '@/lib/api';
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
}

const CLIENT_TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  new: { label: 'New', color: '#94a3b8', emoji: '🆕' },
  interested: { label: 'Interested', color: '#3b82f6', emoji: '👀' },
  customer: { label: 'Customer', color: '#22c55e', emoji: '✅' },
  repeat_customer: { label: 'Repeat', color: '#8b5cf6', emoji: '🔄' },
  inactive: { label: 'Inactive', color: '#ef4444', emoji: '💤' },
};

const STAGE_CONFIG: Record<string, { label: string; emoji: string }> = {
  first_contact: { label: 'First Contact', emoji: '👋' },
  browsing: { label: 'Browsing', emoji: '🔍' },
  product_viewed: { label: 'Product Viewed', emoji: '📦' },
  order_placed: { label: 'Order Placed', emoji: '🛒' },
  purchased: { label: 'Purchased', emoji: '✅' },
  support: { label: 'Support', emoji: '🎧' },
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
  const [typeMenuAnchor, setTypeMenuAnchor] = useState<null | HTMLElement>(null);
  const [stageMenuAnchor, setStageMenuAnchor] = useState<null | HTMLElement>(null);

  const { data: contact, isLoading: isLoadingContact } = useQuery<ContactWithClient>({
    queryKey: ['contact-details', contactId],
    queryFn: async () => {
      const { data: directData, error: directError } = await supabase
        .from('contacts')
        .select('*, crm_clients!contact_id(id, client_type, conversation_stage, phone, tags, lead_quality), channels!channel_id(platform_channel_id)')
        .eq('id', contactId!)
        .single();

      if (directError) throw new Error(directError.message);

      // The result of a single() join is an object, not an array.
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
      // Create a File from the Blob — recorder outputs WAV
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

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        {/* Row 1: Name + Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {contact.name || 'Unknown Contact'}
            </Typography>

            {/* Client Type Chip — clickable to change */}
            {contact.crm_clients && (() => {
              const ct = CLIENT_TYPES[contact.crm_clients.client_type] || CLIENT_TYPES.new;
              return (
                <Chip
                  label={`${ct.emoji} ${ct.label}`}
                  size="small"
                  onClick={(e) => setTypeMenuAnchor(e.currentTarget)}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 24,
                    bgcolor: alpha(ct.color, 0.12),
                    color: ct.color,
                    border: `1px solid ${alpha(ct.color, 0.3)}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(ct.color, 0.2) },
                  }}
                />
              );
            })()}

            {/* Stage chip — clickable to change */}
            {contact.crm_clients && (() => {
              const stageKey = contact.crm_clients.conversation_stage || 'first_contact';
              const st = STAGE_CONFIG[stageKey] || STAGE_CONFIG.first_contact;
              return (
                <Chip
                  label={`${st.emoji} ${st.label}`}
                  size="small"
                  variant="outlined"
                  onClick={(e) => setStageMenuAnchor(e.currentTarget)}
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    height: 24,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                />
              );
            })()}
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

        {/* Row 2: Metadata */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {contact.platform_user_id}
          </Typography>
          {contact.crm_clients?.phone && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <PhoneIcon sx={{ fontSize: 12 }} /> {contact.crm_clients.phone}
            </Typography>
          )}
          {contact.crm_clients?.tags && contact.crm_clients.tags.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalOfferIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
              {contact.crm_clients.tags.slice(0, 3).map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Client Type Change Menu */}
      <Menu
        anchorEl={typeMenuAnchor}
        open={Boolean(typeMenuAnchor)}
        onClose={() => setTypeMenuAnchor(null)}
      >
        {Object.entries(CLIENT_TYPES).map(([key, cfg]) => (
          <MenuItem
            key={key}
            selected={contact.crm_clients?.client_type === key}
            onClick={async () => {
              setTypeMenuAnchor(null);
              if (!contact.crm_clients?.id) return;
              const { error } = await supabase
                .from('crm_clients')
                .update({ client_type: key })
                .eq('id', contact.crm_clients.id);
              if (error) {
                setSnackbar({ open: true, message: 'Failed to update', severity: 'error' });
              } else {
                setSnackbar({ open: true, message: `Type changed to ${cfg.label}`, severity: 'success' });
                queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
              }
            }}
            sx={{ fontSize: '0.85rem' }}
          >
            {cfg.emoji} {cfg.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Stage Change Menu */}
      <Menu
        anchorEl={stageMenuAnchor}
        open={Boolean(stageMenuAnchor)}
        onClose={() => setStageMenuAnchor(null)}
      >
        {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
          <MenuItem
            key={key}
            selected={contact.crm_clients?.conversation_stage === key}
            onClick={async () => {
              setStageMenuAnchor(null);
              if (!contact.crm_clients?.id) return;
              const { error } = await supabase
                .from('crm_clients')
                .update({ conversation_stage: key })
                .eq('id', contact.crm_clients.id);
              if (error) {
                setSnackbar({ open: true, message: 'Failed to update', severity: 'error' });
              } else {
                setSnackbar({ open: true, message: `Stage changed to ${cfg.label}`, severity: 'success' });
                queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
              }
            }}
            sx={{ fontSize: '0.85rem' }}
          >
            {cfg.emoji} {cfg.label}
          </MenuItem>
        ))}
      </Menu>

      <Box ref={scrollableContainerRef} sx={{ flexGrow: 1, overflowY: 'auto', p: 3, }} className="chat-background" >
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
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
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