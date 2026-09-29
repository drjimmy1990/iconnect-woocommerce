// src/components/chat/ChatArea.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Alert, Snackbar,
  Chip, Menu, MenuItem, alpha, Stack, Switch, ListItemIcon, ListItemText,
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
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MenuIcon from '@mui/icons-material/Menu';
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
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
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
  isSidebarCollapsed = false,
  onToggleSidebar,
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

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setSnackbar({ open: true, message: `${label} copied to clipboard!`, severity: 'success' });
    }
  };

  if (!contactId) {
    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
        className="chat-background"
      >
        {isSidebarCollapsed && onToggleSidebar && (
          <Tooltip title="Show Conversations">
            <IconButton
              onClick={onToggleSidebar}
              size="small"
              sx={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 20,
                color: '#64748B',
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                backdropFilter: 'blur(8px)',
                '&:hover': { color: '#4F46E5', bgcolor: '#F8FAFC' },
              }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Paper
          elevation={0}
          sx={{
            p: 5,
            maxWidth: 480,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '24px',
            boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.06)',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
              boxShadow: '0 6px 20px rgba(79, 70, 229, 0.15)',
            }}
          >
            <ForumOutlinedIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mt: 1 }}>
            Live Omnichannel Chat
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
            Select an active customer conversation from the list to view message history, reply via smart templates, or manage CRM lead stages.
          </Typography>
          <Box
            sx={{
              mt: 1,
              px: 2,
              py: 1,
              borderRadius: '12px',
              bgcolor: 'rgba(241, 245, 249, 0.8)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500 }}>
              💡 <strong>Pro Tip:</strong> Press <kbd style={{ background: '#CBD5E1', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>/</kbd> in the input bar to access quick sales templates
            </Typography>
          </Box>
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
      {/* Contact Header Bar */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Row 1: Contact Avatar + Name + Platform Badge + Status Selector + Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isSidebarCollapsed && onToggleSidebar && (
              <Tooltip title="Show Conversations">
                <IconButton
                  onClick={onToggleSidebar}
                  size="small"
                  sx={{
                    color: '#64748B',
                    bgcolor: 'rgba(241, 245, 249, 0.9)',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    '&:hover': { color: '#4F46E5', bgcolor: 'rgba(79, 70, 229, 0.08)', borderColor: 'rgba(79, 70, 229, 0.3)' },
                  }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <PlatformAvatar
              platform={contact.platform}
              sx={{
                width: 42,
                height: 42,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '2px solid #FFFFFF',
              }}
            />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A', lineHeight: 1.2 }}>
                  {contact.name || contact.platform_user_id || 'Unknown Contact'}
                </Typography>
                <Chip
                  label={contact.platform.toUpperCase()}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    bgcolor:
                      contact.platform === 'whatsapp'
                        ? 'rgba(37, 211, 102, 0.12)'
                        : contact.platform === 'instagram'
                        ? 'rgba(225, 48, 108, 0.12)'
                        : 'rgba(24, 119, 242, 0.12)',
                    color:
                      contact.platform === 'whatsapp'
                        ? '#15803D'
                        : contact.platform === 'instagram'
                        ? '#BE185D'
                        : '#1D4ED8',
                    border: '1px solid',
                    borderColor:
                      contact.platform === 'whatsapp'
                        ? 'rgba(37, 211, 102, 0.3)'
                        : contact.platform === 'instagram'
                        ? 'rgba(225, 48, 108, 0.3)'
                        : 'rgba(24, 119, 242, 0.3)',
                  }}
                />
              </Box>

              {/* ID & Phone row with click-to-copy */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.35 }}>
                <Tooltip title="Click to copy platform ID">
                  <Box
                    onClick={() => handleCopy(contact.platform_user_id, 'Platform ID')}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      color: '#64748B',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      '&:hover': { color: '#4F46E5' },
                    }}
                  >
                    <span>ID: {contact.platform_user_id}</span>
                    <ContentCopyIcon sx={{ fontSize: 12, opacity: 0.7 }} />
                  </Box>
                </Tooltip>

                {contact.crm_clients?.phone && (
                  <Tooltip title="Click to copy phone number">
                    <Box
                      onClick={() => handleCopy(contact.crm_clients!.phone!, 'Phone number')}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        color: '#64748B',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        '&:hover': { color: '#10B981' },
                      }}
                    >
                      <PhoneIcon sx={{ fontSize: 13, color: '#10B981' }} />
                      <span>{contact.crm_clients.phone}</span>
                      <ContentCopyIcon sx={{ fontSize: 12, opacity: 0.7 }} />
                    </Box>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>

          {/* Right Header Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Unified Client Status Dropdown */}
            {contact.crm_clients && (
              <Chip
                label={`${statusCfg.emoji} ${statusCfg.label}`}
                size="small"
                onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                deleteIcon={<KeyboardArrowDownIcon sx={{ fontSize: '16px !important' }} />}
                onDelete={(e) => setStatusMenuAnchor(e.currentTarget as HTMLElement)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  height: 30,
                  px: 0.5,
                  bgcolor: alpha(statusCfg.color, 0.12),
                  color: statusCfg.color,
                  border: `1px solid ${alpha(statusCfg.color, 0.35)}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: alpha(statusCfg.color, 0.2),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 3px 8px ${alpha(statusCfg.color, 0.2)}`,
                  },
                  '& .MuiChip-deleteIcon': {
                    color: statusCfg.color,
                  },
                }}
              />
            )}

            {/* Follow-up Capsule Switch */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.25,
                py: 0.2,
                borderRadius: '20px',
                bgcolor: contact.is_followup_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(241, 245, 249, 0.8)',
                border: '1px solid',
                borderColor: contact.is_followup_active ? 'rgba(16, 185, 129, 0.3)' : '#E2E8F0',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: contact.is_followup_active ? '#065F46' : '#64748B',
                  mr: 0.5,
                }}
              >
                Follow-ups
              </Typography>
              <Switch
                size="small"
                checked={contact.is_followup_active}
                onChange={(e) => toggleFollowup({ contactId: contact.id, newStatus: e.target.checked })}
                disabled={isTogglingFollowup}
                color="success"
              />
            </Box>

            {/* CRM Profile Shortcut */}
            <Tooltip title="Open CRM Profile">
              <span>
                <IconButton
                  onClick={handleViewProfile}
                  disabled={!contact.crm_clients?.id}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(79, 70, 229, 0.08)',
                    color: '#4F46E5',
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(79, 70, 229, 0.16)',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'transparent',
                      borderColor: 'transparent',
                    },
                  }}
                >
                  <PersonIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Delete Contact */}
            <Tooltip title="Delete Contact">
              <IconButton
                onClick={handleDelete}
                size="small"
                sx={{
                  color: '#94A3B8',
                  '&:hover': {
                    color: '#EF4444',
                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Row 2: Category & Interest Tags */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#94A3B8' }}>
            <LocalOfferIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', fontSize: '0.72rem' }}>
              Interests:
            </Typography>
          </Box>

          {currentTags.map((tag) => {
            const catMeta = getCategoryMeta(tag);
            return (
              <Chip
                key={tag}
                label={catMeta ? `${catMeta.emoji} ${catMeta.name}` : tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
                sx={{
                  fontSize: '0.72rem',
                  height: 24,
                  fontWeight: 600,
                  bgcolor: catMeta ? alpha(catMeta.color, 0.1) : 'rgba(241, 245, 249, 0.8)',
                  color: catMeta ? catMeta.color : '#334155',
                  border: `1px solid ${catMeta ? alpha(catMeta.color, 0.3) : '#CBD5E1'}`,
                  borderRadius: '6px',
                  '& .MuiChip-deleteIcon': {
                    fontSize: 14,
                    color: catMeta ? catMeta.color : '#64748B',
                    '&:hover': { color: 'error.main' },
                  },
                }}
              />
            );
          })}

          <Chip
            icon={<AddIcon sx={{ fontSize: '13px !important' }} />}
            label="Add Category"
            size="small"
            variant="outlined"
            onClick={(e) => setTagMenuAnchor(e.currentTarget)}
            sx={{
              fontSize: '0.7rem',
              height: 24,
              cursor: 'pointer',
              borderStyle: 'dashed',
              borderColor: '#94A3B8',
              color: '#64748B',
              borderRadius: '6px',
              '&:hover': {
                bgcolor: 'rgba(79, 70, 229, 0.08)',
                color: '#4F46E5',
                borderColor: '#4F46E5',
              },
            }}
          />
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

      {/* Messages Scroll Area */}
      <Box ref={scrollableContainerRef} sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 3 } }} className="chat-background">
        {isLoadingMessages ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 200 }}>
            <CircularProgress size={32} />
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 280,
              gap: 1.5,
              textAlign: 'center',
              p: 3,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: 'rgba(241, 245, 249, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                border: '1px solid #E2E8F0',
              }}
            >
              <ChatIcon sx={{ fontSize: 26 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#334155' }}>
              No messages yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', maxWidth: 360 }}>
              Send a message or select a quick template below to start the conversation with {contact.name || contact.platform_user_id}.
            </Typography>
          </Box>
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