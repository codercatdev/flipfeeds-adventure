export type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right'
  | 'idle';

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  name?: string;
  anim?: string;
}

export interface PlayerDelta {
  id: string;
  x?: number;
  y?: number;
  dir?: Direction;
  anim?: string;
}
