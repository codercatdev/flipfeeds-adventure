import type { AvatarConfig } from '@flipfeeds/shared';

export type { AvatarConfig };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  avatarConfig: AvatarConfig;
  signalStrength: number;
  createdAt: string;
  updatedAt: string;
}
