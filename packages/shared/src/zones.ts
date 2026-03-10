/**
 * Interaction Zone types for FlipFeeds.
 * Zones are defined in the Tiled tilemap (InteractionZones object layer)
 * and detected by Phaser physics overlap in GameScene.
 */

export type ZoneType = 'chat' | 'kiosk' | 'video' | 'webrtc' | 'info';

export interface InteractionZone {
  /** Unique zone identifier (e.g., "water-cooler-main") */
  id: string;
  /** Zone behavior type */
  type: ZoneType;
  /** Human-readable name */
  name: string;
  /** Position in pixels (from Tiled) */
  x: number;
  y: number;
  /** Size in pixels (from Tiled) */
  width: number;
  height: number;
  /** Activation radius in tiles — how close the player must be */
  radius: number;
}

/** Zone configuration for each zone type */
export interface ChatZoneConfig {
  maxMessageLength: 200;
  rateLimitMs: 1000;
  bubbleDisplayMs: 8000;
  bubbleFadeMs: 1000;
}

export interface KioskZoneConfig {
  /** Requires explicit key press to activate */
  activationKey: 'E';
  /** Pauses game input when modal is open */
  pausesInput: true;
}

export interface VideoZoneConfig {
  /** Auto-plays on zone enter */
  autoPlay: true;
  /** Audio fades based on distance */
  spatialAudio: true;
  /** Minimum volume threshold (below this = mute) */
  minVolumeThreshold: 0.05;
}

export interface WebRTCZoneConfig {
  /** Maximum participants per zone */
  maxParticipants: 6;
  /** Falls back to audio-only if camera denied */
  audioFallback: true;
}

/** Events emitted when player interacts with zones */
export interface ZoneEnterPayload {
  zoneType: ZoneType;
  zoneId: string;
  playerScreenPos: { x: number; y: number };
}

export interface ZoneExitPayload {
  zoneType: ZoneType;
  zoneId: string;
}

export interface ZoneProximityPayload {
  zoneId: string;
  distance: number;
  maxDistance: number;
  normalizedDistance: number;
  zoneScreenPos?: { x: number; y: number };
}

export interface ZoneInteractPayload {
  zoneType: 'kiosk' | 'info';
  zoneId: string;
}

/** All zone definitions for the conference map */
export const CONFERENCE_ZONES: Omit<InteractionZone, 'x' | 'y' | 'width' | 'height'>[] = [
  { id: 'water-cooler-main', type: 'chat', name: 'Main Water Cooler', radius: 3 },
  { id: 'coffee-bar', type: 'chat', name: 'Coffee Bar', radius: 2 },
  { id: 'kiosk-schedule', type: 'kiosk', name: 'Schedule Kiosk', radius: 2 },
  { id: 'stage-main', type: 'video', name: 'Main Stage', radius: 4 },
  { id: 'stage-side', type: 'video', name: 'Side Stage', radius: 3 },
  { id: 'lounge-a', type: 'webrtc', name: 'Lounge A', radius: 2 },
  { id: 'lounge-b', type: 'webrtc', name: 'Lounge B', radius: 2 },
  { id: 'info-desk', type: 'info', name: 'Info Desk', radius: 2 },
];
