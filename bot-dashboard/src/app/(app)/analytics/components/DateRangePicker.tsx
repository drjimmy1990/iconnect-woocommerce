'use client';

import React from 'react';
import { Box, TextField, MenuItem, Stack } from '@mui/material';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// We expand the type to include new options
export type DateRangeOption = 'yesterday' | '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';

interface DateRangePickerProps {
    value: DateRangeOption;
    onChange: (value: DateRangeOption) => void;
    customStart: Date | null;
    onCustomStartChange: (date: Date | null) => void;
    customEnd: Date | null;
    onCustomEndChange: (date: Date | null) => void;
}

const options: { value: DateRangeOption; label: string }[] = [
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' },
    { value: 'all', label: 'All Time' },
    { value: 'custom', label: 'Custom Range...' },
];

export default function DateRangePicker({
    value,
    onChange,
    customStart,
    onCustomStartChange,
    customEnd,
    onCustomEndChange
}: DateRangePickerProps) {

    // We use LocalizationProvider here to ensure the date pickers work
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ minWidth: 150 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Date Range"
                        value={value}
                        onChange={(e) => onChange(e.target.value as DateRangeOption)}
                    >
                        {options.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                {/* Show specific date pickers ONLY if 'custom' is selected */}
                {value === 'custom' && (
                    <Stack direction="row" spacing={2}>
                        <MuiDatePicker
                            label="From"
                            value={customStart}
                            onChange={onCustomStartChange}
                            slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
                        />
                        <MuiDatePicker
                            label="To"
                            value={customEnd}
                            onChange={onCustomEndChange}
                            slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
                        />
                    </Stack>
                )}
            </Box>
        </LocalizationProvider>
    );
}