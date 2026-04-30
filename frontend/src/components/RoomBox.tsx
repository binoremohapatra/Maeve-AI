import * as THREE from 'three';
import { FloatingProp } from './FloatingProp';

export const RoomBox = () => {
    return (
        <group>
            {/*  Room Geometry */}
            {/* Back Wall */}
            <mesh position={[0, 1.5, -3]}>
                <planeGeometry args={[10, 5]} />
                <meshStandardMaterial color="#11111a" roughness={0.9} />
            </mesh>
            
            {/* Left Wall */}
            <mesh position={[-4, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[10, 5]} />
                <meshStandardMaterial color="#0a0a0f" roughness={0.9} />
            </mesh>

            {/* Right Wall */}
            <mesh position={[4, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[10, 5]} />
                <meshStandardMaterial color="#0a0a0f" roughness={0.9} />
            </mesh>

            {/* Floor (Rug area) */}
            <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[10, 10]} />
                <meshStandardMaterial color="#1a1a24" roughness={1.0} />
            </mesh>

            {/*  The Window Layer (Emissive Cyberpunk Backdrop) */}
            <mesh position={[2, 1.5, -2.9]}>
                <planeGeometry args={[3, 2]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.2} roughness={0.2} metalness={0.8} />
            </mesh>
            {/* Window Frame */}
            <mesh position={[2, 1.5, -2.8]}>
                <boxGeometry args={[3.2, 2.2, 0.1]} />
                <meshStandardMaterial color="#050505" roughness={0.8} />
            </mesh>

            {/*  Simple Low-Poly Couch */}
            <group position={[0, 0.2, -1.5]}>
                <mesh position={[0, 0.2, 0]}>
                    <boxGeometry args={[2.5, 0.4, 1]} />
                    <meshStandardMaterial color="#222230" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.8, -0.4]}>
                    <boxGeometry args={[2.5, 1, 0.2]} />
                    <meshStandardMaterial color="#222230" roughness={0.9} />
                </mesh>
                <mesh position={[-1.35, 0.6, 0]}>
                    <boxGeometry args={[0.2, 0.6, 1]} />
                    <meshStandardMaterial color="#1a1a24" roughness={0.8} />
                </mesh>
                <mesh position={[1.35, 0.6, 0]}>
                    <boxGeometry args={[0.2, 0.6, 1]} />
                    <meshStandardMaterial color="#1a1a24" roughness={0.8} />
                </mesh>
            </group>

            {/*  ZERO-G PROPS (Using Higher-Order Wrappers) */}
            
            {/*  Glowing Energy Orb */}
            <FloatingProp position={[-1.5, 1.8, -1]} floatAmplitude={0.15} floatSpeed={1.5} rotationDriftSpeed={0.8}>
                <mesh>
                    <sphereGeometry args={[0.15, 32, 32]} />
                    <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2.5} toneMapped={false} />
                </mesh>
            </FloatingProp>

            {/*  Holographic UI Panel */}
            <FloatingProp position={[1.5, 1.2, -0.5]} floatAmplitude={0.08} floatSpeed={1.2} rotationDriftSpeed={0.5}>
                <mesh rotation={[0, 0.5, 0]}>
                    <planeGeometry args={[1.2, 0.8]} />
                    <meshBasicMaterial color="#00ffcc" transparent opacity={0.3} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
                    {/* Panel Frame/Grid line */}
                    <primitive object={new THREE.GridHelper(1.2, 4, 0x00ffcc, 0x00ffcc)} rotation={[Math.PI/2, 0, 0]} material-transparent material-opacity={0.5} material-blending={THREE.AdditiveBlending} />
                </mesh>
            </FloatingProp>

            {/*  Floating Potted Plant */}
            <FloatingProp position={[-2, 0.5, -1]} floatAmplitude={0.1} floatSpeed={0.8} rotationDriftSpeed={1.2}>
                <group>
                    {/* Pot */}
                    <mesh position={[0, 0, 0]}>
                        <cylinderGeometry args={[0.15, 0.1, 0.2, 8]} />
                        <meshStandardMaterial color="#333333" roughness={0.8} />
                    </mesh>
                    {/* Leaves (Low poly spheres as stylized zero-g leaves) */}
                    <mesh position={[0, 0.2, 0]}>
                        <icosahedronGeometry args={[0.15, 1]} />
                        <meshStandardMaterial color="#00ff88" roughness={0.4} />
                    </mesh>
                    <mesh position={[0.1, 0.15, 0.1]}>
                        <icosahedronGeometry args={[0.1, 1]} />
                        <meshStandardMaterial color="#00ff88" roughness={0.4} />
                    </mesh>
                </group>
            </FloatingProp>

        </group>
    );
};
