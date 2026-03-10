'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameEvent } from '../../hooks/useGameEvent';

interface VideoPanelProps {
  zoneId: string;
  onClose: () => void;
}

// Video source registry
const VIDEO_SOURCES: Record<string, { type: 'youtube' | 'twitch' | 'mp4'; src: string; title: string }> = {
  'stage-main': { type: 'youtube', src: 'dQw4w9WgXcQ', title: 'Main Stage \u2014 Keynote' },
  'stage-side': { type: 'youtube', src: 'dQw4w9WgXcQ', title: 'Side Stage \u2014 Workshop' },
};

export function VideoPanel({ zoneId, onClose }: VideoPanelProps) {
  const [volume, setVolume] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasPosition, setHasPosition] = useState(false);

  // Listen for proximity updates to adjust volume and position
  useGameEvent('ZONE_PROXIMITY', useCallback((data) => {
    if (data.zoneId !== zoneId) return;
    const vol = 1 - data.normalizedDistance;
    setVolume(Math.max(0, vol));
    setOpacity(Math.min(1, vol + 0.3));
    
    // Anchor to zone screen position if available
    if ((data as any).zoneScreenPos) {
      setPosition((data as any).zoneScreenPos);
      setHasPosition(true);
    }
  }, [zoneId]));

  // Fade in on mount
  useEffect(() => {
    setOpacity(0.3);
  }, []);

  const source = VIDEO_SOURCES[zoneId];
  if (!source) return null;

  // Position: anchor near zone if we have coords, otherwise top-right
  const panelStyle: React.CSSProperties = hasPosition ? {
    position: 'fixed',
    left: `${Math.min(position.x, window.innerWidth - 500)}px`,
    top: `${Math.max(20, position.y - 300)}px`,
  } : {
    position: 'fixed',
    top: '20px',
    right: '20px',
  };

  return (
    <div
      style={{
        ...panelStyle,
        width: '480px',
        height: '270px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        opacity,
        transition: 'opacity 0.5s ease, left 0.3s ease, top 0.3s ease',
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      {/* Title bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 51,
      }}>
        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{source.title}</span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          \u2715
        </button>
      </div>
      
      {/* Volume indicator */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '11px',
        color: '#aaa',
        zIndex: 51,
      }}>
        \ud83d\udd0a {Math.round(volume * 100)}%
      </div>

      {source.type === 'youtube' && (
        <iframe
          src={`https://www.youtube.com/embed/${source.src}?autoplay=1&mute=${volume < 0.05 ? 1 : 0}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      )}
    </div>
  );
}
