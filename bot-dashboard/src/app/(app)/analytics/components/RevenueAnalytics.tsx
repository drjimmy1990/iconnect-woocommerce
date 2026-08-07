'use client';

import React from 'react';
import { Paper, Typography, Box, useTheme, Skeleton } from '@mui/material';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { RevenueMetric } from '@/hooks/useAnalytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface RevenueAnalyticsProps {
    data?: RevenueMetric[];
    isLoading: boolean;
    height?: number | string;
}

export default function RevenueAnalytics({ data, isLoading, height = 350 }: RevenueAnalyticsProps) {
    const theme = useTheme();

    if (isLoading) {
        return (
            <Paper elevation={0} sx={{ p: 3, height: height, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height="80%" sx={{ borderRadius: 2 }} />
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
                <Box
                    sx={{
                        p: 2,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        opacity: 0.1,
                        mb: 2
                    }}
                >
                    <TrendingUpIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 1 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Revenue Data Yet
                </Typography>
                <Typography variant="body2" color="text.disabled" textAlign="center">
                    Revenue trends will appear here once deals are closed.
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
                Revenue Trends
            </Typography>
            <Box sx={{ height: height, minHeight: height, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 25,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis
                            dataKey="date"
                            stroke={theme.palette.text.secondary}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        />
                        <YAxis
                            stroke={theme.palette.text.secondary}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8
                            }}
                            formatter={(value) => value !== undefined ? [`$${value}`, 'Revenue'] : ['N/A', 'Revenue']}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke={theme.palette.primary.main}
                            strokeWidth={3}
                            activeDot={{ r: 8 }}
                            name="Revenue"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
    );
}
