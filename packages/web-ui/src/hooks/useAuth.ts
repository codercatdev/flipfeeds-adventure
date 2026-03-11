'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AvatarConfig {
  characterType: number;
  colorVariant: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarConfig: AvatarConfig | null;
}

export interface AuthSession {
  user: AuthUser;
}

interface UseAuthReturn {
  session: AuthSession | null;
  isPending: boolean;
  isAuthenticated: boolean;
  hasAvatar: boolean;
  updateAvatar: (config: AvatarConfig) => Promise<void>;
}

/**
 * Mock auth hook — simulates better-auth useSession().
 * Uses localStorage to persist avatar selection.
 * Will be replaced with real auth client from @flipfeeds/auth.
 */
export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    // Simulate loading session from localStorage
    const stored = localStorage.getItem('flipfeeds-avatar');
    const avatarConfig = stored ? JSON.parse(stored) as AvatarConfig : null;

    // Mock user — in production this comes from better-auth OAuth
    setSession({
      user: {
        id: 'mock-user-' + Math.random().toString(36).slice(2, 8),
        name: 'Player',
        email: 'player@flipfeeds.dev',
        avatarConfig,
      },
    });
    setIsPending(false);
  }, []);

  const updateAvatar = useCallback(async (config: AvatarConfig) => {
    localStorage.setItem('flipfeeds-avatar', JSON.stringify(config));
    setSession(prev => prev ? {
      ...prev,
      user: { ...prev.user, avatarConfig: config },
    } : null);
  }, []);

  return {
    session,
    isPending,
    isAuthenticated: session !== null,
    hasAvatar: session?.user?.avatarConfig !== null && session?.user?.avatarConfig !== undefined,
    updateAvatar,
  };
}
