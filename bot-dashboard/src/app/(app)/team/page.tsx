// src/app/(app)/team/page.tsx
'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import TeamMembersList from '@/components/team/TeamMembersList';
import ChannelAccessMatrix from '@/components/team/ChannelAccessMatrix';
import InviteMemberDialog from '@/components/team/InviteMemberDialog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

export default function TeamPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <GroupsIcon sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={600}>
          Team Management
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Members" />
          <Tab label="Channel Access" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabIndex} index={0}>
            <TeamMembersList onInvite={() => setInviteOpen(true)} />
          </TabPanel>
          <TabPanel value={tabIndex} index={1}>
            <ChannelAccessMatrix />
          </TabPanel>
        </Box>
      </Paper>

      <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Box>
  );
}
