// src/components/auth/PageGuard.tsx
// Automatically gates access based on the current URL path.
// Used in the (app) layout to protect all pages without modifying each page individually.
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import RequirePermission from './RequirePermission';

// Map URL path prefixes to page permission keys
const PATH_TO_PERMISSION: Record<string, string> = {
  '/chat': 'chat',
  '/clients': 'clients',
  '/channels': 'channels',
  '/settings': 'settings',
  '/analytics': 'analytics',
  '/team': 'team',
};

export default function PageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Find which permission key matches the current path
  const matchedEntry = Object.entries(PATH_TO_PERMISSION).find(([prefix]) =>
    pathname.startsWith(prefix)
  );

  // If no match (e.g. home page "/"), render without guard
  if (!matchedEntry) {
    return <>{children}</>;
  }

  const [, permissionKey] = matchedEntry;

  return (
    <RequirePermission page={permissionKey}>
      {children}
    </RequirePermission>
  );
}
