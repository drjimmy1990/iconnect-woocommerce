// src/theme.ts
'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4F46E5', // Electric Indigo
      light: '#818CF8',
      dark: '#3730A3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#06B6D4', // Vibrant Cyan
      light: '#22D3EE',
      dark: '#0891B2',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#10B981', // Emerald
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#F59E0B', // Amber
      light: '#FBBF24',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444', // Rose Red
      light: '#F87171',
      dark: '#DC2626',
    },
    info: {
      main: '#3B82F6', // Sky Blue
      light: '#60A5FA',
      dark: '#1D4ED8',
    },
    background: {
      default: '#F8FAFC', // Slate 50 - clean & soft
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A', // Slate 900
      secondary: '#64748B', // Slate 500
      disabled: '#94A3B8', // Slate 400
    },
    divider: 'rgba(226, 232, 240, 0.9)',
    action: {
      hover: 'rgba(79, 70, 229, 0.04)',
      selected: 'rgba(79, 70, 229, 0.08)',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
      color: '#0F172A',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#0F172A',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.015em',
      color: '#0F172A',
    },
    subtitle1: {
      color: '#64748B',
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      color: '#64748B',
      fontWeight: 600,
    },
    body1: {
      color: '#1E293B',
      lineHeight: 1.6,
    },
    body2: {
      color: '#475569',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          padding: '8px 16px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)',
          },
        },
        outlined: {
          borderColor: '#E2E8F0',
          '&:hover': {
            borderColor: '#CBD5E1',
            backgroundColor: 'rgba(79, 70, 229, 0.04)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#E2E8F0',
            transition: 'border-color 0.2s ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94A3B8',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4F46E5',
            borderWidth: '1.5px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #F1F5F9',
        },
        head: {
          fontWeight: 700,
          color: '#64748B',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          transition: 'all 0.15s ease',
        },
      },
    },
  },
});

export default theme;