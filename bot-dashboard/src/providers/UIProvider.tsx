// src/providers/UIProvider.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// 1. Define the shape of the context data
interface UIContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

// 2. Create the context with a default value
const UIContext = createContext<UIContextType | undefined>(undefined);

// 3. Create the Provider component
export function UIProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const value = { isSidebarOpen, toggleSidebar };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// 4. Create a custom hook for easy access to the context
export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}