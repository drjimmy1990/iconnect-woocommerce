'use client';

import React from 'react';
import { Grid, Paper, Typography, Box, Skeleton } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { DashboardSummary, ChannelPerformance } from '@/hooks/useAnalytics';
import ChatIcon from '@mui/icons-material/Chat';
import SmartToyIcon from '@mui/icons-material/SmartToy';

interface DashboardMetricsGridProps {
    data?: DashboardSummary;
    channelPerformance?: ChannelPerformance[];
    selectedChannelId?: string | null;
    isLoading: boolean;
}

// Gradient definitions for icon backgrounds
const gradients = {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    secondary: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    purple: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

export default function DashboardMetricsGrid({ data, channelPerformance, selectedChannelId, isLoading }: DashboardMetricsGridProps) {
    // Filter channel performance data
    const filteredChannels = React.useMemo(() => {
        if (!channelPerformance) return [];
        if (selectedChannelId) {
            return channelPerformance.filter(c => c.channel_id === selectedChannelId);
        }
        return channelPerformance;
    }, [channelPerformance, selectedChannelId]);

    // Calculate aggregated metrics
    const commsMetrics = React.useMemo(() => {
        const totalMessages = filteredChannels.reduce((sum, ch) => sum + (ch.total_messages || 0), 0);
        const totalContacts = filteredChannels.reduce((sum, ch) => sum + (ch.total_contacts || 0), 0);
        const totalAiResponses = filteredChannels.reduce((sum, ch) => sum + (ch.ai_responses || 0), 0);

        const aiResponseRate = totalMessages > 0 ? ((totalAiResponses / totalMessages) * 100).toFixed(0) : '0';

        return { totalMessages, totalContacts, aiResponseRate };
    }, [filteredChannels]);

    // Compact metric card component
    const MetricCard = ({
        label,
        value,
        gradient,
        icon
    }: {
        label: string;
        value: string | number;
        gradient: string;
        icon: React.ReactNode;
    }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                transition: 'all 0.2s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
                }
            }}
        >
            <Box
                sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    background: gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                }}
            >
                {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        mb: 0.25
                    }}
                >
                    {label}
                </Typography>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 700,
                        fontSize: '1.5rem',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {value}
                </Typography>
            </Box>
        </Paper>
    );

    if (isLoading) {
        return (
            <Grid container spacing={2} mb={3}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                    <Grid size={{ xs: 6, sm: 4, md: 4 }} key={item}>
                        <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 3 }} />
                    </Grid>
                ))}
            </Grid>
        );
    }

    const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EGP',
        maximumFractionDigits: 0
    }).format(v);

    const formatNumber = (v: number) => new Intl.NumberFormat('en-US').format(v);

    return (
        <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="Revenue"
                    value={formatCurrency(data?.total_revenue ?? 0)}
                    gradient={gradients.primary}
                    icon={<MonetizationOnIcon fontSize="small" />}
                />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="Leads"
                    value={formatNumber(data?.total_leads ?? 0)}
                    gradient={gradients.success}
                    icon={<PeopleIcon fontSize="small" />}
                />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="Avg Order"
                    value={formatCurrency(data?.avg_order_value ?? 0)}
                    gradient={gradients.info}
                    icon={<TrendingUpIcon fontSize="small" />}
                />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="Tasks"
                    value={formatNumber(data?.pending_activities ?? 0)}
                    gradient={gradients.warning}
                    icon={<AssignmentIcon fontSize="small" />}
                />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="Messages"
                    value={formatNumber(commsMetrics.totalMessages)}
                    gradient={gradients.secondary}
                    icon={<ChatIcon fontSize="small" />}
                />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <MetricCard
                    label="AI Rate"
                    value={`${commsMetrics.aiResponseRate}%`}
                    gradient={gradients.purple}
                    icon={<SmartToyIcon fontSize="small" />}
                />
            </Grid>
        </Grid>
    );
}
