// src/app/(app)/clients/[id]/components/ClientSidebar.tsx
'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Divider,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Paper,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import LaunchIcon from '@mui/icons-material/Launch';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { CrmClient, Contact } from '@/lib/api';
import { UpdateClientPayload } from '@/hooks/useClient';
import { resolveClientPhone, getWhatsAppNumber, formatPhoneDisplay } from '@/utils/phone';
import { getCategoryMeta, PRODUCT_CATEGORIES } from '@/lib/categories';

// AI Funnel Stages matching the project's sales funnel
type ConversationStageKey =
  | 'first_contact'
  | 'browsing'
  | 'product_viewed'
  | 'order_placed'
  | 'purchased'
  | 'support';

interface FunnelStageItem {
  key: ConversationStageKey;
  label: string;
  step: number;
  emoji: string;
  color: string;
  description: string;
}

const FUNNEL_STAGES: FunnelStageItem[] = [
  { key: 'first_contact', label: 'First Contact', step: 1, emoji: '👋', color: '#3B82F6', description: 'Initial greeting & inquiry' },
  { key: 'browsing', label: 'Browsing', step: 2, emoji: '🔍', color: '#8B5CF6', description: 'Exploring catalog & options' },
  { key: 'product_viewed', label: 'Product Viewed', step: 3, emoji: '📦', color: '#F59E0B', description: 'Reviewing specific items' },
  { key: 'order_placed', label: 'Order Placed', step: 4, emoji: '🛒', color: '#06B6D4', description: 'Checkout / order submitted' },
  { key: 'purchased', label: 'Purchased', step: 5, emoji: '✅', color: '#10B981', description: 'Payment confirmed & completed' },
];

// Client Lifecycle Stages based on client_type
const LIFECYCLE_STAGES = [
  { key: 'new', label: 'New Lead', color: '#3B82F6', emoji: '🆕' },
  { key: 'interested', label: 'Interested', color: '#F59E0B', emoji: '👀' },
  { key: 'customer', label: 'Customer', color: '#10B981', emoji: '🛍️' },
  { key: 'repeat_customer', label: 'VIP Repeat', color: '#8B5CF6', emoji: '⭐' },
  { key: 'inactive', label: 'Inactive', color: '#64748B', emoji: '⏸️' },
];

interface ClientSidebarProps {
  client: CrmClient;
  contact: Contact | null;
  onUpdateClient?: (payload: UpdateClientPayload) => void;
}

export default function ClientSidebar({ client, contact, onUpdateClient }: ClientSidebarProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  // 1. Resolve phone and WhatsApp
  const rawPhone = resolveClientPhone(client, contact);
  const formattedPhone = rawPhone ? formatPhoneDisplay(rawPhone) : null;
  const whatsappNumber = rawPhone ? getWhatsAppNumber(rawPhone) : null;
  const isWhatsAppSource =
    contact?.platform?.toLowerCase() === 'whatsapp' ||
    client?.source?.toLowerCase() === 'whatsapp' ||
    Boolean(whatsappNumber);

  // 2. Channel & Platform info
  const channelName = contact?.channels
    ? (Array.isArray(contact.channels) ? contact.channels[0]?.name : contact.channels.name)
    : client?.source || 'WhatsApp';
  const platform = (contact?.platform || client?.source || 'whatsapp').toLowerCase();

  // 3. Resolve AI Funnel Stage (from conversation_stage or stage:* tag)
  const stageTag = (client?.tags || []).find((t) => t.toLowerCase().startsWith('stage:'));
  const stageFromTag = stageTag ? (stageTag.replace(/^stage:/i, '').trim().toLowerCase() as ConversationStageKey) : null;
  const activeFunnelKey: ConversationStageKey =
    (client?.conversation_stage as ConversationStageKey) || stageFromTag || 'first_contact';
  const activeFunnelConfig =
    FUNNEL_STAGES.find((s) => s.key === activeFunnelKey) || FUNNEL_STAGES[0];

  // 4. Resolve Lifecycle Stage
  const activeLifecycleKey = client?.client_type || 'new';
  const activeLifecycle =
    LIFECYCLE_STAGES.find((s) => s.key === activeLifecycleKey) || LIFECYCLE_STAGES[0];

  // 5. Clean tags (exclude stage:* internal tags)
  const productTags = (client?.tags || []).filter((t) => !t.toLowerCase().startsWith('stage:'));

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Funnel stage change handler
  const handleFunnelStageSelect = (stageKey: ConversationStageKey) => {
    if (!onUpdateClient) return;
    const currentTags = client?.tags || [];
    const cleanTags = currentTags.filter((t) => !t.toLowerCase().startsWith('stage:'));
    onUpdateClient({
      conversation_stage: stageKey,
      tags: [...cleanTags, `stage:${stageKey}`],
    });
  };

  // Lifecycle stage change handler
  const handleLifecycleSelect = (lifecycleKey: string) => {
    if (!onUpdateClient) return;
    onUpdateClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client_type: lifecycleKey as any,
    });
  };

  // Add tag handler
  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed || !onUpdateClient) return;
    const currentTags = client?.tags || [];
    if (!currentTags.includes(trimmed)) {
      onUpdateClient({ tags: [...currentTags, trimmed] });
    }
    setTagInput('');
    setShowAddTag(false);
  };

  // Remove tag handler
  const handleRemoveTag = (tagToRemove: string) => {
    if (!onUpdateClient) return;
    const currentTags = client?.tags || [];
    onUpdateClient({
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  };

  // Format location string
  const getLocationString = () => {
    if (client?.city && client?.country) return `${client.city}, ${client.country}`;
    if (client?.city) return client.city;
    if (client?.country) return client.country;
    if (client?.address && typeof client.address === 'object') {
      const addr = client.address as { city?: string; country?: string };
      if (addr.city && addr.country) return `${addr.city}, ${addr.country}`;
      if (addr.city) return addr.city;
    }
    return null;
  };
  const locationString = getLocationString();

  return (
    <Box sx={{ p: 2.5, height: '100%', bgcolor: '#FFFFFF' }}>
      {/* ── SECTION 1: CONTACT DETAILS ────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: '#64748B',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            display: 'block',
            mb: 1.75,
          }}
        >
          Contact Details
        </Typography>

        <Stack spacing={1.75}>
          {/* Phone / WhatsApp Card */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isWhatsAppSource && rawPhone ? 'rgba(37, 211, 102, 0.3)' : '#E2E8F0',
              bgcolor: isWhatsAppSource && rawPhone ? 'rgba(37, 211, 102, 0.04)' : '#F8FAFC',
              transition: 'all 0.2s ease',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isWhatsAppSource ? (
                  <WhatsAppIcon sx={{ fontSize: 18, color: '#25D366' }} />
                ) : (
                  <PhoneIcon sx={{ fontSize: 18, color: '#64748B' }} />
                )}
                <Typography variant="caption" sx={{ fontWeight: 700, color: isWhatsAppSource ? '#15803D' : '#475569', fontSize: '0.72rem' }}>
                  {isWhatsAppSource ? 'WhatsApp' : 'Phone'}
                </Typography>
              </Box>

              {formattedPhone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={copiedKey === 'phone' ? 'Copied!' : 'Copy Phone'}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(rawPhone!, 'phone')}
                      sx={{ p: 0.4, color: copiedKey === 'phone' ? '#10B981' : '#64748B' }}
                    >
                      {copiedKey === 'phone' ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                  </Tooltip>
                  {whatsappNumber && (
                    <Tooltip title="Open WhatsApp Chat">
                      <IconButton
                        size="small"
                        onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}
                        sx={{ p: 0.4, color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}
                      >
                        <LaunchIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>

            {formattedPhone ? (
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: '#0F172A',
                    fontSize: '0.92rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.02em',
                  }}
                >
                  {formattedPhone}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                No phone number recorded
              </Typography>
            )}

            {whatsappNumber && (
              <Button
                variant="contained"
                size="small"
                fullWidth
                startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />}
                onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}
                sx={{
                  mt: 1.25,
                  py: 0.6,
                  borderRadius: '8px',
                  bgcolor: '#25D366',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
                  '&:hover': { bgcolor: '#1EBE5D' },
                }}
              >
                Chat on WhatsApp
              </Button>
            )}
          </Paper>

          {/* Email Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EmailIcon sx={{ fontSize: 16, color: '#64748B' }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '0.68rem', fontWeight: 600 }}>
                Email
              </Typography>
              {client?.email ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    component="a"
                    href={`mailto:${client.email}`}
                    sx={{
                      color: '#0F172A',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                      '&:hover': { color: '#4F46E5', textDecoration: 'underline' },
                    }}
                  >
                    {client.email}
                  </Typography>
                  <Tooltip title={copiedKey === 'email' ? 'Copied!' : 'Copy Email'}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(client.email!, 'email')}
                      sx={{ p: 0.2, color: copiedKey === 'email' ? '#10B981' : '#94A3B8' }}
                    >
                      {copiedKey === 'email' ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic' }}>
                  No email
                </Typography>
              )}
            </Box>
          </Box>

          {/* Location Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LocationOnIcon sx={{ fontSize: 16, color: '#64748B' }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '0.68rem', fontWeight: 600 }}>
                Location
              </Typography>
              <Typography variant="body2" noWrap sx={{ color: '#0F172A', fontWeight: 600, fontSize: '0.82rem' }}>
                {locationString || 'Unknown Location'}
              </Typography>
            </Box>
          </Box>

          {/* Channel / Platform Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor:
                  platform === 'whatsapp'
                    ? 'rgba(37, 211, 102, 0.12)'
                    : platform === 'instagram'
                    ? 'rgba(225, 48, 108, 0.12)'
                    : 'rgba(24, 119, 242, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {platform === 'whatsapp' ? (
                <WhatsAppIcon sx={{ fontSize: 17, color: '#25D366' }} />
              ) : (
                <LayersOutlinedIcon sx={{ fontSize: 17, color: '#4F46E5' }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '0.68rem', fontWeight: 600 }}>
                Channel Source
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Chip
                  label={platform.toUpperCase()}
                  size="small"
                  sx={{
                    height: 19,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    bgcolor:
                      platform === 'whatsapp'
                        ? 'rgba(37, 211, 102, 0.15)'
                        : platform === 'instagram'
                        ? 'rgba(225, 48, 108, 0.15)'
                        : 'rgba(24, 119, 242, 0.15)',
                    color:
                      platform === 'whatsapp'
                        ? '#15803D'
                        : platform === 'instagram'
                        ? '#BE185D'
                        : '#1D4ED8',
                  }}
                />
                <Typography variant="caption" noWrap sx={{ color: '#475569', fontWeight: 600, fontSize: '0.78rem' }}>
                  {channelName}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ my: 2.5, borderColor: '#F1F5F9' }} />

      {/* ── SECTION 2: AI SALES FUNNEL STAGE ───────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              color: '#64748B',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.72rem',
            }}
          >
            AI Sales Funnel
          </Typography>
          <Chip
            label={`Step ${activeFunnelConfig.step} of 5`}
            size="small"
            sx={{
              height: 19,
              fontSize: '0.62rem',
              fontWeight: 700,
              bgcolor: `${activeFunnelConfig.color}15`,
              color: activeFunnelConfig.color,
              border: `1px solid ${activeFunnelConfig.color}35`,
            }}
          />
        </Box>

        {/* Current Active Funnel Stage Banner */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            bgcolor: `${activeFunnelConfig.color}0D`,
            border: `1px solid ${activeFunnelConfig.color}30`,
            mb: 1.75,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              flexShrink: 0,
            }}
          >
            {activeFunnelConfig.emoji}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '0.88rem', lineHeight: 1.2 }}>
              {activeFunnelConfig.label}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem' }}>
              {activeFunnelConfig.description}
            </Typography>
          </Box>
        </Box>

        {/* 5-Step Visual Progress Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, width: '100%', mb: 1.75 }}>
          {FUNNEL_STAGES.map((s) => {
            const isCompleted = s.step <= activeFunnelConfig.step;
            return (
              <Tooltip key={s.key} title={`${s.step}. ${s.label}`} arrow>
                <Box
                  onClick={() => handleFunnelStageSelect(s.key)}
                  sx={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    cursor: onUpdateClient ? 'pointer' : 'default',
                    bgcolor: isCompleted ? activeFunnelConfig.color : '#E2E8F0',
                    transition: 'all 0.25s ease',
                    '&:hover': onUpdateClient
                      ? {
                          height: 8,
                          bgcolor: activeFunnelConfig.color,
                        }
                      : {},
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Interactive Funnel Stage Pills */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {FUNNEL_STAGES.map((stage) => {
            const isSelected = stage.key === activeFunnelKey;
            return (
              <Chip
                key={stage.key}
                label={`${stage.emoji} ${stage.label}`}
                onClick={onUpdateClient ? () => handleFunnelStageSelect(stage.key) : undefined}
                size="small"
                sx={{
                  fontWeight: isSelected ? 800 : 500,
                  fontSize: '0.7rem',
                  height: 25,
                  cursor: onUpdateClient ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  bgcolor: isSelected ? stage.color : '#F8FAFC',
                  color: isSelected ? '#FFFFFF' : '#475569',
                  border: '1px solid',
                  borderColor: isSelected ? stage.color : '#E2E8F0',
                  boxShadow: isSelected ? `0 2px 6px ${stage.color}35` : 'none',
                  '&:hover': onUpdateClient
                    ? {
                        bgcolor: isSelected ? stage.color : '#F1F5F9',
                        transform: 'translateY(-1px)',
                      }
                    : {},
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 2.5, borderColor: '#F1F5F9' }} />

      {/* ── SECTION 3: LIFECYCLE STATUS ───────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: '#64748B',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            display: 'block',
            mb: 1.25,
          }}
        >
          Lifecycle Status
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {LIFECYCLE_STAGES.map((stage) => {
            const isSelected = stage.key === activeLifecycleKey;
            return (
              <Chip
                key={stage.key}
                label={`${stage.emoji} ${stage.label}`}
                onClick={onUpdateClient ? () => handleLifecycleSelect(stage.key) : undefined}
                size="small"
                sx={{
                  fontWeight: isSelected ? 800 : 500,
                  fontSize: '0.7rem',
                  height: 25,
                  cursor: onUpdateClient ? 'pointer' : 'default',
                  bgcolor: isSelected ? `${stage.color}18` : '#F8FAFC',
                  color: isSelected ? stage.color : '#475569',
                  border: '1px solid',
                  borderColor: isSelected ? `${stage.color}50` : '#E2E8F0',
                  '&:hover': onUpdateClient
                    ? {
                        bgcolor: isSelected ? `${stage.color}25` : '#F1F5F9',
                      }
                    : {},
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 2.5, borderColor: '#F1F5F9' }} />

      {/* ── SECTION 4: ATTRIBUTES ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: '#64748B',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            display: 'block',
            mb: 1.5,
          }}
        >
          Attributes
        </Typography>

        <Stack spacing={1.5}>
          {/* Source */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              Acquisition
            </Typography>
            <Chip
              label={client?.source || 'Direct'}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 700,
                bgcolor: '#F1F5F9',
                color: '#334155',
                textTransform: 'capitalize',
              }}
            />
          </Box>

          {/* Assigned Agent */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              Assigned Agent
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PersonIcon sx={{ fontSize: 15, color: '#94A3B8' }} />
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                {client?.assigned_to ? 'Assigned' : 'Unassigned'}
              </Typography>
            </Box>
          </Box>

          {/* Lead Quality / Score */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              Lead Quality
            </Typography>
            <Chip
              label={
                client?.lead_quality === 'hot'
                  ? '🔥 Hot Lead'
                  : client?.lead_quality === 'warm'
                  ? '☀️ Warm'
                  : client?.lead_score && client.lead_score > 50
                  ? `⭐ Score: ${client.lead_score}`
                  : '❄️ Cold Lead'
              }
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 700,
                bgcolor:
                  client?.lead_quality === 'hot'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : client?.lead_quality === 'warm'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(100, 116, 139, 0.12)',
                color:
                  client?.lead_quality === 'hot'
                    ? '#DC2626'
                    : client?.lead_quality === 'warm'
                    ? '#D97706'
                    : '#475569',
              }}
            />
          </Box>

          {/* First Contact Date */}
          {client?.first_contact_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                First Contact
              </Typography>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                {new Date(client.first_contact_date).toLocaleDateString()}
              </Typography>
            </Box>
          )}

          {/* Last Active Date */}
          {client?.last_contact_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                Last Active
              </Typography>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                {new Date(client.last_contact_date).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 2.5, borderColor: '#F1F5F9' }} />

      {/* ── SECTION 5: PRODUCT INTERESTS & TAGS ────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              color: '#64748B',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.72rem',
            }}
          >
            Interests & Tags
          </Typography>
          {onUpdateClient && (
            <Tooltip title="Add Product Interest or Tag">
              <IconButton
                size="small"
                onClick={() => setShowAddTag((prev) => !prev)}
                sx={{ p: 0.3, color: '#4F46E5', bgcolor: 'rgba(79, 70, 229, 0.08)' }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Quick Add Tag Input */}
        {showAddTag && onUpdateClient && (
          <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5 }}>
            <TextField
              size="small"
              placeholder="Tag name or category..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '0.75rem',
                  height: 30,
                  borderRadius: '6px',
                },
              }}
              autoFocus
            />
            <Button
              size="small"
              variant="contained"
              onClick={() => handleAddTag(tagInput)}
              sx={{
                fontSize: '0.72rem',
                minWidth: 'auto',
                px: 1.2,
                py: 0,
                height: 30,
                borderRadius: '6px',
                bgcolor: '#4F46E5',
              }}
            >
              Add
            </Button>
          </Box>
        )}

        {/* Render Tags */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {productTags.map((tag) => {
            const catMeta = getCategoryMeta(tag);
            if (catMeta) {
              return (
                <Tooltip key={tag} title={`${catMeta.name} (${catMeta.nameAr})`} arrow>
                  <Chip
                    label={`${catMeta.emoji} ${catMeta.name}`}
                    size="small"
                    onDelete={onUpdateClient ? () => handleRemoveTag(tag) : undefined}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      height: 26,
                      bgcolor: `${catMeta.color}15`,
                      color: catMeta.color,
                      border: `1px solid ${catMeta.color}35`,
                      '& .MuiChip-deleteIcon': {
                        color: `${catMeta.color}80`,
                        fontSize: 14,
                        '&:hover': { color: catMeta.color },
                      },
                    }}
                  />
                </Tooltip>
              );
            }

            return (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={onUpdateClient ? () => handleRemoveTag(tag) : undefined}
                icon={<SellOutlinedIcon sx={{ fontSize: 13, color: '#64748B' }} />}
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  height: 26,
                  bgcolor: '#F8FAFC',
                  color: '#334155',
                  border: '1px solid #E2E8F0',
                  '& .MuiChip-deleteIcon': {
                    color: '#94A3B8',
                    fontSize: 14,
                    '&:hover': { color: '#EF4444' },
                  },
                }}
              />
            );
          })}

          {productTags.length === 0 && (
            <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic', display: 'block' }}>
              No product interests or tags recorded
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
