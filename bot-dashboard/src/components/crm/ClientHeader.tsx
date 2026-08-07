// src/components/crm/ClientHeader.tsx
'use client';

import React from 'react';
import { Box, Typography, Paper, Chip, Grid } from '@mui/material';
import { CrmClient } from '@/lib/api';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

interface ClientHeaderProps {
  client: CrmClient;
}

// A small helper component for displaying a stat with an icon
const StatItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  </Box>
);


export default function ClientHeader({ client }: ClientHeaderProps) {

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper function to format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Paper sx={{ p: 2, mb: 3, backgroundColor: 'background.default' }} variant="outlined">
      <Grid container spacing={2} alignItems="center">
        {/* Client Name and Company */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Show first two letters of company or email */}
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                { (client.company_name || client.email || 'NA').substring(0, 2).toUpperCase() }
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                {client.company_name || client.email || 'Unnamed Client'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {client.email}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Key Stats */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={{ xs: 2, md: 3 }} justifyContent="flex-end">
            <Grid>
              <StatItem
                icon={<CalendarTodayIcon color="action" />}
                label="Last Contact"
                value={formatDate(client.last_contact_date)}
              />
            </Grid>
            <Grid>
                <Chip
                  icon={client.client_type === 'customer' || client.client_type === 'repeat_customer' ? <BusinessIcon /> : <PersonIcon />}
                  label={client.client_type === 'repeat_customer' ? 'Repeat Customer' : client.client_type.charAt(0).toUpperCase() + client.client_type.slice(1)}
                  color={{
                    customer: 'success' as const,
                    repeat_customer: 'success' as const,
                    interested: 'warning' as const,
                    new: 'info' as const,
                    inactive: 'default' as const,
                  }[client.client_type] || 'default'}
                  size="small"
                  sx={{ mt: 2 }}
                />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Paper>
  );
}