// @ts-nocheck
import React, { useRef } from 'react';

interface MaeveAvatarProps {
  animation?: string;
  base_emotion?: string;
  audio_url?: string | null;
  vrm?: any;
}

/**
 *  MaeveAvatar Component
 * 
 * Note: FBX loading, AnimationMixer, facial morphs, camera logic, and biological physics 
 * are all handled globally by HumanAnimationController.ts and VRMScene.tsx!
 * 
 * This component acts strictly as a rendering mount.
 */
export const MaeveAvatar = ({
  animation = "FEMINEIDLE",
  base_emotion = "NEUTRAL",
  audio_url = null,
  vrm = null
}: MaeveAvatarProps) => {
  const groupRef = useRef();
  
  return (
    <group ref={groupRef}>
      {vrm && <primitive object={vrm.scene} />}
    </group>
  );
};
