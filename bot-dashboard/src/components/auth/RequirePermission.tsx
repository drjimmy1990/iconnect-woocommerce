// src/components/auth/RequirePermission.tsx
'use client';

import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';

interface RequirePermissionProps {
  page: string;
  children: React.ReactNode;
}

export default function RequirePermission({ page, children }: RequirePermissionProps) {
  const { permissions, isLoading } = usePermissions();
  const router = useRouter();

  if (isLoading) return null; // ChannelProvider already shows loading

  if (!permissions.canAccessPage(page)) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          p: 3,
        }}
      >
        <Paper
          sx={{
            p: 5,
            textAlign: 'center',
            maxWidth: 450,
            borderRadius: 3,
          }}
        >
          <LockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You don&apos;t have permission to access this page.
            Contact your admin to request access.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            Go to Home
          </Button>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
}
