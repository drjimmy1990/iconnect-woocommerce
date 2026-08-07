// src/components/settings/ChannelDetails.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

interface ChannelDetails {
  id: string;
  name: string;
  platform_channel_id: string;
}

interface ChannelDetailsProps {
  channelId: string;
}

export default function ChannelDetails({ channelId }: ChannelDetailsProps) {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<ChannelDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      setIsLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, platform_channel_id')
        .eq('id', channelId)
        .single();
      
      if (error) {
        setError(error.message);
      } else {
        setDetails(data);
      }
      setIsLoading(false);
    }
    fetchDetails();
  }, [channelId]);

  const handleSave = async () => {
    if (!details) return;
    setIsSaving(true);
    const { error: updateError } = await supabase
      .from('channels')
      .update({ name: details.name, platform_channel_id: details.platform_channel_id })
      .eq('id', channelId);

    if (updateError) {
      setSnackbar({ open: true, message: `Error: ${updateError.message}`, severity: 'error' });
    } else {
      setSnackbar({ open: true, message: 'Channel details saved!', severity: 'success' });
      setIsEditing(false);
      // Invalidate queries to refresh data across the app (e.g., in the sidebar)
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    }
    setIsSaving(false);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDetails(prev => prev ? { ...prev, [name]: value } : null);
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!details) {
    return <Alert severity="info">Channel not found.</Alert>;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Channel Details</Typography>
        {!isEditing && (
          <Button startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </Box>
      
      {/* --- THIS IS THE FIX --- */}
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            name="name"
            label="Channel Name"
            value={details.name}
            onChange={handleChange}
            fullWidth
            size="small"
            disabled={!isEditing}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            name="platform_channel_id"
            label="Platform Channel ID"
            value={details.platform_channel_id}
            onChange={handleChange}
            fullWidth
            size="small"
            disabled={!isEditing}
            helperText="e.g., The WhatsApp Phone Number ID"
          />
        </Grid>
        {isEditing && (
          <Grid size={12} sx={{ textAlign: 'right', mt: 1 }}>
            <Button onClick={() => setIsEditing(false)} sx={{ mr: 1 }} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="contained" startIcon={isSaving ? <CircularProgress size={20}/> : <SaveIcon />} onClick={handleSave} disabled={isSaving}>
              Save Details
            </Button>
          </Grid>
        )}
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