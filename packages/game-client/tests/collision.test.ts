import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Collision Logic Tests — Phase 2
 *
 * Tests the tile-based collision detection logic used by the game.
 * The Walls layer in the tilemap defines which tiles block movement.
 * A tile value > 0 means "solid/wall", 0 means "empty/walkable".
 *
 * These tests use pure functions that mirror what Phaser's collision
 * system does, but can run in Node.js without a browser.
 */

// ============================================================
// Load the actual Walls layer data from the tilemap
// ============================================================

const TILEMAP_PATH = resolve(__dirname, '../src/maps/conference-map.json');
let wallsData: number[] = [];
let mapWidth = 80;
let mapHeight = 60;
let tileSize = 16;

try {
  const raw = readFileSync(TILEMAP_PATH, 'utf-8');
  const tilemap = JSON.parse(raw);
  const wallsLayer = tilemap.layers.find((l: any) => l.name === 'Walls');
  wallsData = wallsLayer?.data || [];
  mapWidth = tilemap.width;
  mapHeight = tilemap.height;
  tileSize = tilemap.tilewidth;
} catch {
  // Tests will fail gracefully if tilemap is missing
}

// ============================================================
// Pure collision logic functions (extracted for testability)
// ============================================================

/**
 * Convert pixel coordinates to tile coordinates.
 */
function pixelToTile(px: number, py: number, tileW: number, tileH: number): { tx: number; ty: number } {
  return {
    tx: Math.floor(px / tileW),
    ty: Math.floor(py / tileH),
  };
}

/**
 * Get the tile value at a given tile coordinate from a flat 1D array.
 * Returns 0 if out of bounds.
 */
function getTileAt(tx: number, ty: number, data: number[], width: number, height: number): number {
  if (tx < 0 || tx >= width || ty < 0 || ty >= height) return 0;
  return data[ty * width + tx];
}

/**
 * Check if a tile position is blocked (has a wall).
 * A tile value > 0 means it's a wall tile.
 */
function isTileBlocked(tx: number, ty: number, data: number[], width: number, height: number): boolean {
  const tileValue = getTileAt(tx, ty, data, width, height);
  return tileValue > 0;
}

/**
 * Check if a player can move to a pixel position.
 * Checks the tile at the target position against the walls layer.
 */
function canMoveTo(
  px: number,
  py: number,
  wallData: number[],
  mapW: number,
  mapH: number,
  tileW: number,
  tileH: number,
): boolean {
  const { tx, ty } = pixelToTile(px, py, tileW, tileH);
  return !isTileBlocked(tx, ty, wallData, mapW, mapH);
}

/**
 * Attempt to move a player. Returns the new position.
 * If the target is blocked, returns the original position.
 */
function attemptMove(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  wallData: number[],
  mapW: number,
  mapH: number,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  if (canMoveTo(targetX, targetY, wallData, mapW, mapH, tileW, tileH)) {
    return { x: targetX, y: targetY };
  }
  return { x: currentX, y: currentY };
}

// ============================================================
// Tests
// ============================================================

describe('Collision — Pixel to Tile Conversion', () => {
  it('converts (0, 0) to tile (0, 0)', () => {
    expect(pixelToTile(0, 0, 16, 16)).toEqual({ tx: 0, ty: 0 });
  });

  it('converts (15, 15) to tile (0, 0) — within first tile', () => {
    expect(pixelToTile(15, 15, 16, 16)).toEqual({ tx: 0, ty: 0 });
  });

  it('converts (16, 0) to tile (1, 0) — next tile boundary', () => {
    expect(pixelToTile(16, 0, 16, 16)).toEqual({ tx: 1, ty: 0 });
  });

  it('converts (160, 320) to tile (10, 20)', () => {
    expect(pixelToTile(160, 320, 16, 16)).toEqual({ tx: 10, ty: 20 });
  });

  it('converts pixel at world edge correctly', () => {
    // Last pixel of the map: (1279, 959) → tile (79, 59)
    expect(pixelToTile(1279, 959, 16, 16)).toEqual({ tx: 79, ty: 59 });
  });
});

describe('Collision — Tile Value Lookup', () => {
  // Create a small test grid: 4×3
  const testData = [
    0, 1, 0, 0,  // row 0
    0, 0, 1, 0,  // row 1
    1, 0, 0, 1,  // row 2
  ];
  const testWidth = 4;
  const testHeight = 3;

  it('returns correct value for wall tile', () => {
    expect(getTileAt(1, 0, testData, testWidth, testHeight)).toBe(1);
    expect(getTileAt(2, 1, testData, testWidth, testHeight)).toBe(1);
    expect(getTileAt(0, 2, testData, testWidth, testHeight)).toBe(1);
    expect(getTileAt(3, 2, testData, testWidth, testHeight)).toBe(1);
  });

  it('returns 0 for empty tile', () => {
    expect(getTileAt(0, 0, testData, testWidth, testHeight)).toBe(0);
    expect(getTileAt(2, 0, testData, testWidth, testHeight)).toBe(0);
    expect(getTileAt(1, 1, testData, testWidth, testHeight)).toBe(0);
  });

  it('returns 0 for out-of-bounds coordinates', () => {
    expect(getTileAt(-1, 0, testData, testWidth, testHeight)).toBe(0);
    expect(getTileAt(0, -1, testData, testWidth, testHeight)).toBe(0);
    expect(getTileAt(4, 0, testData, testWidth, testHeight)).toBe(0);
    expect(getTileAt(0, 3, testData, testWidth, testHeight)).toBe(0);
  });
});

describe('Collision — isTileBlocked', () => {
  const testData = [
    0, 5, 0,  // row 0: tile (1,0) is wall with value 5
    0, 0, 3,  // row 1: tile (2,1) is wall with value 3
  ];
  const w = 3;
  const h = 2;

  it('returns true for wall tiles (value > 0)', () => {
    expect(isTileBlocked(1, 0, testData, w, h)).toBe(true);
    expect(isTileBlocked(2, 1, testData, w, h)).toBe(true);
  });

  it('returns false for empty tiles (value === 0)', () => {
    expect(isTileBlocked(0, 0, testData, w, h)).toBe(false);
    expect(isTileBlocked(2, 0, testData, w, h)).toBe(false);
    expect(isTileBlocked(0, 1, testData, w, h)).toBe(false);
  });

  it('returns false for out-of-bounds (treated as empty)', () => {
    expect(isTileBlocked(-1, 0, testData, w, h)).toBe(false);
    expect(isTileBlocked(10, 10, testData, w, h)).toBe(false);
  });
});

describe('Collision — Movement Blocking', () => {
  // 3×3 grid with walls on edges
  const testData = [
    1, 1, 1,  // top wall
    1, 0, 1,  // left/right walls, center open
    1, 1, 1,  // bottom wall
  ];
  const w = 3;
  const h = 3;
  const ts = 16;

  it('player can move to open tile', () => {
    // Center tile (1,1) is open — pixel (24, 24) is in tile (1,1)
    expect(canMoveTo(24, 24, testData, w, h, ts, ts)).toBe(true);
  });

  it('player cannot move to wall tile', () => {
    // Top-left tile (0,0) is wall — pixel (8, 8) is in tile (0,0)
    expect(canMoveTo(8, 8, testData, w, h, ts, ts)).toBe(false);
  });

  it('player position unchanged when moving into wall', () => {
    const current = { x: 24, y: 24 }; // center, open
    const target = { x: 8, y: 8 };    // top-left, wall

    const result = attemptMove(current.x, current.y, target.x, target.y, testData, w, h, ts, ts);
    expect(result).toEqual(current);
  });

  it('player position changes when moving to open area', () => {
    const current = { x: 24, y: 24 }; // center, open
    const target = { x: 25, y: 24 };  // still in center tile, open

    const result = attemptMove(current.x, current.y, target.x, target.y, testData, w, h, ts, ts);
    expect(result).toEqual(target);
  });
});

describe('Collision — Real Tilemap Walls', () => {
  it('walls data is loaded from tilemap', () => {
    expect(wallsData.length).toBe(mapWidth * mapHeight);
  });

  it('some tiles are walls (blocked)', () => {
    const wallCount = wallsData.filter(t => t > 0).length;
    expect(wallCount).toBeGreaterThan(0);
  });

  it('some tiles are open (walkable)', () => {
    const openCount = wallsData.filter(t => t === 0).length;
    expect(openCount).toBeGreaterThan(0);
  });

  it('spawn point location (640, 672) is not blocked', () => {
    // The default spawn is at pixel (640, 672) → tile (40, 42)
    const { tx, ty } = pixelToTile(640, 672, tileSize, tileSize);
    expect(isTileBlocked(tx, ty, wallsData, mapWidth, mapHeight)).toBe(false);
  });

  it('border tiles are walls (map has boundary walls)', () => {
    // Check bottom border tiles — map has walls along bottom edge
    const bottomLeftBlocked = isTileBlocked(0, mapHeight - 1, wallsData, mapWidth, mapHeight);
    const bottomRightBlocked = isTileBlocked(mapWidth - 1, mapHeight - 1, wallsData, mapWidth, mapHeight);
    // At least some border tiles should be walls
    expect(bottomLeftBlocked || bottomRightBlocked).toBe(true);
  });

  it('center of map has walkable areas', () => {
    // Check a region around the spawn point — should be mostly walkable
    const centerTx = Math.floor(mapWidth / 2);
    const centerTy = Math.floor(mapHeight / 2);
    let walkableCount = 0;
    const checkRadius = 3;

    for (let dx = -checkRadius; dx <= checkRadius; dx++) {
      for (let dy = -checkRadius; dy <= checkRadius; dy++) {
        if (!isTileBlocked(centerTx + dx, centerTy + dy, wallsData, mapWidth, mapHeight)) {
          walkableCount++;
        }
      }
    }

    // At least half the tiles around center should be walkable
    const totalChecked = (checkRadius * 2 + 1) ** 2;
    expect(walkableCount).toBeGreaterThan(totalChecked / 2);
  });
});
