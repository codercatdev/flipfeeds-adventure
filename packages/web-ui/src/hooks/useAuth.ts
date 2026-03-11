'use client';

import { createAuthClient } from 'better-auth/react';
import { useMemo, useCallback } from 'react';

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

const authClient = createAuthClient({
  baseURL: '/api/auth',
});

interface UseAuthReturn {
  session: AuthSession | null;
  isPending: boolean;
  isAuthenticated: boolean;
  hasAvatar: boolean;
  updateAvatar: (config: AvatarConfig) => Promise<void>;
  signIn: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { data: rawSession, isPending } = authClient.useSession();

  // Parse avatarConfig from JSON string to object
  const session = useMemo<AuthSession | null>(() => {
    if (!rawSession?.user) return null;

    let avatarConfig: AvatarConfig | null = null;
    if (rawSession.user.avatarConfig) {
      try {
        avatarConfig = JSON.parse(rawSession.user.avatarConfig as string);
      } catch {
        avatarConfig = null;
      }
    }

    return {
      user: {
        id: rawSession.user.id,
        name: rawSession.user.name || 'Player',
        email: rawSession.user.email || '',
        avatarConfig,
      },
    };
  }, [rawSession]);

  const updateAvatar = useCallback(async (config: AvatarConfig) => {
    await authClient.updateUser({
      avatarConfig: JSON.stringify(config),
    });
  }, []);

  const signIn = useCallback(async (provider: 'google' | 'github') => {
    await authClient.signIn.social({ provider });
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const hasAvatar = session?.user?.avatarConfig !== null && session?.user?.avatarConfig !== undefined;

  return {
    session,
    isPending,
    isAuthenticated: session !== null,
    hasAvatar,
    updateAvatar,
    signIn,
    signOut,
  };
}
