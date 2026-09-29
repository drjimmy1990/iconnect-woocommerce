// src/components/chat/MessageBubble.tsx
import React from 'react';
import { Box, Paper, Typography, Avatar, Chip } from '@mui/material';
import { Message } from '@/lib/api';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AudioPlayer from './AudioPlayer';

interface MessageBubbleProps {
  message: Message;
  platform: 'whatsapp' | 'facebook' | 'instagram' | string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DeliveryIndicator: React.FC<{ status?: string; isLightText?: boolean }> = ({ status, isLightText = false }) => {
  const iconSx = { fontSize: '0.85rem', ml: 0.5, verticalAlign: 'middle' };
  switch (status) {
    case 'pending':
      return <ScheduleIcon sx={{ ...iconSx, color: isLightText ? 'rgba(255,255,255,0.6)' : 'text.disabled' }} />;
    case 'sent':
      return <DoneIcon sx={{ ...iconSx, color: isLightText ? 'rgba(255,255,255,0.7)' : 'text.secondary' }} />;
    case 'delivered':
      return <DoneAllIcon sx={{ ...iconSx, color: isLightText ? 'rgba(255,255,255,0.7)' : 'text.secondary' }} />;
    case 'read':
      return <DoneAllIcon sx={{ ...iconSx, color: isLightText ? '#67E8F9' : '#0284C7' }} />;
    case 'failed':
      return <ErrorOutlineIcon sx={{ ...iconSx, color: 'error.main' }} />;
    default:
      return null;
  }
};

export const isArabicText = (text?: string | null): boolean => {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Render text with highlighted links (e.g. Telr payment, order tracking)
 * and automatic RTL detection for Arabic text
 */
const FormattedMessageText: React.FC<{ text: string; isLightText?: boolean }> = ({ text, isLightText = false }) => {
  const isArabic = isArabicText(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <Box
      dir={isArabic ? 'rtl' : 'ltr'}
      sx={{
        direction: isArabic ? 'rtl' : 'ltr',
        textAlign: isArabic ? 'right' : 'left',
        unicodeBidi: 'plaintext',
        width: '100%',
      }}
    >
      <Typography
        variant="body1"
        component="div"
        sx={{
          color: isLightText ? '#FFFFFF' : '#0F172A',
          whiteSpace: 'pre-wrap',
          fontSize: '0.925rem',
          lineHeight: 1.65,
          wordBreak: 'break-word',
          direction: isArabic ? 'rtl' : 'ltr',
          textAlign: isArabic ? 'right' : 'left',
          fontFamily: isArabic ? '"Segoe UI", Tahoma, Arial, sans-serif' : 'inherit',
        }}
      >
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            const isPaymentLink = part.toLowerCase().includes('telr') || part.toLowerCase().includes('pay');
            return (
              <Box
                key={index}
                component="a"
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: isLightText ? '#A5B4FC' : '#4F46E5',
                  textDecoration: 'none',
                  fontWeight: 600,
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  bgcolor: isLightText
                    ? 'rgba(255, 255, 255, 0.15)'
                    : isPaymentLink
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(79, 70, 229, 0.08)',
                  border: isLightText
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : isPaymentLink
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(79, 70, 229, 0.15)',
                  my: 0.5,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isLightText ? 'rgba(255, 255, 255, 0.25)' : 'rgba(79, 70, 229, 0.15)',
                  },
                }}
              >
                {isPaymentLink ? '💳 Secure Payment Link' : part.length > 35 ? `${part.slice(0, 32)}...` : part}
                <OpenInNewIcon sx={{ fontSize: 13 }} />
              </Box>
            );
          }
          return part;
        })}
      </Typography>
    </Box>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, platform }) => {
  const isUser = message.sender_type === 'user';
  const isAgent = message.sender_type === 'agent';
  const isAi = message.sender_type === 'ai';
  const isSystem = message.sender_type === 'system';
  const isArabic = isArabicText(message.text_content);

  // System messages render as centered sleek pill card
  if (isSystem) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5, px: 4 }}>
        <Chip
          icon={<InfoOutlinedIcon sx={{ fontSize: '15px !important', color: '#64748B' }} />}
          label={message.text_content || 'System notification'}
          size="small"
          sx={{
            maxWidth: '85%',
            height: 'auto',
            py: 0.5,
            px: 1,
            '& .MuiChip-label': { whiteSpace: 'normal' },
            bgcolor: 'rgba(241, 245, 249, 0.9)',
            border: '1px solid #E2E8F0',
            color: '#475569',
            fontSize: '0.75rem',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
          }}
        />
      </Box>
    );
  }

  const getAvatar = () => {
    if (isUser) {
      return (
        <PlatformAvatar
          platform={platform}
          sx={{
            width: 32,
            height: 32,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        />
      );
    }
    if (isAgent) {
      return (
        <Avatar
          sx={{
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            width: 32,
            height: 32,
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
          }}
        >
          <SupportAgentIcon sx={{ fontSize: 18, color: '#fff' }} />
        </Avatar>
      );
    }
    if (isAi) {
      return (
        <Avatar
          sx={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            width: 32,
            height: 32,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Avatar>
      );
    }
    return <Avatar sx={{ width: 32, height: 32 }} />;
  };

  // Modern Asymmetric Bubble Styles
  const baseBubbleStyles = {
    p: '10px 14px',
    maxWidth: '520px',
    wordWrap: 'break-word',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  };

  // Customer: Crisp White with subtle outline & rounded asymmetric corner
  const userBubbleStyles = {
    ...baseBubbleStyles,
    bgcolor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '18px 18px 18px 4px',
    boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 3px -1px rgba(15, 23, 42, 0.03)',
  };

  // AI Assistant: Frosted Emerald/Indigo with micro-badge
  const aiBubbleStyles = {
    ...baseBubbleStyles,
    background: 'linear-gradient(135deg, #F0FDF4 0%, #F8FAFC 100%)',
    border: '1px solid rgba(16, 185, 129, 0.22)',
    borderRadius: '18px 18px 4px 18px',
    boxShadow: '0 4px 14px -2px rgba(16, 185, 129, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
  };

  // Human Agent: Solid Electric Indigo with clean white contrast
  const agentBubbleStyles = {
    ...baseBubbleStyles,
    background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
    border: 'none',
    borderRadius: '18px 18px 4px 18px',
    boxShadow: '0 4px 16px -2px rgba(79, 70, 229, 0.3)',
  };

  const currentBubbleStyles = isUser ? userBubbleStyles : isAi ? aiBubbleStyles : agentBubbleStyles;
  const isLightText = isAgent;

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
                  maxWidth: '340px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: isLightText ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.01)' },
                }}
                onClick={() => window.open(attachment_url, '_blank')}
              />
            )}
            {text_content && (
              <Box sx={{ mt: 1 }}>
                <FormattedMessageText text={text_content} isLightText={isLightText} />
              </Box>
            )}
          </>
        );

      case 'audio':
        return (
          <AudioPlayer
            src={attachment_url}
            durationSeconds={attachment_metadata?.duration_seconds}
            isUser={isUser}
          />
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
                  maxWidth: '340px',
                  borderRadius: '12px',
                  mt: text_content ? 1 : 0,
                  border: isLightText ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
                }}
              />
            )}
            {text_content && (
              <Box sx={{ mt: 1 }}>
                <FormattedMessageText text={text_content} isLightText={isLightText} />
              </Box>
            )}
          </>
        );

      case 'document':
        return (
          <Box
            dir={isArabic ? 'rtl' : 'ltr'}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexDirection: isArabic ? 'row-reverse' : 'row',
              gap: 1.5,
              p: 1.25,
              borderRadius: '10px',
              bgcolor: isLightText ? 'rgba(255,255,255,0.12)' : 'rgba(241, 245, 249, 0.8)',
              border: isLightText ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: isLightText ? 'rgba(255,255,255,0.2)' : 'rgba(226, 232, 240, 0.8)',
              },
            }}
            onClick={() => {
              if (attachment_url) window.open(attachment_url, '_blank');
            }}
          >
            <DescriptionIcon sx={{ fontSize: 32, color: isLightText ? '#A5B4FC' : 'primary.main' }} />
            <Box sx={{ flex: 1, minWidth: 0, textAlign: isArabic ? 'right' : 'left' }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, color: isLightText ? '#FFFFFF' : '#0F172A' }}
              >
                {attachment_metadata?.file_name || 'Document'}
              </Typography>
              {attachment_metadata?.file_size && (
                <Typography
                  variant="caption"
                  sx={{ color: isLightText ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}
                >
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
          <Box
            dir={isArabic ? 'rtl' : 'ltr'}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexDirection: isArabic ? 'row-reverse' : 'row',
              gap: 1,
            }}
          >
            <LocationOnIcon sx={{ color: 'error.main' }} />
            <Typography
              variant="body2"
              sx={{
                color: isLightText ? '#FFFFFF' : '#0F172A',
                textAlign: isArabic ? 'right' : 'left',
              }}
            >
              {text_content || 'Shared location'}
            </Typography>
          </Box>
        );

      case 'text':
      default:
        return text_content ? (
          <FormattedMessageText text={text_content} isLightText={isLightText} />
        ) : (
          <Typography variant="body2" sx={{ color: isLightText ? 'rgba(255,255,255,0.7)' : 'text.secondary', fontStyle: 'italic' }}>
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
          alignItems: 'flex-end',
          gap: 1.25,
          maxWidth: '85%',
        }}
      >
        {getAvatar()}
        <Paper elevation={0} sx={currentBubbleStyles}>
          {/* Header micro-badges for AI and Agent */}
          {isAi && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: isArabic ? 'flex-end' : 'flex-start',
                mb: 0.75,
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#047857',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#10B981',
                    boxShadow: '0 0 6px #10B981',
                  }}
                />
                AI ASSISTANT
              </Box>
            </Box>
          )}

          {isAgent && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: isArabic ? 'flex-end' : 'flex-start',
                mb: 0.75,
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  bgcolor: 'rgba(255, 255, 255, 0.18)',
                  color: '#FFFFFF',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                SUPPORT AGENT
              </Box>
            </Box>
          )}

          {renderContent()}

          {/* Timestamp and delivery indicator */}
          <Typography
            variant="caption"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              mt: 0.5,
              color: isLightText ? 'rgba(255, 255, 255, 0.75)' : '#94A3B8',
              fontSize: '0.68rem',
              fontWeight: 500,
            }}
          >
            {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {!isUser && <DeliveryIndicator status={message.delivery_status} isLightText={isLightText} />}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default React.memo(MessageBubble);