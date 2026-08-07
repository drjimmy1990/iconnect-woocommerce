// src/components/chat/MessageBubble.tsx
import React from 'react';
import { Box, Paper, Typography, Avatar, Chip } from '@mui/material';
import { Message } from '@/lib/api';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';

interface MessageBubbleProps {
  message: Message;
  platform: 'whatsapp' | 'facebook' | 'instagram' | string;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DeliveryIndicator: React.FC<{ status?: string }> = ({ status }) => {
  const iconSx = { fontSize: '0.85rem', ml: 0.5, verticalAlign: 'middle' };
  switch (status) {
    case 'pending':
      return <ScheduleIcon sx={{ ...iconSx, color: 'text.disabled' }} />;
    case 'sent':
      return <DoneIcon sx={{ ...iconSx, color: 'text.secondary' }} />;
    case 'delivered':
      return <DoneAllIcon sx={{ ...iconSx, color: 'text.secondary' }} />;
    case 'read':
      return <DoneAllIcon sx={{ ...iconSx, color: '#4FC3F7' }} />;
    case 'failed':
      return <ErrorOutlineIcon sx={{ ...iconSx, color: 'error.main' }} />;
    default:
      return null;
  }
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, platform }) => {
  const isUser = message.sender_type === 'user';
  const isAgent = message.sender_type === 'agent';
  const isAi = message.sender_type === 'ai';
  const isSystem = message.sender_type === 'system';

  // System messages render as centered info cards
  if (isSystem) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, px: 4 }}>
        <Chip
          icon={<InfoOutlinedIcon />}
          label={message.text_content || 'System message'}
          variant="outlined"
          size="small"
          sx={{
            maxWidth: '80%',
            height: 'auto',
            '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
            color: 'text.secondary',
            borderColor: 'divider',
            fontSize: '0.75rem',
          }}
        />
      </Box>
    );
  }

  const getAvatar = () => {
    if (isUser) return <PlatformAvatar platform={platform} sx={{ width: 32, height: 32 }} />;
    if (isAgent) return <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}><AccountCircleIcon /></Avatar>;
    if (isAi) return <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}><SmartToyIcon /></Avatar>;
    return <Avatar sx={{ width: 32, height: 32 }} />;
  };

  // Define bubble colors for better management
  const userBubbleColor = '#FFFFFF';
  const agentBubbleColor = '#E1F5FE'; // Light blue for agent
  const aiBubbleColor = '#E8F5E9'; // Light green for AI

  const bubbleStyles = {
    p: '8px 12px',
    borderRadius: '18px',
    position: 'relative', // Needed for the tail
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
    maxWidth: '450px',
    wordWrap: 'break-word',
    '&::after': { // This pseudo-element creates the tail
      content: '""',
      position: 'absolute',
      bottom: '0px',
      width: '0px',
      height: '0px',
      border: '10px solid transparent',
    }
  };

  const userBubbleStyles = {
    ...bubbleStyles,
    bgcolor: userBubbleColor,
    borderBottomLeftRadius: '4px',
    '&::after': {
      ...bubbleStyles['&::after'],
      left: '-10px',
      borderRightColor: userBubbleColor,
      borderRightWidth: '12px'
    }
  };

  const sentBubbleStyles = {
    ...bubbleStyles,
    bgcolor: isAi ? aiBubbleColor : agentBubbleColor,
    borderBottomRightRadius: '4px',
    '&::after': {
      ...bubbleStyles['&::after'],
      right: '-10px',
      borderLeftColor: isAi ? aiBubbleColor : agentBubbleColor,
      borderLeftWidth: '12px'
    }
  };

  const renderContent = () => {
    const { content_type, text_content, attachment_url, attachment_metadata } = message;

    switch (content_type) {
      case 'image':
        return (
          <>
            {attachment_url && (
              <Box
                component="img"
                src={attachment_url}
                alt="Chat attachment"
                sx={{
                  mt: text_content ? 1 : 0,
                  width: '100%',
                  maxWidth: '300px',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
                onClick={() => window.open(attachment_url, '_blank')}
              />
            )}
            {text_content && (
              <Typography variant="body1" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 1 }}>
                {text_content}
              </Typography>
            )}
          </>
        );

      case 'audio':
        return (
          <>
            <Box component="audio" controls src={attachment_url || undefined} sx={{ width: '100%', maxWidth: '250px', mt: 0.5 }} />
            {attachment_metadata?.duration_seconds && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                🎤 {formatDuration(attachment_metadata.duration_seconds)}
              </Typography>
            )}
          </>
        );

      case 'video':
        return (
          <>
            {attachment_url && (
              <Box
                component="video"
                controls
                src={attachment_url}
                sx={{
                  width: '100%',
                  maxWidth: '300px',
                  borderRadius: 2,
                  mt: text_content ? 1 : 0,
                }}
              />
            )}
            {text_content && (
              <Typography variant="body1" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 1 }}>
                {text_content}
              </Typography>
            )}
          </>
        );

      case 'document':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.04)',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
            }}
            onClick={() => {
              if (attachment_url) window.open(attachment_url, '_blank');
            }}
          >
            <DescriptionIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {attachment_metadata?.file_name || 'Document'}
              </Typography>
              {attachment_metadata?.file_size && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatFileSize(attachment_metadata.file_size)}
                </Typography>
              )}
            </Box>
          </Box>
        );

      case 'sticker':
        return attachment_url ? (
          <Box
            component="img"
            src={attachment_url}
            alt="Sticker"
            sx={{ width: 128, height: 128, objectFit: 'contain' }}
          />
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            [Sticker]
          </Typography>
        );

      case 'location':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOnIcon sx={{ color: 'error.main' }} />
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {text_content || 'Shared location'}
            </Typography>
          </Box>
        );

      case 'text':
      default:
        return text_content ? (
          <Typography variant="body1" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
            {text_content}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            [Unsupported message type: {content_type}]
          </Typography>
        );
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-start' : 'flex-end',
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: isUser ? 'row' : 'row-reverse',
          alignItems: 'flex-end', // Align to bottom for better tail placement
          gap: 1.5,
        }}
      >
        {getAvatar()}
        <Paper
          elevation={0} // Using our own shadow
          sx={isUser ? userBubbleStyles : sentBubbleStyles}
        >
          {renderContent()}
          <Typography
            variant="caption"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              mt: 0.5,
              color: 'text.secondary',
              fontSize: '0.7rem' // Smaller timestamp
            }}
          >
            {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {!isUser && <DeliveryIndicator status={message.delivery_status} />}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default React.memo(MessageBubble);