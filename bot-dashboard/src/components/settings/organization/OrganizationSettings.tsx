// src/components/settings/organization/OrganizationSettings.tsx
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
  Divider,
} from '@mui/material';
import { supabase } from '@/lib/supabaseClient';

interface Organization {
  id: string;
  name: string;
}

export default function OrganizationSettings() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [initialOrgName, setInitialOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      setLoading(true);
      // RLS ensures this only fetches the organization for the currently logged-in user.
      const { data } = await supabase
        .from('organizations')
        .select('id, name')
        .single();

      if (data) {
        setOrganization(data);
        setOrgName(data.name);
        setInitialOrgName(data.name);
      }
      setLoading(false);
    }
    fetchOrganization();
  }, []);

  const handleSaveChanges = async () => {
    if (!organization) return;
    setSaving(true);

    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName })
      .eq('id', organization.id);

    if (error) {
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setSnackbar({ open: true, message: 'Organization name updated!', severity: 'success' });
      setInitialOrgName(orgName); // Update initial name to disable save button
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (!organization) {
    return <Alert severity="warning">Could not load organization details.</Alert>
  }

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Organization Settings
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2} alignItems="center">
          <Grid size={12}>
            <TextField
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid size={12} sx={{ textAlign: 'right', mt: 1 }}>
            <Button
              variant="contained"
              onClick={handleSaveChanges}
              disabled={saving || orgName === initialOrgName}
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : null}
            >
              Save Changes
            </Button>
          </Grid>
        </Grid>
      </Paper>
      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}