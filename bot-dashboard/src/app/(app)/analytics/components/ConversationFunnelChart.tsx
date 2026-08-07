'use client';

import React from 'react';
import { Paper, Typography, Box, useTheme, Skeleton, Chip } from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList,
} from 'recharts';
import { ConversationFunnelStep } from '@/hooks/useAnalytics';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

interface ConversationFunnelChartProps {
    data?: ConversationFunnelStep[];
    isLoading: boolean;
    height?: number | string;
}

const STAGE_LABELS: Record<string, string> = {
    'first_contact': 'First Contact',
    'bmi_collected': 'BMI Collected',
    'testimonials_viewed': 'Testimonials',
    'price_viewed': 'Price Viewed',
    'purchased': 'Purchased',
};

const STAGE_COLORS = [
    '#667eea',  // first_contact — purple-blue
    '#4facfe',  // bmi_collected — sky blue
    '#38ef7d',  // testimonials_viewed — green
    '#f5576c',  // price_viewed — coral
    '#11998e',  // purchased — teal
];

export default function ConversationFunnelChart({ data, isLoading, height = 400 }: ConversationFunnelChartProps) {
    const theme = useTheme();

    if (isLoading) {
        return (
            <Paper elevation={0} sx={{ p: 3, height: height, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Skeleton variant="text" width="50%" height={32} sx={{ mb: 2 }} />
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
                <TrendingDownIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Funnel Data Yet
                </Typography>
                <Typography variant="body2" color="text.disabled" textAlign="center">
                    Conversation stage tracking will appear here once the bot starts updating client stages.
                </Typography>
            </Paper>
        );
    }

    const chartData = data.map((step, i) => ({
        ...step,
        label: STAGE_LABELS[step.stage] || step.stage,
        fill: STAGE_COLORS[i % STAGE_COLORS.length],
    }));

    // Calculate overall conversion rate
    const firstStage = data[0]?.total || 0;
    const lastStage = data[data.length - 1]?.total || 0;
    const overallRate = firstStage > 0 ? ((lastStage / firstStage) * 100).toFixed(1) : '0';

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                transition: 'box-shadow 0.2s',
                '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Conversation Funnel
                </Typography>
                <Chip
                    label={`${overallRate}% overall conversion`}
                    color={Number(overallRate) > 10 ? 'success' : 'warning'}
                    size="small"
                    variant="outlined"
                />
            </Box>

            {/* Funnel chart */}
            <Box sx={{ height: height, minHeight: height, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="label"
                            type="category"
                            width={120}
                            tick={{ fontSize: 13, fill: theme.palette.text.primary, fontWeight: 500 }}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8,
                                padding: '12px 16px',
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any, _name: any, props: any) => {
                                const step = props?.payload;
                                if (!step) return [String(value), ''];
                                return [
                                    `${value} clients — ${step.completed} continued, ${step.dropped} dropped (${step.completion_rate}% rate)`,
                                    step.label
                                ];
                            }}
                        />
                        <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={36}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                            <LabelList
                                dataKey="total"
                                position="right"
                                fill={theme.palette.text.primary}
                                fontSize={13}
                                fontWeight={600}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Box>

            {/* Drop-off summary row */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {data.slice(0, -1).map((step, i) => (
                    <Chip
                        key={step.stage}
                        icon={<ArrowDownwardIcon />}
                        label={`${STAGE_LABELS[step.stage]} → ${STAGE_LABELS[data[i + 1].stage]}: ${step.completion_rate}%`}
                        size="small"
                        variant="outlined"
                        color={step.completion_rate >= 50 ? 'success' : step.completion_rate >= 25 ? 'warning' : 'error'}
                        sx={{ fontSize: '0.75rem' }}
                    />
                ))}
            </Box>
        </Paper>
    );
}
