// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import QueryProvider from '@/providers/QueryProvider';
import AuthProvider from '@/providers/AuthProvider';
import './globals.css';
import { UIProvider } from '@/providers/UIProvider';
import { ChannelProvider } from '@/providers/ChannelProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'N8N AI Chat Dashboard',
  description: 'Manage your AI-powered conversations.',
};

// This is the RootLayout. It sets up providers.
// It does NOT render AppHeader or AppSidebar directly.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryProvider>
              <AuthProvider>
                {/* UIProvider must be here, wrapping the children */}
                <UIProvider>
                  <ChannelProvider>
                    <NotificationProvider>
                      {/* All other layouts, like (app)/layout.tsx, will be rendered here as 'children' */}
                      {children}
                    </NotificationProvider>
                  </ChannelProvider>
                </UIProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}