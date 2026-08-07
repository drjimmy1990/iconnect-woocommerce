// src/components/crm/tabs/ClientTimeline.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Snackbar, Alert } from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineOppositeContent, TimelineDot } from '@mui/lab';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AddTaskIcon from '@mui/icons-material/AddTask';
import NoteIcon from '@mui/icons-material/Note';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CallIcon from '@mui/icons-material/Call';
import EmailIcon from '@mui/icons-material/Email';
import { CrmNote, CrmActivity, CrmClient } from '@/lib/api';
import { useClient, AddNotePayload } from '@/hooks/useClient';
import NoteDialog from '../NoteDialog';

interface ClientTimelineProps {
  client: CrmClient;
  notes: CrmNote[];
  activities: CrmActivity[];
}

type TimelineEvent = (CrmNote & { type: 'note' }) | (CrmActivity & { type: 'activity' });

const getEventIcon = (event: TimelineEvent) => {
  if (event.type === 'note') return <NoteIcon />;
  switch (event.activity_type) {
    case 'call': return <CallIcon />;
    case 'email': return <EmailIcon />;
    case 'task': return <TaskAltIcon />;
    default: return <TaskAltIcon />;
  }
};

export default function ClientTimeline({ client, notes, activities }: ClientTimelineProps) {
  const [isNoteDialogOpen, setNoteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
  const { addNote, isAddingNote } = useClient(client.id);

  const handleAddNote = (noteData: AddNotePayload) => {
    addNote(noteData, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Note added successfully!', severity: 'success' });
        setNoteDialogOpen(false);
      },
      onError: (err: Error) => {
        setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
      },
    });
  };

  const timelineEvents = useMemo(() => {
    // --- THIS IS THE SIMPLIFICATION ---
    // No filtering is needed anymore. We just combine notes and activities.
    const combined: TimelineEvent[] = [
      ...notes.map(n => ({ ...n, type: 'note' as const })),
      ...activities.map(a => ({ ...a, type: 'activity' as const })),
    ];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined;
  }, [notes, activities]);

  const formatDate = (dateString: string) => { return new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
          <Typography variant="h6">Client History</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<NoteAddIcon />} size="small" onClick={() => setNoteDialogOpen(true)}>
              Add Note
            </Button>
            <Button variant="outlined" startIcon={<AddTaskIcon />} size="small" disabled>
              Log Activity
            </Button>
          </Box>
        </Box>

        {timelineEvents.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 5 }}>
            No manual notes or activities have been recorded for this client yet.
          </Typography>
        ) : (
          <Timeline position="right">
            {timelineEvents.map((event, index) => (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ display: { xs: 'none', md: 'block' }, m: 'auto 0' }} align="right" variant="body2" color="text.secondary">
                  {formatDate(event.created_at)}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineConnector />
                  <TimelineDot color={event.type === 'note' ? 'grey' : 'primary'}>
                    {getEventIcon(event)}
                  </TimelineDot>
                  {index < timelineEvents.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" component="span">{event.type === 'note' ? (event.title || 'Note') : event.subject}</Typography>
                    <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}>{formatDate(event.created_at)}</Typography>
                    <Typography>{event.type === 'note' ? event.content : event.description}</Typography>
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Paper>

      <NoteDialog
        open={isNoteDialogOpen}
        onClose={() => setNoteDialogOpen(false)}
        onSubmit={handleAddNote}
        isSubmitting={isAddingNote}
      />

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