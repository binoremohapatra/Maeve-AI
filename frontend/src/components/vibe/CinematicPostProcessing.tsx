import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { BlendFunction, Effect, BloomEffect, ChromaticAberrationEffect } from 'postprocessing';
import * as THREE from 'three';
// @ts-ignore
import { damp } from 'maath/easing';
import { useMoodStore } from '../../stores/moodStore';

const SPATIAL_DISTORTION_FRAG = /* glsl */`
  uniform float uStrength;
  uniform float uPhase;
  uniform float uDeadZone;
  uniform vec2  uCenter;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 delta = uv - uCenter;
    float dist = length(delta);
    
    // Mask to keep the character (center) clear
    float warpMask = smoothstep(uDeadZone, uDeadZone * 1.8, dist);
    
    // Radial Pull towards center
    float pull = uStrength * dist * dist * 4.0 * warpMask;
    
    // Twist/Spiral effect
    float twistAngle = uPhase * dist * 2.5 * warpMask;
    float ca = cos(twistAngle), sa = sin(twistAngle);
    vec2 twisted = vec2(delta.x * ca - delta.y * sa, delta.x * sa + delta.y * ca);
    
    vec2 sampleUv = uCenter + twisted - delta * pull;
    sampleUv = clamp(sampleUv, 0.001, 0.999);
    
    vec4 distorted = texture2D(inputBuffer, sampleUv);
    
    // Mix based on distance and mask
    float blendFactor = smoothstep(uDeadZone * 0.8, uDeadZone * 1.6, dist) * uStrength;
    outputColor = mix(inputColor, distorted, blendFactor * warpMask);
  }
`;

class SpatialDistortionEffect extends Effect {
  constructor() {
    const uniforms = new Map<string, THREE.Uniform>([
      ['uStrength', new THREE.Uniform(0.0)],
      ['uPhase', new THREE.Uniform(0.0)],
      ['uDeadZone', new THREE.Uniform(0.26)], // Mask radius
      ['uCenter', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
    ]);
    super('SpatialDistortionEffect', SPATIAL_DISTORTION_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms
    });
  }
  setStrength(v: number) { this.uniforms.get('uStrength')!.value = v; }
  setPhase(v: number) { this.uniforms.get('uPhase')!.value = v; }
}

const SpatialDistortionPass = ({ effectRef }: { effectRef: React.MutableRefObject<SpatialDistortionEffect | null> }) => {
  const effect = useMemo(() => {
    const e = new SpatialDistortionEffect();
    effectRef.current = e;
    return e;
  }, []);
  return <primitive object={effect} dispose={null} />;
};

interface PPState {
  bloomThreshold: number; bloomIntensity: number; chromX: number; chromY: number;
}

const DEFAULT_PP: PPState = { bloomThreshold: 1.5, bloomIntensity: 0.0, chromX: 0.0003, chromY: 0.0003 };

const DISTORTION_PERSONAS = new Set(['YANDERE', 'YANDERE_STALKER', 'FEAR', 'SADODERE', 'DORODERE', 'EVIL']);

export const CinematicPostProcessing = () => {
  const isLowEnd = useMoodStore(s => s.isLowEnd);
  const smooth = useRef<PPState>({ ...DEFAULT_PP });
  const distSmooth = useRef({ strength: 0.0, phase: 0.0 });
  const spatialEffectRef = useRef<SpatialDistortionEffect | null>(null);
  const chromOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  const bloomRef = useRef<BloomEffect | null>(null);
  const chromRef = useRef<ChromaticAberrationEffect | null>(null);

  const bloomEffect = useMemo(() => {
    const effect = new BloomEffect({
      mipmapBlur: false,
      radius: 0.35,
      luminanceThreshold: DEFAULT_PP.bloomThreshold,
      intensity: DEFAULT_PP.bloomIntensity,
      blendFunction: BlendFunction.SCREEN
    });
    bloomRef.current = effect;
    return effect;
  }, []);

  const chromEffect = useMemo(() => {
    const effect = new ChromaticAberrationEffect({
      offset: chromOffset,
      radialModulation: !isLowEnd,
      modulationOffset: 0.15
    });
    chromRef.current = effect;
    return effect;
  }, [chromOffset, isLowEnd]);

  useFrame((_state, delta) => {
    const mascot = useMoodStore.getState().mascot;
    const persona = (mascot?.emotion || mascot?.action || 'DEFAULT').toUpperCase();
    const voice = useMoodStore.getState().voiceVolume ?? 0;

    const isGolden = ['KAMIDERE', 'HIMEDERE', 'PROUD', 'DOMINANT'].includes(persona);
    const isDark = ['YANDERE', 'YANDERE_STALKER', 'SADODERE', 'FEAR', 'EVIL'].includes(persona);
    const isWarp = DISTORTION_PERSONAS.has(persona);

    // ── BLOOM ──────────────────────────────────────────────────────────────────
    // Threshold: HIGH (1.5 default) = only emissive highlights glow, not the skin.
    // Golden: 0.6 gives a halo shimmer without washing the face out.
    // Dark: 1.2 keeps a subtle, moody tone without covering the character.
    damp(smooth.current, 'bloomThreshold', isGolden ? 0.6 : (isDark ? 1.2 : 1.5), 0.5, delta);
    // Intensity: Cap at 0.7 (was 1.6 which bled light all over the character)
    damp(smooth.current, 'bloomIntensity', isGolden ? 0.7 : (isDark ? 0.15 : 0.0), 0.5, delta);

    // ── CHROMATIC ABERRATION ───────────────────────────────────────────────────
    const audioSpike = voice * 0.008;
    const baseChrom = (isDark || isWarp) ? 0.0015 : 0.0002;
    damp(smooth.current, 'chromX', baseChrom + audioSpike, 0.15, delta);
    damp(smooth.current, 'chromY', baseChrom + audioSpike, 0.15, delta);

    //  OPTIMIZED: Update persistent vector directly — zero GC allocation in useFrame
    chromOffset.set(smooth.current.chromX, smooth.current.chromY);

    // Spatial Distortion (Direct Uniform Update for Performance)
    if (spatialEffectRef.current) {
      damp(distSmooth.current, 'strength', isWarp ? (0.18 + voice * 0.25) : 0.0, 0.3, delta);
      distSmooth.current.phase += delta * 0.25 * distSmooth.current.strength;
      spatialEffectRef.current.setStrength(distSmooth.current.strength);
      spatialEffectRef.current.setPhase(distSmooth.current.phase);
    }

    if (bloomRef.current) {
      bloomRef.current.luminanceMaterial.threshold = smooth.current.bloomThreshold;
      bloomRef.current.intensity = smooth.current.bloomIntensity;
    }

    if (chromRef.current) {
      chromRef.current.offset.copy(chromOffset);
    }
  });

  return (
    <EffectComposer enableNormalPass={false} multisampling={isLowEnd ? 0 : 4} autoClear={false}>
      {!isLowEnd ? <SpatialDistortionPass effectRef={spatialEffectRef} /> : <></>}
      <primitive object={bloomEffect} dispose={null} />
      <primitive object={chromEffect} dispose={null} />
    </EffectComposer>
  );
};
