'use client';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // --- THIS IS THE FIX ---
  // We add a new state to track the initial authentication check.
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // This effect runs once when the component mounts.
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If a session is found, the middleware will handle the redirect.
      // We just need to wait. If no session, we can show the form.
      if (!session) {
        setIsCheckingAuth(false);
      }
      // If there IS a session, `isCheckingAuth` remains true,
      // and the loader will continue to show while the middleware redirects.
    };
    
    checkSession();
  }, []); // The empty dependency array ensures this runs only once.


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    } else {
      // On successful login, push to the home page.
      // The middleware will also see the new session and allow access.
      router.push('/');
    }
  };

  // --- THIS IS THE FIX ---
  // While we are checking for an existing session, render a full-screen loader.
  if (isCheckingAuth) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: 'grey.200',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Only render the login form if the auth check is complete and there is no user.
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        bgcolor: 'grey.200',
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Login
        </Typography>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Verifying...' : 'Login'}
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
      </Paper>
    </Box>
  );
}