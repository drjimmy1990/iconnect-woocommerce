'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Chip,
    CircularProgress,
    Button,
    Divider
} from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/utils/currency';
import { CrmOrder } from '@/lib/api';

interface RecentContact {
    id: string;
    name: string;
    platform: 'whatsapp' | 'facebook' | 'instagram';
    avatar_url: string | null;
    last_interaction_at: string;
    last_message_preview: string;
    unread_count: number;
}

function timeAgo(dateString: string): string {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPlatformIcon(platform: string) {
    switch (platform?.toLowerCase()) {
        case 'whatsapp':
            return <WhatsAppIcon sx={{ fontSize: 13, color: '#25D366' }} />;
        case 'instagram':
            return <InstagramIcon sx={{ fontSize: 13, color: '#E1306C' }} />;
        case 'facebook':
            return <FacebookIcon sx={{ fontSize: 13, color: '#1877F2' }} />;
        default:
            return <ChatBubbleOutlineIcon sx={{ fontSize: 13, color: '#6366F1' }} />;
    }
}

function getOrderStatusColor(status: string): 'warning' | 'info' | 'success' | 'error' | 'default' {
    switch (status?.toLowerCase()) {
        case 'pending':
            return 'warning';
        case 'processing':
            return 'info';
        case 'shipped':
        case 'delivered':
        case 'completed':
            return 'success';
        case 'cancelled':
        case 'refunded':
            return 'error';
        default:
            return 'default';
    }
}

export default function RecentActivityFeed() {
    const router = useRouter();
    const [tabIndex, setTabIndex] = useState<number>(0);
    const [orders, setOrders] = useState<CrmOrder[]>([]);
    const [contacts, setContacts] = useState<RecentContact[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchActivity() {
            try {
                setIsLoading(true);
                // 1. Fetch recent orders
                const ordersPromise = supabase
                    .from('crm_orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);

                // 2. Fetch recent conversations
                const contactsPromise = supabase
                    .from('contacts')
                    .select('id, name, platform, avatar_url, last_interaction_at, last_message_preview, unread_count')
                    .order('last_interaction_at', { ascending: false })
                    .limit(5);

                const [ordersRes, contactsRes] = await Promise.all([ordersPromise, contactsPromise]);

                if (isMounted) {
                    if (ordersRes.data) {
                        setOrders(ordersRes.data as CrmOrder[]);
                    }
                    if (contactsRes.data) {
                        setContacts(contactsRes.data as RecentContact[]);
                    }
                }
            } catch (err) {
                console.error('Failed to load recent activity feed:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchActivity();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <Paper
            elevation={0}
            sx={{
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: 'rgba(226, 232, 240, 0.8)',
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}
        >
            {/* Header & Tabs */}
            <Box
                sx={{
                    px: 2.5,
                    pt: 2,
                    pb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    gap: 1
                }}
            >
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                        Live Activity Stream
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Real-time WooCommerce orders & client chats
                    </Typography>
                </Box>
                <Tabs
                    value={tabIndex}
                    onChange={(_, v) => setTabIndex(v)}
                    sx={{
                        minHeight: 36,
                        '& .MuiTab-root': {
                            minHeight: 36,
                            py: 0.5,
                            px: 1.5,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textTransform: 'none',
                        }
                    }}
                >
                    <Tab label="Recent Orders" />
                    <Tab label="Live Chats" />
                </Tabs>
            </Box>

            {/* Content List */}
            <Box sx={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, py: 6 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : tabIndex === 0 ? (
                    /* Orders Tab */
                    orders.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, py: 6, color: 'text.secondary' }}>
                            <Typography variant="body2">No recent orders found</Typography>
                        </Box>
                    ) : (
                        <List disablePadding sx={{ flex: 1 }}>
                            {orders.map((order, idx) => (
                                <React.Fragment key={order.id}>
                                    <ListItem
                                        sx={{
                                            py: 1.5,
                                            px: 2.5,
                                            transition: 'background-color 0.2s',
                                            '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.04)' }
                                        }}
                                        secondaryAction={
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                                                    {formatCurrency(order.total, order.currency || 'AED')}
                                                </Typography>
                                                <Chip
                                                    label={order.status}
                                                    size="small"
                                                    color={getOrderStatusColor(order.status)}
                                                    sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, textTransform: 'capitalize' }}
                                                />
                                            </Box>
                                        }
                                    >
                                        <ListItemAvatar sx={{ minWidth: 46 }}>
                                            <Avatar
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    bgcolor: 'rgba(79, 70, 229, 0.1)',
                                                    color: 'primary.main',
                                                }}
                                            >
                                                <ShoppingBagIcon sx={{ fontSize: 18 }} />
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primaryTypographyProps={{ component: 'div' }}
                                            secondaryTypographyProps={{ component: 'div' }}
                                            primary={
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                                                    Order #{order.order_number || order.ecommerce_order_id || order.id.slice(0, 6)}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    {timeAgo(order.order_date || order.created_at)}
                                                    {order.items && order.items.length > 0 && ` • ${order.items.length} item${order.items.length > 1 ? 's' : ''}`}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    {idx < orders.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                    )
                ) : (
                    /* Live Chats Tab */
                    contacts.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, py: 6, color: 'text.secondary' }}>
                            <Typography variant="body2">No recent conversations</Typography>
                        </Box>
                    ) : (
                        <List disablePadding sx={{ flex: 1 }}>
                            {contacts.map((contact, idx) => (
                                <React.Fragment key={contact.id}>
                                    <ListItem
                                        sx={{
                                            py: 1.5,
                                            px: 2.5,
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                            '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.04)' }
                                        }}
                                        onClick={() => router.push('/chat')}
                                        secondaryAction={
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                                    {timeAgo(contact.last_interaction_at)}
                                                </Typography>
                                                {contact.unread_count > 0 && (
                                                    <Chip
                                                        label={contact.unread_count}
                                                        size="small"
                                                        color="primary"
                                                        sx={{ height: 18, minWidth: 18, fontSize: '0.62rem', fontWeight: 800, px: 0.5 }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                    >
                                        <ListItemAvatar sx={{ minWidth: 46 }}>
                                            <Box sx={{ position: 'relative', width: 36, height: 36 }}>
                                                <Avatar
                                                    src={contact.avatar_url || undefined}
                                                    sx={{ width: 36, height: 36, bgcolor: 'primary.light', fontSize: '0.85rem', fontWeight: 700 }}
                                                >
                                                    {contact.name?.charAt(0) || 'U'}
                                                </Avatar>
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        bottom: -2,
                                                        right: -2,
                                                        bgcolor: 'background.paper',
                                                        borderRadius: '50%',
                                                        p: '2px',
                                                        display: 'flex',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {getPlatformIcon(contact.platform)}
                                                </Box>
                                            </Box>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primaryTypographyProps={{ component: 'div' }}
                                            secondaryTypographyProps={{ component: 'div' }}
                                            primary={
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontWeight: 700, color: '#1E293B', pr: 5 }}
                                                    dir="auto"
                                                >
                                                    {contact.name || 'Anonymous User'}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: 'block',
                                                        maxWidth: 240,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    dir="auto"
                                                >
                                                    {contact.last_message_preview || 'No messages yet'}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    {idx < contacts.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                    )
                )}
            </Box>

            {/* Footer View All CTA */}
            <Box sx={{ p: 1.5, px: 2.5, bgcolor: 'rgba(248, 250, 252, 0.7)', borderTop: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
                    onClick={() => router.push(tabIndex === 0 ? '/clients' : '/chat')}
                    sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'none' }}
                >
                    {tabIndex === 0 ? 'View All CRM Orders' : 'Go to Live Chat'}
                </Button>
            </Box>
        </Paper>
    );
}
