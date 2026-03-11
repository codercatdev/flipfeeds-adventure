import type * as Party from "partykit/server";
import type {
  PlayerState,
  PlayerDelta,
  ClientMessage,
  AvatarConfig,
  ServerWelcomeMessage,
  ServerSyncMessage,
  ServerPlayerJoinMessage,
  ServerPlayerLeaveMessage,
  ServerChatMessage,
  ServerPongMessage,
} from "@flipfeeds/shared";
import { DEFAULT_AVATAR } from "@flipfeeds/shared";

const MAX_SPEED = 168;
const SPEED_TOLERANCE = 1.5;
const MAP_WIDTH = 1920;
const MAP_HEIGHT = 1440;
const PLAYER_HALF = 12;
const DISCONNECT_TIMEOUT = 10_000;

export default class GameServer implements Party.Server {
  private players: Map<string, PlayerState> = new Map();
  private lastSeq: Map<string, number> = new Map();
  private lastMoveTime: Map<string, number> = new Map();
  private dirtyPlayers = new Set<string>();
  private tick: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  /** Maps connection ID → authenticated user ID */
  private connToUser: Map<string, string> = new Map();
  /** Maps user ID → display name (for chat) */
  private playerNames: Map<string, string> = new Map();

  constructor(readonly room: Party.Room) {}

  // ------------------------------------------------------------------ //
  //  Auth gate – runs at the edge BEFORE the WebSocket is established   //
  // ------------------------------------------------------------------ //
  static async onBeforeConnect(req: Party.Request, lobby: Party.Lobby) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const nameParam = url.searchParams.get("name") || "Anonymous";

    console.log("[Auth] onBeforeConnect called, token:", token ? `${token.slice(0, 8)}...` : "NONE", "name:", nameParam);

    // No token = reject. Game requires authentication.
    if (!token) {
      console.log("[Auth] No token — rejecting with 401");
      return new Response("Authentication required", { status: 401 });
    }

    const authUrl =
      (lobby.env.BETTER_AUTH_URL as string) || "https://app.flipfeeds.com";

    try {
      // better-auth session endpoint is /get-session (NOT /session)
      const fetchUrl = `${authUrl}/api/auth/get-session`;
      console.log("[Auth] Fetching session from:", fetchUrl);

      const res = await fetch(fetchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[Auth] Response status:", res.status);

      if (!res.ok) {
        console.log("[Auth] Non-OK response — falling back to name param");
        req.headers.set("x-user-id", "");
        req.headers.set("x-user-name", nameParam);
        req.headers.set("x-user-avatar", JSON.stringify(DEFAULT_AVATAR));
        return req;
      }

      const rawBody = await res.text();
      console.log("[Auth] Raw response body:", rawBody.slice(0, 500));

      let session: {
        user?: {
          id?: string;
          name?: string;
          avatarConfig?: string | AvatarConfig;
        };
      } | null;

      try {
        session = JSON.parse(rawBody);
      } catch {
        console.log("[Auth] Failed to parse JSON — falling back");
        req.headers.set("x-user-id", "");
        req.headers.set("x-user-name", nameParam);
        req.headers.set("x-user-avatar", JSON.stringify(DEFAULT_AVATAR));
        return req;
      }

      console.log("[Auth] Parsed session user:", JSON.stringify(session?.user ? { id: session.user.id, name: session.user.name, avatarConfig: session.user.avatarConfig } : null));

      if (!session?.user?.id) {
        console.log("[Auth] No user ID in session — falling back");
        req.headers.set("x-user-id", "");
        req.headers.set("x-user-name", nameParam);
        req.headers.set("x-user-avatar", JSON.stringify(DEFAULT_AVATAR));
        return req;
      }

      const user = session.user;

      // Parse avatarConfig — may be a JSON string from better-auth additionalFields
      let avatarConfig: AvatarConfig = DEFAULT_AVATAR;
      if (user.avatarConfig) {
        if (typeof user.avatarConfig === "string") {
          try {
            avatarConfig = JSON.parse(user.avatarConfig);
          } catch {
            avatarConfig = DEFAULT_AVATAR;
          }
        } else {
          avatarConfig = user.avatarConfig;
        }
      }

      console.log("[Auth] ✅ Authenticated:", user.name, "id:", user.id, "avatar:", JSON.stringify(avatarConfig));

      // Forward authenticated identity to onConnect via request headers
      req.headers.set("x-user-id", user.id);
      req.headers.set("x-user-name", user.name || nameParam);
      req.headers.set("x-user-avatar", JSON.stringify(avatarConfig));

      return req;
    } catch (err) {
      console.log("[Auth] Fetch error:", String(err));
      // Auth service unreachable — allow with fallback
      req.headers.set("x-user-id", "");
      req.headers.set("x-user-name", nameParam);
      req.headers.set("x-user-avatar", JSON.stringify(DEFAULT_AVATAR));
      return req;
    }
  }

  // ------------------------------------------------------------------ //
  //  Connection lifecycle                                               //
  // ------------------------------------------------------------------ //
  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    // Read identity injected by onBeforeConnect
    const headerUserId = _ctx.request.headers.get("x-user-id");
    const userId = headerUserId && headerUserId.length > 0 ? headerUserId : conn.id;
    const userName =
      _ctx.request.headers.get("x-user-name") || "Anonymous";
    const avatarJson = _ctx.request.headers.get("x-user-avatar");

    let avatarConfig: AvatarConfig;
    try {
      avatarConfig = avatarJson ? JSON.parse(avatarJson) : DEFAULT_AVATAR;
    } catch {
      avatarConfig = DEFAULT_AVATAR;
    }

    console.log("[Connect] Player connected:", userName, "userId:", userId, "connId:", conn.id, "avatar:", JSON.stringify(avatarConfig));

    // Map this connection to the authenticated user
    this.connToUser.set(conn.id, userId);
    this.playerNames.set(userId, userName);

    // Cancel any pending disconnect timer for this user
    const existingTimer = this.disconnectTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(userId);
      console.log("[Connect] Cancelled disconnect timer for", userId, "(reconnect)");
    }

    let player = this.players.get(userId);
    const isReconnect = !!player;

    if (!player) {
      player = {
        id: userId,
        x: 960 + (Math.random() * 96 - 48),
        y: 1008 + (Math.random() * 96 - 48),
        dir: "idle",
        anim: "idle",
        name: userName,
        avatarConfig,
      };
      this.players.set(userId, player);
    } else {
      // Update name/avatar on reconnect in case they changed
      player.name = userName;
      player.avatarConfig = avatarConfig;
    }

    this.lastSeq.set(userId, 0);
    this.lastMoveTime.set(userId, Date.now());

    console.log("[Connect] Total players:", this.players.size, "isReconnect:", isReconnect);

    // Send welcome with full player list (includes names + avatarConfigs)
    const welcome: ServerWelcomeMessage = {
      type: "welcome",
      id: userId,
      players: Array.from(this.players.values()),
      tick: this.tick,
    };
    conn.send(JSON.stringify(welcome));

    if (!isReconnect) {
      const joinMsg: ServerPlayerJoinMessage = {
        type: "player-join",
        player,
      };
      this.room.broadcast(JSON.stringify(joinMsg), [conn.id]);
    }

    if (this.players.size === 1 && this.tickInterval === null) {
      this.startTickLoop();
    }
  }

  // ------------------------------------------------------------------ //
  //  Message handling                                                   //
  // ------------------------------------------------------------------ //
  onMessage(message: string, sender: Party.Connection) {
    const userId = this.connToUser.get(sender.id);
    if (!userId) return;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message as string) as ClientMessage;
    } catch {
      return;
    }

    switch (parsed.type) {
      case "ping": {
        const pong: ServerPongMessage = { type: "pong", t: parsed.t };
        sender.send(JSON.stringify(pong));
        break;
      }

      case "move": {
        const player = this.players.get(userId);
        if (!player) break;

        const now = Date.now();
        const lastTime = this.lastMoveTime.get(userId) ?? now;
        const dt = Math.max(now - lastTime, 1) / 1000;

        let newX = parsed.x;
        let newY = parsed.y;

        const dx = newX - player.x;
        const dy = newY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = MAX_SPEED * dt * SPEED_TOLERANCE;

        if (distance > maxDistance) {
          const scale = maxDistance / distance;
          newX = player.x + dx * scale;
          newY = player.y + dy * scale;
        }

        newX = Math.max(PLAYER_HALF, Math.min(MAP_WIDTH - PLAYER_HALF, newX));
        newY = Math.max(PLAYER_HALF, Math.min(MAP_HEIGHT - PLAYER_HALF, newY));

        player.x = newX;
        player.y = newY;
        player.dir = parsed.dir;
        if (parsed.anim !== undefined) {
          player.anim = parsed.anim;
        }

        this.lastMoveTime.set(userId, now);
        this.lastSeq.set(userId, parsed.seq);
        this.dirtyPlayers.add(userId);
        break;
      }

      case "chat": {
        const name = this.playerNames.get(userId);
        const chatMsg: ServerChatMessage = {
          type: "chat",
          id: userId,
          text: parsed.text,
          name,
        };
        // Exclude sender to prevent duplicate messages on the client
        this.room.broadcast(JSON.stringify(chatMsg), [sender.id]);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ //
  //  Disconnect with grace period                                       //
  // ------------------------------------------------------------------ //
  onClose(conn: Party.Connection) {
    const userId = this.connToUser.get(conn.id);
    if (!userId) return;

    console.log("[Disconnect] Player disconnected:", userId, "connId:", conn.id, "— starting", DISCONNECT_TIMEOUT / 1000, "s grace period");

    // Clean up the connection mapping immediately
    this.connToUser.delete(conn.id);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      this.players.delete(userId);
      this.dirtyPlayers.delete(userId);
      this.lastSeq.delete(userId);
      this.lastMoveTime.delete(userId);
      this.playerNames.delete(userId);

      console.log("[Disconnect] Grace period expired — removed player:", userId, "remaining:", this.players.size);

      const leaveMsg: ServerPlayerLeaveMessage = {
        type: "player-leave",
        id: userId,
      };
      this.room.broadcast(JSON.stringify(leaveMsg));

      if (this.players.size === 0 && this.tickInterval !== null) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
        console.log("[Disconnect] Room empty — tick loop stopped");
      }
    }, DISCONNECT_TIMEOUT);

    this.disconnectTimers.set(userId, timer);
  }

  // ------------------------------------------------------------------ //
  //  Tick loop – 20 Hz delta sync                                       //
  // ------------------------------------------------------------------ //
  private startTickLoop() {
    if (this.tickInterval !== null) return;

    this.tickInterval = setInterval(() => {
      this.broadcastSync();
      this.tick++;
    }, 50);
  }

  private broadcastSync() {
    const hasConnections = [...this.room.getConnections()].length > 0;
    if (!hasConnections) return;

    const deltas: PlayerDelta[] = [];

    for (const id of this.dirtyPlayers) {
      const player = this.players.get(id);
      if (!player) continue;

      deltas.push({
        id: player.id,
        x: player.x,
        y: player.y,
        dir: player.dir,
        anim: player.anim,
      });
    }

    const serverTime = Date.now();

    for (const conn of this.room.getConnections()) {
      const userId = this.connToUser.get(conn.id);
      const ack = userId ? this.lastSeq.get(userId) : undefined;
      const syncMsg: ServerSyncMessage = {
        type: "sync",
        players: deltas,
        tick: this.tick,
        serverTime,
        ...(ack !== undefined && ack > 0 ? { ack } : {}),
      };
      conn.send(JSON.stringify(syncMsg));
    }

    this.dirtyPlayers.clear();
  }
}
