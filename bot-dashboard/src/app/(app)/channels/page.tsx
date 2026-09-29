// src/app/(app)/channels/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Container,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Snackbar,
  Switch,
  Tooltip,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import DnsIcon from '@mui/icons-material/Dns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useChannels, NewChannelPayload } from '@/hooks/useChannels';
import ChannelForm from '@/components/channels/ChannelForm';
import { supabase } from '@/lib/supabaseClient';

// Helper for platform styling
function getPlatformInfo(platform: string) {
  switch (platform?.toLowerCase()) {
    case 'whatsapp':
      return {
        label: 'WhatsApp Business',
        icon: <WhatsAppIcon sx={{ fontSize: 20, color: 'white' }} />,
        bg: '#25D366',
        gradient: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)',
        accentColor: '#25D366',
      };
    case 'instagram':
      return {
        label: 'Instagram Direct',
        icon: <InstagramIcon sx={{ fontSize: 20, color: 'white' }} />,
        bg: '#E1306C',
        gradient: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)',
        accentColor: '#E1306C',
      };
    case 'facebook':
      return {
        label: 'Facebook Messenger',
        icon: <FacebookIcon sx={{ fontSize: 20, color: 'white' }} />,
        bg: '#1877F2',
        gradient: 'linear-gradient(135deg, #0A58CA 0%, #1877F2 100%)',
        accentColor: '#1877F2',
      };
    default:
      return {
        label: platform || 'Unknown Platform',
        icon: <DnsIcon sx={{ fontSize: 20, color: 'white' }} />,
        bg: '#6366F1',
        gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        accentColor: '#4F46E5',
      };
  }
}

// Modern bot active toggle with live status pill
function BotToggle({ channelId }: { channelId: string }) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    supabase
      .from('channels')
      .select('is_active')
      .eq('id', channelId)
      .single()
      .then(({ data }) => {
        if (data) setIsActive(data.is_active);
      });
  }, [channelId]);

  const handleToggle = useCallback(async () => {
    if (isActive === null) return;
    const newValue = !isActive;
    setIsUpdating(true);
    setIsActive(newValue);

    const { error } = await supabase
      .from('channels')
      .update({ is_active: newValue })
      .eq('id', channelId);

    if (error) {
      setIsActive(!newValue); // rollback
    }
    setIsUpdating(false);
  }, [channelId, isActive]);

  if (isActive === null) return <CircularProgress size={16} sx={{ mr: 1 }} />;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={
          <FiberManualRecordIcon
            sx={{
              fontSize: '10px !important',
              color: isActive ? '#10B981 !important' : '#94A3B8 !important',
              animation: isActive ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 0.6, transform: 'scale(0.9)' },
                '50%': { opacity: 1, transform: 'scale(1.2)' },
                '100%': { opacity: 0.6, transform: 'scale(0.9)' },
              },
            }}
          />
        }
        label={isActive ? 'ONLINE' : 'PAUSED'}
        size="small"
        sx={{
          height: 22,
          fontSize: '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.5px',
          bgcolor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
          color: isActive ? '#059669' : '#64748B',
          border: '1px solid',
          borderColor: isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.25)',
        }}
      />
      <Tooltip title={isActive ? 'Bot is Active — Click to pause' : 'Bot is Paused — Click to activate'}>
        <Switch
          checked={isActive}
          onChange={handleToggle}
          disabled={isUpdating}
          color="success"
          size="small"
        />
      </Tooltip>
    </Box>
  );
}

// Channel Platform ID copy component
function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          bgcolor: 'rgba(15, 23, 42, 0.05)',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          color: '#475569',
          fontSize: '0.72rem',
          maxWidth: 160,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {id}
      </Typography>
      <Tooltip title={copied ? 'Copied!' : 'Copy Channel ID'}>
        <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5 }}>
          {copied ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} /> : <ContentCopyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function ChannelsPage() {
  const router = useRouter();
  const { channels, isLoading, isError, error, addChannel, isAdding } = useChannels();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  const handleAddChannel = (channelData: NewChannelPayload) => {
    addChannel(channelData, {
      onSuccess: () => {
        setIsFormOpen(false);
        setSnackbar({ open: true, message: 'Channel connected successfully!', severity: 'success' });
      },
      onError: (err) => {
        setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
      },
    });
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '65vh' }}>
        <CircularProgress size={36} />
        <Typography sx={{ ml: 2, fontWeight: 600, color: 'text.secondary' }}>Loading Communication Channels...</Typography>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load channels: {error?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      {/* Top Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Connected Channels
            </Typography>
            <Chip
              label={`${channels.length} Total`}
              size="small"
              color="primary"
              sx={{ height: 22, fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
            Monitor and configure your automated AI customer communication channels across WhatsApp, Instagram, and Facebook.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setIsFormOpen(true)}
          sx={{
            borderRadius: 2.5,
            px: 2.5,
            py: 1,
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            whiteSpace: 'nowrap'
          }}
        >
          Connect Channel
        </Button>
      </Box>

      {/* Channels Grid */}
      {channels.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            border: '2px dashed rgba(226, 232, 240, 0.9)',
            bgcolor: 'background.paper'
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'rgba(79, 70, 229, 0.1)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2
            }}
          >
            <DnsIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
            No channels connected yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Connect your WhatsApp Business API, Instagram Direct, or Facebook Page to start automating conversations.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsFormOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 700 }}
          >
            Connect Channel
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {channels.map((channel) => {
            const platformInfo = getPlatformInfo(channel.platform);
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={channel.id}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: 3.5,
                    border: '1px solid',
                    borderColor: 'rgba(226, 232, 240, 0.8)',
                    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.85) 100%)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      borderColor: 'primary.light',
                      boxShadow: '0 12px 28px -4px rgba(79, 70, 229, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
                    }
                  }}
                >
                  {/* Top Platform Accent Bar */}
                  <Box sx={{ height: 4, width: '100%', background: platformInfo.gradient }} />

                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {/* Channel Header */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 2.5,
                              background: platformInfo.gradient,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                              flexShrink: 0
                            }}
                          >
                            {platformInfo.icon}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 800,
                                color: '#0F172A',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {channel.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: platformInfo.accentColor, fontWeight: 700 }}>
                              {platformInfo.label}
                            </Typography>
                          </Box>
                        </Box>

                        <BotToggle channelId={channel.id} />
                      </Box>

                      {/* Details row: Platform Channel ID */}
                      <Box sx={{ bgcolor: 'rgba(241, 245, 249, 0.6)', p: 1.5, borderRadius: 2, mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5, fontSize: '0.7rem' }}>
                          PLATFORM CHANNEL ID
                        </Typography>
                        <CopyableId id={channel.platform_channel_id || channel.id} />
                      </Box>
                    </Box>

                    {/* Actions footer */}
                    <Box>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          component={Link}
                          href={`/channels/${channel.id}/settings`}
                          variant="outlined"
                          size="small"
                          startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                          fullWidth
                          sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            textTransform: 'none',
                            py: 0.75
                          }}
                        >
                          Configure Bot
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<ChatIcon sx={{ fontSize: 16 }} />}
                          onClick={() => router.push('/chat')}
                          sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            textTransform: 'none',
                            minWidth: 105,
                            bgcolor: '#4F46E5',
                            '&:hover': { bgcolor: '#4338CA' }
                          }}
                        >
                          Live Chat
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add Channel Modal */}
      <ChannelForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddChannel}
        isSubmitting={isAdding}
      />

      {/* Toast Feedback */}
      {snackbar && (
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2.5 }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
}