'use client';

import { useState, useCallback } from 'react';
import { useGameEvent } from '../../hooks/useGameEvent';
import { ChatBubble } from './ChatBubble';

interface BubbleData {
  id: string;
  playerId: string;
  message: string;
  screenX: number;
  screenY: number;
  zoneId?: string; // track which zone this bubble belongs to
}

interface ChatBubbleManagerProps {
  currentZoneId: string | null;
}

let bubbleCounter = 0;

export function ChatBubbleManager({ currentZoneId }: ChatBubbleManagerProps) {
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);

  // Listen for incoming chat messages
  useGameEvent('CHAT_RECEIVED', useCallback((data) => {
    const newBubble: BubbleData = {
      id: `bubble-${++bubbleCounter}`,
      playerId: data.playerId,
      message: data.message,
      screenX: data.x,
      screenY: data.y,
      // Note: CHAT_RECEIVED doesn't include zoneId yet, 
      // but we can filter by whether we're in a chat zone at all
    };
    setBubbles(prev => [...prev, newBubble]);
  }, []));

  const removeBubble = useCallback((id: string) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  }, []);

  // Only render bubbles if player is in a chat zone
  // Bubbles already in flight will finish their fade naturally
  // (they have their own 8s timer in ChatBubble component)
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {bubbles.map(bubble => (
        <ChatBubble
          key={bubble.id}
          playerId={bubble.playerId}
          message={bubble.message}
          screenX={bubble.screenX}
          screenY={bubble.screenY}
          onExpire={() => removeBubble(bubble.id)}
        />
      ))}
    </div>
  );
}
