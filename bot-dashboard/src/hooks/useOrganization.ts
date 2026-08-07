'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';

export const useOrganization = () => {
    const { user } = useAuth();

    return useQuery({
        queryKey: ['organization', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data?.organization_id;
        },
        enabled: !!user?.id,
    });
};
