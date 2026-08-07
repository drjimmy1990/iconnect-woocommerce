import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import { CrmClient } from '@/lib/api';

interface ClientOverviewProps {
    client: CrmClient;
    messageCount: number;
}

export default function ClientOverview({ client, messageCount }: ClientOverviewProps) {
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Overview</Typography>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">Client Type</Typography>
                        <Typography variant="h4">
                            {client.client_type === 'repeat_customer' ? 'Repeat Customer' : client.client_type.charAt(0).toUpperCase() + client.client_type.slice(1)}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">Source</Typography>
                        <Typography variant="h4">
                            {client.source ? client.source.charAt(0).toUpperCase() + client.source.slice(1) : 'N/A'}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">Total Messages</Typography>
                        <Typography variant="h4">{messageCount}</Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
