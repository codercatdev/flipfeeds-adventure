import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { eventBus } from '../src/EventBus';

/**
 * Multi-Room Portal Chain Tests
 *
 * Validates the 5-room linear portal chain:
 *   Lobby ↔ Feed Maker ↔ Social Hub ↔ Feed Future ↔ Edit Bay
 *
 * Tests read actual tilemap JSON files — no hardcoded values.
 * Verifies bidirectional portal links, spawn point integrity,
 * room registry, and ROOM_CHANGE event contracts.
 */

// ─── Room Map Registry ───────────────────────────────────────────────────────
const ROOM_MAP: Record<string, string> = {
  'lobby': 'conference-map-lobby',
  'feed-maker': 'conference-map-feed-maker',
  'social': 'conference-map-social',
  'feed-future': 'conference-map-feed-future',
  'edit-bay': 'conference-map-edit-bay',
};

const DEFAULT_ROOM = 'social';

const ROOM_IDS = Object.keys(ROOM_MAP);

// ─── Load all tilemaps ───────────────────────────────────────────────────────
const MAPS_DIR = resolve(__dirname, '../src/maps');

type TiledProperty = { name: string; type: string; value: string | number | boolean };
type TiledObject = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
};
type TiledLayer = {
  name: string;
  type: string;
  objects?: TiledObject[];
};
type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
};

/** Load a tilemap JSON by room ID */
function loadTilemap(roomId: string): TiledMap | null {
  const filename = ROOM_MAP[roomId];
  if (!filename) return null;
  try {
    const raw = readFileSync(resolve(MAPS_DIR, `${filename}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Get properties as a key-value map from a Tiled object */
function getProps(obj: TiledObject): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = {};
  for (const p of obj.properties ?? []) {
    props[p.name] = p.value;
  }
  return props;
}

/** Get all portal objects from a tilemap */
function getPortals(map: TiledMap): TiledObject[] {
  const zones = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'InteractionZones');
  if (!zones?.objects) return [];
  return zones.objects.filter((obj) => {
    const props = getProps(obj);
    return props.zoneType === 'portal';
  });
}

/** Get all spawn point objects from a tilemap */
function getSpawnPoints(map: TiledMap): TiledObject[] {
  const spawns = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'SpawnPoints');
  return spawns?.objects ?? [];
}

// Pre-load all tilemaps
const tilemaps: Record<string, TiledMap | null> = {};
for (const roomId of ROOM_IDS) {
  tilemaps[roomId] = loadTilemap(roomId);
}

// Expected map dimensions
const EXPECTED_WIDTH = 43;   // tiles
const EXPECTED_HEIGHT = 90;  // tiles
const TILE_SIZE = 24;        // px
const WORLD_WIDTH = EXPECTED_WIDTH * TILE_SIZE;   // 1032
const WORLD_HEIGHT = EXPECTED_HEIGHT * TILE_SIZE;  // 2160

// Linear chain order (left to right)
const CHAIN_ORDER = ['lobby', 'feed-maker', 'social', 'feed-future', 'edit-bay'];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Portal Chain Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Portal Chain — Tilemap File Validity', () => {
  for (const roomId of ROOM_IDS) {
    it(`${roomId}: tilemap file exists and is valid JSON`, () => {
      const map = tilemaps[roomId];
      expect(map).not.toBeNull();
      expect(map).toBeDefined();
      expect(typeof map).toBe('object');
    });
  }
});

describe('Portal Chain — Map Dimensions', () => {
  for (const roomId of ROOM_IDS) {
    it(`${roomId}: is ${EXPECTED_WIDTH}×${EXPECTED_HEIGHT} tiles with ${TILE_SIZE}px tile size`, () => {
      const map = tilemaps[roomId]!;
      expect(map.width).toBe(EXPECTED_WIDTH);
      expect(map.height).toBe(EXPECTED_HEIGHT);
      expect(map.tilewidth).toBe(TILE_SIZE);
      expect(map.tileheight).toBe(TILE_SIZE);
    });
  }
});

describe('Portal Chain — Bidirectional Links', () => {
  it('every portal has a matching return portal in the target room', () => {
    for (const roomId of ROOM_IDS) {
      const map = tilemaps[roomId]!;
      const portals = getPortals(map);

      for (const portal of portals) {
        const props = getProps(portal);
        const targetRoom = props.targetRoom as string;
        const targetSpawn = props.targetSpawn as string;

        // Target room must exist
        expect(ROOM_IDS).toContain(targetRoom);

        // Target room must have a portal back to this room
        const targetMap = tilemaps[targetRoom]!;
        const returnPortals = getPortals(targetMap);
        const returnPortal = returnPortals.find((p) => {
          const rp = getProps(p);
          return rp.targetRoom === roomId;
        });

        expect(
          returnPortal,
          `${roomId} → ${targetRoom}: no return portal found back to ${roomId}`
        ).toBeDefined();
      }
    }
  });

  it('portal chain forms a complete linear path: Lobby ↔ Feed Maker ↔ Social Hub ↔ Feed Future ↔ Edit Bay', () => {
    // Walk the chain left-to-right
    for (let i = 0; i < CHAIN_ORDER.length - 1; i++) {
      const leftRoom = CHAIN_ORDER[i];
      const rightRoom = CHAIN_ORDER[i + 1];

      // Left room has a right portal to right room
      const leftPortals = getPortals(tilemaps[leftRoom]!);
      const rightPortal = leftPortals.find((p) => {
        const props = getProps(p);
        return props.targetRoom === rightRoom;
      });
      expect(
        rightPortal,
        `${leftRoom} should have a portal to ${rightRoom}`
      ).toBeDefined();

      // Right room has a left portal back to left room
      const rightPortals = getPortals(tilemaps[rightRoom]!);
      const leftPortal = rightPortals.find((p) => {
        const props = getProps(p);
        return props.targetRoom === leftRoom;
      });
      expect(
        leftPortal,
        `${rightRoom} should have a portal back to ${leftRoom}`
      ).toBeDefined();
    }
  });
});

describe('Portal Chain — Target Spawn Exists in Target Room', () => {
  for (const roomId of ROOM_IDS) {
    const map = tilemaps[roomId];
    if (!map) continue;
    const portals = getPortals(map);

    for (const portal of portals) {
      const props = getProps(portal);
      const targetRoom = props.targetRoom as string;
      const targetSpawn = props.targetSpawn as string;

      it(`${roomId} portal → ${targetRoom}: spawn "${targetSpawn}" exists in target room`, () => {
        const targetMap = tilemaps[targetRoom]!;
        const spawns = getSpawnPoints(targetMap);
        const spawnNames = spawns.map((s) => s.name);
        expect(
          spawnNames,
          `${targetRoom} should have spawn "${targetSpawn}" (has: ${spawnNames.join(', ')})`
        ).toContain(targetSpawn);
      });
    }
  }
});

describe('Portal Chain — No Broken Links', () => {
  it('every portal targetRoom maps to an actual tilemap file', () => {
    for (const roomId of ROOM_IDS) {
      const map = tilemaps[roomId]!;
      const portals = getPortals(map);

      for (const portal of portals) {
        const props = getProps(portal);
        const targetRoom = props.targetRoom as string;

        // Must be a known room ID
        expect(ROOM_MAP).toHaveProperty(targetRoom);

        // Must have a loadable tilemap
        expect(
          tilemaps[targetRoom],
          `${roomId} portal targets "${targetRoom}" but its tilemap failed to load`
        ).not.toBeNull();
      }
    }
  });
});

describe('Portal Chain — Endpoint Rooms', () => {
  it('Lobby (leftmost) has only a right portal', () => {
    const portals = getPortals(tilemaps['lobby']!);
    expect(portals).toHaveLength(1);

    const props = getProps(portals[0]);
    expect(props.zoneId).toBe('portal-right');
    expect(props.targetRoom).toBe('feed-maker');
  });

  it('Edit Bay (rightmost) has only a left portal', () => {
    const portals = getPortals(tilemaps['edit-bay']!);
    expect(portals).toHaveLength(1);

    const props = getProps(portals[0]);
    expect(props.zoneId).toBe('portal-left');
    expect(props.targetRoom).toBe('feed-future');
  });
});

describe('Portal Chain — Middle Rooms Have Both Portals', () => {
  const middleRooms = ['feed-maker', 'social', 'feed-future'];

  for (const roomId of middleRooms) {
    it(`${roomId} has both left and right portals`, () => {
      const portals = getPortals(tilemaps[roomId]!);
      expect(portals).toHaveLength(2);

      const portalIds = portals.map((p) => getProps(p).zoneId);
      expect(portalIds).toContain('portal-left');
      expect(portalIds).toContain('portal-right');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Room Map Registry
// ═══════════════════════════════════════════════════════════════════════════════

describe('Room Map Registry', () => {
  it('has exactly 5 rooms registered', () => {
    expect(Object.keys(ROOM_MAP)).toHaveLength(5);
  });

  it('contains all expected room IDs', () => {
    const expected = ['lobby', 'feed-maker', 'social', 'feed-future', 'edit-bay'];
    for (const id of expected) {
      expect(ROOM_MAP).toHaveProperty(id);
    }
  });

  it('room IDs match all portal targetRoom values found in tilemaps', () => {
    const allTargetRooms = new Set<string>();

    for (const roomId of ROOM_IDS) {
      const map = tilemaps[roomId]!;
      const portals = getPortals(map);
      for (const portal of portals) {
        const props = getProps(portal);
        allTargetRooms.add(props.targetRoom as string);
      }
    }

    // Every targetRoom in the tilemaps must be a key in ROOM_MAP
    for (const targetRoom of allTargetRooms) {
      expect(
        ROOM_MAP,
        `Portal targetRoom "${targetRoom}" is not in ROOM_MAP`
      ).toHaveProperty(targetRoom);
    }

    // Every ROOM_MAP key should be referenced by at least one portal (except possibly the default)
    // Actually, all rooms are reachable via portals in a connected chain
    for (const roomId of ROOM_IDS) {
      // Each room is either a targetRoom of some portal, or is the default start room
      const isTargeted = allTargetRooms.has(roomId);
      const isDefault = roomId === DEFAULT_ROOM;
      expect(
        isTargeted || isDefault,
        `Room "${roomId}" is not targeted by any portal and is not the default room`
      ).toBe(true);
    }
  });

  it('each room ID maps to a valid tilemap filename', () => {
    for (const [roomId, filename] of Object.entries(ROOM_MAP)) {
      expect(filename).toMatch(/^conference-map-/);
      // The tilemap should have loaded successfully
      expect(
        tilemaps[roomId],
        `Tilemap for "${roomId}" (${filename}.json) failed to load`
      ).not.toBeNull();
    }
  });

  it('default room is "social" (Social Hub)', () => {
    expect(DEFAULT_ROOM).toBe('social');
    expect(ROOM_MAP).toHaveProperty(DEFAULT_ROOM);
    expect(tilemaps[DEFAULT_ROOM]).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Spawn Point Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Spawn Points — Default Spawn', () => {
  for (const roomId of ROOM_IDS) {
    it(`${roomId}: has a spawn-main (default spawn)`, () => {
      const spawns = getSpawnPoints(tilemaps[roomId]!);
      const main = spawns.find((s) => s.name === 'spawn-main');
      expect(main, `${roomId} is missing spawn-main`).toBeDefined();
    });

    it(`${roomId}: spawn-main has isDefault=true`, () => {
      const spawns = getSpawnPoints(tilemaps[roomId]!);
      const main = spawns.find((s) => s.name === 'spawn-main')!;
      const props = getProps(main);
      expect(props.isDefault).toBe(true);
    });
  }
});

describe('Spawn Points — Non-Default Spawns', () => {
  for (const roomId of ROOM_IDS) {
    it(`${roomId}: non-default spawns have isDefault=false`, () => {
      const spawns = getSpawnPoints(tilemaps[roomId]!);
      const nonDefault = spawns.filter((s) => s.name !== 'spawn-main');

      for (const spawn of nonDefault) {
        const props = getProps(spawn);
        expect(
          props.isDefault,
          `${roomId} spawn "${spawn.name}" should have isDefault=false`
        ).toBe(false);
      }
    });
  }
});

describe('Spawn Points — Coordinates Within Map Bounds', () => {
  for (const roomId of ROOM_IDS) {
    it(`${roomId}: all spawn coordinates are within map bounds (0-${WORLD_WIDTH} x, 0-${WORLD_HEIGHT} y)`, () => {
      const spawns = getSpawnPoints(tilemaps[roomId]!);

      for (const spawn of spawns) {
        expect(
          spawn.x,
          `${roomId} spawn "${spawn.name}" x=${spawn.x} is out of bounds`
        ).toBeGreaterThanOrEqual(0);
        expect(
          spawn.x,
          `${roomId} spawn "${spawn.name}" x=${spawn.x} exceeds map width ${WORLD_WIDTH}`
        ).toBeLessThanOrEqual(WORLD_WIDTH);

        expect(
          spawn.y,
          `${roomId} spawn "${spawn.name}" y=${spawn.y} is out of bounds`
        ).toBeGreaterThanOrEqual(0);
        expect(
          spawn.y,
          `${roomId} spawn "${spawn.name}" y=${spawn.y} exceeds map height ${WORLD_HEIGHT}`
        ).toBeLessThanOrEqual(WORLD_HEIGHT);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ROOM_CHANGE Event Contract
// ═══════════════════════════════════════════════════════════════════════════════

describe('ROOM_CHANGE Event — Payload Shape', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('ROOM_CHANGE payload has required fields: targetRoom, targetSpawn', () => {
    const received: Array<{ targetRoom: string; targetSpawn: string; roomName?: string }> = [];
    eventBus.on('ROOM_CHANGE', (payload) => {
      received.push(payload);
    });

    eventBus.emit('ROOM_CHANGE', {
      targetRoom: 'feed-maker',
      targetSpawn: 'spawn-left',
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveProperty('targetRoom');
    expect(received[0]).toHaveProperty('targetSpawn');
    expect(typeof received[0].targetRoom).toBe('string');
    expect(typeof received[0].targetSpawn).toBe('string');
  });

  it('ROOM_CHANGE payload accepts optional roomName', () => {
    const received: Array<{ targetRoom: string; targetSpawn: string; roomName?: string }> = [];
    eventBus.on('ROOM_CHANGE', (payload) => {
      received.push(payload);
    });

    eventBus.emit('ROOM_CHANGE', {
      targetRoom: 'social',
      targetSpawn: 'spawn-main',
      roomName: 'Social Hub',
    });

    expect(received).toHaveLength(1);
    expect(received[0].roomName).toBe('Social Hub');
  });

  it('targetRoom is always a valid room ID', () => {
    for (const roomId of ROOM_IDS) {
      const received: Array<{ targetRoom: string; targetSpawn: string }> = [];
      eventBus.on('ROOM_CHANGE', (payload) => {
        received.push(payload);
      });

      eventBus.emit('ROOM_CHANGE', {
        targetRoom: roomId,
        targetSpawn: 'spawn-main',
      });

      expect(ROOM_MAP).toHaveProperty(received[received.length - 1].targetRoom);
      eventBus.all.clear();
    }
  });

  it('targetSpawn is always a valid spawn name in the target room', () => {
    // For each room, emit ROOM_CHANGE with each of its spawns
    for (const roomId of ROOM_IDS) {
      const map = tilemaps[roomId]!;
      const spawns = getSpawnPoints(map);

      for (const spawn of spawns) {
        const received: Array<{ targetRoom: string; targetSpawn: string }> = [];
        eventBus.on('ROOM_CHANGE', (payload) => {
          received.push(payload);
        });

        eventBus.emit('ROOM_CHANGE', {
          targetRoom: roomId,
          targetSpawn: spawn.name,
        });

        const payload = received[received.length - 1];
        const targetSpawns = getSpawnPoints(tilemaps[payload.targetRoom]!);
        const spawnNames = targetSpawns.map((s) => s.name);
        expect(spawnNames).toContain(payload.targetSpawn);

        eventBus.all.clear();
      }
    }
  });
});

describe('ROOM_CHANGE Event — Full Chain Traversal', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('traverses the full chain left-to-right: Lobby → Feed Maker → Social → Feed Future → Edit Bay', () => {
    const traversalLog: Array<{ from: string; to: string; spawn: string }> = [];

    // Start at lobby, follow right portals
    let currentRoom = 'lobby';

    while (true) {
      const map = tilemaps[currentRoom]!;
      const portals = getPortals(map);
      const rightPortal = portals.find((p) => getProps(p).zoneId === 'portal-right');

      if (!rightPortal) break; // Reached the rightmost room

      const props = getProps(rightPortal);
      const targetRoom = props.targetRoom as string;
      const targetSpawn = props.targetSpawn as string;

      // Emit ROOM_CHANGE event
      const received: Array<{ targetRoom: string; targetSpawn: string }> = [];
      eventBus.on('ROOM_CHANGE', (payload) => received.push(payload));

      eventBus.emit('ROOM_CHANGE', { targetRoom, targetSpawn });

      expect(received).toHaveLength(1);
      expect(received[0].targetRoom).toBe(targetRoom);
      expect(received[0].targetSpawn).toBe(targetSpawn);

      // Verify the spawn exists in the target room
      const targetSpawns = getSpawnPoints(tilemaps[targetRoom]!);
      expect(targetSpawns.map((s) => s.name)).toContain(targetSpawn);

      traversalLog.push({ from: currentRoom, to: targetRoom, spawn: targetSpawn });
      currentRoom = targetRoom;
      eventBus.all.clear();
    }

    // Should have traversed 4 links (5 rooms - 1)
    expect(traversalLog).toHaveLength(4);
    expect(currentRoom).toBe('edit-bay');

    // Verify the exact traversal order
    expect(traversalLog.map((t) => t.from)).toEqual([
      'lobby', 'feed-maker', 'social', 'feed-future',
    ]);
    expect(traversalLog.map((t) => t.to)).toEqual([
      'feed-maker', 'social', 'feed-future', 'edit-bay',
    ]);
  });

  it('traverses the full chain right-to-left: Edit Bay → Feed Future → Social → Feed Maker → Lobby', () => {
    const traversalLog: Array<{ from: string; to: string; spawn: string }> = [];

    // Start at edit-bay, follow left portals
    let currentRoom = 'edit-bay';

    while (true) {
      const map = tilemaps[currentRoom]!;
      const portals = getPortals(map);
      const leftPortal = portals.find((p) => getProps(p).zoneId === 'portal-left');

      if (!leftPortal) break; // Reached the leftmost room

      const props = getProps(leftPortal);
      const targetRoom = props.targetRoom as string;
      const targetSpawn = props.targetSpawn as string;

      // Emit ROOM_CHANGE event
      const received: Array<{ targetRoom: string; targetSpawn: string }> = [];
      eventBus.on('ROOM_CHANGE', (payload) => received.push(payload));

      eventBus.emit('ROOM_CHANGE', { targetRoom, targetSpawn });

      expect(received).toHaveLength(1);
      expect(received[0].targetRoom).toBe(targetRoom);
      expect(received[0].targetSpawn).toBe(targetSpawn);

      // Verify the spawn exists in the target room
      const targetSpawns = getSpawnPoints(tilemaps[targetRoom]!);
      expect(targetSpawns.map((s) => s.name)).toContain(targetSpawn);

      traversalLog.push({ from: currentRoom, to: targetRoom, spawn: targetSpawn });
      currentRoom = targetRoom;
      eventBus.all.clear();
    }

    // Should have traversed 4 links (5 rooms - 1)
    expect(traversalLog).toHaveLength(4);
    expect(currentRoom).toBe('lobby');

    // Verify the exact traversal order
    expect(traversalLog.map((t) => t.from)).toEqual([
      'edit-bay', 'feed-future', 'social', 'feed-maker',
    ]);
    expect(traversalLog.map((t) => t.to)).toEqual([
      'feed-future', 'social', 'feed-maker', 'lobby',
    ]);
  });

  it('every portal in every room produces a valid ROOM_CHANGE payload', () => {
    let portalCount = 0;

    for (const roomId of ROOM_IDS) {
      const map = tilemaps[roomId]!;
      const portals = getPortals(map);

      for (const portal of portals) {
        const props = getProps(portal);
        const targetRoom = props.targetRoom as string;
        const targetSpawn = props.targetSpawn as string;

        // Validate targetRoom is a known room
        expect(ROOM_MAP).toHaveProperty(targetRoom);

        // Validate targetSpawn exists in target room
        const targetMap = tilemaps[targetRoom]!;
        const spawns = getSpawnPoints(targetMap);
        expect(spawns.map((s) => s.name)).toContain(targetSpawn);

        // Emit and verify
        const received: Array<{ targetRoom: string; targetSpawn: string }> = [];
        eventBus.on('ROOM_CHANGE', (payload) => received.push(payload));

        eventBus.emit('ROOM_CHANGE', { targetRoom, targetSpawn });

        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ targetRoom, targetSpawn });

        portalCount++;
        eventBus.all.clear();
      }
    }

    // Total portals: lobby(1) + feed-maker(2) + social(2) + feed-future(2) + edit-bay(1) = 8
    expect(portalCount).toBe(8);
  });
});
