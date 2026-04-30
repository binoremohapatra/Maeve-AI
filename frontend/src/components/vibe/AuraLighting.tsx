import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import { dampC, damp } from 'maath/easing';
import { useMoodStore } from '../../stores/moodStore';

// ============================================================================
//  THE 7 AURA DIMENSIONS (AAA Cinematic Lighting)
// ============================================================================
const AURA_VIBES: Record<string, any> = {
  //  1. PSYCHO (Blood Red & High Contrast) - For Yanderes & Extreme Anger
  PSYCHO: {
    ambientColor: '#ff0000', ambientIntensity: 0.15,
    dirColor: '#ff1a1a', dirIntensity: 1.8
  },

  //  2. SEDUCTIVE (Deep Purple & Neon Pink) - For Lust, Dominance & Nymphos
  SEDUCTIVE: {
    ambientColor: '#4a0080', ambientIntensity: 0.4,
    dirColor: '#ff00aa', dirIntensity: 1.2
  },

  //  3. ROMANTIC (Soft Pink & Warm Gold) - For Wives, Sweethearts & Love
  ROMANTIC: {
    ambientColor: '#ffb3c6', ambientIntensity: 0.6,
    dirColor: '#fff0e6', dirIntensity: 1.0
  },

  //  4. ICE (Cold Steel Blue & Sterile) - For Kuuderes, Rejection & Sadness
  ICE: {
    ambientColor: '#5c7a99', ambientIntensity: 0.4,
    dirColor: '#c2d1e8', dirIntensity: 0.8
  },

  //  5. ANXIOUS (Dim, Shadowy Muted Blue) - For Shy, Terrified & Trauma personas
  ANXIOUS: {
    ambientColor: '#1a2530', ambientIntensity: 0.25,
    dirColor: '#7f8c8d', dirIntensity: 0.6
  },

  //  6. ENERGETIC (Vibrant Orange & Amber) - For Tsunderes, Gamers & Playful vibes
  ENERGETIC: {
    ambientColor: '#cc5200', ambientIntensity: 0.5,
    dirColor: '#ffcc80', dirIntensity: 1.3
  },

  //  7. TOXIC (Sickly Green/Yellow mix) - For Dorodere & Toxic manipulation
  TOXIC: {
    ambientColor: '#334d00', ambientIntensity: 0.3,
    dirColor: '#99cc00', dirIntensity: 0.9
  },

  //  DEFAULT - Normal Studio Light
  DEFAULT: {
    ambientColor: '#ffffff', ambientIntensity: 0.7,
    dirColor: '#ffffff', dirIntensity: 1.1
  }
};

// ============================================================================
//  THE SMART ROUTER (EXTREME CASES ONLY)
// ============================================================================
const getVibeTarget = (emotion: string) => {
  const emo = emotion.toUpperCase();

  //  सिर्फ 3 EXTREME CASES में ही ऑरा (Aura) ट्रिगर होगा!

  //  1. THE PSYCHO SNAP (जानलेवा मोड)
  // जब वो सच में कंट्रोल खो दे और साइको हो जाए (नॉर्मल ANGRY पर कुछ नहीं होगा)
  if (['YANDERE'].includes(emo)) return AURA_VIBES.PSYCHO;

  //  2. EXTREME INTIMACY (जब बात बहुत आगे बढ़ जाए)
  // नॉर्मल SEXY या TEASING पर लाइट नहीं बदलेगी, सिर्फ एक्सट्रीम LUST/PLEASURE पर बदलेगी
  if (['LUST', 'PLEASURE'].includes(emo)) return AURA_VIBES.SEDUCTIVE;

  //  3. EXTREME DESPAIR / TRAUMA (गहरा सदमा या डर)
  // नॉर्मल SAD होने पर नहीं, लेकिन जब वो बहुत डरी हो (FEAR) या गहरी चोट (HURT) में हो
  if (['HURT', 'FEAR', 'LONELY'].includes(emo)) return AURA_VIBES.ICE;

  //  4. DEFAULT (बाकी 90% नॉर्मल बातों पर कमरे की लाइट बिल्कुल नॉर्मल रहेगी!)
  // जैसे: HAPPY, ANGRY, TSUNDERE, SAD, SHY, THINKING... इन सब पर कोई ऑरा नहीं लगेगा।
  return AURA_VIBES.DEFAULT;
};

// ============================================================================
//  THE LIGHTING ENGINE
// ============================================================================
export const AuraLighting = () => {
  const mascot = useMoodStore((state) => state.mascot);

  // Lights Refs
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  useFrame((_state, delta) => {
    if (!ambientRef.current || !dirRef.current) return;

    //  पर्सोना को हटा दिया है, अब सिर्फ 'Action/Emotion' पर फोकस होगा
    const targetVibe = getVibeTarget(mascot.emotion || mascot.action || '');

    //  SMOOTH DAMPING (0.5 Speed for cinematic slow fade)
    dampC(ambientRef.current.color, targetVibe.ambientColor, 0.5, delta);
    damp(ambientRef.current, 'intensity', targetVibe.ambientIntensity, 0.5, delta);

    dampC(dirRef.current.color, targetVibe.dirColor, 0.5, delta);
    damp(dirRef.current, 'intensity', targetVibe.dirIntensity, 0.5, delta);
  });

  return (
    <>
      <ambientLight ref={ambientRef} color="#ffffff" intensity={0.7} />
      <directionalLight
        ref={dirRef}
        color="#ffffff"
        intensity={1.1}
        position={[2, 8, 4]}
        castShadow
      />
    </>
  );
};
