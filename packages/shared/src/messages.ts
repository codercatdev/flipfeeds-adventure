import type { Direction, PlayerState, PlayerDelta } from './player';
import type { AvatarConfig } from './avatar';

// Client → Server
export type ClientMoveMessage = { type: 'move'; x: number; y: number; dir: Direction; anim?: string; seq: number };
export type ClientChatMessage = { type: 'chat'; text: string };
export type ClientPingMessage = { type: 'ping'; t: number };
export type ClientAvatarUpdateMessage = { type: 'avatar-update'; avatarConfig: AvatarConfig };

export type ClientMessage =
  | ClientMoveMessage
  | ClientChatMessage
  | ClientPingMessage
  | ClientAvatarUpdateMessage;

// Server → Client
export type ServerWelcomeMessage = { type: 'welcome'; id: string; players: PlayerState[]; tick: number };
export type ServerSyncMessage = { type: 'sync'; players: PlayerDelta[]; tick: number; ack?: number; serverTime?: number };
export type ServerPlayerJoinMessage = { type: 'player-join'; player: PlayerState };
export type ServerPlayerLeaveMessage = { type: 'player-leave'; id: string };
export type ServerChatMessage = { type: 'chat'; id: string; text: string; name?: string };
export type ServerAvatarUpdateMessage = { type: 'avatar-update'; id: string; avatarConfig: AvatarConfig };
export type ServerForceLogoutMessage = { type: 'force-logout'; reason: string };
export type ServerPongMessage = { type: 'pong'; t: number };

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerSyncMessage
  | ServerPlayerJoinMessage
  | ServerPlayerLeaveMessage
  | ServerChatMessage
  | ServerAvatarUpdateMessage
  | ServerForceLogoutMessage
  | ServerPongMessage;
