import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

import type { AvatarConfig } from './types';

/**
 * Creates a better-auth instance configured for Cloudflare D1.
 *
 * Call this in your Cloudflare Worker/vinext server with the D1 binding:
 * ```ts
 * const auth = createAuth(env.DB, env);
 * ```
 *
 * Note: better-auth uses Kysely + kysely-d1 under the hood for D1 support.
 * The D1Dialect wraps Cloudflare's D1 binding into a Kysely-compatible dialect.
 */
export function createAuth(d1: D1Database, env?: Record<string, string | undefined>) {
  const db = new Kysely({
    dialect: new D1Dialect({ database: d1 }),
  });

  return betterAuth({
    database: {
      db,
      type: 'sqlite', // D1 is SQLite-based
    },

    emailAndPassword: {
      enabled: false, // OAuth only for now
    },

    socialProviders: {
      google: {
        clientId: env?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: env?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
      },
      github: {
        clientId: env?.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '',
        clientSecret: env?.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '',
      },
    },

    user: {
      additionalFields: {
        avatarConfig: {
          type: 'string',
          defaultValue: JSON.stringify({ characterType: 0, colorVariant: 0 } satisfies AvatarConfig),
          input: true,
        },
        signalStrength: {
          type: 'number',
          defaultValue: 0,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
