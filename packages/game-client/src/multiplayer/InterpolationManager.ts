import type { Direction } from '@flipfeeds/shared';

interface PlayerSnapshot {
  x: number;
  y: number;
  dir: Direction;
  anim?: string;
  timestamp: number; // client-side receive time
  serverTime?: number;
}

interface InterpolationState {
  snapshots: PlayerSnapshot[];
  currentX: number;
  currentY: number;
  currentDir: Direction;
  currentAnim?: string;
}

export class InterpolationManager {
  private players: Map<string, InterpolationState> = new Map();

  // Interpolation delay — render one tick behind for smooth lerp
  private readonly INTERP_DELAY_MS = 100; // 2 ticks at 20Hz
  private readonly MAX_SNAPSHOTS = 10;
  private readonly SNAP_THRESHOLD = 200; // px — if too far, snap instead of lerp

  /** Add a new snapshot for a remote player from a server sync. */
  addSnapshot(
    playerId: string,
    x: number,
    y: number,
    dir: Direction,
    anim?: string,
    serverTime?: number,
  ): void {
    let state = this.players.get(playerId);
    if (!state) {
      state = {
        snapshots: [],
        currentX: x,
        currentY: y,
        currentDir: dir,
        currentAnim: anim,
      };
      this.players.set(playerId, state);
    }

    state.snapshots.push({
      x,
      y,
      dir,
      anim,
      timestamp: performance.now(),
      serverTime,
    });

    // Keep only recent snapshots
    if (state.snapshots.length > this.MAX_SNAPSHOTS) {
      state.snapshots.shift();
    }
  }

  /** Initialize a player at a known position (from welcome or player-join). */
  initPlayer(
    playerId: string,
    x: number,
    y: number,
    dir: Direction,
    anim?: string,
  ): void {
    this.players.set(playerId, {
      snapshots: [
        {
          x,
          y,
          dir,
          anim,
          timestamp: performance.now(),
        },
      ],
      currentX: x,
      currentY: y,
      currentDir: dir,
      currentAnim: anim,
    });
  }

  /** Remove a player from interpolation tracking. */
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  /** Update interpolation for all players. Call every frame. Returns updated positions. */
  update(): Map<
    string,
    { x: number; y: number; dir: Direction; anim?: string }
  > {
    const results = new Map<
      string,
      { x: number; y: number; dir: Direction; anim?: string }
    >();
    const renderTime = performance.now() - this.INTERP_DELAY_MS;

    for (const [playerId, state] of this.players) {
      const { snapshots } = state;

      if (snapshots.length === 0) continue;

      // Find the two snapshots to interpolate between
      let from: PlayerSnapshot | null = null;
      let to: PlayerSnapshot | null = null;

      for (let i = 0; i < snapshots.length - 1; i++) {
        if (
          snapshots[i].timestamp <= renderTime &&
          snapshots[i + 1].timestamp >= renderTime
        ) {
          from = snapshots[i];
          to = snapshots[i + 1];
          break;
        }
      }

      if (from && to) {
        // Interpolate between the two snapshots
        const total = to.timestamp - from.timestamp;
        const elapsed = renderTime - from.timestamp;
        const t = total > 0 ? Math.min(1, elapsed / total) : 1;

        state.currentX = from.x + (to.x - from.x) * t;
        state.currentY = from.y + (to.y - from.y) * t;
        state.currentDir = t > 0.5 ? to.dir : from.dir;
        state.currentAnim = t > 0.5 ? to.anim : from.anim;
      } else if (snapshots.length > 0) {
        // No interpolation pair — use latest snapshot
        const latest = snapshots[snapshots.length - 1];

        // Check if we should snap or extrapolate
        const dx = latest.x - state.currentX;
        const dy = latest.y - state.currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.SNAP_THRESHOLD) {
          // Too far — snap to position
          state.currentX = latest.x;
          state.currentY = latest.y;
        } else {
          // Gentle lerp toward latest known position
          state.currentX += dx * 0.15;
          state.currentY += dy * 0.15;
        }
        state.currentDir = latest.dir;
        state.currentAnim = latest.anim;
      }

      results.set(playerId, {
        x: state.currentX,
        y: state.currentY,
        dir: state.currentDir,
        anim: state.currentAnim,
      });
    }

    return results;
  }

  /** Get the interpolation offset (how far behind server time we're rendering). */
  getInterpolationOffset(): number {
    return this.INTERP_DELAY_MS;
  }

  /** Get the number of tracked players. */
  get playerCount(): number {
    return this.players.size;
  }

  /** Clean up all state. */
  destroy(): void {
    this.players.clear();
  }
}
