'use client';

import React from 'react';
import { Paper, Typography, Box, Grid, CircularProgress, Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import { useChatbotEffectiveness } from '@/hooks/useAnalytics';
import { useOrganization } from '@/hooks/useOrganization';

interface ChatbotAnalyticsProps {
    selectedChannelId?: string | null;
}

export default function ChatbotAnalytics({ selectedChannelId }: ChatbotAnalyticsProps) {
    const { data: orgId } = useOrganization();
    const { data, isLoading } = useChatbotEffectiveness(orgId || '', selectedChannelId);

    if (isLoading) {
        return (
            <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography color="textSecondary">Loading AI analytics...</Typography>
            </Paper>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h6" gutterBottom>Chatbot Effectiveness</Typography>
                <Typography color="textSecondary">No AI interaction data available yet.</Typography>
            </Paper>
        );
    }

    // Calculate aggregates
    const totalInteractions = data.reduce((sum, item) => sum + item.total_chatbot_interactions, 0);
    const totalSuccessful = data.reduce((sum, item) => sum + item.successful_interactions, 0);
    const totalEngaged = data.reduce((sum, item) => sum + item.unique_clients_engaged, 0);

    // Weighted average for duration
    const totalDuration = data.reduce((sum, item) => sum + (item.avg_interaction_duration_minutes * item.total_chatbot_interactions), 0);
    const avgDuration = totalInteractions > 0 ? totalDuration / totalInteractions : 0;

    const resolutionRate = totalInteractions > 0 ? (totalSuccessful / totalInteractions) * 100 : 0;

    const metrics = [
        {
            label: 'Resolution Rate',
            value: `${resolutionRate.toFixed(1)}%`,
            icon: <CheckCircleIcon color="success" />,
            desc: 'Interactions resolved by AI'
        },
        {
            label: 'Avg. Handling Time',
            value: `${avgDuration.toFixed(1)}m`,
            icon: <TimerIcon color="info" />,
            desc: 'Average duration per chat'
        },
        {
            label: 'Total Interactions',
            value: totalInteractions,
            icon: <SmartToyIcon color="primary" />,
            desc: 'Total AI messages sent'
        },
        {
            label: 'Engaged Clients',
            value: totalEngaged,
            icon: <PeopleIcon color="secondary" />,
            desc: 'Unique clients served'
        }
    ];

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                transition: 'box-shadow 0.2s',
                '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }
            }}
        >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Chatbot Effectiveness
            </Typography>
            <Divider sx={{ mb: 3, mt: 2 }} />

            <Grid container spacing={2}>
                {metrics.map((metric) => (
                    <Grid size={{ xs: 6 }} key={metric.label}>
                        <Box
                            sx={{
                                p: 2.5,
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                height: '100%',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {React.isValidElement(metric.icon) ? React.cloneElement(metric.icon as React.ReactElement<any>, { fontSize: 'small' }) : metric.icon}
                                </Box>
                                <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 600, fontSize: '0.85rem' }}>
                                    {metric.label}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, fontSize: '1.75rem' }}>
                                {metric.value}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                                {metric.desc}
                            </Typography>
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Paper>
    );
}
