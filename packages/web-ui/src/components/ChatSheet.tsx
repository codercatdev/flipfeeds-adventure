'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MessageCircle, Send } from 'lucide-react';
import { eventBus } from '@flipfeeds/game-client/events';

interface ChatMessage {
  id: string;
  playerId: string;
  message: string;
  timestamp: number;
}

interface ChatSheetProps {
  playerName?: string;
}

export function ChatSheet({ playerName = 'Player' }: ChatSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for CHAT_OPEN from game engine (player pressed T in chat zone)
  useEffect(() => {
    const handleChatOpen = () => {
      setIsOpen(true);
    };
    eventBus.on('CHAT_OPEN', handleChatOpen);
    return () => { eventBus.off('CHAT_OPEN', handleChatOpen); };
  }, []);

  // Listen for incoming chat messages
  useEffect(() => {
    const handleChatReceived = (data: { playerId: string; message: string; x: number; y: number }) => {
      setMessages(prev => [...prev, {
        id: `${data.playerId}-${Date.now()}`,
        playerId: data.playerId,
        message: data.message,
        timestamp: Date.now(),
      }]);
    };
    eventBus.on('CHAT_RECEIVED', handleChatReceived);
    return () => { eventBus.off('CHAT_RECEIVED', handleChatReceived); };
  }, []);

  // CRITICAL: Pause/resume game input when sheet opens/closes
  // Without this, typing "e" in the chat input triggers zone interactions in Phaser
  useEffect(() => {
    if (isOpen) {
      eventBus.emit('PAUSE_INPUT');
      // Focus the input after a short delay (sheet animation)
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      eventBus.emit('RESUME_INPUT');
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    // Send through EventBus → WebSocket → server → other players
    eventBus.emit('SEND_CHAT', { message: text });

    // Add to local messages immediately (optimistic)
    setMessages(prev => [...prev, {
      id: `self-${Date.now()}`,
      playerId: 'self',
      message: text,
      timestamp: Date.now(),
    }]);

    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    // Stop propagation so Phaser doesn't see these keystrokes
    e.stopPropagation();
  }, [handleSend]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[40vh] max-h-[400px] bg-background/95 backdrop-blur-md border-t border-border">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="size-4 text-primary" />
            Zone Chat
          </SheetTitle>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2 min-h-0">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              No messages yet. Say hello! 👋
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "text-sm rounded-lg px-3 py-2 max-w-[80%]",
                msg.playerId === 'self'
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {msg.playerId !== 'self' && (
                <span className="text-xs text-muted-foreground block mb-0.5">
                  {msg.playerId.slice(0, 8)}
                </span>
              )}
              {msg.message}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2 p-4 pt-2 border-t border-border">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-input text-foreground rounded-md px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="size-4" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
