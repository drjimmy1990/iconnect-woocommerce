import React from 'react';
import {
    Box,
    Typography,
    Drawer,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    OutlinedInput,
    Button,
    Divider,
    Stack,
    SelectChangeEvent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ClientFilters as FilterType } from '@/hooks/useClientList';
import { useTags } from '@/hooks/useTags';
import { useAgents } from '@/hooks/useAgents';
import { useChannels } from '@/hooks/useChannels';

interface ClientFiltersProps {
    open: boolean;
    onClose: () => void;
    filters: FilterType;
    onFilterChange: (newFilters: FilterType) => void;
    onReset: () => void;
}

const TYPE_OPTIONS = [
    { value: 'new', label: '🆕 New' },
    { value: 'interested', label: '👀 Interested' },
    { value: 'customer', label: '✅ Customer' },
    { value: 'repeat_customer', label: '🔄 Repeat Customer' },
    { value: 'inactive', label: '💤 Inactive' },
];

const STAGE_OPTIONS = [
    { value: 'first_contact', label: '👋 First Contact' },
    { value: 'bmi_collected', label: '📊 BMI Collected' },
    { value: 'testimonials_viewed', label: '⭐ Testimonials' },
    { value: 'price_viewed', label: '💰 Price Viewed' },
    { value: 'purchased', label: '🎉 Purchased' },
];

export default function ClientFilters({
    open,
    onClose,
    filters,
    onFilterChange,
    onReset,
}: ClientFiltersProps) {
    const { data: tags } = useTags();
    const { data: agents } = useAgents();
    const { channels } = useChannels();

    const handleMultiSelectChange = (event: SelectChangeEvent<string[]>, field: keyof FilterType) => {
        const {
            target: { value },
        } = event;
        onFilterChange({
            ...filters,
            [field]: typeof value === 'string' ? value.split(',') : value,
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTextChange = (field: keyof FilterType, value: any) => {
        onFilterChange({
            ...filters,
            [field]: value,
        });
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { width: 350, p: 3 } }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Filters</Typography>
                <Button size="small" onClick={onReset}>
                    Reset
                </Button>
            </Box>

            <Stack spacing={3}>
                {/* Client Type */}
                <FormControl size="small">
                    <InputLabel>Client Type</InputLabel>
                    <Select
                        multiple
                        value={filters.type || []}
                        onChange={(e) => handleMultiSelectChange(e, 'type')}
                        input={<OutlinedInput label="Client Type" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => {
                                    const opt = TYPE_OPTIONS.find(o => o.value === value);
                                    return <Chip key={value} label={opt?.label || value} size="small" />;
                                })}
                            </Box>
                        )}
                    >
                        {TYPE_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Conversation Stage */}
                <FormControl size="small">
                    <InputLabel>Stage</InputLabel>
                    <Select
                        multiple
                        value={filters.conversation_stage || []}
                        onChange={(e) => handleMultiSelectChange(e, 'conversation_stage')}
                        input={<OutlinedInput label="Stage" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => {
                                    const opt = STAGE_OPTIONS.find(o => o.value === value);
                                    return <Chip key={value} label={opt?.label || value} size="small" />;
                                })}
                            </Box>
                        )}
                    >
                        {STAGE_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Page / Channel */}
                <FormControl size="small">
                    <InputLabel>Page / Channel</InputLabel>
                    <Select
                        value={filters.channel_id || ''}
                        label="Page / Channel"
                        onChange={(e) => handleTextChange('channel_id', e.target.value || undefined)}
                    >
                        <MenuItem value="">
                            <em>All Pages</em>
                        </MenuItem>
                        {channels?.map((ch) => (
                            <MenuItem key={ch.id} value={ch.id}>
                                {ch.name} ({ch.platform})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider />

                {/* Assigned Agent */}
                <FormControl size="small">
                    <InputLabel>Assigned Agent</InputLabel>
                    <Select
                        value={filters.assignee || ''}
                        label="Assigned Agent"
                        onChange={(e) => handleTextChange('assignee', e.target.value || undefined)}
                    >
                        <MenuItem value="">
                            <em>Any</em>
                        </MenuItem>
                        <MenuItem value="unassigned">Unassigned</MenuItem>
                        {agents?.map((agent) => (
                            <MenuItem key={agent.id} value={agent.id}>
                                {agent.full_name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Tags */}
                <FormControl size="small">
                    <InputLabel>Tags</InputLabel>
                    <Select
                        multiple
                        value={filters.tags || []}
                        onChange={(e) => handleMultiSelectChange(e, 'tags')}
                        input={<OutlinedInput label="Tags" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                    <Chip key={value} label={value} size="small" />
                                ))}
                            </Box>
                        )}
                    >
                        {tags?.map((tag) => (
                            <MenuItem key={tag.name} value={tag.name}>
                                {tag.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider />

                {/* Dates */}
                <Typography variant="subtitle2">Created Date</Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Stack spacing={2}>
                        <DatePicker
                            label="Created After"
                            value={filters.created_after || null}
                            onChange={(newValue) => handleTextChange('created_after', newValue)}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                        <DatePicker
                            label="Created Before"
                            value={filters.created_before || null}
                            onChange={(newValue) => handleTextChange('created_before', newValue)}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                    </Stack>
                </LocalizationProvider>
            </Stack>
        </Drawer>
    );
}
