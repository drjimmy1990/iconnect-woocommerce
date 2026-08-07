import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface CrmTag {
    id: string;
    name: string;
    color: string;
    category?: string;
}

async function fetchTags() {
    const { data, error } = await supabase
        .from('crm_tags')
        .select('*')
        .order('name');

    if (error) {
        throw new Error(error.message);
    }

    return data as CrmTag[];
}

export const useTags = () => {
    return useQuery({
        queryKey: ['crm_tags'],
        queryFn: fetchTags,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
