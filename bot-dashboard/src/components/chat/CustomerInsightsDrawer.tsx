// src/components/chat/CustomerInsightsDrawer.tsx
'use client';

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Avatar,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Button,
  TextField,
  Skeleton,
  Switch,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { useRouter } from 'next/navigation';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useClient } from '@/hooks/useClient';
import { toggleAiStatus, toggleFollowupStatus, CrmClient } from '@/lib/api';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import { formatCurrency } from '@/utils/currency';

interface CustomerInsightsDrawerProps {
  contactId: string | null;
  clientId: string | null;
  platform: string;
  platformUserId: string;
  contactName?: string | null;
  aiEnabled?: boolean;
  isFollowupActive?: boolean;
  open: boolean;
  onClose: () => void;
}

type ClientType = CrmClient['client_type'];

const LIFECYCLE_STAGES: { key: ClientType; label: string; color: string; emoji: string }[] = [
  { key: 'new', label: 'New Lead', color: '#3B82F6', emoji: '🆕' },
  { key: 'interested', label: 'Interested', color: '#F59E0B', emoji: '👀' },
  { key: 'customer', label: 'Customer', color: '#10B981', emoji: '🛍️' },
  { key: 'repeat_customer', label: 'VIP Repeat', color: '#8B5CF6', emoji: '⭐' },
  { key: 'inactive', label: 'Inactive', color: '#64748B', emoji: '⏸️' },
];

const getOrderStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'delivered':
      return { bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' };
    case 'processing':
    case 'shipped':
      return { bg: 'rgba(59, 130, 246, 0.12)', color: '#1D4ED8' };
    case 'pending':
    case 'on-hold':
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#B45309' };
    case 'cancelled':
    case 'refunded':
    case 'failed':
      return { bg: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C' };
    default:
      return { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569' };
  }
};

const CustomerInsightsDrawer: React.FC<CustomerInsightsDrawerProps> = ({
  contactId,
  clientId,
  platform,
  platformUserId,
  contactName,
  aiEnabled = true,
  isFollowupActive = true,
  open,
  onClose,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [newNote, setNewNote] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { clientData, isLoading, updateClient, addNote } = useClient(clientId);

  const { mutate: toggleAi, isPending: isTogglingAi } = useMutation({
    mutationFn: toggleAiStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSnackbar({ open: true, message: 'AI status updated', severity: 'success' });
    },
  });

  const { mutate: toggleFollowup, isPending: isTogglingFollowup } = useMutation({
    mutationFn: toggleFollowupStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-details', contactId] });
      setSnackbar({ open: true, message: 'Follow-up status updated', severity: 'success' });
    },
  });

  const client = clientData?.client;
  const orders = clientData?.orders || [];
  const notes = clientData?.notes || [];
  const messageCount = clientData?.messageCount || 0;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: `${label} copied to clipboard!`, severity: 'success' });
  };

  const handleStageChange = (newStage: ClientType) => {
    if (!clientId) return;
    updateClient(
      { client_type: newStage },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: `Lifecycle stage updated to ${newStage}`, severity: 'success' });
        },
        onError: () => {
          setSnackbar({ open: true, message: 'Failed to update stage', severity: 'error' });
        },
      }
    );
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim() && client) {
      e.preventDefault();
      const currentTags = client.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        const updatedTags = [...currentTags, newTag.trim()];
        updateClient(
          { tags: updatedTags },
          {
            onSuccess: () => {
              setNewTag('');
              setSnackbar({ open: true, message: 'Tag added', severity: 'success' });
            },
          }
        );
      } else {
        setNewTag('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!client) return;
    const currentTags = client.tags || [];
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);
    updateClient(
      { tags: updatedTags },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: 'Tag removed', severity: 'success' });
        },
      }
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !clientId) return;
    addNote(
      {
        content: newNote.trim(),
        title: null,
        deal_id: null,
        note_type: 'general',
        is_pinned: false,
        tags: null,
      },
      {
        onSuccess: () => {
          setNewNote('');
          setSnackbar({ open: true, message: 'Internal note saved', severity: 'success' });
        },
        onError: () => {
          setSnackbar({ open: true, message: 'Failed to add note', severity: 'error' });
        },
      }
    );
  };

  // Calculate total spent from orders
  const totalSpent = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 420 },
            bgcolor: '#F8FAFC',
            boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            p: 2,
            px: 2.5,
            bgcolor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A' }}>
              Customer Insights
            </Typography>
            <Chip
              label={platform.toUpperCase()}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor:
                  platform === 'whatsapp'
                    ? 'rgba(37, 211, 102, 0.12)'
                    : platform === 'instagram'
                    ? 'rgba(225, 48, 108, 0.12)'
                    : 'rgba(24, 119, 242, 0.12)',
                color:
                  platform === 'whatsapp'
                    ? '#15803D'
                    : platform === 'instagram'
                    ? '#BE185D'
                    : '#1D4ED8',
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {clientId && (
              <Tooltip title="Open Full Profile in CRM">
                <IconButton
                  size="small"
                  onClick={() => router.push(`/clients/${clientId}`)}
                  sx={{ color: '#4F46E5', bgcolor: 'rgba(79, 70, 229, 0.08)', '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.15)' } }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={onClose} sx={{ color: '#64748B' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Drawer Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {isLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 3 }} />
            </Stack>
          ) : (
            <>
              {/* Customer Profile Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <PlatformAvatar
                    platform={platform}
                    sx={{ width: 52, height: 52, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '2px solid #FFFFFF' }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0F172A' }}>
                      {contactName || client?.company_name || platformUserId}
                    </Typography>
                    <Box
                      onClick={() => handleCopy(platformUserId, 'Platform ID')}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        color: '#64748B',
                        fontSize: '0.75rem',
                        '&:hover': { color: '#4F46E5' },
                      }}
                    >
                      <span>ID: {platformUserId}</span>
                      <ContentCopyIcon sx={{ fontSize: 12, opacity: 0.7 }} />
                    </Box>
                  </Box>
                </Box>

                {/* Contact Channels */}
                <Stack spacing={1} sx={{ pt: 1, borderTop: '1px solid #F1F5F9' }}>
                  {client?.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: '#10B981' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B', fontSize: '0.85rem' }}>
                          {client.phone}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Copy Phone">
                          <IconButton size="small" onClick={() => handleCopy(client.phone!, 'Phone')}>
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open WhatsApp">
                          <IconButton
                            size="small"
                            onClick={() => window.open(`https://wa.me/${client.phone!.replace(/[^0-9]/g, '')}`, '_blank')}
                            sx={{ color: '#25D366' }}
                          >
                            <WhatsAppIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  )}

                  {client?.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 16, color: '#6366F1' }} />
                        <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                          {client.email}
                        </Typography>
                      </Box>
                      <Tooltip title="Copy Email">
                        <IconButton size="small" onClick={() => handleCopy(client.email!, 'Email')}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Stack>
              </Paper>

              {/* Lifecycle Stage Selector */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', mb: 1.25 }}>
                  Customer Lifecycle Stage
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {LIFECYCLE_STAGES.map((stage) => {
                    const isSelected = (client?.client_type || 'new') === stage.key;
                    return (
                      <Chip
                        key={stage.key}
                        label={`${stage.emoji} ${stage.label}`}
                        onClick={() => handleStageChange(stage.key)}
                        sx={{
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          bgcolor: isSelected ? stage.color : '#F1F5F9',
                          color: isSelected ? '#FFFFFF' : '#475569',
                          boxShadow: isSelected ? `0 2px 8px ${stage.color}40` : 'none',
                          '&:hover': {
                            bgcolor: isSelected ? stage.color : '#E2E8F0',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Paper>

              {/* AI & Automation Controls */}
              {contactId && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    AI & Automation Rules
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SmartToyOutlinedIcon sx={{ color: aiEnabled ? '#10B981' : '#94A3B8', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>
                          AI Copilot Auto-Reply
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {aiEnabled ? 'Bot answers customer automatically' : 'Manual agent mode active'}
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      size="small"
                      checked={aiEnabled}
                      onChange={(e) => toggleAi({ contactId, newStatus: e.target.checked })}
                      disabled={isTogglingAi}
                      color="success"
                    />
                  </Box>

                  <Divider />

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NoteAltOutlinedIcon sx={{ color: isFollowupActive ? '#4F46E5' : '#94A3B8', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>
                          Smart Follow-ups
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {isFollowupActive ? 'Scheduled reminders active' : 'Follow-ups paused'}
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      size="small"
                      checked={isFollowupActive}
                      onChange={(e) => toggleFollowup({ contactId, newStatus: e.target.checked })}
                      disabled={isTogglingFollowup}
                      color="primary"
                    />
                  </Box>
                </Paper>
              )}

              {/* 3 Metrics Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                  }}
                >
                  <ShoppingBagOutlinedIcon sx={{ color: '#4F46E5', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A', lineHeight: 1.1 }}>
                    {orders.length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>
                    Orders
                  </Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                  }}
                >
                  <MonetizationOnOutlinedIcon sx={{ color: '#10B981', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A', lineHeight: 1.1 }} noWrap>
                    {formatCurrency(totalSpent)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>
                    Total Spend
                  </Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                  }}
                >
                  <ChatBubbleOutlineIcon sx={{ color: '#EC4899', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A', lineHeight: 1.1 }}>
                    {messageCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>
                    Messages
                  </Typography>
                </Paper>
              </Box>

              {/* Tags & Interests */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 18, color: '#64748B' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Tags & Purchase Interests
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {(client?.tags || []).length > 0 ? (
                    client!.tags!.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        onDelete={() => handleRemoveTag(tag)}
                        sx={{
                          bgcolor: 'rgba(79, 70, 229, 0.08)',
                          color: '#4F46E5',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          border: '1px solid rgba(79, 70, 229, 0.15)',
                        }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic' }}>
                      No tags assigned yet.
                    </Typography>
                  )}
                </Box>

                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type tag and press Enter..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      bgcolor: '#F8FAFC',
                    },
                  }}
                />
              </Paper>

              {/* Recent Orders */}
              <Paper
                elevation={0}
                sx={{
                  borderRadius: '16px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ p: 2, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShoppingBagOutlinedIcon sx={{ fontSize: 18, color: '#64748B' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Store Orders ({orders.length})
                    </Typography>
                  </Box>
                  {orders.length > 0 && (
                    <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>
                      WooCommerce Synced
                    </Typography>
                  )}
                </Box>

                {orders.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1 }}>
                      No store orders recorded for this customer.
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {orders.slice(0, 5).map((order) => {
                      const statusStyle = getOrderStatusColor(order.status);
                      return (
                        <Accordion
                          key={order.id}
                          disableGutters
                          elevation={0}
                          sx={{
                            borderBottom: '1px solid #F1F5F9',
                            '&:before': { display: 'none' },
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />} sx={{ px: 2, py: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                                  #{order.order_number}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                                  {new Date(order.order_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                                  {formatCurrency(Number(order.total) || 0)}
                                </Typography>
                                <Chip
                                  label={order.status.toUpperCase()}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    bgcolor: statusStyle.bg,
                                    color: statusStyle.color,
                                  }}
                                />
                              </Box>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5, bgcolor: '#F8FAFC' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', display: 'block', mb: 0.5 }}>
                              Items:
                            </Typography>
                            {(order.items || []).map((item, idx) => (
                              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                                <Typography variant="caption" noWrap sx={{ maxWidth: 220, color: '#334155' }}>
                                  {item.quantity}x {item.name}
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: '#0F172A' }}>
                                  {formatCurrency(Number(item.price) * item.quantity)}
                                </Typography>
                              </Box>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Box>
                )}
              </Paper>

              {/* Team Internal Notes */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <NoteAltOutlinedIcon sx={{ fontSize: 18, color: '#64748B' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Team Notes ({notes.length})
                  </Typography>
                </Box>

                <Stack spacing={1} sx={{ mb: 1.5, maxHeight: 180, overflowY: 'auto' }}>
                  {notes.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic' }}>
                      No internal notes yet. Add one below.
                    </Typography>
                  ) : (
                    notes.map((note) => (
                      <Box
                        key={note.id}
                        sx={{
                          p: 1.25,
                          borderRadius: '10px',
                          bgcolor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1E293B', whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem', display: 'block', mt: 0.5 }}>
                          {new Date(note.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Stack>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add an internal note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        bgcolor: '#F8FAFC',
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    sx={{
                      minWidth: 'auto',
                      px: 2,
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                    }}
                  >
                    Add
                  </Button>
                </Box>
              </Paper>
            </>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default CustomerInsightsDrawer;
