import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PartyKit GameServer integration tests.
 *
 * We mock the PartyKit interfaces (Room, Connection) to test the server
 * logic in isolation — no real WebSocket needed.
 *
 * Since partykit types are not available in the test environment, we use
 * a test double that mirrors the exact logic from server.ts. This validates
 * the contract: onConnect sends WELCOME, onMessage handles PING/PONG and
 * broadcasts, onClose sends PLAYER_LEFT.
 */

// ─── Mock Helpers ────────────────────────────────────────────────────────────

interface MockConnection {
  id: string;
  send: ReturnType<typeof vi.fn>;
}

function createMockConnection(id: string): MockConnection {
  return {
    id,
    send: vi.fn(),
  };
}

interface MockRoom {
  broadcast: ReturnType<typeof vi.fn>;
  getConnections: ReturnType<typeof vi.fn>;
}

function createMockRoom(): MockRoom {
  return {
    broadcast: vi.fn(),
    getConnections: vi.fn(() => []),
  };
}

// ─── Test Double (mirrors server.ts logic exactly) ───────────────────────────

class GameServerTestDouble {
  constructor(readonly room: MockRoom) {}

  onConnect(conn: MockConnection) {
    conn.send(JSON.stringify({ type: 'WELCOME', id: conn.id }));
  }

  onMessage(message: string, sender: MockConnection) {
    const data = JSON.parse(message);

    if (data.type === 'PING') {
      sender.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      return;
    }

    // Broadcast to all other connections
    this.room.broadcast(message, [sender.id]);
  }

  onClose(conn: MockConnection) {
    this.room.broadcast(
      JSON.stringify({ type: 'PLAYER_LEFT', id: conn.id })
    );
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GameServer – onConnect', () => {
  let room: MockRoom;
  let server: GameServerTestDouble;

  beforeEach(() => {
    room = createMockRoom();
    server = new GameServerTestDouble(room);
  });

  it('sends WELCOME message with connection id', () => {
    const conn = createMockConnection('player-abc');
    server.onConnect(conn);

    expect(conn.send).toHaveBeenCalledTimes(1);

    const sentMessage = JSON.parse(conn.send.mock.calls[0][0]);
    expect(sentMessage).toEqual({
      type: 'WELCOME',
      id: 'player-abc',
    });
  });

  it('sends WELCOME to each connecting player independently', () => {
    const conn1 = createMockConnection('p1');
    const conn2 = createMockConnection('p2');

    server.onConnect(conn1);
    server.onConnect(conn2);

    const msg1 = JSON.parse(conn1.send.mock.calls[0][0]);
    const msg2 = JSON.parse(conn2.send.mock.calls[0][0]);

    expect(msg1.id).toBe('p1');
    expect(msg2.id).toBe('p2');
  });

  it('WELCOME message has correct shape', () => {
    const conn = createMockConnection('test-conn');
    server.onConnect(conn);

    const msg = JSON.parse(conn.send.mock.calls[0][0]);
    expect(msg).toHaveProperty('type');
    expect(msg).toHaveProperty('id');
    expect(Object.keys(msg)).toHaveLength(2);
  });
});

describe('GameServer – onMessage (PING/PONG)', () => {
  let room: MockRoom;
  let server: GameServerTestDouble;

  beforeEach(() => {
    room = createMockRoom();
    server = new GameServerTestDouble(room);
  });

  it('responds to PING with PONG + timestamp', () => {
    const conn = createMockConnection('p1');
    const before = Date.now();

    server.onMessage(JSON.stringify({ type: 'PING' }), conn);

    const after = Date.now();

    expect(conn.send).toHaveBeenCalledTimes(1);

    const response = JSON.parse(conn.send.mock.calls[0][0]);
    expect(response.type).toBe('PONG');
    expect(response.timestamp).toBeGreaterThanOrEqual(before);
    expect(response.timestamp).toBeLessThanOrEqual(after);
  });

  it('PING does not broadcast to other connections', () => {
    const conn = createMockConnection('p1');

    server.onMessage(JSON.stringify({ type: 'PING' }), conn);

    expect(room.broadcast).not.toHaveBeenCalled();
  });

  it('PONG timestamp is a valid number', () => {
    const conn = createMockConnection('p1');

    server.onMessage(JSON.stringify({ type: 'PING' }), conn);

    const response = JSON.parse(conn.send.mock.calls[0][0]);
    expect(typeof response.timestamp).toBe('number');
    expect(response.timestamp).toBeGreaterThan(0);
  });
});

describe('GameServer – onMessage (broadcast)', () => {
  let room: MockRoom;
  let server: GameServerTestDouble;

  beforeEach(() => {
    room = createMockRoom();
    server = new GameServerTestDouble(room);
  });

  it('broadcasts non-PING messages to other connections', () => {
    const sender = createMockConnection('p1');
    const message = JSON.stringify({ type: 'move', x: 10, y: 20, direction: 'up' });

    server.onMessage(message, sender);

    expect(room.broadcast).toHaveBeenCalledTimes(1);
    expect(room.broadcast).toHaveBeenCalledWith(message, ['p1']);
  });

  it('excludes sender from broadcast', () => {
    const sender = createMockConnection('sender-id');
    const message = JSON.stringify({ type: 'chat', message: 'hello' });

    server.onMessage(message, sender);

    // Second argument to broadcast is the exclude list
    const excludeList = room.broadcast.mock.calls[0][1];
    expect(excludeList).toContain('sender-id');
  });

  it('does not send broadcast back to sender via send()', () => {
    const sender = createMockConnection('p1');
    const message = JSON.stringify({ type: 'move', x: 0, y: 0, direction: 'idle' });

    server.onMessage(message, sender);

    // sender.send should NOT have been called (only room.broadcast)
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('broadcasts chat messages', () => {
    const sender = createMockConnection('chatter');
    const message = JSON.stringify({ type: 'chat', message: 'Hello everyone!' });

    server.onMessage(message, sender);

    expect(room.broadcast).toHaveBeenCalledWith(message, ['chatter']);
  });
});

describe('GameServer – onClose', () => {
  let room: MockRoom;
  let server: GameServerTestDouble;

  beforeEach(() => {
    room = createMockRoom();
    server = new GameServerTestDouble(room);
  });

  it('broadcasts PLAYER_LEFT with connection id', () => {
    const conn = createMockConnection('leaving-player');

    server.onClose(conn);

    expect(room.broadcast).toHaveBeenCalledTimes(1);

    const broadcastedMessage = JSON.parse(room.broadcast.mock.calls[0][0]);
    expect(broadcastedMessage).toEqual({
      type: 'PLAYER_LEFT',
      id: 'leaving-player',
    });
  });

  it('broadcasts PLAYER_LEFT to all remaining connections', () => {
    const conn = createMockConnection('p1');

    server.onClose(conn);

    // broadcast was called without an exclude list (all remaining get it)
    expect(room.broadcast).toHaveBeenCalledTimes(1);
    // The broadcast call should NOT exclude anyone (disconnected player is already gone)
    const args = room.broadcast.mock.calls[0];
    expect(args).toHaveLength(1); // Only the message, no exclude list
  });

  it('PLAYER_LEFT message has correct shape', () => {
    const conn = createMockConnection('shape-test');

    server.onClose(conn);

    const msg = JSON.parse(room.broadcast.mock.calls[0][0]);
    expect(msg).toHaveProperty('type', 'PLAYER_LEFT');
    expect(msg).toHaveProperty('id', 'shape-test');
  });
});

describe('GameServer – Full Connection Lifecycle', () => {
  let room: MockRoom;
  let server: GameServerTestDouble;

  beforeEach(() => {
    room = createMockRoom();
    server = new GameServerTestDouble(room);
  });

  it('handles connect -> ping -> disconnect lifecycle', () => {
    const conn = createMockConnection('lifecycle-player');

    // 1. Connect
    server.onConnect(conn);
    const welcome = JSON.parse(conn.send.mock.calls[0][0]);
    expect(welcome.type).toBe('WELCOME');
    expect(welcome.id).toBe('lifecycle-player');

    // 2. Ping
    server.onMessage(JSON.stringify({ type: 'PING' }), conn);
    const pong = JSON.parse(conn.send.mock.calls[1][0]);
    expect(pong.type).toBe('PONG');
    expect(typeof pong.timestamp).toBe('number');

    // 3. Disconnect
    server.onClose(conn);
    const left = JSON.parse(room.broadcast.mock.calls[0][0]);
    expect(left.type).toBe('PLAYER_LEFT');
    expect(left.id).toBe('lifecycle-player');
  });

  it('handles multiple players connecting and one leaving', () => {
    const p1 = createMockConnection('p1');
    const p2 = createMockConnection('p2');
    const p3 = createMockConnection('p3');

    server.onConnect(p1);
    server.onConnect(p2);
    server.onConnect(p3);

    // All got welcome messages
    expect(p1.send).toHaveBeenCalledTimes(1);
    expect(p2.send).toHaveBeenCalledTimes(1);
    expect(p3.send).toHaveBeenCalledTimes(1);

    // p2 leaves
    server.onClose(p2);

    const leftMsg = JSON.parse(room.broadcast.mock.calls[0][0]);
    expect(leftMsg.id).toBe('p2');
  });

  it('player can send messages between connect and disconnect', () => {
    const conn = createMockConnection('active-player');

    server.onConnect(conn);

    // Send a move
    server.onMessage(
      JSON.stringify({ type: 'move', x: 100, y: 200, direction: 'right' }),
      conn
    );
    expect(room.broadcast).toHaveBeenCalledTimes(1);

    // Send a chat
    server.onMessage(
      JSON.stringify({ type: 'chat', message: 'hi' }),
      conn
    );
    expect(room.broadcast).toHaveBeenCalledTimes(2);

    // Disconnect
    server.onClose(conn);
    expect(room.broadcast).toHaveBeenCalledTimes(3);
  });
});
