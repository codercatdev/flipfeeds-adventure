import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tilemap Loading Tests — Phase 2
 *
 * Validates that conference-map.json (exported from Tiled) has the correct
 * structure, dimensions, layers, and data for the FlipFeeds conference world.
 *
 * These tests run against the raw JSON file — no Phaser needed.
 */

const TILEMAP_PATH = resolve(__dirname, '../src/maps/conference-map.json');

// Load and parse the tilemap once for all tests
let tilemap: any;
try {
  const raw = readFileSync(TILEMAP_PATH, 'utf-8');
  tilemap = JSON.parse(raw);
} catch {
  tilemap = null;
}

describe('Tilemap — File Validity', () => {
  it('conference-map.json exists and is valid JSON', () => {
    expect(tilemap).not.toBeNull();
    expect(tilemap).toBeDefined();
    expect(typeof tilemap).toBe('object');
  });

  it('has a tilesets array with at least one tileset', () => {
    expect(tilemap.tilesets).toBeDefined();
    expect(Array.isArray(tilemap.tilesets)).toBe(true);
    expect(tilemap.tilesets.length).toBeGreaterThanOrEqual(1);
  });

  it('tileset has a firstgid and name', () => {
    const ts = tilemap.tilesets[0];
    expect(ts.name).toBe('oryx_16bit_scifi_world');
    expect(ts.firstgid).toBe(1);
  });

  it('has orthogonal orientation and right-down render order', () => {
    expect(tilemap.orientation).toBe('orthogonal');
    expect(tilemap.renderorder).toBe('right-down');
  });
});

describe('Tilemap — Dimensions', () => {
  it('map is 80×60 tiles', () => {
    expect(tilemap.width).toBe(80);
    expect(tilemap.height).toBe(60);
  });

  it('tile size is 24×24 pixels', () => {
    expect(tilemap.tilewidth).toBe(24);
    expect(tilemap.tileheight).toBe(24);
  });

  it('world pixel size is 1920×1440', () => {
    const worldWidth = tilemap.width * tilemap.tilewidth;
    const worldHeight = tilemap.height * tilemap.tileheight;
    expect(worldWidth).toBe(1920);
    expect(worldHeight).toBe(1440);
  });
});

describe('Tilemap — Layer Structure', () => {
  const EXPECTED_LAYERS = [
    'Ground',
    'Walls',
    'Decorations',
    'AbovePlayer',
    'InteractionZones',
    'SpawnPoints',
  ];

  it('has exactly 6 layers', () => {
    expect(tilemap.layers).toBeDefined();
    expect(tilemap.layers.length).toBe(6);
  });

  it('layers are in the correct order', () => {
    const layerNames = tilemap.layers.map((l: any) => l.name);
    expect(layerNames).toEqual(EXPECTED_LAYERS);
  });

  it.each(EXPECTED_LAYERS)('layer "%s" exists', (name) => {
    const layer = tilemap.layers.find((l: any) => l.name === name);
    expect(layer).toBeDefined();
  });

  it('Ground, Walls, Decorations, AbovePlayer are tilelayers', () => {
    const tileLayerNames = ['Ground', 'Walls', 'Decorations', 'AbovePlayer'];
    for (const name of tileLayerNames) {
      const layer = tilemap.layers.find((l: any) => l.name === name);
      expect(layer.type).toBe('tilelayer');
    }
  });

  it('InteractionZones and SpawnPoints are objectgroups', () => {
    const objectLayerNames = ['InteractionZones', 'SpawnPoints'];
    for (const name of objectLayerNames) {
      const layer = tilemap.layers.find((l: any) => l.name === name);
      expect(layer.type).toBe('objectgroup');
    }
  });
});

describe('Tilemap — Ground Layer', () => {
  it('Ground layer has data array of correct length (80×60 = 4800)', () => {
    const ground = tilemap.layers.find((l: any) => l.name === 'Ground');
    expect(ground.data).toBeDefined();
    expect(ground.data.length).toBe(4800);
  });

  it('Ground layer is fully populated (no empty tiles)', () => {
    const ground = tilemap.layers.find((l: any) => l.name === 'Ground');
    const emptyTiles = ground.data.filter((t: number) => t === 0).length;
    expect(emptyTiles).toBe(0);
  });
});

describe('Tilemap — Walls Layer (Collision)', () => {
  it('Walls layer has data array of correct length', () => {
    const walls = tilemap.layers.find((l: any) => l.name === 'Walls');
    expect(walls.data).toBeDefined();
    expect(walls.data.length).toBe(4800);
  });

  it('Walls layer has collision tiles (non-zero tiles > 0)', () => {
    const walls = tilemap.layers.find((l: any) => l.name === 'Walls');
    const nonZeroTiles = walls.data.filter((t: number) => t > 0).length;
    expect(nonZeroTiles).toBeGreaterThan(0);
    // We know from inspection there are 472 wall tiles
    expect(nonZeroTiles).toBeGreaterThanOrEqual(100);
  });

  it('Walls layer has empty tiles (walkable areas)', () => {
    const walls = tilemap.layers.find((l: any) => l.name === 'Walls');
    const emptyTiles = walls.data.filter((t: number) => t === 0).length;
    expect(emptyTiles).toBeGreaterThan(0);
    // Most of the map should be walkable
    expect(emptyTiles).toBeGreaterThan(walls.data.length / 2);
  });
});

describe('Tilemap — Decorations & AbovePlayer Layers', () => {
  it('Decorations layer has some non-zero tiles', () => {
    const deco = tilemap.layers.find((l: any) => l.name === 'Decorations');
    const nonZero = deco.data.filter((t: number) => t > 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });

  it('AbovePlayer layer has some non-zero tiles', () => {
    const above = tilemap.layers.find((l: any) => l.name === 'AbovePlayer');
    const nonZero = above.data.filter((t: number) => t > 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });
});

describe('Tilemap — InteractionZones Layer', () => {
  let zones: any[];

  beforeAll(() => {
    const layer = tilemap.layers.find((l: any) => l.name === 'InteractionZones');
    zones = layer.objects;
  });

  it('has zone objects', () => {
    expect(zones.length).toBeGreaterThan(0);
    // We know there are 9 zones
    expect(zones.length).toBe(9);
  });

  it('each zone has required Tiled properties (id, name, type, x, y, width, height)', () => {
    for (const zone of zones) {
      expect(zone).toHaveProperty('id');
      expect(zone).toHaveProperty('name');
      expect(zone).toHaveProperty('type');
      expect(zone).toHaveProperty('x');
      expect(zone).toHaveProperty('y');
      expect(zone).toHaveProperty('width');
      expect(zone).toHaveProperty('height');
      expect(typeof zone.id).toBe('number');
      expect(typeof zone.x).toBe('number');
      expect(typeof zone.y).toBe('number');
      expect(typeof zone.width).toBe('number');
      expect(typeof zone.height).toBe('number');
    }
  });

  it('each zone has custom properties with zoneType and zoneId', () => {
    for (const zone of zones) {
      expect(zone.properties).toBeDefined();
      expect(Array.isArray(zone.properties)).toBe(true);

      const propMap = Object.fromEntries(
        zone.properties.map((p: any) => [p.name, p.value])
      );

      expect(propMap).toHaveProperty('zoneType');
      expect(propMap).toHaveProperty('zoneId');
      expect(typeof propMap.zoneType).toBe('string');
      expect(typeof propMap.zoneId).toBe('string');
    }
  });

  it('zone types are valid FlipFeeds zone types', () => {
    const validTypes = ['chat', 'kiosk', 'video', 'webrtc', 'info'];
    for (const zone of zones) {
      const zoneType = zone.properties.find((p: any) => p.name === 'zoneType')?.value;
      expect(validTypes).toContain(zoneType);
    }
  });

  it('zones have positive dimensions (width > 0, height > 0)', () => {
    for (const zone of zones) {
      expect(zone.width).toBeGreaterThan(0);
      expect(zone.height).toBeGreaterThan(0);
    }
  });

  it('zones are within world bounds', () => {
    const worldWidth = tilemap.width * tilemap.tilewidth;   // 1920
    const worldHeight = tilemap.height * tilemap.tileheight; // 1440
    for (const zone of zones) {
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + zone.width).toBeLessThanOrEqual(worldWidth);
      expect(zone.y + zone.height).toBeLessThanOrEqual(worldHeight);
    }
  });
});

describe('Tilemap — SpawnPoints Layer', () => {
  let spawnPoints: any[];

  beforeAll(() => {
    const layer = tilemap.layers.find((l: any) => l.name === 'SpawnPoints');
    spawnPoints = layer.objects;
  });

  it('has at least one spawn point', () => {
    expect(spawnPoints.length).toBeGreaterThanOrEqual(1);
  });

  it('spawn point has type or is untyped (Oryx export)', () => {
    for (const sp of spawnPoints) {
      // Oryx tileset export may leave type empty; accept both
      expect(['spawn', '']).toContain(sp.type);
    }
  });

  it('spawn point has valid coordinates within world bounds', () => {
    const worldWidth = tilemap.width * tilemap.tilewidth;
    const worldHeight = tilemap.height * tilemap.tileheight;
    for (const sp of spawnPoints) {
      expect(sp.x).toBeGreaterThanOrEqual(0);
      expect(sp.x).toBeLessThanOrEqual(worldWidth);
      expect(sp.y).toBeGreaterThanOrEqual(0);
      expect(sp.y).toBeLessThanOrEqual(worldHeight);
    }
  });

  it('default spawn point has isDefault property set to true', () => {
    const defaultSpawn = spawnPoints.find((sp: any) => {
      const props = Object.fromEntries(
        (sp.properties || []).map((p: any) => [p.name, p.value])
      );
      return props.isDefault === true;
    });
    expect(defaultSpawn).toBeDefined();
  });

  it('default spawn point is a point object (not a rectangle)', () => {
    const defaultSpawn = spawnPoints[0];
    expect(defaultSpawn.point).toBe(true);
  });
});
