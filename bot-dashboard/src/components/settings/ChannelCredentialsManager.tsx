'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  TextField,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import { supabase } from '@/lib/supabaseClient';

// These keys are required for every channel and cannot be deleted
const REQUIRED_KEYS = ['token', 'page_id'];

interface ChannelCredentialsManagerProps {
  channelId: string;
}

interface CredentialField {
  key: string;
  value: string;
}

export default function ChannelCredentialsManager({ channelId }: ChannelCredentialsManagerProps) {
  const [fields, setFields] = useState<CredentialField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Fetch the credentials when the component loads
  useEffect(() => {
    async function fetchCredentials() {
      setIsLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('channels')
        .select('credentials')
        .eq('id', channelId)
        .single();

      if (error) {
        setError(error.message);
      } else {
        let parsed: CredentialField[] = [];

        if (data && data.credentials) {
          try {
            const credentialsObj = typeof data.credentials === 'string'
              ? JSON.parse(data.credentials)
              : data.credentials;

            if (credentialsObj && typeof credentialsObj === 'object' && !Array.isArray(credentialsObj)) {
              parsed = Object.entries(credentialsObj).map(([key, value]) => ({
                key,
                value: String(value),
              }));
            }
          } catch (e) {
            console.error("Failed to parse credentials", e);
          }
        }

        // Ensure required keys are always present
        for (const reqKey of REQUIRED_KEYS) {
          if (!parsed.find(f => f.key === reqKey)) {
            parsed.unshift({ key: reqKey, value: '' });
          }
        }

        // Sort: required keys first, then the rest
        const required = parsed.filter(f => REQUIRED_KEYS.includes(f.key));
        const others = parsed.filter(f => !REQUIRED_KEYS.includes(f.key));
        // Order required keys in the same order as REQUIRED_KEYS
        const sortedRequired = REQUIRED_KEYS
          .map(k => required.find(f => f.key === k))
          .filter(Boolean) as CredentialField[];

        setFields([...sortedRequired, ...others]);
      }
      setIsLoading(false);
    }
    fetchCredentials();
  }, [channelId]);

  const handleFieldChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const currentField = fields[index];
    // Don't allow renaming the key of required fields
    if (field === 'key' && REQUIRED_KEYS.includes(currentField.key)) return;
    
    const newFields = [...fields];
    newFields[index][field] = newValue;
    setFields(newFields);
  };

  const handleAddField = () => {
    setFields([...fields, { key: '', value: '' }]);
  };

  const handleDeleteField = (index: number) => {
    const field = fields[index];
    // Don't allow deleting required fields
    if (REQUIRED_KEYS.includes(field.key)) return;
    
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
  };

  const handleSave = async () => {
    setIsSaving(true);

    const credentialsToSave: Record<string, string> = {};
    let hasEmptyKeys = false;

    fields.forEach((field) => {
      if (field.key.trim()) {
        credentialsToSave[field.key.trim()] = field.value;
      } else {
        if (field.value) hasEmptyKeys = true;
      }
    });

    if (hasEmptyKeys) {
      setSnackbar({ open: true, message: 'Warning: Fields with empty keys were ignored.', severity: 'warning' });
    }

    const { error: updateError } = await supabase
      .from('channels')
      .update({ credentials: credentialsToSave })
      .eq('id', channelId);

    if (updateError) {
      setSnackbar({ open: true, message: `Error: ${updateError.message}`, severity: 'error' });
    } else {
      setSnackbar({ open: true, message: 'Credentials saved successfully!', severity: 'success' });
    }
    setIsSaving(false);
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

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Channel Credentials
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage the API keys and secrets for this channel. <strong>Token</strong> and <strong>page_id</strong> are required and cannot be removed.
      </Typography>

      <Box sx={{ mb: 3 }}>
        {fields.map((field, index) => {
          const isRequired = REQUIRED_KEYS.includes(field.key);

          return (
            <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <TextField
                label="Key"
                value={field.key}
                onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                variant="outlined"
                size="small"
                sx={{ flex: 1 }}
                placeholder="e.g. api_key"
                disabled={isRequired}
                slotProps={{
                  input: isRequired ? {
                    startAdornment: (
                      <Tooltip title="Required field — cannot be removed">
                        <LockIcon fontSize="small" color="primary" sx={{ mr: 0.5 }} />
                      </Tooltip>
                    ),
                  } : undefined,
                }}
              />
              <TextField
                label="Value"
                value={field.value}
                onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                variant="outlined"
                size="small"
                sx={{ flex: 1 }}
                placeholder={isRequired ? `Enter ${field.key}` : 'e.g. 12345abcde'}
                type="text"
                required={isRequired}
                error={isRequired && !field.value.trim()}
                helperText={isRequired && !field.value.trim() ? `${field.key} is required` : undefined}
              />
              {isRequired ? (
                <Tooltip title="Required — cannot be deleted">
                  <span>
                    <IconButton disabled size="small" sx={{ mt: 0.5 }}>
                      <LockIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <IconButton onClick={() => handleDeleteField(index)} color="error" size="small" sx={{ mt: 0.5 }}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          );
        })}

        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
            No credentials added yet.
          </Typography>
        )}

        <Button
          startIcon={<AddIcon />}
          onClick={handleAddField}
          variant="outlined"
          size="small"
        >
          Add Field
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ textAlign: 'right' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <CircularProgress size={24} /> : 'Save Credentials'}
        </Button>
      </Box>

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