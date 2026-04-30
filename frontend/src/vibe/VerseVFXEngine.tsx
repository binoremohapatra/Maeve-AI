import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { VIBE_PROFILES, PersonaType } from './vibeConfig';

interface VerseVFXEngineProps {
  activePersona: PersonaType;
}

export const VerseVFXEngine = ({
  activePersona,
}: VerseVFXEngineProps) => {

  // We use key to remount EffectComposer on persona change 
  // This avoids all ref mutation issues entirely
  const profile = VIBE_PROFILES[activePersona];

  return (
    <EffectComposer>
      <Bloom
        intensity={profile.bloomIntensity}
        luminanceThreshold={profile.bloomLuminanceThreshold}
        luminanceSmoothing={profile.bloomLuminanceSmoothing}
        blendFunction={BlendFunction.ADD}
      />
      <Vignette
        darkness={profile.vignetteIntensity}
        offset={profile.vignetteOffset}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        offset={new THREE.Vector2(
          profile.chromaticOffsetX,
          profile.chromaticOffsetY
        )}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
};
