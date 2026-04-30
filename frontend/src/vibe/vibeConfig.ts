export type PersonaType =
  | 'YANDERE' | 'TSUNDERE' | 'KUUDERE' | 'DEREDERE'
  | 'DANDERE' | 'HIMEDERE' | 'KAMIDERE' | 'MAYADERE'
  | 'IYASHIKEI' | 'GOTHIC' | 'ANXIOUS' | 'DEFAULT';

export interface VibeProfile {
  // Bloom
  bloomIntensity: number;
  bloomLuminanceThreshold: number;
  bloomLuminanceSmoothing: number;
  // Vignette
  vignetteIntensity: number;
  vignetteOffset: number;
  // Chromatic Aberration
  chromaticOffsetX: number;
  chromaticOffsetY: number;
  // Color Grading (tint as RGB 0-1)
  tintR: number;
  tintG: number;
  tintB: number;
  tintStrength: number;
  // Camera
  camX: number;
  camY: number;
  camZ: number;
  lookAtY: number;
  fov: number;
  // Shake
  baseShake: number;
  // UI Strain (4th wall)
  uiStrained: number;
  // Glitch on transition
  triggerGlitch: boolean;
}

export const VIBE_PROFILES: Record<PersonaType, VibeProfile> = {
  YANDERE: {
    bloomIntensity: 0.1, bloomLuminanceThreshold: 0.9, bloomLuminanceSmoothing: 0.3,
    vignetteIntensity: 0.8, vignetteOffset: 0.2,
    chromaticOffsetX: 0.005, chromaticOffsetY: 0.005,
    tintR: 0.8, tintG: 0.0, tintB: 0.1, tintStrength: 0.15,
    camX: 0, camY: 1.45, camZ: 0.5,
    lookAtY: 1.6, fov: 35,
    baseShake: 0.002, uiStrained: 1.0, triggerGlitch: true,
  },
  TSUNDERE: {
    bloomIntensity: 0.6, bloomLuminanceThreshold: 0.4, bloomLuminanceSmoothing: 0.5,
    vignetteIntensity: 0.2, vignetteOffset: 0.5,
    chromaticOffsetX: 0.001, chromaticOffsetY: 0.0,
    tintR: 1.0, tintG: 0.6, tintB: 0.6, tintStrength: 0.1,
    camX: 0, camY: 1.1, camZ: 2.2,
    lookAtY: 1.3, fov: 45,
    baseShake: 0.0, uiStrained: 0.1, triggerGlitch: false,
  },
  KUUDERE: {
    bloomIntensity: 0.2, bloomLuminanceThreshold: 0.6, bloomLuminanceSmoothing: 0.8,
    vignetteIntensity: 0.3, vignetteOffset: 0.4,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 0.54, tintG: 0.62, tintB: 0.75, tintStrength: 0.2,
    camX: 0, camY: 1.0, camZ: 3.0,
    lookAtY: 1.2, fov: 40,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
  DEREDERE: {
    bloomIntensity: 1.5, bloomLuminanceThreshold: 0.1, bloomLuminanceSmoothing: 0.9,
    vignetteIntensity: 0.0, vignetteOffset: 0.5,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 1.0, tintG: 0.85, tintB: 0.9, tintStrength: 0.12,
    camX: 0, camY: 1.2, camZ: 2.0,
    lookAtY: 1.4, fov: 42,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
  DANDERE: {
    bloomIntensity: 0.4, bloomLuminanceThreshold: 0.5, bloomLuminanceSmoothing: 0.7,
    vignetteIntensity: 0.15, vignetteOffset: 0.5,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 0.85, tintG: 0.9, tintB: 1.0, tintStrength: 0.08,
    camX: 0, camY: 1.6, camZ: 2.8,
    lookAtY: 1.5, fov: 44,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
  ANXIOUS: {
    bloomIntensity: 0.15, bloomLuminanceThreshold: 0.7, bloomLuminanceSmoothing: 0.3,
    vignetteIntensity: 0.5, vignetteOffset: 0.3,
    chromaticOffsetX: 0.002, chromaticOffsetY: 0.002,
    tintR: 0.7, tintG: 0.7, tintB: 0.6, tintStrength: 0.1,
    camX: 0, camY: 1.6, camZ: 2.8,
    lookAtY: 1.4, fov: 50,
    baseShake: 0.001, uiStrained: 0.3, triggerGlitch: false,
  },
  HIMEDERE: {
    bloomIntensity: 1.0, bloomLuminanceThreshold: 0.2, bloomLuminanceSmoothing: 0.6,
    vignetteIntensity: 0.1, vignetteOffset: 0.5,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 1.0, tintG: 0.9, tintB: 0.5, tintStrength: 0.15,
    camX: 0, camY: 0.6, camZ: 2.0,
    lookAtY: 1.3, fov: 50,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
  KAMIDERE: {
    bloomIntensity: 0.8, bloomLuminanceThreshold: 0.3, bloomLuminanceSmoothing: 0.5,
    vignetteIntensity: 0.4, vignetteOffset: 0.3,
    chromaticOffsetX: 0.002, chromaticOffsetY: 0.0,
    tintR: 0.9, tintG: 0.85, tintB: 1.0, tintStrength: 0.12,
    camX: 0, camY: 0.5, camZ: 1.8,
    lookAtY: 1.2, fov: 52,
    baseShake: 0.0, uiStrained: 0.1, triggerGlitch: false,
  },
  MAYADERE: {
    bloomIntensity: 0.3, bloomLuminanceThreshold: 0.6, bloomLuminanceSmoothing: 0.4,
    vignetteIntensity: 0.6, vignetteOffset: 0.25,
    chromaticOffsetX: 0.003, chromaticOffsetY: 0.001,
    tintR: 0.3, tintG: 0.6, tintB: 0.4, tintStrength: 0.2,
    camX: 0, camY: 1.2, camZ: 1.5,
    lookAtY: 1.5, fov: 38,
    baseShake: 0.001, uiStrained: 0.4, triggerGlitch: true,
  },
  GOTHIC: {
    bloomIntensity: 0.05, bloomLuminanceThreshold: 0.8, bloomLuminanceSmoothing: 0.2,
    vignetteIntensity: 0.7, vignetteOffset: 0.15,
    chromaticOffsetX: 0.001, chromaticOffsetY: 0.001,
    tintR: 0.2, tintG: 0.1, tintB: 0.3, tintStrength: 0.25,
    camX: 0, camY: 0.8, camZ: 1.8,
    lookAtY: 1.1, fov: 55,
    baseShake: 0.0, uiStrained: 0.2, triggerGlitch: false,
  },
  IYASHIKEI: {
    bloomIntensity: 0.8, bloomLuminanceThreshold: 0.2, bloomLuminanceSmoothing: 0.9,
    vignetteIntensity: 0.0, vignetteOffset: 0.5,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 0.85, tintG: 1.0, tintB: 0.85, tintStrength: 0.1,
    camX: 0, camY: 1.1, camZ: 2.5,
    lookAtY: 1.3, fov: 40,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
  DEFAULT: {
    bloomIntensity: 0.3, bloomLuminanceThreshold: 0.5, bloomLuminanceSmoothing: 0.5,
    vignetteIntensity: 0.2, vignetteOffset: 0.5,
    chromaticOffsetX: 0.0, chromaticOffsetY: 0.0,
    tintR: 1.0, tintG: 1.0, tintB: 1.0, tintStrength: 0.0,
    camX: 0, camY: 0.8, camZ: 7.0,
    lookAtY: 0.2, fov: 35,
    baseShake: 0.0, uiStrained: 0.0, triggerGlitch: false,
  },
};

// Persona to VibeProfile mapper
export const PERSONA_TO_VIBE: Record<string, PersonaType> = {
  'Yandere': 'YANDERE',
  'Tsundere': 'TSUNDERE',
  'Kuudere': 'KUUDERE',
  'Deredere': 'DEREDERE',
  'Dandere': 'DANDERE',
  'Iyashi': 'IYASHIKEI',
  'Anxious': 'ANXIOUS',
  'Gothic': 'GOTHIC',
  'DEFAULT': 'DEFAULT',
};
