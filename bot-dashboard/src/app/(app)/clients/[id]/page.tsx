'use client';

import React, { useState } from 'react';
import { Box, Grid, Tab, Tabs, CircularProgress, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import ClientHeader from './components/ClientHeader';
import ClientSidebar from './components/ClientSidebar';
import ClientOverview from './components/ClientOverview';
import ClientTimeline from './components/ClientTimeline';
import ClientNotes from './components/ClientNotes';

import ClientOrders from './components/ClientOrders';
import { useClient } from '@/hooks/useClient';

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
            id={`client-tabpanel-${index}`}
            aria-labelledby={`client-tab-${index}`}
            {...other}
            style={{ height: '100%' }}
        >
            {value === index && (
                <Box sx={{ height: '100%' }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function ClientProfilePage() {
    const params = useParams();
    const clientId = params.id as string;
    const [tabValue, setTabValue] = useState(0);

    const { clientData, isLoading, error } = useClient(clientId);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    if (isLoading) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !clientData) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">Failed to load client data.</Typography>
            </Box>
        );
    }

    const { client, contact, orders, messageCount } = clientData;

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <ClientHeader client={client} contact={contact} />

            <Grid container sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {/* Left Sidebar */}
                <Grid size={{ xs: 12, md: 3, lg: 2.5 }} sx={{ height: '100%', overflowY: 'auto', borderRight: '1px solid', borderColor: 'divider' }}>
                    <ClientSidebar client={client} contact={contact} />
                </Grid>

                {/* Main Content Area */}
                <Grid size={{ xs: 12, md: 9, lg: 9.5 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 3 }}>
                        <Tabs value={tabValue} onChange={handleTabChange}>
                            <Tab label="Overview" />
                            <Tab label="Orders" />
                            <Tab label="Timeline" />
                            <Tab label="Notes" />
                        </Tabs>
                    </Box>

                    <Box sx={{ flexGrow: 1, overflowY: 'auto', bgcolor: '#f8fafc' }}>
                        <CustomTabPanel value={tabValue} index={0}>
                            <ClientOverview client={client} messageCount={messageCount} />
                        </CustomTabPanel>
                        <CustomTabPanel value={tabValue} index={1}>
                            <ClientOrders clientId={client.id} orders={orders} />
                        </CustomTabPanel>
                        <CustomTabPanel value={tabValue} index={2}>
                            <ClientTimeline />
                        </CustomTabPanel>
                        <CustomTabPanel value={tabValue} index={3}>
                            <ClientNotes />
                        </CustomTabPanel>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
