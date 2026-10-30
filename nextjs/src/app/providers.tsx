'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import ConfirmDialog from '@/components/ConfirmDialog';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ConfirmDialogProvider>
            {children}
            <ConfirmDialog />
          </ConfirmDialogProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
