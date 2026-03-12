'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { eventBus } from '@flipfeeds/game-client/events';

type Direction = 'up' | 'down' | 'left' | 'right';

export function DPad() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const activeDirections = useRef(new Set<Direction>());
  const [pressed, setPressed] = useState<Set<Direction>>(new Set());

  // Only show on touch devices
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const emitDirection = useCallback(() => {
    const dirs = activeDirections.current;
    eventBus.emit('MOBILE_DIRECTION', {
      up: dirs.has('up'),
      down: dirs.has('down'),
      left: dirs.has('left'),
      right: dirs.has('right'),
    });
  }, []);

  const handlePress = useCallback((dir: Direction) => {
    activeDirections.current.add(dir);
    setPressed(new Set(activeDirections.current));
    emitDirection();
  }, [emitDirection]);

  const handleRelease = useCallback((dir: Direction) => {
    activeDirections.current.delete(dir);
    setPressed(new Set(activeDirections.current));
    emitDirection();
  }, [emitDirection]);

  const handleReleaseAll = useCallback(() => {
    activeDirections.current.clear();
    setPressed(new Set());
    eventBus.emit('MOBILE_DIRECTION', { up: false, down: false, left: false, right: false });
  }, []);

  // Release all on unmount
  useEffect(() => {
    return () => {
      eventBus.emit('MOBILE_DIRECTION', { up: false, down: false, left: false, right: false });
    };
  }, []);

  if (!isTouchDevice) return null;

  const buttonClass = (dir: Direction) =>
    `flex items-center justify-center w-14 h-14 rounded-xl transition-all select-none ${
      pressed.has(dir)
        ? 'bg-primary/40 scale-95'
        : 'bg-black/40 active:bg-primary/30'
    }`;

  return (
    <div
      className="fixed bottom-24 right-6 z-50 pointer-events-auto touch-none select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* D-pad grid layout */}
      <div className="grid grid-cols-3 gap-1" style={{ width: '176px', height: '176px' }}>
        {/* Row 1: empty - up - empty */}
        <div />
        <button
          className={buttonClass('up')}
          onTouchStart={(e) => { e.preventDefault(); handlePress('up'); }}
          onTouchEnd={(e) => { e.preventDefault(); handleRelease('up'); }}
          onTouchCancel={handleReleaseAll}
        >
          <ChevronUp className="size-7 text-white/80" />
        </button>
        <div />

        {/* Row 2: left - center - right */}
        <button
          className={buttonClass('left')}
          onTouchStart={(e) => { e.preventDefault(); handlePress('left'); }}
          onTouchEnd={(e) => { e.preventDefault(); handleRelease('left'); }}
          onTouchCancel={handleReleaseAll}
        >
          <ChevronLeft className="size-7 text-white/80" />
        </button>
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-black/20">
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <button
          className={buttonClass('right')}
          onTouchStart={(e) => { e.preventDefault(); handlePress('right'); }}
          onTouchEnd={(e) => { e.preventDefault(); handleRelease('right'); }}
          onTouchCancel={handleReleaseAll}
        >
          <ChevronRight className="size-7 text-white/80" />
        </button>

        {/* Row 3: empty - down - empty */}
        <div />
        <button
          className={buttonClass('down')}
          onTouchStart={(e) => { e.preventDefault(); handlePress('down'); }}
          onTouchEnd={(e) => { e.preventDefault(); handleRelease('down'); }}
          onTouchCancel={handleReleaseAll}
        >
          <ChevronDown className="size-7 text-white/80" />
        </button>
        <div />
      </div>

      {/* Action buttons removed — bump-to-interact replaces E/T keys */}
    </div>
  );
}
