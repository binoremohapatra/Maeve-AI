import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
// @ts-ignore
import { damp } from 'maath/easing';

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/**
 * useVoiceReactivityEngine
 * 
 * Centralized Reactivity Engine: 
 * Consumes frequency data from HumanAnimationController.lipSync and converts it into
 * physical bone movements (head bobs, jitters) based on the character's persona.
 */
export function useVoiceReactivityEngine(
  vrm: VRM | null,
  _audioUrl: string | null, // Deprecated: Now uses centralized stream
  activePersona: string,
  isSpeaking: boolean
) {
  const smoothedAmplitude = useRef(0);

  useFrame((_, delta) => {
    if (!vrm || !isSpeaking) {
      const dummy = { val: smoothedAmplitude.current };
      damp(dummy, 'val', 0, 0.15, delta);
      smoothedAmplitude.current = dummy.val;
      return;
    }

    //  NEURAL LINK: Get centralized analysis data from Character Manager
    const charManager = (window as any).characterManager;
    const lipSync = charManager?.mainController?.lipSync;
    
    if (!lipSync || !lipSync.dataArray) return;

    const bins = lipSync.dataArray;

    // --- 1. BONE REACTIVITY (Head Bobs) ---
    // Use low-frequency energy (bins 0-3) for physical bobs
    const bassEnergy = (bins[0] + bins[1] + bins[2] + bins[3]) / 1024;
    
    const dummy = { val: smoothedAmplitude.current };
    damp(dummy, 'val', bassEnergy, 0.1, delta);
    smoothedAmplitude.current = dummy.val;

    const persona = activePersona.toUpperCase();
    let sens = 1.2;
    let tiltMod = 1.0;

    // Persona-specific physical response scaling
    if (persona.includes('YANDERE')) {
      sens = 1.6; // High intensity jitters
      tiltMod = 2.0; 
    } else if (persona.includes('HAJIDERE')) {
      sens = 0.6; // Subtle, shy bobs
      tiltMod = 0.5; 
    } else if (persona.includes('PROFESSIONAL')) {
      sens = 0.8; // Stable, controlled movement
      tiltMod = 0.7;
    }

    const amp = smoothedAmplitude.current * sens;
    const pitch = amp * 0.08; 
    const roll = Math.sin(Date.now() * 0.002) * amp * 0.04 * tiltMod; 

    // Apply reactivity to Head
    const head = vrm.humanoid?.getRawBoneNode('head');
    if (head) {
      _euler.set(pitch, 0, roll);
      _quat.setFromEuler(_euler);
      head.quaternion.multiply(_quat);
    }

    // Apply reactivity to Neck (Damped)
    const neck = vrm.humanoid?.getRawBoneNode('neck');
    if (neck) {
      _euler.set(pitch * 0.5, 0, roll * 0.5);
      _quat.setFromEuler(_euler);
      neck.quaternion.multiply(_quat);
    }
  });
}
