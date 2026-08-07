// src/components/team/TeamMembersList.tsx
'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import RoleSelector from './RoleSelector';

interface OrgMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string | null;
}

interface TeamMembersListProps {
  onInvite: () => void;
}

export default function TeamMembersList({ onInvite }: TeamMembersListProps) {
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // Fetch all org members via the RPC
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org_members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_org_members');
      if (error) throw error;
      return data as OrgMember[];
    },
  });

  // Mutation to update a user's role
  const { mutate: updateRole, isPending: isUpdating } = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_members'] });
      queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
      setEditingUserId(null);
      setSnackbar({ open: true, message: 'Role updated!', severity: 'success' });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    },
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'agent': return 'primary';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Team Members ({members.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={onInvite}
        >
          Invite Member
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.user_id} hover>
                <TableCell>{member.full_name || '—'}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {editingUserId === member.user_id ? (
                    <RoleSelector
                      value={member.role}
                      onChange={(newRole) => updateRole({ userId: member.user_id, newRole })}
                      onCancel={() => setEditingUserId(null)}
                      disabled={isUpdating}
                    />
                  ) : (
                    <Chip
                      label={member.role}
                      color={getRoleColor(member.role) as 'error' | 'primary' | 'default'}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {editingUserId !== member.user_id && (
                    <Tooltip title="Change Role">
                      <IconButton size="small" onClick={() => setEditingUserId(member.user_id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
