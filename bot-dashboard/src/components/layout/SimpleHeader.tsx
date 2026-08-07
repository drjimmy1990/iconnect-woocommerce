// src/components/layout/SimpleHeader.tsx
'use client';

import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { usePathname } from 'next/navigation';

const DRAWER_WIDTH = 240;

const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith('/chat')) return 'Chat Interface';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  return 'Home';
};

export default function SimpleHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        ml: `${DRAWER_WIDTH}px`,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {title}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}