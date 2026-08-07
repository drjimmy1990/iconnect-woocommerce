// src/components/chat/ImageUrlDialog.tsx
import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';

interface ImageUrlDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: (url: string, caption: string) => void;
}

const ImageUrlDialog: React.FC<ImageUrlDialogProps> = ({ open, onClose, onSend }) => {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');

  const handleSend = () => {
    if (url.trim()) {
      onSend(url, caption);
      onClose();
      setUrl('');
      setCaption('');
    }
  };
  
  const handleClose = () => {
      onClose();
      setUrl('');
      setCaption('');
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Send Image by URL</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Paste the URL of the image you want to send. You can also add an optional caption.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          id="image-url"
          label="Image URL"
          type="url"
          fullWidth
          variant="standard"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <TextField
          margin="dense"
          id="image-caption"
          label="Optional Caption"
          type="text"
          fullWidth
          variant="standard"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSend} disabled={!url.trim()}>Send</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageUrlDialog;