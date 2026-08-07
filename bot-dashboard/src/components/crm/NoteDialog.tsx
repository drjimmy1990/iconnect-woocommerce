// src/components/crm/NoteDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { CrmNote } from '@/lib/api';
import { AddNotePayload } from '@/hooks/useClient';

interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (noteData: AddNotePayload) => void;
  isSubmitting: boolean;
  note?: CrmNote | null; // Optional: Pass an existing note to edit it
}

const initialState: AddNotePayload = {
  title: '',
  content: '',
  note_type: 'general',
  is_pinned: false,
  tags: [],
  deal_id: null, // Not implemented yet, but good to have
};

export default function NoteDialog({ open, onClose, onSubmit, isSubmitting, note }: NoteDialogProps) {
  const [formData, setFormData] = useState(initialState);

  // If a note is passed for editing, pre-fill the form
  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title || '',
        content: note.content || '',
        note_type: note.note_type || 'general',
        is_pinned: note.is_pinned || false,
        tags: note.tags || [],
        deal_id: note.deal_id || null,
      });
    } else {
      setFormData(initialState);
    }
  }, [note, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.content.trim()) {
      onSubmit(formData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ component: 'form', onSubmit: handleSubmit }}>
      <DialogTitle>{note ? 'Edit Note' : 'Add New Note'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          name="content"
          label="Note Content"
          value={formData.content}
          onChange={handleChange}
          fullWidth
          required
          multiline
          rows={6}
          helperText="Add your notes about the client interaction here."
          sx={{ mt: 1 }}
        />
        <TextField
          margin="dense"
          name="title"
          label="Optional Title"
          value={formData.title}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          name="note_type"
          label="Note Type"
          value={formData.note_type}
          onChange={handleChange}
          select
          fullWidth
          size="small"
        >
          <MenuItem value="general">General</MenuItem>
          <MenuItem value="call_log">Call Log</MenuItem>
          <MenuItem value="meeting_summary">Meeting Summary</MenuItem>
          <MenuItem value="important">Important</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting || !formData.content.trim()}>
          {isSubmitting ? <CircularProgress size={24} /> : (note ? 'Save Changes' : 'Add Note')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}