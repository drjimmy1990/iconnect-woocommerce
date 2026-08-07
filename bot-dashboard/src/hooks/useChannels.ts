// src/hooks/useChannels.ts

'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';

// Helper hook to reliably get the current user session.
function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { setUser(session?.user ?? null); setLoading(false); });
        supabase.auth.getSession().then(({ data: { session } }) => { if (!user) setUser(session?.user ?? null); setLoading(false); });
        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { user, loading };
}

// Type definitions for the channel and its creation payload.
export interface Channel { id: string; organization_id: string; name: string; platform: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'web'; platform_channel_id: string; is_active: boolean; }
export type NewChannelPayload = { name: string; platform: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'web'; platform_channel_id: string; };

// Async function to fetch all channels for the logged-in user.
async function fetchChannels(): Promise<Channel[]> {
    const { data, error } = await supabase.from('channels').select('id, organization_id, name, platform, platform_channel_id, is_active').order('name');
    if (error) throw error;
    return data || [];
}

// The main hook for managing channels.
export const useChannels = () => {
    const queryClient = useQueryClient();
    const { user, loading: isAuthLoading } = useAuth();
    const queryKey = ['channels', user?.id];

    // The query to fetch channels, enabled only when the user is logged in.
    const { data: channels = [], isLoading, isError, error } = useQuery({ queryKey, queryFn: fetchChannels, enabled: !!user });

    // The mutation to add a new channel and its default settings.
    const { mutate: addChannel, isPending: isAdding } = useMutation({
        mutationFn: async (newChannel: NewChannelPayload) => {
            // Step 1: Call the simplified RPC function to create the channel and config.
            const { data, error: rpcError } = await supabase.rpc('create_channel_and_config', {
                channel_name: newChannel.name,
                channel_platform: newChannel.platform,
                platform_id: newChannel.platform_channel_id
            });

            if (rpcError) throw rpcError;

            // The RPC function now returns the new channel's ID and its organization ID.
            const newChannelId = data.id;
            const orgId = data.organization_id;

            // Step 2: The frontend now creates the defaults using simple, direct INSERTs.
            // RLS can easily and correctly validate these direct requests.
            const defaultPrompts = [
                { channel_id: newChannelId, organization_id: orgId, agent_id: 'main_sales_agent', name: 'Main Sales Agent', description: 'Primary AI for new inquiries.', system_prompt: 'You are a helpful assistant.' },
                { channel_id: newChannelId, organization_id: orgId, agent_id: 're_engagement_agent', name: 'Re-engagement Bot', description: 'Follows up with silent users.', system_prompt: 'Just checking in to see if you had any other questions.' }
            ];
            const defaultKeywords = [
                { channel_id: newChannelId, organization_id: orgId, keyword: '8', action_type: 'DISABLE_AI' },
                { channel_id: newChannelId, organization_id: orgId, keyword: '9', action_type: 'ENABLE_AI' }
            ];
            const defaultCollections = [
                { channel_id: newChannelId, organization_id: orgId, collection_id: 'testimonials_1', name: 'Testimonials', items: [] }
            ];

            // Use Promise.all to run these creations in parallel for efficiency.
            const [promptsResult, keywordsResult, collectionsResult] = await Promise.all([
                supabase.from('agent_prompts').insert(defaultPrompts),
                supabase.from('keyword_actions').insert(defaultKeywords),
                supabase.from('content_collections').insert(defaultCollections)
            ]);

            // Check for errors in any of the default creation steps.
            if (promptsResult.error) throw promptsResult.error;
            if (keywordsResult.error) throw keywordsResult.error;
            if (collectionsResult.error) throw collectionsResult.error;
        },
        onSuccess: () => {
            // Refresh the channel list after a successful creation.
            queryClient.invalidateQueries({ queryKey });
        }
    });

    return { channels, isLoading: isAuthLoading || isLoading, isError, error, addChannel, isAdding };
};