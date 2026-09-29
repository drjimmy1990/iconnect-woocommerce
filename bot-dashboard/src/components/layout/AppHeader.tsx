// src/components/layout/AppHeader.tsx
'use client';

import React from 'react';
import { styled } from '@mui/material/styles';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuIcon from '@mui/icons-material/Menu';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsIcon from '@mui/icons-material/Settings';
import { usePathname } from 'next/navigation';
import { useUI } from '@/providers/UIProvider';
import { useChannel } from '@/providers/ChannelProvider';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import NotificationBell from './NotificationBell';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/providers/AuthProvider';

const drawerWidth = 250;

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  color: '#0F172A',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

export default function AppHeader() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { activeChannel, channels } = useChannel();
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    handleCloseUserMenu();
    await signOut();
  };

  // Helper to determine contextual header title based on current route
  const getRouteHeader = () => {
    if (pathname === '/') {
      return {
        title: 'Store Overview',
        chipText: 'ALL CHANNELS',
        chipColor: 'rgba(79, 70, 229, 0.08)',
        chipTextColor: '#4F46E5',
        customIcon: (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
            }}
          >
            <StorefrontIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/chat')) {
      if (activeChannel) {
        return {
          title: activeChannel.name,
          chipText: activeChannel.platform.toUpperCase(),
          chipColor: 'rgba(79, 70, 229, 0.08)',
          chipTextColor: '#4F46E5',
          customIcon: (
            <PlatformAvatar
              platform={activeChannel.platform}
              sx={{ width: 32, height: 32, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
            />
          ),
        };
      }
      return {
        title: 'Live Chat',
        chipText: 'INBOX',
        chipColor: 'rgba(79, 70, 229, 0.08)',
        chipTextColor: '#4F46E5',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
            <ChatIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/clients')) {
      return {
        title: 'Clients & CRM',
        chipText: 'DIRECTORY',
        chipColor: 'rgba(16, 185, 129, 0.08)',
        chipTextColor: '#059669',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <PeopleIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/channels')) {
      return {
        title: 'Channels & Bots',
        chipText: `${channels.length} CONNECTED`,
        chipColor: 'rgba(245, 158, 11, 0.08)',
        chipTextColor: '#D97706',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <DnsIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/analytics')) {
      return {
        title: 'Analytics & Revenue',
        chipText: 'METRICS',
        chipColor: 'rgba(6, 182, 212, 0.08)',
        chipTextColor: '#0891B2',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4' }}>
            <AnalyticsIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/team')) {
      return {
        title: 'Team & Permissions',
        chipText: 'STAFF',
        chipColor: 'rgba(139, 92, 246, 0.08)',
        chipTextColor: '#7C3AED',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
            <GroupsIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    if (pathname.startsWith('/settings')) {
      return {
        title: 'Settings',
        chipText: 'CONFIG',
        chipColor: 'rgba(100, 116, 139, 0.08)',
        chipTextColor: '#475569',
        customIcon: (
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </Box>
        ),
      };
    }

    return {
      title: 'Dashboard',
      chipText: 'CONSOLE',
      chipColor: 'rgba(79, 70, 229, 0.08)',
      chipTextColor: '#4F46E5',
      customIcon: (
        <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
          <StorefrontIcon sx={{ fontSize: 18 }} />
        </Box>
      ),
    };
  };

  const headerInfo = getRouteHeader();

  return (
    <AppBar position="fixed" open={isSidebarOpen} elevation={0}>
      <Toolbar sx={{ minHeight: '64px', px: { xs: 2, sm: 3 } }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={toggleSidebar}
          edge="start"
          sx={{
            mr: 2,
            p: 1,
            borderRadius: '10px',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'rgba(79, 70, 229, 0.06)',
              color: 'primary.main',
            },
            ...(isSidebarOpen && { display: 'none' }),
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Dynamic Context-Aware Header Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          {headerInfo.customIcon}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {headerInfo.title}
            </Typography>
            <Chip
              label={headerInfo.chipText}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                bgcolor: headerInfo.chipColor,
                color: headerInfo.chipTextColor,
                borderRadius: '5px',
              }}
            />
          </Box>

          {/* Pulsing AI Live Status Badge */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
              ml: 2,
              px: 1.5,
              py: 0.4,
              borderRadius: '9999px',
              bgcolor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <Box
              className="pulse-dot"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#10B981',
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#059669', fontSize: '0.75rem' }}>
              AI Bot Active
            </Typography>
          </Box>
        </Box>

        {/* Right Actions: Notifications & User Profile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 0.5,
              borderRadius: '10px',
              transition: 'background 0.15s ease',
              '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.06)' },
            }}
          >
            <NotificationBell />
          </Box>

          {user && (
            <>
              <Box
                onClick={handleOpenUserMenu}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.2,
                  py: 0.5,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  bgcolor: 'rgba(248, 250, 252, 0.85)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(79, 70, 229, 0.06)',
                    borderColor: 'rgba(79, 70, 229, 0.3)',
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    bgcolor: 'primary.main',
                    color: '#FFFFFF',
                  }}
                >
                  {(profile?.full_name || user.email || 'A').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.2 }}>
                    {profile?.full_name || user.email?.split('@')[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.65rem', display: 'block', fontWeight: 600 }}>
                    {profile?.role ? profile.role.toUpperCase() : 'ADMIN'}
                  </Typography>
                </Box>
              </Box>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseUserMenu}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    elevation: 4,
                    sx: {
                      mt: 1,
                      minWidth: 220,
                      borderRadius: '12px',
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                      p: 0.5,
                    },
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                    {profile?.full_name || 'System Admin'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', wordBreak: 'break-all', display: 'block', mt: 0.3 }}>
                    {user.email}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={profile?.role ? profile.role.toUpperCase() : 'ADMIN'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(79, 70, 229, 0.1)',
                        color: 'primary.main',
                        borderRadius: '4px',
                      }}
                    />
                  </Box>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={handleSignOut}
                  sx={{
                    borderRadius: '8px',
                    color: 'error.main',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    gap: 1.5,
                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'error.main', minWidth: 24 }}>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Log Out" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
