// src/components/settings/EcommerceSettings.tsx
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
  IconButton,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useChannelConfig, ChannelConfig, EcommerceConfig } from '@/hooks/useChannelConfig';

interface EcommerceSettingsProps {
  config: ChannelConfig;
  channelId: string;
}

export default function EcommerceSettings({ config, channelId }: EcommerceSettingsProps) {
  const { updateConfig, isUpdatingConfig } = useChannelConfig(channelId);
  const [formData, setFormData] = useState<EcommerceConfig>(config.ecommerce_config || {});
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setFormData(config.ecommerce_config || {});
  }, [config]);

  const handleChange = (field: keyof EcommerceConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    // Clean empty strings to undefined
    const cleaned: EcommerceConfig = {};
    if (formData.api_url?.trim()) cleaned.api_url = formData.api_url.trim();
    if (formData.api_key?.trim()) cleaned.api_key = formData.api_key.trim();
    if (formData.login_email?.trim()) cleaned.login_email = formData.login_email.trim();
    if (formData.login_password?.trim()) cleaned.login_password = formData.login_password.trim();

    updateConfig(
      { ecommerce_config: cleaned },
      {
        onSuccess: () => setSnackbar({ open: true, message: 'E-Commerce settings saved!', severity: 'success' }),
        onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
      }
    );
  };

  const isConfigured = !!(formData.api_url || formData.api_key);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorefrontIcon color="primary" />
        E-Commerce Integration
        <Chip
          label={isConfigured ? 'Configured' : 'Not Configured'}
          color={isConfigured ? 'success' : 'default'}
          size="small"
          sx={{ ml: 1 }}
        />
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the credentials for the external e-commerce platform used by the AI bot to create orders.
        The n8n workflow uses these credentials to authenticate with the e-commerce API when placing orders.
      </Typography>

      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            label="E-Commerce API URL"
            value={formData.api_url || ''}
            onChange={handleChange('api_url')}
            fullWidth
            size="small"
            placeholder="https://yourstore.com/api"
            helperText="Base URL of the e-commerce platform API"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <StorefrontIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            label="API Key"
            value={formData.api_key || ''}
            onChange={handleChange('api_key')}
            fullWidth
            size="small"
            type={showApiKey ? 'text' : 'password'}
            placeholder="your-api-key"
            helperText="x-api-key header value for authenticating with the e-commerce API"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)} edge="end">
                      {showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Bot Login Email"
            value={formData.login_email || ''}
            onChange={handleChange('login_email')}
            fullWidth
            size="small"
            type="email"
            placeholder="bot@yourstore.com"
            helperText="Email used by the bot to login to the e-commerce admin"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Bot Login Password"
            value={formData.login_password || ''}
            onChange={handleChange('login_password')}
            fullWidth
            size="small"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            helperText="Password for the bot's e-commerce admin account"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={12} sx={{ textAlign: 'right', mt: 1 }}>
          <Button variant="contained" onClick={handleSave} disabled={isUpdatingConfig}>
            {isUpdatingConfig ? <CircularProgress size={24} /> : 'Save E-Commerce Settings'}
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
