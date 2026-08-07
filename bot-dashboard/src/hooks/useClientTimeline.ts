'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { CrmActivity, Message } from '@/lib/api';

export type TimelineItem =
    | { type: 'activity'; data: CrmActivity; timestamp: string }
    | { type: 'message'; data: Message; timestamp: string };

async function fetchClientTimeline(clientId: string): Promise<TimelineItem[]> {
    const [activitiesRes, messagesRes] = await Promise.all([
        supabase
            .from('crm_activities')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false }),
        supabase
            .from('messages')
            .select('*')
            .eq('contact_id', (await getContactId(clientId))) // Need to resolve contact_id first
            .order('sent_at', { ascending: false }),
    ]);

    if (activitiesRes.error) throw new Error(activitiesRes.error.message);
    // messagesRes might fail if no contact_id, handle gracefully

    const activities: TimelineItem[] = (activitiesRes.data || []).map((a) => ({
        type: 'activity',
        data: a,
        timestamp: a.created_at,
    }));

    const messages: TimelineItem[] = (messagesRes.data || []).map((m) => ({
        type: 'message',
        data: m,
        timestamp: m.sent_at,
    }));

    // Merge and sort descending
    return [...activities, ...messages].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

// Helper to get contact_id from client_id
async function getContactId(clientId: string): Promise<string | null> {
    const { data } = await supabase.from('crm_clients').select('contact_id').eq('id', clientId).single();
    return data?.contact_id || null;
}

export const useClientTimeline = (clientId: string | null) => {
    return useQuery({
        queryKey: ['client-timeline', clientId],
        queryFn: () => fetchClientTimeline(clientId!),
        enabled: !!clientId,
    });
};
