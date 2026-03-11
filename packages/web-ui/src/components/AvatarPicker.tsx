'use client';

import { useState, useCallback, useEffect } from 'react';

const CHARACTER_TYPES = [
  { name: 'Scientist', walkDownRow: 13 },
  { name: 'Engineer', walkDownRow: 0 },
  { name: 'Medic', walkDownRow: 9 },
  { name: 'Officer', walkDownRow: 22 },
  { name: 'Operative', walkDownRow: 4 },
] as const;

const COLOR_VARIANTS = [0, 4, 8, 12] as const;

const SPRITE_SIZE = 24;
const COLS_PER_ROW = 32;
const SPRITESHEET_PATH = '/assets/tilesets/oryx_16bit_scifi_creatures_trans.png';

interface AvatarPickerProps {
  onSelect: (config: { characterType: number; colorVariant: number }) => void;
  initialType?: number;
  initialVariant?: number;
}

function getFramePosition(row: number, colOffset: number, walkFrame: number = 0) {
  const frame = row * COLS_PER_ROW + colOffset + walkFrame;
  const x = (frame % COLS_PER_ROW) * SPRITE_SIZE;
  const y = Math.floor(frame / COLS_PER_ROW) * SPRITE_SIZE;
  return { x, y };
}

function SpriteFrame({ row, colOffset, scale = 3, walkFrame = 0 }: {
  row: number;
  colOffset: number;
  scale?: number;
  walkFrame?: number;
}) {
  const { x, y } = getFramePosition(row, colOffset, walkFrame);
  const size = SPRITE_SIZE * scale;

  return (
    <div style={{
      width: size,
      height: size,
      overflow: 'hidden',
    }}>
      <img
        src={SPRITESHEET_PATH}
        alt=""
        draggable={false}
        style={{
          imageRendering: 'pixelated' as any,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          marginLeft: -x * scale,
          marginTop: -y * scale,
        }}
      />
    </div>
  );
}

export function AvatarPicker({ onSelect, initialType = 0, initialVariant = 0 }: AvatarPickerProps) {
  const [selectedType, setSelectedType] = useState(initialType);
  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [walkFrame, setWalkFrame] = useState(0);

  // Animate the preview walk cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setWalkFrame(f => (f + 1) % 4);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = useCallback(() => {
    onSelect({ characterType: selectedType, colorVariant: selectedVariant });
  }, [onSelect, selectedType, selectedVariant]);

  const type = CHARACTER_TYPES[selectedType];
  const colOffset = COLOR_VARIANTS[selectedVariant];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#0a0a1e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#fff',
    }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '8px',
        background: 'linear-gradient(135deg, #00ff88, #0088ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Choose Your Character
      </h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>
        Select a character type and color variant
      </p>

      <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }}>
        {/* Character Type Grid */}
        <div>
          <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Character Type
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {CHARACTER_TYPES.map((charType, typeIdx) => (
              <button
                key={typeIdx}
                onClick={() => setSelectedType(typeIdx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: selectedType === typeIdx ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: selectedType === typeIdx ? '2px solid #00ff88' : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <SpriteFrame
                  row={charType.walkDownRow}
                  colOffset={COLOR_VARIANTS[selectedVariant]}
                  scale={3}
                />
                <span style={{
                  fontSize: '11px',
                  color: selectedType === typeIdx ? '#00ff88' : '#888',
                  fontWeight: selectedType === typeIdx ? 'bold' : 'normal',
                }}>
                  {charType.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          minWidth: '160px',
        }}>
          <h3 style={{ fontSize: '14px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
            Preview
          </h3>
          <div style={{
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
          }}>
            <SpriteFrame
              row={type.walkDownRow}
              colOffset={colOffset}
              scale={4}
              walkFrame={walkFrame}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
              {type.name}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Variant {selectedVariant + 1}
            </div>
          </div>
        </div>
      </div>

      {/* Color Variants */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>
          Color Variant
        </h3>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {COLOR_VARIANTS.map((_, varIdx) => (
            <button
              key={varIdx}
              onClick={() => setSelectedVariant(varIdx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                background: selectedVariant === varIdx ? 'rgba(0, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: selectedVariant === varIdx ? '2px solid #0088ff' : '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <SpriteFrame
                row={CHARACTER_TYPES[selectedType].walkDownRow}
                colOffset={COLOR_VARIANTS[varIdx]}
                scale={2.5}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        style={{
          marginTop: '32px',
          padding: '14px 48px',
          background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
          border: 'none',
          borderRadius: '12px',
          color: '#0a0a1e',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'transform 0.1s ease',
          letterSpacing: '0.5px',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Enter FlipFeeds →
      </button>
    </div>
  );
}
