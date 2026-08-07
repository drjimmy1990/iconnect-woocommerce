// src/hooks/usePermissions.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';

// --- Types ---

export type UserRole = 'admin' | 'agent' | 'viewer';

export interface UserPermissions {
  role: UserRole;
  isAdmin: boolean;
  canWrite: boolean;
  allowedPages: string[];
  allowedChannelIds: string[] | 'all';
  canAccessPage: (page: string) => boolean;
  canAccessChannel: (channelId: string) => boolean;
}

// --- Default permissions per role ---

const DEFAULT_PAGES_BY_ROLE: Record<UserRole, string[]> = {
  admin: ['home', 'chat', 'clients', 'channels', 'settings', 'analytics', 'team'],
  agent: ['home', 'chat', 'clients'],
  viewer: ['home', 'analytics'],
};

// --- Data fetchers ---

interface ProfileData {
  role: UserRole;
  full_name: string;
  organization_id: string;
}

interface PermissionRow {
  permission: string;
  granted: boolean;
}

interface ChannelAccessRow {
  channel_id: string;
}

async function fetchUserPermissions(userId: string): Promise<UserPermissions> {
  // Fetch in parallel: profile, page permissions overrides, channel access
  const [profileResult, permissionsResult, channelAccessResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, full_name, organization_id')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_permissions')
      .select('permission, granted')
      .eq('user_id', userId),
    supabase
      .from('user_channel_access')
      .select('channel_id')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);

  const profile = profileResult.data as ProfileData;
  const role = (profile.role || 'agent') as UserRole;
  const isAdmin = role === 'admin';

  // Build page permissions: start with defaults, apply overrides
  const defaultPages = [...DEFAULT_PAGES_BY_ROLE[role]];
  const overrides = (permissionsResult.data || []) as PermissionRow[];

  let allowedPages = [...defaultPages];
  for (const override of overrides) {
    const pageName = override.permission.replace('page:', '');
    if (override.granted && !allowedPages.includes(pageName)) {
      allowedPages.push(pageName);
    } else if (!override.granted) {
      allowedPages = allowedPages.filter(p => p !== pageName);
    }
  }

  // Channel access: admin gets 'all', others get explicit list
  const allowedChannelIds: string[] | 'all' = isAdmin
    ? 'all'
    : ((channelAccessResult.data || []) as ChannelAccessRow[]).map(r => r.channel_id);

  return {
    role,
    isAdmin,
    canWrite: role !== 'viewer',
    allowedPages,
    allowedChannelIds,
    canAccessPage: (page: string) => isAdmin || allowedPages.includes(page),
    canAccessChannel: (channelId: string) =>
      isAdmin || (Array.isArray(allowedChannelIds) && allowedChannelIds.includes(channelId)),
  };
}

// --- Hook ---

export function usePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['user_permissions', user?.id],
    queryFn: () => fetchUserPermissions(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Provide safe defaults while loading
  const defaultPermissions: UserPermissions = {
    role: 'viewer',
    isAdmin: false,
    canWrite: false,
    allowedPages: [],
    allowedChannelIds: [],
    canAccessPage: () => false,
    canAccessChannel: () => false,
  };

  return {
    permissions: permissions || defaultPermissions,
    isLoading,
    error,
  };
}
