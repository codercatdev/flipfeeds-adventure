# Conference Map — FlipFeeds Tilemap

## Overview

`conference-map.json` is a **Tiled-compatible tilemap** (JSON format) that Phaser 3 loads via `this.load.tilemapTiledJSON()`.

- **Grid:** 80 × 60 tiles (1280 × 960 pixels)
- **Tile Size:** 16 × 16 pixels
- **Orientation:** orthogonal, right-down render order

## Tileset

The map references a single tileset image: `conference-tiles.png` (128 × 128 px, 8 columns × 8 rows = 64 tiles).

The tileset PNG must be created/sourced separately and placed alongside this map or in the assets directory. The `firstgid` is 1.

### Tile ID Reference

| ID | Layer | Meaning |
|----|-------|---------|
| 1 | Ground | Grass |
| 2 | Ground | Stone path |
| 3 | Ground | Wood floor (lobby) |
| 4 | Ground | Red carpet (stage) |
| 5 | Ground | Blue carpet (breakout) |
| 6 | Ground | Tile floor (corridors) |
| 10 | Walls | Exterior wall |
| 11 | Walls | Interior wall |
| 12 | Walls | Furniture (desk/table) |
| 13 | Walls | Large plant / tree trunk |
| 20 | Decorations | Small plant |
| 21 | Decorations | Rug |
| 22 | Decorations | Sign / poster |
| 30 | AbovePlayer | Tree canopy |
| 31 | AbovePlayer | Overhead sign |

## Layer Structure

### 1. Ground (tilelayer)
Base floor — every cell is filled. No empty tiles.

### 2. Walls (tilelayer)
Collision layer. Non-zero tiles block player movement. Use this layer for collision detection in Phaser:
```js
const wallsLayer = map.createLayer('Walls', tileset);
wallsLayer.setCollisionByExclusion([-1, 0]);
```

### 3. Decorations (tilelayer)
Visual-only layer rendered below the player sprite. No collision.

### 4. AbovePlayer (tilelayer)
Rendered above the player sprite (tree canopies, overhead signs). Set depth accordingly:
```js
const aboveLayer = map.createLayer('AbovePlayer', tileset);
aboveLayer.setDepth(10);
```

### 5. InteractionZones (objectgroup)
Rectangle objects defining trigger areas. Each has custom properties:
- `zoneType`: string — the type of interaction (webrtc, stage, coffee-bar, etc.)
- `zoneId`: string — unique identifier for the zone
- `radius`: int — activation radius in tiles

### 6. SpawnPoints (objectgroup)
Point objects for player spawn locations. The default spawn is `spawn-main` at pixel (640, 672).

## Spatial Layout

```
Rows 0-17:   Outdoor Garden (grass + stone paths)
              Lounge A (5,4)-(9,8)    Lounge B (65,4)-(69,8)
              Trees at (15,3) (25,3) (45,3) (55,3) (15,10) (55,10)

Row 18:       Building Exterior Wall (entrance gap cols 35-44)

Rows 19-45:  Main Lobby (wood floor)
              Main Stage (5,22)-(15,28) — red carpet
              Coffee Bar (60,22)-(64,24)
              Info Desk (60,30)-(63,32)
              Water Cooler (38,32)-(41,35)
              Schedule Kiosk (45,33)-(47,35)
              Spawn Point (40,42)

Row 46:       Interior Wall / Divider (gaps at cols 12-16, 35-44, 60-64)

Rows 47-58:  Breakout Wing
              Side Stage (5,49)-(11,53) — blue carpet
              Meeting Room (55,49)-(65,53) — blue carpet

Row 59:       Building Exterior Wall (bottom)
```

## Editing in Tiled

1. Open [Tiled Map Editor](https://www.mapeditor.org/) (v1.10+)
2. Open `conference-map.json`
3. If the tileset image is missing, Tiled will prompt you — point it to `conference-tiles.png`
4. Edit layers as needed
5. Save as JSON (File → Save As → JSON format)
6. Phaser will load the updated map automatically

### Tips
- Keep the **Walls** layer for collision only — don't put visual-only tiles here
- Use **InteractionZones** for any new interactive areas (right-click → Insert Rectangle)
- Add custom properties to objects via the Properties panel
- The map is 80×60 tiles — don't resize without updating game code

## Loading in Phaser 3

```js
// In preload:
this.load.tilemapTiledJSON('conference-map', 'maps/conference-map.json');
this.load.image('conference-tiles', 'maps/conference-tiles.png');

// In create:
const map = this.make.tilemap({ key: 'conference-map' });
const tileset = map.addTilesetImage('conference-tiles');

const groundLayer = map.createLayer('Ground', tileset);
const wallsLayer = map.createLayer('Walls', tileset);
const decoLayer = map.createLayer('Decorations', tileset);
const aboveLayer = map.createLayer('AbovePlayer', tileset);

wallsLayer.setCollisionByExclusion([-1, 0]);
aboveLayer.setDepth(10);

// Get spawn point
const spawnPoint = map.findObject('SpawnPoints', obj => obj.name === 'spawn-main');
// player.setPosition(spawnPoint.x, spawnPoint.y);

// Get interaction zones
const zones = map.getObjectLayer('InteractionZones').objects;
```

## Interaction Zones

| Zone | Type | Location (tiles) | Purpose |
|------|------|-------------------|---------|
| lounge-a | webrtc | (5,4)-(9,8) | WebRTC video chat area |
| lounge-b | webrtc | (65,4)-(69,8) | WebRTC video chat area |
| main-stage | stage | (5,22)-(15,28) | Main presentation stage |
| coffee-bar | interaction | (60,22)-(64,24) | Social / refreshments |
| info-desk | interaction | (60,30)-(63,32) | Information booth |
| water-cooler | interaction | (38,32)-(41,35) | Casual chat spot |
| schedule-kiosk | interaction | (45,33)-(47,35) | View event schedule |
| side-stage | stage | (5,49)-(11,53) | Breakout presentations |
| meeting-room | meeting | (55,49)-(65,53) | Private meetings |
