// src/hooks/useChannelConfig.ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useChannel } from '@/providers/ChannelProvider'; // Import useChannel to get org_id

// --- TYPESCRIPT INTERFACES ---
export interface EcommerceConfig {
  api_url?: string;
  api_key?: string;
  login_email?: string;
  login_password?: string;
}
export interface NotificationConfig {
  telegram_complaints_group_id?: string;
  telegram_cancellations_group_id?: string;
  telegram_orders_group_id?: string;
}
export interface ChannelConfig {
  channel_id: string;
  organization_id: string;
  ai_model: string;
  ai_temperature: number;
  fallback_model?: string;
  fallback_temperature?: number;
  is_bot_active: boolean;
  is_followup_active: boolean;
  agent_webhook_url?: string;
  ecommerce_config?: EcommerceConfig;
  notification_config?: NotificationConfig;
}
export interface AgentPrompt { id: string; organization_id: string; channel_id: string; agent_id: string; name: string; description: string; system_prompt: string; }
export interface KeywordAction { id: string; organization_id: string; channel_id: string; keyword: string; action_type: string; }
export interface ContentCollection { id: string; organization_id: string; channel_id: string; name: string; collection_id: string; items: string[]; }
export interface FullChannelConfig { config: ChannelConfig; prompts: AgentPrompt[]; keywords: KeywordAction[]; collections: ContentCollection[]; }

// --- PAYLOAD TYPES FOR MUTATIONS ---
export type UpdateConfigPayload = Partial<Omit<ChannelConfig, 'channel_id' | 'organization_id'>>;
export type UpdatePromptPayload = { promptId: string; system_prompt: string };
export type AddKeywordPayload = Omit<KeywordAction, 'id' | 'channel_id' | 'organization_id'>;
export type UpdateKeywordPayload = Omit<KeywordAction, 'channel_id' | 'organization_id'>;
export type AddPromptPayload = Omit<AgentPrompt, 'id' | 'channel_id' | 'organization_id'>;
export type AddCollectionPayload = { name: string; collectionId?: string };
export type UpdateCollectionPayload = { id: string; items: string[]; name?: string; collection_id?: string };

// --- API HELPER FUNCTIONS ---
async function fetchAllConfig(channelId: string): Promise<FullChannelConfig> {
  const [configResult, promptsResult, keywordsResult, collectionsResult] = await Promise.all([
    supabase.from('channel_configurations').select('*').eq('channel_id', channelId).single(),
    supabase.from('agent_prompts').select('*').eq('channel_id', channelId).order('name'),
    supabase.from('keyword_actions').select('*').eq('channel_id', channelId).order('keyword'),
    supabase.from('content_collections').select('*').eq('channel_id', channelId).order('name'),
  ]);
  if (configResult.error) throw new Error(`Channel Config: ${configResult.error.message}`);
  if (promptsResult.error) throw new Error(`Agent Prompts: ${promptsResult.error.message}`);
  if (keywordsResult.error) throw new Error(`Keyword Actions: ${keywordsResult.error.message}`);
  if (collectionsResult.error) throw new Error(`Content Collections: ${collectionsResult.error.message}`);
  if (!configResult.data) throw new Error('Main configuration not found. Please ensure data is seeded.');
  return { config: configResult.data, prompts: promptsResult.data, keywords: keywordsResult.data, collections: collectionsResult.data };
}

// --- THE MAIN HOOK ---
export const useChannelConfig = (channelId: string | null) => {
  const queryClient = useQueryClient();
  const { activeChannel } = useChannel(); // Get the active channel from context to find the org_id
  const queryKey = ['channelConfig', channelId];

  const { data, isLoading, isError, error } = useQuery<FullChannelConfig>({ queryKey, queryFn: () => fetchAllConfig(channelId!), enabled: !!channelId });

  const { mutate: addPrompt, isPending: isAddingPrompt } = useMutation({
    mutationFn: async (payload: AddPromptPayload) => {
        if (!activeChannel) throw new Error("No active channel selected");
        const { error } = await supabase.from('agent_prompts').insert({ 
            ...payload, 
            channel_id: channelId!,
            organization_id: activeChannel.organization_id // Pass the organization_id
        });
        if(error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutate: addKeyword, isPending: isAddingKeyword } = useMutation({
    mutationFn: async (payload: AddKeywordPayload) => {
      if (!activeChannel) throw new Error("No active channel selected");
      const { error } = await supabase.from('keyword_actions').insert({ 
          ...payload, 
          channel_id: channelId!,
          organization_id: activeChannel.organization_id // Pass the organization_id
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutate: addCollection, isPending: isAddingCollection } = useMutation({
      mutationFn: async (payload: AddCollectionPayload) => {
          if (!activeChannel) throw new Error("No active channel selected");
          const { error } = await supabase.from('content_collections').insert({
              name: payload.name,
              collection_id: payload.collectionId || payload.name.toLowerCase().replace(/\s+/g, '_'),
              channel_id: channelId!,
              organization_id: activeChannel.organization_id, // Pass the organization_id
              items: []
          });
          if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Other mutations like updateConfig, updatePrompt, etc. do not need changes
  // as they operate on existing rows via their primary key 'id'.
  const { mutate: updateConfig, isPending: isUpdatingConfig } = useMutation({ mutationFn: async (payload: UpdateConfigPayload) => { const { error } = await supabase.from('channel_configurations').update(payload).eq('channel_id', channelId!); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });
  const { mutate: updatePrompt, isPending: isUpdatingPrompt } = useMutation({ mutationFn: async (payload: UpdatePromptPayload) => { const { error } = await supabase.from('agent_prompts').update({ system_prompt: payload.system_prompt }).eq('id', payload.promptId); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });
  const { mutate: deleteKeyword, isPending: isDeletingKeyword } = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from('keyword_actions').delete().eq('id', id); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });
  const { mutate: updateKeyword, isPending: isUpdatingKeyword } = useMutation({ mutationFn: async (payload: UpdateKeywordPayload) => { const { error } = await supabase.from('keyword_actions').update({ keyword: payload.keyword, action_type: payload.action_type }).eq('id', payload.id); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });
  const { mutate: updateCollection, isPending: isUpdatingCollection } = useMutation({ mutationFn: async (payload: UpdateCollectionPayload) => { const updateData: Record<string, unknown> = { items: payload.items }; if (payload.name) updateData.name = payload.name; if (payload.collection_id) updateData.collection_id = payload.collection_id; const { error } = await supabase.from('content_collections').update(updateData).eq('id', payload.id); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });
  const { mutate: deleteCollection, isPending: isDeletingCollection } = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from('content_collections').delete().eq('id', id); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey }), });

  return { data, isLoading, isError, error, updateConfig, isUpdatingConfig, updatePrompt, isUpdatingPrompt, addPrompt, isAddingPrompt, addKeyword, isAddingKeyword, deleteKeyword, isDeletingKeyword, updateKeyword, isUpdatingKeyword, addCollection, isAddingCollection, updateCollection, isUpdatingCollection, deleteCollection, isDeletingCollection };
};