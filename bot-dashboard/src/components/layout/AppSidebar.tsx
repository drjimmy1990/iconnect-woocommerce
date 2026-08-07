// src/components/layout/AppSidebar.tsx
'use client';

import React from 'react';
import { styled, Theme, CSSObject } from '@mui/material/styles';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/providers/UIProvider';
import { usePermissions } from '@/hooks/usePermissions';
import HomeIcon from '@mui/icons-material/Home';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DnsIcon from '@mui/icons-material/Dns';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';

import LogoutIcon from '@mui/icons-material/Logout';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const drawerWidth = 240;

const menuItems = [
  { text: 'Home', href: '/', icon: <HomeIcon />, page: 'home' },
  { text: 'Chat', href: '/chat', icon: <ChatIcon />, page: 'chat' },
  { text: 'Clients', href: '/clients', icon: <PeopleIcon />, page: 'clients' },
  { text: 'Channels', href: '/channels', icon: <DnsIcon />, page: 'channels' },
  { text: 'Settings', href: '/settings', icon: <SettingsIcon />, page: 'settings' },
  { text: 'Analytics', href: '/analytics', icon: <AnalyticsIcon />, page: 'analytics' },
  { text: 'Team', href: '/team', icon: <GroupsIcon />, page: 'team' },
];

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

export default function AppSidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const pathname = usePathname();
  const { permissions } = usePermissions();
  const router = useRouter();

  // Filter menu items based on the user's page permissions
  const visibleItems = menuItems.filter(item => permissions.canAccessPage(item.page));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Drawer variant="permanent" open={isSidebarOpen}>
      <DrawerHeader>
        <IconButton onClick={toggleSidebar}>
          <ChevronLeftIcon />
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        {visibleItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              component={Link}
              href={item.href}
              selected={pathname.startsWith(item.href) && item.href !== '/'}
              // Special case for home page to avoid it always being selected
              {...(item.href === '/' && { selected: pathname === '/' })}
              sx={{ minHeight: 48, justifyContent: isSidebarOpen ? 'initial' : 'center', px: 2.5 }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Push logout to bottom */}
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Tooltip title="Logout" placement="right" disableHoverListener={isSidebarOpen}>
            <ListItemButton
              onClick={handleLogout}
              sx={{ minHeight: 48, justifyContent: isSidebarOpen ? 'initial' : 'center', px: 2.5 }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center', color: 'error.main' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" sx={{ opacity: isSidebarOpen ? 1 : 0, color: 'error.main' }} />
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Drawer>
  );
}