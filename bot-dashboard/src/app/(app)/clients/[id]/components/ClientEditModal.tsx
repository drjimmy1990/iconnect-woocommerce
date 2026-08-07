import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    MenuItem,
    Chip,
    Autocomplete
} from '@mui/material';
import { CrmClient } from '@/lib/api';
import { useClient } from '@/hooks/useClient';

interface ClientEditModalProps {
    open: boolean;
    onClose: () => void;
    client: CrmClient;
}

const CLIENT_TYPES = ['new', 'interested', 'customer', 'repeat_customer', 'inactive'];

export default function ClientEditModal({ open, onClose, client }: ClientEditModalProps) {
    const { updateClient, isUpdatingClient } = useClient(client.id);

    const [formData, setFormData] = useState({
        company_name: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        client_type: '',
        tags: [] as string[],
        assigned_team: ''
    });

    useEffect(() => {
        if (client) {
            // Fallback to JSONB address if explicit columns are empty
            const addressJson = client.address as { street?: string; city?: string; state?: string; postal_code?: string; country?: string } | null;

            setFormData({
                company_name: client.company_name || '',
                email: client.email || '',
                phone: client.phone || '',
                street: client.street || addressJson?.street || '',
                city: client.city || addressJson?.city || '',
                state: client.state || addressJson?.state || '',
                postal_code: client.postal_code || addressJson?.postal_code || '',
                country: client.country || addressJson?.country || '',
                client_type: client.client_type || 'new',
                tags: client.tags || [],
                assigned_team: client.assigned_team || ''
            });
        }
    }, [client, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTagsChange = (event: React.SyntheticEvent, newValue: string[]) => {
        setFormData(prev => ({ ...prev, tags: newValue }));
    };

    const handleSubmit = () => {
        console.log("Submitting form data:", formData);
        updateClient({
            company_name: formData.company_name,
            email: formData.email,
            phone: formData.phone,
            street: formData.street,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client_type: formData.client_type as any,
            tags: formData.tags,
            assigned_team: formData.assigned_team || null
        }, {
            onSuccess: () => {
                console.log("Update successful");
                onClose();
            },
            onError: (error) => {
                console.error("Update failed:", error);
                alert(`Failed to update client: ${error.message}`);
            }
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Edit Client Details</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Company / Name"
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={formData.tags}
                            onChange={handleTagsChange}
                            renderTags={(value: readonly string[], getTagProps) =>
                                value.map((option: string, index: number) => {
                                    const { key, ...tagProps } = getTagProps({ index });
                                    return (
                                        <Chip variant="outlined" label={option} key={key} {...tagProps} />
                                    );
                                })
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    label="Tags"
                                    placeholder="Add tags"
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            select
                            fullWidth
                            label="Client Type"
                            name="client_type"
                            value={formData.client_type}
                            onChange={handleChange}
                        >
                            {CLIENT_TYPES.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {type === 'repeat_customer' ? 'Repeat Customer' : type.charAt(0).toUpperCase() + type.slice(1)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {/* Address Fields */}
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label="Street Address"
                            name="street"
                            value={formData.street}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="City"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="State / Province"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Postal Code"
                            name="postal_code"
                            value={formData.postal_code}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Country"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                        />
                    </Grid>

                    {/* Team Assignment (Placeholder for now, needs team fetching) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Assigned Team ID"
                            name="assigned_team"
                            value={formData.assigned_team}
                            onChange={handleChange}
                            helperText="Enter Team UUID (UI for selecting teams coming soon)"
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={isUpdatingClient}>
                    {isUpdatingClient ? 'Saving...' : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
