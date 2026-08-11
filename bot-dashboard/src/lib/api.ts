/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/api.ts
import { supabase } from './supabaseClient';

// --- Type Definitions ---
// These interfaces define the shape of our data.

// --- CORE CHAT INTERFACES (Existing) ---
export interface Contact {
  id: string;
  channel_id: string;
  platform: 'whatsapp' | 'facebook' | 'instagram';
  platform_user_id: string;
  name: string;
  avatar_url: string | null;
  ai_enabled: boolean;
  is_followup_active: boolean;
  last_interaction_at: string;
  last_message_preview: string;
  unread_count: number;
  crm_clients: { id: string }[] | null;
  channels?: { name: string; platform: string } | { name: string; platform: string }[];
}

export interface Message {
  id: string;
  contact_id: string;
  sender_type: 'user' | 'agent' | 'ai' | 'system';
  content_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location';
  text_content: string | null;
  attachment_url: string | null;
  attachment_metadata: {
    mime_type?: string;
    file_size?: number;
    duration_seconds?: number;
    width?: number;
    height?: number;
    file_name?: string;
  } | null;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
}


// --- NEW CRM INTERFACES ---

export interface CrmClient {
  id: string;
  organization_id: string;
  contact_id: string | null;
  client_type: 'new' | 'interested' | 'customer' | 'repeat_customer' | 'inactive';
  company_name: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  address: { [key: string]: any } | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  platform_user_id: string | null;
  source: string | null;
  lead_score: number;
  lead_quality: 'hot' | 'warm' | 'cold' | null;
  assigned_to: string | null;
  assigned_team: string | null;
  tags: string[] | null;
  custom_fields: { [key: string]: any } | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  conversation_stage: 'first_contact' | 'browsing' | 'product_viewed' | 'order_placed' | 'purchased' | 'support' | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  organization_id: string;
  client_id: string | null;
  deal_id: string | null;
  message_id: string | null;
  activity_type: 'call' | 'email' | 'meeting' | 'task' | 'note' | 'chatbot_interaction' | 'website_visit';
  subject: string;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null; // Profile UUID
  created_by: string | null; // Profile UUID
  metadata: { [key: string]: any } | null;
  created_at: string;
  updated_at: string;
}

export interface CrmNote {
  id: string;
  organization_id: string;
  client_id: string | null;
  deal_id: string | null;
  title: string | null;
  content: string;
  note_type: 'general' | 'call_log' | 'meeting_summary' | 'important' | null;
  is_pinned: boolean;
  tags: string[] | null;
  created_by: string | null; // Profile UUID
  created_at: string;
  updated_at: string;
}

export interface CrmTag {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  category: string | null;
  created_at: string;
}



// Order Item (JSONB structure)
export interface CrmOrderItem {
  name: string;
  quantity: number;
  price: number;
}

// Shipping Address (JSONB structure)
export interface CrmShippingAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
}

// CRM Order - matches crm_orders table
export interface CrmOrder {
  id: string;
  organization_id: string;
  client_id: string;
  deal_id: string | null;
  order_number: string;
  ecommerce_order_id: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  fulfillment_status: 'unfulfilled' | 'preparing' | 'ready' | 'fulfilled';
  items: CrmOrderItem[] | null;
  shipping_address: CrmShippingAddress | null;
  tracking_number: string | null;
  order_date: string;
  shipped_date: string | null;
  delivered_date: string | null;
  created_at: string;
  updated_at: string;
}


// --- API Functions (Existing) ---
// All functions now use direct Supabase SDK calls, relying on RLS for security.

/**
 * Fetches all contacts for a specific channel.
 * @param channelId - The UUID of the channel.
 */
export const getContacts = async (channelId: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('channel_id', channelId)
    .order('last_interaction_at', { ascending: false });

  if (error) {
    console.error("Error fetching contacts:", error);
    throw new Error(error.message);
  }
  return data || [];
};

/**
 * Fetches all messages for a specific contact.
 * @param contactId - The UUID of the contact.
 */
export const getMessagesForContact = async (contactId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    throw new Error(error.message);
  }
  return data || [];
};

/**
 * Marks all unread user messages in a chat as read.
 * @param contactId - The UUID of the contact.
 */
export const markChatAsRead = async (contactId: string) => {
  const { error } = await supabase
    .from('messages')
    .update({ is_read_by_agent: true })
    .eq('contact_id', contactId)
    .eq('sender_type', 'user'); // Only mark user messages as read

  if (error) {
    console.error("Error marking chat as read:", error);
    throw new Error(error.message);
  }
  return { success: true };
}

/**
 * Updates the name of a contact.
 * @param params - Object containing contactId and the newName.
 */
export const updateContactName = async ({ contactId, newName }: { contactId: string, newName: string }) => {
  const { data, error } = await supabase
    .from('contacts')
    .update({ name: newName })
    .eq('id', contactId)
    .select()
    .single();

  if (error) {
    console.error("Error updating contact name:", error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Toggles the AI-enabled status for a contact.
 * @param params - Object containing contactId and the newStatus.
 */
export const toggleAiStatus = async ({ contactId, newStatus }: { contactId: string, newStatus: boolean }) => {
  const { error } = await supabase
    .from('contacts')
    .update({ ai_enabled: newStatus })
    .eq('id', contactId);

  if (error) {
    console.error("Error toggling AI status:", error);
    throw new Error(error.message);
  }
  return { success: true };
}

/**
 * Toggles the AI follow-up status for a contact.
 * @param params - Object containing contactId and the newStatus.
 */
export const toggleFollowupStatus = async ({ contactId, newStatus }: { contactId: string, newStatus: boolean }) => {
  const { error } = await supabase
    .from('contacts')
    .update({ is_followup_active: newStatus })
    .eq('id', contactId);

  if (error) {
    console.error("Error toggling follow-up status:", error);
    throw new Error(error.message);
  }
  return { success: true };
}

/**
 * Deletes a contact and their associated messages (via DB cascade).
 * @param contactId - The UUID of the contact to delete.
 */
export const deleteContact = async (contactId: string) => {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    console.error("Error deleting contact:", error);
    throw new Error(error.message);
  }
  return { success: true };
}

/**
 * Sends a message from an agent by calling an n8n webhook.
 * n8n handles: sending via Graph API + saving to DB.
 * The webhook URL is resolved from channel_configurations (per-channel),
 * with a fallback to the NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL env var.
 * @param payload - The complete message payload including platform identifiers.
 */
export const sendMessage = async (payload: {
  // --- IDs for DB storage ---
  contact_id: string;
  channel_id: string;
  organization_id: string;
  // --- Message content ---
  content_type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text_content?: string;
  attachment_url?: string;
  attachment_metadata?: {
    mime_type?: string;
    file_size?: number;
    duration_seconds?: number;
    width?: number;
    height?: number;
    file_name?: string;
  };
  // --- Platform identifiers (for Graph API targeting) ---
  platform: string;
  platform_user_id: string;       // Recipient's Facebook/IG/WA ID
  platform_channel_id: string;    // Page ID / WA Business Account ID
}) => {
  // 1. Try to get per-channel webhook URL from channel_configurations
  let webhookUrl: string | undefined;

  const { data: configData } = await supabase
    .from('channel_configurations')
    .select('agent_webhook_url')
    .eq('channel_id', payload.channel_id)
    .single();

  webhookUrl = configData?.agent_webhook_url || undefined;

  // 2. Fallback to environment variable
  if (!webhookUrl) {
    webhookUrl = process.env.NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL;
  }

  if (!webhookUrl) {
    throw new Error(
      'N8N agent webhook URL is not configured. Set it in Channel Settings → Webhook Integration, or set NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL in your .env.local file.'
    );
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // IDs
      contact_id: payload.contact_id,
      channel_id: payload.channel_id,
      organization_id: payload.organization_id,
      // Platform targeting
      platform: payload.platform,
      platform_user_id: payload.platform_user_id,
      platform_channel_id: payload.platform_channel_id,
      // Message content
      content_type: payload.content_type,
      text_content: payload.text_content || null,
      attachment_url: payload.attachment_url || null,
      attachment_metadata: payload.attachment_metadata || null,
      // Metadata
      sender_type: 'agent',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('n8n webhook error:', errorText);
    throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // n8n should return the saved message record
  return data.message || data;
}