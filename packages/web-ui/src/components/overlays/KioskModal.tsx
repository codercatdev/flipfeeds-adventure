'use client';

import { useEffect } from 'react';
import { eventBus } from '@flipfeeds/game-client/events';

interface KioskModalProps {
  zoneId: string;
  zoneType: 'kiosk' | 'info';
  onClose: () => void;
}

// Content registry - maps zone IDs to their modal content
const KIOSK_CONTENT: Record<string, { title: string; description: string }> = {
  'kiosk-schedule': {
    title: '\u{1F4C5} Event Schedule',
    description: 'View the full event schedule with keynotes, workshops, and networking sessions.',
  },
  'info-desk': {
    title: '\u{2139}\u{FE0F} Information',
    description: 'Learn about controls, chat zones, and video lounges.',
  },
  'meeting-room': {
    title: '\ud83d\udcbc Meeting Room',
    description: 'Book a private meeting room for focused discussions with your team.',
  },
};

export function KioskModal({ zoneId, zoneType, onClose }: KioskModalProps) {
  // Pause game input when modal opens
  useEffect(() => {
    eventBus.emit('PAUSE_INPUT', undefined as never);
    return () => {
      eventBus.emit('RESUME_INPUT', undefined as never);
      eventBus.emit('KIOSK_CLOSED', undefined as never);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const content = KIOSK_CONTENT[zoneId] || {
    title: zoneType === 'info' ? 'Information' : 'Kiosk',
    description: 'Content coming soon...',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'auto' as const,
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '80vw',
          maxWidth: '800px',
          height: '70vh',
          maxHeight: '600px',
          background: '#1a1a2e',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 300ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{content.title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#aaa',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            \u2715
          </button>
        </div>
        {/* Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto' as const,
          color: '#ddd',
          fontSize: '14px',
          lineHeight: 1.6,
        }}>
          <p>{content.description}</p>
          {zoneId === 'kiosk-schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div style={{ padding: '12px', background: 'rgba(0,255,136,0.1)', borderRadius: '8px', borderLeft: '3px solid #00ff88' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>10:00 AM \u2014 Opening Keynote</div>
                <div style={{ color: '#aaa', fontSize: '13px' }}>Main Stage \u2022 Welcome and project overview</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(0,136,255,0.1)', borderRadius: '8px', borderLeft: '3px solid #0088ff' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>11:30 AM \u2014 Technical Deep Dive</div>
                <div style={{ color: '#aaa', fontSize: '13px' }}>Side Stage \u2022 Architecture and implementation</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(255,170,0,0.1)', borderRadius: '8px', borderLeft: '3px solid #ffaa00' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>1:00 PM \u2014 Workshop</div>
                <div style={{ color: '#aaa', fontSize: '13px' }}>Breakout Room \u2022 Hands-on coding session</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(136,0,255,0.1)', borderRadius: '8px', borderLeft: '3px solid #8800ff' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>3:00 PM \u2014 Closing & Networking</div>
                <div style={{ color: '#aaa', fontSize: '13px' }}>Main Lobby \u2022 Water cooler chat</div>
              </div>
            </div>
          )}
          {zoneId === 'info-desk' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <section>
                <h3 style={{ color: '#00ff88', marginBottom: '8px' }}>Controls</h3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>WASD</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Arrow Keys</kbd> \u2014 Move</li>
                  <li><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>E</kbd> \u2014 Interact with kiosks</li>
                  <li><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>T</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Enter</kbd> \u2014 Open chat (in chat zones)</li>
                  <li><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> \u2014 Close modals / chat</li>
                </ul>
              </section>
              <section>
                <h3 style={{ color: '#0088ff', marginBottom: '8px' }}>Chat Zones</h3>
                <p style={{ color: '#aaa', lineHeight: 1.6 }}>Walk into highlighted areas to chat with nearby players. Messages appear as bubbles above avatars.</p>
              </section>
              <section>
                <h3 style={{ color: '#ffaa00', marginBottom: '8px' }}>Video Lounges</h3>
                <p style={{ color: '#aaa', lineHeight: 1.6 }}>Enter a lounge zone to start a video call with up to 6 other players.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
