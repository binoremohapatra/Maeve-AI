import { useRef, useCallback } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { damp, damp3, dampQ } from 'maath/easing';

type IdleIntensity = 'STILL' | 'CALM' | 'NORMAL' | 'RESTLESS' | 'AGITATED';

interface AutonomousState {
  intensity: number;
  isActionPlaying: boolean;

  // A: Micro-Motion
  noiseSeed: number;

  // B: Eye Dart
  eyeState: 'CONTACT' | 'DART' | 'RETURNING';
  eyeTarget: THREE.Vector3;
  eyeCurrent: THREE.Vector3;
  eyeTimer: number;

  // C: Blink
  blinkTimer: number;
  blinkValue: number;
  isDoubleBlinking: boolean;

  // D: Expression
  expressionDrift: number;
  expressionTimer: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BREATHING CONFIGURATION — Emotion-Dependent Rhythms
// ─────────────────────────────────────────────────────────────────────────────

const BREATHING_CONFIG: Record<string, { freq: number; amp: number }> = {
  DEFAULT: { freq: 0.8, amp: 0.005 },
  RELAXED: { freq: 0.5, amp: 0.003 },
  CONTENT: { freq: 0.6, amp: 0.004 },
  PEACEFUL: { freq: 0.4, amp: 0.003 },
  SLEEPY: { freq: 0.35, amp: 0.0025 },
  SLEEPING: { freq: 0.25, amp: 0.002 },

  ANGRY: { freq: 2.2, amp: 0.012 },
  FRUSTRATED: { freq: 1.8, amp: 0.010 },
  JEALOUS: { freq: 1.5, amp: 0.008 },

  EXCITED: { freq: 2.0, amp: 0.010 },
  JOY: { freq: 1.2, amp: 0.007 },

  LUST: { freq: 1.8, amp: 0.008 },
  SEXY: { freq: 1.6, amp: 0.007 },
  PLEASURE: { freq: 2.5, amp: 0.015 },
  AHEGAO: { freq: 3.0, amp: 0.020 },
  ECSTASY: { freq: 3.5, amp: 0.025 },

  SURPRISED: { freq: 0.1, amp: 0.001 }, // Holding breath
  SHOCKED: { freq: 0.05, amp: 0.0005 },
  FEAR: { freq: 4.0, amp: 0.008 }, // Shallow fast panting
  NERVOUS: { freq: 1.8, amp: 0.006 },

  SAD: { freq: 0.7, amp: 0.006 }, // Heavy sighs
  CRYING: { freq: 2.5, amp: 0.018 }, // Sobbing gasps
  HURT: { freq: 1.1, amp: 0.008 },
};

export const useAutonomousEngine = () => {
  const stateRef = useRef<AutonomousState>({
    intensity: 1.0,
    isActionPlaying: false,
    noiseSeed: Math.random() * 100,
    eyeState: 'CONTACT',
    eyeTarget: new THREE.Vector3(0, 0, 0),
    eyeCurrent: new THREE.Vector3(0, 0, 0),
    eyeTimer: 2 + Math.random() * 3,
    blinkTimer: 3 + Math.random() * 4,
    blinkValue: 0,
    isDoubleBlinking: false,
    expressionDrift: 0,
    expressionTimer: 5 + Math.random() * 5,
  });

  const setIntensity = useCallback((label: IdleIntensity) => {
    const mapping: Record<IdleIntensity, number> = {
      STILL: 0.1,
      CALM: 0.5,
      NORMAL: 1.0,
      RESTLESS: 1.8,
      AGITATED: 2.5,
    };
    stateRef.current.intensity = mapping[label] || 1.0;
  }, []);

  const setActionActive = useCallback((active: boolean) => {
    stateRef.current.isActionPlaying = active;
  }, []);

  const nextSaccadeTimeRef = useRef(0);
  const eyeTargetOffset = useRef(new THREE.Vector2());

  const _eyeQuat = useRef(new THREE.Quaternion());
  const _eyeEuler = useRef(new THREE.Euler());

  const update = (vrm: any, delta: number, clock: THREE.Clock | undefined, emotion: string = 'NEUTRAL', winkActive: boolean = false, suppressionValue: number = 1.0) => {
    if (!vrm || winkActive) return;
    const s = stateRef.current;

    // Performance now based on clock if provided, else performance.now()
    const time = clock ? clock.getElapsedTime() : performance.now() / 1000;
    const t = time + s.noiseSeed;

    const targetGlobal = s.isActionPlaying ? 0 : 1;
    const internalScale = s.intensity * targetGlobal * suppressionValue; //  Suppress noise during emotions

    // --- 1. Breathing (Emotion-Aware Sinusoidal sway) ---
    const spine = vrm.humanoid?.getRawBoneNode('spine');
    const upperChest = vrm.humanoid?.getRawBoneNode('upperChest') || vrm.humanoid?.getRawBoneNode('chest');

    if (spine && upperChest) {
      const config = BREATHING_CONFIG[emotion.toUpperCase()] || BREATHING_CONFIG.DEFAULT;

      // We apply a base frequency + emotion-driven rhythm
      const breatheFactor = Math.sin(t * config.freq) * config.amp * internalScale;

      //  Additive rotations (rotateZ/X)
      spine.rotateZ(breatheFactor);
      upperChest.rotateX(breatheFactor * 0.5);
    }

    // --- 2. Perlin Noise Posture (Halka sa shake in Neck/Head) ---
    const neck = vrm.humanoid?.getRawBoneNode('neck');
    if (neck) {
      const neckSwayX = (Math.sin(t * 1.5) + Math.sin(t * 0.7)) * 0.002 * internalScale;
      const neckSwayY = (Math.cos(t * 1.3) + Math.cos(t * 0.9)) * 0.001 * internalScale;

      neck.rotateX(neckSwayX);
      neck.rotateY(neckSwayY);
    }

    // B: Eye Dart State Machine (Legacy Bone Rotation)
    // We keep this temporarily but add blendshape saccades on top
    s.eyeTimer -= delta;
    if (s.eyeState === 'CONTACT' && s.eyeTimer <= 0) {
      s.eyeState = 'DART';
      s.eyeTimer = 0.1 + Math.random() * 0.2;
      s.eyeTarget.set(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.1,
        0
      );
    } else if (s.eyeState === 'DART' && s.eyeTimer <= 0) {
      s.eyeState = 'RETURNING';
      s.eyeTimer = 0.2 + Math.random() * 0.3;
      s.eyeTarget.set(0, 0, 0);
    } else if (s.eyeState === 'RETURNING' && s.eyeTimer <= 0) {
      s.eyeState = 'CONTACT';
      s.eyeTimer = 2 + Math.random() * 4;
    }

    // Spring-Damper for eyes (Bone Rotation - Legacy)
    damp3(s.eyeCurrent, s.eyeTarget, 0.05, delta);
    const vrmLeftEye = vrm.humanoid?.getNormalizedBoneNode('leftEye');
    const vrmRightEye = vrm.humanoid?.getNormalizedBoneNode('rightEye');
    if (vrmLeftEye && vrmRightEye) {
      _eyeEuler.current.set(s.eyeCurrent.y, s.eyeCurrent.x, 0);
      _eyeQuat.current.setFromEuler(_eyeEuler.current);
      vrmLeftEye.quaternion.premultiply(_eyeQuat.current);
      vrmRightEye.quaternion.premultiply(_eyeQuat.current);
    }

    // --- 3. Eye Darts (Saccades via Blendshapes) ---
    if (vrm.expressionManager && time > nextSaccadeTimeRef.current) {
      const saccadeIntensity = 0.03 * s.intensity;
      eyeTargetOffset.current.set(
        (Math.random() - 0.5) * saccadeIntensity,
        (Math.random() - 0.5) * saccadeIntensity * 0.5
      );
      nextSaccadeTimeRef.current = time + 0.5 + Math.random() * 2.5;
    }

    if (vrm.expressionManager) {
      // Apply micro-motions to gaze blendshapes smoothly
      const targetX = eyeTargetOffset.current.x;
      const targetY = eyeTargetOffset.current.y;

      // VRM expression names for gaze
      const lookLeft = targetX < 0 ? -targetX : 0;
      const lookRight = targetX > 0 ? targetX : 0;
      const lookDown = targetY < 0 ? -targetY : 0;
      const lookUp = targetY > 0 ? targetY : 0;

      // Smooth blend (lerp)
      const lerpVal = (cur: number, tar: number) => THREE.MathUtils.lerp(cur, tar, delta * 10);

      vrm.expressionManager.setValue('lookLeft', lerpVal(vrm.expressionManager.getValue('lookLeft') || 0, lookLeft));
      vrm.expressionManager.setValue('lookRight', lerpVal(vrm.expressionManager.getValue('lookRight') || 0, lookRight));
      vrm.expressionManager.setValue('lookDown', lerpVal(vrm.expressionManager.getValue('lookDown') || 0, lookDown));
      vrm.expressionManager.setValue('lookUp', lerpVal(vrm.expressionManager.getValue('lookUp') || 0, lookUp));
    }

    // C: Blink System (Non-metronomic)
    if (emotion.toUpperCase() === 'PLAYFUL') {
      s.blinkTimer = 1.0; // Reset timer so it doesn't fire immediately after the wink
      s.blinkValue = 0;   // Force eyes open for the cinematic wink override
    } else {
      s.blinkTimer -= delta;
      if (s.blinkTimer <= 0) {
        s.blinkValue = 1.0;
        const isDouble = Math.random() < 0.08;
        const baseInterval = 6 + Math.random() * 6;
        s.blinkTimer = isDouble ? 0.12 : baseInterval / (s.intensity * 0.3 + 0.7);
      }
    }

    if (s.blinkValue > 0) {
      s.blinkValue = Math.max(0, s.blinkValue - delta * 25);
      if (vrm.expressionManager) {
        vrm.expressionManager.setValue('blink', s.blinkValue);
        vrm.expressionManager.update();
      }
    }

    // D: Expression Blending (Subtle Drift)
    s.expressionTimer -= delta;
    if (s.expressionTimer <= 0) {
      s.expressionDrift = (Math.random() - 0.5) * 0.1 * internalScale;
      s.expressionTimer = 3 + Math.random() * 4;
    }
  };

  return { update, setIntensity, setActionActive };

};
