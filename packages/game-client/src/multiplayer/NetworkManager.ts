import eventBus from '../EventBus';
import type { Direction } from '@flipfeeds/shared';
import { SpritePool } from './SpritePool';
import { InterpolationManager } from './InterpolationManager';
import { PredictionManager } from './PredictionManager';

export class NetworkManager {
  private pool: SpritePool;
  private interpolation: InterpolationManager;
  private prediction: PredictionManager;

  private localPlayerId: string | null = null;
  private lastServerTime: number | null = null;
  private lastSyncTime = 0;

  // RTT tracking (from ping/pong)
  private lastRTT = 0;

  constructor(scene: Phaser.Scene) {
    this.pool = new SpritePool(scene);
    this.interpolation = new InterpolationManager();
    this.prediction = new PredictionManager();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Server → Client events (from useWebSocket hook via EventBus)
    eventBus.on('ROOM_STATE', this.onRoomState);
    eventBus.on('PLAYER_JOINED', this.onPlayerJoined);
    eventBus.on('PLAYER_LEFT', this.onPlayerLeft);
    eventBus.on('PLAYER_MOVED', this.onPlayerMoved);
  }

  /** When game becomes ready, we get the current room so we can show players already in the room. */
  private onRoomState = (data: {
    id: string;
    players: Array<{ id: string; x: number; y: number; direction: Direction; name?: string; anim?: string }>;
  }): void => {
    this.setLocalPlayerId(data.id);
    this.bootstrapPlayers(
      data.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        dir: p.direction,
        name: p.name,
        anim: p.anim,
      })),
    );
    console.log(`[NetworkManager] Room state: ${data.players.length} player(s) already in room`);
  };

  /** Called when we receive our player ID from the welcome message. */
  setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }

  /** Initialize prediction with the local player's starting position. */
  initPrediction(x: number, y: number): void {
    this.prediction.init(x, y);
  }

  /** Record a local movement input. Returns seq for the server message. */
  recordLocalInput(
    x: number,
    y: number,
    dir: Direction,
    anim?: string,
  ): number {
    return this.prediction.recordInput(x, y, dir, anim);
  }

  /** Process a server sync message. */
  processSync(
    players: Array<{
      id: string;
      x?: number;
      y?: number;
      dir?: Direction;
      anim?: string;
    }>,
    tick: number,
    ack?: number,
    serverTime?: number,
  ): void {
    const now = performance.now();

    // Calculate server tick delta
    let serverTickDelta = 50; // default to expected 50ms
    if (serverTime !== undefined && this.lastServerTime !== null) {
      serverTickDelta = serverTime - this.lastServerTime;
    }
    if (serverTime !== undefined) {
      this.lastServerTime = serverTime;
    }
    this.lastSyncTime = now;

    // Process each player delta
    for (const delta of players) {
      if (delta.id === this.localPlayerId) {
        // Local player — reconcile prediction
        if (
          ack !== undefined &&
          delta.x !== undefined &&
          delta.y !== undefined
        ) {
          this.prediction.reconcile(delta.x, delta.y, ack);
        }
      } else {
        // Remote player — feed into interpolation
        if (delta.x !== undefined && delta.y !== undefined) {
          this.interpolation.addSnapshot(
            delta.id,
            delta.x,
            delta.y,
            delta.dir ?? 'idle',
            delta.anim,
            serverTime,
          );
        }
      }
    }

    // Emit sync telemetry
    eventBus.emit('TELEMETRY:SYNC', {
      serverTickDelta,
      interpolationOffset: this.interpolation.getInterpolationOffset(),
      predictionError: this.prediction.predictionError,
      roundTripTime: this.lastRTT,
    });
  }

  /** Update RTT from ping/pong measurement. */
  updateRTT(rtt: number): void {
    this.lastRTT = rtt;
  }

  /** Update all remote player positions (call every frame). */
  updateRemotePlayers(): void {
    const positions = this.interpolation.update();

    for (const [playerId, pos] of positions) {
      this.pool.updatePosition(playerId, pos.x, pos.y);
    }
  }

  /** Bootstrap all players from a welcome message. */
  bootstrapPlayers(
    players: Array<{
      id: string;
      x: number;
      y: number;
      dir: Direction;
      name?: string;
      anim?: string;
    }>,
  ): void {
    for (const p of players) {
      if (p.id === this.localPlayerId) continue; // Skip local player
      this.pool.acquire(p.id, p.x, p.y, p.name);
      this.interpolation.initPlayer(p.id, p.x, p.y, p.dir, p.anim);
    }
  }

  private onPlayerJoined = (data: {
    id: string;
    x: number;
    y: number;
    direction: Direction;
    name: string;
  }): void => {
    if (data.id === this.localPlayerId) return;
    this.pool.acquire(data.id, data.x, data.y, data.name);
    this.interpolation.initPlayer(
      data.id,
      data.x,
      data.y,
      data.direction,
    );
    console.log(`[NetworkManager] Player joined: ${data.id}`);
  };

  private onPlayerLeft = (data: { id: string }): void => {
    this.pool.release(data.id);
    this.interpolation.removePlayer(data.id);
    console.log(`[NetworkManager] Player left: ${data.id}`);
  };

  private onPlayerMoved = (data: {
    id: string;
    x: number;
    y: number;
    direction: Direction;
    anim?: string;
  }): void => {
    if (data.id === this.localPlayerId) return;
    this.interpolation.addSnapshot(
      data.id,
      data.x,
      data.y,
      data.direction,
      data.anim,
    );
  };

  /** Get pool stats for telemetry. */
  getPoolStats() {
    return this.pool.getStats();
  }

  /** Clean up everything. */
  destroy(): void {
    eventBus.off('ROOM_STATE', this.onRoomState);
    eventBus.off('PLAYER_JOINED', this.onPlayerJoined);
    eventBus.off('PLAYER_LEFT', this.onPlayerLeft);
    eventBus.off('PLAYER_MOVED', this.onPlayerMoved);
    this.pool.destroy();
    this.interpolation.destroy();
    this.prediction.destroy();
  }
}
