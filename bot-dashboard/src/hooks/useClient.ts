// src/hooks/useClient.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { CrmClient, CrmActivity, CrmNote, Contact, CrmOrder, CrmOrderItem, CrmShippingAddress } from '@/lib/api';

// --- Type Definitions ---

// Define the shape of the data returned by the main hook
export interface Client360Data {
  client: CrmClient;
  contact: Contact | null;
  activities: CrmActivity[];
  notes: CrmNote[];
  orders: CrmOrder[];
  messageCount: number;
}

// Define the payload for updating a client's core details
export type UpdateClientPayload = Partial<Omit<CrmClient, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>;

// Define the payload for creating a new note
export type AddNotePayload = Omit<CrmNote, 'id' | 'organization_id' | 'client_id' | 'created_at' | 'updated_at' | 'created_by'>;

// Define the payload for logging a new activity
export type AddActivityPayload = Omit<CrmActivity, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'>;

// Define the payload for creating a new order
export interface AddOrderPayload {
  order_number: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  status: string;
  fulfillment_status: string;
  items: CrmOrderItem[];
  shipping_address?: CrmShippingAddress | null;
  order_date: string;
}

// --- API Fetcher Function ---

/**
 * Fetches all data related to a single CRM client.
 * @param clientId The UUID of the CRM client.
 */
async function fetchClient360Data(clientId: string): Promise<Client360Data> {
  // Fetch all required data in parallel for maximum efficiency
  const [clientRes, activitiesRes, notesRes, ordersRes] = await Promise.all([
    supabase.from('crm_clients').select('*').eq('id', clientId).single(),
    supabase.from('crm_activities').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('crm_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('crm_orders').select('*').eq('client_id', clientId).order('order_date', { ascending: false }),
  ]);

  // Handle potential errors for each query
  if (clientRes.error) throw new Error(`Failed to fetch client: ${clientRes.error.message}`);
  if (activitiesRes.error) throw new Error(`Failed to fetch activities: ${activitiesRes.error.message}`);
  if (notesRes.error) throw new Error(`Failed to fetch notes: ${notesRes.error.message}`);
  if (ordersRes.error) throw new Error(`Failed to fetch orders: ${ordersRes.error.message}`);

  // If the client has an associated contact_id, fetch that contact record as well
  let contact: Contact | null = null;
  let messageCount = 0;

  if (clientRes.data.contact_id) {
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select(`
        *,
        channels (
          name,
          platform
        )
      `)
      .eq('id', clientRes.data.contact_id)
      .single();

    if (contactError) {
      console.warn(`Could not fetch associated contact: ${contactError.message}`);
    } else {
      // Flatten channel info into contact object for easier access if needed, 
      // or just keep it nested. For now, we'll keep it as is but ensure types match.
      contact = contactData as unknown as Contact;

      // Fetch message count
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', clientRes.data.contact_id);

      if (!countError) {
        messageCount = count || 0;
      }
    }
  }

  return {
    client: clientRes.data,
    contact,
    activities: activitiesRes.data || [],
    notes: notesRes.data || [],
    orders: ordersRes.data || [],
    messageCount,
  };
}


// --- Main React Query Hook ---

export const useClient = (clientId: string | null) => {
  const queryClient = useQueryClient();
  const queryKey = ['client', clientId];

  // The main query to fetch all data for the client
  const { data, isLoading, isError, error } = useQuery<Client360Data>({
    queryKey,
    queryFn: () => fetchClient360Data(clientId!),
    enabled: !!clientId, // Only run the query if a clientId is provided
  });

  // --- MUTATIONS ---

  // Mutation to update the core details of the client
  const { mutate: updateClient, isPending: isUpdatingClient } = useMutation({
    mutationFn: async (payload: UpdateClientPayload) => {
      const { error } = await supabase
        .from('crm_clients')
        .update(payload)
        .eq('id', clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      // After a successful update, invalidate the query to refetch fresh data
      queryClient.invalidateQueries({ queryKey });
    },
    // Optional: onError for handling update failures in the UI
  });

  // Mutation to add a new note for the client
  const { mutate: addNote, isPending: isAddingNote } = useMutation({
    mutationFn: async (payload: AddNotePayload) => {
      if (!data?.client) throw new Error("Client data not available.");

      const { error } = await supabase
        .from('crm_notes')
        .insert({
          ...payload,
          client_id: clientId!,
          organization_id: data.client.organization_id, // Get org_id from the fetched client data
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation to log a new activity
  const { mutate: logActivity, isPending: isLoggingActivity } = useMutation({
    mutationFn: async (payload: AddActivityPayload) => {
      if (!data?.client) throw new Error("Client data not available.");

      const { error } = await supabase
        .from('crm_activities')
        .insert({
          ...payload,
          client_id: clientId!,
          organization_id: data.client.organization_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation to add a new order
  const { mutate: addOrder, isPending: isAddingOrder } = useMutation({
    mutationFn: async (payload: AddOrderPayload) => {
      if (!data?.client) throw new Error("Client data not available.");

      const { error } = await supabase
        .from('crm_orders')
        .insert({
          ...payload,
          client_id: clientId!,
          organization_id: data.client.organization_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    clientData: data,
    isLoading,
    isError,
    error,
    updateClient,
    isUpdatingClient,
    addNote,
    isAddingNote,
    logActivity,
    isLoggingActivity,
    addOrder,
    isAddingOrder,
  };
};
