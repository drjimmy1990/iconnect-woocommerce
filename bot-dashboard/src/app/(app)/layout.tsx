// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import PageGuard from '@/components/auth/PageGuard';
import AuthGuard from '@/components/auth/AuthGuard';
import { ChannelProvider } from '@/providers/ChannelProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith('/chat');

  return (
    <AuthGuard>
      <ChannelProvider>
        <NotificationProvider>
        <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
          <AppHeader /> 
          <AppSidebar />
          
          <Box 
            component="main" 
            sx={{ 
              flexGrow: 1, 
              width: '100%',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            {/* Spacer for the fixed AppHeader */}
            <Box sx={{ minHeight: '64px' }} /> 
            
            {/* Container for the actual page content */}
            <Box 
              sx={{ 
                flexGrow: 1,
                overflow: 'auto', 
                p: isChatPage ? 0 : { xs: 2, sm: 3 },
                maxWidth: isChatPage ? '100%' : '1600px',
                width: '100%',
                mx: 'auto',
              }}
            >
              <PageGuard>
                {children}
              </PageGuard>
            </Box>
          </Box>
        </Box>
      </NotificationProvider>
    </ChannelProvider>
  </AuthGuard>
  );
}