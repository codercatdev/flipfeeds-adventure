'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MessageCircle, Send } from 'lucide-react';
import { eventBus } from '@flipfeeds/game-client/events';

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
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
    const handleChatReceived = (data: { playerId: string; message: string; name?: string; x: number; y: number }) => {
      setMessages(prev => [...prev, {
        id: `${data.playerId}-${Date.now()}`,
        playerId: data.playerId,
        playerName: data.name || data.playerId.slice(0, 8),
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
    // Server excludes sender from broadcasts, so this is the only way we see our own message
    setMessages(prev => [...prev, {
      id: `self-${Date.now()}`,
      playerId: 'self',
      playerName: playerName,
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
      <SheetContent
        side="bottom"
        className="h-[45vh] max-h-[480px] min-h-[320px] bg-background/95 backdrop-blur-md border-t border-border mx-4 sm:mx-6 mb-6 rounded-t-2xl"
      >
        <SheetHeader className="px-6 pt-5 pb-3">
          <SheetTitle className="flex items-center gap-3 text-base font-semibold">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/20">
              <MessageCircle className="size-4 text-primary" />
            </div>
            Chat with other players
          </SheetTitle>
        </SheetHeader>

        {/* Messages area — spacious with generous padding */}
        <div className="flex-1 overflow-y-auto px-6 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <MessageCircle className="size-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                No messages yet. Say hello! 👋
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-2xl px-4 py-3 max-w-[75%] text-sm leading-relaxed",
                msg.playerId === 'self'
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {msg.playerId !== 'self' && (
                <span className="text-xs font-medium text-primary block mb-1">
                  {msg.playerName}
                </span>
              )}
              {msg.message}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area — large, comfortable, Google I/O inspired */}
        <div className="px-6 pb-6 pt-4">
          <div className="flex gap-3 items-center bg-input/50 border border-border rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chat with other attendees..."
              className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
