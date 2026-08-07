// src/components/settings/KeywordActionsManager.tsx
'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  Divider,
  Grid,
  CircularProgress,
  Tooltip,
  Chip,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { useChannelConfig, KeywordAction } from '@/hooks/useChannelConfig';

// Protected system keywords — cannot be deleted
const SYSTEM_KEYWORDS: Record<string, { label: string; color: 'success' | 'error'; description: string }> = {
  'DISABLE_AI': { label: 'Stop AI', color: 'error', description: 'Customer sends this to pause the AI bot' },
  'ENABLE_AI': { label: 'Start AI', color: 'success', description: 'Customer sends this to re-activate the AI bot' },
};

interface KeywordActionsManagerProps {
  keywords: KeywordAction[];
  channelId: string;
}

type EditingState = {
  id: string;
  keyword: string;
  action_type: string;
};

export default function KeywordActionsManager({ keywords, channelId }: KeywordActionsManagerProps) {
  const { addKeyword, isAddingKeyword, deleteKeyword, isDeletingKeyword, updateKeyword, isUpdatingKeyword } = useChannelConfig(channelId);

  const [newKeyword, setNewKeyword] = useState('');
  const [newActionType, setNewActionType] = useState('');
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  // Split keywords into system (DISABLE_AI/ENABLE_AI) and custom
  const systemKeywords = keywords.filter(k => k.action_type in SYSTEM_KEYWORDS);
  const customKeywords = keywords.filter(k => !(k.action_type in SYSTEM_KEYWORDS));

  const handleAddAction = () => {
    if (newKeyword.trim() && newActionType.trim()) {
      addKeyword({ keyword: newKeyword.trim(), action_type: newActionType.trim() }, {
        onSuccess: () => {
          setNewKeyword('');
          setNewActionType('');
        }
      });
    }
  };

  const handleStartEdit = (action: KeywordAction) => {
    setEditingState({ ...action });
  };

  const handleCancelEdit = () => {
    setEditingState(null);
  };

  const handleUpdateAction = () => {
    if (editingState) {
      updateKeyword(editingState, {
        onSuccess: () => setEditingState(null)
      });
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToyIcon color="primary" />
        Keyword Actions & Variables
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define keywords that trigger automated actions and store variables for your n8n workflows.
      </Typography>

      {/* ─── AI Control Keywords (Protected) ─── */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        AI Control Keywords
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
        {systemKeywords.map((action) => {
          const meta = SYSTEM_KEYWORDS[action.action_type];
          const isEditing = editingState?.id === action.id;

          return (
            <Box
              key={action.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Tooltip title="Protected — cannot be deleted">
                <LockIcon fontSize="small" color="action" />
              </Tooltip>

              <Chip
                label={meta.label}
                color={meta.color}
                size="small"
                variant="outlined"
                sx={{ minWidth: 72 }}
              />

              {isEditing ? (
                <>
                  <TextField
                    value={editingState.keyword}
                    onChange={(e) => setEditingState(s => s ? { ...s, keyword: e.target.value } : null)}
                    size="small"
                    label="Trigger keyword"
                    sx={{ flex: 1, maxWidth: 160 }}
                    autoFocus
                  />
                  <Tooltip title="Save">
                    <IconButton onClick={handleUpdateAction} disabled={isUpdatingKeyword} size="small">
                      {isUpdatingKeyword ? <CircularProgress size={18} /> : <SaveIcon color="primary" fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton onClick={handleCancelEdit} size="small">
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    When customer sends <strong>&quot;{action.keyword}&quot;</strong> → {meta.description}
                  </Typography>
                  <Tooltip title="Edit trigger keyword">
                    <IconButton size="small" onClick={() => handleStartEdit(action)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          );
        })}

        {systemKeywords.length === 0 && (
          <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
            No AI control keywords set. Add keywords with action <strong>DISABLE_AI</strong> or <strong>ENABLE_AI</strong>.
          </Alert>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* ─── Custom Variables ─── */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        Custom Variables
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
        {customKeywords.map((action) => {
          const isEditing = editingState?.id === action.id;

          return isEditing ? (
            <Box
              key={action.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.focus',
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <TextField
                value={editingState.keyword}
                onChange={(e) => setEditingState(s => s ? { ...s, keyword: e.target.value } : null)}
                size="small"
                label="Name"
                sx={{ flex: 1 }}
                autoFocus
              />
              <TextField
                value={editingState.action_type}
                onChange={(e) => setEditingState(s => s ? { ...s, action_type: e.target.value } : null)}
                size="small"
                label="Value"
                sx={{ flex: 1 }}
              />
              <Tooltip title="Save">
                <IconButton onClick={handleUpdateAction} disabled={isUpdatingKeyword} size="small">
                  {isUpdatingKeyword ? <CircularProgress size={18} /> : <SaveIcon color="primary" fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton onClick={handleCancelEdit} size="small">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box
              key={action.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{action.keyword}</Typography>
                <Typography variant="caption" color="text.secondary">{action.action_type}</Typography>
              </Box>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleStartEdit(action)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => deleteKeyword(action.id)} color="error">
                  {isDeletingKeyword ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}

        {customKeywords.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}>
            No custom variables defined yet.
          </Typography>
        )}
      </Box>

      {/* ─── Add New Variable ─── */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        Add New Variable
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Name"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            placeholder="e.g., greeting_msg"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField
            label="Value"
            value={newActionType}
            onChange={(e) => setNewActionType(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            placeholder="e.g., Welcome to our store!"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Button
            onClick={handleAddAction}
            startIcon={isAddingKeyword ? <CircularProgress size={20} /> : <AddCircleOutlineIcon />}
            variant="contained"
            fullWidth
            disabled={!newKeyword.trim() || !newActionType.trim() || isAddingKeyword}
          >
            Add
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}