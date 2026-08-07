'use client';

import React from 'react';
import { Paper, Typography, Box, useTheme, Skeleton } from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { ConversionFunnelStep } from '@/hooks/useAnalytics';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

interface ConversionFunnelProps {
    data?: ConversionFunnelStep[];
    isLoading: boolean;
    height?: number | string;
}

export default function ConversionFunnel({ data, isLoading, height = 350 }: ConversionFunnelProps) {
    const theme = useTheme();

    // Colors for funnel stages
    const COLORS = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.secondary.light,
        theme.palette.secondary.main,
        theme.palette.success.light,
        theme.palette.success.main,
    ];

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
                <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'secondary.main', opacity: 0.1, mb: 2 }}>
                    <FilterAltIcon sx={{ fontSize: 48, color: 'secondary.main', opacity: 1 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Funnel Data Yet
                </Typography>
                <Typography variant="body2" color="text.disabled" textAlign="center">
                    Track your lead conversion pipeline here.
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
                Conversion Funnel
            </Typography>
            <Box sx={{ height: height, minHeight: height, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{
                            top: 5,
                            right: 30,
                            left: 40,
                            bottom: 25,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="stage"
                            type="category"
                            width={100}
                            tick={{ fontSize: 12, fill: theme.palette.text.primary }}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8
                            }}
                            formatter={(value, name, props) => {
                                if (value === undefined) return ['N/A', 'Clients'];
                                const rate = props.payload?.conversion_rate || 0;
                                return [`${value} (${rate}%)`, 'Clients'];
                            }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={40}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
    );
}
