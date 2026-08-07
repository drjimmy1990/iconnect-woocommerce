// src/components/settings/ContentCollectionsManager.tsx
'use client';

import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  LinearProgress,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { useChannelConfig, ContentCollection } from '@/hooks/useChannelConfig';
import { useContentImageUpload, isImageUrl } from '@/hooks/useContentImageUpload';

interface ContentCollectionsManagerProps {
  collections: ContentCollection[];
  channelId: string;
}

// Dialog for adding a new collection
function AddCollectionDialog({ open, onClose, onSubmit, isAdding }: { open: boolean, onClose: () => void, onSubmit: (name: string, collectionId: string) => void, isAdding: boolean }) {
  const [name, setName] = useState('');
  const [collectionId, setCollectionId] = useState('');

  // Auto-generate collection_id from name
  const handleNameChange = (val: string) => {
    setName(val);
    // Only auto-set if user hasn't manually edited the ID
    if (!collectionId || collectionId === name.toLowerCase().replace(/\s+/g, '_')) {
      setCollectionId(val.toLowerCase().replace(/\s+/g, '_'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name, collectionId);
    setName('');
    setCollectionId('');
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ component: 'form', onSubmit: handleSubmit }} fullWidth maxWidth="xs">
      <DialogTitle>Add New Collection</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Collection Name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          fullWidth
          required
          helperText="Display name, e.g. 'Testimonials'"
        />
        <TextField
          margin="dense"
          label="Collection ID"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
          fullWidth
          required
          helperText="Used by n8n to pick this collection, e.g. 'testimonials_1'"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isAdding}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isAdding || !name.trim() || !collectionId.trim()}>
          {isAdding ? <CircularProgress size={24} /> : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Confirm delete dialog
function ConfirmDeleteDialog({ open, name, onClose, onConfirm, isDeleting }: { open: boolean; name: string; onClose: () => void; onConfirm: () => void; isDeleting: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs">
      <DialogTitle>Delete Collection</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>&quot;{name}&quot;</strong>? This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={isDeleting}>
          {isDeleting ? <CircularProgress size={24} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


// Editor for the items inside a collection. Supports uploading image files
// (stored in the public `content-images` bucket → URLs appended to items),
// pasting text/URL lines in bulk, and removing individual items.
function ItemsEditor({
  items,
  onItemsChange,
  channelId,
  collectionId,
  onNotify,
}: {
  items: string[];
  onItemsChange: (items: string[]) => void;
  channelId: string;
  collectionId: string;
  onNotify: (message: string, severity: 'success' | 'error') => void;
}) {
  const { uploadImage, isUploading, uploadProgress } = useContentImageUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const uploaded: string[] = [];
    let lastError: string | null = null;
    for (const file of list) {
      try {
        const res = await uploadImage(file, channelId, collectionId);
        uploaded.push(res.url);
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Upload failed';
      }
    }
    if (uploaded.length) {
      onItemsChange([...items, ...uploaded]);
      onNotify(`Uploaded ${uploaded.length} image${uploaded.length > 1 ? 's' : ''}.`, 'success');
    }
    if (lastError) onNotify(lastError, 'error');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addBulkLines = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) onItemsChange([...items, ...lines]);
    setBulkText('');
  };

  const removeItem = (idx: number) => onItemsChange(items.filter((_, i) => i !== idx));

  return (
    <Box>
      {/* Upload dropzone */}
      <Box
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!isUploading) handleFiles(e.dataTransfer.files);
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
          cursor: isUploading ? 'wait' : 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          transition: 'all 0.15s ease',
          mb: 2,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <CloudUploadIcon color={isUploading ? 'disabled' : 'primary'} sx={{ fontSize: 32, mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          {isUploading ? `Uploading… ${uploadProgress}%` : 'Drag & drop images here, or click to select'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          JPEG, PNG, GIF, WebP — up to 10MB each
        </Typography>
        {isUploading && <LinearProgress value={uploadProgress} sx={{ mt: 1 }} />}
      </Box>

      {/* Current items */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {items.length} item{items.length === 1 ? '' : 's'}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No items yet. Upload images above, or paste URLs/text below.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {items.map((item, idx) => isImageUrl(item) ? (
            <Box
              key={idx}
              sx={{ position: 'relative', width: 96, height: 96, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item} alt={item.split('/').pop() || 'image'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <IconButton
                size="small"
                onClick={() => removeItem(idx)}
                sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.55)', color: 'common.white', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' }, p: 0.25 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Chip
              key={idx}
              label={item.length > 40 ? `${item.slice(0, 37)}…` : item}
              onDelete={() => removeItem(idx)}
              sx={{ maxWidth: 260 }}
            />
          ))}
        </Box>
      )}

      {/* Bulk paste */}
      <TextField
        label="Add text / URL items (one per line)"
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        multiline
        rows={3}
        fullWidth
        size="small"
        helperText="Paste direct image URLs or text snippets, then click Add."
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button size="small" onClick={addBulkLines} disabled={!bulkText.trim()}>Add lines</Button>
      </Box>
    </Box>
  );
}

export default function ContentCollectionsManager({ collections, channelId }: ContentCollectionsManagerProps) {
  const { addCollection, isAddingCollection, updateCollection, isUpdatingCollection, deleteCollection, isDeletingCollection } = useChannelConfig(channelId);

  const [selectedCollection, setSelectedCollection] = useState<ContentCollection | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editCollectionId, setEditCollectionId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContentCollection | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  const handleOpenEditDialog = (collection: ContentCollection) => {
    setSelectedCollection(collection);
    setEditItems(collection.items ?? []);
    setEditName(collection.name);
    setEditCollectionId(collection.collection_id);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedCollection(null);
    setEditItems([]);
    setEditName('');
    setEditCollectionId('');
  };

  const handleSaveChanges = async () => {
    if (!selectedCollection) return;

    updateCollection({ id: selectedCollection.id, items: editItems, name: editName, collection_id: editCollectionId }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Collection saved!', severity: 'success' });
        handleCloseEditDialog();
      },
      onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
    });
  };

  const handleAddCollection = async (name: string, collectionId: string) => {
    addCollection({ name, collectionId }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Collection created!', severity: 'success' });
        setIsAddDialogOpen(false);
      },
      onError: (err) => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }),
    });
  };

  const handleDeleteCollection = () => {
    if (!deleteTarget) return;
    deleteCollection(deleteTarget.id, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Collection deleted!', severity: 'success' });
        setDeleteTarget(null);
      },
      onError: (err) => {
        setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>Content Collections</Typography>
          <Tooltip title="Add New Collection">
            <IconButton onClick={() => setIsAddDialogOpen(true)} color="primary">
              <AddCircleOutlineIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage lists of content used by your AI agents. Upload images directly or paste URLs/text — the <strong>Collection ID</strong> is what n8n uses to pick the right collection.
        </Typography>
        <List dense>
          {collections.map(collection => (
            <ListItem
              key={collection.id}
              disablePadding
              secondaryAction={
                <Box>
                  <Tooltip title="Edit Items">
                    <IconButton edge="end" size="small" onClick={() => handleOpenEditDialog(collection)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Collection">
                    <IconButton edge="end" size="small" color="error" onClick={() => setDeleteTarget(collection)} sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemButton onClick={() => handleOpenEditDialog(collection)}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {collection.name}
                      <Chip label={collection.collection_id} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                    </Box>
                  }
                  secondary={`${collection.items.length} items`}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {collections.length === 0 && (
            <Typography color="text.secondary" textAlign="center" sx={{ py: 2 }}>No collections found. Click the &apos;+&apos; to add one.</Typography>
          )}
        </List>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onClose={handleCloseEditDialog} fullWidth maxWidth="md">
        <DialogTitle>Edit Collection</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              margin="dense"
              label="Collection Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              margin="dense"
              label="Collection ID (used by n8n)"
              value={editCollectionId}
              onChange={(e) => setEditCollectionId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              fullWidth
              size="small"
              sx={{ '& input': { fontFamily: 'monospace' } }}
              helperText="Change carefully — n8n references this ID"
            />
          </Box>
          <Box sx={{ mt: 1 }}>
            {selectedCollection && (
              <ItemsEditor
                items={editItems}
                onItemsChange={setEditItems}
                channelId={channelId}
                collectionId={selectedCollection.collection_id}
                onNotify={(message, severity) => setSnackbar({ open: true, message, severity })}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={isUpdatingCollection}>Cancel</Button>
          <Button onClick={handleSaveChanges} variant="contained" disabled={isUpdatingCollection}>{isUpdatingCollection ? <CircularProgress size={24} /> : 'Save Collection'}</Button>
        </DialogActions>
      </Dialog>

      {/* Add Dialog */}
      <AddCollectionDialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onSubmit={handleAddCollection} isAdding={isAddingCollection} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        name={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteCollection}
        isDeleting={isDeletingCollection}
      />

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}