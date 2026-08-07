// src/components/ui/PlatformAvatar.tsx
import React from 'react';
import Avatar from '@mui/material/Avatar';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import TelegramIcon from '@mui/icons-material/Telegram';
import ChatIcon from '@mui/icons-material/Chat';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';

interface PlatformAvatarProps {
  platform: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'web' | string;
  sx?: object;
}

const PlatformAvatar: React.FC<PlatformAvatarProps> = ({ platform, sx }) => {
  const getPlatformStyle = () => {
    switch (platform) {
      case 'whatsapp':
        return {
          bgcolor: '#25D366',
          icon: <WhatsAppIcon />,
        };
      case 'facebook':
        return {
          bgcolor: '#1877F2',
          icon: <FacebookIcon />,
        };
      case 'instagram':
        return {
          bgcolor: '#E4405F',
          icon: <InstagramIcon />,
        };
      case 'telegram':
        return {
          bgcolor: '#0088CC',
          icon: <TelegramIcon />,
        };
      case 'web':
        return {
          bgcolor: '#6366F1',
          icon: <ChatIcon />,
        };
      default:
        return {
          bgcolor: '#bdbdbd',
          icon: <QuestionMarkIcon />,
        };
    }
  };

  const { bgcolor, icon } = getPlatformStyle();

  return (
    <Avatar sx={{ ...sx, bgcolor }}>
      {icon}
    </Avatar>
  );
};

export default PlatformAvatar;