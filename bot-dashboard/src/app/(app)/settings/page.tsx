// src/app/(app)/settings/page.tsx
'use client';

import React from 'react';
import {
  Box,
  Typography,
  Container,
  Divider,
} from '@mui/material';

// Import our two new components
import UserProfile from '@/components/settings/profile/UserProfile';
import OrganizationSettings from '@/components/settings/organization/OrganizationSettings';

export default function GlobalSettingsPage() {
  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1">
        Settings
      </Typography>
      
      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" color="text.secondary" sx={{mb: 4}}>
        Manage your personal profile and top-level organization settings.
      </Typography>
      
      {/* 
        We use a Box with a flex layout to stack the setting cards vertically
        with a consistent gap between them.
      */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <OrganizationSettings />
        <UserProfile />
      </Box>
    </Container>
  );
}