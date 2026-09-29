// src/components/auth/AuthGuard.tsx
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/providers/AuthProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${returnUrl}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100%',
          bgcolor: 'background.default',
          gap: 2,
        }}
      >
        <CircularProgress size={36} sx={{ color: '#4F46E5' }} />
        <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
          Verifying credentials...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
