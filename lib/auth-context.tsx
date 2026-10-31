'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';
import { getSupabase } from './supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updatedFields: Partial<User>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateUser: async () => false,
  refreshProfile: async () => {},
});

const SESSION_KEY = 'shein_user_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. First restore from local storage for instant UI responsiveness
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.email && parsed?.role) {
          setUser(parsed);

          // Synchronize secure HTTP-only session cookie with server
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: parsed.id, email: parsed.email }),
          }).catch(() => {});

          // Asynchronously hydrate fresh profile data from DB (address, phone, city)
          fetch(
            `/api/users/profile?userId=${encodeURIComponent(parsed.id)}&email=${encodeURIComponent(
              parsed.email
            )}`
          )
            .then((res) => res.json())
            .then((json) => {
              if (json.success && json.data) {
                const merged = { ...parsed, ...json.data };
                setUser(merged);
                localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
              }
            })
            .catch(() => {});
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }

    // 2. Sync with Supabase Auth (for official Google OAuth redirects)
    const sb = getSupabase();
    if (sb) {
      const handleSupabaseSession = (sessionUser: any) => {
        if (!sessionUser) return;
        const meta = sessionUser.user_metadata || {};
        const email = sessionUser.email || '';
        const detectedName = meta.full_name || meta.name || email.split('@')[0] || 'Customer';
        const detectedAvatar = meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(detectedName)}`;

        // Verify or create via our Google login endpoint to ensure DB sync & session token
        fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: detectedName,
            avatar: detectedAvatar,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.data) {
              login(data.data);
            }
          })
          .catch((err) => console.error('Supabase auto-sync failed:', err));
      };

      // Check existing session
      sb.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          handleSupabaseSession(session.user);
        }
      });

      // Listen for OAuth redirects & state changes
      const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          handleSupabaseSession(session.user);
        }
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    }
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/users/profile?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(
          user.email
        )}&_t=${Date.now()}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const merged = { ...user, ...json.data };
        setUser(merged);
        localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
      }
    } catch (err) {
      console.warn('Failed to refresh profile:', err);
    }
  };

  const login = (newUser: User) => {
    setUser(newUser);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    } catch (err) {
      console.warn('Could not save user session to localStorage:', err);
    }

    // Ensure session cookie is refreshed
    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newUser.id, email: newUser.email }),
    }).catch(() => {});

    // Trigger immediate background sync of extended address details
    fetch(
      `/api/users/profile?userId=${encodeURIComponent(newUser.id)}&email=${encodeURIComponent(
        newUser.email
      )}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const merged = { ...newUser, ...json.data };
          setUser(merged);
          localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => {});
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.clear();
    } catch {}
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    const sb = getSupabase();
    if (sb) {
      sb.auth.signOut().catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const updateUser = async (updatedFields: Partial<User>): Promise<boolean> => {
    if (!user) return false;
    const merged: User = { ...user, ...updatedFields };
    setUser(merged);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    } catch {}

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          ...updatedFields,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const finalUser = { ...merged, ...data.data };
        setUser(finalUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(finalUser));
        return true;
      }
      return res.ok;
    } catch (err) {
      console.warn('Failed to sync profile update to server:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
