'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { eventBus } from '@flipfeeds/game-client/events';

interface ChatInputProps {
  zoneId: string;
  onClose: () => void;
}

export function ChatInput({ zoneId, onClose }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 200) return;

    eventBus.emit('SEND_CHAT', { message: trimmed });
    setMessage('');
  }, [message]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: 'fixed',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        maxWidth: '90vw',
        display: 'flex',
        gap: '8px',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '12px',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto' as const,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send, Esc to close)"
        maxLength={200}
        style={{
          flex: 1,
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '14px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={!message.trim()}
        style={{
          padding: '8px 16px',
          background: message.trim() ? '#00ff88' : 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '8px',
          color: message.trim() ? '#1a1a2e' : '#666',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: message.trim() ? 'pointer' : 'default',
        }}
      >
        Send
      </button>
    </form>
  );
}
