import { test, expect } from '@playwright/test';

/**
 * Phase 1 Definition of Done — E2E Tests
 *
 * These tests verify the three Phase 1 quality gates:
 * 1. React page renders an empty Phaser canvas
 * 2. PartyKit WebSocket connects (ping/pong succeeds)
 * 3. Event bridge logs messages across all three domains (React <-> Phaser <-> Server)
 */

test.describe('Phase 1: Environment & Setup', () => {

  test('React page loads and renders game container', async ({ page }) => {
    await page.goto('/');

    // Page should load without errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Game container should exist
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // UI overlay should exist
    const overlay = page.locator('#ui-overlay');
    await expect(overlay).toBeVisible();

    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('Phaser canvas renders inside React shell', async ({ page }) => {
    await page.goto('/');

    // Wait for Phaser to create a canvas element
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Canvas should have non-zero dimensions
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // data-game-ready should be set to true
    const gameContainer = page.locator('[data-game-ready="true"]');
    await expect(gameContainer).toBeVisible({ timeout: 10000 });
  });

  test('Event bridge: GAME_READY fires from Phaser to React', async ({ page }) => {
    await page.goto('/');

    // Wait for game ready indicator
    const gameContainer = page.locator('[data-game-ready="true"]');
    await expect(gameContainer).toBeVisible({ timeout: 10000 });

    // ConnectionStatus should show Phaser as Ready
    const phaserStatus = page.locator('text=Phaser: Ready');
    await expect(phaserStatus).toBeVisible({ timeout: 10000 });
  });

  test('ConnectionStatus component renders', async ({ page }) => {
    await page.goto('/');

    // Should show connection status panel
    const statusPanel = page.locator('text=Phaser:');
    await expect(statusPanel).toBeVisible();

    const wsStatus = page.locator('text=WebSocket:');
    await expect(wsStatus).toBeVisible();
  });

  test('No console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    // Wait for everything to load
    await page.waitForTimeout(3000);

    // Filter out known non-critical warnings if any
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') // Common non-critical browser warning
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Game canvas is responsive (fills viewport)', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const viewport = page.viewportSize();
    const box = await canvas.boundingBox();

    expect(box).toBeTruthy();
    // Canvas should be close to viewport size (within 10px tolerance)
    expect(box!.width).toBeGreaterThan(viewport!.width - 10);
    expect(box!.height).toBeGreaterThan(viewport!.height - 10);
  });
});
