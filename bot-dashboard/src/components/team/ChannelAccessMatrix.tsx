// src/components/team/ChannelAccessMatrix.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useChannels } from '@/hooks/useChannels';

interface OrgMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface ChannelAccess {
  user_id: string;
  channel_id: string;
}

export default function ChannelAccessMatrix() {
  const queryClient = useQueryClient();
  const { channels, isLoading: isLoadingChannels } = useChannels();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // Fetch all org members
  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['org_members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_org_members');
      if (error) throw error;
      return data as OrgMember[];
    },
  });

  // Fetch all channel access records
  const { data: accessRecords = [], isLoading: isLoadingAccess } = useQuery({
    queryKey: ['channel_access_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_channel_access')
        .select('user_id, channel_id');
      if (error) throw error;
      return data as ChannelAccess[];
    },
  });

  // Build a Set for fast lookup (derived state — memoized, not effect-driven,
  // to avoid an infinite render loop when accessRecords defaults to a new []).
  const accessSet = useMemo(
    () => new Set(accessRecords.map(r => `${r.user_id}:${r.channel_id}`)),
    [accessRecords],
  );

  const hasAccess = (userId: string, channelId: string) =>
    accessSet.has(`${userId}:${channelId}`);

  // Mutation to toggle access
  const { mutate: toggleAccess, isPending } = useMutation({
    mutationFn: async ({ userId, channelId, grant }: { userId: string; channelId: string; grant: boolean }) => {
      // Get org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (!profile) throw new Error('Profile not found');

      if (grant) {
        const { error } = await supabase
          .from('user_channel_access')
          .insert({
            user_id: userId,
            channel_id: channelId,
            organization_id: profile.organization_id,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_channel_access')
          .delete()
          .eq('user_id', userId)
          .eq('channel_id', channelId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel_access_all'] });
      queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    },
  });

  const isLoading = isLoadingChannels || isLoadingMembers || isLoadingAccess;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Only show non-admin members (admins have all access)
  const nonAdminMembers = members.filter(m => m.role !== 'admin');
  const adminMembers = members.filter(m => m.role === 'admin');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Channel Access
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Control which channels each team member can access. Admins automatically have access to all channels.
      </Typography>

      {adminMembers.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <LockIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Full access (admins):
          </Typography>
          {adminMembers.map(m => (
            <Chip key={m.user_id} label={m.full_name || m.email} size="small" color="error" variant="outlined" />
          ))}
        </Box>
      )}

      {nonAdminMembers.length === 0 ? (
        <Typography color="text.secondary">No non-admin members to configure.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                  Member
                </TableCell>
                {channels.map(ch => (
                  <TableCell key={ch.id} align="center" sx={{ fontWeight: 600, minWidth: 100 }}>
                    <Tooltip title={`${ch.platform} — ${ch.platform_channel_id}`}>
                      <span>{ch.name}</span>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {nonAdminMembers.map(member => (
                <TableRow key={member.user_id} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {member.full_name || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  {channels.map(ch => (
                    <TableCell key={ch.id} align="center">
                      <Checkbox
                        checked={hasAccess(member.user_id, ch.id)}
                        onChange={(e) => toggleAccess({
                          userId: member.user_id,
                          channelId: ch.id,
                          grant: e.target.checked,
                        })}
                        disabled={isPending}
                        size="small"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
}
