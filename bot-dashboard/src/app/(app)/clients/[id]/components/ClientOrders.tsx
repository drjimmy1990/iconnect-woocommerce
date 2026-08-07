'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Paper, Button, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Collapse, IconButton, Snackbar, Alert, Divider, Grid
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { CrmOrder, CrmOrderItem } from '@/lib/api';
import { useClient, AddOrderPayload } from '@/hooks/useClient';
import OrderDialog from '@/components/crm/OrderDialog';

// Status color mapping
const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'error' | 'default' | 'primary' => {
    switch (status) {
        case 'delivered': return 'success';
        case 'shipped': return 'primary';
        case 'processing': return 'info';
        case 'pending': return 'warning';
        case 'cancelled': return 'error';
        case 'refunded': return 'default';
        default: return 'default';
    }
};

const getFulfillmentColor = (status: string): 'success' | 'info' | 'warning' | 'default' => {
    switch (status) {
        case 'fulfilled': return 'success';
        case 'ready': return 'info';
        case 'preparing': return 'warning';
        default: return 'default';
    }
};

// Expandable Row Component
function OrderRow({ order }: { order: CrmOrder }) {
    const [open, setOpen] = useState(false);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatCurrency = (amount: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' }, '&:hover': { bgcolor: 'action.hover' } }}>
                <TableCell>
                    <IconButton size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ReceiptIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={600}>{order.order_number}</Typography>
                    </Box>
                </TableCell>
                <TableCell>{formatDate(order.order_date)}</TableCell>
                <TableCell>
                    <Chip
                        label={order.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(order.status)}
                        variant="outlined"
                    />
                </TableCell>
                <TableCell>
                    <Chip
                        label={order.fulfillment_status || 'unfulfilled'}
                        size="small"
                        color={getFulfillmentColor(order.fulfillment_status)}
                        variant="filled"
                    />
                </TableCell>
                <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>
                        {formatCurrency(order.total, order.currency)}
                    </Typography>
                </TableCell>
            </TableRow>

            {/* Expanded Details */}
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ m: 2 }}>
                            <Grid container spacing={3}>
                                {/* Line Items */}
                                <Grid size={{ xs: 12, md: 7 }}>
                                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                        Order Items
                                    </Typography>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                <TableCell>Item</TableCell>
                                                <TableCell align="center">Qty</TableCell>
                                                <TableCell align="right">Unit Price</TableCell>
                                                <TableCell align="right">Total</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {order.items && order.items.map((item: CrmOrderItem, index: number) => (
                                                <TableRow key={index}>
                                                    <TableCell>{item.name}</TableCell>
                                                    <TableCell align="center">{item.quantity}</TableCell>
                                                    <TableCell align="right">{formatCurrency(item.price, order.currency)}</TableCell>
                                                    <TableCell align="right">{formatCurrency(item.quantity * item.price, order.currency)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!order.items || order.items.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={4} align="center">
                                                        <Typography color="text.secondary" variant="body2">No items recorded</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Grid>

                                {/* Financial Summary & Shipping */}
                                <Grid size={{ xs: 12, md: 5 }}>
                                    {/* Financial Breakdown */}
                                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                        Order Summary
                                    </Typography>
                                    <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                                            <Typography variant="body2">{formatCurrency(order.subtotal, order.currency)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">Tax:</Typography>
                                            <Typography variant="body2">{formatCurrency(order.tax, order.currency)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">Shipping:</Typography>
                                            <Typography variant="body2">{formatCurrency(order.shipping, order.currency)}</Typography>
                                        </Box>
                                        {order.discount > 0 && (
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Discount:</Typography>
                                                <Typography variant="body2" color="error.main">
                                                    -{formatCurrency(order.discount, order.currency)}
                                                </Typography>
                                            </Box>
                                        )}
                                        <Divider sx={{ my: 1 }} />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="subtitle2" fontWeight={700}>Total:</Typography>
                                            <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                                                {formatCurrency(order.total, order.currency)}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Shipping Address */}
                                    {order.shipping_address && Object.values(order.shipping_address).some(v => v) && (
                                        <>
                                            <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <LocalShippingIcon fontSize="small" /> Shipping Address
                                            </Typography>
                                            <Box sx={{ bgcolor: 'background.paper', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="body2">
                                                    {order.shipping_address.street && <>{order.shipping_address.street}<br /></>}
                                                    {order.shipping_address.city}{order.shipping_address.state && `, ${order.shipping_address.state}`} {order.shipping_address.postal_code}
                                                    {order.shipping_address.country && <><br />{order.shipping_address.country}</>}
                                                </Typography>
                                                {order.shipping_address.notes && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                        Note: {order.shipping_address.notes}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </>
                                    )}

                                    {/* Tracking Number */}
                                    {order.tracking_number && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Tracking: <strong>{order.tracking_number}</strong>
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Dates */}
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Ordered: {formatDate(order.order_date)}
                                            {order.shipped_date && <> • Shipped: {formatDate(order.shipped_date)}</>}
                                            {order.delivered_date && <> • Delivered: {formatDate(order.delivered_date)}</>}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

interface ClientOrdersProps {
    clientId: string;
    orders: CrmOrder[];
}

export default function ClientOrders({ clientId, orders }: ClientOrdersProps) {
    const { addOrder, isAddingOrder } = useClient(clientId);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

    const handleCreateOrder = (payload: AddOrderPayload) => {
        addOrder(payload, {
            onSuccess: () => {
                setDialogOpen(false);
                setSnackbar({ open: true, message: 'Order created successfully!', severity: 'success' });
            },
            onError: (err: Error) => {
                setSnackbar({ open: true, message: err.message, severity: 'error' });
            }
        });
    };

    // Calculate totals for header
    const totalRevenue = orders
        .filter(o => !['cancelled', 'refunded'].includes(o.status))
        .reduce((sum, o) => sum + o.total, 0);

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={600}>Order History</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {orders.length} order{orders.length !== 1 ? 's' : ''} • Total Revenue: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRevenue)}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddShoppingCartIcon />}
                    onClick={() => setDialogOpen(true)}
                    sx={{ borderRadius: 2 }}
                >
                    Create Order
                </Button>
            </Box>

            {/* Orders Table */}
            {orders.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }} variant="outlined">
                    <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>No orders found for this client.</Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddShoppingCartIcon />}
                        onClick={() => setDialogOpen(true)}
                        sx={{ mt: 2 }}
                    >
                        Create First Order
                    </Button>
                </Paper>
            ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell width={50} />
                                <TableCell>Order #</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell>Payment</TableCell>
                                <TableCell>Fulfillment</TableCell>
                                <TableCell align="right">Total</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map((order) => (
                                <OrderRow key={order.id} order={order} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Order Dialog */}
            <OrderDialog
                open={isDialogOpen}
                onClose={() => setDialogOpen(false)}
                onSubmit={handleCreateOrder}
                isSubmitting={isAddingOrder}
            />

            {/* Snackbar */}
            {snackbar && (
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} variant="filled">
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
        </Box>
    );
}
