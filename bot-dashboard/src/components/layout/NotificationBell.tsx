'use client';

import React, { useState } from 'react';
import {
    IconButton, Badge, Menu, MenuItem, Typography, Box,
    Switch, FormControlLabel, Divider, Button, ListItemText, ListItemIcon
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CircleIcon from '@mui/icons-material/Circle';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { useNotifications, SystemNotification } from '@/providers/NotificationProvider';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

function getNotificationIcon(type: string) {
    switch (type) {
        case 'handoff':
            return <PriorityHighIcon color="error" sx={{ fontSize: 20 }} />;
        case 'alert':
            return <WarningIcon color="warning" sx={{ fontSize: 20 }} />;
        default:
            return <InfoIcon color="info" sx={{ fontSize: 20 }} />;
    }
}

export default function NotificationBell() {
    const { unreadCount, notifications, markAsRead, markAllAsRead, isMuted, toggleMute } = useNotifications();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const router = useRouter();

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleItemClick = (notification: SystemNotification) => {
        markAsRead(notification.id);
        handleClose();
        if (notification.client_id) {
            router.push(`/clients/${notification.client_id}`);
        }
    };

    return (
        <>
            <IconButton color="inherit" onClick={handleOpen}>
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                slotProps={{
                    paper: {
                        sx: { width: 360, maxHeight: 500 }
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Notifications</Typography>
                    <FormControlLabel
                        control={<Switch size="small" checked={!isMuted} onChange={toggleMute} color="primary" />}
                        label={<Typography variant="caption">{isMuted ? "Muted" : "Active"}</Typography>}
                    />
                </Box>

                <Divider />

                {notifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary">No notifications yet.</Typography>
                    </Box>
                ) : (
                    notifications.slice(0, 20).map((notif) => (
                        <MenuItem
                            key={notif.id}
                            onClick={() => handleItemClick(notif)}
                            selected={!notif.is_read}
                            sx={{
                                alignItems: 'flex-start',
                                gap: 1,
                                py: 1.5,
                                bgcolor: !notif.is_read ? 'action.hover' : 'inherit'
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                                {!notif.is_read && <CircleIcon color="primary" sx={{ fontSize: 10, mr: 0.5 }} />}
                                {getNotificationIcon(notif.type)}
                            </ListItemIcon>
                            <ListItemText
                                primary={notif.title}
                                secondary={
                                    <React.Fragment>
                                        <Typography variant="body2" color="text.primary" component="span" sx={{ display: 'block' }}>
                                            {notif.message}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                        </Typography>
                                    </React.Fragment>
                                }
                            />
                        </MenuItem>
                    ))
                )}

                <Divider />

                <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                    <Button size="small" onClick={() => { markAllAsRead(); handleClose(); }}>
                        Mark all as read
                    </Button>
                </Box>
            </Menu>
        </>
    );
}
