// src/components/channels/ChannelForm.tsx
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import { NewChannelPayload } from '@/hooks/useChannels';

interface ChannelFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (channelData: NewChannelPayload) => void;
  isSubmitting: boolean;
}

const initialState: NewChannelPayload = {
  name: '',
  platform: 'whatsapp',
  platform_channel_id: '',
};

export default function ChannelForm({ open, onClose, onSubmit, isSubmitting }: ChannelFormProps) {
  const [formData, setFormData] = useState<NewChannelPayload>(initialState);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'web' }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Clear form state after the closing animation finishes
  const handleClose = () => {
    onClose();
    setTimeout(() => setFormData(initialState), 300);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ component: 'form', onSubmit: handleSubmit }}>
      <DialogTitle>Add New Channel</DialogTitle>
      <DialogContent>
        {/* --- THIS IS THE FIX --- */}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={12}>
            <TextField
              name="name"
              label="Channel Name"
              value={formData.name}
              onChange={handleTextChange}
              fullWidth
              required
              autoFocus
              helperText="A friendly name for this channel, e.g., 'Main Clinic WhatsApp'."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Platform</InputLabel>
              <Select
                name="platform"
                value={formData.platform}
                label="Platform"
                onChange={handleSelectChange}
              >
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="facebook">Facebook Messenger</MenuItem>
                <MenuItem value="instagram">Instagram</MenuItem>
                <MenuItem value="telegram">Telegram</MenuItem>
                <MenuItem value="web">Web Chat</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              name="platform_channel_id"
              label="Platform Channel ID"
              value={formData.platform_channel_id}
              onChange={handleTextChange}
              fullWidth
              required
              helperText="e.g., WhatsApp Phone Number ID."
            />
          </Grid>
        </Grid>

      </DialogContent>
      <DialogActions sx={{ p: '0 24px 16px' }}>
        <Button onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={24} /> : 'Add Channel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}