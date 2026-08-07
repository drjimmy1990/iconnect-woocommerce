// src/app/(app)/channels/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Container,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Snackbar,
  Switch,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import Link from 'next/link';

import { useChannels, NewChannelPayload } from '@/hooks/useChannels';
import ChannelForm from '@/components/channels/ChannelForm';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import { supabase } from '@/lib/supabaseClient';

// Small component for each channel's bot toggle
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

  if (isActive === null) return <CircularProgress size={20} sx={{ mr: 1 }} />;

  return (
    <Tooltip title={isActive ? 'Channel is Active — click to turn off' : 'Channel is Inactive — click to turn on'}>
      <Switch
        checked={isActive}
        onChange={handleToggle}
        disabled={isUpdating}
        color="success"
        size="small"
      />
    </Tooltip>
  );
}

export default function ChannelsPage() {
  const { channels, isLoading, isError, error, addChannel, isAdding } = useChannels();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);


  const handleAddChannel = (channelData: NewChannelPayload) => {
    addChannel(channelData, {
      onSuccess: () => {
        setIsFormOpen(false);
        setSnackbar({ open: true, message: 'Channel added successfully!', severity: 'success' });
      },
      onError: (err) => {
        setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
      },
    });
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Channels...</Typography>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">
          Failed to load channels: {error?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Channel Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Add, view, and configure your communication channels.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsFormOpen(true)}
        >
          Add Channel
        </Button>
      </Box>

      <Paper>
        <List>
          {channels.map((channel) => (
            <ListItem
              key={channel.id}
              secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BotToggle channelId={channel.id} />
                  <Button
                    component={Link}
                    href={`/channels/${channel.id}/settings`}
                    startIcon={<SettingsIcon />}
                    aria-label="settings"
                    size="small"
                  >
                    Configure
                  </Button>
                </Box>
              }
            >
              <ListItemIcon>
                <PlatformAvatar platform={channel.platform} />
              </ListItemIcon>
              <ListItemText
                primary={channel.name}
                secondary={`ID: ${channel.platform_channel_id}`}
              />
            </ListItem>
          ))}
          {channels.length === 0 && (
            <ListItem>
              <ListItemText primary="No channels found." secondary="Click 'Add Channel' to get started." sx={{ textAlign: 'center', py: 4 }} />
            </ListItem>
          )}
        </List>
      </Paper>

      <ChannelForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddChannel}
        isSubmitting={isAdding}
      />

      {snackbar && (
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
}