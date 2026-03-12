'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Map d-pad directions to keyboard key codes that Phaser reads
const KEY_MAP = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
} as const;

function simulateKey(key: string, type: 'keydown' | 'keyup') {
  const event = new KeyboardEvent(type, {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  // Dispatch on the canvas element so Phaser's keyboard manager picks it up
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.dispatchEvent(event);
  } else {
    document.dispatchEvent(event);
  }
}

type Direction = 'up' | 'down' | 'left' | 'right';

export function DPad() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const activeDirections = useRef(new Set<Direction>());
  const [pressed, setPressed] = useState<Set<Direction>>(new Set());

  // Only show on touch devices
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handlePress = useCallback((dir: Direction) => {
    if (!activeDirections.current.has(dir)) {
      activeDirections.current.add(dir);
      simulateKey(KEY_MAP[dir], 'keydown');
      setPressed(new Set(activeDirections.current));
    }
  }, []);

  const handleRelease = useCallback((dir: Direction) => {
    if (activeDirections.current.has(dir)) {
      activeDirections.current.delete(dir);
      simulateKey(KEY_MAP[dir], 'keyup');
      setPressed(new Set(activeDirections.current));
    }
  }, []);

  const handleReleaseAll = useCallback(() => {
    for (const dir of activeDirections.current) {
      simulateKey(KEY_MAP[dir], 'keyup');
    }
    activeDirections.current.clear();
    setPressed(new Set());
  }, []);

  // Release all keys when component unmounts or touch is cancelled
  useEffect(() => {
    return () => {
      for (const dir of activeDirections.current) {
        simulateKey(KEY_MAP[dir], 'keyup');
      }
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
      className="fixed bottom-24 left-6 z-50 pointer-events-auto touch-none select-none"
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

      {/* Action buttons on the right side */}
      <div className="absolute -right-20 bottom-8 flex flex-col gap-2">
        <button
          className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/30 text-white/80 text-xs font-bold select-none active:bg-primary/50"
          onTouchStart={(e) => {
            e.preventDefault();
            simulateKey('e', 'keydown');
            setTimeout(() => simulateKey('e', 'keyup'), 100);
          }}
        >
          E
        </button>
        <button
          className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/30 text-white/80 text-xs font-bold select-none active:bg-blue-500/50"
          onTouchStart={(e) => {
            e.preventDefault();
            simulateKey('t', 'keydown');
            setTimeout(() => simulateKey('t', 'keyup'), 100);
          }}
        >
          T
        </button>
      </div>
    </div>
  );
}
