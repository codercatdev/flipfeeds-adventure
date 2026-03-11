'use client';

import { useMemo } from 'react';
import { CHARACTER_TYPES, getAvatarFrames, getFramePixelPosition } from '@flipfeeds/shared';
import type { AvatarConfig } from '@flipfeeds/shared';

interface UserInfoHUDProps {
  userName: string;
  avatarConfig: AvatarConfig;
  onChangeAvatar: () => void;
  onSignOut: () => void;
}

export function UserInfoHUD({ userName, avatarConfig, onChangeAvatar, onSignOut }: UserInfoHUDProps) {
  const { spriteName, spritePos } = useMemo(() => {
    const type = CHARACTER_TYPES[avatarConfig.characterType];
    const name = type?.name ?? 'Unknown';
    const frames = getAvatarFrames(avatarConfig);
    const pos = getFramePixelPosition(frames.idleDown);
    return { spriteName: name, spritePos: pos };
  }, [avatarConfig]);

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#e0e0e0',
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '8px 14px',
      borderRadius: '8px',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      pointerEvents: 'auto',
    }}>
      {/* Avatar sprite preview */}
      <div style={{
        width: '48px',
        height: '48px',
        backgroundImage: 'url(/assets/tilesets/oryx_16bit_scifi_creatures_trans.png)',
        backgroundPosition: `-${spritePos.x * 2}px -${spritePos.y * 2}px`,
        backgroundSize: `${32 * 24 * 2}px auto`,
        imageRendering: 'pixelated',
        borderRadius: '4px',
        border: '2px solid #333366',
        flexShrink: 0,
      }} />

      {/* User info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
          {userName}
        </div>
        <div style={{ fontSize: '10px', color: '#88ff88' }}>
          {spriteName}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onChangeAvatar}
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#88bbff',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Change Avatar
          </button>
          <button
            onClick={onSignOut}
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#ff8888',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
