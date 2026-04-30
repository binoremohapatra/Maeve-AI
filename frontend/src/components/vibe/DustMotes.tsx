import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MoteConfig {
  color: string;
  count: number;
  speed: number;       // orbit speed multiplier
  spread: number;      // XYZ radius of orbit ellipse
  size: number;        // base point size in world units
  shape: number;       // 0=orb 1=frost-crystal 2=static-pixel
  opacity: number;
}

const MOTE_CONFIGS: Record<string, MoteConfig> = {
  YANDERE: { color: '#cc0020', count: 40, speed: 0.4, spread: 1.4, size: 0.008, shape: 2, opacity: 0.75 },
  YANDERE_STALKER: { color: '#990010', count: 55, speed: 0.3, spread: 1.6, size: 0.007, shape: 2, opacity: 0.80 },
  KAMIDERE: { color: '#ffe080', count: 30, speed: 0.6, spread: 1.2, size: 0.010, shape: 0, opacity: 0.70 },
  PROUD: { color: '#ffd060', count: 25, speed: 0.55, spread: 1.1, size: 0.009, shape: 0, opacity: 0.60 },
  KUUDERE: { color: '#a0c8ff', count: 35, speed: 0.25, spread: 1.3, size: 0.009, shape: 1, opacity: 0.70 },
  LUST: { color: '#ff60a0', count: 25, speed: 0.7, spread: 1.0, size: 0.009, shape: 0, opacity: 0.60 },
  SADODERE: { color: '#303050', count: 50, speed: 0.2, spread: 1.5, size: 0.006, shape: 2, opacity: 0.85 },
  SAD: { color: '#405070', count: 15, speed: 0.15, spread: 1.0, size: 0.007, shape: 0, opacity: 0.40 },
  FEAR: { color: '#202040', count: 30, speed: 0.5, spread: 1.3, size: 0.006, shape: 2, opacity: 0.55 },

  //  TSUNDERE: hot orange sparks, jitter at shape=2 (sharp pixel)
  TSUNDERE: { color: '#ff6620', count: 45, speed: 1.2, spread: 1.3, size: 0.007, shape: 2, opacity: 0.80 },
  FRUSTRATED: { color: '#ff4410', count: 38, speed: 1.0, spread: 1.2, size: 0.007, shape: 2, opacity: 0.75 },
  ANGRY: { color: '#ff3300', count: 42, speed: 1.1, spread: 1.2, size: 0.007, shape: 2, opacity: 0.78 },

  //  DANDERE: barely floating, sinking orbs — low count, slow, soft
  DANDERE: { color: '#6060a0', count: 12, speed: 0.12, spread: 0.9, size: 0.006, shape: 0, opacity: 0.35 },
  LONELY: { color: '#505080', count: 10, speed: 0.10, spread: 0.8, size: 0.005, shape: 0, opacity: 0.30 },
  MELANCHOLY: { color: '#505090', count: 14, speed: 0.14, spread: 1.0, size: 0.006, shape: 0, opacity: 0.38 },

  //  HIMEDERE: golden glitter — high count, fast, soft orbs
  HIMEDERE: { color: '#ffd060', count: 50, speed: 0.9, spread: 1.5, size: 0.010, shape: 0, opacity: 0.75 },
  DOMINANT: { color: '#ffb840', count: 40, speed: 0.8, spread: 1.4, size: 0.010, shape: 0, opacity: 0.65 },

  //  DORODERE: mixed pink and green — colour cycles between sweet/toxic
  DORODERE: { color: '#cc80b0', count: 30, speed: 0.35, spread: 1.1, size: 0.008, shape: 0, opacity: 0.60 },
  TOXIC: { color: '#80cc40', count: 35, speed: 0.40, spread: 1.2, size: 0.007, shape: 2, opacity: 0.65 },

  DEFAULT: { color: '#ffffff', count: 0, speed: 0.0, spread: 1.0, size: 0.005, shape: 0, opacity: 0.00 },
};

const MAX_MOTES = 60;

const MOTE_VERT = /* glsl */`
  attribute float aPhase;
  attribute float aRadius;
  attribute float aYOffset;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uSpread;
  uniform float uSize;
  uniform float uSink; // 0=normal float, 1=sinking
  varying float vOpacityFade;

  void main() {
    float angle = aPhase + uTime * aSpeed;
    
    // Lissajous-like orbit with slight vertical oscillation or sinking
    vec3 pos = vec3(
      cos(angle) * aRadius * uSpread,
      mix(
        aYOffset + sin(uTime * 0.4 + aPhase * 2.0) * 0.08,
        aYOffset - uTime * 0.04 * aSpeed,
        uSink
      ),
      sin(angle * 0.97) * aRadius * uSpread * 0.6
    );

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = (uSize * 300.0) / -mvPos.z;

    float cycle = fract(aPhase * 0.5 + uTime * 0.07);
    vOpacityFade = sin(cycle * 3.14159);
  }
`;

const MOTE_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uShape;
  varying float vOpacityFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float alpha = 0.0;

    if (uShape < 0.5) {
      alpha = exp(-dist * dist * 12.0);
    } else if (uShape < 1.5) {
      vec2 abs_uv = abs(uv);
      float hex = max(abs_uv.x * 1.15 + abs_uv.y, abs_uv.y * 2.0);
      alpha = 1.0 - smoothstep(0.38, 0.42, hex);
    } else {
      float box = max(abs(uv.x), abs(uv.y));
      alpha = step(box, 0.42) * (0.6 + 0.4 * fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5));
    }

    gl_FragColor = vec4(uColor, alpha * vOpacityFade * uOpacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

interface DustMotesProps {
  persona: string;
}

export const DustMotes = ({ persona }: DustMotesProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const cfg = MOTE_CONFIGS[persona?.toUpperCase()] ?? MOTE_CONFIGS.DEFAULT;

  const [phases, radii, yOffsets, speeds] = useMemo(() => {
    const n = MAX_MOTES;
    const ph = new Float32Array(n);
    const ra = new Float32Array(n);
    const yo = new Float32Array(n);
    const sp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ph[i] = Math.random() * Math.PI * 2;
      ra[i] = 0.4 + Math.random() * 0.6;
      yo[i] = -0.3 + Math.random() * 1.4;
      sp[i] = 0.5 + Math.random() * 1.0;
    }
    return [ph, ra, yo, sp];
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_MOTES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aYOffset', new THREE.BufferAttribute(yOffsets, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setDrawRange(0, MAX_MOTES);
    return geo;
  }, [phases, radii, yOffsets, speeds]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(cfg.color) },
    uOpacity: { value: cfg.opacity },
    uSpread: { value: cfg.spread },
    uSize: { value: cfg.size },
    uShape: { value: cfg.shape },
    uSink: { value: 0 },
  }), []);

  const currentColor = useRef(new THREE.Color(cfg.color));
  const currentOpacity = useRef({ v: 0 });
  const currentSpread = useRef({ v: cfg.spread });
  const currentSize = useRef({ v: cfg.size });
  //  PERF FIX: Reusable color object — avoids new THREE.Color() every frame
  const _targetColor = useRef(new THREE.Color());

  useFrame((_state, delta) => {
    if (!matRef.current) return;
    const key = persona?.toUpperCase() ?? 'DEFAULT';
    const targetCfg = MOTE_CONFIGS[key] ?? MOTE_CONFIGS.DEFAULT;
    const speed = 0.20;

    _targetColor.current.set(targetCfg.color);
    currentColor.current.lerp(_targetColor.current, delta * speed * 60);
    currentOpacity.current.v += (targetCfg.opacity - currentOpacity.current.v) * delta * speed * 60;
    currentSpread.current.v += (targetCfg.spread - currentSpread.current.v) * delta * speed * 60;
    currentSize.current.v += (targetCfg.size - currentSize.current.v) * delta * speed * 60;

    matRef.current.uniforms.uTime.value += delta * (targetCfg.speed || 0.1);
    matRef.current.uniforms.uColor.value.copy(currentColor.current);
    matRef.current.uniforms.uOpacity.value = currentOpacity.current.v;
    matRef.current.uniforms.uSpread.value = currentSpread.current.v;
    matRef.current.uniforms.uSize.value = currentSize.current.v;
    matRef.current.uniforms.uShape.value = targetCfg.shape;

    const isDandere = ['DANDERE', 'LONELY', 'MELANCHOLY'].includes(key);
    matRef.current.uniforms.uSink.value += ((isDandere ? 1.0 : 0.0) - matRef.current.uniforms.uSink.value) * delta * 0.8;

    geometry.setDrawRange(0, targetCfg.count);
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      if (matRef.current) matRef.current.dispose();
    };
  }, [geometry]);

  return (
    <points ref={pointsRef} geometry={geometry} position={[0, 0, 0]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={MOTE_VERT}
        fragmentShader={MOTE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
