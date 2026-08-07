// src/components/settings/GeneralSettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Grid,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Button,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useChannelConfig, ChannelConfig } from '@/hooks/useChannelConfig';
// REMOVED: No longer need useSearchParams

// --- THIS IS A FIX ---
// The component now expects a channelId to be passed in as a prop.
interface GeneralSettingsProps {
  config: ChannelConfig;
  channelId: string;
}

// --- THIS IS THE MAIN FIX ---
// The component now receives and uses the channelId from its props.
export default function GeneralSettings({ config, channelId }: GeneralSettingsProps) {
  // REMOVED: The broken useSearchParams logic is gone.

  // The hook now receives the correct channelId, so all mutations will work.
  const { updateConfig, isUpdatingConfig } = useChannelConfig(channelId);

  const [formData, setFormData] = useState(config);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // Re-sync form state if the config prop changes from a parent re-render
  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSliderChange = (name: string) => (event: Event, newValue: number | number[]) => {
    setFormData(prev => ({ ...prev, [name]: newValue as number }));
  };

  const handleSaveChanges = () => {
    const payload: Partial<ChannelConfig> = {
      is_bot_active: formData.is_bot_active,
      is_followup_active: formData.is_followup_active,
      ai_model: formData.ai_model,
      ai_temperature: formData.ai_temperature,
      fallback_model: formData.fallback_model || undefined,
      fallback_temperature: formData.fallback_temperature ?? formData.ai_temperature,
    };

    updateConfig(payload, {
      onSuccess: () => setSnackbar({ open: true, message: 'Settings saved!', severity: 'success' }),
      onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>General Settings</Typography>

      <Grid container spacing={3} alignItems="center">
        <Grid size={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_bot_active}
                onChange={handleChange}
                name="is_bot_active"
                color="success"
              />
            }
            label={formData.is_bot_active ? "Bot is ON" : "Bot is OFF"}
          />
          <Typography variant="caption" display="block" color="text.secondary">
            This is the master switch. If off, the AI will not respond to any messages.
          </Typography>
        </Grid>
        <Grid size={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_followup_active}
                onChange={handleChange}
                name="is_followup_active"
                color="success"
              />
            }
            label={formData.is_followup_active ? "AI Follow-ups Enabled" : "AI Follow-ups Disabled"}
          />
          <Typography variant="caption" display="block" color="text.secondary">
            If enabled, the AI will automatically re-engage silent customers after 5 hours.
          </Typography>
        </Grid>
        <Grid size={12}>
          <TextField
            name="ai_model"
            label="AI Model"
            value={formData.ai_model}
            onChange={handleChange}
            fullWidth
            required
            size="small"
            helperText="e.g., models/gemini-1.5-flash"
          />
        </Grid>
        <Grid size={12}>
          <Typography gutterBottom variant="body2">AI Temperature: {formData.ai_temperature}</Typography>
          <Slider
            name="ai_temperature"
            value={formData.ai_temperature}
            onChange={handleSliderChange('ai_temperature')}
            valueLabelDisplay="auto"
            step={0.1}
            marks
            min={0}
            max={1}
          />
        </Grid>

        <Grid size={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Fallback Model — Used when the primary model fails or is unavailable
          </Typography>
        </Grid>

        <Grid size={12}>
          <TextField
            name="fallback_model"
            label="Fallback AI Model"
            value={formData.fallback_model || ''}
            onChange={handleChange}
            fullWidth
            size="small"
            helperText="e.g., models/gemini-2.0-flash-lite"
            placeholder="models/gemini-2.0-flash-lite"
          />
        </Grid>
        <Grid size={12}>
          <Typography gutterBottom variant="body2">Fallback Temperature: {formData.fallback_temperature ?? formData.ai_temperature}</Typography>
          <Slider
            name="fallback_temperature"
            value={formData.fallback_temperature ?? formData.ai_temperature}
            onChange={handleSliderChange('fallback_temperature')}
            valueLabelDisplay="auto"
            step={0.1}
            marks
            min={0}
            max={1}
          />
        </Grid>
        <Grid size={12} sx={{ textAlign: 'right' }}>
          <Button variant="contained" onClick={handleSaveChanges} disabled={isUpdatingConfig}>
            {isUpdatingConfig ? <CircularProgress size={24} /> : 'Save General Settings'}
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