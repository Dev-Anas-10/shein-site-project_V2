'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeLangProvider } from '@/lib/theme-lang-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeLangProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeLangProvider>
  );
}
