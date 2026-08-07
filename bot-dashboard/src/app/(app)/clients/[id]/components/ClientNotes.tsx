'use client';

import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Paper, List, CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useClient } from '@/hooks/useClient';
import AddIcon from '@mui/icons-material/Add';
import PushPinIcon from '@mui/icons-material/PushPin';
import { formatDistanceToNow } from 'date-fns';

export default function ClientNotes() {
    const params = useParams();
    const clientId = params.id as string;
    const { clientData, addNote, isAddingNote } = useClient(clientId);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAddNote = () => {
        if (!newNoteContent.trim()) return;

        addNote({
            content: newNoteContent,
            title: 'Note', // Optional title
            note_type: 'general',
            is_pinned: false,
            tags: [],
            deal_id: null,
        }, {
            onSuccess: () => {
                setNewNoteContent('');
                setIsAdding(false);
            }
        });
    };

    if (!clientData) return <CircularProgress />;

    const { notes } = clientData;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Notes</Typography>
                <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    onClick={() => setIsAdding(!isAdding)}
                >
                    Add Note
                </Button>
            </Box>

            {isAdding && (
                <Paper sx={{ p: 2, mb: 3 }}>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Write a note..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={handleAddNote}
                            disabled={isAddingNote || !newNoteContent.trim()}
                        >
                            {isAddingNote ? 'Saving...' : 'Save Note'}
                        </Button>
                    </Box>
                </Paper>
            )}

            <List>
                {notes.map((note) => (
                    <Paper key={note.id} sx={{ mb: 2, p: 2 }} variant="outlined">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {note.is_pinned && <PushPinIcon fontSize="small" color="primary" />}
                                <Typography variant="subtitle2" fontWeight="bold">
                                    {note.title || 'Note'}
                                </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                            </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {note.content}
                        </Typography>
                    </Paper>
                ))}
                {notes.length === 0 && !isAdding && (
                    <Typography color="text.secondary" textAlign="center">No notes yet.</Typography>
                )}
            </List>
        </Box>
    );
}
