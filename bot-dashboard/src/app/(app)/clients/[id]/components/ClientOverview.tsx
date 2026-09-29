import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LanguageIcon from '@mui/icons-material/Language';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { CrmClient } from '@/lib/api';

interface ClientOverviewProps {
  client: CrmClient;
  messageCount: number;
}

export default function ClientOverview({ client, messageCount }: ClientOverviewProps) {
  const cards = [
    {
      title: 'Customer Status',
      value:
        client.client_type === 'repeat_customer'
          ? '⭐ VIP Repeat'
          : client.client_type === 'customer'
          ? '🛍️ Customer'
          : client.client_type === 'interested'
          ? '👀 Interested'
          : '🆕 New Lead',
      subtitle: `Lifecycle stage: ${client.conversation_stage || 'Active'}`,
      icon: <PersonOutlineIcon sx={{ color: '#FFFFFF', fontSize: 24 }} />,
      gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
      shadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
    },
    {
      title: 'Acquisition Source',
      value: client.source ? client.source.toUpperCase() : 'DIRECT',
      subtitle: client.platform_user_id ? `ID: ${client.platform_user_id}` : 'Direct Inbound',
      icon: <LanguageIcon sx={{ color: '#FFFFFF', fontSize: 24 }} />,
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      shadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
    },
    {
      title: 'Chat Engagement',
      value: messageCount,
      subtitle: 'Total messages exchanged',
      icon: <ForumOutlinedIcon sx={{ color: '#FFFFFF', fontSize: 24 }} />,
      gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
      shadow: '0 4px 14px rgba(236, 72, 153, 0.3)',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 2.5, fontSize: '1.1rem' }}>
        Account Overview & Activity
      </Typography>
      <Grid container spacing={2.5}>
        {cards.map((card, idx) => (
          <Grid size={{ xs: 12, md: 4 }} key={idx}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                bgcolor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
                  borderColor: '#CBD5E1',
                },
              }}
            >
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: '14px',
                  background: card.gradient,
                  boxShadow: card.shadow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {card.title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', my: 0.25, fontSize: '1.35rem' }} noWrap>
                  {card.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }} noWrap>
                  {card.subtitle}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

