// src/hooks/useClientList.ts
'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { CrmClient } from '@/lib/api';
import { useEffect, useState } from 'react';

// --- Debouncing Utility Hook ---
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// --- Type Definitions ---
export interface ClientFilters {
  type?: string[];
  conversation_stage?: string[];
  assignee?: string;
  tags?: string[];
  channel_id?: string;
  created_after?: Date | null;
  created_before?: Date | null;
  last_contact_after?: Date | null;
  last_contact_before?: Date | null;
}

interface UseClientListProps {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  filters?: ClientFilters;
}

export interface ClientListResponse {
  clients: CrmClient[];
  count: number;
}

// --- API Fetcher Function ---
async function fetchClientList({
  page = 0,
  pageSize = 20,
  searchTerm = '',
  filters = {},
}: UseClientListProps): Promise<ClientListResponse> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Use !inner join when filtering by channel so PostgREST filters parent rows
  const contactsJoin = filters.channel_id
    ? 'contacts!crm_clients_contact_id_fkey!inner(channel_id, channels(id, name))'
    : 'contacts!crm_clients_contact_id_fkey(channel_id, channels(id, name))';

  let query = supabase.from('crm_clients').select(`*, ${contactsJoin}`, { count: 'exact' });

  // 1. Search Term
  if (searchTerm) {
    const searchQuery = `%${searchTerm}%`;
    query = query.or(
      `company_name.ilike.${searchQuery},email.ilike.${searchQuery},phone.ilike.${searchQuery},platform_user_id.ilike.${searchQuery}`
    );
  }

  // 2. Type (Client Type)
  if (filters.type && filters.type.length > 0) {
    query = query.in('client_type', filters.type);
  }

  // 4. Conversation Stage
  if (filters.conversation_stage && filters.conversation_stage.length > 0) {
    query = query.in('conversation_stage', filters.conversation_stage);
  }

  // 5. Assignee (Agent)
  if (filters.assignee) {
    if (filters.assignee === 'unassigned') {
      query = query.is('assigned_to', null);
    } else {
      query = query.eq('assigned_to', filters.assignee);
    }
  }

  // 5. Tags (Array Overlap)
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  // 8. Date Ranges
  if (filters.created_after) {
    query = query.gte('created_at', filters.created_after.toISOString());
  }
  if (filters.created_before) {
    query = query.lte('created_at', filters.created_before.toISOString());
  }
  if (filters.last_contact_after) {
    query = query.gte('last_contact_date', filters.last_contact_after.toISOString());
  }
  if (filters.last_contact_before) {
    query = query.lte('last_contact_date', filters.last_contact_before.toISOString());
  }

  // Channel (Page Name) Filter
  if (filters.channel_id) {
    query = query.eq('contacts.channel_id', filters.channel_id);
  }

  // Sorting & Pagination
  query = query
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching client list:", error);
    throw new Error(error.message);
  }

  // Flatten the channel name from the nested join into a top-level field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = (data || []).map((client: any) => {
    const contact = client.contacts;
    const channelName = contact?.channels?.name || null;
    const channelId = contact?.channel_id || null;
    // Remove the nested object to keep CrmClient clean
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contacts: _contacts, ...rest } = client;
    return { ...rest, channel_name: channelName, channel_id_resolved: channelId };
  });

  return { clients, count: count || 0 };
}

// --- Main React Query Hook ---
export const useClientList = ({
  page = 0,
  pageSize = 20,
  searchTerm = '',
  filters = {},
}: UseClientListProps) => {
  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  // Include filters in the query key so it refetches when they change
  const queryKey = ['clientList', page, pageSize, debouncedSearchTerm, filters];

  return useQuery<ClientListResponse>({
    queryKey,
    queryFn: () => fetchClientList({ page, pageSize, searchTerm: debouncedSearchTerm, filters }),
    placeholderData: keepPreviousData,
  });
};