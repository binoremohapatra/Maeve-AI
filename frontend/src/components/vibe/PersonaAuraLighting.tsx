import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import { dampC, damp } from 'maath/easing';
import { useMoodStore } from '../../stores/moodStore';

interface LightConfig {
  ambientColor: string;
  ambientIntensity: number;
  keyColor: string;
  keyIntensity: number;
  rimColor: string;
  rimIntensity: number;   // The Kubrick rim
  eyeGlow: boolean;       // Subliminal eye highlight
}

const LIGHT_CONFIGS: Record<string, LightConfig> = {
  YANDERE: {
    ambientColor: '#1a0005', ambientIntensity: 0.10,
    keyColor: '#ff1020',
    keyIntensity: 0.5,
    rimColor: '#800010',
    rimIntensity: 2.2,
    eyeGlow: true,
  },
  YANDERE_STALKER: {
    ambientColor: '#100003', ambientIntensity: 0.06,
    keyColor: '#cc0018',    
    keyIntensity: 0.35,
    rimColor: '#600008',    
    rimIntensity: 2.8,
    eyeGlow: true,          
  },
  SADODERE: {
    ambientColor: '#050510', ambientIntensity: 0.08,
    keyColor: '#2020cc',    
    keyIntensity: 0.25,
    rimColor: '#0010aa',    
    rimIntensity: 2.4,
    eyeGlow: true,          
  },
  KAMIDERE: {
    ambientColor: '#fff0c0', ambientIntensity: 0.65,
    keyColor: '#fffae0',    
    keyIntensity: 1.4,
    rimColor: '#ffe080',    
    rimIntensity: 0.8,
    eyeGlow: false,
  },
  KUUDERE: {
    ambientColor: '#10202e', ambientIntensity: 0.28,
    keyColor: '#c0d8f0',    
    keyIntensity: 0.7,
    rimColor: '#6090c0',    
    rimIntensity: 1.4,
    eyeGlow: false,
  },
  LUST: {
    ambientColor: '#2d0018', ambientIntensity: 0.32,
    keyColor: '#ff40a0',    
    keyIntensity: 0.9,
    rimColor: '#cc2080',    
    rimIntensity: 1.2,
    eyeGlow: true,
  },
  SAD: {
    ambientColor: '#081018', ambientIntensity: 0.22,
    keyColor: '#8090a0',    
    keyIntensity: 0.6,
    rimColor: '#304060',    
    rimIntensity: 0.9,
    eyeGlow: false,
  },
  TSUNDERE: {
    ambientColor: '#2a1000', ambientIntensity: 0.35,
    keyColor: '#ff6820',    
    keyIntensity: 1.2,
    rimColor: '#ff4400',    
    rimIntensity: 1.6,
    eyeGlow: false,
  },
  FRUSTRATED: {
    ambientColor: '#200c00', ambientIntensity: 0.30,
    keyColor: '#ee5510',    
    keyIntensity: 1.0,
    rimColor: '#dd3300',    
    rimIntensity: 1.4,
    eyeGlow: false,
  },
  DANDERE: {
    ambientColor: '#080810', ambientIntensity: 0.15,
    keyColor: '#606080',    
    keyIntensity: 0.45,
    rimColor: '#303050',    
    rimIntensity: 1.0,
    eyeGlow: false,
  },
  LONELY: {
    ambientColor: '#060610', ambientIntensity: 0.12,
    keyColor: '#505070',    
    keyIntensity: 0.40,
    rimColor: '#282840',    
    rimIntensity: 0.9,
    eyeGlow: false,
  },
  HIMEDERE: {
    ambientColor: '#2a2000', ambientIntensity: 0.55,
    keyColor: '#ffd860',    
    keyIntensity: 1.5,
    rimColor: '#ffb840',    
    rimIntensity: 0.6,
    eyeGlow: false,
  },
  DOMINANT: {
    ambientColor: '#201800', ambientIntensity: 0.50,
    keyColor: '#ffc040',    
    keyIntensity: 1.3,
    rimColor: '#ff9820',    
    rimIntensity: 0.7,
    eyeGlow: false,
  },
  DORODERE: {
    ambientColor: '#200010', ambientIntensity: 0.25,
    keyColor: '#ff80b0',    
    keyIntensity: 0.8,
    rimColor: '#408020',    
    rimIntensity: 1.0,  
    eyeGlow: true,          
  },
  TOXIC: {
    ambientColor: '#0a1a00', ambientIntensity: 0.20,
    keyColor: '#80cc40',    
    keyIntensity: 0.7,
    rimColor: '#40a010',    
    rimIntensity: 1.2,
    eyeGlow: false,
  },
  FEAR: {
    ambientColor: '#050508', ambientIntensity: 0.12,
    keyColor: '#808090',    
    keyIntensity: 0.5,
    rimColor: '#202030',    
    rimIntensity: 1.8,
    eyeGlow: false,
  },
  DEFAULT: {
    ambientColor: '#ffffff', ambientIntensity: 0.70,
    keyColor: '#ffffff',    
    keyIntensity: 1.1,
    rimColor: '#ffffff',    
    rimIntensity: 0.3,
    eyeGlow: false,
  },
};

export const PersonaAuraLighting = () => {
  const mascot = useMoodStore(s => s.mascot);
  const ambientRef  = useRef<THREE.AmbientLight>(null);
  const keyRef      = useRef<THREE.DirectionalLight>(null);    
  const rimRef      = useRef<THREE.DirectionalLight>(null);    
  const eyeFillRef  = useRef<THREE.PointLight>(null);          

  useFrame((_state, delta) => {
    const key         = (mascot?.emotion || mascot?.action || 'DEFAULT').toUpperCase();
    const cfg         = LIGHT_CONFIGS[key] ?? LIGHT_CONFIGS.DEFAULT;
    const voiceVolume = useMoodStore.getState().voiceVolume ?? 0;
    const sp          = 0.28; 

    if (ambientRef.current) {
      dampC(ambientRef.current.color, cfg.ambientColor, sp, delta);
      damp(ambientRef.current, 'intensity', cfg.ambientIntensity, sp, delta);
    }
    if (keyRef.current) {
      dampC(keyRef.current.color, cfg.keyColor, sp, delta);
      damp(keyRef.current, 'intensity', cfg.keyIntensity + voiceVolume * 0.3, sp, delta);
    }
    if (rimRef.current) {
      dampC(rimRef.current.color, cfg.rimColor, sp, delta);
      damp(rimRef.current, 'intensity', cfg.rimIntensity, sp, delta);
    }
    if (eyeFillRef.current) {
      const targetIntensity = cfg.eyeGlow 
        ? 0.40 + voiceVolume * 0.20 
        : 0.0;
      damp(eyeFillRef.current, 'intensity', targetIntensity, sp, delta);
      
      const eyeColor = 
        key.includes('YANDERE') ? '#ff4040' : 
        key === 'SADODERE'      ? '#4040ff' :
        key === 'DORODERE'      ? '#ff80c0' :
        key === 'LUST'          ? '#ff60a0' : '#ff8080';
      dampC(eyeFillRef.current.color, eyeColor, sp, delta);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} color="#ffffff" intensity={0.7} />
      <directionalLight 
        ref={keyRef} 
        color="#ffffff" 
        intensity={1.1} 
        position={[1.5, 6, 3]} 
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight 
        ref={rimRef} 
        color="#ffffff" 
        intensity={0.3} 
        position={[-2, 1.5, -4]} 
        castShadow={false}
      />
      <pointLight 
        ref={eyeFillRef} 
        color="#ff8080" 
        intensity={0} 
        position={[0, 1.65, 0.6]} 
        distance={0.8}
        decay={2}
      />
    </>
  );
};
