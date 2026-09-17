import React from 'react';
import { Box, Typography, Divider, Chip, Stack, LinearProgress, Tooltip } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { CrmClient, Contact } from '@/lib/api';

// Client Lifecycle Funnel Stages based on client_type
const CLIENT_STAGE_CONFIG: Record<string, { label: string; color: string; step: number; emoji: string }> = {
    new: { label: 'New Lead', color: '#3b82f6', step: 1, emoji: '🆕' },
    interested: { label: 'Interested', color: '#f59e0b', step: 2, emoji: '👀' },
    customer: { label: 'Customer', color: '#10b981', step: 3, emoji: '🛍️' },
    repeat_customer: { label: 'Repeat Customer', color: '#8b5cf6', step: 4, emoji: '⭐' },
    inactive: { label: 'Inactive', color: '#6b7280', step: 0, emoji: '💤' },
    support: { label: 'Support', color: '#ef4444', step: 0, emoji: '🛠️' },
};

const FUNNEL_STAGES = Object.values(CLIENT_STAGE_CONFIG).filter((s) => s.step > 0);

interface ClientSidebarProps {
    client: CrmClient;
    contact: Contact | null;
}

export default function ClientSidebar({ client, contact }: ClientSidebarProps) {
    // Helper to get channel name safely
    // contact.channels can be an object or an array depending on the join
    const channelName = contact?.channels
        ? (Array.isArray(contact.channels) ? contact.channels[0]?.name : contact.channels.name)
        : 'Unknown Channel';

    const platformName = contact?.platform || 'Unknown Platform';

    // Primary stage is client_type (new -> interested -> customer -> repeat_customer)
    const currentStageKey = client?.client_type || 'new';
    const stageInfo = CLIENT_STAGE_CONFIG[currentStageKey] || {
        label: currentStageKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        color: '#667eea',
        step: 1,
        emoji: '📌',
    };
    const isOffFunnel = stageInfo.step === 0;
    const stageProgress = isOffFunnel ? 0 : (stageInfo.step / FUNNEL_STAGES.length) * 100;

    return (
        <Box sx={{ p: 3, height: '100%', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                CONTACT DETAILS
            </Typography>

            <Stack spacing={2} sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                        {client?.email || 'No email'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                        {client?.phone || 'No phone'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                        {client?.address && typeof client.address === 'object' && 'city' in client.address ? (client.address as { city: string }).city : 'Unknown Location'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ChatBubbleOutlineIcon fontSize="small" color="action" />
                    <Box>
                        <Typography variant="body2" fontWeight="medium">
                            {platformName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {channelName}
                        </Typography>
                    </Box>
                </Box>
            </Stack>

            <Divider sx={{ my: 3 }} />

            {/* Client Stage */}
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                CLIENT STAGE
            </Typography>
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                        label={`${stageInfo.emoji} ${stageInfo.label}`}
                        size="small"
                        sx={{
                            bgcolor: `${stageInfo.color}20`,
                            color: stageInfo.color,
                            fontWeight: 600,
                            border: `1px solid ${stageInfo.color}40`,
                        }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {isOffFunnel ? 'Off-funnel' : `${stageInfo.step}/${FUNNEL_STAGES.length}`}
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={stageProgress}
                    sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'grey.100',
                        '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: stageInfo.color,
                        },
                    }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    {FUNNEL_STAGES.map((s) => (
                        <Tooltip key={s.label} title={s.label} arrow>
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: !isOffFunnel && s.step <= stageInfo.step ? stageInfo.color : 'grey.300',
                                    transition: 'background-color 0.3s',
                                }}
                            />
                        </Tooltip>
                    ))}
                </Box>
                {client?.conversation_stage && client.conversation_stage !== 'first_contact' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Bot: {client.conversation_stage.replace(/_/g, ' ')}
                    </Typography>
                )}
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                ATTRIBUTES
            </Typography>

            <Stack spacing={2} sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="caption" color="text.secondary">Source</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                            {client?.source || 'Direct'}
                        </Typography>
                    </Box>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary">Assigned Agent</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                            {/* TODO: Fetch agent name from ID */}
                            {client?.assigned_to ? 'Assigned' : 'Unassigned'}
                        </Typography>
                    </Box>
                </Box>
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                TAGS
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Array.from(new Set(client?.tags || [])).map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" />
                ))}
                {(!client?.tags || client.tags.length === 0) && (
                    <Typography variant="body2" color="text.secondary">No tags</Typography>
                )}
            </Box>
        </Box>
    );
}

