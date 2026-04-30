import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import { damp } from 'maath/easing';
import { useMoodStore } from '../stores/moodStore';

const WARP_PERSONAS = new Set(['YANDERE', 'YANDERE_STALKER', 'SHOCKED', 'FEAR', 'SADODERE']);
const TRAUMA_PERSONAS = new Set(['YANDERE_STALKER', 'SHOCKED', 'FEAR', 'EVIL', 'SADODERE']);

const DEFAULT_FOV = 35;
const DEFAULT_Z = 4.0;
const WARP_FOV = 52;
const WARP_Z = 2.6;

const DAMP_SPEED = 0.5;
const TRAUMA_DECAY = 1.2; // Higher is faster decay
const SHAKE_INTENSITY = 0.08;
const SHAKE_ROT_INTENSITY = 0.04;

export const useDollyZoom = () => {
  const smooth = useRef({ fov: DEFAULT_FOV, z: DEFAULT_Z, trauma: 0.0 });
  const prevPersona = useRef('');
  const prevVoicePeak = useRef(false);

  useFrame((state, delta) => {
    if ((window as any).__cinematicLock === true) return;

    const mascot = useMoodStore.getState().mascot;
    const persona = (mascot?.emotion || mascot?.action || 'DEFAULT').toUpperCase();
    const voiceVolume = useMoodStore.getState().voiceVolume ?? 0;
    const t = state.clock.elapsedTime;

    // 1. Trauma Spiking Logic
    if (persona !== prevPersona.current) {
       if (TRAUMA_PERSONAS.has(persona)) {
          smooth.current.trauma = 1.0; // Instant spike on persona shift
       }
       prevPersona.current = persona;
    }

    // Voice peak detection (Volume > 0.8)
    const voicePeak = voiceVolume > 0.8;
    if (voicePeak && !prevVoicePeak.current) {
       smooth.current.trauma = Math.min(1.0, smooth.current.trauma + 0.6); // Add trauma on shout
    }
    prevVoicePeak.current = voicePeak;

    // 2. Continuous Trauma Decay
    damp(smooth.current, 'trauma', 0, TRAUMA_DECAY, delta);

    // 3. Dolly Zoom Targets
    const isWarped = WARP_PERSONAS.has(persona);
    const targetFov = isWarped ? WARP_FOV : DEFAULT_FOV;
    const targetZ = isWarped ? WARP_Z : DEFAULT_Z;

    damp(smooth.current, 'fov', targetFov, DAMP_SPEED, delta);
    damp(smooth.current, 'z', targetZ, DAMP_SPEED, delta);

    // 4. Transform Camera
    const cam = state.camera as THREE.PerspectiveCamera;
    
    // Apply smooth FOV
    cam.fov = smooth.current.fov;
    
    // Base position
    const currentZ = cam.position.z;
    const isNearDefault = Math.abs(currentZ - DEFAULT_Z) < 2.5 || isWarped;
    if (isNearDefault) {
       cam.position.z = smooth.current.z;
    }

    // 5. Apply Trauma Shake (High-frequency noise)
    const traumaSq = smooth.current.trauma * smooth.current.trauma;
    if (traumaSq > 0.01) {
       // Using stacked sine waves for deterministic but non-repeating noise feel
       const sx = Math.sin(t * 137.0) * 0.5 + Math.sin(t * 73.0) * 0.3 + Math.sin(t * 31.0) * 0.2;
       const sy = Math.cos(t * 127.0) * 0.5 + Math.cos(t * 61.0) * 0.3 + Math.cos(t * 43.0) * 0.2;
       const sz = Math.sin(t * 107.0) * 0.5 + Math.sin(t * 53.0) * 0.3 + Math.cos(t * 23.0) * 0.2;
       const rz = Math.sin(t * 117.0) * 0.6 + Math.cos(t * 47.0) * 0.4;

       cam.position.x += sx * traumaSq * SHAKE_INTENSITY;
       cam.position.y += sy * traumaSq * SHAKE_INTENSITY;
       cam.position.z += sz * traumaSq * SHAKE_INTENSITY;
       cam.rotation.z += rz * traumaSq * SHAKE_ROT_INTENSITY;
    }

    cam.updateProjectionMatrix();

    // LookAt correction when shake is low
    if (traumaSq < 0.2) {
       cam.lookAt(0, 0.5, 0);
    }
  });
};
