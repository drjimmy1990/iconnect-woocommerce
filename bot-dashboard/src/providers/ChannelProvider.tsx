// src/providers/ChannelProvider.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useChannels, Channel } from '@/hooks/useChannels';
import { usePermissions } from '@/hooks/usePermissions';
import { CircularProgress, Box, Typography } from '@mui/material';

// 1. Define the shape of the context data
interface ChannelContextType {
  channels: Channel[];
  activeChannel: Channel | null;
  setActiveChannelId: (id: string) => void;
  isLoadingChannels: boolean;
}

// 2. Create the context with a default value
const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

// 3. Create the Provider component
export function ChannelProvider({ children }: { children: ReactNode }) {
  const { channels: allChannels, isLoading: isLoadingChannels } = useChannels();
  const { permissions, isLoading: isLoadingPermissions } = usePermissions();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // Filter channels based on user's access permissions
  const channels = React.useMemo(() => {
    if (permissions.allowedChannelIds === 'all') return allChannels;
    return allChannels.filter(c => permissions.canAccessChannel(c.id));
  }, [allChannels, permissions]);

  // Effect to set a default active channel when channels are loaded
  useEffect(() => {
    if (!activeChannelId && !isLoadingChannels && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
    // If active channel is no longer accessible, reset to first available
    if (activeChannelId && channels.length > 0 && !channels.find(c => c.id === activeChannelId)) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, isLoadingChannels, activeChannelId]);

  // Memoize the activeChannel object to prevent unnecessary re-renders
  const activeChannel = React.useMemo(() => {
    return channels.find(c => c.id === activeChannelId) || null;
  }, [channels, activeChannelId]);

  const isLoading = isLoadingChannels || isLoadingPermissions;

  const value = {
    channels,
    activeChannel,
    setActiveChannelId,
    isLoadingChannels: isLoading,
  };

  // Optional: Show a loading screen while fetching initial channels
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading channel data...</Typography>
      </Box>
    );
  }

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
}

// 4. Create a custom hook for easy access to the context
export function useChannel() {
  const context = useContext(ChannelContext);
  if (context === undefined) {
    throw new Error('useChannel must be used within a ChannelProvider');
  }
  return context;
}