'use client';

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import HandshakeIcon from '@mui/icons-material/Handshake';

// Deals have been removed from the CRM. This component is kept as a placeholder.
export default function ClientDeals() {
    return (
        <Box sx={{ p: 3 }}>
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: 'background.default',
                    minHeight: 200
                }}
            >
                <HandshakeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    Deals Removed
                </Typography>
                <Typography variant="body2" color="text.disabled" textAlign="center">
                    The deals pipeline has been removed from this CRM.
                </Typography>
            </Paper>
        </Box>
    );
}
