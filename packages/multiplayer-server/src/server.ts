import type * as Party from "partykit/server";
import type {
  PlayerState,
  PlayerDelta,
  ClientMessage,
  ServerWelcomeMessage,
  ServerSyncMessage,
  ServerPlayerJoinMessage,
  ServerPlayerLeaveMessage,
  ServerChatMessage,
  ServerPongMessage,
} from "@flipfeeds/shared";

/** Maximum player speed in pixels per second */
const MAX_SPEED = 168;

/** Tolerance multiplier for move validation (accounts for network jitter) */
const SPEED_TOLERANCE = 1.5;

/** Map bounds in pixels (80×60 tiles × 16px) */
const MAP_WIDTH = 1920;
const MAP_HEIGHT = 1440;

/** Player sprite half-size for boundary clamping */
const PLAYER_HALF = 12;

/** Disconnect grace period in ms before removing player */
const DISCONNECT_TIMEOUT = 10_000;

export default class GameServer implements Party.Server {
  /** All connected players keyed by player ID */
  private players: Map<string, PlayerState> = new Map();

  /** Track last processed seq per connection for client-side prediction ack */
  private lastSeq: Map<string, number> = new Map();

  /** Track last move timestamp per player for speed validation */
  private lastMoveTime: Map<string, number> = new Map();

  /** Set of player IDs that have moved since the last tick broadcast */
  private dirtyPlayers = new Set<string>();

  /** Monotonically increasing tick counter */
  private tick: number = 0;

  /** Handle for the 20-Hz tick loop (50 ms interval) */
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  /** Disconnect timers — grace period before removing player */
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(readonly room: Party.Room) {}

  // ─── Connection lifecycle ───────────────────────────────────────────

  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    const playerId = conn.id;

    // Check for reconnection — cancel disconnect timer if exists
    const existingTimer = this.disconnectTimers.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(playerId);
    }

    // Check if player already exists (reconnection)
    let player = this.players.get(playerId);
    const isReconnect = !!player;

    if (!player) {
      // New player — spawn in Main Lobby center tile (40, 42) = (960, 1008)px
      player = {
        id: playerId,
        x: 960 + (Math.random() * 96 - 48),
        y: 1008 + (Math.random() * 96 - 48),
        dir: "idle",
        anim: "idle",
      };
      this.players.set(playerId, player);
    }

    this.lastSeq.set(playerId, 0);
    this.lastMoveTime.set(playerId, Date.now());

    // Send the newcomer a welcome with the full world state
    const welcome: ServerWelcomeMessage = {
      type: "welcome",
      id: playerId,
      players: Array.from(this.players.values()),
      tick: this.tick,
    };
    conn.send(JSON.stringify(welcome));

    // Tell everyone else about the player (join or rejoin)
    if (!isReconnect) {
      const joinMsg: ServerPlayerJoinMessage = {
        type: "player-join",
        player,
      };
      this.room.broadcast(JSON.stringify(joinMsg), [conn.id]);
    }

    // Start the tick loop when the first player arrives
    if (this.players.size === 1 && this.tickInterval === null) {
      this.startTickLoop();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message as string) as ClientMessage;
    } catch {
      return; // ignore malformed messages
    }

    switch (parsed.type) {
      // ── Ping / Pong (latency probe) ──────────────────────────────
      case "ping": {
        const pong: ServerPongMessage = { type: "pong", t: parsed.t };
        sender.send(JSON.stringify(pong));
        break;
      }

      // ── Movement (with server-side validation) ───────────────────
      case "move": {
        const player = this.players.get(sender.id);
        if (!player) break;

        const now = Date.now();
        const lastTime = this.lastMoveTime.get(sender.id) ?? now;
        const dt = Math.max(now - lastTime, 1) / 1000; // seconds elapsed

        // Validate move distance
        let newX = parsed.x;
        let newY = parsed.y;

        const dx = newX - player.x;
        const dy = newY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = MAX_SPEED * dt * SPEED_TOLERANCE;

        if (distance > maxDistance) {
          // Clamp to max allowed distance along movement vector
          const scale = maxDistance / distance;
          newX = player.x + dx * scale;
          newY = player.y + dy * scale;
        }

        // Clamp to map bounds
        newX = Math.max(PLAYER_HALF, Math.min(MAP_WIDTH - PLAYER_HALF, newX));
        newY = Math.max(PLAYER_HALF, Math.min(MAP_HEIGHT - PLAYER_HALF, newY));

        player.x = newX;
        player.y = newY;
        player.dir = parsed.dir;
        if (parsed.anim !== undefined) {
          player.anim = parsed.anim;
        }

        this.lastMoveTime.set(sender.id, now);
        this.lastSeq.set(sender.id, parsed.seq);
        this.dirtyPlayers.add(sender.id);
        break;
      }

      // ── Chat ─────────────────────────────────────────────────────
      case "chat": {
        const chatMsg: ServerChatMessage = {
          type: "chat",
          id: sender.id,
          text: parsed.text,
        };
        this.room.broadcast(JSON.stringify(chatMsg));
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    const playerId = conn.id;

    // Start disconnect grace period instead of immediate removal
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId);
      this.players.delete(playerId);
      this.dirtyPlayers.delete(playerId);
      this.lastSeq.delete(playerId);
      this.lastMoveTime.delete(playerId);

      // Notify remaining players
      const leaveMsg: ServerPlayerLeaveMessage = {
        type: "player-leave",
        id: playerId,
      };
      this.room.broadcast(JSON.stringify(leaveMsg));

      // Tear down the tick loop when the room is empty
      if (this.players.size === 0 && this.tickInterval !== null) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
    }, DISCONNECT_TIMEOUT);

    this.disconnectTimers.set(playerId, timer);
  }

  // ─── Tick loop ──────────────────────────────────────────────────────

  private startTickLoop() {
    if (this.tickInterval !== null) return;

    this.tickInterval = setInterval(() => {
      this.broadcastSync();
      this.tick++;
    }, 50); // 20 ticks per second
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

    // Per-client sync messages with embedded ack for prediction reconciliation
    for (const conn of this.room.getConnections()) {
      const ack = this.lastSeq.get(conn.id);
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
