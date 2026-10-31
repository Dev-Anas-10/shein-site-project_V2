'use client';

import React, { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_DONE' }, '*');
        window.close();
      } else {
        window.location.href = '/orders';
      }
      return;
    }

    // Capture the session from URL hash or code exchange
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const email = session.user.email || '';
        const name = meta.full_name || meta.name || email.split('@')[0] || 'Customer';
        const avatar =
          meta.avatar_url ||
          meta.picture ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

        // Sync user to Supabase DB
        fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            avatar,
            phone: session.user.phone || meta.phone || '',
          }),
        }).finally(() => {
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', user: { email, name, avatar } }, '*');
            setTimeout(() => window.close(), 300);
          } else {
            window.location.href = '/orders';
          }
        });
      } else {
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_DONE' }, '*');
          window.close();
        } else {
          window.location.href = '/orders';
        }
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0c0a0f] p-4 text-center">
      <div className="space-y-4">
        <div className="w-10 h-10 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
          جاري إتمام تسجيل الدخول عبر Google...
        </p>
      </div>
    </div>
  );
}
