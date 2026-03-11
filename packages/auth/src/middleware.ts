import type { Auth } from './auth';

/**
 * Extracts the session from an incoming request using better-auth.
 * Use in vinext server components or API routes:
 *
 * ```ts
 * const session = await getSession(auth, request);
 * if (!session) redirect('/login');
 * ```
 */
export async function getSession(auth: Auth, request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session;
}

/**
 * Validates a session token (for PartyKit WebSocket auth).
 * The client sends the session token as a query param when connecting.
 *
 * ```ts
 * // In PartyKit server onConnect:
 * const token = new URL(request.url).searchParams.get('token');
 * const session = await validateToken(auth, token);
 * ```
 */
export async function validateToken(auth: Auth, token: string | null) {
  if (!token) return null;

  const session = await auth.api.getSession({
    headers: new Headers({
      Authorization: `Bearer ${token}`,
    }),
  });

  return session;
}
