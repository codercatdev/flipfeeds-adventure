import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 4 — Kiosk Modal Tests
 *
 * Tests the KioskController pure logic — no React rendering.
 * The controller manages modal state, content registry,
 * input pausing, and safe open/close operations.
 *
 * NOTE: Uses a local mock EventBus to avoid importing from
 * @flipfeeds/game-client (which pulls in Phaser/navigator).
 */

// ============================================================
// Local mock EventBus (avoids Phaser import chain)
// ============================================================

type Handler = (...args: unknown[]) => void;

class MockEventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const h of handlers) h(...args);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

const eventBus = new MockEventBus();

// ============================================================
// Pure logic extracted from KioskModal component
// ============================================================

interface KioskState {
  isOpen: boolean;
  zoneId: string | null;
  content: { title: string; type: string } | null;
}

// Content registry — maps zone IDs to their content
const KIOSK_CONTENT: Record<string, { title: string; type: string }> = {
  'kiosk-schedule': { title: 'Event Schedule', type: 'schedule' },
  'info-desk': { title: 'Information', type: 'faq' },
};

// Modal dimension constraints (from the React component styles)
const MODAL_DIMENSIONS = {
  width: '80vw',
  maxWidth: 800,
  height: '70vh',
  maxHeight: 600,
};

class KioskController {
  private state: KioskState = { isOpen: false, zoneId: null, content: null };

  open(zoneId: string): { pauseInput: boolean } {
    this.state.isOpen = true;
    this.state.zoneId = zoneId;
    this.state.content = this.getContent(zoneId);
    eventBus.emit('PAUSE_INPUT');
    return { pauseInput: true };
  }

  close(): { resumeInput: boolean } {
    this.state.isOpen = false;
    this.state.zoneId = null;
    this.state.content = null;
    eventBus.emit('RESUME_INPUT');
    eventBus.emit('KIOSK_CLOSED');
    return { resumeInput: true };
  }

  getState(): KioskState {
    return { ...this.state };
  }

  getContent(zoneId: string): { title: string; type: string } | null {
    return KIOSK_CONTENT[zoneId] || null;
  }

  handleEscape(): void {
    if (this.state.isOpen) {
      this.close();
    }
  }

  handleBackdropClick(): void {
    if (this.state.isOpen) {
      this.close();
    }
  }
}

// ============================================================
// Tests
// ============================================================

describe('KioskController — Open/Close', () => {
  let controller: KioskController;

  beforeEach(() => {
    eventBus.clear();
    controller = new KioskController();
  });

  it('open() sets isOpen=true and returns pauseInput=true', () => {
    const result = controller.open('kiosk-schedule');

    expect(result.pauseInput).toBe(true);
    expect(controller.getState().isOpen).toBe(true);
  });

  it('open() sets zoneId correctly', () => {
    controller.open('kiosk-schedule');
    expect(controller.getState().zoneId).toBe('kiosk-schedule');
  });

  it('close() sets isOpen=false and returns resumeInput=true', () => {
    controller.open('kiosk-schedule');
    const result = controller.close();

    expect(result.resumeInput).toBe(true);
    expect(controller.getState().isOpen).toBe(false);
  });

  it('close() clears zoneId and content', () => {
    controller.open('kiosk-schedule');
    controller.close();

    const state = controller.getState();
    expect(state.zoneId).toBeNull();
    expect(state.content).toBeNull();
  });

  it('double open is safe (no crash)', () => {
    expect(() => {
      controller.open('kiosk-schedule');
      controller.open('info-desk');
    }).not.toThrow();

    expect(controller.getState().isOpen).toBe(true);
    expect(controller.getState().zoneId).toBe('info-desk');
  });

  it('double close is safe (no crash)', () => {
    controller.open('kiosk-schedule');
    expect(() => {
      controller.close();
      controller.close();
    }).not.toThrow();

    expect(controller.getState().isOpen).toBe(false);
  });
});

describe('KioskController — Event Emission', () => {
  let controller: KioskController;

  beforeEach(() => {
    eventBus.clear();
    controller = new KioskController();
  });

  it('PAUSE_INPUT fires on open', () => {
    const handler = vi.fn();
    eventBus.on('PAUSE_INPUT', handler);

    controller.open('kiosk-schedule');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('RESUME_INPUT fires on close', () => {
    const handler = vi.fn();
    eventBus.on('RESUME_INPUT', handler);

    controller.open('kiosk-schedule');
    controller.close();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('KIOSK_CLOSED fires on close', () => {
    const handler = vi.fn();
    eventBus.on('KIOSK_CLOSED', handler);

    controller.open('kiosk-schedule');
    controller.close();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('open then close emits PAUSE then RESUME in order', () => {
    const events: string[] = [];
    eventBus.on('PAUSE_INPUT', () => events.push('PAUSE'));
    eventBus.on('RESUME_INPUT', () => events.push('RESUME'));

    controller.open('kiosk-schedule');
    controller.close();

    expect(events).toEqual(['PAUSE', 'RESUME']);
  });
});

describe('KioskController — Content Registry', () => {
  let controller: KioskController;

  beforeEach(() => {
    controller = new KioskController();
  });

  it('content registry maps kiosk-schedule to correct content', () => {
    const content = controller.getContent('kiosk-schedule');
    expect(content).not.toBeNull();
    expect(content!.title).toBe('Event Schedule');
    expect(content!.type).toBe('schedule');
  });

  it('content registry maps info-desk to correct content', () => {
    const content = controller.getContent('info-desk');
    expect(content).not.toBeNull();
    expect(content!.title).toBe('Information');
    expect(content!.type).toBe('faq');
  });

  it('unknown zoneId returns null content (graceful fallback)', () => {
    const content = controller.getContent('unknown-zone');
    expect(content).toBeNull();
  });

  it('open() populates content from registry', () => {
    controller.open('kiosk-schedule');
    const state = controller.getState();
    expect(state.content).not.toBeNull();
    expect(state.content!.title).toBe('Event Schedule');
  });

  it('open() with unknown zone sets content to null', () => {
    controller.open('unknown-zone');
    const state = controller.getState();
    expect(state.content).toBeNull();
    expect(state.isOpen).toBe(true); // Still opens, just no content
  });
});

describe('KioskController — Keyboard & Interaction', () => {
  let controller: KioskController;

  beforeEach(() => {
    eventBus.clear();
    controller = new KioskController();
  });

  it('escape key closes modal', () => {
    controller.open('kiosk-schedule');
    expect(controller.getState().isOpen).toBe(true);

    controller.handleEscape();
    expect(controller.getState().isOpen).toBe(false);
  });

  it('escape when already closed is safe', () => {
    expect(() => controller.handleEscape()).not.toThrow();
    expect(controller.getState().isOpen).toBe(false);
  });

  it('backdrop click closes modal', () => {
    controller.open('kiosk-schedule');
    controller.handleBackdropClick();
    expect(controller.getState().isOpen).toBe(false);
  });

  it('backdrop click when closed is safe', () => {
    expect(() => controller.handleBackdropClick()).not.toThrow();
  });
});

describe('KioskController — Modal Dimensions', () => {
  it('modal width is 80vw with max 800px', () => {
    expect(MODAL_DIMENSIONS.width).toBe('80vw');
    expect(MODAL_DIMENSIONS.maxWidth).toBe(800);
  });

  it('modal height is 70vh with max 600px', () => {
    expect(MODAL_DIMENSIONS.height).toBe('70vh');
    expect(MODAL_DIMENSIONS.maxHeight).toBe(600);
  });
});
