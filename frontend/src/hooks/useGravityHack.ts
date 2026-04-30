import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMoodStore } from '../stores/moodStore';

const GRAVITY_PERSONAS = new Set(['YANDERE', 'SADODERE', 'DOMINANT', 'YANDERE_STALKER', 'EVIL']);
const ANTI_GRAVITY_VECTOR = new THREE.Vector3(0, 1.2, 0);
const NORMAL_GRAVITY_VECTOR = new THREE.Vector3(0, -9.81, 0); // Standard VRM gravity is usually downward

export const useGravityHack = (vrm: any) => {
  const currentGravity = useRef(new THREE.Vector3(0, -9.81, 0));
  const targetGravity = useRef(new THREE.Vector3(0, -9.81, 0));

  useFrame((_, delta) => {
    if (!vrm || !vrm.springBoneManager) return;

    const mascot = useMoodStore.getState().mascot;
    const persona = (mascot?.emotion || mascot?.action || 'DEFAULT').toUpperCase();
    const voiceVolume = useMoodStore.getState().voiceVolume ?? 0;

    const isFloating = GRAVITY_PERSONAS.has(persona);
    
    // Set target gravity based on persona
    if (isFloating) {
      targetGravity.current.copy(ANTI_GRAVITY_VECTOR);
      // Add voice-reactive jitter/turbulence
      if (voiceVolume > 0.1) {
        targetGravity.current.x += (Math.random() - 0.5) * voiceVolume * 2;
        targetGravity.current.z += (Math.random() - 0.5) * voiceVolume * 2;
        targetGravity.current.y += (Math.random() - 0.5) * voiceVolume * 1;
      }
    } else {
      targetGravity.current.copy(NORMAL_GRAVITY_VECTOR);
    }

    // Smoothly lerp gravity to avoid physics pops
    currentGravity.current.lerp(targetGravity.current, delta * 2.0);

    // Apply to all spring bones
    // Note: VRM 1.0 vs 0.x differences handled via optional chaining
    const manager = vrm.springBoneManager;
    
    // We iterate through springs and update their gravityDir or similar property
    // In three-vrm v1.x, gravity is often a global or per-spring setting.
    if (manager.springs) {
       manager.springs.forEach((spring: any) => {
         // VRM 1.0 springBone gravity Dir
         if (spring.gravityDir) {
           spring.gravityDir.copy(currentGravity.current).normalize();
           spring.gravityPower = isFloating ? 1.5 : 0.5; // Stronger pull when floating
         }
       });
    } else if (manager.jointGroups) {
       // Support for older VRM versions jointGroups
       manager.jointGroups.forEach((group: any) => {
          if (group.gravityDir) {
            group.gravityDir.copy(currentGravity.current).normalize();
            group.gravityPower = isFloating ? 1.0 : 0.2;
          }
       });
    }
  });

  return null;
};
