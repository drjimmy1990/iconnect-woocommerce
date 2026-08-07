// src/app/(auth)/layout.tsx

import React from 'react';

// This is the layout for all authentication-related pages (login, register, etc.).
// It does NOT include the main AppSidebar or AppHeader.
// It simply renders the page content on a clean slate.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}