export interface AvatarConfig {
  characterType: number;   // 0-4 (Oryx character row group)
  colorVariant: number;    // 0-3 (column offset in spritesheet)
  accessories?: string[];  // Phase 7: layered accessories
  bodyColor?: string;      // Phase 7: hex color for programmatic recolor
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  avatarConfig: AvatarConfig;
  signalStrength: number;
  createdAt: string;
  updatedAt: string;
}
