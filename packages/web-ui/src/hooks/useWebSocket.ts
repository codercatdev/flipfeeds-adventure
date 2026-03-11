'use client';

import { useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import type { ServerMessage, ClientMessage, Direction, PlayerState } from '@flipfeeds/shared';
import { eventBus } from '@flipfeeds/game-client/events';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected';

interface UseWebSocketOptions {
  host: string;
  room?: string;
  playerName?: string;
  token?: string;  // auth session token
  enabled?: boolean;  // gate connection on auth ready
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  playerId: string | null;
  latency: number;
}

/**
 * Maintains a position cache for players so we can provide x/y
 * when emitting CHAT_RECEIVED (the server only sends id + text).
 */
const playerPositions = new Map<string, { x: number; y: number }>();

export function useWebSocket({
  host,
  room = 'main',
  playerName = 'Anonymous',
  token,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const socketRef = useRef<PartySocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const seqRef = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerIdRef = useRef<string | null>(null);
  // Token as ref — session refreshes (e.g. avatar save) shouldn't trigger reconnect
  const tokenRef = useRef(token);
  tokenRef.current = token;
  /** Stored welcome so we can send ROOM_STATE when the game becomes ready (it may not exist yet when welcome arrives) */
  const welcomeRef = useRef<{ id: string; players: PlayerState[] } | null>(null);

  useEffect(() => {
    // Don't connect until auth is ready
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    const socket = new PartySocket({
      host,
      room,
      query: { ...(tokenRef.current ? { token: tokenRef.current } : {}), name: playerName },
    });

    socketRef.current = socket;

    // ─── Helpers ───────────────────────────────────────────────

    function send(msg: ClientMessage): void {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    }

    // ─── Incoming: ServerMessage → GameEvents ─────────────────

    function handleMessage(event: MessageEvent): void {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        console.warn('[useWebSocket] Failed to parse message:', event.data);
        return;
      }

      switch (msg.type) {
        case 'welcome': {
          playerIdRef.current = msg.id;
          setPlayerId(msg.id);
          welcomeRef.current = { id: msg.id, players: msg.players };
          for (const p of msg.players) {
            playerPositions.set(p.id, { x: p.x, y: p.y });
            if (p.id === msg.id) continue; // skip self — local player is already on screen
            eventBus.emit('PLAYER_JOINED', {
              id: p.id,
              x: p.x,
              y: p.y,
              direction: p.dir,
              name: p.name ?? 'Anonymous',
              avatarConfig: p.avatarConfig,
            });
          }
          break;
        }

        case 'player-join': {
          const p = msg.player;
          playerPositions.set(p.id, { x: p.x, y: p.y });
          eventBus.emit('PLAYER_JOINED', {
            id: p.id,
            x: p.x,
            y: p.y,
            direction: p.dir,
            name: p.name ?? 'Anonymous',
            avatarConfig: p.avatarConfig,
          });
          break;
        }

        case 'player-leave': {
          playerPositions.delete(msg.id);
          eventBus.emit('PLAYER_LEFT', { id: msg.id });
          break;
        }

        case 'sync': {
          for (const delta of msg.players) {
            // Update position cache if we have new coords
            const cached = playerPositions.get(delta.id);
            const x = delta.x ?? cached?.x ?? 0;
            const y = delta.y ?? cached?.y ?? 0;
            const direction: Direction = delta.dir ?? 'idle';

            playerPositions.set(delta.id, { x, y });

            eventBus.emit('PLAYER_MOVED', {
              id: delta.id,
              x,
              y,
              direction,
              anim: delta.anim,
            });
          }
          break;
        }

        case 'chat': {
          const pos = playerPositions.get(msg.id) ?? { x: 0, y: 0 };
          eventBus.emit('CHAT_RECEIVED', {
            playerId: msg.id,
            message: msg.text,
            name: msg.name,
            x: pos.x,
            y: pos.y,
          });
          break;
        }

        case 'pong': {
          const rtt = Date.now() - msg.t;
          setLatency(rtt);
          break;
        }
      }
    }

    // ─── Outgoing: GameEvents → ClientMessage ─────────────────

    function handleSendPosition(data: {
      x: number;
      y: number;
      direction: Direction;
      anim?: string;
    }): void {
      seqRef.current += 1;
      send({
        type: 'move',
        x: data.x,
        y: data.y,
        dir: data.direction,
        anim: data.anim,
        seq: seqRef.current,
      });
    }

    function handleSendChat(data: { message: string }): void {
      send({ type: 'chat', text: data.message });
    }

    // ─── Socket lifecycle ─────────────────────────────────────

    socket.addEventListener('open', () => {
      setStatus('connected');
      console.log('[useWebSocket] Connected to', host, 'room:', room);

      // Start ping interval (every 5 seconds)
      pingIntervalRef.current = setInterval(() => {
        send({ type: 'ping', t: Date.now() });
      }, 5000);
    });

    socket.addEventListener('message', handleMessage);

    socket.addEventListener('close', () => {
      setStatus('disconnected');
      console.log('[useWebSocket] Disconnected');

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    });

    socket.addEventListener('error', (err) => {
      console.error('[useWebSocket] Error:', err);
    });

    // PartySocket fires this when it starts reconnecting
    socket.addEventListener('close', () => {
      // PartySocket will auto-reconnect; set status to connecting
      // (only if we haven't unmounted)
      if (socketRef.current === socket) {
        setStatus('connecting');
      }
    });

    // When the game is ready, send current room state so it can show players already in the room
    const onGameReady = () => {
      const w = welcomeRef.current;
      if (!w) return;
      eventBus.emit('ROOM_STATE', {
        id: w.id,
        players: w.players.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          direction: p.dir,
          name: p.name,
          anim: p.anim,
          avatarConfig: p.avatarConfig,
        })),
      });
    };
    eventBus.on('GAME_READY', onGameReady);

    eventBus.on('SEND_POSITION', handleSendPosition);
    eventBus.on('SEND_CHAT', handleSendChat);

    // ─── Cleanup ──────────────────────────────────────────────

    return () => {
      eventBus.off('GAME_READY', onGameReady);
      eventBus.off('SEND_POSITION', handleSendPosition);
      eventBus.off('SEND_CHAT', handleSendChat);
      welcomeRef.current = null;

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      socketRef.current = null;
      playerIdRef.current = null;
      playerPositions.clear();
      socket.close();
    };
  }, [host, room, playerName, enabled]);

  return { status, playerId, latency };
}
