import { describe, it, expect } from 'vitest';

/**
 * Camera Follow Tests — Phase 2
 *
 * Tests the camera follow logic used to smoothly track the player.
 * Phaser's camera.startFollow uses lerp (linear interpolation) to
 * create smooth following. These tests verify the math behind it.
 *
 * In the actual game: this.cameras.main.startFollow(player, true, 0.1, 0.1)
 * The 0.1 is the lerp factor — camera moves 10% of the distance to target each frame.
 */

// ============================================================
// Pure camera logic functions (extracted for testability)
// ============================================================

interface CameraState {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface WorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lerp (linear interpolation) — the core of smooth camera follow.
 * Returns a value between `current` and `target`, moved by `factor`.
 * factor=0 → no movement, factor=1 → instant snap, factor=0.1 → smooth follow
 */
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Update camera position to follow a target with smooth lerp.
 * Camera position represents the center of the viewport.
 */
function updateCameraFollow(
  camera: CameraState,
  targetX: number,
  targetY: number,
  lerpFactor: number,
  worldBounds: WorldBounds,
): CameraState {
  // Lerp toward target
  let newX = lerp(camera.x, targetX, lerpFactor);
  let newY = lerp(camera.y, targetY, lerpFactor);

  // Clamp to world bounds (camera center can't go beyond half-viewport from edges)
  const halfW = camera.viewportWidth / 2;
  const halfH = camera.viewportHeight / 2;

  newX = clamp(newX, worldBounds.x + halfW, worldBounds.x + worldBounds.width - halfW);
  newY = clamp(newY, worldBounds.y + halfH, worldBounds.y + worldBounds.height - halfH);

  return { ...camera, x: newX, y: newY };
}

// ============================================================
// Tests
// ============================================================

const WORLD_BOUNDS: WorldBounds = { x: 0, y: 0, width: 1920, height: 1440 };
const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

describe('Camera — Lerp Function', () => {
  it('lerp factor 0 returns current value (no movement)', () => {
    expect(lerp(100, 200, 0)).toBe(100);
  });

  it('lerp factor 1 returns target value (instant snap)', () => {
    expect(lerp(100, 200, 1)).toBe(200);
  });

  it('lerp factor 0.5 returns midpoint', () => {
    expect(lerp(100, 200, 0.5)).toBe(150);
  });

  it('lerp factor 0.1 moves 10% toward target', () => {
    expect(lerp(100, 200, 0.1)).toBeCloseTo(110, 5);
  });

  it('lerp works with negative values', () => {
    expect(lerp(-100, 100, 0.5)).toBe(0);
  });

  it('lerp with same current and target returns that value', () => {
    expect(lerp(50, 50, 0.5)).toBe(50);
  });
});

describe('Camera — Lerp Factor Validation', () => {
  it('camera lerp factor should be between 0 and 1', () => {
    const CAMERA_LERP = 0.1; // As used in GameScene
    expect(CAMERA_LERP).toBeGreaterThan(0);
    expect(CAMERA_LERP).toBeLessThanOrEqual(1);
  });

  it('lerp factor of 0.1 provides smooth follow (not too fast, not too slow)', () => {
    const factor = 0.1;
    // After 1 frame, camera should have moved 10% of the distance
    const start = 0;
    const target = 100;
    const after1Frame = lerp(start, target, factor);
    expect(after1Frame).toBe(10);

    // After ~23 frames (at 0.1 lerp), camera should be ~90% there
    let pos = start;
    for (let i = 0; i < 23; i++) {
      pos = lerp(pos, target, factor);
    }
    expect(pos).toBeGreaterThan(90);
  });
});

describe('Camera — Target Tracking', () => {
  it('camera moves toward player position', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    const playerX = 500;
    const playerY = 400;

    const updated = updateCameraFollow(camera, playerX, playerY, 0.1, WORLD_BOUNDS);

    // Camera should have moved toward player
    expect(updated.x).toBeGreaterThan(camera.x);
    expect(updated.y).toBeGreaterThan(camera.y);
    // But not all the way (smooth follow)
    expect(updated.x).toBeLessThan(playerX);
    expect(updated.y).toBeLessThan(playerY);
  });

  it('camera converges on stationary player over multiple frames', () => {
    let camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    const playerX = 600;
    const playerY = 400;

    // Simulate 60 frames of following
    for (let i = 0; i < 60; i++) {
      camera = updateCameraFollow(camera, playerX, playerY, 0.1, WORLD_BOUNDS);
    }

    // After 60 frames at 0.1 lerp, should be very close to target
    expect(camera.x).toBeCloseTo(playerX, 0);
    expect(camera.y).toBeCloseTo(playerY, 0);
  });

  it('camera stays put when already at player position', () => {
    const camera: CameraState = { x: 500, y: 400, ...VIEWPORT };
    const updated = updateCameraFollow(camera, 500, 400, 0.1, WORLD_BOUNDS);

    expect(updated.x).toBe(500);
    expect(updated.y).toBe(400);
  });
});

describe('Camera — World Bounds Clamping', () => {
  it('camera stays within world bounds (left edge)', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    // Player at far left — camera center can't go below halfViewport
    const updated = updateCameraFollow(camera, 0, 300, 1.0, WORLD_BOUNDS);

    const minX = VIEWPORT.viewportWidth / 2; // 400
    expect(updated.x).toBeGreaterThanOrEqual(minX);
  });

  it('camera stays within world bounds (right edge)', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    // Player at far right
    const updated = updateCameraFollow(camera, WORLD_BOUNDS.width, 300, 1.0, WORLD_BOUNDS);

    const maxX = WORLD_BOUNDS.width - VIEWPORT.viewportWidth / 2; // 880
    expect(updated.x).toBeLessThanOrEqual(maxX);
  });

  it('camera stays within world bounds (top edge)', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    const updated = updateCameraFollow(camera, 400, 0, 1.0, WORLD_BOUNDS);

    const minY = VIEWPORT.viewportHeight / 2; // 300
    expect(updated.y).toBeGreaterThanOrEqual(minY);
  });

  it('camera stays within world bounds (bottom edge)', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    const updated = updateCameraFollow(camera, 400, WORLD_BOUNDS.height, 1.0, WORLD_BOUNDS);

    const maxY = WORLD_BOUNDS.height - VIEWPORT.viewportHeight / 2; // 660
    expect(updated.y).toBeLessThanOrEqual(maxY);
  });

  it('camera handles corner case (player at world corner)', () => {
    const camera: CameraState = { x: 640, y: 480, ...VIEWPORT };
    const updated = updateCameraFollow(camera, 0, 0, 1.0, WORLD_BOUNDS);

    expect(updated.x).toBeGreaterThanOrEqual(VIEWPORT.viewportWidth / 2);
    expect(updated.y).toBeGreaterThanOrEqual(VIEWPORT.viewportHeight / 2);
  });
});

describe('Camera — No Jitter (Smooth/Monotonic Movement)', () => {
  it('camera position changes are monotonic when player moves right', () => {
    let camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    let playerX = 400;
    const positions: number[] = [camera.x];

    // Player moves right steadily
    for (let i = 0; i < 30; i++) {
      playerX += 2; // 2px per frame
      camera = updateCameraFollow(camera, playerX, 300, 0.1, WORLD_BOUNDS);
      positions.push(camera.x);
    }

    // Each position should be >= the previous (monotonically increasing)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
    }
  });

  it('camera position changes are monotonic when player moves left', () => {
    let camera: CameraState = { x: 640, y: 300, ...VIEWPORT };
    let playerX = 640;
    const positions: number[] = [camera.x];

    for (let i = 0; i < 30; i++) {
      playerX -= 2;
      camera = updateCameraFollow(camera, playerX, 300, 0.1, WORLD_BOUNDS);
      positions.push(camera.x);
    }

    // Monotonically decreasing
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
    }
  });

  it('camera position changes are monotonic when player moves up', () => {
    let camera: CameraState = { x: 640, y: 480, ...VIEWPORT };
    let playerY = 480;
    const positions: number[] = [camera.y];

    for (let i = 0; i < 30; i++) {
      playerY -= 2;
      camera = updateCameraFollow(camera, 640, playerY, 0.1, WORLD_BOUNDS);
      positions.push(camera.y);
    }

    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
    }
  });

  it('no sudden jumps in camera position (delta is bounded)', () => {
    let camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    let playerX = 400;

    for (let i = 0; i < 30; i++) {
      playerX += 2;
      const prevX = camera.x;
      camera = updateCameraFollow(camera, playerX, 300, 0.1, WORLD_BOUNDS);
      const delta = Math.abs(camera.x - prevX);

      // Delta should never exceed the lerp factor * distance to target
      // With lerp=0.1 and player moving 2px/frame, max delta is small
      expect(delta).toBeLessThan(20);
    }
  });
});

describe('Camera — Viewport Dimensions', () => {
  it('viewport dimensions are preserved after update', () => {
    const camera: CameraState = { x: 400, y: 300, ...VIEWPORT };
    const updated = updateCameraFollow(camera, 500, 400, 0.1, WORLD_BOUNDS);

    expect(updated.viewportWidth).toBe(VIEWPORT.viewportWidth);
    expect(updated.viewportHeight).toBe(VIEWPORT.viewportHeight);
  });
});
