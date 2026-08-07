// src/components/chat/TemplatePopover.tsx
'use client';

import React, { useState } from 'react';
import {
  Popover,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  MenuItem,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BoltIcon from '@mui/icons-material/Bolt';
import {
  useMessageTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  MessageTemplate,
} from '@/hooks/useMessageTemplates';

interface TemplatePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'greeting', label: '👋 Greeting' },
  { value: 'sales', label: '💰 Sales' },
  { value: 'support', label: '🛟 Support' },
  { value: 'follow_up', label: '⏰ Follow Up' },
];

const getCategoryEmoji = (category: string) => {
  const found = CATEGORIES.find(c => c.value === category);
  return found ? found.label.split(' ')[0] : '💬';
};

const TemplatePopover: React.FC<TemplatePopoverProps> = ({ anchorEl, open, onClose, onSelect }) => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [editDialog, setEditDialog] = useState<{ open: boolean; template: MessageTemplate | null }>({
    open: false,
    template: null,
  });
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');

  const { data: templates = [], isLoading } = useMessageTemplates();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  // Filter by search
  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (content: string) => {
    onSelect(content);
    onClose();
    setSearch('');
  };

  const handleOpenCreate = () => {
    setFormName('');
    setFormContent('');
    setFormCategory('general');
    setEditDialog({ open: true, template: null });
  };

  const handleOpenEdit = (template: MessageTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormName(template.name);
    setFormContent(template.content);
    setFormCategory(template.category);
    setEditDialog({ open: true, template });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) return;

    if (editDialog.template) {
      await updateMutation.mutateAsync({
        id: editDialog.template.id,
        name: formName.trim(),
        content: formContent.trim(),
        category: formCategory,
      });
    } else {
      await createMutation.mutateAsync({
        name: formName.trim(),
        content: formContent.trim(),
        category: formCategory,
      });
    }

    setEditDialog({ open: false, template: null });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => { onClose(); setSearch(''); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxHeight: 420,
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 1.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BoltIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
            Quick Replies
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {templates.length} saved
          </Typography>
        </Box>

        {/* Search */}
        <Box sx={{ px: 1.5, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                fontSize: '0.85rem',
              },
            }}
          />
        </Box>

        <Divider />

        {/* Template list */}
        <List
          dense
          sx={{
            flex: 1,
            overflow: 'auto',
            py: 0.5,
            '& .MuiListItemButton-root': {
              borderRadius: 1,
              mx: 0.5,
              my: 0.25,
            },
          }}
        >
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!isLoading && filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {search ? 'No templates found' : 'No templates yet'}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Click &quot;Add New&quot; to create one
              </Typography>
            </Box>
          )}

          {filtered.map((template) => (
            <ListItemButton
              key={template.id}
              onClick={() => handleSelect(template.content)}
              sx={{
                '&:hover .template-actions': { opacity: 1 },
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {getCategoryEmoji(template.category)} {template.name}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                      mt: 0.3,
                    }}
                  >
                    {template.content}
                  </Typography>
                }
              />
              <Stack
                direction="row"
                spacing={0}
                className="template-actions"
                sx={{ opacity: 0, transition: 'opacity 0.15s', ml: 0.5 }}
              >
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={(e) => handleOpenEdit(template, e)}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={(e) => handleDelete(template.id, e)}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </ListItemButton>
          ))}
        </List>

        <Divider />

        {/* Add New button */}
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
            }}
          >
            Add New Template
          </Button>
        </Box>
      </Popover>

      {/* Create/Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, template: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editDialog.template ? 'Edit Template' : 'New Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              fullWidth
              size="small"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Price List, Greeting, Follow Up"
            />
            <TextField
              label="Category"
              select
              fullWidth
              size="small"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Message Content"
              fullWidth
              multiline
              rows={5}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Type the message that will be inserted..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, template: null })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || !formContent.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TemplatePopover;
