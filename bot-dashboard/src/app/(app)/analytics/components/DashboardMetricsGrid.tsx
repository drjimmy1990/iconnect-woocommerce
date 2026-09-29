'use client';

import React from 'react';
import { Grid, Paper, Typography, Box, Skeleton, Chip } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { DashboardSummary, ChannelPerformance } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/utils/currency';

interface DashboardMetricsGridProps {
    data?: DashboardSummary;
    channelPerformance?: ChannelPerformance[];
    selectedChannelId?: string | null;
    isLoading: boolean;
}

// Elevated gradient tokens
const gradients = {
    revenue: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
    leads: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    avgOrder: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
    tasks: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    messages: 'linear-gradient(135deg, #C026D3 0%, #EC4899 100%)',
    ai: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
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

    // Luxury Metric Card
    const MetricCard = ({
        label,
        value,
        subtitle,
        gradient,
        icon,
        badgeText,
        badgeColor = 'default'
    }: {
        label: string;
        value: string | number;
        subtitle: string;
        gradient: string;
        icon: React.ReactNode;
        badgeText?: string;
        badgeColor?: 'success' | 'primary' | 'warning' | 'info' | 'default';
    }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.25,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid',
                borderColor: 'rgba(226, 232, 240, 0.8)',
                borderRadius: 3.5,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: 'primary.light',
                    boxShadow: '0 12px 28px -6px rgba(79, 70, 229, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
                }
            }}
        >
            {/* Top row: Label & Icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                        }}
                    >
                        {label}
                    </Typography>
                    {badgeText && (
                        <Box sx={{ mt: 0.5 }}>
                            <Chip
                                label={badgeText}
                                size="small"
                                color={badgeColor}
                                sx={{
                                    height: 18,
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    borderRadius: 1,
                                    px: 0.25
                                }}
                            />
                        </Box>
                    )}
                </Box>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2.5,
                        background: gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 6px 16px -2px rgba(15, 23, 42, 0.18)',
                        flexShrink: 0
                    }}
                >
                    {icon}
                </Box>
            </Box>

            {/* Bottom row: Value & Subtitle */}
            <Box>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 800,
                        fontSize: '1.65rem',
                        lineHeight: 1.15,
                        color: '#0F172A',
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {value}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: 'block',
                        mt: 0.5,
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        color: '#64748B'
                    }}
                >
                    {subtitle}
                </Typography>
            </Box>
        </Paper>
    );

    if (isLoading) {
        return (
            <Grid container spacing={2.5} mb={3}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item}>
                        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 3.5 }} />
                    </Grid>
                ))}
            </Grid>
        );
    }

    const formatNumber = (v: number) => new Intl.NumberFormat('en-US').format(v);

    return (
        <Grid container spacing={2.5} mb={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="Store Revenue"
                    value={formatCurrency(data?.total_revenue ?? 0)}
                    subtitle="WooCommerce synced sales"
                    gradient={gradients.revenue}
                    icon={<MonetizationOnIcon fontSize="small" />}
                    badgeText="Live Synced"
                    badgeColor="primary"
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="Total Leads"
                    value={formatNumber(data?.total_leads ?? 0)}
                    subtitle="Active CRM customer prospects"
                    gradient={gradients.leads}
                    icon={<PeopleIcon fontSize="small" />}
                    badgeText="Pipeline"
                    badgeColor="success"
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="Average Order"
                    value={formatCurrency(data?.avg_order_value ?? 0)}
                    subtitle="Mean checkout basket size"
                    gradient={gradients.avgOrder}
                    icon={<TrendingUpIcon fontSize="small" />}
                    badgeText="AOV"
                    badgeColor="info"
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="Pending Actions"
                    value={formatNumber(data?.pending_activities ?? 0)}
                    subtitle="Tasks & follow-ups scheduled"
                    gradient={gradients.tasks}
                    icon={<AssignmentIcon fontSize="small" />}
                    badgeText={Number(data?.pending_activities ?? 0) > 0 ? 'Action Needed' : 'All Clear'}
                    badgeColor={Number(data?.pending_activities ?? 0) > 0 ? 'warning' : 'default'}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="Omnichannel Messages"
                    value={formatNumber(commsMetrics.totalMessages)}
                    subtitle="Across WhatsApp, IG & FB"
                    gradient={gradients.messages}
                    icon={<ChatIcon fontSize="small" />}
                    badgeText="Channels"
                    badgeColor="default"
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MetricCard
                    label="AI Copilot Handled"
                    value={`${commsMetrics.aiResponseRate}%`}
                    subtitle="Autonomous response rate"
                    gradient={gradients.ai}
                    icon={<AutoAwesomeIcon fontSize="small" />}
                    badgeText="AI Active"
                    badgeColor="success"
                />
            </Grid>
        </Grid>
    );
}
