'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Grid, IconButton, Typography,
    Table, TableBody, TableCell, TableHead, TableRow,
    MenuItem, Box, CircularProgress, Divider, InputAdornment,
    Accordion, AccordionSummary, AccordionDetails, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { CrmOrderItem, CrmShippingAddress } from '@/lib/api';
import { AddOrderPayload } from '@/hooks/useClient';

interface OrderDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (orderData: AddOrderPayload) => void;
    isSubmitting: boolean;
}

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending Payment', color: 'warning' },
    { value: 'processing', label: 'Processing', color: 'info' },
    { value: 'shipped', label: 'Shipped', color: 'primary' },
    { value: 'delivered', label: 'Delivered', color: 'success' },
    { value: 'cancelled', label: 'Cancelled', color: 'error' },
    { value: 'refunded', label: 'Refunded', color: 'default' },
] as const;

const FULFILLMENT_OPTIONS = [
    { value: 'unfulfilled', label: 'New Request', color: 'default' },
    { value: 'preparing', label: 'Preparing', color: 'warning' },
    { value: 'ready', label: 'Ready', color: 'info' },
    { value: 'fulfilled', label: 'Completed', color: 'success' },
] as const;

export default function OrderDialog({ open, onClose, onSubmit, isSubmitting }: OrderDialogProps) {
    const generateOrderId = () => `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Core order fields
    const [orderNumber, setOrderNumber] = useState(generateOrderId());
    const [status, setStatus] = useState('pending');
    const [fulfillment, setFulfillment] = useState('unfulfilled');
    const [currency, setCurrency] = useState('USD');

    // Line items
    const [items, setItems] = useState<CrmOrderItem[]>([{ name: '', quantity: 1, price: 0 }]);

    // Financial fields
    const [tax, setTax] = useState(0);
    const [shipping, setShipping] = useState(0);
    const [discount, setDiscount] = useState(0);

    // Shipping address
    const [shippingAddress, setShippingAddress] = useState<CrmShippingAddress>({
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        notes: '',
    });

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setOrderNumber(generateOrderId());
            setStatus('pending');
            setFulfillment('unfulfilled');
            setCurrency('USD');
            setItems([{ name: '', quantity: 1, price: 0 }]);
            setTax(0);
            setShipping(0);
            setDiscount(0);
            setShippingAddress({ street: '', city: '', state: '', postal_code: '', country: '', notes: '' });
        }
    }, [open]);

    // Item management
    const handleItemChange = (index: number, field: keyof CrmOrderItem, value: string | number) => {
        const newItems = [...items];
        if (field === 'quantity' || field === 'price') {
            newItems[index][field] = Number(value);
        } else {
            newItems[index][field] = value as string;
        }
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { name: '', quantity: 1, price: 0 }]);

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    // Calculations
    const subtotal = useMemo(() =>
        items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        [items]
    );

    const total = useMemo(() =>
        subtotal + tax + shipping - discount,
        [subtotal, tax, shipping, discount]
    );

    // Shipping address handler
    const handleAddressChange = (field: keyof CrmShippingAddress, value: string) => {
        setShippingAddress(prev => ({ ...prev, [field]: value }));
    };

    const hasShippingAddress = Object.values(shippingAddress).some(v => v && v.trim() !== '');

    const handleSubmit = () => {
        const validItems = items.filter(i => i.name.trim() !== '');

        onSubmit({
            order_number: orderNumber,
            subtotal,
            tax,
            shipping,
            discount,
            total: Math.max(0, total),
            currency,
            status,
            fulfillment_status: fulfillment,
            items: validItems,
            shipping_address: hasShippingAddress ? shippingAddress : null,
            order_date: new Date().toISOString(),
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Create New Order
                <Chip label={orderNumber} size="small" variant="outlined" sx={{ ml: 'auto' }} />
            </DialogTitle>

            <DialogContent dividers>
                {/* Order Header */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                            label="Order #"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                            select
                            label="Payment Status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            fullWidth
                            size="small"
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                            select
                            label="Fulfillment"
                            value={fulfillment}
                            onChange={(e) => setFulfillment(e.target.value)}
                            fullWidth
                            size="small"
                        >
                            {FULFILLMENT_OPTIONS.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                            select
                            label="Currency"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value="USD">USD ($)</MenuItem>
                            <MenuItem value="EUR">EUR (€)</MenuItem>
                            <MenuItem value="ILS">ILS (₪)</MenuItem>
                            <MenuItem value="EGP">EGP (ج.م)</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>

                {/* Line Items */}
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Order Items</Typography>
                <Table size="small" sx={{ mb: 2 }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell width="50%">Item Name</TableCell>
                            <TableCell width="15%" align="center">Qty</TableCell>
                            <TableCell width="25%" align="right">Unit Price</TableCell>
                            <TableCell width="10%"></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <TextField
                                        placeholder="e.g. Large Pizza, Coffee, etc."
                                        value={item.name}
                                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                        fullWidth
                                        variant="standard"
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                        fullWidth
                                        variant="standard"
                                        size="small"
                                        slotProps={{ htmlInput: { min: 1, style: { textAlign: 'center' } } }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                        fullWidth
                                        variant="standard"
                                        size="small"
                                        slotProps={{
                                            htmlInput: { min: 0, step: 0.01, style: { textAlign: 'right' } },
                                            input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => removeItem(index)}
                                        disabled={items.length === 1}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Button startIcon={<AddIcon />} size="small" onClick={addItem} sx={{ mb: 3 }}>
                    Add Item
                </Button>

                <Divider sx={{ my: 2 }} />

                {/* Financial Summary */}
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Additional Charges</Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6 }}>
                                <TextField
                                    label="Tax"
                                    type="number"
                                    value={tax}
                                    onChange={(e) => setTax(Number(e.target.value))}
                                    fullWidth
                                    size="small"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField
                                    label="Shipping"
                                    type="number"
                                    value={shipping}
                                    onChange={(e) => setShipping(Number(e.target.value))}
                                    fullWidth
                                    size="small"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField
                                    label="Discount"
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(Number(e.target.value))}
                                    fullWidth
                                    size="small"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { startAdornment: <InputAdornment position="start">-$</InputAdornment> }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Order Summary</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                                <Typography variant="body2">${subtotal.toFixed(2)}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">Tax:</Typography>
                                <Typography variant="body2">${tax.toFixed(2)}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">Shipping:</Typography>
                                <Typography variant="body2">${shipping.toFixed(2)}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">Discount:</Typography>
                                <Typography variant="body2" color="error.main">-${discount.toFixed(2)}</Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="h6" fontWeight={700}>Total:</Typography>
                                <Typography variant="h6" fontWeight={700} color="primary.main">
                                    ${Math.max(0, total).toFixed(2)}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>

                {/* Shipping Address (Collapsible) */}
                <Accordion sx={{ mt: 3 }} elevation={0} variant="outlined">
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <LocalShippingIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography>Shipping Address (Optional)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Street Address"
                                    value={shippingAddress.street}
                                    onChange={(e) => handleAddressChange('street', e.target.value)}
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="City"
                                    value={shippingAddress.city}
                                    onChange={(e) => handleAddressChange('city', e.target.value)}
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 3 }}>
                                <TextField
                                    label="State/Province"
                                    value={shippingAddress.state}
                                    onChange={(e) => handleAddressChange('state', e.target.value)}
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 3 }}>
                                <TextField
                                    label="Postal Code"
                                    value={shippingAddress.postal_code}
                                    onChange={(e) => handleAddressChange('postal_code', e.target.value)}
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Country"
                                    value={shippingAddress.country}
                                    onChange={(e) => handleAddressChange('country', e.target.value)}
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Delivery Notes"
                                    value={shippingAddress.notes}
                                    onChange={(e) => handleAddressChange('notes', e.target.value)}
                                    fullWidth
                                    size="small"
                                    placeholder="e.g. Ring doorbell, leave at door"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isSubmitting || items.every(i => !i.name.trim())}
                    sx={{ minWidth: 140 }}
                >
                    {isSubmitting ? <CircularProgress size={24} /> : 'Create Order'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
