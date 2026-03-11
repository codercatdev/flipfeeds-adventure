import type { AvatarConfig } from './avatar';

export type Direction =
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right'
  | 'idle';

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  name?: string;
  anim?: string;
  avatarConfig?: AvatarConfig;
}

export interface PlayerDelta {
  id: string;
  x?: number;
  y?: number;
  dir?: Direction;
  anim?: string;
}
