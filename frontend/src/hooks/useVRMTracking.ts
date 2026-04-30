import { useRef, useEffect } from 'react';
import { useFrame }          from '@react-three/fiber';
import * as THREE            from 'three';
// @ts-ignore
import { damp }              from 'maath/easing';
import { useMoodStore }      from '../stores/moodStore';

const PSYCHO_PERSONAS = new Set([
  'YANDERE', 'YANDERE_STALKER', 'SADODERE', 'DORODERE'
]);

export const useVRMTracking = (vrm: any) => {
  const getPersona = () => {
    const m = useMoodStore.getState().mascot;
    return (m?.emotion || m?.action || 'DEFAULT').toUpperCase();
  };

  // Smoothed mouse in [-1,1] space
  const smoothMouse = useRef(new THREE.Vector2(0, 0));
  const rawMouse    = useRef(new THREE.Vector2(0, 0));

  // Blend scalar: 1 = full mouse follow, 0 = full psycho lock
  const blend = useRef({ v: 1.0 });

  // Disable VRM's built-in lookAt so we own bone rotation exclusively
  useEffect(() => {
    if (!vrm?.lookAt) return;
    vrm.lookAt.autoUpdate = false;
    return () => { if (vrm?.lookAt) vrm.lookAt.autoUpdate = true; };
  }, [vrm]);

  useFrame((state, delta) => {
    if (!vrm) return;

    const head = vrm.humanoid?.getRawBoneNode('head');
    const neck = vrm.humanoid?.getRawBoneNode('neck');
    const leftEye  = vrm.humanoid?.getNormalizedBoneNode('leftEye');
    const rightEye = vrm.humanoid?.getNormalizedBoneNode('rightEye');
    if (!head || !neck) return;

    const persona     = getPersona();
    const isPsycho    = PSYCHO_PERSONAS.has(persona);

    // Check if a higher-priority cinematic sequence is active
    // (kiss, bed, typing sequences all need bone control)
    const isCinematic = (window as any).__cinematicLock === true;
    if (isCinematic) return;

    // Smooth blend transition
    damp(blend.current, 'v', isPsycho ? 0.0 : 1.0, 0.45, delta);
    const t = blend.current.v; // 1 = mouse, 0 = psycho

    // Smooth raw pointer input
    rawMouse.current.set(state.pointer.x, state.pointer.y);
    smoothMouse.current.lerp(rawMouse.current, delta * 6.0);
    const mx = smoothMouse.current.x;
    const my = smoothMouse.current.y;

    // ── NORMAL MODE target rotations ────────────────────────────────────────
    // Head follows mouse with natural anatomical limits
    const normalHeadX = -my * 0.28;           // up/down (negative = look up)
    const normalHeadY =  mx * 0.42;           // left/right
    const normalNeckX = -my * 0.10;
    const normalNeckY =  mx * 0.15;

    // ── PSYCHO MODE target rotations ────────────────────────────────────────
    // Chin-down tilt + eyes locked dead on camera origin
    const psychoHeadX = THREE.MathUtils.degToRad(18);  // chin toward chest
    const psychoHeadY = 0;
    const psychoNeckX = THREE.MathUtils.degToRad(6);
    const psychoNeckY = 0;

    // ── Blend and apply ─────────────────────────────────────────────────────
    const headTargetX = THREE.MathUtils.lerp(psychoHeadX, normalHeadX, t);
    const headTargetY = THREE.MathUtils.lerp(psychoHeadY, normalHeadY, t);
    const neckTargetX = THREE.MathUtils.lerp(psychoNeckX, normalNeckX, t);
    const neckTargetY = THREE.MathUtils.lerp(psychoNeckY, normalNeckY, t);

    // Smooth application (don't snap)
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headTargetX, delta * 5.0);
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headTargetY, delta * 5.0);
    neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, neckTargetX, delta * 4.0);
    neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, neckTargetY, delta * 4.0);

    // ── Eye bones ────────────────────────────────────────────────────────────
    if (leftEye && rightEye) {
      // Normal: eyes lead mouse (±15° range)
      const normalEyeX = -my * 0.18;
      const normalEyeY =  mx * 0.22;

      // Psycho: eyes deviate toward camera even more aggressively (dead stare)
      // Camera is at [0, 0.5, 4] default — from character's POV, look slightly up and forward
      const camInLocal = new THREE.Vector3(0, 0.12, 1).normalize();
      const psychoEyeX = -camInLocal.y * 0.15;  // slight upward deviation
      const psychoEyeY = 0;

      const eyeX = THREE.MathUtils.lerp(psychoEyeX, normalEyeX, t);
      const eyeY = THREE.MathUtils.lerp(psychoEyeY, normalEyeY, t);

      [leftEye, rightEye].forEach(eye => {
        eye.rotation.x = THREE.MathUtils.lerp(eye.rotation.x, eyeX, delta * 8.0);
        eye.rotation.y = THREE.MathUtils.lerp(eye.rotation.y, eyeY, delta * 8.0);
      });
    }
  });
};
