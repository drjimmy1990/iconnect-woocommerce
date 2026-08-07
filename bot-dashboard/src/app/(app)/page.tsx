// src/app/(app)/page.tsx
'use client';

import React from 'react';
import { Box, Typography, Grid, Card, CardActionArea, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChatIcon from '@mui/icons-material/Chat';
import DnsIcon from '@mui/icons-material/Dns';
import { useOrganization } from '@/hooks/useOrganization';
import { useDashboardSummary, useChannelPerformance } from '@/hooks/useAnalytics';
import DashboardMetricsGrid from './analytics/components/DashboardMetricsGrid';

export default function HomePage() {
  const router = useRouter();
  const { data: orgId } = useOrganization();

  // Fetch analytics data for the dashboard overview
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary(orgId || '');
  const { data: channelPerformance, isLoading: isChannelLoading } = useChannelPerformance(orgId || '');

  const sections = [
    {
      title: 'Chat Interface',
      description: 'View and manage live conversations with your contacts.',
      icon: <ChatIcon fontSize="large" color="primary" />,
      path: '/chat'
    },
    {
      title: 'Channel Management',
      description: 'Add, configure, and manage your communication channels.',
      icon: <DnsIcon fontSize="large" color="primary" />,
      path: '/channels'
    }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome to the Dashboard
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Here is an overview of your business performance and quick actions.
      </Typography>

      {/* Analytics Overview */}
      <Box sx={{ mb: 5 }}>
        <DashboardMetricsGrid
          data={summary}
          channelPerformance={channelPerformance}
          selectedChannelId={null}
          isLoading={isSummaryLoading || isChannelLoading}
        />
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Quick Actions
      </Typography>

      <Grid container spacing={3}>
        {sections.map((section) => (
          <Grid size={{ xs: 12, md: 6 }} key={section.title}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea
                sx={{ p: 2, height: '100%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 3 }}
                onClick={() => router.push(section.path)}
              >
                {section.icon}
                <Box>
                  <Typography variant="h6" component="div">
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}