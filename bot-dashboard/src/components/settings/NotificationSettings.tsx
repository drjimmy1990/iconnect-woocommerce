// src/components/settings/NotificationSettings.tsx
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
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CancelIcon from '@mui/icons-material/Cancel';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useChannelConfig, ChannelConfig, NotificationConfig } from '@/hooks/useChannelConfig';

interface NotificationSettingsProps {
  config: ChannelConfig;
  channelId: string;
}

export default function NotificationSettings({ config, channelId }: NotificationSettingsProps) {
  const { updateConfig, isUpdatingConfig } = useChannelConfig(channelId);
  const [formData, setFormData] = useState<NotificationConfig>(config.notification_config || {});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setFormData(config.notification_config || {});
  }, [config]);

  const handleChange = (field: keyof NotificationConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    const cleaned: NotificationConfig = {};
    if (formData.telegram_complaints_group_id?.trim()) {
      cleaned.telegram_complaints_group_id = formData.telegram_complaints_group_id.trim();
    }
    if (formData.telegram_cancellations_group_id?.trim()) {
      cleaned.telegram_cancellations_group_id = formData.telegram_cancellations_group_id.trim();
    }
    if (formData.telegram_orders_group_id?.trim()) {
      cleaned.telegram_orders_group_id = formData.telegram_orders_group_id.trim();
    }

    updateConfig(
      { notification_config: cleaned },
      {
        onSuccess: () => setSnackbar({ open: true, message: 'Notification settings saved!', severity: 'success' }),
        onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
      }
    );
  };

  const isConfigured = !!(formData.telegram_complaints_group_id || formData.telegram_cancellations_group_id || formData.telegram_orders_group_id);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <NotificationsActiveIcon color="primary" />
        Notification Routing
        <Chip
          label={isConfigured ? 'Configured' : 'Not Configured'}
          color={isConfigured ? 'success' : 'default'}
          size="small"
          sx={{ ml: 1 }}
        />
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the Telegram group IDs where the AI bot will send escalation notifications.
        When a customer requests a cancellation or files a complaint, the bot will automatically
        notify the appropriate Telegram group.
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Complaints Group ID"
            value={formData.telegram_complaints_group_id || ''}
            onChange={handleChange('telegram_complaints_group_id')}
            fullWidth
            size="small"
            placeholder="-804336929"
            helperText="Telegram group for complaints and urgent escalations"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <ReportProblemIcon fontSize="small" color="warning" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Cancellations Group ID"
            value={formData.telegram_cancellations_group_id || ''}
            onChange={handleChange('telegram_cancellations_group_id')}
            fullWidth
            size="small"
            placeholder="-836801390"
            helperText="Telegram group for order cancellation requests"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CancelIcon fontSize="small" color="error" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            label="Orders Group ID"
            value={formData.telegram_orders_group_id || ''}
            onChange={handleChange('telegram_orders_group_id')}
            fullWidth
            size="small"
            placeholder="-123456789"
            helperText="Telegram group/channel for receiving new order notifications"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <ShoppingCartIcon fontSize="small" color="success" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={12} sx={{ textAlign: 'right', mt: 1 }}>
          <Button variant="contained" onClick={handleSave} disabled={isUpdatingConfig}>
            {isUpdatingConfig ? <CircularProgress size={24} /> : 'Save Notification Settings'}
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
