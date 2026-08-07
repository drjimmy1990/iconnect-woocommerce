// src/components/crm/tabs/ClientProfile.tsx
'use client';

import React, { useState, useEffect } from 'react';
// --- THIS IS THE FIX ---
// Every single required component from MUI is listed here.
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Typography,
  Snackbar,
  Alert,
  MenuItem,
  InputAdornment
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { CrmClient } from '@/lib/api';
import { useClient, UpdateClientPayload } from '@/hooks/useClient';
import ClientTagsManager from '../ClientTagsManager';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

interface ClientProfileProps {
  client: CrmClient;
}

export default function ClientProfile({ client }: ClientProfileProps) {
  const { updateClient, isUpdatingClient } = useClient(client.id);
  const [formData, setFormData] = useState<CrmClient>(client);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => { setFormData(client); }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const hasChanges =
    formData.company_name !== client.company_name ||
    formData.email !== client.email ||
    formData.phone !== client.phone ||
    formData.secondary_phone !== client.secondary_phone ||
    formData.client_type !== client.client_type ||
    formData.source !== client.source ||
    JSON.stringify([...(formData.tags || [])].sort()) !== JSON.stringify([...(client.tags || [])].sort());

  const handleSaveChanges = () => {
    if (!hasChanges) return;
    const payload: UpdateClientPayload = {
      company_name: formData.company_name,
      email: formData.email,
      phone: formData.phone,
      secondary_phone: formData.secondary_phone,
      client_type: formData.client_type,
      source: formData.source,
      tags: formData.tags,
    };
    updateClient(payload, {
      onSuccess: () => { setSnackbar({ open: true, message: 'Client profile saved successfully!', severity: 'success' }); },
      onError: (err: Error) => { setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }); },
    });
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom> Client Details </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Contact Info</Typography>
            <TextField name="company_name" label="Company Name" value={formData.company_name || ''} onChange={handleChange} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField name="email" label="Email" type="email" value={formData.email || ''} onChange={handleChange} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField name="phone" label="Primary Phone" value={formData.phone || ''} onChange={handleChange} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField name="secondary_phone" label="Secondary Phone" value={formData.secondary_phone || ''} onChange={handleChange} fullWidth size="small" />
            <TextField label="Platform User ID" value={formData.platform_user_id || 'N/A'} fullWidth size="small" sx={{ mt: 2 }} disabled InputProps={{ startAdornment: (<InputAdornment position="start"> <VpnKeyIcon fontSize="small" /> </InputAdornment>), }} helperText="The user's ID on the messaging platform (e.g., WhatsApp number)." />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>CRM Details</Typography>
            <TextField name="client_type" label="Client Type" value={formData.client_type} onChange={handleChange} select fullWidth size="small" sx={{ mb: 2 }}>
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="interested">Interested</MenuItem>
              <MenuItem value="customer">Customer</MenuItem>
              <MenuItem value="repeat_customer">Repeat Customer</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <TextField name="source" label="Lead Source" value={formData.source || ''} onChange={handleChange} fullWidth size="small" sx={{ mb: 2 }} />
            <Box sx={{ mt: 2 }}>
              <ClientTagsManager tags={formData.tags} onTagsChange={handleTagsChange} />
            </Box>
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ textAlign: 'right', mt: 2 }}>
            <Button variant="contained" startIcon={isUpdatingClient ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} onClick={handleSaveChanges} disabled={!hasChanges || isUpdatingClient}>
              Save Changes
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(null)}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}