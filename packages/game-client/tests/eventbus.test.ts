import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../src/EventBus';
import type { GameEvents } from '../src/EventBus';

/**
 * EventBus integration tests.
 *
 * The EventBus is the central nervous system of FlipFeeds — it bridges
 * React, Phaser, and Server. These tests verify the mitt-based bus
 * correctly emits, receives, and unsubscribes typed events.
 */

describe('EventBus – Core Functionality', () => {
  beforeEach(() => {
    // Clear all listeners between tests to avoid cross-contamination
    eventBus.all.clear();
  });

  it('emits and receives GAME_READY event', () => {
    const handler = vi.fn();
    eventBus.on('GAME_READY', handler);
    eventBus.emit('GAME_READY');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits and receives ZONE_ENTER with typed payload', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_ENTER', handler);

    const payload = { zoneId: 'zone-1', zoneType: 'kiosk' as const, playerScreenPos: { x: 100, y: 200 } };
    eventBus.emit('ZONE_ENTER', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('emits and receives ZONE_EXIT with zoneId', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_EXIT', handler);

    eventBus.emit('ZONE_EXIT', { zoneId: 'zone-2', zoneType: 'chat' as const });

    expect(handler).toHaveBeenCalledWith({ zoneId: 'zone-2', zoneType: 'chat' });
  });

  it('emits PLAYER_POSITION with coordinates', () => {
    const handler = vi.fn();
    eventBus.on('PLAYER_POSITION', handler);

    eventBus.emit('PLAYER_POSITION', { x: 100, y: 200, direction: 'right' as const });

    expect(handler).toHaveBeenCalledWith({ x: 100, y: 200, direction: 'right' });
  });
});

describe('EventBus – Subscription Management', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('off() properly unsubscribes a handler', () => {
    const handler = vi.fn();
    eventBus.on('GAME_READY', handler);

    // First emit should fire
    eventBus.emit('GAME_READY');
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    eventBus.off('GAME_READY', handler);

    // Second emit should NOT fire
    eventBus.emit('GAME_READY');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('multiple listeners on same event all fire', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventBus.on('GAME_READY', handler1);
    eventBus.on('GAME_READY', handler2);
    eventBus.on('GAME_READY', handler3);

    eventBus.emit('GAME_READY');

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one listener does not affect others', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on('GAME_READY', handler1);
    eventBus.on('GAME_READY', handler2);

    eventBus.off('GAME_READY', handler1);
    eventBus.emit('GAME_READY');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

describe('EventBus – React to Phaser Events', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('PAUSE_INPUT event works (React -> Phaser)', () => {
    const handler = vi.fn();
    eventBus.on('PAUSE_INPUT', handler);

    eventBus.emit('PAUSE_INPUT');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('RESUME_INPUT event works (React -> Phaser)', () => {
    const handler = vi.fn();
    eventBus.on('RESUME_INPUT', handler);

    eventBus.emit('RESUME_INPUT');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('CHAT_SEND carries message payload', () => {
    const handler = vi.fn();
    eventBus.on('CHAT_SEND', handler);

    eventBus.emit('CHAT_SEND', { message: 'Hello world!' });

    expect(handler).toHaveBeenCalledWith({ message: 'Hello world!' });
  });

  it('KIOSK_CLOSED event fires without payload', () => {
    const handler = vi.fn();
    eventBus.on('KIOSK_CLOSED', handler);

    eventBus.emit('KIOSK_CLOSED');

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('EventBus – Server Events', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('PLAYER_JOINED carries full player info', () => {
    const handler = vi.fn();
    eventBus.on('PLAYER_JOINED', handler);

    const payload = { id: 'p1', x: 100, y: 200, direction: 'idle' as const, name: 'Alice' };
    eventBus.emit('PLAYER_JOINED', payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('PLAYER_LEFT carries player id', () => {
    const handler = vi.fn();
    eventBus.on('PLAYER_LEFT', handler);

    eventBus.emit('PLAYER_LEFT', { id: 'p1' });

    expect(handler).toHaveBeenCalledWith({ id: 'p1' });
  });

  it('PLAYER_MOVED carries position update', () => {
    const handler = vi.fn();
    eventBus.on('PLAYER_MOVED', handler);

    eventBus.emit('PLAYER_MOVED', { id: 'p1', x: 50, y: 75, direction: 'up' as const });

    expect(handler).toHaveBeenCalledWith({ id: 'p1', x: 50, y: 75, direction: 'up' });
  });

  it('CONNECT event carries URL', () => {
    const handler = vi.fn();
    eventBus.on('CONNECT', handler);

    eventBus.emit('CONNECT', { url: 'ws://localhost:1999' });

    expect(handler).toHaveBeenCalledWith({ url: 'ws://localhost:1999' });
  });

  it('DISCONNECT event fires', () => {
    const handler = vi.fn();
    eventBus.on('DISCONNECT', handler);

    eventBus.emit('DISCONNECT');

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('EventBus – Event Ordering', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('events fire in subscription order', () => {
    const order: number[] = [];

    eventBus.on('GAME_READY', () => order.push(1));
    eventBus.on('GAME_READY', () => order.push(2));
    eventBus.on('GAME_READY', () => order.push(3));

    eventBus.emit('GAME_READY');

    expect(order).toEqual([1, 2, 3]);
  });

  it('different events do not interfere', () => {
    const readyHandler = vi.fn();
    const pauseHandler = vi.fn();

    eventBus.on('GAME_READY', readyHandler);
    eventBus.on('PAUSE_INPUT', pauseHandler);

    eventBus.emit('GAME_READY');

    expect(readyHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler).not.toHaveBeenCalled();
  });
});
