import React, { useMemo } from 'react';
import { RoundedBox, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useMoodStore } from '../stores/moodStore';

//  ULTRA REALISTIC SKULL (Preserved)
const SkullDecor = ({ position, rotation, scale = 1 }: any) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh position={[0, 0.14, 0]}> <sphereGeometry args={[0.13, 20, 20]} /> <meshStandardMaterial color="#e0e0e0" roughness={0.3} /> </mesh>
    <mesh position={[0, 0.08, 0.02]} rotation={[0, Math.PI / 4, 0]}> <cylinderGeometry args={[0.12, 0.08, 0.1, 8]} /> <meshStandardMaterial color="#e0e0e0" roughness={0.3} /> </mesh>
    <mesh position={[0, 0, 0.04]}> <RoundedBox args={[0.1, 0.08, 0.1]} radius={0.02}> <meshStandardMaterial color="#dcdcdc" roughness={0.3} /> </RoundedBox> </mesh>
    <mesh position={[-0.05, 0.11, 0.1]}> <sphereGeometry args={[0.035]} /> <meshBasicMaterial color="#000" /> </mesh>
    <mesh position={[0.05, 0.11, 0.1]}> <sphereGeometry args={[0.035]} /> <meshBasicMaterial color="#000" /> </mesh>
    <mesh position={[0, 0.06, 0.12]} rotation={[0, 0, Math.PI]}> <coneGeometry args={[0.015, 0.04, 3]} /> <meshBasicMaterial color="#000" /> </mesh>
  </group>
);

//  टाइल्स को पतला (Patla) करने के लिए Rows बढ़ा दी हैं
const UnevenWoodenFloor = () => {
  const floorWidth = 25; const floorLength = 20;
  const rows = 45; //  INCREASED: टाइल्स अब पतली दिखेंगी
  const rowWidth = floorWidth / rows;
  const planks = useMemo(() => {
    const p = [];
    for (let i = 0; i < rows; i++) {
      let currentLength = 0; const startOffset = (Math.random() - 0.5) * 2; const xPos = (i - rows / 2) * rowWidth + rowWidth / 2;
      while (currentLength < floorLength + 5) {
        const pLen = 3 + Math.random() * 4; const zPos = currentLength - floorLength / 2 + pLen / 2 + startOffset;
        const shades = ["#1a1108", "#261a0d", "#120c05", "#2e1d1b"]; const color = shades[Math.floor(Math.random() * shades.length)];
        p.push({ pos: [xPos, Math.random() * 0.01, zPos], size: [rowWidth - 0.03, 0.04, pLen - 0.05], color });
        currentLength += pLen;
      }
    }
    return p;
  }, [rows, rowWidth]);
  return (
    <group position={[0, -0.02, 0]}>
      {planks.map((plank, idx) => (<mesh key={idx} position={plank.pos as any} receiveShadow> <boxGeometry args={plank.size as any} /> <meshStandardMaterial color={plank.color} roughness={0.9} /> </mesh>))}
    </group>
  );
};

//  स्पाइडर मैट को Circular (गोल) बना दिया है
const SpiderWebMat = () => {
  const radius = 6.5; // Circle Size
  const webLines = useMemo(() => {
    const lines = [];
    // Radial Lines (स्पोक्स)
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      lines.push([[0, 0, 0], [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]]);
    }
    // Circular Rings
    for (let j = 1; j <= 6; j++) {
      const r = (j / 6) * radius;
      for (let i = 0; i <= 32; i++) {
        const a1 = (i / 32) * Math.PI * 2; const a2 = ((i + 1) / 32) * Math.PI * 2;
        lines.push([[Math.cos(a1) * r, 0, Math.sin(a1) * r], [Math.cos(a2) * r, 0, Math.sin(a2) * r]]);
      }
    }
    return lines;
  }, [radius]);
  return (
    <group position={[0, 0.01, -0.5]}>
      {/* Circle Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color="#5e0b48" roughness={1} />
      </mesh>
      {webLines.map((pts, i) => (<Line key={i} points={pts as any} color="#ffffff" lineWidth={0.5} transparent opacity={0.5} />))}
    </group>
  );
};

//   NEW: HIGHLY ORNATE VICTORIAN MIRROR (Better Design)
const VictorianMirrorOrnate = ({ position, rotation, scale = 1 }: any) => {
  const black = "#0a0a0a"; const gold = "#c5a059";
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Main heavy outer frame layer */}
      <mesh> <torusGeometry args={[1.1, 0.15, 16, 64]} /> <meshStandardMaterial color={black} roughness={0.4} /> </mesh>
      {/* Secondary inner gold frame layer for depth */}
      <mesh position={[0, 0, 0.05]}> <torusGeometry args={[0.9, 0.08, 16, 64]} /> <meshStandardMaterial color={gold} metalness={0.8} roughness={0.2} /> </mesh>
      {/* Innermost black trim */}
      <mesh position={[0, 0, 0.08]}> <torusGeometry args={[0.8, 0.03, 16, 64]} /> <meshStandardMaterial color={black} roughness={0.4} /> </mesh>

      {/* Ornate Studs/Flourishes around the frame */}
      {new Array(16).fill(0).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 0.05]} rotation={[0, 0, angle]}>
            <mesh> <sphereGeometry args={[0.06]} /> <meshStandardMaterial color={gold} metalness={1} /> </mesh>
            {/* Small flourishes at cardinal directions */}
            {i % 4 === 0 && <mesh position={[0.1, 0, 0]}> <boxGeometry args={[0.15, 0.05, 0.05]} /> <meshStandardMaterial color={gold} metalness={1} /> </mesh>}
          </group>
        )
      })}

      {/* Elaborate Top Crest */}
      <group position={[0, 1.3, 0.1]}>
        <mesh rotation={[0, 0, Math.PI / 4]}> <boxGeometry args={[0.4, 0.4, 0.1]} /> <meshStandardMaterial color={black} /> </mesh>
        <mesh position={[0, 0.25, 0]}> <sphereGeometry args={[0.12]} /> <meshStandardMaterial color={gold} metalness={1} /> </mesh>
        <mesh position={[-0.25, 0.05, 0]}> <sphereGeometry args={[0.08]} /> <meshStandardMaterial color={gold} metalness={1} /> </mesh>
        <mesh position={[0.25, 0.05, 0]}> <sphereGeometry args={[0.08]} /> <meshStandardMaterial color={gold} metalness={1} /> </mesh>
      </group>

      {/* Mirror Surface */}
      <mesh position={[0, 0, 0.09]}> <circleGeometry args={[0.8, 64]} /> <meshStandardMaterial color="#90a4ae" metalness={0.98} roughness={0.01} /> </mesh>
    </group>
  );
};

//  VICTORIAN WALL CLOCK
const VictorianClock = ({ position, rotation, scale = 0.5 }: any) => {
  const wood = "#1a0500"; const gold = "#c5a059";
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh> <torusGeometry args={[1, 0.1, 16, 100]} /> <meshStandardMaterial color={wood} /> </mesh>
      <mesh position={[0, 0, -0.05]}> <circleGeometry args={[1.1, 32]} /> <meshStandardMaterial color={wood} /> </mesh>
      <mesh position={[0, 0, 0.02]}> <circleGeometry args={[0.9, 32]} /> <meshStandardMaterial color="#fffdd0" /> </mesh>
      <mesh position={[0, 0.2, 0.03]}> <boxGeometry args={[0.03, 0.5, 0.01]} /> <meshBasicMaterial color="#111" /> </mesh>
      <mesh position={[0.2, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}> <boxGeometry args={[0.03, 0.4, 0.01]} /> <meshBasicMaterial color="#111" /> </mesh>
      <mesh position={[0, 1.1, 0.05]}> <sphereGeometry args={[0.1]} /> <meshStandardMaterial color={gold} /> </mesh>
    </group>
  );
};
//  LAMP (Updated: Realistic Bulb ON/OFF)
const VictorianTableLamp = ({ position, rotation, scale = 1, intensity = 0 }: any) => {
  const brass = "#c5a059";
  const shadeColor = "#f5e6c4";
  const isGlowing = intensity > 0;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Base & Stem */}
      <mesh position={[0, 0.05, 0]}> <cylinderGeometry args={[0.15, 0.2, 0.1, 16]} /> <meshStandardMaterial color={brass} metalness={0.6} roughness={0.3} /> </mesh>
      <mesh position={[0, 0.3, 0]}> <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} /> <meshStandardMaterial color={brass} metalness={0.6} /> </mesh>
      <mesh position={[0, 0.4, 0]}> <sphereGeometry args={[0.07]} /> <meshStandardMaterial color={brass} metalness={0.8} /> </mesh>
      <mesh position={[0, 0.6, 0]}> <cylinderGeometry args={[0.03, 0.03, 0.3, 12]} /> <meshStandardMaterial color={brass} metalness={0.6} /> </mesh>

      {/* Shade & Bulb */}
      <group position={[0, 0.85, 0]}>
        {/* Shade Material changes when Lit */}
        <mesh>
          <cylinderGeometry args={[0.25, 0.4, 0.5, 24, 1, true]} />
          <meshStandardMaterial
            color={shadeColor}
            side={THREE.DoubleSide}
            transparent opacity={0.95}
            emissive={isGlowing ? "#ffddaa" : "#000000"}
            emissiveIntensity={isGlowing ? 0.6 : 0}
          />
        </mesh>

        {/* Actual Light Source */}
        <pointLight intensity={intensity} color="#ffaa00" distance={8} decay={2} position={[0, -0.1, 0]} />

        {/* Physical Bulb - Yellow when ON, Dark Grey when OFF */}
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.08]} />
          <meshBasicMaterial color={isGlowing ? "#fff700" : "#222222"} />
        </mesh>
      </group>
    </group>
  );
};

//  VICTORIAN WARDROBE 3D
const VictorianWardrobe3D = ({ position, rotation }: any) => {
  const wood = "#1a0500"; const brass = "#c5a059";
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1.6, 0]}> <RoundedBox args={[2.8, 3.2, 1.1]} radius={0.06}> <meshStandardMaterial color={wood} /> </RoundedBox> </mesh>
      {[-0.7, 0.7].map((x) => (<group key={x} position={[x, 1.6, 0.55]}> <mesh> <boxGeometry args={[0.9, 2.4, 0.05]} /> <meshStandardMaterial color={wood} /> </mesh> <mesh position={[0, 0, 0.03]}> <RoundedBox args={[0.6, 2.0, 0.03]} radius={0.02}> <meshStandardMaterial color={wood} roughness={0.4} /> </RoundedBox> </mesh> </group>))}
      <mesh position={[0, 3.25, 0]}> <boxGeometry args={[3.1, 0.25, 1.3]} /> <meshStandardMaterial color={wood} /> </mesh>
      <mesh position={[-0.4, 1.6, 0.61]}> <sphereGeometry args={[0.06]} /> <meshStandardMaterial color={brass} metalness={1} /> </mesh>
      <mesh position={[0.4, 1.6, 0.61]}> <sphereGeometry args={[0.06]} /> <meshStandardMaterial color={brass} metalness={1} /> </mesh>
    </group>
  );
};

//   UPDATED PHOTO FRAME: With simulated content
const VictorianFrame = ({ position, rotation, scale, contentType = 'portrait' }: any) => {
  const gold = "#c5a059"; const wood = "#2a1b0a";

  // Logic to render fake content inside the frame
  const renderContent = () => {
    if (contentType === 'text') {
      // Simulate old paper with lines of text
      return (
        <group position={[0, 0, 0.1]}>
          <mesh> <planeGeometry args={[0.9, 1.3]} /> <meshStandardMaterial color="#f0e6d2" roughness={1} /> </mesh>
          {/* Fake text lines */}
          {[-0.4, -0.2, 0, 0.2, 0.4].map((y, i) => (
            <mesh key={i} position={[0, y, 0.01]}> <planeGeometry args={[0.7, 0.05]} /> <meshBasicMaterial color="#333" /> </mesh>
          ))}
        </group>
      );
    } else if (contentType === 'portrait') {
      // Simulate a dark old portrait painting
      return (
        <group position={[0, 0, 0.1]}>
          <mesh> <planeGeometry args={[0.9, 1.3]} /> <meshStandardMaterial color="#2c1b15" roughness={0.8} /> </mesh>
          {/* Head and shoulders simulation */}
          <mesh position={[0, 0.2, 0.02]}> <sphereGeometry args={[0.25, 16, 16]} scale={[1, 1.2, 0.5]} /> <meshStandardMaterial color="#8d6e63" roughness={1} /> </mesh>
          <mesh position={[0, -0.3, 0.02]}> <sphereGeometry args={[0.35, 16, 16]} scale={[1.2, 1, 0.5]} /> <meshStandardMaterial color="#4e342e" roughness={1} /> </mesh>
        </group>
      );
    }
    else if (contentType === 'landscape') {
      // Simulate a dark landscape
      return (
        <group position={[0, 0, 0.1]}>
          <mesh> <planeGeometry args={[0.9, 1.3]} /> <meshStandardMaterial color="#1a2315" roughness={0.8} /> </mesh>
          <mesh position={[0, -0.2, 0.01]}> <planeGeometry args={[0.9, 0.6]} /> <meshStandardMaterial color="#2c3e25" /> </mesh>
          <mesh position={[0, 0.3, 0.01]}> <circleGeometry args={[0.15]} /> <meshBasicMaterial color="#8f7e58" opacity={0.5} transparent /> </mesh>
        </group>
      );
    }
    return <mesh position={[0, 0, 0.09]}> <planeGeometry args={[0.9, 1.3]} /> <meshStandardMaterial color="#111" /> </mesh>;
  };

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[1.4, 1.8, 0.1]} radius={0.05}> <meshStandardMaterial color={wood} /> </RoundedBox>
      <mesh position={[0, 0, 0.04]}> <RoundedBox args={[1.2, 1.6, 0.08]} radius={0.03}> <meshStandardMaterial color={gold} metalness={0.7} /> </RoundedBox> </mesh>
      <mesh position={[0, 0.95, 0.05]} rotation={[0, 0, Math.PI]}> <torusGeometry args={[0.15, 0.03, 8, 16, Math.PI]} /> <meshStandardMaterial color={gold} /> </mesh>
      {renderContent()}
    </group>
  );
};

const GothicNightstand = ({ position, rotation }: any) => {
  const woodColor = "#2a1b0a"; const goldColor = "#c5a059"; const marbleColor = "#050505";
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.6, 0]}> <RoundedBox args={[1.2, 1.2, 1.0]} radius={0.02}> <meshStandardMaterial color={woodColor} roughness={0.3} /> </RoundedBox> </mesh>
      <mesh position={[0, 1.22, 0]}> <boxGeometry args={[1.3, 0.05, 1.1]} /> <meshStandardMaterial color={marbleColor} roughness={0.1} metalness={0.6} /> </mesh>
      {[-0.55, 0.55].map(x => (<React.Fragment key={x}> <mesh position={[x, 0.6, 0.45]}> <cylinderGeometry args={[0.03, 0.03, 1.2]} /> <meshStandardMaterial color={goldColor} metalness={0.8} /> </mesh> <mesh position={[x, 0.6, -0.45]}> <cylinderGeometry args={[0.03, 0.03, 1.2]} /> <meshStandardMaterial color={goldColor} metalness={0.8} /> </mesh> </React.Fragment>))}
      {[0.9, 0.5, 0.1].map((yPos, i) => (<group key={i} position={[0, yPos, 0.51]}> <mesh> <boxGeometry args={[0.9, 0.25, 0.02]} /> <meshStandardMaterial color={woodColor} /> </mesh> <mesh position={[0, 0, 0.01]}> <ringGeometry args={[0.05, 0.06, 4]} /> <meshStandardMaterial color={goldColor} metalness={1} /> </mesh> <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}> <torusGeometry args={[0.04, 0.01, 8, 16]} /> <meshStandardMaterial color={goldColor} metalness={1} /> </mesh> </group>))}
    </group>
  );
};

const VictorianTable = ({ position, rotation, scale = 1 }: any) => {
  const woodColor = "#2a1b0a"; const goldColor = "#c5a059"; const marbleColor = "#050505";
  const VictorianLeg = ({ pos }: any) => (
    <group position={pos}>
      <mesh position={[0, -0.15, 0]}> <cylinderGeometry args={[0.06, 0.05, 0.3]} /> <meshStandardMaterial color={woodColor} /> </mesh>
      <mesh position={[0, -0.3, 0]}> <torusGeometry args={[0.05, 0.01, 8, 16]} /> <meshStandardMaterial color={goldColor} metalness={0.8} /> </mesh>
      <mesh position={[0, -0.65, 0]}> <cylinderGeometry args={[0.04, 0.02, 0.7]} /> <meshStandardMaterial color={woodColor} /> </mesh>
      <mesh position={[0, -1.0, 0]}> <sphereGeometry args={[0.035]} /> <meshStandardMaterial color={goldColor} metalness={1} /> </mesh>
    </group>
  );

  return (
    //  Table is now rotated 90 degrees ([0, -Math.PI / 2, 0])
    <group position={position} rotation={rotation || [0, -Math.PI / 2, 0]} scale={scale}>
      <mesh position={[0, 1.0, 0]}> <RoundedBox args={[1.6, 0.1, 1.1]} radius={0.02}> <meshStandardMaterial color={woodColor} roughness={0.3} /> </RoundedBox> </mesh>
      <mesh position={[0, 1.06, 0]}> <boxGeometry args={[1.55, 0.02, 1.05]} /> <meshStandardMaterial color={marbleColor} roughness={0.1} metalness={0.6} /> </mesh>
      <mesh position={[0, 0.92, 0]}> <boxGeometry args={[1.4, 0.08, 0.9]} /> <meshStandardMaterial color={woodColor} /> </mesh>
      <VictorianLeg pos={[-0.6, 0.9, 0.35]} />
      <VictorianLeg pos={[0.6, 0.9, 0.35]} />
      <VictorianLeg pos={[-0.6, 0.9, -0.35]} />
      <VictorianLeg pos={[0.6, 0.9, -0.35]} />
    </group>
  );
};//  LAPTOP FIX (Visible Screen, Keys & Glow)
const OpenLaptop = ({ position, rotation, isActive }: any) => {
  const laptopColor = "#1a1a1a"; // Dark Body

  return (
    <group position={position} rotation={rotation}>
      {/* 1. BASE (Keyboard area) */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.45, 0.02, 0.32]} />
        <meshStandardMaterial color={laptopColor} roughness={0.3} />
      </mesh>

      {/* Keys Visual */}
      <mesh position={[0, 0.021, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 0.15]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      {/* Trackpad */}
      <mesh position={[0, 0.021, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 0.08]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* 2. SCREEN GROUP (Hinged at the back) */}
      {/* Positioned at the back edge of the base */}
      <group position={[0, 0.02, -0.15]} rotation={[-0.2, 0, 0]}>
        {/* rotation x: -0.2 tilts it slightly back for viewing angle */}

        {/* Lid Back */}
        <mesh position={[0, 0.14, 0.01]}>
          <boxGeometry args={[0.45, 0.28, 0.015]} />
          <meshStandardMaterial color={laptopColor} roughness={0.3} />
        </mesh>

        {/*  GLOWING SCREEN */}
        <mesh position={[0, 0.14, 0.018]}>
          <planeGeometry args={[0.42, 0.25]} />
          <meshStandardMaterial
            color={isActive ? "#ffffff" : "#111111"}
            emissive={isActive ? "#ffffff" : "#000000"}
            emissiveIntensity={isActive ? 1.5 : 0}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
};

//   NEW: METALLIC PHONE (White Screen Glow)
const MetallicPhone = ({ position, rotation, isActive }: any) => (
  <group position={position} rotation={rotation}>
    {/* Body */}
    <mesh> <boxGeometry args={[0.1, 0.2, 0.015]} /> <meshStandardMaterial color="#0d47a1" metalness={0.9} roughness={0.1} /> </mesh>

    {/* Screen */}
    <mesh position={[0, 0, 0.008]}>
      <planeGeometry args={[0.09, 0.19]} />
      <meshStandardMaterial
        color={isActive ? "#ffffff" : "#111"}
        emissive={isActive ? "#ffffff" : "#000000"}
        emissiveIntensity={isActive ? 2 : 0}
        toneMapped={false}
      />
    </mesh>

    {/* Light */}
    {isActive && (
      <pointLight position={[0, 0, 0.05]} intensity={0.5} color="#ffffff" distance={0.5} />
    )}
  </group>
);

const WiredPurpleLights = () => {
  const wirePoints = useMemo(() => {
    const pts = []; const segments = 50; const width = 18;
    const startHeight = 4.5;
    const droop = 2.8; // Zyaada latki hui wires
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; const x = (t - 0.5) * width;
      // Adding extra wave for "messy/aesthetic" look
      const y = startHeight - Math.sin(t * Math.PI) * droop + Math.cos(t * 8) * 0.15;
      pts.push(new THREE.Vector3(x, y, -4.3));
    }
    return pts;
  }, []);
  return (
    <group>
      <Line points={wirePoints} color="#150525" lineWidth={2} />
      {wirePoints.map((point, i) => i % 3 === 0 && (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#a855f7" emissive="#d000ff" emissiveIntensity={6} toneMapped={false} />
          <pointLight color="#d000ff" intensity={0.5} distance={3} />
        </mesh>
      ))}
    </group>
  );
};

//  MAIN BEDROOM STAGE
export const BedroomStage = ({ isSleeping, isYawning }: { isSleeping: boolean, isYawning: boolean }) => {
  const { isLightsOn } = useMoodStore();

  if (!isSleeping && !isYawning) return null;

  return (
    <group>
      {/*  CHARACTER LIGHT: Character ka color dark nahi hoga */}
      <ambientLight intensity={isLightsOn ? 0.8 : 0.6} color="#ffffff" />

      {/*  SOFT FILL: Lights OFF hone par character ke upar neutral light */}
      {!isLightsOn && (
        <spotLight
          position={[0, 10, 5]}
          target-position={[0, -1.5, 0]}
          intensity={2.5}
          color="#ffffff"
          angle={0.25}
          penumbra={1}
          castShadow
        />
      )}

      {/* Main Room Bulb */}
      <pointLight position={[-3, 6, 4]} intensity={isLightsOn ? 2.5 : 0} color="#ffaa00" distance={25} />

      {/*  MOONLIGHT: Sirf tab jalegi jab main light OFF ho */}
      {!isLightsOn && (
        <spotLight
          position={[0, 5, 10]}
          angle={0.8}
          penumbra={1}
          intensity={1.8}
          color="#607d8b"
          castShadow
        />
      )}
      {/* � The whole room group moved to -2.2 to match Bed level */}
      <group position={[0, -2.2, 0]}>
        <UnevenWoodenFloor />
        <SpiderWebMat />
        <mesh position={[0, 5, -4.5]} receiveShadow>
          <planeGeometry args={[30, 15]} />
          <meshStandardMaterial color={isLightsOn ? "#1a1a2e" : "#111122"} roughness={0.6} />
        </mesh>
        <WiredPurpleLights />

        {/* Back Wall Props */}
        <VictorianWardrobe3D position={[3.5, 0, -4.2]} />
        <VictorianMirrorOrnate position={[-2.0, 2.8, -4.35]} scale={0.5} />
        <VictorianClock position={[-2.0, 4.2, -4.4]} scale={0.4} />

        <group position={[-2.0, 2.8, -4.4]}>
          <VictorianFrame position={[-1.2, 0.8, 0]} scale={0.18} contentType="portrait" />
          <VictorianFrame position={[1.2, 0.5, 0]} scale={0.2} contentType="text" />
          <VictorianFrame position={[-1.0, -1.0, 0]} scale={0.15} contentType="landscape" />
          <VictorianFrame position={[1.0, -0.8, 0]} scale={0.17} contentType="portrait" />
        </group>

        <group rotation={[0, Math.PI / 2, 0]}>
          {/* LEFT SIDE (Nightstand) - Unchanged */}
          <group position={[1.8, 0, -1.4]}>
            <GothicNightstand />
            <VictorianTableLamp position={[0, 1.25, 0]} scale={0.8} intensity={isLightsOn ? 2.5 : 0} />
          </group>

          {/* RIGHT SIDE (Table Group) - FIXED POSITION */}
          {/* Z: -1.4 places it near the HEAD (Symmetrical to Nightstand) */}
          {/* X: -2.2 places it on the Right side of the bed */}
          <group position={[-2.2, 0, -1.4]}>
            {/* Table */}
            <VictorianTable />

            {/* Laptop: Rotated to face the bed (Side view) */}
            <OpenLaptop
              isActive={isLightsOn}
              position={[-0.2, 1.1, 0.1]}
              rotation={[0, Math.PI / 2, 0]} // Face the character
            />

            {/* Phone */}
            <MetallicPhone
              isActive={isLightsOn}
              position={[0.3, 1.12, 0.3]}
              rotation={[-Math.PI / 2, 0, 0]}
            />

            {/*  SKULL FIXED: Moved specifically on top of the table surface */}
            <SkullDecor
              position={[-0.4, 1.13, -0.2]} // Y: 1.13 sits perfectly on table height 1.1
              rotation={[0, 0.5, 0]}
              scale={0.7}
            />
          </group>
        </group>
      </group>
    </group>
  );
};
