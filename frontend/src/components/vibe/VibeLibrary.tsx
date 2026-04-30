import { Bloom, Vignette, HueSaturation, BrightnessContrast, Noise, ColorAverage } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

//  Intimate/Spicy Vibe: Tunnel vision, soft bloom, and pink pulsing
export const LustVibe = ({ isLowEnd }: { isLowEnd: boolean }) => (
  <>
    <Bloom
      intensity={isLowEnd ? 0.8 : 1.5}
      luminanceThreshold={0.4}
      luminanceSmoothing={0.9}
      mipmapBlur={!isLowEnd}
      blendFunction={BlendFunction.SCREEN}
    />
    <Vignette
      offset={0.3}
      darkness={0.7}
      blendFunction={BlendFunction.NORMAL}
    />
    <HueSaturation saturation={0.1} />
  </>
);

//  Danger/Aggression Vibe: Clean, Subliminal Tension (NO cheap filters)
export const AngryVibe = ({ isLowEnd }: { isLowEnd: boolean }) => (
  <>
    {/* Subliminal Film Grain (Barely visible, adds "weight/anxiety" to the frame) */}
    {!isLowEnd && (
      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={0.08}
      />
    )}

    {/* Soft, heavy edges closing in on the character (Claustrophobia) */}
    <Vignette
      offset={0.5}
      darkness={0.55}
      blendFunction={BlendFunction.NORMAL}
    />
  </>
);

//  Isolation/Cold Vibe: Desaturated navy, chilling blue tint
export const SadVibe = (_props: { isLowEnd: boolean }) => (
  <>
    <Vignette
      offset={0.4}
      darkness={0.6}
      blendFunction={BlendFunction.NORMAL}
    />
    <HueSaturation saturation={-0.5} />
    <BrightnessContrast brightness={-0.05} contrast={0.1} />
  </>
);

//  Yandere / Psycho Vibe: Exact "Gasai Yuno" Look (Blood Haze & Glowing Stare)
export const YanderePsychoVibe = ({ isLowEnd }: { isLowEnd: boolean }) => (
  <>
    {/* 1. The Haze: Adds a deep red/magenta wash to the scene safely */}
    <ColorAverage
      blendFunction={BlendFunction.OVERLAY}
      // @ts-ignore - Some versions might not have opacity but we add it for intent
      opacity={0.4}
    />

    {/* 2. The Saturation: Makes the red tones "pop" aggressively */}
    <HueSaturation saturation={0.4} hue={-0.1} />

    {/* 3. THE MAGIC: Intense Bloom with low threshold. 
        This will make Maeve's eyes and any bright parts GLOW like the reference image. */}
    <Bloom
      intensity={isLowEnd ? 1.5 : 3.0}
      luminanceThreshold={0.2}
      luminanceSmoothing={0.9}
      mipmapBlur={!isLowEnd}
    />

    {/* 4. The Trap: A heavy, blood-colored vignette to simulate obsession */}
    <Vignette
      offset={0.2}
      darkness={0.9}
      color={[0.5, 0, 0.1] as any} // Deep Crimson Red
      blendFunction={BlendFunction.NORMAL}
    />
  </>
);

//  Happy/Glow Vibe: Subtle warm golden hour glow
export const HappyVibe = ({ isLowEnd }: { isLowEnd: boolean }) => (
  <>
    <Bloom
      intensity={isLowEnd ? 0.2 : 0.4}
      luminanceThreshold={0.8}
      mipmapBlur={!isLowEnd}
    />
    <BrightnessContrast brightness={0.05} />
  </>
);
