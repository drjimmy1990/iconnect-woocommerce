import React from 'react';
import { Box, Typography, Divider, Chip, Stack, LinearProgress } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import HeightIcon from '@mui/icons-material/Height';
import CakeIcon from '@mui/icons-material/Cake';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import { CrmClient, Contact } from '@/lib/api';

const STAGE_CONFIG: Record<string, { label: string; color: string; step: number }> = {
    first_contact: { label: 'First Contact', color: '#94a3b8', step: 1 },
    bmi_collected: { label: 'BMI Collected', color: '#3b82f6', step: 2 },
    testimonials_viewed: { label: 'Testimonials', color: '#8b5cf6', step: 3 },
    price_viewed: { label: 'Price Viewed', color: '#f59e0b', step: 4 },
    purchased: { label: 'Purchased', color: '#22c55e', step: 5 },
};

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

    const currentStage = client?.conversation_stage || 'first_contact';
    const stageInfo = STAGE_CONFIG[currentStage] || STAGE_CONFIG.first_contact;
    const stageProgress = (stageInfo.step / 5) * 100;

    const bmi = client?.bmi_data;

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

            {/* Conversation Stage */}
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                CONVERSATION STAGE
            </Typography>
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                        label={stageInfo.label}
                        size="small"
                        sx={{
                            bgcolor: `${stageInfo.color}20`,
                            color: stageInfo.color,
                            fontWeight: 600,
                            border: `1px solid ${stageInfo.color}40`,
                        }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {stageInfo.step}/5
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
                    {Object.values(STAGE_CONFIG).map((s) => (
                        <Box
                            key={s.label}
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: s.step <= stageInfo.step ? stageInfo.color : 'grey.300',
                                transition: 'background-color 0.3s',
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* BMI Data */}
            {bmi && (
                <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        BMI DATA
                    </Typography>
                    <Box
                        sx={{
                            bgcolor: 'grey.50',
                            borderRadius: 2,
                            p: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FitnessCenterIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>Weight</Typography>
                                    <Typography variant="body2" fontWeight={600}>{bmi.weight} kg</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HeightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>Height</Typography>
                                    <Typography variant="body2" fontWeight={600}>{bmi.height} cm</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CakeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>Age</Typography>
                                    <Typography variant="body2" fontWeight={600}>{bmi.age} yrs</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MonitorWeightIcon sx={{ fontSize: 16, color: bmi.bmi >= 30 ? 'error.main' : bmi.bmi >= 25 ? 'warning.main' : 'success.main' }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>BMI</Typography>
                                    <Typography
                                        variant="body2"
                                        fontWeight={700}
                                        color={bmi.bmi >= 30 ? 'error.main' : bmi.bmi >= 25 ? 'warning.main' : 'success.main'}
                                    >
                                        {bmi.bmi.toFixed(1)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                        <Chip
                            label={
                                bmi.bmi >= 30 ? 'Obese' :
                                bmi.bmi >= 25 ? 'Overweight' :
                                bmi.bmi >= 18.5 ? 'Normal' : 'Underweight'
                            }
                            size="small"
                            sx={{
                                mt: 1.5,
                                fontWeight: 600,
                                bgcolor: bmi.bmi >= 30 ? '#fef2f2' : bmi.bmi >= 25 ? '#fffbeb' : '#f0fdf4',
                                color: bmi.bmi >= 30 ? '#dc2626' : bmi.bmi >= 25 ? '#d97706' : '#16a34a',
                                border: '1px solid',
                                borderColor: bmi.bmi >= 30 ? '#fecaca' : bmi.bmi >= 25 ? '#fde68a' : '#bbf7d0',
                            }}
                        />
                    </Box>
                </>
            )}

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

