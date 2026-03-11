import { createAuth } from '@flipfeeds/auth';

let auth: ReturnType<typeof createAuth> | null = null;

function getAuth() {
  if (auth) return auth;
  try {
    const { env } = require('cloudflare:workers');
    auth = createAuth(env.DB, env);
    return auth;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const a = getAuth();
  if (!a) return new Response('Auth not configured — D1 binding not available', { status: 503 });
  return a.handler(request);
}

export async function POST(request: Request) {
  const a = getAuth();
  if (!a) return new Response('Auth not configured — D1 binding not available', { status: 503 });
  return a.handler(request);
}
