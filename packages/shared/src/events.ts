import type { Direction } from './player';
import type { AvatarConfig } from './avatar';
import type { ZoneEnterPayload, ZoneExitPayload, ZoneProximityPayload, ZoneInteractPayload } from './zones';

// === Telemetry Types (Observability Contract with @qa) ===

/** Emitted every 1 second via TELEMETRY:FPS */
export interface FPSMetric {
  current: number;    // instantaneous fps
  average: number;    // rolling 5s average
  min: number;        // lowest frame in window
  frameTime: number;  // ms per frame
}

/** Emitted per server tick via TELEMETRY:SYNC */
export interface SyncTelemetry {
  serverTickDelta: number;     // ms since last server update
  interpolationOffset: number; // ms behind server time
  predictionError: number;     // px distance between predicted and corrected position
  roundTripTime: number;       // WebSocket RTT
}

/** Emitted on every pool mutation via TELEMETRY:POOL */
export interface PoolStats {
  active: number;   // sprites currently in use
  idle: number;     // sprites in pool waiting
  total: number;    // active + idle
  created: number;  // lifetime sprites created
  recycled: number; // lifetime recycles
}

/**
 * Canonical event map for the FlipFeeds game.
 * Used by Phaser (game-client), React (web-ui), and the multiplayer layer.
 */
export type GameEvents = {
  // Phaser -> React
  GAME_READY: void;
  ZONE_ENTER: ZoneEnterPayload;
  ZONE_EXIT: ZoneExitPayload;
  // Zone events (Phaser -> React)
  ZONE_PROXIMITY: ZoneProximityPayload;
  ZONE_INTERACT: ZoneInteractPayload;
  CHAT_OPEN: { zoneId: string };
  ROOM_CHANGE: { targetRoom: string; targetSpawn: string; roomName?: string };

  // Debug
  DEBUG_ZONES_TOGGLE: void;

  OPEN_KIOSK: { id: string; type: string };
  PLAYER_POSITION: { x: number; y: number; direction: Direction };

  // React -> Phaser
  AVATAR_SELECTED: AvatarConfig;
  CHAT_SEND: { message: string };
  KIOSK_CLOSED: void;
  PAUSE_INPUT: void;
  RESUME_INPUT: void;

  // Server -> Client (via EventBus after WebSocket processing)
  /** Full room state sent when game becomes ready so it can show players already in the room */
  ROOM_STATE: { id: string; players: Array<{ id: string; x: number; y: number; direction: Direction; name?: string; anim?: string; avatarConfig?: AvatarConfig }> };
  PLAYER_JOINED: { id: string; x: number; y: number; direction: Direction; name: string; avatarConfig?: AvatarConfig };
  PLAYER_LEFT: { id: string };
  PLAYER_MOVED: { id: string; x: number; y: number; direction: Direction; anim?: string };
  CHAT_RECEIVED: { playerId: string; message: string; x: number; y: number };

  // Mobile touch controls -> Phaser
  MOBILE_DIRECTION: { up: boolean; down: boolean; left: boolean; right: boolean };

  // Room transitions
  ROOM_LOADED: { room: string };

  // Client -> Server
  CONNECT: { url: string };
  DISCONNECT: void;
  SEND_POSITION: { x: number; y: number; direction: Direction; anim?: string };
  SEND_CHAT: { message: string };

  // Telemetry (Observability Contract)
  'TELEMETRY:FPS': FPSMetric;
  'TELEMETRY:SYNC': SyncTelemetry;
  'TELEMETRY:POOL': PoolStats;
};
