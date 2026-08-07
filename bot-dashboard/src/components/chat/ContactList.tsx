// src/components/chat/ContactList.tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Typography, Badge, CircularProgress, TextField, IconButton, InputAdornment, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import PlatformAvatar from '@/components/ui/PlatformAvatar';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
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
}

const ContactList: React.FC<ContactListProps> = ({ selectedContactId, onSelectContact }) => {
  const queryClient = useQueryClient();
  const { channels, activeChannel, setActiveChannelId, isLoadingChannels } = useChannel();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const { contacts, isLoadingContacts, loadMore, hasNextPage, isFetchingNextPage } = useChatContacts(activeChannel?.id || null, searchTerm, sortBy);
  const { mutate: toggleAi } = useMutation({ mutationFn: api.toggleAiStatus, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts', activeChannel?.id] }); }, });

  const handleChannelChange = (event: SelectChangeEvent<string>) => { setActiveChannelId(event.target.value); };

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
    <Box sx={{ width: 320, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', }}>
      <Box sx={{ p: 2, pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Conversations</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="channel-selector-label">Channel</InputLabel>
          <Select labelId="channel-selector-label" label="Channel" value={activeChannel?.id || ''} onChange={handleChannelChange} disabled={isLoadingChannels}>
            {channels.map((channel) => (<MenuItem key={channel.id} value={channel.id}> <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}> <PlatformAvatar platform={channel.platform} sx={{ width: 24, height: 24 }} /> <Typography variant="body2">{channel.name}</Typography> </Box> </MenuItem>))}
          </Select>
        </FormControl>
        <TextField fullWidth variant="outlined" size="small" placeholder="Search by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"> <SearchIcon /> </InputAdornment>), }} sx={{ mb: 1 }} />

        {/* Sort Toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SortIcon fontSize="small" color="action" />
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={handleSortChange}
            size="small"
            sx={{ flex: 1 }}
          >
            <ToggleButton value="recent" sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}>
              <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5 }} /> Recent
            </ToggleButton>
            <ToggleButton value="unread" sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}>
              <MarkUnreadChatAltIcon sx={{ fontSize: 16, mr: 0.5 }} /> Unread
            </ToggleButton>
            <ToggleButton value="name" sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}>
              <SortByAlphaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Name
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <List
        ref={listRef}
        onScroll={handleScroll}
        sx={{ overflowY: 'auto', flexGrow: 1, minHeight: 0, overflowX: 'hidden' }}
      >
        {isLoadingContacts ? (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}> <CircularProgress /> </Box>) : contacts.length > 0 ? (
          <>
            {contacts.map((contact) => {
              const secondaryActionContent = (
                <Tooltip title={contact.ai_enabled ? "AI is ON" : "AI is OFF"}>
                  <IconButton
                    edge="end"
                    onClick={() => toggleAi({ contactId: contact.id, newStatus: !contact.ai_enabled })}
                  >
                    {contact.ai_enabled ? <ToggleOnIcon color="success" /> : <ToggleOffIcon color="action" />}
                  </IconButton>
                </Tooltip>
              );

              return (
                <ListItem key={contact.id} disablePadding secondaryAction={secondaryActionContent}>
                  <ListItemButton
                    selected={selectedContactId === contact.id}
                    onClick={() => onSelectContact(contact.id)}
                  >
                    <ListItemAvatar> <Badge badgeContent={contact.unread_count} color="error"> <PlatformAvatar platform={contact.platform} /> </Badge> </ListItemAvatar>
                    <ListItemText primary={<Typography noWrap>{contact.name || contact.platform_user_id}</Typography>} secondary={<Typography noWrap variant="body2" color="text.secondary">{contact.last_message_preview}</Typography>} />
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
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1 }}>
                {contacts.length} conversations
              </Typography>
            )}
          </>
        ) : (<Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}> {searchTerm ? 'No contacts match your search.' : 'No contacts found in this channel.'} </Typography>)}
      </List>
    </Box>
  );
};

export default React.memo(ContactList);