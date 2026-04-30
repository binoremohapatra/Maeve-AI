import { useMemo } from 'react';
import { createPortal } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
//  THE PROP DICTIONARY (Assigning models to Personas) - NANO SCALE FIX
// ============================================================================
const PERSONA_PROPS: Record<string, any> = {
  //  THE ABYSS (Knives & Phones) - अब एकदम परफेक्ट किचन नाइफ!
  YANDERE: { url: '/models/kitchen_knife.glb', bone: 'rightHand', pos: [0, 0.05, 0.02], rot: [0, Math.PI/2, 0], scale: 0.0008 }, 
  SADODERE: { url: '/models/kitchen_knife.glb', bone: 'rightHand', pos: [0, 0.05, 0.02], rot: [0, Math.PI/2, 0], scale: 0.0008 }, 
  YANDERE_STALKER: { url: '/models/smart_phone_school_project.glb', bone: 'rightHand', pos: [0, 0.05, 0.05], rot: [0, 0, 0], scale: 0.005 }, 
  YANMETA: { url: '/models/smart_phone_school_project.glb', bone: 'leftHand', pos: [0, 0.05, 0.05], rot: [0, 0, 0], scale: 0.005 }, 
  
  //  THE SANCTUARY & ANXIOUS (Teddy Bears & Mugs)
  HAJIDERE: { url: '/models/teddy_bear.glb', bone: 'leftHand', pos: [0, 0.02, 0.08], rot: [0, Math.PI, 0], scale: 0.008 }, 
  ANXIOUS: { url: '/models/teddy_bear.glb', bone: 'leftHand', pos: [0, 0.02, 0.08], rot: [0, Math.PI, 0], scale: 0.008 }, 
  AMADERE: { url: '/models/plain_mug.glb', bone: 'rightHand', pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 0.003 }, 
  MAMADERE: { url: '/models/plain_mug.glb', bone: 'rightHand', pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 0.003 }, 

  //  THE GLACIER (Wine, Fans & Books)
  GOTH_MOMMY: { url: '/models/wine_glass.glb', bone: 'rightHand', pos: [0, 0.06, 0], rot: [0, 0, 0], scale: 0.003 }, 
  KAMIDERE: { url: '/models/folding_fan.glb', bone: 'rightHand', pos: [0, 0.05, 0], rot: [0, 0, 0], scale: 0.003 }, 
  KUUDERE: { url: '/models/book.glb', bone: 'leftHand', pos: [0, 0.05, 0], rot: [0, Math.PI/2, 0], scale: 0.003 }, 

  //  GAMER
  ADVENTUROUS: { url: '/models/gaming_headset.glb', bone: 'head', pos: [0, 0.05, 0], rot: [0, Math.PI/2, 0], scale: 0.003 }, 
};

// ============================================================================
//  THE PROP ENGINE COMPONENT
// ============================================================================
export const PersonaPropEngine = ({ vrm, persona }: { vrm: any, persona: string }) => {
  const activePersona = (persona || 'DEFAULT').toUpperCase();
  const config = PERSONA_PROPS[activePersona];

  // Load GLTF only if there's a prop configured for this persona
  // useGLTF handles caching, so it only fetches once. Use a safe fallback for null/empty config.
  const gltf = useGLTF(config ? config.url : '/models/plain_mug.glb'); 
  
  // Find target bone
  const targetBone = useMemo(() => {
    if (!vrm || !config) return null;
    return vrm.humanoid?.getNormalizedBoneNode(config.bone) || vrm.humanoid?.getRawBoneNode(config.bone) || vrm.scene.getObjectByName(config.bone);
  }, [vrm, config]);

  // Clone and position the prop
  const propMesh = useMemo(() => {
    const scene = (gltf as any).scene;
    if (!config || !scene) return null;
    
    const clone = scene.clone();
    clone.position.set(...config.pos);
    
    const euler = new THREE.Euler(...config.rot);
    clone.setRotationFromEuler(euler);
    
    clone.scale.setScalar(config.scale);
    
    // Optional: traversing to set shadows if needed
    clone.traverse((obj: any) => { if (obj.isMesh) obj.castShadow = true; });

    return <primitive object={clone} />;
  }, [gltf, config]);

  if (!config || !targetBone || !propMesh) return null;

  // Use portal to attach the prop mesh to the bone object
  return createPortal(propMesh, targetBone);
};

// Preload all assets
Object.values(PERSONA_PROPS).forEach((p) => {
  useGLTF.preload(p.url);
});
