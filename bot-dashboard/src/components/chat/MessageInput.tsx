// src/components/chat/MessageInput.tsx
import React, { useState, useRef } from 'react';
import {
  Box, TextField, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Menu, MenuItem, ListItemIcon, ListItemText,
  Typography, LinearProgress, Tooltip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachmentIcon from '@mui/icons-material/Attachment';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import MicIcon from '@mui/icons-material/Mic';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import BoltIcon from '@mui/icons-material/Bolt';
import TemplatePopover from './TemplatePopover';

interface MessageInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSendText: () => void;
  onSendImageByUrl: (url: string) => void;
  onSendFileUpload: (file: File) => void;
  onSendVoice: (blob: Blob, duration: number) => void;
  disabled: boolean;
  isSending: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  isRecording?: boolean;
  recordingDuration?: number;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;
  onSetValue?: (text: string) => void; // For template insertion
}

const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSendText,
  onSendImageByUrl,
  onSendFileUpload,
  disabled,
  isSending,
  isUploading = false,
  uploadProgress = 0,
  isRecording = false,
  recordingDuration = 0,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSetValue,
}) => {
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [templateAnchor, setTemplateAnchor] = useState<null | HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (value.trim()) {
        onSendText();
      }
    }
  };

  // Handle "/" shortcut to open templates
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === '/' && value === '' && templateBtnRef.current) {
      event.preventDefault();
      setTemplateAnchor(templateBtnRef.current);
    }
  };

  // Template selection
  const handleTemplateSelect = (content: string) => {
    if (onSetValue) {
      onSetValue(content);
    }
  };

  // Attachment menu
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => setAnchorEl(null);

  // URL dialog
  const handleOpenUrlDialog = () => {
    handleCloseMenu();
    setIsUrlDialogOpen(true);
  };
  const handleCloseUrlDialog = () => {
    setIsUrlDialogOpen(false);
    setImageUrl('');
  };
  const handleSendUrl = () => {
    if (imageUrl.trim()) {
      onSendImageByUrl(imageUrl);
      handleCloseUrlDialog();
    }
  };

  // File upload
  const handleFileUploadClick = () => {
    handleCloseMenu();
    fileInputRef.current?.click();
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSendFileUpload(file);
      // Reset so the same file can be selected again
      event.target.value = '';
    }
  };

  // Recording UI
  if (isRecording) {
    return (
      <Box
        sx={{
          p: 2,
          bgcolor: '#FFFFFF',
          borderTop: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 -4px 16px -2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 1.25,
            px: 2,
            borderRadius: '24px',
            bgcolor: 'rgba(239, 68, 68, 0.06)',
            border: '1.5px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          {/* Cancel button */}
          <Tooltip title="Cancel recording">
            <IconButton
              onClick={onCancelRecording}
              size="small"
              sx={{
                color: '#EF4444',
                bgcolor: 'rgba(239, 68, 68, 0.12)',
                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Recording indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            <FiberManualRecordIcon
              sx={{
                fontSize: 16,
                color: '#EF4444',
                animation: 'pulse 1.2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                  '50%': { opacity: 0.3, transform: 'scale(0.85)' },
                },
              }}
            />
            <Typography variant="body2" sx={{ color: '#DC2626', fontWeight: 600 }}>
              Recording voice note...
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#0F172A',
                fontFamily: 'monospace',
                fontWeight: 700,
                px: 1,
                py: 0.2,
                borderRadius: '6px',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              {formatRecordingTime(recordingDuration)}
            </Typography>
          </Box>

          {/* Stop & send button */}
          <Tooltip title="Stop and send">
            <IconButton
              onClick={onStopRecording}
              sx={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              <StopCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <>
      {/* Upload progress bar */}
      {isUploading && (
        <Box sx={{ px: 2, pt: 1 }}>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            Uploading... {uploadProgress}%
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          bgcolor: '#FFFFFF',
          borderTop: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 -4px 16px -2px rgba(15, 23, 42, 0.03)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '4px 6px',
            borderRadius: '24px',
            bgcolor: '#F8FAFC',
            border: '1.5px solid #E2E8F0',
            transition: 'all 0.2s ease',
            '&:focus-within': {
              bgcolor: '#FFFFFF',
              borderColor: '#4F46E5',
              boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
            },
          }}
        >
          {/* Attachment menu button */}
          <Tooltip title="Attach media or file">
            <IconButton
              onClick={handleOpenMenu}
              disabled={disabled || isSending || isUploading}
              size="small"
              sx={{
                color: '#64748B',
                '&:hover': { color: '#4F46E5', bgcolor: 'rgba(79, 70, 229, 0.08)' },
              }}
            >
              <AttachmentIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* ⚡ Templates button */}
          <Tooltip title="Quick reply templates (or type /)">
            <IconButton
              ref={templateBtnRef}
              onClick={(e) => setTemplateAnchor(e.currentTarget)}
              disabled={disabled || isSending || isUploading}
              size="small"
              sx={{
                color: '#D97706',
                bgcolor: 'rgba(245, 158, 11, 0.1)',
                '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)', color: '#B45309' },
              }}
            >
              <BoltIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Text input */}
          <TextField
            fullWidth
            placeholder="Type your message... (type / for sales templates)"
            size="small"
            value={value}
            onChange={onChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending || isUploading}
            multiline
            maxRows={4}
            sx={{
              '& .MuiOutlinedInput-root': {
                p: '6px 8px',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
              },
              '& .MuiInputBase-input': {
                fontSize: '0.9rem',
                color: '#0F172A',
                '&::placeholder': {
                  color: '#94A3B8',
                  opacity: 1,
                },
              },
            }}
          />

          {/* Mic button (when no text) / Send button (when text) */}
          {value.trim() ? (
            <Tooltip title="Send message (Enter)">
              <span>
                <IconButton
                  onClick={onSendText}
                  disabled={disabled || isSending || isUploading || !value.trim()}
                  sx={{
                    background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                    color: '#FFFFFF',
                    width: 36,
                    height: 36,
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)',
                      transform: 'scale(1.05)',
                    },
                    '&.Mui-disabled': {
                      background: '#CBD5E1',
                      color: '#FFFFFF',
                    },
                  }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Record voice note">
              <span>
                <IconButton
                  onClick={onStartRecording}
                  disabled={disabled || isSending || isUploading || !onStartRecording}
                  size="small"
                  sx={{
                    color: '#64748B',
                    width: 36,
                    height: 36,
                    '&:hover': {
                      color: '#4F46E5',
                      bgcolor: 'rgba(79, 70, 229, 0.08)',
                    },
                  }}
                >
                  <MicIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileChange}
      />

      {/* Attachment menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MenuItem onClick={handleFileUploadClick}>
          <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Upload File</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenUrlDialog}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Send Image by URL</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialog for sending image by URL */}
      <Dialog open={isUrlDialogOpen} onClose={handleCloseUrlDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageIcon color="primary" />
          Send Image by URL
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Image URL"
            type="url"
            fullWidth
            variant="standard"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendUrl();
              }
            }}
            placeholder="https://example.com/image.jpg"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUrlDialog}>Cancel</Button>
          <Button onClick={handleSendUrl} disabled={!imageUrl.trim()} variant="contained">
            Send Image
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Popover */}
      <TemplatePopover
        anchorEl={templateAnchor}
        open={Boolean(templateAnchor)}
        onClose={() => setTemplateAnchor(null)}
        onSelect={handleTemplateSelect}
      />
    </>
  );
};

export default MessageInput;