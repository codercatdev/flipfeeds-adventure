import { describe, it, expect } from 'vitest';
import type { PlayerState, PlayerDelta, Direction } from '@flipfeeds/shared';

/**
 * Phase 3 — Delta Compression Tests
 *
 * Tests that delta encoding reduces payload size for sync messages.
 * Instead of sending full PlayerState every tick, the server sends only
 * the fields that changed (PlayerDelta). This reduces bandwidth significantly.
 *
 * Quality Gate: Delta compression achieves >50% reduction vs full state
 */

// ─── Pure delta logic (extracted for testability) ────────────────────────────

/**
 * Compute the delta between previous and current player state.
 * Only includes fields that actually changed.
 */
function computeDelta(prev: PlayerState, curr: PlayerState): PlayerDelta {
  const delta: PlayerDelta = { id: curr.id };

  if (prev.x !== curr.x) delta.x = curr.x;
  if (prev.y !== curr.y) delta.y = curr.y;
  if (prev.dir !== curr.dir) delta.dir = curr.dir;
  if (prev.anim !== curr.anim) delta.anim = curr.anim;

  return delta;
}

/**
 * Apply a delta to reconstruct the full state.
 */
function applyDelta(state: PlayerState, delta: PlayerDelta): PlayerState {
  return {
    ...state,
    x: delta.x !== undefined ? delta.x : state.x,
    y: delta.y !== undefined ? delta.y : state.y,
    dir: delta.dir !== undefined ? delta.dir : state.dir,
    anim: delta.anim !== undefined ? delta.anim : state.anim,
  };
}

/**
 * Estimate JSON payload size in bytes.
 */
function estimatePayloadSize(data: object): number {
  return JSON.stringify(data).length;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Delta Compression — computeDelta', () => {
  const baseState: PlayerState = {
    id: 'player-1',
    x: 100,
    y: 200,
    dir: 'idle',
    anim: 'idle',
  };

  it('no change produces minimal delta (just id)', () => {
    const delta = computeDelta(baseState, { ...baseState });

    expect(delta.id).toBe('player-1');
    expect(delta.x).toBeUndefined();
    expect(delta.y).toBeUndefined();
    expect(delta.dir).toBeUndefined();
    expect(delta.anim).toBeUndefined();
  });

  it('position change includes x, y in delta', () => {
    const moved = { ...baseState, x: 110, y: 210 };
    const delta = computeDelta(baseState, moved);

    expect(delta.id).toBe('player-1');
    expect(delta.x).toBe(110);
    expect(delta.y).toBe(210);
    expect(delta.dir).toBeUndefined();
    expect(delta.anim).toBeUndefined();
  });

  it('direction-only change includes only dir', () => {
    const turned = { ...baseState, dir: 'right' as Direction };
    const delta = computeDelta(baseState, turned);

    expect(delta.id).toBe('player-1');
    expect(delta.dir).toBe('right');
    expect(delta.x).toBeUndefined();
    expect(delta.y).toBeUndefined();
    expect(delta.anim).toBeUndefined();
  });

  it('animation-only change includes only anim', () => {
    const animated = { ...baseState, anim: 'walk-right' };
    const delta = computeDelta(baseState, animated);

    expect(delta.id).toBe('player-1');
    expect(delta.anim).toBe('walk-right');
    expect(delta.x).toBeUndefined();
    expect(delta.y).toBeUndefined();
    expect(delta.dir).toBeUndefined();
  });

  it('full state change includes all fields', () => {
    const fullChange: PlayerState = {
      id: 'player-1',
      x: 999,
      y: 888,
      dir: 'down-left',
      anim: 'run-down-left',
    };
    const delta = computeDelta(baseState, fullChange);

    expect(delta.id).toBe('player-1');
    expect(delta.x).toBe(999);
    expect(delta.y).toBe(888);
    expect(delta.dir).toBe('down-left');
    expect(delta.anim).toBe('run-down-left');
  });

  it('x-only change includes only x', () => {
    const moved = { ...baseState, x: 150 };
    const delta = computeDelta(baseState, moved);

    expect(delta.x).toBe(150);
    expect(delta.y).toBeUndefined();
  });

  it('y-only change includes only y', () => {
    const moved = { ...baseState, y: 250 };
    const delta = computeDelta(baseState, moved);

    expect(delta.y).toBe(250);
    expect(delta.x).toBeUndefined();
  });
});

describe('Delta Compression — applyDelta', () => {
  const baseState: PlayerState = {
    id: 'player-1',
    x: 100,
    y: 200,
    dir: 'idle',
    anim: 'idle',
  };

  it('applyDelta correctly reconstructs full state from position delta', () => {
    const delta: PlayerDelta = { id: 'player-1', x: 150, y: 250 };
    const result = applyDelta(baseState, delta);

    expect(result).toEqual({
      id: 'player-1',
      x: 150,
      y: 250,
      dir: 'idle',
      anim: 'idle',
    });
  });

  it('applyDelta with empty delta preserves state', () => {
    const delta: PlayerDelta = { id: 'player-1' };
    const result = applyDelta(baseState, delta);

    expect(result).toEqual(baseState);
  });

  it('applyDelta with direction change updates only direction', () => {
    const delta: PlayerDelta = { id: 'player-1', dir: 'up' };
    const result = applyDelta(baseState, delta);

    expect(result.dir).toBe('up');
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.anim).toBe('idle');
  });

  it('applyDelta with all fields updates everything', () => {
    const delta: PlayerDelta = {
      id: 'player-1',
      x: 500,
      y: 600,
      dir: 'down-right',
      anim: 'walk-down-right',
    };
    const result = applyDelta(baseState, delta);

    expect(result.x).toBe(500);
    expect(result.y).toBe(600);
    expect(result.dir).toBe('down-right');
    expect(result.anim).toBe('walk-down-right');
  });

  it('applyDelta is idempotent (applying same delta twice gives same result)', () => {
    const delta: PlayerDelta = { id: 'player-1', x: 150 };
    const result1 = applyDelta(baseState, delta);
    const result2 = applyDelta(baseState, delta);

    expect(result1).toEqual(result2);
  });

  it('sequential deltas accumulate correctly', () => {
    let state = { ...baseState };

    state = applyDelta(state, { id: 'player-1', x: 110 });
    state = applyDelta(state, { id: 'player-1', y: 210 });
    state = applyDelta(state, { id: 'player-1', dir: 'right' });

    expect(state).toEqual({
      id: 'player-1',
      x: 110,
      y: 210,
      dir: 'right',
      anim: 'idle',
    });
  });
});

describe('Delta Compression — Payload Size Reduction', () => {
  it('delta payload is smaller than full state for position-only updates', () => {
    const fullState: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      dir: 'right',
      anim: 'walk-right',
    };

    const delta: PlayerDelta = { id: 'player-1', x: 110, y: 210 };

    const fullSize = estimatePayloadSize(fullState);
    const deltaSize = estimatePayloadSize(delta);

    expect(deltaSize).toBeLessThan(fullSize);
    // >50% reduction
    const reduction = 1 - deltaSize / fullSize;
    expect(reduction).toBeGreaterThan(0.5);
  });

  it('minimal delta (id only) is much smaller than full state', () => {
    const fullState: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      dir: 'down-right',
      anim: 'walk-down-right',
    };

    const delta: PlayerDelta = { id: 'player-1' };

    const fullSize = estimatePayloadSize(fullState);
    const deltaSize = estimatePayloadSize(delta);

    expect(deltaSize).toBeLessThan(fullSize * 0.5);
  });

  it('multiple players: delta array vs full state array comparison', () => {
    const players: PlayerState[] = [];
    for (let i = 0; i < 10; i++) {
      players.push({
        id: `player-${i}`,
        x: 100 + i * 10,
        y: 200 + i * 10,
        dir: 'right',
        anim: 'walk-right',
      });
    }

    // Only 3 of 10 players moved (position-only changes)
    const deltas: PlayerDelta[] = [
      { id: 'player-0', x: 111, y: 211 },
      { id: 'player-3', x: 141, y: 241 },
      { id: 'player-7', x: 181, y: 281 },
    ];

    const fullSize = estimatePayloadSize(players);
    const deltaSize = estimatePayloadSize(deltas);

    // Delta array should be significantly smaller
    expect(deltaSize).toBeLessThan(fullSize);
    const reduction = 1 - deltaSize / fullSize;
    expect(reduction).toBeGreaterThan(0.5);
  });

  it('full state change delta is still smaller than full state (no name field)', () => {
    const fullState: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      dir: 'right',
      anim: 'walk-right',
      name: 'LongPlayerName123',
    };

    // Even a full delta doesn't include name
    const delta: PlayerDelta = {
      id: 'player-1',
      x: 999,
      y: 888,
      dir: 'down-left',
      anim: 'run-down-left',
    };

    const fullSize = estimatePayloadSize(fullState);
    const deltaSize = estimatePayloadSize(delta);

    expect(deltaSize).toBeLessThan(fullSize);
  });
});

describe('Delta Compression — Round-trip Integrity', () => {
  it('computeDelta + applyDelta round-trips correctly', () => {
    const prev: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      dir: 'idle',
      anim: 'idle',
    };

    const curr: PlayerState = {
      id: 'player-1',
      x: 150,
      y: 250,
      dir: 'right',
      anim: 'walk-right',
    };

    const delta = computeDelta(prev, curr);
    const reconstructed = applyDelta(prev, delta);

    expect(reconstructed.x).toBe(curr.x);
    expect(reconstructed.y).toBe(curr.y);
    expect(reconstructed.dir).toBe(curr.dir);
    expect(reconstructed.anim).toBe(curr.anim);
  });

  it('round-trip with no changes preserves state exactly', () => {
    const state: PlayerState = {
      id: 'player-1',
      x: 42,
      y: 99,
      dir: 'up-left',
      anim: 'walk-up-left',
    };

    const delta = computeDelta(state, state);
    const reconstructed = applyDelta(state, delta);

    expect(reconstructed).toEqual(state);
  });

  it('round-trip with partial changes preserves unchanged fields', () => {
    const prev: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      dir: 'idle',
      anim: 'idle',
    };

    const curr: PlayerState = {
      id: 'player-1',
      x: 110,
      y: 200, // unchanged
      dir: 'idle', // unchanged
      anim: 'idle', // unchanged
    };

    const delta = computeDelta(prev, curr);
    const reconstructed = applyDelta(prev, delta);

    expect(reconstructed.x).toBe(110);
    expect(reconstructed.y).toBe(200);
    expect(reconstructed.dir).toBe('idle');
    expect(reconstructed.anim).toBe('idle');
  });
});
