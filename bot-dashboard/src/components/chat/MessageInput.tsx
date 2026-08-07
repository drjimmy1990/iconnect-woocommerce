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
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Cancel button */}
        <Tooltip title="Cancel recording">
          <IconButton onClick={onCancelRecording} color="error" size="small">
            <CloseIcon />
          </IconButton>
        </Tooltip>

        {/* Recording indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <FiberManualRecordIcon
            sx={{
              fontSize: 14,
              color: 'error.main',
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
            Recording...
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {formatRecordingTime(recordingDuration)}
          </Typography>
        </Box>

        {/* Stop & send button */}
        <Tooltip title="Stop and send">
          <IconButton onClick={onStopRecording} color="primary" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}>
            <StopCircleIcon />
          </IconButton>
        </Tooltip>
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
          p: 2,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Attachment menu button */}
        <IconButton onClick={handleOpenMenu} disabled={disabled || isSending || isUploading}>
          <AttachmentIcon />
        </IconButton>

        {/* ⚡ Templates button */}
        <Tooltip title="Quick replies (or type /)">
          <IconButton
            ref={templateBtnRef}
            onClick={(e) => setTemplateAnchor(e.currentTarget)}
            disabled={disabled || isSending || isUploading}
            sx={{
              color: 'warning.main',
              '&:hover': { bgcolor: 'warning.light', color: 'warning.dark' },
            }}
          >
            <BoltIcon />
          </IconButton>
        </Tooltip>

        {/* Text input */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message... (/ for templates)"
          size="small"
          value={value}
          onChange={onChange}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending || isUploading}
          multiline
          maxRows={4}
        />

        {/* Mic button (when no text) / Send button (when text) */}
        {value.trim() ? (
          <IconButton
            color="primary"
            onClick={onSendText}
            disabled={disabled || isSending || isUploading || !value.trim()}
          >
            <SendIcon />
          </IconButton>
        ) : (
          <Tooltip title="Record voice message">
            <span>
              <IconButton
                color="default"
                onClick={onStartRecording}
                disabled={disabled || isSending || isUploading || !onStartRecording}
              >
                <MicIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
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