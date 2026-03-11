export { createAuth } from './auth';
export type { Auth } from './auth';
export type { AuthUser } from './types';
export { getSession, validateToken } from './middleware';

// Re-export AvatarConfig from shared (canonical source)
export type { AvatarConfig } from '@flipfeeds/shared';
