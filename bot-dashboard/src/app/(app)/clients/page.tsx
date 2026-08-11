// src/app/(app)/clients/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Button,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Badge,
  alpha,
  useTheme,
} from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel, GridRowParams, GridRowSelectionModel } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LabelIcon from '@mui/icons-material/Label';
import DeleteIcon from '@mui/icons-material/Delete';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import LanguageIcon from '@mui/icons-material/Language';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { useClientList, ClientFilters as ClientFiltersType } from '@/hooks/useClientList';
import { CrmClient } from '@/lib/api';
import ClientFilters from './components/ClientFilters';

// Platform icon + color mapping
const platformConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  facebook: { icon: <FacebookIcon sx={{ fontSize: 12, color: '#fff' }} />, color: '#1877F2', bg: '#1877F214' },
  instagram: { icon: <InstagramIcon sx={{ fontSize: 12, color: '#fff' }} />, color: '#E4405F', bg: '#E4405F14' },
  whatsapp: { icon: <WhatsAppIcon sx={{ fontSize: 12, color: '#fff' }} />, color: '#25D366', bg: '#25D36614' },
  telegram: { icon: <TelegramIcon sx={{ fontSize: 12, color: '#fff' }} />, color: '#0088cc', bg: '#0088cc14' },
  web: { icon: <LanguageIcon sx={{ fontSize: 12, color: '#fff' }} />, color: '#607D8B', bg: '#607D8B14' },
};

// Generate consistent avatar colors from name
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// Relative time formatter
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Type chip config
const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: '#2196F3', bg: '#2196F314' },
  interested: { label: 'Interested', color: '#FF9800', bg: '#FF980014' },
  customer: { label: 'Customer', color: '#4CAF50', bg: '#4CAF5014' },
  repeat_customer: { label: 'Repeat', color: '#00897B', bg: '#00897B14' },
  inactive: { label: 'Inactive', color: '#9E9E9E', bg: '#9E9E9E14' },
};

// Define the columns for the DataGrid
const columns: GridColDef<CrmClient>[] = [
  {
    field: 'company_name',
    headerName: 'Client',
    flex: 1.8,
    minWidth: 200,
    renderCell: (params) => {
      const name = params.row.company_name || params.row.email || 'Unknown';
      const bgColor = stringToColor(name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = params.row as any;
      const platform = params.row.source || '';
      const platformCfg = platformConfig[platform];

      return (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ height: '100%', py: 1 }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              platformCfg ? (
                <Avatar
                  sx={{
                    width: 18,
                    height: 18,
                    bgcolor: platformCfg.color,
                    border: '2px solid',
                    borderColor: 'background.paper',
                  }}
                >
                  {platformCfg.icon}
                </Avatar>
              ) : undefined
            }
          >
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: bgColor,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {getInitials(name)}
            </Avatar>
          </Badge>
          <Stack direction="column" justifyContent="center" sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.channel_name || platform || 'No source'}
            </Typography>
          </Stack>
        </Stack>
      );
    },
  },
  {
    field: 'client_type',
    headerName: 'Status',
    flex: 0.7,
    minWidth: 100,
    renderCell: (params) => {
      const cfg = typeConfig[params.row.client_type] || typeConfig.inactive;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            label={cfg.label}
            size="small"
            sx={{
              bgcolor: cfg.bg,
              color: cfg.color,
              fontWeight: 600,
              fontSize: '0.75rem',
              borderRadius: '6px',
              height: 26,
              border: 'none',
            }}
          />
        </Box>
      );
    }
  },
  {
    field: 'conversation_stage',
    headerName: 'Stage',
    flex: 0.8,
    minWidth: 120,
    renderCell: (params) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage = (params.row as any).conversation_stage || 'first_contact';
      const stageLabels: Record<string, { label: string; emoji: string }> = {
        first_contact: { label: 'First Contact', emoji: '👋' },
        browsing: { label: 'Browsing', emoji: '🔍' },
        product_viewed: { label: 'Product Viewed', emoji: '📦' },
        order_placed: { label: 'Order Placed', emoji: '🛒' },
        purchased: { label: 'Purchased', emoji: '✅' },
        support: { label: 'Support', emoji: '🎧' },
      };
      const cfg = stageLabels[stage] || stageLabels.first_contact;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
            {cfg.emoji} {cfg.label}
          </Typography>
        </Box>
      );
    }
  },
  {
    field: 'email',
    headerName: 'Email',
    flex: 1.2,
    minWidth: 150,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {params.value || '—'}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'phone',
    headerName: 'Phone',
    flex: 0.9,
    minWidth: 120,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
          {params.value || '—'}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'last_contact_date',
    headerName: 'Last Active',
    flex: 0.8,
    minWidth: 110,
    renderCell: (params) => {
      const value = params.row.last_contact_date;
      if (!value) return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="caption" color="text.disabled">Never</Typography>
        </Box>
      );
      const date = new Date(value);
      const relative = formatRelativeTime(date);
      const isRecent = (Date.now() - date.getTime()) < 86400000; // < 24h

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0.5 }}>
          <AccessTimeIcon sx={{ fontSize: 14, color: isRecent ? 'success.main' : 'text.disabled' }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: isRecent ? 600 : 400,
              color: isRecent ? 'success.main' : 'text.secondary',
            }}
          >
            {relative}
          </Typography>
        </Box>
      );
    },
  },
];

export default function ClientsListPage() {
  const router = useRouter();
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  // Filter State
  const [filters, setFilters] = useState<ClientFiltersType>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Selection State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([] as any);

  const { data, isLoading, isFetching } = useClientList({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    searchTerm: searchTerm,
    filters: filters,
  });

  const handleRowClick = (params: GridRowParams) => {
    router.push(`/clients/${params.id}`);
  };

  const activeFilterCount = Object.keys(filters).filter(k => {
    const val = filters[k as keyof ClientFiltersType];
    return Array.isArray(val) ? val.length > 0 : val !== undefined && val !== null;
  }).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', width: 44, height: 44 }}>
            <PeopleAltIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Clients
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.count !== undefined ? `${data.count.toLocaleString()} contacts` : 'Loading...'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setIsFilterOpen(true)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              ...(activeFilterCount > 0 && {
                borderColor: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.04),
              }),
            }}
          >
            Filters {activeFilterCount > 0 && (
              <Chip
                label={activeFilterCount}
                size="small"
                color="primary"
                sx={{ ml: 0.5, height: 20, minWidth: 20, fontSize: '0.7rem' }}
              />
            )}
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {/* TODO: Create Client Modal */}}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Add Client
          </Button>
        </Stack>
      </Box>

      <Paper
        elevation={0}
        sx={{
          height: '75vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {/* Search Toolbar */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Search by name, email, phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: 450,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.paper',
              },
            }}
          />

          {/* Bulk Actions */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(rowSelectionModel as any).length > 0 && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const selectedCount = (rowSelectionModel as any).length as number;
            return (
            <Stack direction="row" spacing={0.5} sx={{ ml: 'auto', alignItems: 'center' }}>
              <Chip
                label={`${selectedCount} selected`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Tooltip title="Assign Agent">
                <IconButton size="small"><PersonAddIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Add Tags">
                <IconButton size="small"><LabelIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
            );
          })()}
        </Box>

        <DataGrid
          rows={data?.clients || []}
          columns={columns}
          rowCount={data?.count || 0}
          loading={isLoading || isFetching}
          paginationMode="server"
          paginationModel={paginationModel}
          onRowSelectionModelChange={setRowSelectionModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          onRowClick={handleRowClick}
          getRowHeight={() => 'auto'}
          disableColumnMenu
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: alpha(theme.palette.background.default, 0.6),
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.secondary',
            },
            '& .MuiDataGrid-row': {
              transition: 'background-color 0.15s ease',
              '&:hover': {
                cursor: 'pointer',
                bgcolor: alpha(theme.palette.primary.main, 0.04),
              },
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.5),
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid',
              borderColor: 'divider',
            },
          }}
        />
      </Paper>

      <ClientFilters
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={setFilters}
        onReset={() => setFilters({})}
      />
    </Box>
  );
}