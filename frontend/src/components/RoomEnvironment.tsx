import { useGLTF } from '@react-three/drei';
import { Suspense } from 'react';

function MainRoom() {
  const { scene } = useGLTF('/models/CuStRoom01_Main.glb');
  const handleRoomClick = (event: any) => {
    event.stopPropagation();
    const { x, y, z } = event.point;
    console.log(` WAYPOINT -> X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}`);
  };
  return <primitive object={scene} position={[0, -1.5, 0]} scale={1.2} onClick={handleRoomClick} />;
}

function FrontRoom() {
  const { scene } = useGLTF('/models/CuStRoom02_Front.glb');
  const handleRoomClick = (event: any) => {
    event.stopPropagation();
    const { x, y, z } = event.point;
    console.log(` WAYPOINT -> X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}`);
  };
  return <primitive object={scene} position={[0, -1.5, 0]} scale={1.2} onClick={handleRoomClick} />;
}

export function RoomEnvironment() {
  return (
    <group>
      {/* Main room pehle load hoga */}
      <Suspense fallback={null}>
        <MainRoom />
      </Suspense>
      {/* Front room baad mein load hoga — browser block nahi hoga */}
      <Suspense fallback={null}>
        <FrontRoom />
      </Suspense>
    </group>
  );
}

useGLTF.preload('/models/CuStRoom01_Main.glb');
useGLTF.preload('/models/CuStRoom02_Front.glb');