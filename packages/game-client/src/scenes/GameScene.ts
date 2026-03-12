import Phaser from 'phaser';
import eventBus from '../EventBus';
import type { Direction, ZoneType, AvatarConfig } from '@flipfeeds/shared';
import { getAvatarFrames, DEFAULT_AVATAR } from '@flipfeeds/shared';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { ZONE_COLORS, getZonePromptText, getIdleDirection } from '../utils';

// Movement speed in pixels per second
const PLAYER_SPEED = 168;
const DIAGONAL_FACTOR = 1 / Math.SQRT2; // ~0.707

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

  // Zone proximity tracking
  private proximityTimer = 0;
  private readonly PROXIMITY_INTERVAL = 100; // 10Hz

  // Debug overlay
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugVisible = false;

  // Zone interaction cues
  private zoneHighlights: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private zonePrompts: Map<string, Phaser.GameObjects.Text> = new Map();
  private pulseTimer = 0;

  // Interaction key
  private interactKey!: Phaser.Input.Keyboard.Key;
  private chatKey!: Phaser.Input.Keyboard.Key;

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

    if (this.inputPaused) {
      this.playerBody.setVelocity(0, 0);
      return;
    }

    this.handleMovement();

    // Phase 3: Update remote player interpolation
    this.networkManager.updateRemotePlayers();

    // Phase 4: Zone exit detection
    this.checkZoneExits();

    // Phase 4: Proximity events (throttled to 10Hz)
    this.updateProximity(delta);

    // Phase 4: Interaction key checks
    this.checkInteractions();

    // Phase 5: Zone interaction cues
    this.updateZoneCues(delta);
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

    // Animated player sprite from Oryx creatures spritesheet
    this.player = this.add.sprite(spawnX, spawnY, 'creatures', 416);
    this.player.setDepth(3);

    // Create walk animations
    this.createPlayerAnimations();

    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    // Physics body: 16×16 centered at bottom of 24×24 sprite
    this.playerBody.setSize(16, 16);
    this.playerBody.setOffset(4, 8);

    // Add collision with walls
    if (this.wallsLayer) {
      this.physics.add.collider(this.player, this.wallsLayer);
    }

    console.log(`[GameScene] Player spawned at (${spawnX}, ${spawnY})`);

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

    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.chatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    // F9 debug toggle
    const f9Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    f9Key.on('down', () => {
      this.debugVisible = !this.debugVisible;
      this.renderDebugZones();
      eventBus.emit('DEBUG_ZONES_TOGGLE');
    });
  }

  private handleMovement(): void {
    let vx = 0;
    let vy = 0;

    const up = this.cursors.up.isDown || this.wasd.W.isDown || this.mobileDirection.up;
    const down = this.cursors.down.isDown || this.wasd.S.isDown || this.mobileDirection.down;
    const left = this.cursors.left.isDown || this.wasd.A.isDown || this.mobileDirection.left;
    const right = this.cursors.right.isDown || this.wasd.D.isDown || this.mobileDirection.right;

    if (up) vy -= 1;
    if (down) vy += 1;
    if (left) vx -= 1;
    if (right) vx += 1;

    // Determine direction
    let direction: Direction = 'idle';
    if (vx === 0 && vy === 0) {
      direction = 'idle';
    } else if (vx === 0 && vy < 0) {
      direction = 'up';
    } else if (vx === 0 && vy > 0) {
      direction = 'down';
    } else if (vx < 0 && vy === 0) {
      direction = 'left';
    } else if (vx > 0 && vy === 0) {
      direction = 'right';
    } else if (vx < 0 && vy < 0) {
      direction = 'up-left';
    } else if (vx > 0 && vy < 0) {
      direction = 'up-right';
    } else if (vx < 0 && vy > 0) {
      direction = 'down-left';
    } else if (vx > 0 && vy > 0) {
      direction = 'down-right';
    }

    // Normalize diagonal speed
    const isDiagonal = vx !== 0 && vy !== 0;
    const speed = PLAYER_SPEED;

    if (isDiagonal) {
      vx *= speed * DIAGONAL_FACTOR;
      vy *= speed * DIAGONAL_FACTOR;
    } else {
      vx *= speed;
      vy *= speed;
    }

    this.playerBody.setVelocity(vx, vy);
    this.currentDirection = direction;

    // Play walk/idle animations
    this.updatePlayerAnimation(direction);

    // Emit position to EventBus for React UI and server sync
    if (direction !== 'idle') {
      eventBus.emit('PLAYER_POSITION', {
        x: this.player.x,
        y: this.player.y,
        direction: this.currentDirection,
      });

      // Send to server via EventBus → useWebSocket
      eventBus.emit('SEND_POSITION', {
        x: this.player.x,
        y: this.player.y,
        direction: this.currentDirection,
      });
    }
  }

  private updatePlayerAnimation(direction: Direction): void {
    // TEMPORARY: Always show idle-down frame for avatar verification.
    // Makes it easy to confirm avatar selection works across players.
    // TODO: Re-enable directional animations once avatar system is solid.
    this.player.setFlipX(false);
    const frames = getAvatarFrames(this.avatarConfig);
    this.player.setFrame(frames.idleDown);

    // Still track facing direction for future re-enable
    switch (direction) {
      case 'down': case 'down-left': case 'down-right':
        this.lastFacingDirection = direction === 'down-right' ? 'right' : direction === 'down-left' ? 'left' : 'down';
        break;
      case 'up': case 'up-left': case 'up-right':
        this.lastFacingDirection = direction === 'up-right' ? 'right' : direction === 'up-left' ? 'left' : 'up';
        break;
      case 'left':
        this.lastFacingDirection = 'left';
        break;
      case 'right':
        this.lastFacingDirection = 'right';
        break;
    }
  }

  // ==========================================
  // ZONE INTERACTION CUES (Phase 5)
  // ==========================================

  private updateZoneCues(delta: number): void {
    this.pulseTimer += delta * 0.003; // slow pulse

    for (const { body: zone, data } of this.zones) {
      const dx = this.player.x - zone.x;
      const dy = this.player.y - zone.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = data.radius * 24;
      const isInProximity = distance <= maxDistance;
      const isInZone = this.activeZones.has(data.zoneId);

      // --- Highlight ring ---
      let highlight = this.zoneHighlights.get(data.zoneId);
      if (isInProximity) {
        if (!highlight) {
          highlight = this.add.graphics();
          highlight.setDepth(2.5); // between decorations and player
          this.zoneHighlights.set(data.zoneId, highlight);
        }

        highlight.clear();
        const normalizedDist = Math.min(1, distance / maxDistance);
        const alpha = (1 - normalizedDist) * 0.3 * (0.7 + 0.3 * Math.sin(this.pulseTimer));

        const color = ZONE_COLORS[data.zoneType] || 0xffffff;

        const halfW = zone.width / 2;
        const halfH = zone.height / 2;
        highlight.lineStyle(2, color, alpha);
        highlight.strokeRect(zone.x - halfW, zone.y - halfH, zone.width, zone.height);
        highlight.fillStyle(color, alpha * 0.3);
        highlight.fillRect(zone.x - halfW, zone.y - halfH, zone.width, zone.height);
      } else if (highlight) {
        highlight.destroy();
        this.zoneHighlights.delete(data.zoneId);
      }

      // --- "Press E" / "Press T" prompt ---
      let prompt = this.zonePrompts.get(data.zoneId);
      if (isInZone) {
        const promptText = getZonePromptText(data.zoneType);

        if (promptText) {
          if (!prompt) {
            prompt = this.add.text(zone.x, zone.y - zone.height / 2 - 12, promptText, {
              fontSize: '10px',
              color: '#ffffff',
              fontFamily: 'monospace',
              backgroundColor: '#000000cc',
              padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(5);
            this.zonePrompts.set(data.zoneId, prompt);
          }
          // Pulse the prompt alpha
          const promptAlpha = 0.7 + 0.3 * Math.sin(this.pulseTimer * 2);
          prompt.setAlpha(promptAlpha);
          prompt.setPosition(zone.x, zone.y - zone.height / 2 - 12);
        }
      } else if (prompt) {
        prompt.destroy();
        this.zonePrompts.delete(data.zoneId);
      }
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
      // Disable Phaser's keyboard plugin so keystrokes pass through to DOM (chat input, etc.)
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
      }
      // Stop any current movement
      this.playerBody?.setVelocity(0, 0);
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

  private updateProximity(delta: number): void {
    this.proximityTimer += delta;
    if (this.proximityTimer < this.PROXIMITY_INTERVAL) return;
    this.proximityTimer = 0;

    const camera = this.cameras.main;

    for (const { body: zone, data } of this.zones) {
      // Calculate distance from player center to zone center
      const zoneCenterX = zone.x;
      const zoneCenterY = zone.y;
      const dx = this.player.x - zoneCenterX;
      const dy = this.player.y - zoneCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Max distance is radius in tiles × 16px per tile
      const maxDistance = data.radius * 24;

      if (distance <= maxDistance) {
        const normalizedDistance = Math.min(1, distance / maxDistance);
        const zoneScreenX = (zoneCenterX - camera.scrollX) * camera.zoom;
        const zoneScreenY = (zoneCenterY - camera.scrollY) * camera.zoom;

        eventBus.emit('ZONE_PROXIMITY', {
          zoneId: data.zoneId,
          distance,
          maxDistance,
          normalizedDistance,
          zoneScreenPos: { x: zoneScreenX, y: zoneScreenY },
        });
      }
    }
  }

  private checkInteractions(): void {
    if (this.inputPaused) return;

    // E key — interact with kiosk/info/video zones
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      for (const zoneId of this.activeZones) {
        const zoneEntry = this.zones.find(z => z.data.zoneId === zoneId);
        if (zoneEntry && (zoneEntry.data.zoneType === 'kiosk' || zoneEntry.data.zoneType === 'info' || zoneEntry.data.zoneType === 'video')) {
          eventBus.emit('ZONE_INTERACT', {
            zoneType: zoneEntry.data.zoneType as 'kiosk' | 'info' | 'video',
            zoneId,
          });
          console.log(`[GameScene] Interact: ${zoneId} (${zoneEntry.data.zoneType})`);
          break; // Only interact with one zone at a time
        }
      }
    }

    // T key — open chat in chat zones
    if (Phaser.Input.Keyboard.JustDown(this.chatKey)) {
      for (const zoneId of this.activeZones) {
        const zoneEntry = this.zones.find(z => z.data.zoneId === zoneId);
        if (zoneEntry && zoneEntry.data.zoneType === 'chat') {
          eventBus.emit('CHAT_OPEN', { zoneId });
          console.log(`[GameScene] Chat open: ${zoneId}`);
          break;
        }
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
    this.zoneHighlights.forEach(g => g.destroy());
    this.zoneHighlights.clear();
    this.zonePrompts.forEach(t => t.destroy());
    this.zonePrompts.clear();
    this.fpsHistory = [];
    this.zones = [];
    this.activeZones.clear();
  }
}
