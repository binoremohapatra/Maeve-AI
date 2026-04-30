/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  useSoulAwarenessEngine v2.0 — "Living Gaze"                          ║
 * ║                                                                        ║
 * ║  Attention State Machine · Emotion-Aware Gaze · Biological Head Bob   ║
 * ║  Delayed Eye-First Tracking · Speaking Awareness · POI Offsets        ║
 * ║                                                                        ║
 * ║  She doesn't just TRACK you — she LOOKS at you. With intent.          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { damp, damp3 } from 'maath/easing';

// ─────────────────────────────────────────────────────────────────────────────
// § 1. ATTENTION STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
// Real humans don't maintain constant dead-center eye contact.
// They cycle through phases: lock → soften → drift → avert → lock again.
// ─────────────────────────────────────────────────────────────────────────────

type AttentionState = 'LOCKED' | 'SOFT_FOCUS' | 'DRIFT' | 'AVERTED';

interface AttentionConfig {
  /** How much of the camera target to track (1.0 = dead center, 0.0 = ignore) */
  trackingStrength: number;
  /** Random offset amplitude for gaze wander (radians) */
  wanderAmplitude: number;
  /** Damping lambda for eye tracking (lower = slower/lazier) */
  eyeLambda: number;
  /** Damping lambda for head tracking */
  headLambda: number;
}

const ATTENTION_PROFILES: Record<AttentionState, AttentionConfig> = {
  LOCKED: {
    trackingStrength: 1.0,
    wanderAmplitude: 0.0,
    eyeLambda: 0.08,     // Snappy — locked on
    headLambda: 0.20,    // Head follows smoothly
  },
  SOFT_FOCUS: {
    trackingStrength: 0.85,
    wanderAmplitude: 0.04,  // Slight wobble around target
    eyeLambda: 0.12,
    headLambda: 0.28,
  },
  DRIFT: {
    trackingStrength: 0.5,
    wanderAmplitude: 0.12,   // Noticeable wander — "thinking"
    eyeLambda: 0.18,
    headLambda: 0.35,        // Head barely follows
  },
  AVERTED: {
    trackingStrength: 0.15,
    wanderAmplitude: 0.25,   // Looking away significantly
    eyeLambda: 0.10,         // Snappy aversion
    headLambda: 0.40,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 2. EMOTION → GAZE BEHAVIOR MAPPING
// ─────────────────────────────────────────────────────────────────────────────
// Each emotion biases which attention states are favored and how long
// they last. This creates drastically different "feels" per emotion.
// ─────────────────────────────────────────────────────────────────────────────

interface EmotionGazeProfile {
  /** Probability weights for each state [LOCKED, SOFT, DRIFT, AVERT] — sum to 1.0 */
  stateWeights: [number, number, number, number];
  /** Duration range [min, max] seconds for each attention state */
  durationRange: [number, number];
  /** Vertical bias in radians (negative = look down, positive = look up) */
  pitchBias: number;
  /** Horizontal bias in radians (negative = look left, positive = look right) */
  yawBias: number;
  /** Eye damping override (if tighter/lazier than default) */
  eyeLambdaOverride?: number;
}

const EMOTION_GAZE_PROFILES: Record<string, EmotionGazeProfile> = {
  // ── INTENSE STARES ──
  ANGRY: { stateWeights: [0.90, 0.05, 0.03, 0.02], durationRange: [3, 6], pitchBias: 0.03, yawBias: 0, eyeLambdaOverride: 0.05 },
  COLD_ANGER: { stateWeights: [0.95, 0.03, 0.02, 0.00], durationRange: [4, 8], pitchBias: 0.05, yawBias: 0, eyeLambdaOverride: 0.04 },
  POSSESSIVE: { stateWeights: [0.92, 0.05, 0.03, 0.00], durationRange: [3, 7], pitchBias: 0.0, yawBias: 0, eyeLambdaOverride: 0.04 },
  POSSESSIVE_KUBRICK: { stateWeights: [0.98, 0.02, 0.00, 0.00], durationRange: [5, 10], pitchBias: 0.0, yawBias: 0, eyeLambdaOverride: 0.03 },
  INTENSE: { stateWeights: [0.85, 0.10, 0.05, 0.00], durationRange: [3, 6], pitchBias: 0.0, yawBias: 0 },
  DETERMINED: { stateWeights: [0.80, 0.15, 0.05, 0.00], durationRange: [3, 5], pitchBias: 0.0, yawBias: 0 },
  JEALOUS: { stateWeights: [0.75, 0.10, 0.05, 0.10], durationRange: [2, 5], pitchBias: 0.0, yawBias: 0 },

  // ── SHY / AVERTED ──
  SHY: { stateWeights: [0.20, 0.25, 0.15, 0.40], durationRange: [0.8, 2.5], pitchBias: -0.08, yawBias: -0.06 },
  BASHFUL: { stateWeights: [0.15, 0.20, 0.20, 0.45], durationRange: [0.6, 2.0], pitchBias: -0.10, yawBias: -0.08 },
  SHY_BASHFUL: { stateWeights: [0.10, 0.15, 0.20, 0.55], durationRange: [0.5, 1.8], pitchBias: -0.12, yawBias: -0.10 },
  FLUSTERED: { stateWeights: [0.25, 0.20, 0.25, 0.30], durationRange: [0.5, 1.5], pitchBias: -0.05, yawBias: 0.04 },

  // ── WARM / ROMANTIC ──
  LOVE: { stateWeights: [0.55, 0.35, 0.08, 0.02], durationRange: [2, 5], pitchBias: -0.02, yawBias: 0 },
  LOVESTRUCK: { stateWeights: [0.40, 0.45, 0.12, 0.03], durationRange: [2, 4.5], pitchBias: -0.03, yawBias: 0 },
  WARM: { stateWeights: [0.50, 0.35, 0.12, 0.03], durationRange: [2, 5], pitchBias: 0.0, yawBias: 0 },
  SOFT: { stateWeights: [0.45, 0.40, 0.12, 0.03], durationRange: [2, 5], pitchBias: 0.0, yawBias: 0 },

  // ── JOY / POSITIVE ──
  JOY: { stateWeights: [0.55, 0.30, 0.12, 0.03], durationRange: [2, 4], pitchBias: 0.0, yawBias: 0 },
  HAPPY: { stateWeights: [0.50, 0.30, 0.15, 0.05], durationRange: [2, 4], pitchBias: 0.0, yawBias: 0 },
  EXCITED: { stateWeights: [0.60, 0.25, 0.10, 0.05], durationRange: [1.5, 3], pitchBias: 0.02, yawBias: 0 },
  PROUD: { stateWeights: [0.55, 0.30, 0.12, 0.03], durationRange: [2, 4], pitchBias: -0.03, yawBias: 0 },

  // ── THINKING / COGNITIVE ──
  THINKING: { stateWeights: [0.15, 0.20, 0.55, 0.10], durationRange: [1.5, 4], pitchBias: 0.06, yawBias: -0.08 },  // Look up-left
  CONFUSED: { stateWeights: [0.30, 0.20, 0.40, 0.10], durationRange: [1, 3], pitchBias: 0.03, yawBias: 0.05 },
  PENSIVE: { stateWeights: [0.20, 0.30, 0.40, 0.10], durationRange: [2, 5], pitchBias: -0.04, yawBias: 0 },

  // ── SAD / HURT ──
  SAD: { stateWeights: [0.20, 0.25, 0.25, 0.30], durationRange: [1.5, 4], pitchBias: -0.10, yawBias: 0 },
  HURT: { stateWeights: [0.15, 0.20, 0.20, 0.45], durationRange: [1, 3], pitchBias: -0.12, yawBias: -0.05 },
  CRYING: { stateWeights: [0.10, 0.15, 0.25, 0.50], durationRange: [0.8, 2.5], pitchBias: -0.15, yawBias: 0 },
  LONELY: { stateWeights: [0.15, 0.25, 0.30, 0.30], durationRange: [2, 5], pitchBias: -0.10, yawBias: -0.06 },
  MELANCHOLY: { stateWeights: [0.20, 0.30, 0.35, 0.15], durationRange: [2, 5], pitchBias: -0.06, yawBias: 0 },

  // ── FEAR / ANXIOUS ──
  FEAR: { stateWeights: [0.70, 0.10, 0.05, 0.15], durationRange: [0.5, 2], pitchBias: 0.0, yawBias: 0, eyeLambdaOverride: 0.05 },
  NERVOUS: { stateWeights: [0.35, 0.20, 0.20, 0.25], durationRange: [1, 2.5], pitchBias: 0.0, yawBias: 0 },

  // ── SMUG / SUPERIOR ──
  SMUG: { stateWeights: [0.30, 0.40, 0.15, 0.15], durationRange: [2, 4], pitchBias: -0.03, yawBias: 0.08 },   // Sideways glance

  // ── SLEEPY ──
  SLEEPY: { stateWeights: [0.15, 0.40, 0.35, 0.10], durationRange: [3, 7], pitchBias: -0.08, yawBias: 0, eyeLambdaOverride: 0.30 },
  BORED: { stateWeights: [0.15, 0.30, 0.40, 0.15], durationRange: [2, 5], pitchBias: -0.04, yawBias: 0, eyeLambdaOverride: 0.25 },

  // ── INTIMATE ──
  SEXY: { stateWeights: [0.50, 0.40, 0.08, 0.02], durationRange: [2, 5], pitchBias: -0.04, yawBias: 0, eyeLambdaOverride: 0.15 },
  LUST: { stateWeights: [0.55, 0.35, 0.08, 0.02], durationRange: [2, 5], pitchBias: 0.02, yawBias: 0, eyeLambdaOverride: 0.12 },
  PLEASURE: { stateWeights: [0.20, 0.35, 0.30, 0.15], durationRange: [1, 3], pitchBias: 0.06, yawBias: 0, eyeLambdaOverride: 0.20 },
  ECSTASY: { stateWeights: [0.10, 0.20, 0.40, 0.30], durationRange: [0.5, 2], pitchBias: 0.10, yawBias: 0, eyeLambdaOverride: 0.25 },
  AHEGAO: { stateWeights: [0.05, 0.10, 0.35, 0.50], durationRange: [0.5, 1.5], pitchBias: 0.15, yawBias: 0, eyeLambdaOverride: 0.30 },

  // ── SURPRISED ──
  SURPRISED: { stateWeights: [0.80, 0.10, 0.05, 0.05], durationRange: [1, 3], pitchBias: 0.0, yawBias: 0, eyeLambdaOverride: 0.04 },
  SHOCKED: { stateWeights: [0.90, 0.05, 0.03, 0.02], durationRange: [2, 5], pitchBias: 0.0, yawBias: 0, eyeLambdaOverride: 0.03 },

  // ── POUT ──
  POUT: { stateWeights: [0.35, 0.25, 0.15, 0.25], durationRange: [1.5, 3], pitchBias: 0.02, yawBias: 0 },
  CUTE_POUT: { stateWeights: [0.50, 0.25, 0.10, 0.15], durationRange: [1.5, 3], pitchBias: 0.03, yawBias: 0 },
};

const DEFAULT_GAZE_PROFILE: EmotionGazeProfile = {
  stateWeights: [0.55, 0.25, 0.15, 0.05],
  durationRange: [2, 5],
  pitchBias: 0,
  yawBias: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// § 3. GAZE POINT-OF-INTEREST (POI) SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
// Instead of always looking at dead-center camera, randomly shift between
// looking at the viewer's left eye, right eye, mouth, or bridge of nose.
// Humans do this instinctively — it's what makes eye contact feel "real."
// ─────────────────────────────────────────────────────────────────────────────

interface GazePOI {
  offsetX: number;  // Horizontal offset from camera center (world units)
  offsetY: number;  // Vertical offset from camera center
  weight: number;   // Selection probability
}

const GAZE_POIS: GazePOI[] = [
  { offsetX: 0.02, offsetY: 0.02, weight: 0.30 },  // Right eye
  { offsetX: -0.02, offsetY: 0.02, weight: 0.30 },  // Left eye
  { offsetX: 0.00, offsetY: 0.015, weight: 0.20 },  // Bridge of nose
  { offsetX: 0.00, offsetY: -0.02, weight: 0.10 },  // Mouth area
  { offsetX: 0.00, offsetY: 0.04, weight: 0.10 },  // Forehead
];

function selectWeightedPOI(): GazePOI {
  const totalWeight = GAZE_POIS.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const poi of GAZE_POIS) {
    r -= poi.weight;
    if (r <= 0) return poi;
  }
  return GAZE_POIS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4. ATTENTION STATE SELECTOR (Weighted Random)
// ─────────────────────────────────────────────────────────────────────────────

const ATTENTION_STATES: AttentionState[] = ['LOCKED', 'SOFT_FOCUS', 'DRIFT', 'AVERTED'];

function selectAttentionState(weights: [number, number, number, number]): AttentionState {
  let r = Math.random();
  for (let i = 0; i < 4; i++) {
    r -= weights[i];
    if (r <= 0) return ATTENTION_STATES[i];
  }
  return 'LOCKED';
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5. THE HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface SoulState {
  // Attention state machine
  currentAttention: AttentionState;
  attentionTimer: number;

  // Current gaze POI
  currentPOI: GazePOI;
  poiTimer: number;

  // Smoothed gaze angles
  eyeYaw: number;
  eyePitch: number;
  headYaw: number;
  headPitch: number;

  // Wander noise seed
  wanderSeed: number;
  wanderYaw: number;
  wanderPitch: number;

  // Breath micro-bob
  breathPhase: number;

  // Speaking state tracking
  wasSpeaking: boolean;
  speakingTransitionTimer: number;

  // Cached emotion
  cachedEmotion: string;
}

export const useSoulAwarenessEngine = () => {
  // Persistence for smoothed target point
  const smoothLookAtTarget = useRef(new THREE.Vector3()).current;

  // Math objects (zero-alloc hot path)
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ')).current;
  const _quat = useRef(new THREE.Quaternion()).current;
  const _v3 = useRef(new THREE.Vector3()).current;
  const _headPos = useRef(new THREE.Vector3()).current;
  const _camPos = useRef(new THREE.Vector3()).current;
  //  PERF FIX: Pre-allocate camera basis vectors — avoids 3 new Vector3() every frame
  const _camRight = useRef(new THREE.Vector3()).current;
  const _camUp = useRef(new THREE.Vector3()).current;
  const _camForward = useRef(new THREE.Vector3()).current;

  // Soul state
  const soul = useRef<SoulState>({
    currentAttention: 'LOCKED',
    attentionTimer: 3 + Math.random() * 2,

    currentPOI: GAZE_POIS[0],
    poiTimer: 2 + Math.random() * 2,

    eyeYaw: 0,
    eyePitch: 0,
    headYaw: 0,
    headPitch: 0,

    wanderSeed: Math.random() * 100,
    wanderYaw: 0,
    wanderPitch: 0,

    breathPhase: Math.random() * Math.PI * 2,

    wasSpeaking: false,
    speakingTransitionTimer: 0,

    cachedEmotion: 'NEUTRAL',
  });

  const updateSoul = useCallback((
    vrms: any[],
    state: any,
    delta: number,
    isCinematicLocked: boolean,
    emotion: string = 'NEUTRAL',
    isSpeaking: boolean = false
  ) => {
    if (!vrms || vrms.length === 0 || isCinematicLocked) return;

    const vrm = vrms[0];
    //  NULL GUARD: VRM may be null during model loading — bail early to prevent crash
    if (!vrm) return;
    const headNode = vrm.humanoid?.getRawBoneNode('head');
    const s = soul.current;

    // Clamp delta to prevent explosions on tab-away
    const dt = Math.min(delta, 0.05);

    if (headNode) {
      headNode.getWorldPosition(_headPos);
    } else {
      _headPos.set(0, 1.4, 0);
    }

    // ── 1. Get Emotion Gaze Profile ──
    const emotionKey = emotion.toUpperCase();
    const gazeProfile = EMOTION_GAZE_PROFILES[emotionKey] ?? DEFAULT_GAZE_PROFILE;

    // ── 2. Tick Attention State Machine ──
    s.attentionTimer -= dt;
    if (s.attentionTimer <= 0) {
      // Select new attention state based on emotion weights
      s.currentAttention = selectAttentionState(gazeProfile.stateWeights);

      // Duration varies by emotion + random spread
      const [minDur, maxDur] = gazeProfile.durationRange;
      s.attentionTimer = minDur + Math.random() * (maxDur - minDur);

      // Generate new wander direction when switching states
      s.wanderYaw = (Math.random() - 0.5) * 2;
      s.wanderPitch = (Math.random() - 0.5) * 2;
    }

    // ── 3. Tick POI System (shift gaze focus point) ──
    s.poiTimer -= dt;
    if (s.poiTimer <= 0) {
      s.currentPOI = selectWeightedPOI();
      s.poiTimer = 2 + Math.random() * 3;
    }

    // ── 4. Get Attention Config ──
    const attConfig = ATTENTION_PROFILES[s.currentAttention];

    // ── 5. Calculate Base Camera Target (IN CAMERA LOCAL SPACE) ──
    state.camera.getWorldPosition(_camPos);

    // Get Camera's actual Right and Up vectors (Screen X and Y)
    //  PERF FIX: Reuse pre-allocated vectors — avoids 3 new THREE.Vector3() per frame
    _camRight.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
    _camUp.set(0, 1, 0).applyQuaternion(state.camera.quaternion);
    _camForward.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
    const camRight = _camRight;
    const camUp = _camUp;
    const camForward = _camForward;

    // Pull the target slightly forward from the camera lens to avoid clipping math
    _camPos.addScaledVector(camForward, 0.5);
    _camPos.addScaledVector(camUp, -0.05); // Look slightly down at face level

    //  THE FIX: Apply POI offset along the camera's screen plane!
    // Ab wo effectively "Screen" ke left/right/up/down dekhegi, world ke nahi.
    _camPos.addScaledVector(camRight, s.currentPOI.offsetX);
    _camPos.addScaledVector(camUp, s.currentPOI.offsetY);

    // ── 6. Smooth the look-at target ──
    const trackStr = attConfig.trackingStrength;
    const dampedTarget = _v3.copy(_camPos);

    // Wander: Organic 1/f noise (Pink noise approximation)
    const time = state.clock.elapsedTime + s.wanderSeed;
    const wanderAmp = attConfig.wanderAmplitude;
    // Asymmetric breathing wander (horizontal is usually wider than vertical)
    const wanderYaw = (Math.sin(time * 0.7) * 0.6 + Math.sin(time * 1.3) * 0.4) * wanderAmp * s.wanderYaw;
    const wanderPitch = (Math.cos(time * 0.5) * 0.6 + Math.cos(time * 1.1) * 0.4) * (wanderAmp * 0.6) * s.wanderPitch;

    // Apply emotion pitch/yaw bias
    const emotionPitchBias = gazeProfile.pitchBias;
    const emotionYawBias = gazeProfile.yawBias;

    // Speaking awareness
    let speakingPitchMod = 0;
    let speakingTrackMod = 0;
    if (isSpeaking) {
      speakingPitchMod = 0.04;   // Lifts chin slightly while talking (confidence)
      speakingTrackMod = -0.20;  // Breaks eye contact more easily when talking
    } else if (s.wasSpeaking && !isSpeaking) {
      s.speakingTransitionTimer = 0.4;
    }

    if (s.speakingTransitionTimer > 0) {
      s.speakingTransitionTimer -= dt;
      speakingTrackMod = 0.15;  // Snaps attention back when finishing a sentence
    }
    s.wasSpeaking = isSpeaking;

    const effectiveTrack = Math.max(0, Math.min(1, trackStr + speakingTrackMod));

    // Dampen the target to simulate heavy neck/shoulder rotation speed
    damp3(smoothLookAtTarget, dampedTarget, 0.15 + (1 - effectiveTrack) * 0.4, dt);

    // ── 7. Calculate Raw Yaw/Pitch ──
    const dx = smoothLookAtTarget.x - _headPos.x;
    const dy = smoothLookAtTarget.y - _headPos.y;
    const dz = smoothLookAtTarget.z - _headPos.z;

    const rawYaw = Math.atan2(dx, dz);
    const distance2D = Math.sqrt(dx * dx + dz * dz);
    const rawPitch = Math.atan2(dy, distance2D);

    // Apply wander, emotion bias, and speaking modifier
    const targetYaw = THREE.MathUtils.clamp(
      rawYaw + wanderYaw + emotionYawBias,
      -1.0, 1.0
    );
    const targetPitch = THREE.MathUtils.clamp(
      rawPitch + wanderPitch + emotionPitchBias + speakingPitchMod,
      -0.5, 0.5
    );

    // ── 8. Eye-First, Head-Follows Tracking ──
    // Eyes are fast-twitch — they snap to target first
    // Head is heavy — it catches up ~150ms later with more damping
    const eyeLambda = gazeProfile.eyeLambdaOverride ?? attConfig.eyeLambda;
    const headLambda = attConfig.headLambda;

    damp(s, 'eyeYaw', targetYaw, eyeLambda, dt);
    damp(s, 'eyePitch', targetPitch, eyeLambda, dt);
    damp(s, 'headYaw', targetYaw, headLambda, dt);
    damp(s, 'headPitch', targetPitch, headLambda, dt);

    // ── 9. Breath Micro-Bob ──
    // Subtle ±0.003 rad pitch oscillation to make the head feel alive
    s.breathPhase += dt * 1.2; // ~0.6 Hz breathing
    const breathBob = Math.sin(s.breathPhase) * 0.003;

    // ── 10. Comfort Zone Clamping ──
    // Head doesn't turn beyond ±35° — eyes handle the overshoot
    const MAX_HEAD_YAW = 0.61;   // ~35°
    const MAX_HEAD_PITCH = 0.35; // ~20°

    const clampedHeadYaw = THREE.MathUtils.clamp(s.headYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
    const clampedHeadPitch = THREE.MathUtils.clamp(s.headPitch + breathBob, -MAX_HEAD_PITCH, MAX_HEAD_PITCH);

    // ── 11. Apply to VRMs ──
    vrms.forEach(vrm => {
      const head = vrm.humanoid?.getRawBoneNode('head');
      if (!head) return;

      // A. VRM LookAt (Eye gaze direction)
      if (vrm.lookAt) {
        _v3.set(
          Math.sin(s.eyeYaw) * 2,
          Math.sin(s.eyePitch) * 2,
          Math.cos(s.eyeYaw) * 2
        );
        head.localToWorld(_v3);
        vrm.lookAt.lookAt(_v3);
      }

      // B. Neck Bone — 40% of clamped head rotation
      const humanoid = vrm.humanoid;
      if (humanoid) {
        const neck = humanoid.getRawBoneNode('neck');
        if (neck) {
          _euler.set(
            -clampedHeadPitch * 0.4,
            clampedHeadYaw * 0.4,
            // Subtle roll INTO the gaze direction (natural lean)
            -clampedHeadYaw * 0.04,
            'YXZ'
          );
          _quat.setFromEuler(_euler);
          neck.quaternion.multiply(_quat);
        }

        // C. Head Bone — 60% of clamped head rotation
        if (head) {
          _euler.set(
            -clampedHeadPitch * 0.6,
            clampedHeadYaw * 0.6,
            // Slight counter-roll for biological asymmetry
            clampedHeadYaw * 0.02,
            'YXZ'
          );
          _quat.setFromEuler(_euler);
          head.quaternion.multiply(_quat);
        }
      }
    });
  }, []);

  return { updateSoul };
};
