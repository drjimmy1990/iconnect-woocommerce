import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface AgentProfile {
    id: string;
    full_name: string;
    email?: string; // Email might not be in public.profiles depending on privacy settings, but usually we join or it's there.
    avatar_url?: string;
}

async function fetchAgents() {
    // Fetch profiles. We assume profiles are linked to auth.users.
    // We might need to join with auth.users to get email if it's not in profiles, 
    // but for now let's just get what's in profiles.
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

    if (error) {
        throw new Error(error.message);
    }

    return data as AgentProfile[];
}

export const useAgents = () => {
    return useQuery({
        queryKey: ['crm_agents'],
        queryFn: fetchAgents,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};
