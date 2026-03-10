import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 4 — Chat Bubble Tests
 *
 * Tests the ChatBubbleManager pure logic — no React rendering.
 * The manager tracks bubbles, handles zone scoping, display timing,
 * rate limiting, and message length caps.
 */

// ============================================================
// Pure logic extracted from ChatBubbleManager / ChatBubble
// These mirror the behavior in the React components but are
// testable without React or DOM.
// ============================================================

interface ChatBubble {
  id: string;
  playerId: string;
  message: string;
  x: number;
  y: number;
  createdAt: number;
  zoneId: string;
}

const BUBBLE_DISPLAY_MS = 8000;
const MAX_MESSAGE_LENGTH = 200;
const RATE_LIMIT_MS = 1000;

class ChatBubbleManager {
  private bubbles: ChatBubble[] = [];
  private currentZoneId: string | null = null;
  private lastMessageTime: Map<string, number> = new Map();
  private idCounter = 0;

  setCurrentZone(zoneId: string | null): void {
    this.currentZoneId = zoneId;
  }

  getCurrentZone(): string | null {
    return this.currentZoneId;
  }

  addBubble(
    playerId: string,
    message: string,
    x: number,
    y: number,
    zoneId: string,
    now: number = Date.now()
  ): ChatBubble | null {
    // Rate limiting: max 1 message per second per player
    const lastTime = this.lastMessageTime.get(playerId);
    if (lastTime !== undefined && now - lastTime < RATE_LIMIT_MS) {
      return null;
    }

    // Cap message length
    const cappedMessage = message.slice(0, MAX_MESSAGE_LENGTH);

    const bubble: ChatBubble = {
      id: `bubble-${++this.idCounter}`,
      playerId,
      message: cappedMessage,
      x,
      y,
      createdAt: now,
      zoneId,
    };

    this.bubbles.push(bubble);
    this.lastMessageTime.set(playerId, now);
    return bubble;
  }

  getVisibleBubbles(now: number): ChatBubble[] {
    // If player not in a chat zone, no bubbles shown
    if (this.currentZoneId === null) {
      return [];
    }

    // Filter by time (8s display) and zone scope
    return this.bubbles.filter(b => {
      const age = now - b.createdAt;
      const withinTime = age < BUBBLE_DISPLAY_MS;
      const matchesZone = b.zoneId === this.currentZoneId;
      return withinTime && matchesZone;
    });
  }

  getAllBubbles(): ChatBubble[] {
    return [...this.bubbles];
  }

  removeBubble(id: string): void {
    this.bubbles = this.bubbles.filter(b => b.id !== id);
  }

  clear(): void {
    this.bubbles = [];
    this.lastMessageTime.clear();
    this.idCounter = 0;
  }
}

// ============================================================
// Tests
// ============================================================

describe('ChatBubbleManager — Bubble Creation', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
    manager.setCurrentZone('water-cooler-main');
  });

  it('addBubble creates bubble with correct properties', () => {
    const now = 1000000;
    const bubble = manager.addBubble('player-1', 'Hello world', 100, 200, 'water-cooler-main', now);

    expect(bubble).not.toBeNull();
    expect(bubble!.playerId).toBe('player-1');
    expect(bubble!.message).toBe('Hello world');
    expect(bubble!.x).toBe(100);
    expect(bubble!.y).toBe(200);
    expect(bubble!.zoneId).toBe('water-cooler-main');
    expect(bubble!.createdAt).toBe(now);
    expect(bubble!.id).toBeDefined();
    expect(typeof bubble!.id).toBe('string');
  });

  it('each bubble gets a unique id', () => {
    const now = 1000000;
    const b1 = manager.addBubble('p1', 'msg1', 0, 0, 'water-cooler-main', now);
    const b2 = manager.addBubble('p2', 'msg2', 0, 0, 'water-cooler-main', now);

    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b1!.id).not.toBe(b2!.id);
  });

  it('bubble position tracks player x, y', () => {
    const bubble = manager.addBubble('p1', 'test', 350, 420, 'water-cooler-main', 1000);

    expect(bubble!.x).toBe(350);
    expect(bubble!.y).toBe(420);
  });
});

describe('ChatBubbleManager — Visibility & Timing', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
    manager.setCurrentZone('water-cooler-main');
  });

  it('getVisibleBubbles returns only bubbles within 8s display time', () => {
    const now = 1000000;
    manager.addBubble('p1', 'recent', 0, 0, 'water-cooler-main', now);
    manager.addBubble('p2', 'old', 0, 0, 'water-cooler-main', now - 9000);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(1);
    expect(visible[0].message).toBe('recent');
  });

  it('bubbles older than 8s are filtered out', () => {
    const now = 1000000;
    manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', now - 8001);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(0);
  });

  it('bubble at exactly 8s boundary is filtered out', () => {
    const now = 1000000;
    manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', now - 8000);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(0);
  });

  it('bubble just under 8s is still visible', () => {
    const now = 1000000;
    manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', now - 7999);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(1);
  });

  it('multiple bubbles from different players render simultaneously', () => {
    const now = 1000000;
    manager.addBubble('p1', 'hello', 100, 100, 'water-cooler-main', now);
    manager.addBubble('p2', 'world', 200, 200, 'water-cooler-main', now);
    manager.addBubble('p3', 'test', 300, 300, 'water-cooler-main', now);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(3);
    expect(visible.map(b => b.playerId)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('ChatBubbleManager — Zone Scoping', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
  });

  it('zone-scoped filtering: only show bubbles matching currentZoneId', () => {
    const now = 1000000;
    manager.setCurrentZone('water-cooler-main');
    manager.addBubble('p1', 'in zone', 0, 0, 'water-cooler-main', now);
    manager.addBubble('p2', 'other zone', 0, 0, 'coffee-bar', now);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(1);
    expect(visible[0].message).toBe('in zone');
  });

  it('if player not in chat zone (currentZoneId = null), no bubbles shown', () => {
    const now = 1000000;
    manager.setCurrentZone(null);
    manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', now);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(0);
  });

  it('player exits zone while bubble fading → bubble continues its 8s lifecycle', () => {
    const now = 1000000;
    manager.setCurrentZone('water-cooler-main');
    manager.addBubble('p1', 'fading msg', 0, 0, 'water-cooler-main', now);

    // Bubble is visible initially
    expect(manager.getVisibleBubbles(now)).toHaveLength(1);

    // Player exits zone at 3s
    manager.setCurrentZone(null);
    expect(manager.getVisibleBubbles(now + 3000)).toHaveLength(0);

    // Player re-enters zone at 5s — bubble should still be alive (under 8s)
    manager.setCurrentZone('water-cooler-main');
    expect(manager.getVisibleBubbles(now + 5000)).toHaveLength(1);

    // At 9s — bubble has expired
    expect(manager.getVisibleBubbles(now + 9000)).toHaveLength(0);
  });

  it('switching zones shows only bubbles from new zone', () => {
    const now = 1000000;
    manager.setCurrentZone('water-cooler-main');
    manager.addBubble('p1', 'cooler msg', 0, 0, 'water-cooler-main', now);

    manager.setCurrentZone('coffee-bar');
    manager.addBubble('p2', 'coffee msg', 0, 0, 'coffee-bar', now);

    const visible = manager.getVisibleBubbles(now);
    expect(visible).toHaveLength(1);
    expect(visible[0].message).toBe('coffee msg');
  });
});

describe('ChatBubbleManager — Message Constraints', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
    manager.setCurrentZone('water-cooler-main');
  });

  it('message length capped at 200 characters', () => {
    const longMessage = 'A'.repeat(300);
    const bubble = manager.addBubble('p1', longMessage, 0, 0, 'water-cooler-main', 1000);

    expect(bubble).not.toBeNull();
    expect(bubble!.message.length).toBe(MAX_MESSAGE_LENGTH);
    expect(bubble!.message).toBe('A'.repeat(200));
  });

  it('message at exactly 200 characters is not truncated', () => {
    const exactMessage = 'B'.repeat(200);
    const bubble = manager.addBubble('p1', exactMessage, 0, 0, 'water-cooler-main', 1000);

    expect(bubble!.message.length).toBe(200);
    expect(bubble!.message).toBe(exactMessage);
  });

  it('short messages are not modified', () => {
    const bubble = manager.addBubble('p1', 'Hi!', 0, 0, 'water-cooler-main', 1000);
    expect(bubble!.message).toBe('Hi!');
  });
});

describe('ChatBubbleManager — Rate Limiting', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
    manager.setCurrentZone('water-cooler-main');
  });

  it('rate limiting: max 1 message per second per player', () => {
    const now = 1000000;
    const b1 = manager.addBubble('p1', 'first', 0, 0, 'water-cooler-main', now);
    const b2 = manager.addBubble('p1', 'second', 0, 0, 'water-cooler-main', now + 500);

    expect(b1).not.toBeNull();
    expect(b2).toBeNull(); // Rate limited
  });

  it('allows message after rate limit window passes', () => {
    const now = 1000000;
    const b1 = manager.addBubble('p1', 'first', 0, 0, 'water-cooler-main', now);
    const b2 = manager.addBubble('p1', 'second', 0, 0, 'water-cooler-main', now + 1001);

    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
  });

  it('rate limiting is per-player (different players can send simultaneously)', () => {
    const now = 1000000;
    const b1 = manager.addBubble('p1', 'from p1', 0, 0, 'water-cooler-main', now);
    const b2 = manager.addBubble('p2', 'from p2', 0, 0, 'water-cooler-main', now);

    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
  });

  it('rate limit at exactly 1000ms boundary allows message', () => {
    const now = 1000000;
    manager.addBubble('p1', 'first', 0, 0, 'water-cooler-main', now);
    const b2 = manager.addBubble('p1', 'second', 0, 0, 'water-cooler-main', now + 1000);

    expect(b2).not.toBeNull();
  });
});

describe('ChatBubbleManager — Removal', () => {
  let manager: ChatBubbleManager;

  beforeEach(() => {
    manager = new ChatBubbleManager();
    manager.setCurrentZone('water-cooler-main');
  });

  it('removeBubble removes the specified bubble', () => {
    const now = 1000000;
    const bubble = manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', now);
    expect(manager.getAllBubbles()).toHaveLength(1);

    manager.removeBubble(bubble!.id);
    expect(manager.getAllBubbles()).toHaveLength(0);
  });

  it('removeBubble with non-existent id is safe', () => {
    manager.addBubble('p1', 'msg', 0, 0, 'water-cooler-main', 1000);
    expect(() => manager.removeBubble('non-existent')).not.toThrow();
    expect(manager.getAllBubbles()).toHaveLength(1);
  });
});
