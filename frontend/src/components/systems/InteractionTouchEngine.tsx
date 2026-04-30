/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  INTERACTION TOUCH ENGINE v2.0 — Optimized Tactile Soul                    ║
 * ║  Zero Re-renders | Direct VRM Mutation | Persona-Specific Reactions       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface InteractionTouchEngineProps {
  vrm: VRM | null;
  activePersona: string;
}

/**
 * High-performance interaction layer for physical touch.
 * This component uses direct VRM expression mutation inside useFrame 
 * to ensure 60fps responsiveness without React re-renders.
 */
export function InteractionTouchEngine({ vrm, activePersona }: InteractionTouchEngineProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // ── REFS: INTERACTION STATE (Zero re-renders) ──
  const isPointerDown = useRef(false);
  const rubbingAccumulator = useRef(0);
  const currentExpressionAlpha = useRef(0); // For smooth lerping

  // ── HELPER OBJECTS (Pre-allocated for Zero GC) ──
  const headPos = useRef(new THREE.Vector3());
  const headQuat = useRef(new THREE.Quaternion());

  // ── TUNING CONSTANTS ──
  const RUB_THRESHOLD = 0.5; // Seconds of continuous rubbing to trigger "Happy"
  const DECAY_RATE = 2.0;    // Speed of expression "cooling down"
  const LERP_SPEED = 0.08;   // Smoothness of expression transitions

  useFrame((_, delta) => {
    if (!vrm || !meshRef.current) return;

    // 1. Sync Hitbox to Head Bone (High Precision)
    const head = vrm.humanoid?.getRawBoneNode('head');
    if (head) {
      head.getWorldPosition(headPos.current); head.getWorldQuaternion(headQuat.current);
      meshRef.current.position.copy(headPos.current);
      meshRef.current.position.y += 0.05; // Covering the "Petting Zone"
      meshRef.current.quaternion.copy(headQuat.current);
    }

    // 2. Accumulate Rubbing Input
    if (!isPointerDown.current) {
      // Natural decay when not interacting
      rubbingAccumulator.current = Math.max(0, rubbingAccumulator.current - delta * DECAY_RATE);
    }

    // 3. Dynamic Expression Modulation (Direct Mutation)
    if (vrm.expressionManager) {
      const isBeingPetted = rubbingAccumulator.current > RUB_THRESHOLD;
      const targetAlpha = isBeingPetted ? 1.0 : 0.0;

      // Smoothly lerp the alpha to avoid jitter
      currentExpressionAlpha.current = THREE.MathUtils.lerp(
        currentExpressionAlpha.current,
        targetAlpha,
        LERP_SPEED
      );

      const alpha = currentExpressionAlpha.current;
      const persona = activePersona.toLowerCase();

      if (alpha > 0.001) {
        if (persona.includes('tsundere')) {
          vrm.expressionManager.setValue('angry', alpha);
          vrm.expressionManager.setValue('blink', 0);
        } else {
          vrm.expressionManager.setValue('joy', alpha);
          vrm.expressionManager.setValue('blink', alpha);
          vrm.expressionManager.setValue('extra:blush', alpha);
          vrm.expressionManager.setValue('lookup_blush', alpha);
        }
      }
    }
  });

  // ── POINTER EVENTS (Minimal & Fast) ──
  const onPointerDown = useCallback(() => { isPointerDown.current = true; }, []);
  const onPointerUp = useCallback(() => { isPointerDown.current = false; }, []);

  const onPointerMove = useCallback((e: any) => {
    if (isPointerDown.current) {
      // We detect "active rubbing" (continuous movement)
      // Accumulate time + a speed bonus for frantic petting
      const movementDelta = Math.abs(e.delta.x) + Math.abs(e.delta.y);
      rubbingAccumulator.current = Math.min(3.0, rubbingAccumulator.current + 0.016 + movementDelta * 0.002);
    }
  }, []);

  return (
    <mesh
      ref={meshRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerUp} // Leaves the head? Stop rubbing.
      onPointerMove={onPointerMove}
    >
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
