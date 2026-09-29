'use client';

import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Grid,
    Tab,
    Tabs,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    Paper,
    Chip,
} from '@mui/material';

import RefreshIcon from '@mui/icons-material/Refresh';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
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
            id={`analytics-tabpanel-${index}`}
            aria-labelledby={`analytics-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `analytics-tab-${index}`,
        'aria-controls': `analytics-tabpanel-${index}`,
    };
}

export default function AnalyticsPage() {
    const { data: orgId } = useOrganization();
    const [tabValue, setTabValue] = useState(0);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- DATE STATE ---
    const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
    const [customStart, setCustomStart] = useState<Date | null>(null);
    const [customEnd, setCustomEnd] = useState<Date | null>(null);

    // --- DATE LOGIC ---
    const { startDate, endDate } = React.useMemo(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        let start: Date | null = null;
        let end: Date | null = now;

        if (dateRange === 'yesterday') {
            start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);

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
            start = customStart ? new Date(customStart) : null;
            if (start) start.setHours(0, 0, 0, 0);

            end = customEnd ? new Date(customEnd) : null;
            if (end) end.setHours(23, 59, 59, 999);
        } else {
            start = null;
            end = null;
        }
        return { startDate: start, endDate: end };
    }, [dateRange, customStart, customEnd]);

    // Fetch data with exact same parameters
    const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useDashboardSummary(orgId || '', selectedChannelId || null, startDate, endDate);
    const { data: revenue, isLoading: isRevenueLoading } = useRevenueMetrics(orgId || '', period, selectedChannelId || null, startDate, endDate);
    const { data: funnel, isLoading: isFunnelLoading } = useConversionFunnel(orgId || '', selectedChannelId || null, startDate, endDate);
    const { data: channelPerformance, isLoading: isChannelLoading } = useChannelPerformance(orgId || '', startDate, endDate);
    const { data: messageTrends } = useMessageVolumeTrends(orgId || '', period, selectedChannelId || null, startDate, endDate);
    const { channels } = useChannels();
    const { refreshAnalytics } = useAnalyticsControl();

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            await refreshAnalytics();
            refetchSummary();
            window.location.reload();
        } catch (error: unknown) {
            console.error('Failed to refresh analytics:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to refresh: ${message}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleChannelChange = (event: SelectChangeEvent) => {
        setSelectedChannelId(event.target.value);
    };

    return (
        <Box sx={{ width: '100%', pb: 6 }}>
            {/* Header Section */}
            <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                            Executive Analytics & Revenue
                        </Typography>
                        <Chip
                            label="Live Data"
                            size="small"
                            color="success"
                            sx={{ height: 22, fontWeight: 700, fontSize: '0.72rem' }}
                        />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Comprehensive financial attribution, conversation conversion funnels, and AI bot metrics.
                    </Typography>
                </Box>
            </Box>

            {/* Filter Deck - Modern floating glassmorphic control bar */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 3.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    border: '1px solid',
                    borderColor: 'rgba(226, 232, 240, 0.8)',
                    borderRadius: 3.5,
                    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)'
                }}
            >
                {/* Left: Filters */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <InputLabel id="period-select-label">Aggregation</InputLabel>
                        <Select
                            labelId="period-select-label"
                            id="period-select"
                            value={period}
                            label="Aggregation"
                            onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
                            sx={{ bgcolor: 'background.paper', borderRadius: 2.5, fontWeight: 600 }}
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

                    <FormControl sx={{ minWidth: 180 }} size="small">
                        <InputLabel id="channel-select-label">Channel Source</InputLabel>
                        <Select
                            labelId="channel-select-label"
                            id="channel-select"
                            value={selectedChannelId}
                            label="Channel Source"
                            onChange={handleChannelChange}
                            sx={{ bgcolor: 'background.paper', borderRadius: 2.5, fontWeight: 600 }}
                        >
                            <MenuItem value="">
                                <em>All Communication Channels</em>
                            </MenuItem>
                            {channels.map((channel) => (
                                <MenuItem key={channel.id} value={channel.id}>
                                    {channel.name} ({channel.platform})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Right: Actions */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon sx={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />}
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        sx={{
                            borderRadius: 2.5,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            textTransform: 'none',
                            px: 2,
                            borderColor: 'rgba(226, 232, 240, 0.9)',
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' },
                            },
                        }}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                    <ExportButton summary={summary} channelPerformance={channelPerformance} />
                </Box>
            </Paper>

            {/* Luxury Segmented Tabs Bar */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 3,
                    mb: 3.5,
                    border: '1px solid',
                    borderColor: 'rgba(226, 232, 240, 0.8)',
                    p: 0.5,
                    bgcolor: 'rgba(248, 250, 252, 0.8)',
                    backdropFilter: 'blur(8px)',
                }}
            >
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="analytics dashboard tabs"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        minHeight: 46,
                        '& .MuiTabs-indicator': {
                            display: 'none',
                        },
                        '& .MuiTab-root': {
                            fontWeight: 700,
                            textTransform: 'none',
                            minHeight: 42,
                            borderRadius: 2.5,
                            px: 2.5,
                            mx: 0.5,
                            fontSize: '0.85rem',
                            color: '#64748B',
                            transition: 'all 0.2s ease',
                            '&.Mui-selected': {
                                bgcolor: 'primary.main',
                                color: 'white',
                                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                            },
                            '&:hover:not(.Mui-selected)': {
                                bgcolor: 'rgba(79, 70, 229, 0.06)',
                                color: 'primary.main',
                            }
                        }
                    }}
                >
                    <Tab icon={<QueryStatsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Overview & KPI Grid" {...a11yProps(0)} />
                    <Tab icon={<MonetizationOnIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Sales & Revenue Funnel" {...a11yProps(1)} />
                    <Tab icon={<SmartToyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Channels & AI Automation" {...a11yProps(2)} />
                    <Tab icon={<PeopleAltIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="CRM Demographics" {...a11yProps(3)} />
                </Tabs>
            </Paper>

            {/* Overview Tab - metrics + multi-view charts */}
            <CustomTabPanel value={tabValue} index={0}>
                <DashboardMetricsGrid
                    data={summary}
                    channelPerformance={channelPerformance}
                    selectedChannelId={selectedChannelId || null}
                    isLoading={isSummaryLoading || isChannelLoading}
                />
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <RevenueAnalytics data={revenue} isLoading={isRevenueLoading} height={300} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <ConversionFunnel data={funnel} isLoading={isFunnelLoading} height={300} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <ChannelPerformanceChart data={channelPerformance} isLoading={isChannelLoading} height={300} />
                    </Grid>
                </Grid>
            </CustomTabPanel>

            {/* Sales & Revenue Tab */}
            <CustomTabPanel value={tabValue} index={1}>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                        <RevenueAnalytics data={revenue} isLoading={isRevenueLoading} height={480} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <ConversionFunnel data={funnel} isLoading={isFunnelLoading} height={480} />
                    </Grid>
                </Grid>
            </CustomTabPanel>

            {/* Channels & AI Copilot Tab */}
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

            {/* Client Metrics Tab */}
            <CustomTabPanel value={tabValue} index={3}>
                <ClientMetrics selectedChannelId={selectedChannelId || null} startDate={startDate} endDate={endDate} />
            </CustomTabPanel>
        </Box>
    );
}