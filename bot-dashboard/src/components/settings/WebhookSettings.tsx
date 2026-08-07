// src/components/settings/WebhookSettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  InputAdornment,
  Chip,
} from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import { useChannelConfig, ChannelConfig } from '@/hooks/useChannelConfig';

interface WebhookSettingsProps {
  config: ChannelConfig;
  channelId: string;
}

export default function WebhookSettings({ config, channelId }: WebhookSettingsProps) {
  const { updateConfig, isUpdatingConfig } = useChannelConfig(channelId);
  const [webhookUrl, setWebhookUrl] = useState(config.agent_webhook_url || '');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setWebhookUrl(config.agent_webhook_url || '');
  }, [config]);

  const handleSave = () => {
    updateConfig(
      { agent_webhook_url: webhookUrl.trim() || undefined },
      {
        onSuccess: () => setSnackbar({ open: true, message: 'Webhook URL saved!', severity: 'success' }),
        onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
      }
    );
  };

  const isConfigured = !!webhookUrl.trim();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WebhookIcon color="primary" />
        n8n Webhook Integration
        <Chip
          label={isConfigured ? 'Configured' : 'Not Configured'}
          color={isConfigured ? 'success' : 'default'}
          size="small"
          sx={{ ml: 1 }}
        />
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the n8n webhook URL used for sending agent messages (text, images, voice, files).
        The dashboard will POST to this URL when an agent sends a message from the chat interface.
      </Typography>

      <Grid container spacing={3} alignItems="center">
        <Grid size={12}>
          <TextField
            label="Agent Message Webhook URL"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            fullWidth
            size="small"
            placeholder="https://your-n8n.com/webhook/agent-send-message"
            helperText="The n8n webhook endpoint that handles sending agent messages to the customer's platform."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <WebhookIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>
        <Grid size={12} sx={{ textAlign: 'right' }}>
          <Button variant="contained" onClick={handleSave} disabled={isUpdatingConfig}>
            {isUpdatingConfig ? <CircularProgress size={24} /> : 'Save Webhook Settings'}
          </Button>
        </Grid>
      </Grid>

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Paper>
  );
}
