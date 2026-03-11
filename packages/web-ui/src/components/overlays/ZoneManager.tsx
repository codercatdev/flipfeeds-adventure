'use client';

import { useState, useCallback } from 'react';
import { useGameEvent } from '../../hooks/useGameEvent';
import { ChatBubbleManager } from './ChatBubbleManager';
import { KioskModal } from './KioskModal';
import type { ZoneType } from '@flipfeeds/shared';

interface ActiveZone {
  zoneId: string;
  zoneType: ZoneType;
}

export function ZoneManager() {
  const [activeZones, setActiveZones] = useState<ActiveZone[]>([]);
  const [activeKiosk, setActiveKiosk] = useState<{ zoneId: string; zoneType: 'kiosk' | 'info' } | null>(null);
  const [currentChatZoneId, setCurrentChatZoneId] = useState<string | null>(null);

  // Track zone enter/exit
  useGameEvent('ZONE_ENTER', useCallback((data) => {
    setActiveZones(prev => {
      if (prev.some(z => z.zoneId === data.zoneId)) return prev;
      return [...prev, { zoneId: data.zoneId, zoneType: data.zoneType }];
    });
    // Track current chat zone
    if (data.zoneType === 'chat') {
      setCurrentChatZoneId(data.zoneId);
    }
  }, []));

  useGameEvent('ZONE_EXIT', useCallback((data) => {
    setActiveZones(prev => prev.filter(z => z.zoneId !== data.zoneId));
    // Close chat zone tracking if leaving
    if (data.zoneType === 'chat') {
      setCurrentChatZoneId(prev => prev === data.zoneId ? null : prev);
    }
  }, []));

  // CHAT_OPEN is now handled by ChatSheet in page.tsx

  // Handle kiosk/info interaction (player pressed E)
  useGameEvent('ZONE_INTERACT', useCallback((data) => {
    setActiveKiosk({ zoneId: data.zoneId, zoneType: data.zoneType });
  }, []));

  // Derived state
  const activeChatZone = activeZones.find(z => z.zoneType === 'chat');

  return (
    <>
      {/* Chat bubbles — always rendered, but filtered by current zone */}
      <ChatBubbleManager currentZoneId={currentChatZoneId} />

      {/* Chat input is now handled by ChatSheet in page.tsx (shadcn Sheet with PAUSE_INPUT) */}

      {/* Video zones are now handled by VideoDialog in page.tsx (shadcn Dialog with PAUSE_INPUT) */}

      {/* Kiosk/Info modal */}
      {activeKiosk && (
        <KioskModal
          zoneId={activeKiosk.zoneId}
          zoneType={activeKiosk.zoneType}
          onClose={() => setActiveKiosk(null)}
        />
      )}

      {/* Zone indicator badges — shows when in any zone */}
      {activeZones.length > 0 && !activeKiosk && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          pointerEvents: 'none',
        }}>
          {activeZones.map(zone => (
            <div
              key={zone.zoneId}
              style={{
                padding: '6px 12px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '20px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: zone.zoneType === 'chat' ? '#00ff88' :
                       zone.zoneType === 'kiosk' ? '#0088ff' :
                       zone.zoneType === 'video' ? '#8800ff' :
                       zone.zoneType === 'webrtc' ? '#ff8800' : '#ffaa00',
                backdropFilter: 'blur(4px)',
              }}
            >
              {zone.zoneType === 'chat' ? '\ud83d\udcac' :
               zone.zoneType === 'kiosk' ? '\ud83d\udccb' :
               zone.zoneType === 'video' ? '\ud83c\udfac' :
               zone.zoneType === 'webrtc' ? '\ud83d\udcf9' : '\u2139\ufe0f'}{' '}
              {zone.zoneId.replace(/-/g, ' ')}
              {zone.zoneType === 'chat' && ' \u2014 Press T to chat'}
              {(zone.zoneType === 'kiosk' || zone.zoneType === 'info') && ' \u2014 Press E to interact'}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
