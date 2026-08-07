'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/hooks/useOrganization';
import { Snackbar, Alert, Button } from '@mui/material';
import { useRouter } from 'next/navigation';

export interface SystemNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    client_id?: string;
    created_at: string;
}

interface NotificationContextType {
    unreadCount: number;
    notifications: SystemNotification[];
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    isMuted: boolean;
    toggleMute: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { data: orgId } = useOrganization();
    const router = useRouter();

    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Local state for the "Popup" toast
    const [toastOpen, setToastOpen] = useState(false);
    const [currentToast, setCurrentToast] = useState<SystemNotification | null>(null);

    // Mute State (persisted in localStorage)
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedMute = localStorage.getItem('notification_mute');
            if (storedMute) setIsMuted(JSON.parse(storedMute));

            // Request browser notification permission on load
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    const toggleMute = useCallback(() => {
        const newState = !isMuted;
        setIsMuted(newState);
        if (typeof window !== 'undefined') {
            localStorage.setItem('notification_mute', JSON.stringify(newState));
        }
    }, [isMuted]);

    // Browser Native Notification
    const showBrowserNotification = useCallback((notification: SystemNotification) => {
        if (isMuted) return;
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const browserNotif = new Notification(notification.title, {
            body: notification.message || 'New notification',
            icon: '/favicon.ico',
            tag: notification.id, // Prevents duplicate notifications
            requireInteraction: true, // Keep visible until user interacts
        });

        browserNotif.onclick = () => {
            window.focus();
            if (notification.client_id) {
                router.push(`/clients/${notification.client_id}`);
            }
            browserNotif.close();
        };
    }, [isMuted, router]);

    // Sound Effect
    const playSound = useCallback(() => {
        if (isMuted) return;
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.play().catch(e => console.log("Audio play blocked", e));
        } catch (e) {
            console.error(e);
        }
    }, [isMuted]);

    // Fetch Initial Data
    const fetchNotifications = useCallback(async () => {
        if (!orgId) return;
        const { data } = await supabase
            .from('system_notifications')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    }, [orgId]);

    useEffect(() => {
        if (orgId) fetchNotifications();
    }, [orgId, fetchNotifications]);

    // Realtime Subscription
    useEffect(() => {
        if (!orgId) return;

        const channel = supabase
            .channel('org-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'system_notifications',
                    filter: `organization_id=eq.${orgId}`,
                },
                (payload) => {
                    const newNotif = payload.new as SystemNotification;

                    // 1. Update State
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // 2. Trigger Alerts (if not muted)
                    if (!isMuted) {
                        setCurrentToast(newNotif);
                        setToastOpen(true);
                        playSound();
                        showBrowserNotification(newNotif); // Native browser notification
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId, isMuted, playSound, showBrowserNotification]);

    // Actions
    const markAsRead = useCallback(async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        await supabase.from('system_notifications').update({ is_read: true }).eq('id', id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!orgId) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        await supabase
            .from('system_notifications')
            .update({ is_read: true })
            .eq('organization_id', orgId)
            .eq('is_read', false);
    }, [orgId]);

    const handleToastClick = () => {
        if (currentToast?.client_id) {
            router.push(`/clients/${currentToast.client_id}`);
            markAsRead(currentToast.id);
        }
        setToastOpen(false);
    };

    return (
        <NotificationContext.Provider value={{ unreadCount, notifications, markAsRead, markAllAsRead, isMuted, toggleMute }}>
            {children}

            {/* Global Popup Toast */}
            <Snackbar
                open={toastOpen}
                autoHideDuration={6000}
                onClose={() => setToastOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setToastOpen(false)}
                    severity="warning"
                    variant="filled"
                    sx={{ width: '100%', cursor: 'pointer' }}
                    onClick={handleToastClick}
                    action={
                        currentToast?.client_id && (
                            <Button color="inherit" size="small">
                                View
                            </Button>
                        )
                    }
                >
                    <strong>{currentToast?.title}</strong>: {currentToast?.message}
                </Alert>
            </Snackbar>
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};
