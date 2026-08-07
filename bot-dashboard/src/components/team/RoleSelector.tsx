// src/components/team/RoleSelector.tsx
'use client';

import React from 'react';
import { Box, Button, ButtonGroup } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

interface RoleSelectorProps {
  value: string;
  onChange: (role: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const roles = [
  { key: 'admin', label: 'Admin', color: '#d32f2f' },
  { key: 'agent', label: 'Agent', color: '#1976d2' },
  { key: 'viewer', label: 'Viewer', color: '#757575' },
];

export default function RoleSelector({ value, onChange, onCancel, disabled }: RoleSelectorProps) {
  const [selected, setSelected] = React.useState(value);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ButtonGroup size="small" variant="outlined" disabled={disabled}>
        {roles.map((role) => (
          <Button
            key={role.key}
            variant={selected === role.key ? 'contained' : 'outlined'}
            onClick={() => setSelected(role.key)}
            sx={{
              textTransform: 'capitalize',
              ...(selected === role.key && {
                backgroundColor: role.color,
                borderColor: role.color,
                '&:hover': { backgroundColor: role.color, opacity: 0.9 },
              }),
            }}
          >
            {role.label}
          </Button>
        ))}
      </ButtonGroup>
      <Button
        size="small"
        color="success"
        onClick={() => onChange(selected)}
        disabled={disabled || selected === value}
        sx={{ minWidth: 32 }}
      >
        <CheckIcon fontSize="small" />
      </Button>
      <Button
        size="small"
        color="error"
        onClick={onCancel}
        disabled={disabled}
        sx={{ minWidth: 32 }}
      >
        <CloseIcon fontSize="small" />
      </Button>
    </Box>
  );
}
