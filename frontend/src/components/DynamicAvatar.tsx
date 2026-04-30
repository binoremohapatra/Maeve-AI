import { useEffect, useRef } from 'react';
import { useModelLoader } from '../hooks/useModelLoader';

interface DynamicAvatarProps {
  url: string;
  onLoad?: (model: any) => void;
  onError?: (err: Error) => void;
}

/**
 *  DynamicAvatar Component
 * 
 * Automatically loads and manages 3D models of multiple formats (.vrm, .glb, .fbx).
 * Handles memory cleanup and provides the model instance back to the scene.
 */
export const DynamicAvatar = ({ url, onLoad, onError }: DynamicAvatarProps) => {
  const { model, loading, error } = useModelLoader(url);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  useEffect(() => {
    if (model && url !== prevUrlRef.current) {
      console.log(" DynamicAvatar: Model Loaded ->", url);
      prevUrlRef.current = url;
      if (onLoad) {
        onLoad(model);
      }
    }
  }, [model, url, onLoad]);

  if (loading) return null;

  if (error) {
    console.error(" DynamicAvatar Error:", error);
    return (
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  return (
    <group name="DynamicAvatarRoot">
      {model && <primitive object={model.scene} />}
    </group>
  );
};
