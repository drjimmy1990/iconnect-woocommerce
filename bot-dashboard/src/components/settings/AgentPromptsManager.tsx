'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useChannelConfig, AgentPrompt, AddPromptPayload } from '@/hooks/useChannelConfig';

interface AgentPromptsManagerProps {
  prompts: AgentPrompt[];
  channelId: string;
}

// Dialog component for adding a new agent persona (No changes needed here)
function AddPromptDialog({ open, onClose, onSubmit, isAdding }: { open: boolean, onClose: () => void, onSubmit: (data: Omit<AddPromptPayload, 'channel_id' | 'organization_id'>) => void, isAdding: boolean }) {
  const [formData, setFormData] = useState({ name: '', agent_id: '', description: '', system_prompt: 'You are a helpful assistant.' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', agent_id: '', description: '', system_prompt: 'You are a helpful assistant.' });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ component: 'form', onSubmit: handleSubmit }}>
      <DialogTitle>Add New Agent Persona</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField name="name" label="Persona Name" value={formData.name} onChange={handleChange} fullWidth required autoFocus helperText="e.g., Support Agent" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField name="agent_id" label="Agent ID" value={formData.agent_id} onChange={handleChange} fullWidth required helperText="Machine-readable ID, e.g., 'support_agent'" />
          </Grid>
          <Grid size={12}>
            <TextField name="description" label="Description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} helperText="A brief description of this agent's purpose." />
          </Grid>
          <Grid size={12}>
            <TextField name="system_prompt" label="System Prompt" value={formData.system_prompt} onChange={handleChange} fullWidth multiline rows={10} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isAdding}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isAdding}>{isAdding ? <CircularProgress size={24} /> : "Add Persona"}</Button>
      </DialogActions>
    </Dialog>
  );
}


export default function AgentPromptsManager({ prompts, channelId }: AgentPromptsManagerProps) {
  const { updatePrompt, isUpdatingPrompt, addPrompt, isAddingPrompt } = useChannelConfig(channelId);

  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [promptText, setPromptText] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // --- THIS IS A FIX ---
  // This useEffect now correctly handles both initial load and updates when the `prompts` prop changes.
  useEffect(() => {
    // If there's no selected prompt yet, or the selected one is no longer in the list, select the first one.
    const currentPromptExists = prompts.some(p => p.id === selectedPrompt?.id);
    if ((!selectedPrompt && prompts.length > 0) || !currentPromptExists) {
      const newSelectedPrompt = prompts[0] || null;
      setSelectedPrompt(newSelectedPrompt);
      setPromptText(newSelectedPrompt?.system_prompt || '');
    } else if (selectedPrompt) {
      // If the selected prompt still exists, find the latest version of it from the `prompts` prop
      // and update the text area. This handles the refresh-on-save.
      const updatedPrompt = prompts.find(p => p.id === selectedPrompt.id);
      if (updatedPrompt && updatedPrompt.system_prompt !== promptText) {
        setPromptText(updatedPrompt.system_prompt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, selectedPrompt]); // Run this effect whenever the master list of prompts changes.

  const handleSelectPrompt = (prompt: AgentPrompt) => {
    setSelectedPrompt(prompt);
    setPromptText(prompt.system_prompt);
  };

  const handleSaveChanges = () => {
    if (!selectedPrompt) return;

    // Nothing changes here. The mutation invalidates the query, which triggers the useEffect above.
    updatePrompt({ promptId: selectedPrompt.id, system_prompt: promptText }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: `"${selectedPrompt.name}" saved!`, severity: 'success' });
        // The magic now happens in the `useEffect` hook.
      },
      onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
    });
  };

  const handleAddPrompt = (data: Omit<AddPromptPayload, 'channel_id' | 'organization_id'>) => {
    addPrompt(data, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setSnackbar({ open: true, message: 'New persona added!', severity: 'success' });
      },
      onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
    });
  };

  return (
    <>
      <Paper sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, height: '70vh', minHeight: '500px', maxHeight: '800px' }}>
        <Box sx={{ width: { xs: '100%', sm: '35%', md: '30%' }, borderRight: { sm: '1px solid' }, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <Typography variant="h6">Agent Personas</Typography>
            <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => setIsAddDialogOpen(true)}>Add</Button>
          </Box>
          <List component="nav" sx={{ overflowY: 'auto', flexGrow: 1 }}>
            {prompts.map(prompt => (
              <ListItemButton key={prompt.id} selected={selectedPrompt?.id === prompt.id} onClick={() => handleSelectPrompt(prompt)}>
                <ListItemText primary={prompt.name} secondary={prompt.description} secondaryTypographyProps={{ noWrap: true, fontSize: '0.8rem' }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedPrompt ? (
            <>
              <Box sx={{ flexShrink: 0 }}>
                <Typography variant="h5">{selectedPrompt.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ID: <code>{selectedPrompt.agent_id}</code>
                </Typography>
              </Box>
              <TextField
                label="System Prompt"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                multiline
                fullWidth
                sx={{ flexGrow: 1, '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' }, '& .MuiInputBase-input': { height: '100% !important', overflowY: 'auto !important' } }}
              />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <Button variant="contained" onClick={handleSaveChanges} disabled={isUpdatingPrompt}>
                  {isUpdatingPrompt ? <CircularProgress size={24} /> : `Save Persona`}
                </Button>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">No agent personas found. Click &quot;Add&quot; to create one.</Typography>
            </Box>
          )}
        </Box>
      </Paper>
      <AddPromptDialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onSubmit={handleAddPrompt} isAdding={isAddingPrompt} />
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