import { createAuth } from '@flipfeeds/auth';

let auth: ReturnType<typeof createAuth> | null = null;

async function getAuth(): Promise<ReturnType<typeof createAuth> | null> {
  if (auth) return auth;
  try {
    const { env } = await import('cloudflare:workers');
    if (!env?.flipfeeds_db) return null;
    auth = createAuth(env.flipfeeds_db, env as Record<string, string | undefined>);
    return auth;
  } catch (e) {
    console.error('[auth] getAuth failed:', e);
    return null;
  }
}

async function handleAuthRequest(
  request: Request,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  try {
    return await handler(request);
  } catch (e) {
    console.error('[auth] handler error:', e);
    const body = process.env.NODE_ENV !== 'production'
      ? JSON.stringify({ error: String(e), stack: (e as Error)?.stack })
      : 'Internal Server Error';
    return new Response(body, {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: Request) {
  const a = await getAuth();
  if (!a) return new Response('Auth not configured — D1 binding not available', { status: 503 });
  return handleAuthRequest(request, (req) => a.handler(req));
}

export async function POST(request: Request) {
  const a = await getAuth();
  if (!a) return new Response('Auth not configured — D1 binding not available', { status: 503 });
  return handleAuthRequest(request, (req) => a.handler(req));
}
