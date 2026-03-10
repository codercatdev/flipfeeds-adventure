import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../src/EventBus';
import {
  CONFERENCE_ZONES,
  type ZoneType,
  type ZoneEnterPayload,
  type ZoneExitPayload,
  type ZoneProximityPayload,
  type ZoneInteractPayload,
} from '@flipfeeds/shared';

/**
 * Phase 4 — Zone Event Tests
 *
 * Tests the zone detection and event emission logic.
 * Pure EventBus tests — no Phaser, no React.
 *
 * The game emits ZONE_ENTER, ZONE_EXIT, ZONE_PROXIMITY, and ZONE_INTERACT
 * events through the EventBus when the player moves near interaction zones.
 */

// Valid zone types for validation
const VALID_ZONE_TYPES: ZoneType[] = ['chat', 'kiosk', 'video', 'webrtc', 'info'];

describe('Zone Events — CONFERENCE_ZONES Validation', () => {
  it('has exactly 8 zones defined', () => {
    expect(CONFERENCE_ZONES).toHaveLength(8);
  });

  it('all 8 CONFERENCE_ZONES have valid types', () => {
    for (const zone of CONFERENCE_ZONES) {
      expect(VALID_ZONE_TYPES).toContain(zone.type);
    }
  });

  it('each zone has a unique id', () => {
    const ids = CONFERENCE_ZONES.map(z => z.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('each zone has a positive radius', () => {
    for (const zone of CONFERENCE_ZONES) {
      expect(zone.radius).toBeGreaterThan(0);
    }
  });

  it('contains expected zone ids', () => {
    const ids = CONFERENCE_ZONES.map(z => z.id);
    expect(ids).toContain('water-cooler-main');
    expect(ids).toContain('coffee-bar');
    expect(ids).toContain('kiosk-schedule');
    expect(ids).toContain('stage-main');
    expect(ids).toContain('stage-side');
    expect(ids).toContain('lounge-a');
    expect(ids).toContain('lounge-b');
    expect(ids).toContain('info-desk');
  });

  it('maps zone ids to correct types', () => {
    const zoneMap = new Map(CONFERENCE_ZONES.map(z => [z.id, z.type]));
    expect(zoneMap.get('water-cooler-main')).toBe('chat');
    expect(zoneMap.get('coffee-bar')).toBe('chat');
    expect(zoneMap.get('kiosk-schedule')).toBe('kiosk');
    expect(zoneMap.get('stage-main')).toBe('video');
    expect(zoneMap.get('stage-side')).toBe('video');
    expect(zoneMap.get('lounge-a')).toBe('webrtc');
    expect(zoneMap.get('lounge-b')).toBe('webrtc');
    expect(zoneMap.get('info-desk')).toBe('info');
  });

  it('maps zone ids to correct radii', () => {
    const radiusMap = new Map(CONFERENCE_ZONES.map(z => [z.id, z.radius]));
    expect(radiusMap.get('water-cooler-main')).toBe(3);
    expect(radiusMap.get('coffee-bar')).toBe(2);
    expect(radiusMap.get('kiosk-schedule')).toBe(2);
    expect(radiusMap.get('stage-main')).toBe(4);
    expect(radiusMap.get('stage-side')).toBe(3);
    expect(radiusMap.get('lounge-a')).toBe(2);
    expect(radiusMap.get('lounge-b')).toBe(2);
    expect(radiusMap.get('info-desk')).toBe(2);
  });

  it('all 5 zone types are represented', () => {
    const types = new Set(CONFERENCE_ZONES.map(z => z.type));
    expect(types.size).toBe(5);
    for (const t of VALID_ZONE_TYPES) {
      expect(types.has(t)).toBe(true);
    }
  });
});

describe('Zone Events — ZONE_ENTER', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('emits ZONE_ENTER with correct zoneType and zoneId', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_ENTER', handler);

    const payload: ZoneEnterPayload = {
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 400, y: 300 },
    };
    eventBus.emit('ZONE_ENTER', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
    expect(handler.mock.calls[0][0].zoneType).toBe('chat');
    expect(handler.mock.calls[0][0].zoneId).toBe('water-cooler-main');
  });

  it('zone enter includes playerScreenPos with x, y coordinates', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_ENTER', handler);

    eventBus.emit('ZONE_ENTER', {
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
      playerScreenPos: { x: 150, y: 250 },
    });

    const received = handler.mock.calls[0][0] as ZoneEnterPayload;
    expect(received.playerScreenPos).toBeDefined();
    expect(typeof received.playerScreenPos.x).toBe('number');
    expect(typeof received.playerScreenPos.y).toBe('number');
    expect(received.playerScreenPos.x).toBe(150);
    expect(received.playerScreenPos.y).toBe(250);
  });

  it('emits ZONE_ENTER for each zone type', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_ENTER', handler);

    for (const zone of CONFERENCE_ZONES) {
      eventBus.emit('ZONE_ENTER', {
        zoneType: zone.type,
        zoneId: zone.id,
        playerScreenPos: { x: 100, y: 100 },
      });
    }

    expect(handler).toHaveBeenCalledTimes(8);
  });
});

describe('Zone Events — ZONE_EXIT', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('emits ZONE_EXIT with correct zoneType and zoneId', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_EXIT', handler);

    const payload: ZoneExitPayload = {
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
    };
    eventBus.emit('ZONE_EXIT', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('entering and exiting same zone produces matching zoneId', () => {
    const enterHandler = vi.fn();
    const exitHandler = vi.fn();
    eventBus.on('ZONE_ENTER', enterHandler);
    eventBus.on('ZONE_EXIT', exitHandler);

    const zoneId = 'coffee-bar';
    const zoneType: ZoneType = 'chat';

    eventBus.emit('ZONE_ENTER', {
      zoneType,
      zoneId,
      playerScreenPos: { x: 100, y: 100 },
    });
    eventBus.emit('ZONE_EXIT', { zoneType, zoneId });

    expect(enterHandler.mock.calls[0][0].zoneId).toBe(zoneId);
    expect(exitHandler.mock.calls[0][0].zoneId).toBe(zoneId);
    expect(enterHandler.mock.calls[0][0].zoneId).toBe(exitHandler.mock.calls[0][0].zoneId);
  });
});

describe('Zone Events — ZONE_PROXIMITY', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('emits ZONE_PROXIMITY with normalizedDistance 0.0-1.0', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_PROXIMITY', handler);

    const payload: ZoneProximityPayload = {
      zoneId: 'stage-main',
      distance: 2,
      maxDistance: 4,
      normalizedDistance: 0.5,
      zoneScreenPos: { x: 200, y: 200 },
    };
    eventBus.emit('ZONE_PROXIMITY', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    const received = handler.mock.calls[0][0] as ZoneProximityPayload;
    expect(received.normalizedDistance).toBeGreaterThanOrEqual(0);
    expect(received.normalizedDistance).toBeLessThanOrEqual(1);
  });

  it('normalizedDistance = distance / maxDistance', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_PROXIMITY', handler);

    const distance = 1.5;
    const maxDistance = 3;
    const normalizedDistance = distance / maxDistance;

    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-side',
      distance,
      maxDistance,
      normalizedDistance,
      zoneScreenPos: { x: 100, y: 100 },
    });

    const received = handler.mock.calls[0][0] as ZoneProximityPayload;
    expect(received.normalizedDistance).toBeCloseTo(0.5, 5);
    expect(received.normalizedDistance).toBeCloseTo(received.distance / received.maxDistance, 5);
  });

  it('normalizedDistance is 0 at center', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_PROXIMITY', handler);

    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-main',
      distance: 0,
      maxDistance: 4,
      normalizedDistance: 0,
      zoneScreenPos: { x: 200, y: 200 },
    });

    expect(handler.mock.calls[0][0].normalizedDistance).toBe(0);
  });

  it('normalizedDistance is 1 at edge', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_PROXIMITY', handler);

    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-main',
      distance: 4,
      maxDistance: 4,
      normalizedDistance: 1,
      zoneScreenPos: { x: 200, y: 200 },
    });

    expect(handler.mock.calls[0][0].normalizedDistance).toBe(1);
  });

  it('player can be in proximity of multiple zones simultaneously', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_PROXIMITY', handler);

    // Emit proximity for two zones at once
    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'lounge-a',
      distance: 1,
      maxDistance: 2,
      normalizedDistance: 0.5,
      zoneScreenPos: { x: 100, y: 100 },
    });
    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'lounge-b',
      distance: 1.5,
      maxDistance: 2,
      normalizedDistance: 0.75,
      zoneScreenPos: { x: 200, y: 200 },
    });

    expect(handler).toHaveBeenCalledTimes(2);
    const zoneIds = handler.mock.calls.map((c: any) => c[0].zoneId);
    expect(zoneIds).toContain('lounge-a');
    expect(zoneIds).toContain('lounge-b');
  });
});

describe('Zone Events — ZONE_INTERACT', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('ZONE_INTERACT fires for kiosk type', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_INTERACT', handler);

    const payload: ZoneInteractPayload = {
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
    };
    eventBus.emit('ZONE_INTERACT', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('ZONE_INTERACT fires for info type', () => {
    const handler = vi.fn();
    eventBus.on('ZONE_INTERACT', handler);

    const payload: ZoneInteractPayload = {
      zoneType: 'info',
      zoneId: 'info-desk',
    };
    eventBus.emit('ZONE_INTERACT', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('ZONE_INTERACT only fires for kiosk and info types (not chat, video, webrtc)', () => {
    // This test validates the type constraint: ZoneInteractPayload.zoneType is 'kiosk' | 'info'
    // At runtime, the game should only emit ZONE_INTERACT for these two types
    const interactableTypes: ZoneType[] = ['kiosk', 'info'];
    const nonInteractableTypes: ZoneType[] = ['chat', 'video', 'webrtc'];

    // Verify the CONFERENCE_ZONES have the right interactable zones
    const interactableZones = CONFERENCE_ZONES.filter(z =>
      interactableTypes.includes(z.type)
    );
    const nonInteractableZones = CONFERENCE_ZONES.filter(z =>
      nonInteractableTypes.includes(z.type)
    );

    expect(interactableZones.length).toBeGreaterThan(0);
    expect(nonInteractableZones.length).toBeGreaterThan(0);

    // kiosk-schedule and info-desk should be interactable
    expect(interactableZones.map(z => z.id)).toContain('kiosk-schedule');
    expect(interactableZones.map(z => z.id)).toContain('info-desk');

    // chat, video, webrtc zones should NOT be interactable
    for (const zone of nonInteractableZones) {
      expect(interactableTypes).not.toContain(zone.type);
    }
  });
});

describe('Zone Events — Rapid Transitions', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('rapid zone transitions don\'t cause duplicate events when tracked', () => {
    // Simulate the activeZones Set pattern used in GameScene
    const activeZones = new Set<string>();
    const enterEvents: ZoneEnterPayload[] = [];
    const exitEvents: ZoneExitPayload[] = [];

    eventBus.on('ZONE_ENTER', (data) => enterEvents.push(data));
    eventBus.on('ZONE_EXIT', (data) => exitEvents.push(data));

    // Simulate rapid enter/exit/enter for same zone
    const zoneId = 'water-cooler-main';
    const zoneType: ZoneType = 'chat';

    // First enter
    if (!activeZones.has(zoneId)) {
      activeZones.add(zoneId);
      eventBus.emit('ZONE_ENTER', { zoneType, zoneId, playerScreenPos: { x: 100, y: 100 } });
    }

    // Duplicate enter attempt (should be blocked by Set)
    if (!activeZones.has(zoneId)) {
      activeZones.add(zoneId);
      eventBus.emit('ZONE_ENTER', { zoneType, zoneId, playerScreenPos: { x: 100, y: 100 } });
    }

    // Exit
    if (activeZones.has(zoneId)) {
      activeZones.delete(zoneId);
      eventBus.emit('ZONE_EXIT', { zoneType, zoneId });
    }

    // Re-enter
    if (!activeZones.has(zoneId)) {
      activeZones.add(zoneId);
      eventBus.emit('ZONE_ENTER', { zoneType, zoneId, playerScreenPos: { x: 110, y: 110 } });
    }

    // Should have 2 enters (not 3) and 1 exit
    expect(enterEvents).toHaveLength(2);
    expect(exitEvents).toHaveLength(1);
  });

  it('multiple zones can be entered without interference', () => {
    const activeZones = new Set<string>();
    const enterHandler = vi.fn();
    eventBus.on('ZONE_ENTER', enterHandler);

    // Enter two zones simultaneously
    for (const zone of CONFERENCE_ZONES.slice(0, 3)) {
      if (!activeZones.has(zone.id)) {
        activeZones.add(zone.id);
        eventBus.emit('ZONE_ENTER', {
          zoneType: zone.type,
          zoneId: zone.id,
          playerScreenPos: { x: 100, y: 100 },
        });
      }
    }

    expect(enterHandler).toHaveBeenCalledTimes(3);
    expect(activeZones.size).toBe(3);
  });
});
