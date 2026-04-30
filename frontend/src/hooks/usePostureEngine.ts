import { useRef, useCallback } from "react";
import * as THREE from "three";
import { dampQ } from "maath/easing";

/**
 *  usePostureEngine — Biological & Additive Silhouette Layer
 * Refined for zero-stutter cinematic sequences and smooth slerp transitions.
 */
export const usePostureEngine = () => {
  const currentHeadQuat = useRef(new THREE.Quaternion());
  const targetHeadQuat = useRef(new THREE.Quaternion());
  const workEuler = new THREE.Euler();

  /**
   * updatePosture — The per-frame update loop managed by VRMScene
   */
  const updatePosture = useCallback((
    vrms: any[],
    delta: number,
    _charGroup: THREE.Group,
    persona: string,
    emotion: string,
    emotionTime: number,
    _winkActive: boolean
  ) => {
    if (!vrms.length) return;

    // 1. Reset target to identity (Additive)
    targetHeadQuat.current.identity();

    const p = persona.toUpperCase();
    const e = emotion.toUpperCase();
    
    //  PERSONA BASE TILT CONFIG
    let targetPitch = 0;
    let targetYaw = 0;
    let targetRoll = 0;

    switch (p) {
      case 'YANDERE':
      case 'SADODERE':
        targetPitch = 0.20; targetRoll = 0.05; break;
      case 'GOTH_MOMMY':
      case 'KAMIDERE':
      case 'DOMINANT':
        targetPitch = -0.15; break;
      case 'HAJIDERE':
      case 'ANXIOUS':
        targetPitch = 0.15; targetYaw = -0.12; break;
    }

    //  BIOLOGICAL HEAD TILT (PLAYFUL)
    // Synchronized with the 1.2s Wink Sequence
    if (e === 'PLAYFUL') {
      const t = emotionTime;
      // --- ASYMMETRIC BIOLOGICAL TIMING (TIGHT SNAPPY 0.45s) ---
      // 0.0s to 0.15s: Anticipation & Approach (Ease-In)
      if (t < 0.15) {
        const progress = t / 0.15;
        const eased = 1 - Math.pow(1 - progress, 3); 
        targetRoll = eased * -0.35;
      } 
      // 0.15s to 0.30s: The Charm Hold (TIGHT HOLD)
      else if (t < 0.30) {
        targetRoll = -0.35;
      } 
      // 0.30s to 0.45s: Resolution (Ease-Out)
      else if (t < 0.45) {
        const progress = (t - 0.30) / 0.15;
        const eased = Math.sin((progress * Math.PI) / 2);
        targetRoll = -0.35 * (1 - eased);
      }
    } else if (e === 'CONFUSED' || e === 'CURIOUS') {
      targetRoll = 0.20;
    } else if (e === 'POSSESSIVE') {
      //  THE PREDATOR TILT (KUBRICK)
      targetPitch = 0.55;  //  Chin way down (Extreme Kubrick)
      targetRoll = 0.15;   // Uncanny head tilt (Refined from 0.10)
    }

    // Convert Target Angles to working primitives
    workEuler.set(targetPitch, targetYaw, targetRoll);
    targetHeadQuat.current.setFromEuler(workEuler);

    //  BIOLOGICAL DAMPING (Organic Movement)
    const isSpecial = e === 'POSSESSIVE' || e === 'PLAYFUL';
    const smoothTime = isSpecial ? 0.1 : 0.2; 
    dampQ(currentHeadQuat.current, targetHeadQuat.current, smoothTime, delta);

    // 3. Apply to all active VRMs
    vrms.forEach(vrm => {
      if (!vrm || !vrm.humanoid) return;
      const head = vrm.humanoid.getNormalizedBoneNode("head");
      if (!head) return;

      if (isSpecial) {
        //  FORCE OVERRIDE: Directly damp to target to override Mixamo animation
        dampQ(head.quaternion, targetHeadQuat.current, 0.1, delta);
      } else {
        // Normal additive mode: Multiply our procedural layer onto the base animation
        head.quaternion.multiply(currentHeadQuat.current);
      }
    });
  }, []);

  return updatePosture;
};
