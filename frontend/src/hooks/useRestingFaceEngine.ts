/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  useRestingFaceEngine v4.0 — "Digital Lifeform"                        ║
 * ║  Spring-Damper Physics · RBF Muscle Correlation · Perlin Micro-Noise   ║
 * ║  Inspired by Kuro Games (Wuthering Waves) facial animation pipeline.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BlendshapeKey =
  | 'joy' | 'angry' | 'sad' | 'surprised' | 'relaxed' | 'neutral'
  | 'blink' | 'blinkLeft' | 'blinkRight'
  | 'lookUp' | 'lookDown' | 'lookLeft' | 'lookRight'
  | 'aa' | 'ih' | 'ou' | 'ee' | 'oh'
  | 'eyesWide' | 'eyesNarrow' | 'browUp' | 'browDown'
  | 'smileFull' | 'pout' | 'cheekPuff'
  | string;

export type FaceWeights = Partial<Record<BlendshapeKey, number | any>>;

// ─────────────────────────────────────────────────────────────────────────────
// VRM EXPRESSION NAME MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const VRM_MAPPING: Record<string, string[]> = {
  joy: ['joy', 'happy', 'smile'],
  angry: ['angry', 'anger'],
  sad: ['sad', 'sorrow'],
  surprised: ['surprised', 'surprise'],
  relaxed: ['relaxed', 'calm'],
  neutral: ['neutral'],
  blink: ['blink', 'eyesClosed'],
  blinkLeft: ['blinkLeft', 'eyeClosedL', 'blink_L'],
  blinkRight: ['blinkRight', 'eyeClosedR', 'blink_R'],
  lookUp: ['lookUp'],
  lookDown: ['lookDown'],
  lookLeft: ['lookLeft'],
  lookRight: ['lookRight'],
  aa: ['aa', 'a'],
  ih: ['ih', 'i'],
  ou: ['ou', 'u'],
  ee: ['ee', 'e'],
  oh: ['oh', 'o'],
  eyesWide: ['eyesWide', 'eyeWide', 'wide'],
  eyesNarrow: ['eyesNarrow', 'eyeNarrow', 'squint'],
  browUp: ['browUp', 'eyebrowUp'],
  browDown: ['browDown', 'eyebrowDown', 'eyebrowAngry'],
  smileFull: ['smileFull', 'smileOpen', 'joyOpen'],
  pout: ['pout', 'mouth_n'],
  cheekPuff: ['cheekPuff', 'cheek'],
};

import { EXTREME_PERSONAS, FULL_EMOTION_MAP } from './animeFaceWeights';

const PERSONA_BASE_FACES = EXTREME_PERSONAS;
const EMOTION_FACES = FULL_EMOTION_MAP;

// ─────────────────────────────────────────────────────────────────────────────
// § 1. SECOND-ORDER SPRING-DAMPER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
// Each blendshape channel is driven by a spring with configurable
// response frequency (ω) and damping ratio (ζ).
//
// acceleration = ω² × (target - position) - 2ζω × velocity
// velocity    += acceleration × Δt
// position    += velocity     × Δt
//
// ω > 10   → snappy (brows, eyelids)
// ω ~  8   → fleshy (cheeks)
// ζ ~  0.8 → slight overshoot → organic feel
// ζ >= 1.0 → critically damped → no overshoot (safe for lip sync)
// ─────────────────────────────────────────────────────────────────────────────

interface SpringChannel {
  position: number;   // current blendshape value
  velocity: number;   // current rate of change
  target: number;     // desired value
  response: number;   // ω — spring frequency
  damping: number;    // ζ — damping ratio
}

/** Per-channel physics profile. Channels not listed use DEFAULT. */
const SPRING_PROFILES: Record<string, { response: number; damping: number }> = {
  // Brow muscles — snappy, reactive (human brows are fast twitch)
  browUp: { response: 12.0, damping: 0.85 },
  browDown: { response: 12.0, damping: 0.85 },

  // Eye shapes — tightest, most precise (eyelids are fast)
  eyesWide: { response: 14.0, damping: 0.90 },
  eyesNarrow: { response: 14.0, damping: 0.90 },
  blink: { response: 16.0, damping: 0.95 },
  blinkLeft: { response: 16.0, damping: 0.95 },
  blinkRight: { response: 16.0, damping: 0.95 },

  // Cheeks — slow, fleshy (fat tissue has inertia)
  cheekPuff: { response: 8.0, damping: 0.75 },

  // Mouth shapes — slightly loose (lips are soft tissue)
  smileFull: { response: 10.0, damping: 0.80 },
  pout: { response: 10.0, damping: 0.80 },
  aa: { response: 11.0, damping: 0.82 },
  ih: { response: 11.0, damping: 0.82 },
  ou: { response: 11.0, damping: 0.82 },
  ee: { response: 11.0, damping: 0.82 },
  oh: { response: 11.0, damping: 0.82 },

  // Emotion base shapes
  joy: { response: 9.0, damping: 0.80 },
  angry: { response: 10.0, damping: 0.82 },
  sad: { response: 7.0, damping: 0.78 },  // sadness transitions slowly
  surprised: { response: 14.0, damping: 0.88 },  // surprise is instant
  relaxed: { response: 6.0, damping: 0.75 },  // relaxation eases in
  neutral: { response: 8.0, damping: 0.80 },

  // Gaze — moderate speed
  lookUp: { response: 10.0, damping: 0.85 },
  lookDown: { response: 10.0, damping: 0.85 },
  lookLeft: { response: 10.0, damping: 0.85 },
  lookRight: { response: 10.0, damping: 0.85 },
};

const DEFAULT_SPRING = { response: 10.0, damping: 0.82 };

function getSpringProfile(logicalKey: string): { response: number; damping: number } {
  return SPRING_PROFILES[logicalKey] ?? DEFAULT_SPRING;
}

function stepSpring(ch: SpringChannel, dt: number): void {
  // Clamp dt to prevent explosions on tab-away
  const clampedDt = Math.min(dt, 0.05);

  const omega = ch.response;
  const zeta = ch.damping;

  const diff = ch.target - ch.position;
  const acc = omega * omega * diff - 2.0 * zeta * omega * ch.velocity;

  ch.velocity += acc * clampedDt;
  ch.position += ch.velocity * clampedDt;

  // Settle: if close enough and slow enough, snap to target (anti-jitter)
  if (Math.abs(diff) < 0.0003 && Math.abs(ch.velocity) < 0.001) {
    ch.position = ch.target;
    ch.velocity = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2. RBF MUSCLE CORRELATION MATRIX
// ─────────────────────────────────────────────────────────────────────────────
// When a primary shape exceeds its threshold, correlated secondary shapes
// are automatically injected. This models how real facial fat/muscle moves:
//   - Big smile → cheeks push up → eyes narrow (crescent shape)
//   - Anger → brows furrow → nose tenses → eyes focus
//   - Surprise → brows shoot up → jaw drops
// ─────────────────────────────────────────────────────────────────────────────

interface MuscleCorrelation {
  primaryKey: string;
  threshold: number;
  injections: Array<{ key: string; intensity: number; scale: number }>;
}

const MUSCLE_CORRELATION_MATRIX: MuscleCorrelation[] = [
  //  GENUINE DUCHENNE SMILE → Cheeks up, eyes narrow, outer brows dip slightly
  {
    primaryKey: 'joy',
    threshold: 0.3,
    injections: [
      { key: 'cheekPuff', intensity: 0.25, scale: 1.0 },
      { key: 'eyesNarrow', intensity: 0.18, scale: 1.0 },
      { key: 'browDown', intensity: 0.05, scale: 0.8 }, // Outer brow drop for realism
    ],
  },
  //  PREDATORY/ANGRY → Brows crush, eyes squint, jaw tightens
  {
    primaryKey: 'angry',
    threshold: 0.2, // Triggers earlier for subtle tension
    injections: [
      { key: 'browDown', intensity: 0.20, scale: 1.0 },
      { key: 'eyesNarrow', intensity: 0.15, scale: 1.0 },
      { key: 'pout', intensity: 0.08, scale: 0.6 },
      { key: 'ih', intensity: 0.05, scale: 0.5 }, // Slight teeth baring
    ],
  },
  //  SADNESS WOBBLE → Inner brows spike, lips purse, gaze drops
  {
    primaryKey: 'sad',
    threshold: 0.35,
    injections: [
      { key: 'browUp', intensity: 0.15, scale: 1.0 },
      { key: 'eyesNarrow', intensity: 0.10, scale: 0.8 },
      { key: 'ou', intensity: 0.08, scale: 0.7 }, // Lips tremble shape
      { key: 'lookDown', intensity: 0.10, scale: 0.6 },
    ],
  },
  //  SURPRISE SHOCK → Brows fly, eyes widen, jaw slackens
  {
    primaryKey: 'surprised',
    threshold: 0.4,
    injections: [
      { key: 'browUp', intensity: 0.25, scale: 1.0 },
      { key: 'aa', intensity: 0.15, scale: 0.8 },
      { key: 'eyesWide', intensity: 0.20, scale: 1.0 },
      { key: 'blink', intensity: -0.20, scale: 1.0 }, // Force eyes open
    ],
  },
  //  LUST / BEDROOM EYES → Heavy lids, soft parted lips
  {
    primaryKey: 'relaxed',
    threshold: 0.4,
    injections: [
      { key: 'eyesNarrow', intensity: 0.12, scale: 0.8 },
      { key: 'ee', intensity: 0.05, scale: 0.6 }, // Soft breath parted lips
    ],
  }
];

function applyMuscleCorrelation(face: FaceWeights): FaceWeights {
  const result = { ...face };

  for (const rule of MUSCLE_CORRELATION_MATRIX) {
    const primaryVal = (result[rule.primaryKey] as number) ?? 0;
    if (primaryVal <= rule.threshold) continue;

    // Scale injection by how far above threshold we are (0→1 range)
    const excess = Math.min(1, (primaryVal - rule.threshold) / (1.0 - rule.threshold));

    for (const inj of rule.injections) {
      const existing = (result[inj.key] as number) ?? 0;
      const inject = inj.intensity * inj.scale * excess;
      result[inj.key] = Math.max(-1, Math.min(1, existing + inject));
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3. PERLIN MICRO-NOISE ("ALIVE" PERSISTENCE)
// ─────────────────────────────────────────────────────────────────────────────
// Even at NEUTRAL, the face is never 0.000 static. Multi-frequency sine waves
// (faked Perlin) add ±0.01–0.03 micro-movements to key channels. This makes
// it look like she's breathing through her face — subtle, subconscious life.
// ─────────────────────────────────────────────────────────────────────────────

interface NoiseChannel {
  key: string;
  amplitude: number;    // max jitter (±)
  freq1: number;        // primary sine frequency
  freq2: number;        // secondary sine frequency (gives organic feel)
  phase: number;        // random phase offset per channel
}

// Asymmetrical frequencies to prevent repeating "loop" patterns
const MICRO_NOISE_CHANNELS: NoiseChannel[] = [
  { key: 'eyesNarrow', amplitude: 0.012, freq1: 0.11, freq2: 0.37, phase: 0.0 }, // Lazy eye flutter
  { key: 'browUp', amplitude: 0.007, freq1: 0.08, freq2: 0.23, phase: 1.3 },     // Thoughtful brow drift
  { key: 'browDown', amplitude: 0.005, freq1: 0.13, freq2: 0.29, phase: 2.7 },
  { key: 'smileFull', amplitude: 0.008, freq1: 0.09, freq2: 0.31, phase: 0.8 },  // Lip corner twitch
  { key: 'pout', amplitude: 0.006, freq1: 0.14, freq2: 0.41, phase: 3.1 },       // Subtle jaw/lip shifting
  { key: 'joy', amplitude: 0.005, freq1: 0.07, freq2: 0.19, phase: 4.2 },
];

function computeMicroNoise(time: number): FaceWeights {
  const noise: FaceWeights = {};
  for (const ch of MICRO_NOISE_CHANNELS) {
    const t = time + ch.phase;
    // Multi-frequency sine: primary + secondary at golden ratio offset
    const value = (Math.sin(t * ch.freq1 * Math.PI * 2) * 0.6 +
      Math.sin(t * ch.freq2 * Math.PI * 2) * 0.4) * ch.amplitude;
    noise[ch.key] = value;
  }
  return noise;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4. ADDITIVE FACE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

function computeAdditiveFace(
  baseFace: FaceWeights,
  activeEmotion: FaceWeights
): FaceWeights {
  let effectiveBase = { ...baseFace };
  if (activeEmotion.customBaseFace) {
    effectiveBase = { ...effectiveBase, ...activeEmotion.customBaseFace };
  }

  const allKeys = new Set<string>([
    ...Object.keys(effectiveBase),
    ...Object.keys(activeEmotion).filter(k => k !== 'customBaseFace'),
  ]);

  const result: FaceWeights = {};

  allKeys.forEach(key => {
    let baseVal = (effectiveBase[key] as number) ?? 0;
    const emotionVal = (activeEmotion[key] as number) ?? 0;

    // TIGHT CLOSURE OVERRIDE: Prevent conflicts on eye closure channels
    if ((key.toLowerCase().includes('blink') || key.toLowerCase().includes('eyesnarrow')) && emotionVal > 0.1) {
      baseVal = Math.max(0, baseVal);
    }
    if (key.toLowerCase().includes('eyeswide') && emotionVal < -0.1) {
      baseVal = Math.min(0, baseVal);
    }

    const combined = baseVal + emotionVal;
    result[key] = Math.max(-1.0, Math.min(1.0, combined));
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5. VRM EXPRESSION RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveVRMExpression(vrm: VRM, logicalKey: string): string | null {
  const aliases = VRM_MAPPING[logicalKey] ?? [logicalKey];
  const manager = vrm.expressionManager;
  if (!manager) return null;

  for (const alias of aliases) {
    if (manager.getExpression(alias) != null) {
      return alias;
    }
    const proxy = (vrm as any).blendShapeProxy;
    if (proxy?.getUnknownValueList?.()?.includes(alias)) {
      return alias;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6. WINK PRIORITY LOCK — SUPPRESSED CHANNELS
// ─────────────────────────────────────────────────────────────────────────────
// During a cinematic wink (PLAYFUL emotion), these channels are force-
// suppressed to prevent the resting face engine from fighting the wink
// state machine. blinkLeft is driven by the cinematic sequence.
// ─────────────────────────────────────────────────────────────────────────────

const WINK_SUPPRESSED_CHANNELS = new Set([
  'blink', 'eyesclosed',
  'blinkright', 'eyeclosedr', 'blink_r',
  'eyeswide', 'eyewide', 'wide',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 7. ENGINE STATE
// ─────────────────────────────────────────────────────────────────────────────

interface FaceEngineState {
  springs: Map<string, SpringChannel>;              // per-resolved-key spring state
  logicalToResolved: Map<string, string>;            // logical → VRM resolved name
  cachedAdditiveFace: FaceWeights;
  cachedPersona: string;
  cachedEmotion: string;
  transitionWeight: number;
  targetTransitionWeight: number;
  noisePhaseOffset: number;                          // random per-instance
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8. THE HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseRestingFaceEngineProps {
  vrm: VRM | null;
  persona: string;
  activeEmotion?: string;
  lerpSpeed?: number;           // Legacy — ignored in v4.0 (kept for API compat)
  customBaseFace?: FaceWeights;
  customEmotionFace?: FaceWeights;
  suppressed?: boolean;
  winkActive?: boolean;
}

export function useRestingFaceEngine({
  vrm,
  persona = 'DEFAULT',
  activeEmotion = 'NEUTRAL',
  lerpSpeed: _lerpSpeed = 8.0,  // Legacy — ignored in v4.0 (spring physics handle speed)
  customBaseFace,
  customEmotionFace,
  suppressed = false,
  winkActive = false,
}: UseRestingFaceEngineProps) {

  const vrmRef = useRef<VRM | null>(vrm);
  useEffect(() => { vrmRef.current = vrm; }, [vrm]);

  const engineState = useRef<FaceEngineState>({
    springs: new Map(),
    logicalToResolved: new Map(),
    cachedAdditiveFace: {},
    cachedPersona: 'DEFAULT',
    cachedEmotion: 'NEUTRAL',
    transitionWeight: 1.0,
    targetTransitionWeight: 1.0,
    noisePhaseOffset: Math.random() * 1000,
  });

  const personaRef = useRef<string>(persona);
  const emotionRef = useRef<string>(activeEmotion);
  const suppressRef = useRef(suppressed);
  const winkRef = useRef(winkActive);
  const customBaseRef = useRef(customBaseFace);
  const customEmotionRef = useRef(customEmotionFace);

  useEffect(() => { personaRef.current = persona; }, [persona]);
  useEffect(() => { emotionRef.current = activeEmotion; }, [activeEmotion]);
  useEffect(() => { suppressRef.current = suppressed; }, [suppressed]);
  useEffect(() => { winkRef.current = winkActive; }, [winkActive]);
  useEffect(() => { customBaseRef.current = customBaseFace; }, [customBaseFace]);
  useEffect(() => { customEmotionRef.current = customEmotionFace; }, [customEmotionFace]);

  // ── Ensure a SpringChannel exists for a resolved key ──
  const ensureSpring = useCallback((resolvedKey: string, logicalKey: string): SpringChannel => {
    const state = engineState.current;
    let spring = state.springs.get(resolvedKey);
    if (!spring) {
      const profile = getSpringProfile(logicalKey);
      spring = {
        position: 0,
        velocity: 0,
        target: 0,
        response: profile.response,
        damping: profile.damping,
      };
      state.springs.set(resolvedKey, spring);
    }
    return spring;
  }, []);

  // ── Recompute target face from persona + emotion + RBF + noise ──
  const recomputeTargets = useCallback((v: VRM) => {
    const state = engineState.current;
    const currentPersona = personaRef.current;
    const currentEmotion = emotionRef.current;

    // Skip if nothing changed and no custom overrides
    if (
      state.cachedPersona === currentPersona &&
      state.cachedEmotion === currentEmotion &&
      !customBaseRef.current &&
      !customEmotionRef.current
    ) return;

    // Step 1: Lookup base persona and emotion profiles
    const baseFace = customBaseRef.current
      ?? PERSONA_BASE_FACES[currentPersona]
      ?? PERSONA_BASE_FACES.DEFAULT;

    const emotionFace = customEmotionRef.current
      ?? EMOTION_FACES[currentEmotion]
      ?? EMOTION_FACES.NEUTRAL;

    // Step 2: Additive computation (Persona Base + Active Emotion)
    const additiveFace = computeAdditiveFace(baseFace, emotionFace);

    // Step 3: RBF Muscle Correlation injection
    const correlatedFace = applyMuscleCorrelation(additiveFace);

    // Cache
    state.cachedAdditiveFace = correlatedFace;

    // Detect persona change → trigger soft transition
    if (state.cachedPersona !== currentPersona) {
      state.transitionWeight = 0.0;
      state.targetTransitionWeight = 1.0;
    }

    state.cachedPersona = currentPersona;
    state.cachedEmotion = currentEmotion;

    // Step 4: Resolve logical keys → VRM expression names and set spring targets
    const touchedResolvedKeys = new Set<string>();

    for (const [logicalKey, targetValue] of Object.entries(correlatedFace)) {
      if (targetValue === undefined || logicalKey === 'customBaseFace') continue;
      const resolvedName = resolveVRMExpression(v, logicalKey);
      if (!resolvedName) continue;

      const spring = ensureSpring(resolvedName, logicalKey);
      spring.target = targetValue as number;

      // Also cache the logical→resolved mapping
      state.logicalToResolved.set(logicalKey, resolvedName);
      touchedResolvedKeys.add(resolvedName);
    }

    // Zero out any existing springs that are NOT in the new target set
    state.springs.forEach((spring, resolvedKey) => {
      if (!touchedResolvedKeys.has(resolvedKey)) {
        spring.target = 0;
      }
    });
  }, [ensureSpring]);

  const emotionTimeRef = useRef(0);
  const clockRef = useRef(0);

  // ── THE FRAME LOOP ──
  useFrame((_threeState, delta) => {
    const v = vrmRef.current;
    if (!v?.expressionManager) return;

    const state = engineState.current;
    const suppress = suppressRef.current;
    const isWinking = winkRef.current;
    const p = personaRef.current;
    const e = emotionRef.current;
    const isPlayful = e.toUpperCase() === 'PLAYFUL';

    // If wink is active and NOT the built-in PLAYFUL emotion, skip (yield to external)
    if (isWinking && !isPlayful) return;

    // Track elapsed time
    clockRef.current += delta;
    const time = clockRef.current + state.noisePhaseOffset;

    // Recompute targets if persona or emotion changed
    if (state.cachedPersona !== p || state.cachedEmotion !== e) {
      emotionTimeRef.current = 0;
      recomputeTargets(v);
    } else {
      emotionTimeRef.current += delta;
    }

    // Soft transition ramp for persona switches
    if (state.transitionWeight < state.targetTransitionWeight) {
      state.transitionWeight = Math.min(
        state.targetTransitionWeight,
        state.transitionWeight + delta * 3.5
      );
    }

    // Compute micro-noise for this frame
    const noise = computeMicroNoise(time);

    // Resolve noise keys → VRM names (and ensure springs)
    const noiseResolved: Map<string, number> = new Map();
    for (const [logicalKey, noiseVal] of Object.entries(noise)) {
      const resolvedName = state.logicalToResolved.get(logicalKey)
        ?? resolveVRMExpression(v, logicalKey);
      if (resolvedName) {
        noiseResolved.set(resolvedName, noiseVal as number);
        ensureSpring(resolvedName, logicalKey);
      }
    }

    // Suppression multiplier (0 when cinematic override active)
    const suppressMult = suppress ? 0.0 : 1.0;
    const globalMult = state.transitionWeight * suppressMult;

    // ── STEP ALL SPRINGS ──
    state.springs.forEach((spring, resolvedKey) => {
      // Compute final target = emotion target × global mult + micro noise
      const emotionTarget = spring.target * globalMult;
      const noiseOffset = noiseResolved.get(resolvedKey) ?? 0;
      const finalTarget = Math.max(-1.0, Math.min(1.0, emotionTarget + noiseOffset));

      // Temporarily override spring target for stepping
      const springTarget = finalTarget;

      // Temporarily set spring target for stepping
      const originalTarget = spring.target;
      spring.target = springTarget;

      // Step the spring physics
      stepSpring(spring, delta);

      // Restore original emotion target (not noise-modified) for next frame's comparison
      spring.target = originalTarget;

      // Clamp output
      const output = Math.max(-1.0, Math.min(1.0, spring.position));

      // Early exit for suppressed channels at rest
      if (suppress && Math.abs(output) < 0.001 && Math.abs(spring.velocity) < 0.001) {
        return;
      }

      // Apply to VRM
      try {
        v.expressionManager!.setValue(resolvedKey, output);
      } catch (_) { }
    });

    // PLAYFUL WINK OVERRIDE (0.6s cinematic sequence)
    // This section handles the PLAYFUL wink using the existing emotionTimeRef
    if (isPlayful) {
      const emotionTime = emotionTimeRef.current;

      // Left eye wink animation curve
      let blinkLeftTarget = 0;
      if (emotionTime < 0.15) {
        blinkLeftTarget = THREE.MathUtils.lerp(0, 1.0, emotionTime / 0.15);
      } else if (emotionTime < 0.30) {
        blinkLeftTarget = 1.0;
      } else if (emotionTime < 0.45) {
        const t = (emotionTime - 0.30) / 0.15;
        blinkLeftTarget = THREE.MathUtils.lerp(1.0, 0, t);
      }

      // Apply left eye closure
      const resolvedBlinkL = resolveVRMExpression(v, 'blinkLeft');
      if (resolvedBlinkL) {
        try { v.expressionManager!.setValue(resolvedBlinkL, blinkLeftTarget); } catch (_) { }
      }

      // SUPPRESS conflicting channels during wink
      state.springs.forEach((spring, resolvedKey) => {
        if (WINK_SUPPRESSED_CHANNELS.has(resolvedKey.toLowerCase())) {
          // Force suppress right eye and generic blink
          spring.position = -1.0 * globalMult;
          try { v.expressionManager!.setValue(resolvedKey, -1.0 * globalMult); } catch (_) { }
        }
      });

      // Suppress look expressions during wink
      if (emotionTime < 0.45) {
        const lookKeys = ['lookUp', 'lookDown', 'lookLeft', 'lookRight'];
        for (const lk of lookKeys) {
          const resolved = resolveVRMExpression(v, lk);
          if (resolved) {
            try { v.expressionManager!.setValue(resolved, 0); } catch (_) { }
          }
        }
      }
    }

    // Update the VRM expression manager
    v.expressionManager!.update();
  });

  // ── PUBLIC API ──

  const snapToTarget = useCallback(() => {
    const v = vrmRef.current;
    if (!v?.expressionManager) return;

    const state = engineState.current;
    state.springs.forEach((spring, resolvedKey) => {
      spring.position = spring.target;
      spring.velocity = 0;
      try { v.expressionManager!.setValue(resolvedKey, spring.target); } catch (_) { }
    });
    v.expressionManager.update();
  }, []);

  const getDebugWeights = useCallback((): Record<string, number> => {
    const result: Record<string, number> = {};
    engineState.current.springs.forEach((spring, key) => {
      result[key] = spring.position;
    });
    return result;
  }, []);

  return { snapToTarget, getDebugWeights, emotionTimeRef };
}
