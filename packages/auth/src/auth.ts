import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';

import type { AvatarConfig } from '@flipfeeds/shared';

/**
 * Creates a better-auth instance configured for Cloudflare D1.
 *
 * Call this in your Cloudflare Worker/vinext server with the D1 binding:
 * ```ts
 * const auth = createAuth(env.DB, env);
 * ```
 *
 * Uses better-auth v1.5+ native D1 support — no ORM needed.
 * D1 binding is auto-detected as SQLite.
 */
export function createAuth(d1: D1Database, env?: Record<string, string | undefined>) {
  return betterAuth({
    database: d1, // Native D1 support — auto-detected, no ORM needed
    secret: env?.BETTER_AUTH_SECRET, // Required: set via wrangler secret put BETTER_AUTH_SECRET

    plugins: [bearer()], // Enables Authorization: Bearer <token> for server-to-server auth (PartyKit)

    emailAndPassword: {
      enabled: false, // OAuth only — no password hashing (safe on CF free tier)
    },

    socialProviders: {
      google: {
        clientId: env?.GOOGLE_CLIENT_ID || '',
        clientSecret: env?.GOOGLE_CLIENT_SECRET || '',
      },
      github: {
        clientId: env?.GITHUB_CLIENT_ID || '',
        clientSecret: env?.GITHUB_CLIENT_SECRET || '',
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
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 min cache — reduces D1 queries on every request
        strategy: 'jwt', // Standard, interoperable — good for PartyKit token validation
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
