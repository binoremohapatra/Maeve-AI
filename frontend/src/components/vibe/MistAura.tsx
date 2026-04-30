import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import { damp } from 'maath/easing';
import { useMoodStore } from '../../stores/moodStore';

// ─── PER-PERSONA CONFIG ───────────────────────────────────────────────────────
interface MistConfig {
  colorA: string;   // fog inner tint
  colorB: string;   // fog outer tint
  speed: number;    // noise scroll speed (lower = creepier)
  opacity: number;  // max alpha
  scale: number;    // plane world-unit size
}

const MIST_CONFIGS: Record<string, MistConfig> = {
  // ── EXISTING ─────────────────────────────────────────────────────────────
  YANDERE: { colorA: '#3d0000', colorB: '#1a0008', speed: 0.05, opacity: 0.85, scale: 3.8 },
  YANDERE_STALKER: { colorA: '#2e0000', colorB: '#140006', speed: 0.04, opacity: 0.92, scale: 4.2 },
  KAMIDERE: { colorA: '#ffe0a0', colorB: '#c89040', speed: 0.18, opacity: 0.55, scale: 3.6 },
  PROUD: { colorA: '#fff0c0', colorB: '#c8a050', speed: 0.20, opacity: 0.45, scale: 3.4 },
  KUUDERE: { colorA: '#1a2a3d', colorB: '#0a1520', speed: 0.08, opacity: 0.65, scale: 3.5 },
  LUST: { colorA: '#3d0030', colorB: '#1a0018', speed: 0.22, opacity: 0.60, scale: 3.2 },
  PLEASURE: { colorA: '#3d0030', colorB: '#1a0018', speed: 0.25, opacity: 0.65, scale: 3.2 },
  SADODERE: { colorA: '#0a0a1a', colorB: '#050508', speed: 0.06, opacity: 0.90, scale: 4.0 },
  SAD: { colorA: '#0d1a2a', colorB: '#080e18', speed: 0.10, opacity: 0.50, scale: 3.0 },
  HURT: { colorA: '#0d1520', colorB: '#080e18', speed: 0.08, opacity: 0.55, scale: 3.0 },
  FEAR: { colorA: '#101020', colorB: '#080810', speed: 0.15, opacity: 0.60, scale: 3.4 },

  // ── NEW PERSONAS ──────────────────────────────────────────────────────────
  //  TSUNDERE: aggressive heat shimmer — fast, jittery, orange core
  TSUNDERE: { colorA: '#ff4400', colorB: '#3d0800', speed: 0.55, opacity: 0.72, scale: 3.4 },
  FRUSTRATED: { colorA: '#cc3300', colorB: '#2e0600', speed: 0.48, opacity: 0.68, scale: 3.2 },
  ANGRY: { colorA: '#dd2200', colorB: '#280400', speed: 0.45, opacity: 0.70, scale: 3.3 },

  //  DANDERE: cold loneliness — muted indigo, barely moving, heavy and sinking
  DANDERE: { colorA: '#1a1a2e', colorB: '#0d0d1a', speed: 0.06, opacity: 0.78, scale: 3.8 },
  LONELY: { colorA: '#151525', colorB: '#0a0a18', speed: 0.05, opacity: 0.72, scale: 3.6 },
  MELANCHOLY: { colorA: '#1e1e35', colorB: '#0e0e1e', speed: 0.07, opacity: 0.65, scale: 3.4 },

  //  HIMEDERE: royal aura — warm gold shimmer with rose undertone
  HIMEDERE: { colorA: '#ffe060', colorB: '#c87050', speed: 0.28, opacity: 0.60, scale: 4.0 },
  DOMINANT: { colorA: '#ffd040', colorB: '#c06040', speed: 0.25, opacity: 0.55, scale: 3.8 },

  //  DORODERE: sweet exterior, toxic core — the mist transitions mid-gradient
  // colorA = outer pink sweetness, colorB = inner sickly green rot
  DORODERE: { colorA: '#ff80c0', colorB: '#204010', speed: 0.20, opacity: 0.70, scale: 3.6 },
  TOXIC: { colorA: '#90ff60', colorB: '#1a3008', speed: 0.25, opacity: 0.65, scale: 3.4 },

  DEFAULT: { colorA: '#000000', colorB: '#000000', speed: 0.10, opacity: 0.00, scale: 3.0 },
};

// ─── GLSL SHADER ─────────────────────────────────────────────────────────────
const MIST_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MIST_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  uniform int   uOctaves;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
                   dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
               mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
                   dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
  }

  float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    vec2  shift = vec2(100.0);
    mat2  rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        v += a * noise(p);
        p  = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float radialMask = 1.0 - smoothstep(0.0, 0.5, length(centered));

    vec2 st = vUv * 2.5;
    
    // LowEnd mode reduces octaves from 5 to 2 (Massive fragment shader win)
    float q = fbm(st + uTime * 0.15, uOctaves);
    float r = fbm(st + q + uTime * 0.08 + vec2(1.7, 9.2), uOctaves);
    float f = fbm(st + r, uOctaves);

    f = (f + 1.0) * 0.5;
    f = clamp(f * 1.2 - 0.1, 0.0, 1.0);

    vec3 color = mix(uColorB, uColorA, f * f);
    float alpha = f * radialMask * uOpacity;
    alpha *= smoothstep(0.0, 0.4, vUv.y);
    gl_FragColor = vec4(color, alpha);
  }
`;

interface MistAuraProps {
  persona: string;
}

export const MistAura = ({ persona }: MistAuraProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const key = persona?.toUpperCase() ?? 'DEFAULT';
  const cfg = MIST_CONFIGS[key] ?? MIST_CONFIGS.DEFAULT;

  const currentColorA = useRef(new THREE.Color(cfg.colorA));
  const currentColorB = useRef(new THREE.Color(cfg.colorB));
  const currentOpacity = useRef({ v: cfg.opacity });

  //  PERF FIX: Pre-allocate reusable color objects — avoids ~120 GC allocations/sec
  const _targetA = useRef(new THREE.Color());
  const _targetB = useRef(new THREE.Color());

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorA: { value: currentColorA.current.clone() },
    uColorB: { value: currentColorB.current.clone() },
    uOpacity: { value: currentOpacity.current.v },
    uOctaves: { value: 5 },
  }), []);

  useFrame((_state, delta) => {
    if (!matRef.current) return;
    const targetCfg = MIST_CONFIGS[persona?.toUpperCase()] ?? MIST_CONFIGS.DEFAULT;
    const voiceVolume = useMoodStore.getState().voiceVolume; // 0–1 RMS

    //  PERF FIX: Reuse pre-allocated color objects — zero GC pressure per frame
    _targetA.current.set(targetCfg.colorA);
    _targetB.current.set(targetCfg.colorB);

    const isLowEnd = useMoodStore.getState().isLowEnd;

    currentColorA.current.lerp(_targetA.current, delta * 0.25);
    currentColorB.current.lerp(_targetB.current, delta * 0.25);
    damp(currentOpacity, 'v', targetCfg.opacity, 0.25, delta);

    // Audio spike: voice volume boosts scroll speed additively (max +0.4)
    const audioSpeedBoost = voiceVolume * 0.4;
    matRef.current.uniforms.uTime.value += delta * (targetCfg.speed + audioSpeedBoost);
    matRef.current.uniforms.uColorA.value.copy(currentColorA.current);
    matRef.current.uniforms.uColorB.value.copy(currentColorB.current);
    matRef.current.uniforms.uOpacity.value = currentOpacity.current.v;
    matRef.current.uniforms.uOctaves.value = isLowEnd ? 2 : 5;
  });

  useEffect(() => {
    return () => {
      if (meshRef.current?.geometry) {
        meshRef.current.geometry.dispose();
      }
      if (matRef.current) {
        matRef.current.dispose();
      }
    };
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={[0, 0.5, -0.8]}
      renderOrder={-1}
    >
      <planeGeometry args={[cfg.scale, cfg.scale * 1.4, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={MIST_VERT}
        fragmentShader={MIST_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
