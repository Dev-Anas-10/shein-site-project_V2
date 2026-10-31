'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    window.location.replace('/orders');
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-4 text-center dark:bg-[#0c0a0f]">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">Redirecting…</p>
    </main>
  );
}
