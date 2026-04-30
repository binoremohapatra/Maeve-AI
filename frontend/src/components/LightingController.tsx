import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export default function LightingController() {
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const rimRef = useRef<THREE.DirectionalLight>(null!);
  const monitorRef = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
      // Optional: Gentle pulse on the monitor glow
      if (monitorRef.current) {
          monitorRef.current.intensity = 1.0 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      }
  });

  return (
    <>
      {/*  Deep Purple/Blue Atmospheric Ambient to match shadow tones */}
      <ambientLight ref={ambientRef} intensity={1.2} color="#2b2b40" />
      
      {/*  Neon Cyan Rim Light (Window Glow from Behind) */}
      <directionalLight ref={rimRef} position={[5, 4, -5]} intensity={3.5} color="#00ffff" />
      
      {/*  HUD / Monitor Screen Glow (Soft Blue Front Light) */}
      <pointLight ref={monitorRef} position={[0, 0.8, 1.5]} intensity={1.2} color="#88ccff" distance={5} decay={2} />
    </>
  );
}
