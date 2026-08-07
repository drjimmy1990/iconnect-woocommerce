/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { Paper, Typography, Box, Skeleton } from '@mui/material';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { ChannelPerformance } from '@/hooks/useAnalytics';
import CellTowerIcon from '@mui/icons-material/CellTower';

interface ChannelPerformanceProps {
    data?: ChannelPerformance[];
    isLoading: boolean;
    height?: number | string;
}

export default function ChannelPerformanceChart({ data, isLoading, height = 350 }: ChannelPerformanceProps) {

    const COLORS = [
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#3b82f6', // Blue
    ];

    if (isLoading) {
        return (
            <Paper elevation={0} sx={{ p: 3, height: height, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
                    <Skeleton variant="circular" width={180} height={180} />
                </Box>
            </Paper>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    height: height,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: 'background.default'
                }}
            >
                <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'info.main', opacity: 0.1, mb: 2 }}>
                    <CellTowerIcon sx={{ fontSize: 48, color: 'info.main', opacity: 1 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Channel Data Yet
                </Typography>
                <Typography variant="body2" color="text.disabled" textAlign="center">
                    Connect channels to see performance metrics.
                </Typography>
            </Paper>
        );
    }

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
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Channel Volume
            </Typography>
            <Box sx={{ height: height, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 25, left: 0 }}>
                        <Pie
                            data={data as any[]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius="80%"
                            fill="#8884d8"
                            dataKey="total_messages"
                            nameKey="channel_name"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <Paper sx={{ p: 1.5 }}>
                                            <Typography variant="subtitle2">{d.channel_name}</Typography>
                                            <Typography variant="body2" color="textSecondary">Total: {d.total_messages}</Typography>
                                            <Box sx={{ mt: 1 }}>
                                                <Typography variant="caption" display="block">Incoming: {d.incoming_messages}</Typography>
                                                <Typography variant="caption" display="block">Agent: {d.agent_responses}</Typography>
                                                <Typography variant="caption" display="block">AI: {d.ai_responses}</Typography>
                                            </Box>
                                        </Paper>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
    );
}
