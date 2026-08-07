'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Container,
  Paper,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import Link from 'next/link';

// Import all the setting components
import { useChannelConfig } from '@/hooks/useChannelConfig';
import AgentPromptsManager from '@/components/settings/AgentPromptsManager';
import GeneralSettings from '@/components/settings/GeneralSettings';
import KeywordActionsManager from '@/components/settings/KeywordActionsManager';
import ChannelDetails from '@/components/settings/ChannelDetails';
import ContentCollectionsManager from '@/components/settings/ContentCollectionsManager';
import ChannelCredentialsManager from '@/components/settings/ChannelCredentialsManager';
import WebhookSettings from '@/components/settings/WebhookSettings';
import EcommerceSettings from '@/components/settings/EcommerceSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';

// This component displays the settings when a valid channelId is present
function ChannelSettingsDisplay({ channelId }: { channelId: string }) {
  const { data, isLoading, isError, error } = useChannelConfig(channelId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading channel settings...</Typography>
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Error loading configuration: {error?.message}</Alert>;
  }

  if (!data) {
    return <Alert severity="info">Configuration for this channel is not yet available. Please try again shortly.</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
      
      {/* --- Channel Identity --- */}
      <ChannelDetails channelId={channelId} />
      <ChannelCredentialsManager channelId={channelId} />
      
      {/* --- Integration & Webhooks --- */}
      <WebhookSettings config={data.config} channelId={channelId} />
      <EcommerceSettings config={data.config} channelId={channelId} />
      <NotificationSettings config={data.config} channelId={channelId} />

      {/* --- AI Configuration --- */}
      <GeneralSettings config={data.config} channelId={channelId} />
      <AgentPromptsManager prompts={data.prompts} channelId={channelId} />
      
      {/* --- Automation --- */}
      <KeywordActionsManager keywords={data.keywords} channelId={channelId} />
      <ContentCollectionsManager collections={data.collections} channelId={channelId} />

    </Box>
  );
}

// This is the main page component
export default function DynamicChannelSettingsPage() {
  const params = useParams();
  const channelId = params.channelId as string;

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1">
        Channel Configuration
      </Typography>
      
      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
        Manage the AI behavior, automated actions, and content for this specific channel.
      </Typography>
      
      {!channelId ? (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 4 }}>
          <Typography variant="h6">No Channel ID Provided</Typography>
          <Typography color="text.secondary">
            Please return to the <Link href="/channels" style={{ textDecoration: 'underline' }}>Channels page</Link> and select a channel to configure.
          </Typography>
        </Paper>
      ) : (
        <ChannelSettingsDisplay channelId={channelId} />
      )}
    </Container>
  );
}