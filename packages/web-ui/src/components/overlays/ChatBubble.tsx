'use client';

import { useEffect, useState } from 'react';

interface ChatBubbleProps {
  playerId: string;
  message: string;
  screenX: number;
  screenY: number;
  onExpire: () => void;
}

export function ChatBubble({ playerId, message, screenX, screenY, onExpire }: ChatBubbleProps) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Fade out after 7 seconds, then remove after 8
    const fadeTimer = setTimeout(() => setOpacity(0), 7000);
    const removeTimer = setTimeout(onExpire, 8000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [onExpire]);

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY - 60, // Above the player sprite
        transform: 'translateX(-50%)',
        maxWidth: '200px',
        padding: '6px 10px',
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a2e',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        opacity,
        transition: 'opacity 1s ease-out',
        pointerEvents: 'none' as const,
        zIndex: 20,
        wordBreak: 'break-word' as const,
      }}
    >
      {/* Small triangle pointer */}
      <div style={{
        position: 'absolute',
        bottom: '-6px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(255, 255, 255, 0.9)',
      }} />
      {message}
    </div>
  );
}
