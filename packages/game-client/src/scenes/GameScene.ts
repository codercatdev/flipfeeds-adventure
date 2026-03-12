import Phaser from 'phaser';
import eventBus from '../EventBus';
import type { Direction, ZoneType, AvatarConfig } from '@flipfeeds/shared';
import { getAvatarFrames, DEFAULT_AVATAR } from '@flipfeeds/shared';
import { NetworkManager } from '../multiplayer/NetworkManager';

// Grid movement constants
const TILE_SIZE = 24;
const MOVE_DURATION = 143; // ms per tile (7 tiles/sec)
const BUMP_DISTANCE = 6; // px for bump animation
const BUMP_DURATION = 100; // ms for bump bounce
const MARKER_TILE_IDS = new Set([117]); // red marker tiles
const BUMP_COOLDOWN = 1000; // ms cooldown per zone after interaction

export class GameScene extends Phaser.Scene {
  // Player
  private player!: Phaser.GameObjects.Sprite;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private currentDirection: Direction = 'idle';
  private avatarConfig: AvatarConfig = DEFAULT_AVATAR;
  private lastFacingDirection: 'down' | 'up' | 'left' | 'right' = 'down';

  // Multiplayer (Phase 3)
  private networkManager!: NetworkManager;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private inputPaused = false;
  private mobileDirection = { up: false, down: false, left: false, right: false };

  // Map
  private map!: Phaser.Tilemaps.Tilemap;
  private wallsLayer!: Phaser.Tilemaps.TilemapLayer;

  // Interaction zones (prep for Phase 4)
  private zones: {
    body: Phaser.GameObjects.Zone;
    data: { zoneType: string; zoneId: string; radius: number };
  }[] = [];
  private activeZones: Set<string> = new Set();

  // Grid movement state
  private isMoving = false;
  private moveQueue: Direction | null = null;
  private markersLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private bumpCooldowns: Map<string, number> = new Map();

  // Debug overlay
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugVisible = false;

  // FPS tracking
  private fpsHistory: number[] = [];
  private fpsTimer = 0;
  private readonly FPS_WINDOW = 5;
  private readonly FPS_EMIT_INTERVAL = 1000;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // === Check for initial avatar config (passed via scene data or EventBus) ===
    const initData = this.scene.settings.data as { avatarConfig?: AvatarConfig } | undefined;
    if (initData?.avatarConfig) {
      this.avatarConfig = initData.avatarConfig;
    }

    // === Build the world ===
    this.createTilemap();

    // === Create the player ===
    this.createPlayer();

    // === Setup input ===
    this.setupInput();

    // === Setup camera ===
    this.setupCamera();

    // === Parse interaction zones (prep for Phase 4) ===
    this.parseInteractionZones();

    // === Event bridge ===
    this.setupEventBridge();

    // === Multiplayer (Phase 3) ===
    this.networkManager = new NetworkManager(this);

    // === Signal ready ===
    // Emit via microtask so create() fully returns before listeners fire.
    // Fixes race: page.tsx re-emits AVATAR_SELECTED on GAME_READY,
    // but this.scene isn't fully initialized until create() returns.
    queueMicrotask(() => {
      eventBus.emit('GAME_READY');
      console.log('[GameScene] Created — GAME_READY emitted');
    });
  }

  update(_time: number, delta: number): void {
    this.trackFPS(delta);
    if (this.inputPaused) return; // no velocity to zero — player is already on a tile
    this.handleMovement();
    this.networkManager.updateRemotePlayers();
    this.checkZoneExits();
  }

  // ==========================================
  // TILEMAP
  // ==========================================

  private createTilemap(): void {
    this.map = this.make.tilemap({ key: 'conference-map' });
    const tileset = this.map.addTilesetImage(
      'oryx_16bit_scifi_world',
      'oryx_16bit_scifi_world',
    );

    if (!tileset) {
      console.error('[GameScene] Failed to load tileset!');
      return;
    }

    // Create layers in render order (depth)
    const groundLayer = this.map.createLayer('Ground', tileset, 0, 0);
    if (groundLayer) groundLayer.setDepth(0);

    const wallsLayer = this.map.createLayer('Walls', tileset, 0, 0);
    if (wallsLayer) {
      wallsLayer.setDepth(1);
      // Every non-empty tile on Walls layer is a collider
      wallsLayer.setCollisionByExclusion([-1, 0]);
      this.wallsLayer = wallsLayer;
    }

    // Markers layer (red interaction markers — may not exist yet in tilemap)
    const markersLayer = this.map.createLayer('Markers', tileset, 0, 0);
    if (markersLayer) {
      markersLayer.setDepth(1.5);
      markersLayer.setCollisionByExclusion([-1, 0]);
      this.markersLayer = markersLayer;
      console.log(`[GameScene] Markers layer loaded: ${markersLayer.layer.data.flat().filter((t: { index: number }) => t.index > 0).length} non-empty tiles`);
    }

    const decorLayer = this.map.createLayer('Decorations', tileset, 0, 0);
    if (decorLayer) decorLayer.setDepth(2);

    // Player will be at depth 3

    const aboveLayer = this.map.createLayer('AbovePlayer', tileset, 0, 0);
    if (aboveLayer) {
      aboveLayer.setDepth(4);
      aboveLayer.setAlpha(0.5); // Semi-transparent for depth illusion
    }

    // Set world bounds to match map size
    const worldWidth = this.map.widthInPixels;
    const worldHeight = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    console.log(
      `[GameScene] Tilemap loaded: ${this.map.width}x${this.map.height} tiles, ${worldWidth}x${worldHeight}px`,
    );
  }

  // ==========================================
  // PLAYER
  // ==========================================

  private createPlayer(): void {
    // Get spawn point from tilemap
    const spawnLayer = this.map.getObjectLayer('SpawnPoints');
    let spawnX = 640; // default
    let spawnY = 672; // default

    if (spawnLayer) {
      const spawnPoint = spawnLayer.objects.find(
        (obj) => obj.name === 'spawn-main',
      );
      if (spawnPoint) {
        spawnX = spawnPoint.x ?? spawnX;
        spawnY = spawnPoint.y ?? spawnY;
      }
    }

    // Snap spawn position to tile grid
    spawnX = Math.floor(spawnX / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    spawnY = Math.floor(spawnY / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

    // Animated player sprite from Oryx creatures spritesheet
    this.player = this.add.sprite(spawnX, spawnY, 'creatures', 416);
    this.player.setDepth(3);

    // Create walk animations
    this.createPlayerAnimations();

    // Keep physics body for zone overlap detection (no velocity/colliders — grid movement is tween-based)
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    // Physics body: 16×16 centered at bottom of 24×24 sprite
    this.playerBody.setSize(16, 16);
    this.playerBody.setOffset(4, 8);

    console.log(`[GameScene] Player spawned at (${spawnX}, ${spawnY}) [grid-snapped]`);

    // Emit initial position for React UI / E2E tests
    eventBus.emit('PLAYER_POSITION', {
      x: spawnX,
      y: spawnY,
      direction: 'idle' as Direction,
    });
  }

  private createPlayerAnimations(): void {
    this.buildAnimationsForAvatar(this.avatarConfig);
    console.log('[GameScene] Player animations created');
  }

  /** Build or rebuild walk/idle animations for a given avatar config. */
  private buildAnimationsForAvatar(config: AvatarConfig): void {
    // Guard: scene may be shutting down or texture not loaded yet (e.g. remount race)
    if (!this.textures?.exists('creatures')) return;

    const frames = getAvatarFrames(config);

    // Remove existing animations if rebuilding (avatar change)
    ['walk-down', 'walk-up', 'walk-left', 'idle-down', 'idle-up', 'idle-left'].forEach(key => {
      if (this.anims.exists(key)) this.anims.remove(key);
    });

    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('creatures', { frames: frames.walkDown }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('creatures', { frames: frames.walkUp }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('creatures', { frames: frames.walkLeft }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'idle-down',
      frames: [{ key: 'creatures', frame: frames.idleDown }],
      frameRate: 1,
    });

    this.anims.create({
      key: 'idle-up',
      frames: [{ key: 'creatures', frame: frames.idleUp }],
      frameRate: 1,
    });

    this.anims.create({
      key: 'idle-left',
      frames: [{ key: 'creatures', frame: frames.idleLeft }],
      frameRate: 1,
    });

    // Update the player's current frame to match new avatar (player may be gone if scene shutting down)
    if (this.player) this.player.setFrame(frames.idleDown);
  }

  // ==========================================
  // INPUT
  // ==========================================

  private setupInput(): void {
    if (!this.input.keyboard) {
      console.error('[GameScene] Keyboard input not available!');
      return;
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // F9 debug toggle
    const f9Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    f9Key.on('down', () => {
      this.debugVisible = !this.debugVisible;
      this.renderDebugZones();
      eventBus.emit('DEBUG_ZONES_TOGGLE');
    });
  }

  // ==========================================
  // GRID MOVEMENT
  // ==========================================

  private handleMovement(): void {
    const up = this.cursors.up.isDown || this.wasd.W.isDown || this.mobileDirection.up;
    const down = this.cursors.down.isDown || this.wasd.S.isDown || this.mobileDirection.down;
    const left = this.cursors.left.isDown || this.wasd.A.isDown || this.mobileDirection.left;
    const right = this.cursors.right.isDown || this.wasd.D.isDown || this.mobileDirection.right;

    // 4-way only: priority order down > up > right > left (last pressed wins via key order)
    let direction: Direction = 'idle';
    if (down) direction = 'down';
    else if (up) direction = 'up';
    else if (right) direction = 'right';
    else if (left) direction = 'left';

    if (direction === 'idle') {
      this.moveQueue = null;
      return;
    }

    if (this.isMoving) {
      // Queue direction for auto-chain when current tween completes
      this.moveQueue = direction;
      return;
    }

    this.tryMove(direction);
  }

  private tryMove(direction: Direction): void {
    // Current tile coords from player position
    const currentTileX = Math.floor(this.player.x / TILE_SIZE);
    const currentTileY = Math.floor(this.player.y / TILE_SIZE);

    // Target tile based on direction
    let targetTileX = currentTileX;
    let targetTileY = currentTileY;
    switch (direction) {
      case 'up': targetTileY -= 1; break;
      case 'down': targetTileY += 1; break;
      case 'left': targetTileX -= 1; break;
      case 'right': targetTileX += 1; break;
    }

    // Bounds check
    if (targetTileX < 0 || targetTileX >= this.map.width ||
        targetTileY < 0 || targetTileY >= this.map.height) {
      return; // Out of bounds — hard stop
    }

    // Check walls layer for collision tile at target
    if (this.wallsLayer) {
      const wallTile = this.wallsLayer.getTileAt(targetTileX, targetTileY);
      if (wallTile && wallTile.index > 0) {
        console.log(`[GameScene] Wall block at (${targetTileX},${targetTileY}): tile=${wallTile.index}`);
        return; // Wall — hard stop
      }
    }

    // Check markers layer for collision tile at target
    if (this.markersLayer) {
      const markerTile = this.markersLayer.getTileAt(targetTileX, targetTileY);
      console.log(`[GameScene] Marker check at (${targetTileX},${targetTileY}): tile=${markerTile?.index ?? 'none'}, isMarker=${markerTile ? MARKER_TILE_IDS.has(markerTile.index) : false}`);
      if (markerTile && MARKER_TILE_IDS.has(markerTile.index)) {
        this.handleBump(direction, targetTileX, targetTileY);
        return; // Marker — bump interaction
      }
    } else {
      console.warn('[GameScene] No markersLayer loaded!');
    }

    // Clear path — start move tween
    const targetX = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = targetTileY * TILE_SIZE + TILE_SIZE / 2;
    this.startMoveTween(targetX, targetY, direction);
  }

  private startMoveTween(targetX: number, targetY: number, direction: Direction): void {
    this.isMoving = true;
    this.currentDirection = direction;
    this.updatePlayerAnimation(direction);

    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: MOVE_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;

        // Emit position on tile arrival (reduces network traffic to ~7/sec)
        eventBus.emit('PLAYER_POSITION', {
          x: this.player.x,
          y: this.player.y,
          direction,
        });
        eventBus.emit('SEND_POSITION', {
          x: this.player.x,
          y: this.player.y,
          direction,
        });

        // Auto-chain: if key still held, continue moving
        if (this.moveQueue) {
          const nextDir = this.moveQueue;
          this.moveQueue = null;
          this.tryMove(nextDir);
        } else {
          // Check if keys are still held for auto-chain
          this.handleMovement();
        }
      },
    });
  }

  private handleBump(direction: Direction, markerTileX: number, markerTileY: number): void {
    if (this.isMoving) return; // Don't bump while already moving

    // Calculate bump offset (6px in the direction)
    let bumpDx = 0;
    let bumpDy = 0;
    switch (direction) {
      case 'up': bumpDy = -BUMP_DISTANCE; break;
      case 'down': bumpDy = BUMP_DISTANCE; break;
      case 'left': bumpDx = -BUMP_DISTANCE; break;
      case 'right': bumpDx = BUMP_DISTANCE; break;
    }

    const startX = this.player.x;
    const startY = this.player.y;

    this.isMoving = true;
    this.currentDirection = direction;
    this.updatePlayerAnimation(direction);

    // Bump tween: move 6px toward target, then bounce back
    this.tweens.add({
      targets: this.player,
      x: startX + bumpDx,
      y: startY + bumpDy,
      duration: BUMP_DURATION / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        // Snap back to exact start position
        this.player.x = startX;
        this.player.y = startY;
        this.isMoving = false;
      },
    });

    // Look up zone: convert marker tile to world coords, check against zone rectangles
    const markerWorldX = markerTileX * TILE_SIZE + TILE_SIZE / 2;
    const markerWorldY = markerTileY * TILE_SIZE + TILE_SIZE / 2;

    for (const { body: zone, data } of this.zones) {
      const halfW = zone.width / 2;
      const halfH = zone.height / 2;
      const zoneLeft = zone.x - halfW;
      const zoneRight = zone.x + halfW;
      const zoneTop = zone.y - halfH;
      const zoneBottom = zone.y + halfH;

      if (markerWorldX >= zoneLeft && markerWorldX <= zoneRight &&
          markerWorldY >= zoneTop && markerWorldY <= zoneBottom) {
        // Found the zone — check cooldown
        const now = Date.now();
        const lastBump = this.bumpCooldowns.get(data.zoneId) ?? 0;
        if (now - lastBump < BUMP_COOLDOWN) continue; // On cooldown

        this.bumpCooldowns.set(data.zoneId, now);

        if (data.zoneType === 'chat' || data.zoneType === 'webrtc') {
          eventBus.emit('CHAT_OPEN', { zoneId: data.zoneId });
          console.log(`[GameScene] Bump → CHAT_OPEN: ${data.zoneId}`);
        } else if (data.zoneType === 'kiosk' || data.zoneType === 'info' || data.zoneType === 'video') {
          eventBus.emit('ZONE_INTERACT', {
            zoneType: data.zoneType as 'kiosk' | 'info' | 'video',
            zoneId: data.zoneId,
          });
          console.log(`[GameScene] Bump → ZONE_INTERACT: ${data.zoneId} (${data.zoneType})`);
        }
        break; // Only interact with one zone per bump
      }
    }
  }

  private snapToGrid(): void {
    if (!this.player) return;
    const tileX = Math.round((this.player.x - TILE_SIZE / 2) / TILE_SIZE);
    const tileY = Math.round((this.player.y - TILE_SIZE / 2) / TILE_SIZE);
    this.player.x = tileX * TILE_SIZE + TILE_SIZE / 2;
    this.player.y = tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  private updatePlayerAnimation(direction: Direction): void {
    // TEMPORARY: Always show idle-down frame for avatar verification.
    // TODO: Re-enable directional animations once avatar system is solid.
    this.player.setFlipX(false);
    const frames = getAvatarFrames(this.avatarConfig);
    this.player.setFrame(frames.idleDown);

    // Track facing direction for 4-way grid movement
    if (direction === 'up' || direction === 'down' || direction === 'left' || direction === 'right') {
      this.lastFacingDirection = direction;
    }
  }

  // ==========================================
  // CAMERA
  // ==========================================

  private setupCamera(): void {
    const camera = this.cameras.main;

    // Set camera bounds to match world
    camera.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels,
    );

    // Follow player with smooth lerp
    camera.startFollow(this.player, true, 0.1, 0.1);

    // Default zoom — 2x for crisp pixel art
    camera.setZoom(1.5);

    console.log(
      `[GameScene] Camera following player, zoom=2x, bounds=${this.map.widthInPixels}x${this.map.heightInPixels}`,
    );
  }

  // ==========================================
  // INTERACTION ZONES (Phase 4 prep)
  // ==========================================

  private parseInteractionZones(): void {
    const zoneLayer = this.map.getObjectLayer('InteractionZones');
    if (!zoneLayer) {
      console.warn('[GameScene] No InteractionZones layer found');
      return;
    }

    for (const obj of zoneLayer.objects) {
      const props: Record<string, unknown> = {};
      if (obj.properties) {
        for (const prop of obj.properties as Array<{
          name: string;
          value: unknown;
        }>) {
          props[prop.name] = prop.value;
        }
      }

      const zoneType = (props['zoneType'] || props['type']) as string | undefined;
      const zoneId = (props['zoneId'] || props['id']) as string | undefined;
      const radius = (props['radius'] as number) || 2;

      if (!zoneType || !zoneId) continue;

      // Create invisible zone with physics body
      const zone = this.add.zone(
        (obj.x ?? 0) + (obj.width ?? 0) / 2,
        (obj.y ?? 0) + (obj.height ?? 0) / 2,
        obj.width ?? 0,
        obj.height ?? 0,
      );
      this.physics.add.existing(zone, true); // static body

      const zoneData = { zoneType, zoneId, radius };
      this.zones.push({ body: zone, data: zoneData });

      // Capture zoneId for the closure
      const capturedZoneId = zoneId;
      const capturedZoneType = zoneType;

      // Set up overlap detection (Phase 4 will emit events)
      this.physics.add.overlap(this.player, zone, () => {
        if (!this.activeZones.has(capturedZoneId)) {
          this.activeZones.add(capturedZoneId);
          const camera = this.cameras.main;
          const screenX = (this.player.x - camera.scrollX) * camera.zoom;
          const screenY = (this.player.y - camera.scrollY) * camera.zoom;
          eventBus.emit('ZONE_ENTER', {
            zoneType: capturedZoneType as ZoneType,
            zoneId: capturedZoneId,
            playerScreenPos: { x: screenX, y: screenY },
          });
          console.log(`[GameScene] Entered zone: ${capturedZoneId} (${capturedZoneType})`);
        }
      });
    }

    console.log(`[GameScene] Parsed ${this.zones.length} interaction zones`);
  }

  // ==========================================
  // EVENT BRIDGE
  // ==========================================

  private setupEventBridge(): void {
    eventBus.on('AVATAR_SELECTED', (config: AvatarConfig) => {
      if (!this.scene || !this.scene.isActive()) return;
      this.avatarConfig = config;
      this.buildAnimationsForAvatar(config);
      // Explicitly set frame in case buildAnimationsForAvatar guard skipped it
      const frames = getAvatarFrames(config);
      if (this.player) this.player.setFrame(frames.idleDown);
      console.log('[GameScene] Avatar changed:', config);
    });

    eventBus.on('PAUSE_INPUT', () => {
      this.inputPaused = true;
      this.tweens.killTweensOf(this.player);
      this.isMoving = false;
      this.moveQueue = null;
      this.snapToGrid();
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
      }
      console.log('[GameScene] Input paused — keyboard released to DOM');
    });

    eventBus.on('RESUME_INPUT', () => {
      this.inputPaused = false;
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
        // Reset all key states to prevent stale isDown from firing
        this.input.keyboard.resetKeys();
      }
      console.log('[GameScene] Input resumed — keyboard recaptured');
    });

    // Mobile touch D-pad
    eventBus.on('MOBILE_DIRECTION', (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
      this.mobileDirection = dir;
    });

    // Multiplayer connection
    eventBus.on('CONNECT', () => {
      console.log('[GameScene] Connected to server');
    });

    this.events.on('shutdown', () => {
      eventBus.off('AVATAR_SELECTED');
      eventBus.off('PAUSE_INPUT');
      eventBus.off('RESUME_INPUT');
      eventBus.off('MOBILE_DIRECTION');
      eventBus.off('CONNECT');
      this.networkManager.destroy();
      console.log('[GameScene] Cleaned up event listeners');
    });
  }

  // ==========================================
  // ZONE EVENTS (Phase 4)
  // ==========================================

  private checkZoneExits(): void {
    for (const zoneId of this.activeZones) {
      const zoneEntry = this.zones.find(z => z.data.zoneId === zoneId);
      if (!zoneEntry) continue;

      // Check if player is still overlapping this zone
      const playerBody = this.playerBody;
      const zoneBody = zoneEntry.body.body as Phaser.Physics.Arcade.StaticBody;

      const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(
          playerBody.x, playerBody.y, playerBody.width, playerBody.height
        ),
        new Phaser.Geom.Rectangle(
          zoneBody.x, zoneBody.y, zoneBody.width, zoneBody.height
        )
      );

      if (!overlapping) {
        this.activeZones.delete(zoneId);
        eventBus.emit('ZONE_EXIT', {
          zoneType: zoneEntry.data.zoneType as ZoneType,
          zoneId,
        });
        console.log(`[GameScene] Exited zone: ${zoneId}`);
      }
    }
  }

  private renderDebugZones(): void {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }

    if (!this.debugVisible) return;

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    const colors: Record<string, number> = {
      chat: 0x00ff00,    // green
      kiosk: 0x0000ff,   // blue
      video: 0x9900ff,   // purple
      webrtc: 0xff8800,  // orange
      info: 0xffff00,    // yellow
    };

    for (const { body: zone, data } of this.zones) {
      const color = colors[data.zoneType] || 0xffffff;
      const halfW = (zone.width) / 2;
      const halfH = (zone.height) / 2;

      // Zone rectangle
      this.debugGraphics.fillStyle(color, 0.2);
      this.debugGraphics.fillRect(zone.x - halfW, zone.y - halfH, zone.width, zone.height);
      this.debugGraphics.lineStyle(2, color, 0.8);
      this.debugGraphics.strokeRect(zone.x - halfW, zone.y - halfH, zone.width, zone.height);

      // Radius circle
      this.debugGraphics.lineStyle(1, color, 0.3);
      this.debugGraphics.strokeCircle(zone.x, zone.y, data.radius * 16);

      // Label
      this.add.text(zone.x, zone.y - halfH - 10, `${data.zoneId} (${data.zoneType})`, {
        fontSize: '8px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(100);
    }
  }

  // ==========================================
  // FPS TELEMETRY
  // ==========================================

  private trackFPS(delta: number): void {
    const fps = 1000 / delta;
    this.fpsHistory.push(fps);

    const maxSamples = 60 * this.FPS_WINDOW;
    if (this.fpsHistory.length > maxSamples) {
      this.fpsHistory.shift();
    }

    this.fpsTimer += delta;
    if (this.fpsTimer >= this.FPS_EMIT_INTERVAL) {
      this.fpsTimer = 0;

      const current = Math.round(fps);
      const average = Math.round(
        this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length,
      );
      const min = Math.round(Math.min(...this.fpsHistory));
      const frameTime = parseFloat(delta.toFixed(2));

      eventBus.emit('TELEMETRY:FPS', { current, average, min, frameTime });
    }
  }

  destroy(): void {
    if (this.networkManager) this.networkManager.destroy();
    if (this.debugGraphics) this.debugGraphics.destroy();
    this.tweens.killTweensOf(this.player);
    this.isMoving = false;
    this.bumpCooldowns.clear();
    this.fpsHistory = [];
    this.zones = [];
    this.activeZones.clear();
  }
}
