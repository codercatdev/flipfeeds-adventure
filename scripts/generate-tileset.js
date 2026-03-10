#!/usr/bin/env node
/**
 * Generate a placeholder 128x128 tileset PNG for the conference map.
 * Each tile is 16x16 pixels. The tileset is 8 columns x 8 rows = 64 tiles.
 * 
 * Tile ID N maps to: col = (N-1) % 8, row = Math.floor((N-1) / 8)
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const WIDTH = 128;
const HEIGHT = 128;
const TILE_SIZE = 16;
const COLS = 8;

// Tile ID -> { color: [r,g,b], alpha: number }
const TILE_MAP = {
  1:  { color: [0x4a, 0x8c, 0x3f], alpha: 255 }, // Grass
  2:  { color: [0x8c, 0x8c, 0x8c], alpha: 255 }, // Stone path
  3:  { color: [0xc4, 0x95, 0x6a], alpha: 255 }, // Wood floor (lobby)
  4:  { color: [0x8c, 0x32, 0x32], alpha: 255 }, // Red carpet (stage)
  5:  { color: [0x32, 0x50, 0x8c], alpha: 255 }, // Blue carpet (breakout)
  6:  { color: [0xb8, 0xa8, 0x8a], alpha: 255 }, // Tile floor (corridors)
  10: { color: [0x2a, 0x2a, 0x2a], alpha: 255 }, // Exterior wall
  11: { color: [0x5a, 0x5a, 0x5a], alpha: 255 }, // Interior wall
  12: { color: [0x6b, 0x42, 0x26], alpha: 255 }, // Furniture
  13: { color: [0x3d, 0x2b, 0x1f], alpha: 255 }, // Tree trunk
  20: { color: [0x2d, 0x6b, 0x30], alpha: 255 }, // Small plant
  21: { color: [0xa0, 0x52, 0x2d], alpha: 255 }, // Rug
  22: { color: [0xd4, 0xc5, 0xa9], alpha: 255 }, // Sign/poster
  30: { color: [0x1a, 0x5c, 0x1a], alpha: 128 }, // Tree canopy (50% alpha)
  31: { color: [0x4a, 0x4a, 0x6a], alpha: 128 }, // Overhead sign (50% alpha)
};

const png = new PNG({ width: WIDTH, height: HEIGHT });

// Fill with transparent pixels first
for (let i = 0; i < WIDTH * HEIGHT * 4; i += 4) {
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 0;
}

// Draw each tile
for (const [idStr, tile] of Object.entries(TILE_MAP)) {
  const id = parseInt(idStr, 10);
  const col = (id - 1) % COLS;
  const row = Math.floor((id - 1) / COLS);
  const startX = col * TILE_SIZE;
  const startY = row * TILE_SIZE;

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const idx = ((startY + py) * WIDTH + (startX + px)) * 4;
      png.data[idx] = tile.color[0];
      png.data[idx + 1] = tile.color[1];
      png.data[idx + 2] = tile.color[2];
      png.data[idx + 3] = tile.alpha;
    }
  }
}

// Write the PNG
const outputPath = path.resolve(__dirname, '../packages/web-ui/public/assets/tilesets/conference-tiles.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outputPath, buffer);
console.log(`Tileset written to: ${outputPath} (${buffer.length} bytes)`);
