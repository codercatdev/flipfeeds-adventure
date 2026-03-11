# Deploying to Cloudflare

This project runs the **web UI** on Cloudflare Workers (via vinext + Wrangler) and the **multiplayer server** on PartyKit (Cloudflare Workers / Durable Objects).

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (installed as dev dependency)
- For PartyKit: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (for deploy to your own account; optional if using PartyKit’s managed platform)

## 1. Deploy the web UI (Workers)

From the repo root:

```bash
pnpm --filter @flipfeeds/web-ui deploy
```

Or from `packages/web-ui`:

```bash
pnpm build && wrangler deploy --config dist/server/wrangler.json
```

- First run: `wrangler login` if not already logged in.
- The app will be available at `https://flipfeeds-web.<your-subdomain>.workers.dev` (or your custom domain if configured in the dashboard).

### Environment: PartyKit host

The client connects to the PartyKit server using a host set at **build time**. If you see `WebSocket connection to 'ws://localhost:1999/...' failed` on the deployed site, the UI was built without the production host. For production, set:

```bash
VITE_PARTYKIT_HOST=flipfeeds-multiplayer.<your-partykit-host>
```

Then build and deploy:

```bash
cd packages/web-ui && VITE_PARTYKIT_HOST=flipfeeds-multiplayer.<your-partykit-host> pnpm build
# then deploy (e.g. wrangler deploy --config dist/server/wrangler.json)
```

- **PartyKit managed:** host is typically `flipfeeds-multiplayer.<github-username>.partykit.dev` (see PartyKit dashboard after first deploy).
- **PartyKit on your Cloudflare account (cloud-prem):** use the host you set with `--domain` when deploying PartyKit (e.g. `partykit.yourdomain.com`).

## 2. Deploy the PartyKit server (multiplayer)

From the repo root:

```bash
pnpm --filter @flipfeeds/multiplayer-server deploy
```

Or from `packages/multiplayer-server`:

```bash
partykit deploy
```

- **Managed PartyKit:** deploys to PartyKit’s platform; you’ll get a URL like `flipfeeds-multiplayer.<username>.partykit.dev`. Use that host (without `https://`) as `VITE_PARTYKIT_HOST` when building the web UI.
- **Your own Cloudflare account (cloud-prem):**

  ```bash
  CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> partykit deploy
  ```

  Optional custom domain:

  ```bash
  CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> partykit deploy --domain partykit.yourdomain.com
  ```

  Then use that host as `VITE_PARTYKIT_HOST` when building the web UI.

## 3. Deploy both (recommended order)

1. Deploy PartyKit first so you know the multiplayer host.
2. Set `VITE_PARTYKIT_HOST` and deploy the web UI.

Example (managed PartyKit):

```bash
# 1. Deploy multiplayer server
pnpm --filter @flipfeeds/multiplayer-server deploy

# 2. Set host (replace with your PartyKit host from the deploy output)
export VITE_PARTYKIT_HOST=flipfeeds-multiplayer.YOUR_GITHUB_USERNAME.partykit.dev

# 3. Build and deploy web UI
pnpm --filter @flipfeeds/web-ui build
pnpm --filter @flipfeeds/web-ui exec -- wrangler deploy --config dist/server/wrangler.json
```

Or use the root script (see below):

```bash
VITE_PARTYKIT_HOST=flipfeeds-multiplayer.YOUR_GITHUB_USERNAME.partykit.dev pnpm deploy:all
```

## Root package.json scripts

- `deploy:web` — build and deploy the web UI (set `VITE_PARTYKIT_HOST` first for production).
- `deploy:party` — deploy the PartyKit multiplayer server.
- `deploy:all` — deploy PartyKit then web UI (requires `VITE_PARTYKIT_HOST` set for production).
