'use client';

import React, { useState } from 'react';
import { Box, Typography, Switch, FormControlLabel, List, ListItem, ListItemText, ListItemIcon, Chip, Paper, CircularProgress, Divider } from '@mui/material';
import { useParams } from 'next/navigation';
import { useClientTimeline } from '@/hooks/useClientTimeline';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import NoteIcon from '@mui/icons-material/Note';
import TaskIcon from '@mui/icons-material/Assignment';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ChatIcon from '@mui/icons-material/Chat';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { formatDistanceToNow } from 'date-fns';

export default function ClientTimeline() {
    const params = useParams();
    const clientId = params.id as string;
    const { data: timelineItems, isLoading, error } = useClientTimeline(clientId);

    const [showMessages, setShowMessages] = useState(false);
    const [filter, setFilter] = useState<'all' | 'note' | 'call' | 'deal'>('all');

    if (isLoading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Typography color="error">Failed to load timeline.</Typography></Box>;

    const filteredItems = timelineItems?.filter((item) => {
        // 1. Filter by Type (Activity vs Message) based on Toggle
        if (item.type === 'message' && !showMessages) return false;

        // 2. Filter by Specific Activity Type
        if (filter === 'all') return true;
        if (item.type === 'activity') {
            if (filter === 'note' && item.data.activity_type === 'note') return true;
            if (filter === 'call' && item.data.activity_type === 'call') return true;
            // Add deal logic if activity_type distinguishes deals, or check deal_id
            if (filter === 'deal' && item.data.deal_id) return true;
        }
        return false;
    });

    const getActivityIcon = (type: string, priority?: string) => {
        if (priority === 'urgent') return <PriorityHighIcon color="error" />;
        switch (type) {
            case 'call': return <PhoneIcon color="primary" />;
            case 'email': return <EmailIcon color="action" />;
            case 'note': return <NoteIcon color="warning" />;
            case 'task': return <TaskIcon color="success" />;
            default: return <NoteIcon />;
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Activity Timeline</Typography>
                <FormControlLabel
                    control={<Switch checked={showMessages} onChange={(e) => setShowMessages(e.target.checked)} />}
                    label="Show Messages"
                />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <Chip label="All" onClick={() => setFilter('all')} color={filter === 'all' ? 'primary' : 'default'} />
                <Chip label="Notes" onClick={() => setFilter('note')} color={filter === 'note' ? 'primary' : 'default'} />
                <Chip label="Calls" onClick={() => setFilter('call')} color={filter === 'call' ? 'primary' : 'default'} />
                <Chip label="Deals" onClick={() => setFilter('deal')} color={filter === 'deal' ? 'primary' : 'default'} />
            </Box>

            <Paper variant="outlined">
                <List>
                    {filteredItems?.map((item, index) => (
                        <React.Fragment key={`${item.type}-${item.type === 'activity' ? item.data.id : item.data.id}`}>
                            {index > 0 && <Divider component="li" />}
                            <ListItem
                                alignItems="flex-start"
                                sx={
                                    (item.type === 'activity' && item.data.priority === 'urgent')
                                        ? {
                                            bgcolor: 'error.lighter',
                                            borderLeft: '4px solid',
                                            borderColor: 'error.main',
                                            pl: 2
                                        }
                                        : {}
                                }
                            >
                                <ListItemIcon>
                                    {item.type === 'activity' ? (
                                        getActivityIcon(item.data.activity_type, item.data.priority ?? undefined)
                                    ) : (
                                        item.data.sender_type === 'ai' ? <SmartToyIcon color="secondary" /> : <ChatIcon color="info" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="subtitle2" component="span">
                                                {item.type === 'activity' ? item.data.subject : (item.data.sender_type === 'user' ? 'Client Message' : 'Agent/AI Message')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <React.Fragment>
                                            <Typography
                                                sx={{ display: 'inline' }}
                                                component="span"
                                                variant="body2"
                                                color="text.primary"
                                            >
                                                {item.type === 'activity' ? (
                                                    item.data.description || 'No description'
                                                ) : (
                                                    item.data.text_content || 'Media message'
                                                )}
                                            </Typography>
                                            {item.type === 'activity' && item.data.assigned_to && (
                                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                    <PersonIcon fontSize="inherit" color="disabled" />
                                                    <Typography variant="caption" color="text.secondary">
                                                        Assigned to user
                                                    </Typography>
                                                </Box>
                                            )}
                                        </React.Fragment>
                                    }
                                />
                            </ListItem>
                        </React.Fragment>
                    ))}
                    {filteredItems?.length === 0 && (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography color="text.secondary">No activities found.</Typography>
                        </Box>
                    )}
                </List>
            </Paper>
        </Box>
    );
}
