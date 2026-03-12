'use client';

import { useState, useEffect, useRef } from 'react';
import { eventBus } from '@flipfeeds/game-client/events';

const ROOM_NAMES: Record<string, string> = {
  'lobby': 'Lobby',
  'feed-maker': 'Maker Feed',
  'social': 'Social Hub',
  'feed-future': 'Future Feed',
  'edit-bay': 'Edit Bay',
};

export function RoomTransition() {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onRoomChange = (data: { targetRoom: string; targetSpawn: string; roomName?: string }) => {
      // Clear any pending fade-out from a previous transition
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

      const name = data.roomName || ROOM_NAMES[data.targetRoom] || data.targetRoom;
      setRoomName(name);
      setVisible(true);
    };

    const onRoomLoaded = () => {
      // New room is ready — fade out the overlay
      setVisible(false);
      fadeTimerRef.current = setTimeout(() => setRoomName(null), 400);
    };

    eventBus.on('ROOM_CHANGE', onRoomChange);
    eventBus.on('ROOM_LOADED', onRoomLoaded);

    return () => {
      eventBus.off('ROOM_CHANGE', onRoomChange);
      eventBus.off('ROOM_LOADED', onRoomLoaded);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!roomName) return null;

  return (
    <div
      className={`fixed inset-0 z-[1500] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: visible ? 'rgba(0, 0, 0, 0.7)' : 'transparent' }}
    >
      <div className="text-center">
        <p className="text-white/60 text-sm font-mono tracking-widest uppercase mb-2">
          Entering
        </p>
        <h2 className="text-white text-3xl font-bold font-mono">
          {roomName}
        </h2>
      </div>
    </div>
  );
}
