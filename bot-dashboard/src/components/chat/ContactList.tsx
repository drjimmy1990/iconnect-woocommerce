// src/components/chat/ContactList.tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Typography,
  Badge, CircularProgress, TextField, IconButton, InputAdornment, FormControl,
  InputLabel, Select, MenuItem, SelectChangeEvent, Tooltip, ToggleButtonGroup,
  ToggleButton, Button,
} from '@mui/material';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import { useChannel } from '@/providers/ChannelProvider';
import { useChatContacts, SortOption } from '@/hooks/useChatContacts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';

interface ContactListProps {
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  onToggleCollapse?: () => void;
}

const formatRelativeTime = (timestamp?: string): string => {
  if (!timestamp) return '';
  try {
    const now = new Date();
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const ContactList: React.FC<ContactListProps> = ({
  selectedContactId,
  onSelectContact,
  onToggleCollapse,
}) => {
  const queryClient = useQueryClient();
  const { channels, activeChannel, setActiveChannelId, isLoadingChannels } = useChannel();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const { contacts, isLoadingContacts, loadMore, hasNextPage, isFetchingNextPage } = useChatContacts(
    activeChannel?.id || null,
    searchTerm,
    sortBy
  );

  const { mutate: toggleAi } = useMutation({
    mutationFn: api.toggleAiStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', activeChannel?.id] });
    },
  });

  const handleChannelChange = (event: SelectChangeEvent<string>) => {
    setActiveChannelId(event.target.value);
  };

  const handleSortChange = (_: React.MouseEvent<HTMLElement>, newSort: SortOption | null) => {
    if (newSort) setSortBy(newSort);
  };

  // --- INFINITE SCROLL HANDLER ---
  const listRef = useRef<HTMLUListElement>(null);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && hasNextPage && !isFetchingNextPage) {
      loadMore();
    }
  }, [hasNextPage, isFetchingNextPage, loadMore]);

  return (
    <Box
      sx={{
        width: 330,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(226, 232, 240, 0.8)',
        bgcolor: '#FFFFFF',
      }}
    >
      {/* Header controls */}
      <Box sx={{ p: 2, pb: 1.5, flexShrink: 0, borderBottom: '1px solid rgba(226, 232, 240, 0.6)' }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A' }}>
              Conversations
            </Typography>
            {contacts.length > 0 && (
              <Box
                sx={{
                  px: 0.9,
                  py: 0.15,
                  borderRadius: '10px',
                  bgcolor: 'rgba(79, 70, 229, 0.08)',
                  color: '#4F46E5',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {contacts.length}
              </Box>
            )}
          </Box>
          {onToggleCollapse && (
            <Tooltip title="Collapse sidebar">
              <IconButton onClick={onToggleCollapse} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#0F172A' } }}>
                <MenuOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Channel Selector */}
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel id="channel-selector-label" sx={{ fontSize: '0.825rem' }}>Channel</InputLabel>
          <Select
            labelId="channel-selector-label"
            label="Channel"
            value={activeChannel?.id || ''}
            onChange={handleChannelChange}
            disabled={isLoadingChannels}
            sx={{
              borderRadius: '10px',
              fontSize: '0.85rem',
              '& .MuiSelect-select': { py: 1 },
            }}
          >
            {channels.map((channel) => (
              <MenuItem key={channel.id} value={channel.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <PlatformAvatar platform={channel.platform} sx={{ width: 22, height: 22 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                    {channel.name}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Search Input */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search leads or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              bgcolor: '#F8FAFC',
              fontSize: '0.85rem',
              '& fieldset': { borderColor: '#E2E8F0' },
              '&:hover fieldset': { borderColor: '#CBD5E1' },
              '&.Mui-focused fieldset': { borderColor: '#4F46E5' },
            },
          }}
        />

        {/* Segmented Sort Controls */}
        <ToggleButtonGroup
          value={sortBy}
          exclusive
          onChange={handleSortChange}
          size="small"
          sx={{
            width: '100%',
            bgcolor: '#F1F5F9',
            p: 0.4,
            borderRadius: '10px',
            border: 'none',
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '8px !important',
              mx: 0.2,
              '&.Mui-selected': {
                bgcolor: '#FFFFFF',
                color: '#4F46E5',
                fontWeight: 700,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                '&:hover': { bgcolor: '#FFFFFF' },
              },
            },
          }}
        >
          <ToggleButton value="recent" sx={{ flex: 1, textTransform: 'none', fontSize: '0.72rem', py: 0.4 }}>
            <AccessTimeIcon sx={{ fontSize: 14, mr: 0.4 }} /> Recent
          </ToggleButton>
          <ToggleButton value="unread" sx={{ flex: 1, textTransform: 'none', fontSize: '0.72rem', py: 0.4 }}>
            <MarkUnreadChatAltIcon sx={{ fontSize: 14, mr: 0.4 }} /> Unread
          </ToggleButton>
          <ToggleButton value="name" sx={{ flex: 1, textTransform: 'none', fontSize: '0.72rem', py: 0.4 }}>
            <SortByAlphaIcon sx={{ fontSize: 14, mr: 0.4 }} /> Name
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Contacts List */}
      <List
        ref={listRef}
        onScroll={handleScroll}
        sx={{
          overflowY: 'auto',
          flexGrow: 1,
          minHeight: 0,
          overflowX: 'hidden',
          p: 1,
          pt: 1.5,
        }}
      >
        {isLoadingContacts ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, height: 160 }}>
            <CircularProgress size={28} />
          </Box>
        ) : contacts.length > 0 ? (
          <>
            {contacts.map((contact) => {
              const isSelected = selectedContactId === contact.id;

              return (
                <ListItem
                  key={contact.id}
                  disablePadding
                  sx={{ mb: 0.75 }}
                >
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelectContact(contact.id)}
                    sx={{
                      borderRadius: '12px',
                      py: 1.25,
                      px: 1.5,
                      transition: 'all 0.15s ease',
                      border: '1px solid transparent',
                      position: 'relative',
                      '&.Mui-selected': {
                        bgcolor: 'rgba(79, 70, 229, 0.08)',
                        borderColor: 'rgba(79, 70, 229, 0.25)',
                        boxShadow: '0 2px 8px -2px rgba(79, 70, 229, 0.12)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: 3.5,
                          bgcolor: '#4F46E5',
                          borderRadius: '0 4px 4px 0',
                        },
                        '&:hover': {
                          bgcolor: 'rgba(79, 70, 229, 0.12)',
                        },
                      },
                      '&:hover': {
                        bgcolor: '#F8FAFC',
                      },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 48 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Tooltip title={contact.ai_enabled ? "AI Bot Active - Click to pause" : "AI Bot Paused - Click to enable"}>
                            <Box
                              component="span"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAi({ contactId: contact.id, newStatus: !contact.ai_enabled });
                              }}
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                bgcolor: contact.ai_enabled ? '#10B981' : '#94A3B8',
                                border: '2px solid #FFFFFF',
                                boxShadow: contact.ai_enabled ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                                cursor: 'pointer',
                                display: 'inline-block',
                                transition: 'transform 0.15s ease',
                                '&:hover': {
                                  transform: 'scale(1.25)',
                                },
                              }}
                            />
                          </Tooltip>
                        }
                      >
                        <PlatformAvatar
                          platform={contact.platform}
                          sx={{
                            width: 38,
                            height: 38,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          }}
                        />
                      </Badge>
                    </ListItemAvatar>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                          <Typography
                            noWrap
                            sx={{
                              fontWeight: isSelected ? 700 : 600,
                              fontSize: '0.88rem',
                              color: isSelected ? '#4F46E5' : '#0F172A',
                              maxWidth: 155,
                            }}
                          >
                            {contact.name || contact.platform_user_id}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#94A3B8',
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {formatRelativeTime(contact.last_interaction_at)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Typography
                            noWrap
                            variant="body2"
                            sx={{
                              color: '#64748B',
                              fontSize: '0.78rem',
                              lineHeight: 1.4,
                              flex: 1,
                            }}
                          >
                            {contact.last_message_preview || 'No messages yet'}
                          </Typography>
                          {contact.unread_count > 0 && (
                            <Box
                              sx={{
                                px: 0.75,
                                py: 0.15,
                                bgcolor: '#EF4444',
                                color: '#FFFFFF',
                                borderRadius: '10px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                lineHeight: 1.3,
                                boxShadow: '0 1px 4px rgba(239, 68, 68, 0.4)',
                                flexShrink: 0,
                              }}
                            >
                              {contact.unread_count}
                            </Box>
                          )}
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}

            {isFetchingNextPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!hasNextPage && contacts.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1.5 }}>
                {contacts.length} conversations loaded
              </Typography>
            )}
          </>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(241, 245, 249, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
              }}
            >
              <SearchIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
              {searchTerm ? 'No matching contacts' : 'No contacts in this channel'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', maxWidth: 220 }}>
              {searchTerm
                ? `We couldn't find any contact matching "${searchTerm}"`
                : 'Conversations for this channel will show up here.'}
            </Typography>
            {searchTerm && (
              <Button
                size="small"
                variant="text"
                onClick={() => setSearchTerm('')}
                sx={{ fontSize: '0.75rem', textTransform: 'none', color: '#4F46E5', mt: 0.5 }}
              >
                Clear search
              </Button>
            )}
          </Box>
        )}
      </List>
    </Box>
  );
};

export default React.memo(ContactList);