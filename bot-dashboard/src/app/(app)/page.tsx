// src/app/(app)/page.tsx
'use client';

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Button,
  Chip
} from '@mui/material';
import { useRouter } from 'next/navigation';
import ChatIcon from '@mui/icons-material/Chat';
import DnsIcon from '@mui/icons-material/Dns';
import PeopleIcon from '@mui/icons-material/People';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useOrganization } from '@/hooks/useOrganization';
import { useDashboardSummary, useChannelPerformance } from '@/hooks/useAnalytics';
import DashboardMetricsGrid from './analytics/components/DashboardMetricsGrid';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';

export default function HomePage() {
  const router = useRouter();
  const { data: orgId } = useOrganization();

  // Fetch analytics data for the dashboard overview
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary(orgId || '');
  const { data: channelPerformance, isLoading: isChannelLoading } = useChannelPerformance(orgId || '');

  const quickActions = [
    {
      title: 'Live Omnichannel Chat',
      description: 'Interact with WhatsApp, Instagram & Facebook chats with AI Copilot.',
      badge: 'Live Inbox',
      badgeColor: 'primary' as const,
      gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
      icon: <ChatIcon sx={{ fontSize: 24, color: 'white' }} />,
      path: '/chat'
    },
    {
      title: 'Clients & CRM Profiles',
      description: 'Manage customer lifecycle stages, order history, tags, and notes.',
      badge: 'CRM Pipeline',
      badgeColor: 'success' as const,
      gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      icon: <PeopleIcon sx={{ fontSize: 24, color: 'white' }} />,
      path: '/clients'
    },
    {
      title: 'Channels & AI Agents',
      description: 'Configure bot prompts, webhooks, and channel automation status.',
      badge: 'Automation',
      badgeColor: 'warning' as const,
      gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      icon: <DnsIcon sx={{ fontSize: 24, color: 'white' }} />,
      path: '/channels'
    },
    {
      title: 'Sales & Revenue Analytics',
      description: 'Audit store conversion funnels, AOV trends, and bot ROI.',
      badge: 'Financials',
      badgeColor: 'info' as const,
      gradient: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
      icon: <AnalyticsIcon sx={{ fontSize: 24, color: 'white' }} />,
      path: '/analytics'
    },
  ];

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Executive Hero Banner */}
      <Box
        sx={{
          mb: 3.5,
          p: { xs: 2.5, md: 3 },
          borderRadius: 4,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.3)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2.5
        }}
      >
        {/* Glow ambient circle */}
        <Box
          sx={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.4) 0%, rgba(79, 70, 229, 0) 70%)',
            pointerEvents: 'none'
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 2,
                px: 1.25,
                py: 0.4,
              }}
            >
              <FiberManualRecordIcon
                sx={{
                  fontSize: 10,
                  color: '#10B981',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.6, transform: 'scale(0.9)' },
                    '50%': { opacity: 1, transform: 'scale(1.2)' },
                    '100%': { opacity: 0.6, transform: 'scale(0.9)' },
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.4px' }}>
                AI BOT SYSTEMS ACTIVE
              </Typography>
            </Box>
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '1.85rem' },
              letterSpacing: '-0.02em',
              mb: 0.5
            }}
          >
            Executive AI Command Center
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.75)',
              maxWidth: 580,
              fontSize: '0.88rem'
            }}
          >
            Real-time WooCommerce sales intelligence, omnichannel customer engagement, and autonomous AI agents.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ChatIcon />}
            onClick={() => router.push('/chat')}
            sx={{
              bgcolor: '#4F46E5',
              fontWeight: 700,
              borderRadius: 2.5,
              px: 2.5,
              py: 1,
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
              '&:hover': { bgcolor: '#4338CA' }
            }}
          >
            Launch Live Chat
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push('/analytics')}
            startIcon={<AutoAwesomeIcon />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.25)',
              borderRadius: 2.5,
              fontWeight: 600,
              px: 2,
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.08)'
              }
            }}
          >
            Analytics
          </Button>
        </Box>
      </Box>

      {/* Analytics Overview Metrics Grid */}
      <Box sx={{ mb: 4 }}>
        <DashboardMetricsGrid
          data={summary}
          channelPerformance={channelPerformance}
          selectedChannelId={null}
          isLoading={isSummaryLoading || isChannelLoading}
        />
      </Box>

      {/* Two Column Section: Quick Actions & Recent Activity Stream */}
      <Grid container spacing={3}>
        {/* Left Side: Quick Actions Grid */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Operational Modules
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Direct access to core automated platforms
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            {quickActions.map((action) => (
              <Grid size={{ xs: 12, sm: 6 }} key={action.title}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: 3.5,
                    border: '1px solid',
                    borderColor: 'rgba(226, 232, 240, 0.8)',
                    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.85) 100%)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      borderColor: 'primary.light',
                      boxShadow: '0 12px 24px -4px rgba(79, 70, 229, 0.1), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
                      '& .action-arrow': {
                        transform: 'translateX(4px)',
                        color: 'primary.main',
                      }
                    }
                  }}
                >
                  <CardActionArea
                    sx={{ p: 2.25, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' }}
                    onClick={() => router.push(action.path)}
                  >
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2.5,
                          background: action.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                        }}
                      >
                        {action.icon}
                      </Box>
                      <Chip
                        label={action.badge}
                        size="small"
                        color={action.badgeColor}
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                      />
                    </Box>

                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>
                          {action.title}
                        </Typography>
                        <ArrowForwardIcon
                          className="action-arrow"
                          sx={{ fontSize: 16, color: '#94A3B8', transition: 'all 0.2s ease' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {action.description}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Right Side: Live Activity Stream */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <RecentActivityFeed />
        </Grid>
      </Grid>
    </Box>
  );
}