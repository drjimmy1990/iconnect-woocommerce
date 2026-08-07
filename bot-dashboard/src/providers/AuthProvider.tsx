'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export interface UserProfile {
    role: 'admin' | 'agent' | 'viewer';
    full_name: string;
    organization_id: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    profile: UserProfile | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => { },
    profile: null,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch profile when user changes
    useEffect(() => {
        async function fetchProfile(userId: string) {
            const { data } = await supabase
                .from('profiles')
                .select('role, full_name, organization_id')
                .eq('id', userId)
                .single();

            if (data) {
                setProfile(data as UserProfile);
            }
        }

        if (user) {
            fetchProfile(user.id);
        } else {
            setProfile(null);
        }
    }, [user]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut, profile }}>
            {children}
        </AuthContext.Provider>
    );
}
