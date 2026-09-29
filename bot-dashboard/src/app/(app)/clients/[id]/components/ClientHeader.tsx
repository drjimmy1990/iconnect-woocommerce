import React, { useState } from 'react';
import { Box, Typography, Button, Avatar, Chip, IconButton, Tooltip } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatIcon from '@mui/icons-material/Chat';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/navigation';
import { CrmClient, Contact } from '@/lib/api';
import { resolveClientPhone, getWhatsAppNumber } from '@/utils/phone';
import ClientEditModal from './ClientEditModal';

interface ClientHeaderProps {
    client: CrmClient;
    contact: Contact | null;
}

export default function ClientHeader({ client, contact }: ClientHeaderProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const phone = resolveClientPhone(client, contact);
    const whatsappNumber = phone ? getWhatsAppNumber(phone) : null;

    return (
        <Box sx={{
            p: 2.5,
            px: 3,
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px)',
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Tooltip title="Back to Clients">
                    <IconButton
                        onClick={() => router.push('/clients')}
                        sx={{
                            color: '#64748B',
                            bgcolor: '#F1F5F9',
                            '&:hover': { bgcolor: '#E2E8F0', color: '#0F172A' },
                        }}
                    >
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Avatar
                    src={contact?.avatar_url || undefined}
                    alt={client?.company_name || client?.email || 'Client'}
                    sx={{
                        width: 56,
                        height: 56,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        border: '2px solid #FFFFFF',
                        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                        fontWeight: 700,
                        fontSize: '1.2rem',
                    }}
                >
                    {(client?.company_name || client?.email || '?').substring(0, 2).toUpperCase()}
                </Avatar>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.3rem' }}>
                            {client?.company_name || client?.email || 'Client Name'}
                        </Typography>
                        <Chip
                            label={client?.client_type === 'repeat_customer' ? '⭐ Repeat VIP' : client?.client_type === 'customer' ? '🛍️ Customer' : client?.client_type === 'interested' ? '👀 Interested' : '🆕 New'}
                            size="small"
                            sx={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                bgcolor: client?.client_type === 'repeat_customer' ? 'rgba(139, 92, 246, 0.12)' : client?.client_type === 'customer' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                color: client?.client_type === 'repeat_customer' ? '#7C3AED' : client?.client_type === 'customer' ? '#047857' : '#1D4ED8',
                                border: '1px solid',
                                borderColor: client?.client_type === 'repeat_customer' ? 'rgba(139, 92, 246, 0.25)' : client?.client_type === 'customer' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                            }}
                        />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748B', mt: 0.25, fontSize: '0.82rem' }}>
                        Last active: {client?.last_contact_date ? new Date(client.last_contact_date).toLocaleDateString() : 'Never'}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                <Button
                    variant="outlined"
                    startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setIsEditModalOpen(true)}
                    size="small"
                    sx={{
                        borderRadius: '20px',
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: '#E2E8F0',
                        color: '#334155',
                        '&:hover': { bgcolor: '#F8FAFC', borderColor: '#CBD5E1' },
                    }}
                >
                    Edit Profile
                </Button>
                {whatsappNumber && (
                    <Button
                        variant="contained"
                        startIcon={<WhatsAppIcon sx={{ fontSize: 16 }} />}
                        onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}
                        size="small"
                        sx={{
                            borderRadius: '20px',
                            textTransform: 'none',
                            fontWeight: 600,
                            bgcolor: '#25D366',
                            color: '#FFFFFF',
                            boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                            '&:hover': { bgcolor: '#1EBE5D' },
                        }}
                    >
                        WhatsApp
                    </Button>
                )}
                <Button
                    variant="contained"
                    startIcon={<ChatIcon sx={{ fontSize: 16 }} />}
                    onClick={() => router.push(`/chat?client=${client.id}`)}
                    size="small"
                    sx={{
                        borderRadius: '20px',
                        textTransform: 'none',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                        '&:hover': { background: 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)' },
                    }}
                >
                    Open Chat
                </Button>
                {client?.email && (
                    <Tooltip title={`Send Email to ${client.email}`}>
                        <IconButton
                            size="small"
                            onClick={() => window.location.href = `mailto:${client.email}`}
                            sx={{ color: '#64748B', bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E2E8F0', color: '#0F172A' } }}
                        >
                            <EmailIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {phone && (
                    <Tooltip title={`Call ${phone}`}>
                        <IconButton
                            size="small"
                            onClick={() => window.location.href = `tel:${phone}`}
                            sx={{ color: '#64748B', bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E2E8F0', color: '#0F172A' } }}
                        >
                            <PhoneIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <ClientEditModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                client={client}
            />
        </Box>
    );
}
