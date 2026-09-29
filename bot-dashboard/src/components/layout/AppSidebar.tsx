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
import BoltIcon from '@mui/icons-material/Bolt';
import LogoutIcon from '@mui/icons-material/Logout';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const drawerWidth = 250;

const menuItems = [
  { text: 'Home', href: '/', icon: <HomeIcon />, page: 'home' },
  { text: 'Live Chat', href: '/chat', icon: <ChatIcon />, page: 'chat' },
  { text: 'Clients & CRM', href: '/clients', icon: <PeopleIcon />, page: 'clients' },
  { text: 'Channels', href: '/channels', icon: <DnsIcon />, page: 'channels' },
  { text: 'Analytics', href: '/analytics', icon: <AnalyticsIcon />, page: 'analytics' },
  { text: 'Team', href: '/team', icon: <GroupsIcon />, page: 'team' },
  { text: 'Settings', href: '/settings', icon: <SettingsIcon />, page: 'settings' },
];

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  backgroundColor: '#FFFFFF',
  borderRight: '1px solid rgba(226, 232, 240, 0.85)',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  backgroundColor: '#FFFFFF',
  borderRight: '1px solid rgba(226, 232, 240, 0.85)',
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
  justifyContent: 'space-between',
  padding: theme.spacing(0, 2),
  minHeight: 64,
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
      <DrawerHeader sx={{ px: isSidebarOpen ? 2.5 : 1.5 }}>
        {isSidebarOpen ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                flexShrink: 0,
              }}
            >
              <BoltIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  color: '#0F172A',
                  lineHeight: 1.2,
                }}
              >
                iConnect
              </Typography>
              <Chip
                label="AI BOT"
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  bgcolor: 'rgba(79, 70, 229, 0.08)',
                  color: 'primary.main',
                  borderRadius: '3px',
                  px: 0.2,
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box
            onClick={toggleSidebar}
            sx={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              cursor: 'pointer',
              mx: 'auto',
            }}
          >
            <BoltIcon sx={{ fontSize: 20 }} />
          </Box>
        )}

        {isSidebarOpen && (
          <IconButton
            onClick={toggleSidebar}
            size="small"
            sx={{
              borderRadius: '8px',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.06)', color: 'primary.main' },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </DrawerHeader>

      <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />

      <List sx={{ px: 1.2, py: 1.5 }}>
        {visibleItems.map((item) => {
          const isSelected = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <Tooltip title={!isSidebarOpen ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  selected={isSelected}
                  sx={{
                    minHeight: 44,
                    justifyContent: isSidebarOpen ? 'initial' : 'center',
                    px: isSidebarOpen ? 2 : 1.5,
                    borderRadius: '10px',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    ...(isSelected
                      ? {
                          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(99, 102, 241, 0.04) 100%)',
                          color: 'primary.main',
                          fontWeight: 700,
                          borderLeft: isSidebarOpen ? '3px solid #4F46E5' : 'none',
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.16) 0%, rgba(99, 102, 241, 0.06) 100%)',
                          },
                        }
                      : {
                          color: '#475569',
                          '&:hover': {
                            bgcolor: 'rgba(79, 70, 229, 0.04)',
                            color: 'primary.main',
                            '& .MuiListItemIcon-root': {
                              color: 'primary.main',
                            },
                          },
                        }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: isSidebarOpen ? 2 : 'auto',
                      justifyContent: 'center',
                      color: isSelected ? 'primary.main' : '#64748B',
                      transition: 'color 0.15s ease',
                      '& svg': { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                    sx={{ opacity: isSidebarOpen ? 1 : 0 }}
                  />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* Push logout to bottom */}
      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />
      <List sx={{ px: 1.2, py: 1 }}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Tooltip title={!isSidebarOpen ? 'Logout' : ''} placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                minHeight: 44,
                justifyContent: isSidebarOpen ? 'initial' : 'center',
                px: isSidebarOpen ? 2 : 1.5,
                borderRadius: '10px',
                color: '#64748B',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.06)',
                  color: 'error.main',
                  '& .MuiListItemIcon-root': {
                    color: 'error.main',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isSidebarOpen ? 2 : 'auto',
                  justifyContent: 'center',
                  color: '#64748B',
                  '& svg': { fontSize: 20 },
                }}
              >
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
                sx={{ opacity: isSidebarOpen ? 1 : 0 }}
              />
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Drawer>
  );
}