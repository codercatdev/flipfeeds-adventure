import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ZoneType,
  ZoneEnterPayload,
  ZoneExitPayload,
  ZoneInteractPayload,
} from '@flipfeeds/shared';

/**
 * Phase 4 — Zone Manager Tests
 *
 * Tests the zone manager orchestration logic — pure state machine.
 * The ZoneManager tracks which zones are active, manages chat zone state,
 * kiosk modal state, and determines which overlays to show.
 */

// ============================================================
// Pure logic extracted from ZoneManager component
// ============================================================

class ZoneManagerState {
  activeZones: Set<string> = new Set();
  activeZoneTypes: Map<string, ZoneType> = new Map();
  chatZoneId: string | null = null;
  kioskOpen: boolean = false;
  kioskZoneId: string | null = null;

  handleZoneEnter(payload: ZoneEnterPayload): void {
    this.activeZones.add(payload.zoneId);
    this.activeZoneTypes.set(payload.zoneId, payload.zoneType);

    if (payload.zoneType === 'chat') {
      this.chatZoneId = payload.zoneId;
    }
  }

  handleZoneExit(payload: ZoneExitPayload): void {
    this.activeZones.delete(payload.zoneId);
    this.activeZoneTypes.delete(payload.zoneId);

    if (payload.zoneType === 'chat' && this.chatZoneId === payload.zoneId) {
      this.chatZoneId = null;
    }
    // Note: kiosk stays open even if player walks away
  }

  handleZoneInteract(payload: ZoneInteractPayload): void {
    this.kioskOpen = true;
    this.kioskZoneId = payload.zoneId;
  }

  closeKiosk(): void {
    this.kioskOpen = false;
    this.kioskZoneId = null;
  }

  getActiveOverlays(): string[] {
    const overlays: string[] = [];
    for (const [zoneId, zoneType] of this.activeZoneTypes) {
      if (zoneType === 'chat') overlays.push('chat');
      if (zoneType === 'video') overlays.push('video');
      if (zoneType === 'webrtc') overlays.push('webrtc');
      // kiosk and info don't auto-show overlays — they require interaction
    }
    if (this.kioskOpen) overlays.push('kiosk');
    return overlays;
  }
}

// ============================================================
// Tests
// ============================================================

describe('ZoneManagerState — Zone Enter/Exit', () => {
  let state: ZoneManagerState;

  beforeEach(() => {
    state = new ZoneManagerState();
  });

  it('zone enter adds to activeZones set', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });

    expect(state.activeZones.has('water-cooler-main')).toBe(true);
    expect(state.activeZones.size).toBe(1);
  });

  it('zone exit removes from activeZones set', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneExit({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
    });

    expect(state.activeZones.has('water-cooler-main')).toBe(false);
    expect(state.activeZones.size).toBe(0);
  });

  it('multiple zones can be active simultaneously', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneEnter({
      zoneType: 'video',
      zoneId: 'stage-main',
      playerScreenPos: { x: 200, y: 200 },
    });
    state.handleZoneEnter({
      zoneType: 'webrtc',
      zoneId: 'lounge-a',
      playerScreenPos: { x: 300, y: 300 },
    });

    expect(state.activeZones.size).toBe(3);
    expect(state.activeZones.has('water-cooler-main')).toBe(true);
    expect(state.activeZones.has('stage-main')).toBe(true);
    expect(state.activeZones.has('lounge-a')).toBe(true);
  });

  it('exiting one zone does not affect others', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneEnter({
      zoneType: 'video',
      zoneId: 'stage-main',
      playerScreenPos: { x: 200, y: 200 },
    });

    state.handleZoneExit({ zoneType: 'chat', zoneId: 'water-cooler-main' });

    expect(state.activeZones.size).toBe(1);
    expect(state.activeZones.has('stage-main')).toBe(true);
  });
});

describe('ZoneManagerState — Chat Zone Tracking', () => {
  let state: ZoneManagerState;

  beforeEach(() => {
    state = new ZoneManagerState();
  });

  it('chat zone enter sets chatZoneId', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });

    expect(state.chatZoneId).toBe('water-cooler-main');
  });

  it('chat zone exit clears chatZoneId', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneExit({ zoneType: 'chat', zoneId: 'water-cooler-main' });

    expect(state.chatZoneId).toBeNull();
  });

  it('non-chat zone enter does not set chatZoneId', () => {
    state.handleZoneEnter({
      zoneType: 'video',
      zoneId: 'stage-main',
      playerScreenPos: { x: 100, y: 100 },
    });

    expect(state.chatZoneId).toBeNull();
  });

  it('exiting a different chat zone does not clear current chatZoneId', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    // Simulate entering a second chat zone (overrides)
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'coffee-bar',
      playerScreenPos: { x: 200, y: 200 },
    });

    // Exit the first zone — chatZoneId should still be coffee-bar
    state.handleZoneExit({ zoneType: 'chat', zoneId: 'water-cooler-main' });
    expect(state.chatZoneId).toBe('coffee-bar');
  });
});

describe('ZoneManagerState — Kiosk Interaction', () => {
  let state: ZoneManagerState;

  beforeEach(() => {
    state = new ZoneManagerState();
  });

  it('kiosk interact opens kiosk modal', () => {
    state.handleZoneInteract({
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
    });

    expect(state.kioskOpen).toBe(true);
    expect(state.kioskZoneId).toBe('kiosk-schedule');
  });

  it('info interact opens kiosk modal', () => {
    state.handleZoneInteract({
      zoneType: 'info',
      zoneId: 'info-desk',
    });

    expect(state.kioskOpen).toBe(true);
    expect(state.kioskZoneId).toBe('info-desk');
  });

  it('zone exit while kiosk open doesn\'t close kiosk (player walked away but modal stays)', () => {
    state.handleZoneEnter({
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneInteract({
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
    });

    // Player walks away
    state.handleZoneExit({ zoneType: 'kiosk', zoneId: 'kiosk-schedule' });

    // Kiosk should still be open
    expect(state.kioskOpen).toBe(true);
    expect(state.kioskZoneId).toBe('kiosk-schedule');
  });

  it('closeKiosk closes the kiosk', () => {
    state.handleZoneInteract({
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
    });
    state.closeKiosk();

    expect(state.kioskOpen).toBe(false);
    expect(state.kioskZoneId).toBeNull();
  });
});

describe('ZoneManagerState — Active Overlays', () => {
  let state: ZoneManagerState;

  beforeEach(() => {
    state = new ZoneManagerState();
  });

  it('getActiveOverlays returns correct overlay types for active zones', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });

    const overlays = state.getActiveOverlays();
    expect(overlays).toContain('chat');
  });

  it('video zone produces video overlay', () => {
    state.handleZoneEnter({
      zoneType: 'video',
      zoneId: 'stage-main',
      playerScreenPos: { x: 100, y: 100 },
    });

    expect(state.getActiveOverlays()).toContain('video');
  });

  it('webrtc zone produces webrtc overlay', () => {
    state.handleZoneEnter({
      zoneType: 'webrtc',
      zoneId: 'lounge-a',
      playerScreenPos: { x: 100, y: 100 },
    });

    expect(state.getActiveOverlays()).toContain('webrtc');
  });

  it('kiosk interaction adds kiosk overlay', () => {
    state.handleZoneInteract({
      zoneType: 'kiosk',
      zoneId: 'kiosk-schedule',
    });

    expect(state.getActiveOverlays()).toContain('kiosk');
  });

  it('no active zones returns empty overlays (or just kiosk if open)', () => {
    expect(state.getActiveOverlays()).toHaveLength(0);
  });

  it('multiple zone types produce multiple overlays', () => {
    state.handleZoneEnter({
      zoneType: 'chat',
      zoneId: 'water-cooler-main',
      playerScreenPos: { x: 100, y: 100 },
    });
    state.handleZoneEnter({
      zoneType: 'video',
      zoneId: 'stage-main',
      playerScreenPos: { x: 200, y: 200 },
    });

    const overlays = state.getActiveOverlays();
    expect(overlays).toContain('chat');
    expect(overlays).toContain('video');
  });
});
