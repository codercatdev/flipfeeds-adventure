import { describe, it, expect } from 'vitest';
import type {
  Direction,
  PlayerState,
  PlayerDelta,
  ClientMessage,
  ServerMessage,
  GameEvents,
  FPSMetric,
  SyncTelemetry,
  PoolStats,
} from '../src/index';

/**
 * Shared types structural tests.
 *
 * These tests use TypeScript's type system at compile time AND runtime
 * shape checks to verify the shared contract between all three domains
 * (React, Phaser, Server).
 */

describe('Shared Types – PlayerState', () => {
  it('PlayerState has all required fields', () => {
    const player: PlayerState = {
      id: 'player-1',
      x: 100,
      y: 200,
      direction: 'idle',
      name: 'TestPlayer',
    };

    expect(player.id).toBe('player-1');
    expect(player.x).toBe(100);
    expect(player.y).toBe(200);
    expect(player.direction).toBe('idle');
    expect(player.name).toBe('TestPlayer');
  });

  it('PlayerState accepts optional animation field', () => {
    const player: PlayerState = {
      id: 'p2',
      x: 0,
      y: 0,
      direction: 'up',
      name: 'Animated',
      animation: 'walk-up',
    };

    expect(player.animation).toBe('walk-up');
  });

  it('PlayerDelta requires id and allows partial updates', () => {
    const delta: PlayerDelta = { id: 'p1' };
    expect(delta.id).toBe('p1');
    expect(delta.x).toBeUndefined();

    const deltaWithPos: PlayerDelta = { id: 'p1', x: 50, y: 75 };
    expect(deltaWithPos.x).toBe(50);
    expect(deltaWithPos.y).toBe(75);
  });
});

describe('Shared Types – Direction', () => {
  it('includes all 8 cardinal/ordinal directions plus idle', () => {
    const allDirections: Direction[] = [
      'up', 'down', 'left', 'right',
      'up-left', 'up-right', 'down-left', 'down-right',
      'idle',
    ];

    expect(allDirections).toHaveLength(9);
    // Each should be a valid string
    allDirections.forEach((d) => {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
    });
  });

  it('Direction values are usable in PlayerState', () => {
    const directions: Direction[] = [
      'up', 'down', 'left', 'right',
      'up-left', 'up-right', 'down-left', 'down-right',
      'idle',
    ];

    directions.forEach((dir) => {
      const player: PlayerState = {
        id: 'test',
        x: 0,
        y: 0,
        direction: dir,
        name: 'Test',
      };
      expect(player.direction).toBe(dir);
    });
  });
});

describe('Shared Types – ClientMessage', () => {
  it('supports move message', () => {
    const msg: ClientMessage = { type: 'move', x: 10, y: 20, dir: 'up', seq: 1 };
    expect(msg.type).toBe('move');
  });

  it('supports chat message', () => {
    const msg: ClientMessage = { type: 'chat', text: 'hello' };
    expect(msg.type).toBe('chat');
  });

  it('supports ping message', () => {
    const msg: ClientMessage = { type: 'ping', t: Date.now() };
    expect(msg.type).toBe('ping');
    expect(typeof (msg as { t: number }).t).toBe('number');
  });

  it('discriminated union covers all client message types', () => {
    const types = ['move', 'chat', 'ping'] as const;
    const messages: ClientMessage[] = [
      { type: 'move', x: 0, y: 0, dir: 'idle', seq: 0 },
      { type: 'chat', text: 'test' },
      { type: 'ping', t: 0 },
    ];

    messages.forEach((msg, i) => {
      expect(msg.type).toBe(types[i]);
    });
  });
});

describe('Shared Types – ServerMessage', () => {
  it('supports welcome message', () => {
    const msg: ServerMessage = { type: 'welcome', id: 'conn-1', players: [], tick: 0 };
    expect(msg.type).toBe('welcome');
  });

  it('supports sync message with deltas', () => {
    const msg: ServerMessage = {
      type: 'sync',
      players: [{ id: 'p1', x: 10 }],
      tick: 42,
    };
    expect(msg.type).toBe('sync');
  });

  it('supports player-join message', () => {
    const msg: ServerMessage = {
      type: 'player-join',
      player: { id: 'p1', x: 0, y: 0, direction: 'idle', name: 'New' },
    };
    expect(msg.type).toBe('player-join');
  });

  it('supports player-leave message', () => {
    const msg: ServerMessage = { type: 'player-leave', id: 'p1' };
    expect(msg.type).toBe('player-leave');
  });

  it('supports chat message', () => {
    const msg: ServerMessage = { type: 'chat', id: 'p1', text: 'hi' };
    expect(msg.type).toBe('chat');
  });

  it('supports pong message', () => {
    const msg: ServerMessage = { type: 'pong', t: Date.now() };
    expect(msg.type).toBe('pong');
  });

  it('discriminated union covers all server message types', () => {
    const types = ['welcome', 'sync', 'player-join', 'player-leave', 'chat', 'pong'];
    const messages: ServerMessage[] = [
      { type: 'welcome', id: 'c1', players: [], tick: 0 },
      { type: 'sync', players: [], tick: 0 },
      { type: 'player-join', player: { id: 'p1', x: 0, y: 0, direction: 'idle', name: 'X' } },
      { type: 'player-leave', id: 'p1' },
      { type: 'chat', id: 'p1', text: '' },
      { type: 'pong', t: 0 },
    ];

    messages.forEach((msg, i) => {
      expect(msg.type).toBe(types[i]);
    });
  });
});

describe('Shared Types – GameEvents', () => {
  it('GameEvents type includes Phaser->React events', () => {
    // Compile-time check: these keys must exist on GameEvents
    const event: keyof GameEvents = 'GAME_READY';
    expect(event).toBe('GAME_READY');

    const zoneEvent: keyof GameEvents = 'ZONE_ENTER';
    expect(zoneEvent).toBe('ZONE_ENTER');
  });

  it('GameEvents type includes React->Phaser events', () => {
    const pause: keyof GameEvents = 'PAUSE_INPUT';
    expect(pause).toBe('PAUSE_INPUT');

    const resume: keyof GameEvents = 'RESUME_INPUT';
    expect(resume).toBe('RESUME_INPUT');
  });

  it('GameEvents type includes telemetry events', () => {
    const fps: keyof GameEvents = 'TELEMETRY:FPS';
    expect(fps).toBe('TELEMETRY:FPS');

    const sync: keyof GameEvents = 'TELEMETRY:SYNC';
    expect(sync).toBe('TELEMETRY:SYNC');

    const pool: keyof GameEvents = 'TELEMETRY:POOL';
    expect(pool).toBe('TELEMETRY:POOL');
  });

  it('FPSMetric has current, average, min, frameTime', () => {
    const metric: FPSMetric = { current: 60, average: 58, min: 55, frameTime: 16.67 };
    expect(metric.current).toBe(60);
    expect(metric.average).toBe(58);
    expect(metric.min).toBe(55);
    expect(metric.frameTime).toBe(16.67);
  });

  it('SyncTelemetry has serverTickDelta, interpolationOffset, predictionError, roundTripTime', () => {
    const telemetry: SyncTelemetry = {
      serverTickDelta: 42,
      interpolationOffset: 100,
      predictionError: 5,
      roundTripTime: 30,
    };
    expect(telemetry.serverTickDelta).toBe(42);
    expect(telemetry.interpolationOffset).toBe(100);
    expect(telemetry.predictionError).toBe(5);
    expect(telemetry.roundTripTime).toBe(30);
  });

  it('PoolStats has active, idle, total, created, recycled', () => {
    const stats: PoolStats = { active: 3, idle: 7, total: 10, created: 15, recycled: 12 };
    expect(stats.active).toBe(3);
    expect(stats.idle).toBe(7);
    expect(stats.total).toBe(10);
    expect(stats.created).toBe(15);
    expect(stats.recycled).toBe(12);
  });
});
