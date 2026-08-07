// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import PageGuard from '@/components/auth/PageGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith('/chat');

  return (
    <Box sx={{ display: 'flex' }}>
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
        }}
      >
        {/* Spacer for the fixed AppHeader */}
        <Box sx={(theme) => ({ ...theme.mixins.toolbar })} /> 
        
        {/* Container for the actual page content */}
        <Box 
          sx={{ 
            flexGrow: 1,
            overflow: 'auto', 
            p: isChatPage ? 0 : 3,
          }}
        >
          <PageGuard>
            {children}
          </PageGuard>
        </Box>
      </Box>
    </Box>
  );
}