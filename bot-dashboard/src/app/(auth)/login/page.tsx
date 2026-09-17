'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Fade,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  // Check if session already exists on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/');
        } else {
          setIsCheckingAuth(false);
        }
      } catch {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: '#0f172a',
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: '#38bdf8' }} />
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          Checking authorization...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        p: 2,
      }}
    >
      <Fade in timeout={600}>
        <Paper
          elevation={6}
          component="form"
          onSubmit={handleSubmit}
          sx={{
            p: { xs: 3.5, sm: 4.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            width: '100%',
            maxWidth: 440,
            borderRadius: 4,
            bgcolor: 'background.paper',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Brand Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 1 }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                mb: 2,
                background: 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
                boxShadow: '0 8px 16px rgba(37,99,235,0.25)',
              }}
            >
              <StorefrontIcon sx={{ fontSize: 30, color: '#ffffff' }} />
            </Avatar>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              iConnect International
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              AI Commerce & Customer Support Hub
            </Typography>
          </Box>

          {error && (
            <Fade in>
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            </Fade>
          )}

          {/* Email Input */}
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Password Input with Show/Hide Toggle */}
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isLoading}
            sx={{
              mt: 1,
              py: 1.3,
              fontWeight: 600,
              fontSize: '1rem',
              borderRadius: 2.5,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              },
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In to Dashboard'}
          </Button>

          {/* Security Subtitle */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: 'center', mt: 1, opacity: 0.8 }}
          >
            Protected by Supabase Auth • Official iConnect Administration
          </Typography>
        </Paper>
      </Fade>
    </Box>
  );
}