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
import ClientEditModal from './ClientEditModal';

interface ClientHeaderProps {
    client: CrmClient;
    contact: Contact | null;
}

export default function ClientHeader({ client, contact }: ClientHeaderProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    return (
        <Box sx={{
            p: 3,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'background.paper'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => router.push('/clients')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar
                    src={contact?.avatar_url || undefined}
                    alt={client?.company_name || client?.email || 'Client'}
                    sx={{ width: 64, height: 64 }}
                />
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {client?.company_name || client?.email || 'Client Name'}
                        </Typography>
                        <Chip
                            label={client?.client_type === 'repeat_customer' ? 'Repeat Customer' : (client?.client_type || 'New').charAt(0).toUpperCase() + (client?.client_type || 'new').slice(1)}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Last active: {client?.last_contact_date ? new Date(client.last_contact_date).toLocaleDateString() : 'Never'}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditModalOpen(true)}
                >
                    Edit
                </Button>
                {client?.phone && (
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<WhatsAppIcon />}
                        onClick={() => window.open(`https://wa.me/${client.phone!.replace(/\D/g, '')}`, '_blank')}
                    >
                        WhatsApp
                    </Button>
                )}
                <Button
                    variant="outlined"
                    startIcon={<ChatIcon />}
                    onClick={() => router.push(`/chat?clientId=${client?.id}`)}
                >
                    Chat
                </Button>
                {client?.email && (
                    <Tooltip title="Send Email">
                        <IconButton onClick={() => window.location.href = `mailto:${client.email}`}>
                            <EmailIcon />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Log Call">
                    <IconButton>
                        <PhoneIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <ClientEditModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                client={client}
            />
        </Box>
    );
}
