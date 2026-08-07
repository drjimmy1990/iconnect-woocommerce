'use client';

import React from 'react';
import { Grid, Paper, Typography, Box, Skeleton, useTheme } from '@mui/material';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from 'recharts';
import { useOrganization } from '@/hooks/useOrganization';
import { useClientTypeDistribution, useConversationFunnel } from '@/hooks/useAnalytics';
import ConversationFunnelChart from './ConversationFunnelChart';
import PeopleIcon from '@mui/icons-material/People';

const TYPE_COLORS: Record<string, string> = {
    new: '#4facfe',
    interested: '#667eea',
    customer: '#11998e',
    repeat_customer: '#38ef7d',
    inactive: '#ccc',
};

const TYPE_LABELS: Record<string, string> = {
    new: 'New',
    interested: 'Interested',
    customer: 'Customer',
    repeat_customer: 'Repeat Customer',
    inactive: 'Inactive',
};

interface ClientMetricsProps {
    selectedChannelId?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
}

export default function ClientMetrics({ selectedChannelId, startDate, endDate }: ClientMetricsProps) {
    const theme = useTheme();
    const { data: orgId } = useOrganization();
    const { data: clientTypes, isLoading: isTypesLoading } = useClientTypeDistribution(
        orgId || '', selectedChannelId, startDate, endDate
    );
    const { data: conversationFunnel, isLoading: isFunnelLoading } = useConversationFunnel(
        orgId || '', selectedChannelId, startDate, endDate
    );

    const pieData = (clientTypes || []).map(item => ({
        name: TYPE_LABELS[item.client_type] || item.client_type,
        value: item.count,
        color: TYPE_COLORS[item.client_type] || '#999',
    }));

    const totalClients = pieData.reduce((sum, item) => sum + item.value, 0);

    return (
        <Grid container spacing={3}>
            {/* Client Type Distribution */}
            <Grid size={{ xs: 12, md: 5 }}>
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
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon color="primary" />
                        Client Types
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {totalClients} total clients
                    </Typography>

                    {isTypesLoading ? (
                        <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
                    ) : pieData.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.disabled">No client data yet</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: 8,
                                        }}
                                        formatter={(value: number) => [
                                            `${value} (${totalClients > 0 ? ((value / totalClients) * 100).toFixed(1) : 0}%)`,
                                            'Clients'
                                        ]}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value) => (
                                            <span style={{ color: theme.palette.text.primary, fontSize: '0.85rem' }}>
                                                {value}
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                    )}
                </Paper>
            </Grid>

            {/* Conversation Funnel */}
            <Grid size={{ xs: 12, md: 7 }}>
                <ConversationFunnelChart data={conversationFunnel} isLoading={isFunnelLoading} height={300} />
            </Grid>
        </Grid>
    );
}
