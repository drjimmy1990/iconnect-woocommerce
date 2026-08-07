'use client';

import React, { useState } from 'react';
import { Box, Typography, Button, Grid, Tab, Tabs, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent, Paper } from '@mui/material';

import RefreshIcon from '@mui/icons-material/Refresh';
import {
    useDashboardSummary,
    useRevenueMetrics,
    useConversionFunnel,
    useChannelPerformance,
    useMessageVolumeTrends,
    useAnalyticsControl
} from '@/hooks/useAnalytics';
import { useChannels } from '@/hooks/useChannels';
import { useOrganization } from '@/hooks/useOrganization';

import DashboardMetricsGrid from './components/DashboardMetricsGrid';
import RevenueAnalytics from './components/RevenueAnalytics';
import ConversionFunnel from './components/ConversionFunnel';

import ChannelPerformanceChart from './components/ChannelPerformance';
import ChatbotAnalytics from './components/ChatbotAnalytics';
import ClientMetrics from './components/ClientMetrics';
import MessageDistributionChart from './components/MessageDistributionChart';
import DateRangePicker, { DateRangeOption } from './components/DateRangePicker';
import ExportButton from './components/ExportButton';

// ... (Keep TabPanel and helper functions as they are) ...
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

export default function AnalyticsPage() {
    const { data: orgId } = useOrganization();
    const [tabValue, setTabValue] = useState(0);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

    // --- DATE STATE ---
    const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
    const [customStart, setCustomStart] = useState<Date | null>(null);
    const [customEnd, setCustomEnd] = useState<Date | null>(null);

    // --- DATE LOGIC ---
    const { startDate, endDate } = React.useMemo(() => {
        const now = new Date();
        // Base setup: End of today
        now.setHours(23, 59, 59, 999);

        let start: Date | null = null;
        let end: Date | null = now;

        if (dateRange === 'yesterday') {
            // Yesterday Start
            start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);

            // Yesterday End
            end = new Date(now);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);

        } else if (dateRange === '7d') {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);

        } else if (dateRange === '30d') {
            start = new Date(now);
            start.setDate(now.getDate() - 30);
            start.setHours(0, 0, 0, 0);

        } else if (dateRange === '90d') {
            start = new Date(now);
            start.setDate(now.getDate() - 90);
            start.setHours(0, 0, 0, 0);

        } else if (dateRange === 'custom') {
            // Use the specific custom pickers
            start = customStart ? new Date(customStart) : null;
            if (start) start.setHours(0, 0, 0, 0);

            end = customEnd ? new Date(customEnd) : null;
            if (end) end.setHours(23, 59, 59, 999);
        } else {
            // 'all' or 'year' (Year logic can be added, currently treating as null/null for API)
            start = null;
            end = null;
        }
        return { startDate: start, endDate: end };
    }, [dateRange, customStart, customEnd]);

    // Fetch data (This remains exactly the same, it just uses the new start/end dates)
    const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useDashboardSummary(orgId || '', selectedChannelId || null, startDate, endDate);
    const { data: revenue, isLoading: isRevenueLoading } = useRevenueMetrics(orgId || '', period, selectedChannelId || null, startDate, endDate);
    const { data: funnel, isLoading: isFunnelLoading } = useConversionFunnel(orgId || '', selectedChannelId || null, startDate, endDate);
    const { data: channelPerformance, isLoading: isChannelLoading } = useChannelPerformance(orgId || '', startDate, endDate);
    const { data: messageTrends } = useMessageVolumeTrends(orgId || '', period, selectedChannelId || null, startDate, endDate);
    const { channels } = useChannels();
    const { refreshAnalytics } = useAnalyticsControl();

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleRefresh = async () => {
        try {
            await refreshAnalytics();
            refetchSummary();
            window.location.reload();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // Log the full error message and details to the console
            console.error('Failed to refresh analytics:', error.message || error);
            // Optionally alert the user
            alert(`Failed to refresh: ${error.message || 'Unknown error'}`);
        }
    };

    const handleChannelChange = (event: SelectChangeEvent) => {
        setSelectedChannelId(event.target.value);
    };

    return (
        <Box sx={{ p: 3, maxWidth: '100%', mx: 'auto', width: '100%' }}>
            {/* Header Section */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                    Analytics Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Track your business performance and customer insights
                </Typography>
            </Box>

            {/* Filter Bar - Styled as a cohesive control panel */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: 'background.default'
                }}
            >
                {/* Left: Filters */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 100 }} size="small">
                        <InputLabel id="period-select-label">Period</InputLabel>
                        <Select
                            labelId="period-select-label"
                            id="period-select"
                            value={period}
                            label="Period"
                            onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
                            sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
                        >
                            <MenuItem value="day">Daily</MenuItem>
                            <MenuItem value="week">Weekly</MenuItem>
                            <MenuItem value="month">Monthly</MenuItem>
                        </Select>
                    </FormControl>

                    <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        customStart={customStart}
                        onCustomStartChange={setCustomStart}
                        customEnd={customEnd}
                        onCustomEndChange={setCustomEnd}
                    />

                    <FormControl sx={{ minWidth: 160 }} size="small">
                        <InputLabel id="channel-select-label">Channel</InputLabel>
                        <Select
                            labelId="channel-select-label"
                            id="channel-select"
                            value={selectedChannelId}
                            label="Channel"
                            onChange={handleChannelChange}
                            sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
                        >
                            <MenuItem value="">
                                <em>All Channels</em>
                            </MenuItem>
                            {channels.map((channel) => (
                                <MenuItem key={channel.id} value={channel.id}>
                                    {channel.name} ({channel.platform})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Right: Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefresh}
                        sx={{ borderRadius: 2 }}
                    >
                        Refresh
                    </Button>
                    <ExportButton summary={summary} channelPerformance={channelPerformance} />
                </Box>
            </Paper>

            {/* Tabs moved above content for immediate discoverability */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 3,
                    mb: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    overflow: 'hidden'
                }}
            >
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="analytics tabs"
                    sx={{
                        bgcolor: 'background.default',
                        '& .MuiTab-root': {
                            fontWeight: 600,
                            textTransform: 'none',
                            minHeight: 56,
                            fontSize: '0.95rem',
                        },
                        '& .Mui-selected': {
                            bgcolor: 'background.paper',
                        }
                    }}
                >
                    <Tab label="Overview" {...a11yProps(0)} />
                    <Tab label="Sales & Revenue" {...a11yProps(1)} />
                    <Tab label="Channels & AI" {...a11yProps(2)} />
                    <Tab label="Clients" {...a11yProps(3)} />
                </Tabs>
            </Paper>

            {/* Overview Tab - includes metrics + charts */}
            <CustomTabPanel value={tabValue} index={0}>
                <DashboardMetricsGrid
                    data={summary}
                    channelPerformance={channelPerformance}
                    selectedChannelId={selectedChannelId || null}
                    isLoading={isSummaryLoading || isChannelLoading}
                />
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <RevenueAnalytics data={revenue} isLoading={isRevenueLoading} height={280} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <ConversionFunnel data={funnel} isLoading={isFunnelLoading} height={280} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <ChannelPerformanceChart data={channelPerformance} isLoading={isChannelLoading} height={280} />
                    </Grid>
                </Grid>
            </CustomTabPanel>

            <CustomTabPanel value={tabValue} index={1}>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                        <RevenueAnalytics data={revenue} isLoading={isRevenueLoading} height={500} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <ConversionFunnel data={funnel} isLoading={isFunnelLoading} height={500} />
                    </Grid>
                </Grid>
            </CustomTabPanel>

            <CustomTabPanel value={tabValue} index={2}>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <ChannelPerformanceChart data={channelPerformance} isLoading={isChannelLoading} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <ChatbotAnalytics selectedChannelId={selectedChannelId || null} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <MessageDistributionChart data={channelPerformance} trendData={messageTrends} selectedChannelId={selectedChannelId || null} />
                    </Grid>
                </Grid>
            </CustomTabPanel>

            <CustomTabPanel value={tabValue} index={3}>
                <ClientMetrics selectedChannelId={selectedChannelId || null} startDate={startDate} endDate={endDate} />
            </CustomTabPanel>
        </Box>
    );
}