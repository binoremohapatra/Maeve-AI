import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export type LoadedVRM = {
  scene: THREE.Group;
  vrm: any;
  mixer: THREE.AnimationMixer;
};

/**
 *  useModelLoader (VRM-Only Version)
 * 
 * Handles strict VRM loading with automatic memory cleanup.
 * Generic GLB/FBX support has been removed to ensure maximum stability and VRM feature parity.
 */
export function useModelLoader(url: string | null) {
  const [model, setModel] = useState<LoadedVRM | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setModel(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loader = new GLTFLoader();
    // Register VRM plugin
    loader.register((parser) => new VRMLoaderPlugin(parser));

    async function load() {
      if (!url) return;
      try {
        console.log(" Loading VRM:", url);
        const gltf = await loader.loadAsync(url);
        const vrm = gltf.userData.vrm;

        if (!vrm) {
           throw new Error("File loaded but no VRM data found. Ensure the file is a valid .vrm.");
        }

        // Optimization: Cleanup unnecessary data
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

        // Ensure frustum culling is off so the model doesn't vanish
        vrm.scene.traverse((obj: any) => {
          if (obj.isMesh) obj.frustumCulled = false;
        });

        if (isMounted) {
          setModel({
            scene: vrm.scene,
            vrm: vrm,
            mixer: new THREE.AnimationMixer(vrm.scene)
          });
          setLoading(false);
        }
      } catch (err: any) {
        console.error(" VRM Loading Failed:", err);
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
      //  DEEP RESOURCE DISPOSAL
      if (model) {
        console.log(" Disposing VRM resources for:", url);
        const { scene, vrm, mixer } = model;
        
        // 1. Stop all animations
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);

        // 2. Traverse and dispose
        scene.traverse((obj: any) => {
          if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m: any) => m.dispose());
              } else {
                obj.material.dispose();
              }
            }
          }
        });

        // 3. VRM specific cleanup (expression manager, etc)
        if (vrm && vrm.expressionManager) {
            // VRM 1.0 specific cleanup if available
        }
      }
    };
  }, [url]);

  return { model, loading, error };
}
