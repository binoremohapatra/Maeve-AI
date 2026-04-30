import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, PerformanceMonitor } from '@react-three/drei';
import { MainCharacterController } from '../controllers/MainCharacterController';
import { AdultCharacterController } from '../controllers/AdultCharacterController';
import { HumanAnimationController } from '../controllers/HumanAnimationController';
import { CharacterManager } from '../controllers/CharacterManager';
import { useMoodStore } from '../stores/moodStore';
import { useShallow } from 'zustand/react/shallow';
import { RoomEnvironment } from './RoomEnvironment';
import { DynamicAvatar } from './DynamicAvatar';
import * as THREE from 'three';
// @ts-ignore
import { damp3, damp } from 'maath/easing';
import { parseBehaviorTags } from '../utils/BehaviorMapper';
import { useRestingFaceEngine } from '../hooks/useRestingFaceEngine';
import { usePostureEngine } from '../hooks/usePostureEngine';
import { useAwarenessTurnEngine } from '../hooks/useAwarenessTurnEngine';
import { useAutonomousEngine } from '../hooks/useAutonomousEngine';
import { useSoulAwarenessEngine } from '../hooks/useSoulAwarenessEngine';
import { InteractionTouchEngine } from './systems/InteractionTouchEngine';
import { useVoiceReactivityEngine } from '../hooks/useVoiceReactivityEngine';
import { useLipSync } from '../hooks/useLipSync';
import { useVoiceVolume } from '../hooks/useVoiceVolume';
import { AnimeVFXSuite } from './effects/AnimeVFXSuite';
import { MistAura } from './vibe/MistAura';
import { DustMotes } from './vibe/DustMotes';
import { PersonaAuraLighting } from './vibe/PersonaAuraLighting';
import { useVRMTracking } from '../hooks/useVRMTracking';
import { useDollyZoom } from '../hooks/useDollyZoom';
import { useGravityHack } from '../hooks/useGravityHack';
import { useAudioEffects } from '../hooks/useAudioEffects';
import { CinematicPostProcessing } from './vibe/CinematicPostProcessing';
import { LipSyncAnalyzer } from '../utils/LipSyncAnalyzer';



//  SEX PROP — Hips Bone Tracked (Every Frame, No Locking)
// Tip always at the pussy slit. Shaft extends toward camera. Character animates around it.
const SexProp = ({ isVisible, animationName, vrm }: { isVisible: boolean, animationName: string, vrm: any }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: rawScene } = useGLTF('/models/P.glb');
  const scene = useMemo(() => rawScene.clone(), [rawScene]);

  // Reusable vectors — avoids GC pressure
  const _bonePos = useMemo(() => new THREE.Vector3(), []);
  const _boneQuat = useMemo(() => new THREE.Quaternion(), []);
  const _localOff = useMemo(() => new THREE.Vector3(), []);
  const _tipPos = useMemo(() => new THREE.Vector3(), []);
  //  PERF FIX: Pre-allocated for penetrationAxis — avoids new Vector3 every frame
  const _penAxis = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.visible = isVisible;
    if (!isVisible || !vrm) return;

    const isBlowjob = animationName.toUpperCase().includes('BLOWJOB');

    //  Get the right bone
    const bone = isBlowjob
      ? (vrm.humanoid?.getRawBoneNode('head') ?? vrm.scene.getObjectByName('Head'))
      : (vrm.humanoid?.getRawBoneNode('hips') ?? vrm.scene.getObjectByName('Hips'));
    if (!bone) return;

    //  Sample bone world transform EVERY FRAME
    bone.getWorldPosition(_bonePos);
    bone.getWorldQuaternion(_boneQuat);

    //  Per-animation bone-local offsets (tuned for each pose/camera angle)
    // Coordinate system: bone-local space. VRM hips bone faces forward (+Z when charRotY=0)
    // Y = vertical (negative = down), Z = forward/backward, X = left/right
    const PER_ANIM_OFFSET: Record<string, [number, number, number]> = {
      // === BACKSHOT (from-behind, camera close behind) ===
      // Character bends forward, pussy slit visible between cheeks facing camera
      BACKSHOT: [0.02, -0.17, 0.23],  //  Nudged X to align with red line center
      BACKSHOT2: [0.02, -0.17, 0.05],
      BACKSHOT3: [0.02, -0.17, -0.1],
      BACKSHOT4: [0.02, -0.17, 0.05],
      BACKSHOT5: [0.02, -0.17, -0.025],  // Moves from back/neck down to pussy
      // === FRONT / MISSIONARY (from-front, camera above) ===
      // Character on back, pussy faces upward toward camera
      FRONT: [0.02, -0.15, 0.04],  // further back (toward bed), below hips
      FRONT2: [0.02, -0.15, 0.04],
      FRONTSLOW: [0.02, -0.15, 0.04],
      MASTURBATE: [0.02, -0.14, 0.04],
      // === BLOWJOB (head bone target) ===
      BLOWJOB1: [0.02, -0.045, 0.05], // X-Nudged for perfect centering
      BLOWJOB: [0.02, -0.045, 0.05],
      BLOWJOB2: [0.02, -0.045, 0.05],
      BLOWJOB3: [0.02, -0.045, 0.05],
    };

    const key = animationName.toUpperCase();
    const offArr = PER_ANIM_OFFSET[key] ?? [0, -0.13, 0.02];
    _localOff.set(offArr[0], offArr[1], offArr[2]);
    //  Transform local offset into world space using bone's current state
    _tipPos.copy(_localOff).applyQuaternion(_boneQuat).add(_bonePos);

    //  Shaft Len & Midpoint (half-penetration)
    const shaftLen = 0.16; // shaft length in world units at current scale
    const halfLen = shaftLen / 2;

    //  SEDA FIX: Orientation is NOW BONE-LOCKED (Always follows body center)
    // No more camera-based 'tedha' (crooked) tilt!
    // Bone faces +Z (forward into pussy). Balls face away from body center.
    groupRef.current.quaternion.copy(_boneQuat);

    //  BLOWJOB/FRONT/BACKSHOT orientation logic
    if (isBlowjob) {
      //  BLOWJOB: Flip and point STRAIGHT into mouth (like Front/Backshot)
      // Tip (model Z-) points to her face. Shaft follows head rotation perfectly.
      groupRef.current.rotateY(Math.PI);
      //  NO EXTRA TILT! Straight is better.
    } else {
      //  BACKSHOT/FRONT: Enter from behind (Hips/Pussy)
      groupRef.current.rotateY(-Math.PI);
      groupRef.current.rotateX(-Math.PI / 2); // Tilt up into the body 90 degrees
    }

    //  Position the group: MIDPOINT at target slit
    // Get direction where tip is pointing (local +Z or -Z after rotates)
    //  PERF FIX: Reuse pre-allocated _penAxis vector — avoids new Vector3 every frame
    _penAxis.set(0, 0, -2).applyQuaternion(groupRef.current.quaternion).normalize();
    groupRef.current.position.copy(_tipPos).addScaledVector(_penAxis, halfLen);

    groupRef.current.scale.setScalar(0.0006);
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh><sphereGeometry args={[0.02, 16, 16]} /><meshStandardMaterial color="hotpink" /></mesh>}>
        <primitive object={scene} />
      </Suspense>
    </group>
  );
};


const INTERACTION_OFFSETS: Record<string, any> = {
  // --- GROUP 1: FRONT (Facing User - E-W Axis) ---
  //  TRUE POV: Camera at -2.6 (0.9m away from char at -3.5) for intimate sex POV
  FRONT: {
    charPos: [-3.3, -0.8, -3.2], charRotY: Math.PI / 2,
    camPos: [-2.6, 0.4, -3.2], camLookAt: [-3.5, -0.2, -3.2], fov: 65,
    propPos: [-2.7, -0.3, -3.2], propRot: [0, 0, -Math.PI / 1.7]
  },
  FRONT2: {
    charPos: [-3.3, -0.8, -3.2], charRotY: Math.PI / 2,
    camPos: [-2.6, 0.4, -3.2], camLookAt: [-3.5, -0.2, -3.2], fov: 65,
    propPos: [-2.7, -0.3, -3.2], propRot: [0, 0, -Math.PI / 1.7]
  },
  FRONTSLOW: {
    charPos: [-3.3, -0.8, -3.2], charRotY: Math.PI / 2,
    camPos: [-2.6, 0.4, -3.2], camLookAt: [-3.5, -0.2, -3.2], fov: 65,
    propPos: [-2.7, -0.3, -3.2], propRot: [0, 0, -Math.PI / 1.7]
  },
  MASTURBATE: {

    charPos: [-3.0, -0.8, -3.2], charRotY: Math.PI / 2,
    camPos: [-2.6, 0.4, -3.2], camLookAt: [-3.5, -0.2, -3.2], fov: 65,
    propPos: [-2.7, -0.3, -3.2], propRot: [0, 0, -Math.PI / 1.7]
  },


  // --- GROUP 2: BACKSHOTS (Edge of Bed - Facing Wall) ---
  // Cam at -1.0 (Strictly behind), Char at -2.2
  BACKSHOT: {
    charPos: [-2.1, -1.3, -3.2], charRotY: -Math.PI / 2,
    camPos: [-1.6, 0.4, -3.2], camLookAt: [-2.2, -1.0, -3.2], fov: 50,
    propPos: [-2, -0.42, -3], propRot: [0, 0, 0]  // char feet at -1.3, hips at -0.4
  },
  BACKSHOT2: {
    charPos: [-2.0, -1.3, -2.4], charRotY: Math.PI / 4,
    camPos: [-2.0, 0.3, -1.6], camLookAt: [-2.0, -1.0, -2.8], fov: 50,
    propPos: [-2.0, -0.42, -2.95], propRot: [0, 0, 0]  // raised to hip height
  },

  BACKSHOT3: {
    charPos: [-3.4, -0.7, -3.2], charRotY: -Math.PI / 2,
    camPos: [-3, 0.4, -3.2], camLookAt: [-3.4, -0.1, -3.2], fov: 70,
    propPos: [-3.4, 0.2, -3.2], propRot: [0, 0, 0]  // feet at -0.7, hips at +0.2
  },

  BACKSHOT4: {
    charPos: [-2.9, -0.7, -3.2], charRotY: -Math.PI,
    camPos: [-1.9, 0.2, -3.2], camLookAt: [-2.9, -0.7, -3.2], fov: 65,
    propPos: [-2.9, 0.2, -3.2], propRot: [0, 0, Math.PI / 2]  // feet at -0.7, hips +0.2
  },
  BACKSHOT5: {
    charPos: [-2, -0.6, -3.2], charRotY: -Math.PI / 2,
    camPos: [-0.4, 0.8, -3.2], camLookAt: [-2.2, -0.5, -3.2], fov: 45,
    propPos: [-2.0, 0.28, -3.2], propRot: [0, 0, 0]  // feet at -0.6, hips at +0.3
  },

  // --- GROUP 3: BLOWJOB (User on Bed, Char in front) ---
  // User sitting on Bed at -2.8, Char at -1.9 (Floor/Edge)
  BLOWJOB1: {
    charPos: [-1.9, -1.2, -3.2], charRotY: -Math.PI / 2,
    camPos: [-2.8, 0.45, -3.2], camLookAt: [-1.9, -0.6, -3.2], fov: 45,
    propPos: [-2.0, -0.1, -3.2], propRot: [Math.PI / 2, 0, 0]
  },
  BLOWJOB: {
    charPos: [-1.9, -1.2, -3.2], charRotY: -Math.PI / 2,
    camPos: [-2.8, 0.45, -3.2], camLookAt: [-1.9, -0.6, -3.2], fov: 45,
    propPos: [-2.0, -0.1, -3.2], propRot: [Math.PI / 2, 0, 0]
  },
  BLOWJOB2: {
    charPos: [-1.9, -1.2, -3.2], charRotY: -Math.PI / 2,
    camPos: [-2.8, 0.45, -3.2], camLookAt: [-1.9, -0.6, -3.2], fov: 45,
    propPos: [-2.0, -0.1, -3.2], propRot: [Math.PI / 2, 0, 0]
  },
  BLOWJOB3: {
    charPos: [-1.9, -1.2, -3.2], charRotY: -Math.PI / 2,
    camPos: [-2.8, 0.45, -3.2], camLookAt: [-1.9, -0.6, -3.2], fov: 45,
    propPos: [-2.0, -0.1, -3.2], propRot: [Math.PI / 2, 0, 0]
  },

  // --- GROUP 4: ROMANCE (Close-up) ---
  NORMALKISS: { charPos: [-3.0, -0.80, -3.2], charRotY: Math.PI / 2, camPos: [-2.2, -0.2, -3.2], camLookAt: [-3.0, -0.5, -3.2], fov: 45 },
  KISS: { charPos: [-3.0, -0.80, -3.2], charRotY: Math.PI / 2, camPos: [-2.2, -0.2, -3.2], camLookAt: [-3.0, -0.5, -3.2], fov: 45 },
  HUGGINGKISS: { charPos: [-3.0, -0.80, -3.2], charRotY: Math.PI / 2, camPos: [-2.2, -0.2, -3.2], camLookAt: [-3.0, -0.5, -3.2], fov: 45 },

  // Default fallback
  DEFAULT: { charPos: [-3.0, -0.80, -3.2], charRotY: Math.PI / 2, camPos: [-1.8, -0.2, -3.2], camLookAt: [-3.0, -0.7, -3.2], fov: 55 }
};
// Expose to window so SexProp (defined before) can look it up at runtime
(window as any).__INTERACTION_OFFSETS__ = INTERACTION_OFFSETS;



const APPROACH_DURATION_MS = 1500; // Time to approach camera
const INTERACTION_DURATION_MS = 2000; // Hugging kiss animation duration
const FX_CLIMAX_DURATION_MS = 800; // Blackout + emoji display
const RESET_DURATION_MS = 1200; // Time to reset to default
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 0.8, 7.0);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 0.2, 0);

const DEFAULT_FOV = 35;

//  TYPING SEQUENCE CONSTANTS (Placeholder values - adjust later)
const DESK_APPROACH_POS = new THREE.Vector3(2.5, -1.3, 3.8);
const CHAIR_POS = new THREE.Vector3(3.0, -1.65, 3.8);  // ← Moved further forward towards the desk
const CHAIR_ROT_Y = Math.PI / 8;  // ← Monitor ki taraf face

export const SceneContent = ({ onControllerReady }: { onControllerReady?: (ctrl: CharacterManager) => void; }) => {
  //  FIX: Wrapped in useShallow to prevent render cascade when other store values change
  const { mascot, bedState, characters, activeCharacterIndex, currentMode, activeAudioElement } = useMoodStore(
    useShallow((state) => ({
      mascot: state.mascot,
      bedState: state.bedState,
      characters: state.characters,
      activeCharacterIndex: state.activeCharacterIndex,
      currentMode: state.currentMode,
      activeAudioElement: state.activeAudioElement
    }))
  );
  const [mainVrm, setMainVrm] = useState<any>(null);
  const [adultVrm, setAdultVrm] = useState<any>(null);
  const [isCharacterReadyToReveal, setIsCharacterReadyToReveal] = useState(false);
  const [isMainModelReady, setIsMainModelReady] = useState(false);
  const characterManagerRef = useRef<CharacterManager | null>(null);
  const hipsRef = useRef<THREE.Object3D | null>(null);
  const characterPositionRef = useRef<THREE.Group>(null!);
  const controlsRef = useRef<any>(null);

  //  Phase 3: Physics & Camera Distortion Engine
  useVRMTracking(mainVrm || adultVrm);
  useDollyZoom();
  useGravityHack(mainVrm || adultVrm);

  //  Web Audio Custom Hooks
  const visemesRef = useLipSync(activeAudioElement);
  useVoiceVolume(activeAudioElement);
  useAudioEffects(activeAudioElement);

  //  INTIMATE HUGGING KISS STATE MACHINE
  type KissPhase = 'NONE' | 'SETUP' | 'APPROACH' | 'INTERACTION' | 'FX_CLIMAX' | 'RESET';
  const [, setKissPhase] = useState<KissPhase>('NONE');

  // Refs for intimate sequence management
  const kissStateMachineRef = useRef<{
    phase: KissPhase;
    phaseStartTime: number;
    headBoneWorldPos: THREE.Vector3;
    isOrbitControlsEnabled: boolean;
    cachedAnimation: string;
    targetCharacterPos: THREE.Vector3;
    targetCharacterRot: number;
    isBlinkingForced: boolean;
    currentBlinkValue: number; //  NEW: Smooth expression control
    targetOverlayOpacity: number; //  NEW: Smooth overlay opacity control
  }>({
    phase: 'NONE',
    phaseStartTime: 0,
    headBoneWorldPos: new THREE.Vector3(),
    isOrbitControlsEnabled: true,
    cachedAnimation: 'IDLE',
    targetCharacterPos: new THREE.Vector3(0, -1.0, 0),
    targetCharacterRot: 0,
    isBlinkingForced: false,
    currentBlinkValue: 0.0, //  NEW: Start with eyes open
    targetOverlayOpacity: 0.0 //  NEW: Start with no overlay
  });

  //  Sequential Bed Navigator
  type BedPhase = 'IDLE' | 'ROTATING' | 'WALKING' | 'SETTLING' | 'ON_BED';
  const bedPhaseRef = useRef<BedPhase>('IDLE');
  const prevBedStateRef = useRef<string>('NONE');
  const bedAnimFiredRef = useRef(false);
  const lastPhaseRef = useRef<BedPhase>('IDLE'); // Gate: play() fires ONCE per phase

  //  Typing Navigation State Machine
  type TypingNavPhase = 'IDLE' | 'ROTATING' | 'WALKING' | 'SITTING' | 'TYPING' | 'EXIT_TURN' | 'EXIT_WALK';
  const typingNavPhaseRef = useRef<TypingNavPhase>('IDLE');
  const typingAnimFiredRef = useRef(false);
  const lastTypingPhaseRef = useRef<TypingNavPhase>('IDLE');

  //  Typing Sequence State Machine
  type TypingPhase = 'NONE' | 'CAM_ROTATE' | 'WALKING' | 'SITTING' | 'TYPING';
  const typingPhaseRef = useRef<TypingPhase>('NONE');
  const [, setTypingPhase] = useState<TypingPhase>('NONE');

  const [isSulking, setIsSulking] = useState(false);
  const [isMourning, setIsMourning] = useState(false);

  const [animationToPlay, setAnimationToPlay] = useState("IDLE");

  //  The Posture Engine
  const updatePosture = usePostureEngine();

  //  PRIORITY OVERRIDE LOCK (Winks & Cinematic Cuts)
  const winkActiveRef = useRef(false);

  //  THE ADVANCED AWARENESS ENGINE 
  const awareness = useAwarenessTurnEngine();

  const autonomousEngine = useAutonomousEngine();
  const { updateSoul } = useSoulAwarenessEngine();

  //  THE VOICE REACTIVITY ENGINE (Head Bobs/Nods)
  useVoiceReactivityEngine(mainVrm || adultVrm, mascot.audio_url, currentMode, mascot.speaking);

  // ──  PERSONA TO INTENSITY MAPPING ──
  useEffect(() => {
    const persona = (currentMode || 'DEFAULT').toUpperCase();
    const intensityMap: Record<string, 'STILL' | 'CALM' | 'NORMAL' | 'RESTLESS' | 'AGITATED'> = {
      'YANDERE': 'AGITATED',
      'YANDERE_STALKER': 'AGITATED',
      'HAJIDERE': 'RESTLESS',
      'ANXIOUS': 'RESTLESS',
      'KUUDERE': 'STILL',
      'DEREDERE': 'CALM',
    };
    autonomousEngine.setIntensity(intensityMap[persona] || 'NORMAL');
  }, [currentMode, autonomousEngine]);

  // ──  ACTION FADE-OUT ──
  useEffect(() => {
    const isPlayingAction = animationToPlay !== 'IDLE' && animationToPlay !== 'NONE';
    autonomousEngine.setActionActive(isPlayingAction);
  }, [animationToPlay, autonomousEngine]);

  //  Digital Lifeform Face Engine v4.0 — Spring-Damper · RBF Correlation · Micro-Noise
  // Spring physics now handle transition timing (lerpSpeed is legacy, ignored internally)
  const isInCinematicFace = kissStateMachineRef.current.phase !== 'NONE' || typingNavPhaseRef.current !== 'IDLE';

  const showAdult = (bedState as string) === 'SEX';
  const activeVrm = showAdult ? adultVrm : mainVrm;

  const { emotionTimeRef } = useRestingFaceEngine({
    vrm: activeVrm,
    persona: currentMode || 'DEFAULT',
    activeEmotion: mascot?.emotion || 'NEUTRAL',
    suppressed: isInCinematicFace,
    winkActive: mascot?.winkActive || winkActiveRef.current //  PRIORITY LOCK — Cinematic wink suppression
  });

  //  NOTE: useRestingFaceEngine for mainVrm was removed (was being called twice = double overhead)

  // Wardrobe state - no longer needed but keeping for store compatibility
  // const { isTopVisible, isBottomVisible } = useWardrobeStore();

  // Wardrobe update function - now disabled since we're using separate models
  // const updateWardrobe = (vrm: any, state: { isTopVisible: boolean, isBottomVisible: boolean }) => {
  //   // No longer needed - using separate VRM models instead
  // };

  const backendAction = (mascot.action || "").toUpperCase().trim();

  // 1. Mood & Transition Logic
  useEffect(() => {
    // ---------------------------------------------------------
    //  TYPING SEQUENCE QUEUE & INTERCEPTOR
    // ---------------------------------------------------------
    if (typingNavPhaseRef.current !== 'IDLE') {
      // She is currently somewhere in the typing sequence
      if (backendAction === 'TYPING') {
        return; // Keep doing the sequence
      } else {
        // Backend wants to stop (e.g., IDLE was sent)
        if (['ROTATING', 'WALKING', 'SITTING'].includes(typingNavPhaseRef.current)) {
          // QUEUE THE IDLE: Hold the command. Let her finish reaching the chair.
          return;
        }
        else if (typingNavPhaseRef.current === 'TYPING') {
          // She is typing. Now process the queued IDLE and start walking back!
          console.log(" Queued action received. Initiating Exit Walk.");
          typingNavPhaseRef.current = 'EXIT_TURN';
          return; // Block default animations so she can walk back
        }
        else if (['EXIT_TURN', 'EXIT_WALK'].includes(typingNavPhaseRef.current)) {
          // She is already on her way back, keep blocking default actions
          return;
        }
      }
    }

    // Start sequence if she is currently IDLE and backend says TYPING
    if (backendAction === 'TYPING' && typingNavPhaseRef.current === 'IDLE') {
      console.log(" Initiating Typing Approach");
      typingNavPhaseRef.current = 'ROTATING';
      typingPhaseRef.current = 'CAM_ROTATE';
      typingAnimFiredRef.current = false;
      return;
    }
    // ---------------------------------------------------------

    //  ANIMATION LOCK: If she's on her way to / already on the bed,
    // ignore ALL backend actions. bedState returning to 'NONE' breaks the lock.
    //  EXCEPT for interaction positioning during 'SEX' mode.
    const interactionActions = [
      'MASTURBATE',
      'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BACKSHOT5',
      'BLOWJOB', 'BLOWJOB2', 'BLOWJOB3',
      'FRONT', 'FRONT2', 'FRONTSLOW'
    ];

    if (bedState !== 'NONE' && !interactionActions.includes(backendAction)) {
      console.log(' Bed Animation Lock Active - Ignoring backend action:', backendAction);
      return;
    }

    //  CRITICAL FIX: Prevent infinite loop during kiss sequence
    const nonCinematicActions = ['KISS', 'NORMALKISS', 'REAL_KISS', 'HUGGINGKISS', 'IDLE', ''];
    if (!nonCinematicActions.includes(backendAction) && kissStateMachineRef.current.phase !== 'NONE') {
      console.log(" External action changed to:", backendAction, "- Aborting Kiss Sequence.");
      resetIntimateKissSequence();
      return; //  CRITICAL: Exit early to prevent loop
    }

    // 1. Trigger Argue/Angry Logic
    if (backendAction.includes('ARGU')) {
      setIsSulking(true); setIsMourning(false); setAnimationToPlay("ARGUING");
    }
    // 2. Trigger Sad Logic
    else if (backendAction.includes('SAD') || backendAction.includes('CRY')) {
      setIsMourning(true); setIsSulking(false); setAnimationToPlay("SAD_IDLE");
    }
    // 3. Persistent Poses (Immediate Switch)
    else if (backendAction === 'IDLE' || backendAction === "") {
      if (isSulking) setAnimationToPlay("ANGRY");
      else if (isMourning) setAnimationToPlay("SAD");
      else setAnimationToPlay("IDLE");
    }
    // 4. Resolution
    else {
      const lockedActions = [
        'MASTURBATE',
        'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BACKSHOT5',
        'BLOWJOB', 'BLOWJOB2', 'BLOWJOB3',
        'FRONT', 'FRONT2', 'FRONTSLOW'
      ];
      if (backendAction === 'THINKING' && lockedActions.includes(animationToPlay)) {
        console.log(" Pose Locked - Ignoring THINKING");
      } else {
        const resolution = ['HAPPY', 'KISS', 'LOVE', 'HUG', 'REAL_KISS'];
        if (resolution.includes(backendAction)) {
          setIsSulking(false); setIsMourning(false);
        }
        setAnimationToPlay(backendAction);
      }
    }
  }, [backendAction, isSulking, isMourning, bedState]);

  // Wardrobe update effect - disabled
  useEffect(() => {
    // No longer needed - using separate VRM models
  }, []);

  //  Trigger actual animation via CharacterManager (FIXED: Respects cinematic sequences)
  useEffect(() => {
    if (characterManagerRef.current && animationToPlay) {
      //  CRITICAL FIX: Don't override animations during cinematic sequences
      const isTypingSequence = typingNavPhaseRef.current !== 'IDLE';
      const isKissSequence = kissStateMachineRef.current.phase !== 'NONE';

      if (isTypingSequence || isKissSequence) {
        console.log(" Animation Override Blocked - Cinematic sequence active:",
          isTypingSequence ? "TYPING" : "KISS", "Phase:",
          isTypingSequence ? typingPhaseRef.current : kissStateMachineRef.current.phase);
        return; // Let state machines control animation
      }

      // console.log(" Logic Switch -> Playing:", animationToPlay);
      characterManagerRef.current.play(animationToPlay);
    }
  }, [animationToPlay]);

  //  AUTO-REVERT ENGINE (Reactions to IDLE)
  useEffect(() => {
    // 1. Un animations ki list jo CONTINUOUS (Infinite Loop) chalni chahiye
    const CONTINUOUS_ANIMATIONS = [
      'IDLE', 'TYPING', 'SLEEPING', 'LAYING', // Standard continuous tasks

      //  DANCE LIBRARY (Inhe infinite loop me rakhna hai)
      'HAPPYDANCE', 'SEXY', 'BELLY', 'HIPHOP', 'BOOTY', 'SALSA', 'HH', 'COOL',

      //  NSFW Bed Modes
      'MASTURBATE', 'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BACKSHOT5',
      'BLOWJOB', 'BLOWJOB2', 'BLOWJOB3', 'FRONT', 'FRONT2', 'FRONTSLOW',
      'POSSESSIVE', 'ANGRY', 'SAD' //  Inhe yahan add karne se body pose bhi nahi badlega
    ];

    //  SMART CHECK: Agar tere dance animations ke naam me 'DANCE' word aata hai (jaise 'SEXY_DANCE'), 
    const isDanceMove = animationToPlay.toUpperCase().includes('DANCE');

    // Agar current animation continuous list me hai, ya Dance hai, ya koi cinematic phase chal raha hai, toh kuch mat karo
    if (
      CONTINUOUS_ANIMATIONS.includes(animationToPlay) ||
      isDanceMove ||
      kissStateMachineRef.current.phase !== 'NONE' ||
      typingNavPhaseRef.current !== 'IDLE' // Using IDLE check for typing sequence
    ) {
      return;
    }


    // 2. Agar ye ek REACTION hai (Angry, Sad, Happy, Shy, etc.)
    // Toh 4.5 seconds (standard Mixamo clip length) baad usko wapas IDLE par bhej do
    const revertTimer = setTimeout(() => {
      console.log(` Action Complete: Auto-reverting from ${animationToPlay} -> IDLE`);

      // React state update
      setAnimationToPlay('IDLE');

      // Zustand store update (Taki UI aur backend sync rahein)
      useMoodStore.getState().setAction('IDLE');

      // Agar wo sulk ya mourn kar rahi thi, toh usko bhi reset kar do
      setIsSulking(false);
      setIsMourning(false);

    }, 4500); // 4500ms = 4.5 seconds (Tune it based on your average animation length)

    // Cleanup function: Agar 4.5s se pehle user ne koi aur command de di, toh purana timer cancel kar do
    return () => clearTimeout(revertTimer);

  }, [animationToPlay]);

  //  THE PERSISTENCE ENGINE: Sirf PLAYFUL reset hoga, baaki sab hamesha rahenge!
  useEffect(() => {
    if (!mascot?.emotion || mascot.emotion === 'NEUTRAL') return;

    const emotionKey = mascot.emotion.toUpperCase();

    //  MASTER LOCK: Sirf PLAYFUL ko 0.6s ka reset timer chahiye
    if (emotionKey === 'PLAYFUL') {
      winkActiveRef.current = true; // Wink Lock On

      const timer = setTimeout(() => {
        console.log(" Playful Sequence Finished. Resetting...");
        winkActiveRef.current = false; // Wink Lock Off

        useMoodStore.setState(s => ({
          ...s,
          mascot: { ...s.mascot, emotion: 'NEUTRAL', winkActive: false }
        }));
      }, 600); // 0.6s snappy timing

      return () => clearTimeout(timer);
    }

    //  YAHAN KOI ELSE NAHI HAI! 
    // Iska matlab agar emotion ANGRY, SAD, ya POSSESSIVE hai, 
    // toh koi setTimeout trigger hi nahi hoga. 
    // Wo chere par tab tak chipka rahega jab tak tu doosra button na dabaye.

  }, [mascot?.emotion]);


  //  INTIMATE HUGGING KISS SEQUENCE TRIGGER
  useEffect(() => {
    const isKissAction = ['KISS', 'NORMALKISS', 'REAL_KISS', 'HUGGINGKISS'].includes(animationToPlay);

    if (isKissAction && kissStateMachineRef.current.phase === 'NONE') {
      console.log(" STARTING INTIMATE HUGGING KISS SEQUENCE - Phase 1: SETUP");

      // Initialize intimate state machine
      kissStateMachineRef.current.phase = 'SETUP';
      kissStateMachineRef.current.phaseStartTime = performance.now();
      kissStateMachineRef.current.cachedAnimation = animationToPlay;
      kissStateMachineRef.current.isOrbitControlsEnabled = false;
      kissStateMachineRef.current.isBlinkingForced = false;

      // Calculate target position for intimate approach
      kissStateMachineRef.current.targetCharacterPos.set(0, -0.8, -0.5); // Move closer to camera
      kissStateMachineRef.current.targetCharacterRot = 0; // Face camera

      setKissPhase('SETUP');
    }
    else if (!isKissAction && kissStateMachineRef.current.phase !== 'NONE') {
      console.log(" ABORTING INTIMATE KISS SEQUENCE - Action changed");

      // Reset everything
      resetIntimateKissSequence();
    }
  }, [animationToPlay]);
  const activeChar = characters[activeCharacterIndex] || characters[0];
  const isDefaultMaeve = activeCharacterIndex === 0;

  // VRM paths — Moved up for useEffect dependencies
  const mainPath = isDefaultMaeve ? '/models/maevewithclothes.vrm' : activeChar.url;
  const adultPath = isDefaultMaeve ? '/models/maevenude.vrm' : activeChar.url;

  //  NUCLEAR CLEANUP ENGINE — Prevent VRAM leaks and Context Lost errors
  useEffect(() => {
    return () => {
      const cleanMaterial = (material: any) => {
        if (!material) return;
        material.dispose();
        for (const key of Object.keys(material)) {
          if (material[key] && material[key].isTexture) {
            material[key].dispose();
          }
        }
      };

      const disposeVrm = (vrm: any) => {
        if (!vrm) return;
        // console.log(" Nuclear Disposal of VRM resources...");
        vrm.scene.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m: any) => cleanMaterial(m));
            } else {
              cleanMaterial(obj.material);
            }
          }
        });
        // VRM specific disposal
        if (vrm.dispose) vrm.dispose();
      };

      disposeVrm(mainVrm);
      disposeVrm(adultVrm);
    };
  }, [mainPath, adultPath]); // Trigger when URLs change

  //  Trigger swap transition overlay when bedState changes
  useEffect(() => {
    useMoodStore.getState().setModelSwapping(true);
    setTimeout(() => useMoodStore.getState().setModelSwapping(false), 800);
  }, [bedState]);

  //  Reset intimate kiss sequence helper
  const resetIntimateKissSequence = () => {
    kissStateMachineRef.current.phase = 'NONE';
    kissStateMachineRef.current.currentBlinkValue = 0.0;
    setKissPhase('NONE');
    window.dispatchEvent(new Event('KISS_BLACKOUT_HIDE'));
  };


  //  Handle Model Loading & Controller Setup
  const handleModelLoaded = (model: any, isAdult: boolean) => {
    const vrm = model.vrm;
    const scene = model.scene;

    if (vrm) {
      // ---  VRM SETUP ---
      vrm.scene.traverse((obj: any) => { if (obj.isMesh) obj.frustumCulled = false; });

      const tweakMaterials = (v: any) => {
        const isCurrentlyLowEnd = useMoodStore.getState().isLowEnd;

        v.scene.traverse((obj: any) => {
          if (!obj.isMesh || !obj.material) return;

          //  OPTIMIZATION 1: Texture Budgeting
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat: any) => {
            // Apply to all maps (map, emissiveMap, normalMap, etc.)
            for (const key in mat) {
              if (mat[key] && mat[key].isTexture) {
                const tex = mat[key];
                if (isCurrentlyLowEnd) {
                  tex.anisotropy = 1; // 0% performance cost (default is often 16)
                  tex.minFilter = THREE.LinearFilter; // Avoid mipmap lookups if possible
                } else {
                  tex.anisotropy = 4; // High-end sweet spot
                }
                tex.needsUpdate = true;
              }
            }
          });

          // Skin/face/body must keep MeshStandardMaterial — blendshapes need PBR normals
          const isSkin =
            obj.name.toLowerCase().includes('skin') ||
            obj.name.toLowerCase().includes('face') ||
            obj.name.toLowerCase().includes('body');

          if (isCurrentlyLowEnd && !isSkin) {
            const newMats = mats.map((mat: any) => {
              // Only replace Standard/Physical — Basic/Lambert already cheap
              if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;

              const basic = new THREE.MeshBasicMaterial({
                map: mat.map ?? null,
                color: mat.color ?? new THREE.Color(1, 1, 1),
                transparent: mat.transparent ?? false,
                opacity: mat.opacity ?? 1,
                alphaTest: mat.alphaTest ?? 0,
                side: mat.side ?? THREE.FrontSide,
                depthWrite: mat.depthWrite ?? true,
              });
              mat.dispose(); // Free PBR material from GPU memory
              return basic;
            });
            obj.material = Array.isArray(obj.material) ? newMats : newMats[0];

            // Strip shadow cost from every mesh on mobile regardless
            obj.castShadow = false;
            obj.receiveShadow = false;
          } else {
            // High-end: roughness tweak only
            if (obj.material.roughness !== undefined) {
              obj.material.roughness = Math.min(1.0, obj.material.roughness + 0.3);
            }
          }
        });
      };

      // 1. INJECT BODY COLLIDERS FIRST — must happen before first physics tick
      import('../utils/injectBodyColliders').then(({ injectBodyColliders }) => {
        injectBodyColliders(vrm);

        //  Wait 1 frame so collider groups are registered before physics tuning
        setTimeout(() => {
          HumanAnimationController.applyFluidPhysics(vrm);
        }, 0);
      });

      tweakMaterials(vrm);
    }

    if (isAdult) {
      setAdultVrm(vrm);
    } else {
      setMainVrm(vrm);
      const hips = vrm ? vrm.humanoid?.getRawBoneNode('hips') : scene.getObjectByName('hips') || scene.getObjectByName('Hips');
      hipsRef.current = hips;
    }

    //  Update CharacterManager & Re-init Controller
    if (characterManagerRef.current) {
      if (isAdult) {
        const oldCtrl = characterManagerRef.current.getAdultController() as any;
        if (oldCtrl?.animationController) oldCtrl.animationController.dispose();
        const newCtrl = new AdultCharacterController(vrm || scene);
        newCtrl.animationController.isReversedModel = !isDefaultMaeve;
        characterManagerRef.current.setAdultController(newCtrl);
      } else {
        const oldCtrl = characterManagerRef.current.getMainController() as any;
        if (oldCtrl?.animationController) oldCtrl.animationController.dispose();
        const newCtrl = new MainCharacterController(vrm || scene);
        newCtrl.animationController.isReversedModel = !isDefaultMaeve;
        characterManagerRef.current.setMainController(newCtrl);
      }
    }
  };

  useEffect(() => {
    if (mainVrm && adultVrm && !characterManagerRef.current) {
      const mainController = new MainCharacterController(mainVrm.vrm ? mainVrm : mainVrm.scene ? mainVrm : mainVrm);
      const adultController = new AdultCharacterController(adultVrm.vrm ? adultVrm : adultVrm.scene ? adultVrm : adultVrm);

      const isCustomModel = activeCharacterIndex !== 0;
      mainController.animationController.isReversedModel = isCustomModel;
      adultController.animationController.isReversedModel = isCustomModel;

      const characterManager = new CharacterManager(mainController, adultController);

      characterManagerRef.current = characterManager;
      (window as any).characterManager = characterManager;

      //  PRE-CALCULATE FIRST FRAME TO AVOID T-POSE FLASH
      characterManager.play('IDLE');
      characterManager.update(0.1);
      if (mainVrm.update) mainVrm.update(0.1);
      if (adultVrm.update) adultVrm.update(0.1);

      if (onControllerReady) onControllerReady(characterManager);

      //  WAIT FOR GPU TO CATCH UP BEFORE REVEALING
      // A 100ms delay ensures `useFrame` runs at least once to push bone matrices to the GPU
      setTimeout(() => {
        if (mainVrm.scene) mainVrm.scene.visible = true;
        setIsCharacterReadyToReveal(true);
      }, 100);
    }
  }, [mainVrm, adultVrm, onControllerReady]);

  // ── Physics accumulator ──
  // Accumulates real frame time. Only ticks VRM spring bones
  // when enough time has built up for a full 30hz physics step.
  const physicsAccRef = useRef(0);

  // ── Blendshape dirty-check cache ──
  const blendshapeCache = useRef<Record<string, number>>({
    aa: -1, ee: -1, ih: -1, oh: -1, ou: -1,
  });
  const BLENDSHAPE_EPSILON = 0.004;

  // Invalidate cache on model swap
  useEffect(() => {
    blendshapeCache.current = { aa: -1, ee: -1, ih: -1, oh: -1, ou: -1 };
  }, [mainVrm, adultVrm]);

  //  ─── Camera Target Smoothing ───
  const targetCameraPosRef = useRef(new THREE.Vector3());
  const lookAtPosRef = useRef(new THREE.Vector3());
  const fovRef = useRef(35);

  //  Camera Override Tracking
  const userCameraOverrideRef = useRef(false);
  const prevCinematicRef = useRef(false);
  const _frameTargetPos = useMemo(() => new THREE.Vector3(), []);
  const _frameLookAt = useMemo(() => new THREE.Vector3(), []);
  const _frameLiveHead = useMemo(() => new THREE.Vector3(), []);
  const _frameCharFwd = useMemo(() => new THREE.Vector3(), []);
  const _frameCharHome = useMemo(() => new THREE.Vector3(0, -1.3, 0), []);
  const _frameBedFloor = useMemo(() => new THREE.Vector3(-3.00, -1.3, -3.20), []);
  const _frameBedFinal = useMemo(() => new THREE.Vector3(-3.00, -0.80, -3.20), []);
  const _typingFloor = useMemo(() => new THREE.Vector3(DESK_APPROACH_POS.x, DESK_APPROACH_POS.y, DESK_APPROACH_POS.z), []);
  const _typingFinal = useMemo(() => new THREE.Vector3(CHAIR_POS.x, CHAIR_POS.y, CHAIR_POS.z), []);
  const _backwardDir = useMemo(() => new THREE.Vector3(), []);
  const _charRight = useMemo(() => new THREE.Vector3(), []);
  const _interactionCharPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    //  CRITICAL: Clamp delta to max 1/30s to prevent spring bone explosion (tab switch fix)
    const safeDelta = Math.min(delta, 1 / 30);

    // Read isLowEnd directly — no React state, no re-render
    const currentlyLowEnd = useMoodStore.getState().isLowEnd;
    // Physics ticks at 30hz on low-end, every frame on high-end
    physicsAccRef.current += safeDelta;
    const PHYSICS_INTERVAL = currentlyLowEnd ? 1 / 30 : 0;

    //  PERF FIX: Reuse pre-allocated vectors — NO new THREE.Vector3() in hot loop!
    let targetPos = _frameTargetPos.set(0, 0.8, 7.0);
    let lookAtPos = _frameLookAt.set(0, 0.2, 0);
    let targetFov = 35;
    let cameraLogicOverridden = false;
    const currentAction = animationToPlay;

    if (characterManagerRef.current && mainVrm && adultVrm) {
      // FBX animation mixer — runs every frame (cheap THREE.AnimationMixer tick)
      characterManagerRef.current.update(safeDelta);

      //  ACTIVE MODEL SELECTION — Only update the one the user sees!
      const showAdult = (bedState as string) === 'SEX';
      const activeVrm = showAdult ? adultVrm : mainVrm;
      const inactiveVrm = showAdult ? mainVrm : adultVrm;

      // Force visibility update (Render skip)
      if (activeVrm.scene) activeVrm.scene.visible = true;
      if (inactiveVrm.scene) inactiveVrm.scene.visible = false;

      // VRM spring-bone physics — throttled on low-end, only for ACTIVE model
      if (physicsAccRef.current >= PHYSICS_INTERVAL) {
        const pd = physicsAccRef.current;
        physicsAccRef.current = 0;
        
        // Clamp the delta to a maximum of 0.1 seconds (10 FPS equivalent)
        // This prevents physics explosions and "anti-gravity" glitches during heavy CPU loads.
        const clampedPd = Math.min(pd, 0.1);
        activeVrm.update(clampedPd);
        // physicsAccRef.current is NOT applied to inactive model (CPU save)
      }

      //  HIGH-PERFORMANCE WEB-AUDIO LIP SYNC
      const visemes = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
      const streamVisemes = LipSyncAnalyzer.getInstance().update(safeDelta);

      const blendedVisemes = {
        aa: Math.max(visemesRef.current.aa, streamVisemes.aa),
        ee: Math.max(visemesRef.current.ee, streamVisemes.ee),
        ih: Math.max(visemesRef.current.ih, streamVisemes.ih),
        oh: Math.max(visemesRef.current.oh, streamVisemes.oh),
        ou: Math.max(visemesRef.current.ou, streamVisemes.ou),
      };

      const setBlendshapeIfChanged = (manager: any, name: string, value: number) => {
        const cached = blendshapeCache.current[name] ?? -1;
        if (Math.abs(value - cached) > BLENDSHAPE_EPSILON) {
          manager.setValue(name, value);
          blendshapeCache.current[name] = value;
        }
      };

      // Only write to GPU for the ACTIVE model
      if (activeVrm.expressionManager) {
        visemes.forEach(v => setBlendshapeIfChanged(activeVrm.expressionManager, v, blendedVisemes[v]));
      }

      //  INTIMATE HUGGING KISS STATE MACHINE (5-PHASE REALISM)
      if (kissStateMachineRef.current.phase !== 'NONE') {
        const stateMachine = kissStateMachineRef.current;
        const currentTime = performance.now();
        const phaseElapsedTime = currentTime - stateMachine.phaseStartTime;

        // Get head bone position for camera attachment
        const humanoid = mainVrm.humanoid;
        const headBone = humanoid?.getRawBoneNode('head');

        if (headBone && stateMachine.phase === 'SETUP') {
          // Phase 1: SETUP - Cache head bone, disable animation, face camera
          headBone.getWorldPosition(stateMachine.headBoneWorldPos);
          console.log(" Phase 1: SETUP - Head bone cached, proceeding to APPROACH");

          //  CRITICAL FIX: DO NOT play IDLE animation - causes infinite loop!
          // Let the current animation continue, state machine controls everything

          // Transition to APPROACH phase
          stateMachine.phase = 'APPROACH';
          stateMachine.phaseStartTime = currentTime;
          setKissPhase('APPROACH');
        }

        if (stateMachine.phase === 'APPROACH') {
          // Phase 2: APPROACH & CAMERA ATTACHMENT - Move character closer and attach camera
          const charGroup = characterPositionRef.current;

          // Smoothly move character to intimate position
          damp3(charGroup.position, stateMachine.targetCharacterPos, 0.8, delta);
          damp(charGroup.rotation, 'y', stateMachine.targetCharacterRot, 0.6, delta);

          //  CRITICAL FIX: Correct Vector Math - camera IN FRONT of face, not behind
          // 1. Live head tracking
          const liveHeadPos = _frameLiveHead;
          if (headBone) headBone.getWorldPosition(liveHeadPos);

          // 2. Get the ACTUAL forward vector (VRMs typically face +Z)
          const charForward = _frameCharFwd.set(0, 0, 1).applyQuaternion(characterPositionRef.current.quaternion);

          // 3. Position camera exactly 0.65 units IN FRONT of her face
          targetPos.copy(liveHeadPos).addScaledVector(charForward, 0.65);

          // 4. Drop the camera 0.2 units DOWN (so it films from slightly below)
          targetPos.y -= 0.2;

          // 5. Look slightly UP at her face
          lookAtPos.copy(liveHeadPos);
          lookAtPos.y += 0.05;

          targetFov = 30; // Better portrait FOV
          cameraLogicOverridden = true;

          // Check if approach completed
          if (phaseElapsedTime > APPROACH_DURATION_MS) {
            console.log(" Phase 2: APPROACH - Camera attached, transitioning to INTERACTION");

            // Transition to INTERACTION phase
            stateMachine.phase = 'INTERACTION';
            stateMachine.phaseStartTime = currentTime;
            setKissPhase('INTERACTION');

            // CRITICAL FIX: Trigger HUGGINGKISS animation (not BLOWKISS)
            if (characterManagerRef.current) {
              characterManagerRef.current.play('HUGGINGKISS');
            }
          }
        }

        if (stateMachine.phase === 'INTERACTION') {
          // Phase 3: THE INTERACTION - Hugging kiss animation with forced blinking

          //  CRITICAL FIX: Correct Vector Math - camera IN FRONT of face during hug
          // 1. Live head tracking
          const liveHeadPos = _frameLiveHead;
          if (headBone) headBone.getWorldPosition(liveHeadPos);

          // 2. Get the ACTUAL forward vector (VRMs typically face +Z)
          const charForward = _frameCharFwd.set(0, 0, 1).applyQuaternion(characterPositionRef.current.quaternion);

          // 3. Position camera exactly 0.65 units IN FRONT of her face
          targetPos.copy(liveHeadPos).addScaledVector(charForward, 0.65);

          // 4. Drop the camera 0.2 units DOWN (so it films from slightly below)
          targetPos.y -= 0.2;

          // 5. Look slightly UP at her face
          lookAtPos.copy(liveHeadPos);
          lookAtPos.y += 0.05;

          targetFov = 30; // Better portrait FOV
          cameraLogicOverridden = true;

          //  PRECISE EXPRESSION & BLACKOUT CONTROL
          // At midpoint of INTERACTION phase (60% through), start closing eyes and fading blackout
          if (phaseElapsedTime > INTERACTION_DURATION_MS * 0.6) {
            // Smoothly force eyes closed using damp
            damp(stateMachine, 'currentBlinkValue', 1.0, 0.3, delta); // Smooth to 1.0 (closed)
          }

          // Apply smooth expression value every frame
          if (mainVrm.expressionManager) {
            mainVrm.expressionManager.setValue('blink', stateMachine.currentBlinkValue);
          }

          // Check if interaction duration elapsed
          if (phaseElapsedTime > INTERACTION_DURATION_MS) {
            //  WINDOW EVENT DISPATCH - 100% reliable approach
            console.log(" Dispatching KISS_BLACKOUT_SHOW event");
            window.dispatchEvent(new Event('KISS_BLACKOUT_SHOW'));

            console.log(" Phase 3: INTERACTION - Transitioning to FX_CLIMAX");

            // Transition to FX_CLIMAX phase
            stateMachine.phase = 'FX_CLIMAX';
            stateMachine.phaseStartTime = currentTime;
            stateMachine.currentBlinkValue = 1.0; // snap eyes fully shut
            setKissPhase('FX_CLIMAX');
          }
        }

        else if (stateMachine.phase === 'FX_CLIMAX') {
          const liveHeadPos = _frameLiveHead;
          if (headBone) headBone.getWorldPosition(liveHeadPos);
          const charForward = _frameCharFwd
            .set(0, 0, 1)
            .applyQuaternion(characterPositionRef.current.quaternion)
            .normalize();
          targetPos.copy(liveHeadPos).addScaledVector(charForward, 0.65);
          targetPos.y -= 0.2;
          lookAtPos.copy(liveHeadPos);
          lookAtPos.y += 0.05;
          targetFov = 30;
          cameraLogicOverridden = true;

          damp(stateMachine, 'currentBlinkValue', 1.0, 0.5, delta);
          if (mainVrm.expressionManager) {
            mainVrm.expressionManager.setValue('blink', stateMachine.currentBlinkValue);
          }

          if (phaseElapsedTime > FX_CLIMAX_DURATION_MS) {
            window.dispatchEvent(new Event('KISS_BLACKOUT_HIDE'));
            stateMachine.phase = 'RESET';
            stateMachine.phaseStartTime = currentTime;
            setKissPhase('RESET');
            console.log(" Phase 4: FX_CLIMAX - Transitioning to RESET");
          }
        }

        else if (stateMachine.phase === 'RESET') {
          // Phase 5: RESET SEQUENCE - Return to default state

          // Smoothly return character to default position
          damp3(characterPositionRef.current.position, [0, -1.0, 0], 0.5, delta);
          damp(characterPositionRef.current.rotation, 'y', 0, 0.5, delta);

          // Return camera to default position
          targetPos.copy(DEFAULT_CAMERA_POS);
          lookAtPos.copy(DEFAULT_LOOK_AT);
          targetFov = DEFAULT_FOV;

          cameraLogicOverridden = true;

          //  SMOOTHLY OPEN EYES DURING ZOOM OUT
          // Immediately begin smoothly opening eyes at start of RESET
          damp(stateMachine, 'currentBlinkValue', 0.0, 0.2, delta); // Smooth to 0.0 (open)

          // Apply smooth expression every frame
          if (mainVrm.expressionManager) {
            mainVrm.expressionManager.setValue('blink', stateMachine.currentBlinkValue);
          }

          //  COMPLETE CINEMATIC OVERLAY FADE-OUT
          // Continue fading overlay to transparent
          // No overlay opacity state anymore

          if (phaseElapsedTime > RESET_DURATION_MS) {
            console.log(" Phase 5: RESET - Intimate sequence complete");
            kissStateMachineRef.current.phase = 'NONE';
            kissStateMachineRef.current.currentBlinkValue = 0.0;
            setKissPhase('NONE');
            setAnimationToPlay('IDLE');
            useMoodStore.getState().setAction('IDLE');
            console.log(" Kiss Sequence Complete — reset to IDLE");
          }
        }
      }

      //  TYPING SEQUENCE CINEMATIC OVERRIDE
      if (typingNavPhaseRef.current !== 'IDLE') {
        if (!characterPositionRef.current) return;
        const pos = characterPositionRef.current.position;
        const rot = characterPositionRef.current.rotation;

        const TYPING_FLOOR = _typingFloor;
        const TYPING_FINAL = _typingFinal;
        const cm = characterManagerRef.current;

        const playTypingOnce = (anim: string, phase: typeof lastTypingPhaseRef.current) => {
          if (lastTypingPhaseRef.current !== phase) {
            lastTypingPhaseRef.current = phase;
            cm?.play(anim);
          }
        };

        // Phase: ROTATING — turn to face desk
        if (typingNavPhaseRef.current === 'ROTATING') {
          const dx = TYPING_FLOOR.x - pos.x;
          const dz = TYPING_FLOOR.z - pos.z;
          const targetAngle = Math.atan2(dx, dz);
          damp(rot, 'y', targetAngle, 0.08, delta);

          // Camera stays behind character
          const backward = _backwardDir.set(-Math.sin(rot.y), 0, -Math.cos(rot.y));
          targetPos.copy(pos).addScaledVector(backward, 3.0);
          targetPos.y += 2.0;
          lookAtPos.copy(pos);
          lookAtPos.y += 0.8;
          targetFov = 45;
          cameraLogicOverridden = true;

          if (Math.abs(rot.y - targetAngle) < 0.15) {
            typingNavPhaseRef.current = 'WALKING';
            typingPhaseRef.current = 'CAM_ROTATE';
            setTypingPhase('CAM_ROTATE');
          }
        }

        // Phase: WALKING — move toward desk
        else if (typingNavPhaseRef.current === 'WALKING') {
          playTypingOnce('WALKING', 'WALKING');

          // Same as bed system — damp3 to floor position
          damp3(pos, [TYPING_FLOOR.x, TYPING_FLOOR.y, TYPING_FLOOR.z], 0.15, delta);

          // Camera follows behind
          const back = _backwardDir.set(-Math.sin(rot.y), 0, -Math.cos(rot.y));
          targetPos.copy(pos).addScaledVector(back, 3.0);
          targetPos.y += 2.0;
          lookAtPos.copy(pos);
          lookAtPos.y += 0.8;
          targetFov = 40;
          cameraLogicOverridden = true;

          if (pos.distanceTo(TYPING_FLOOR) < 0.5) {
            typingNavPhaseRef.current = 'SITTING';
            typingPhaseRef.current = 'SITTING';
            setTypingPhase('SITTING');
          }
        }

        // Phase: SITTING — settle into chair
        else if (typingNavPhaseRef.current === 'SITTING') {
          playTypingOnce('SITDOWN', 'SITTING');

          damp3(pos, [TYPING_FINAL.x, TYPING_FINAL.y, TYPING_FINAL.z], 0.12, delta);
          damp(rot, 'y', CHAIR_ROT_Y, 0.15, delta);

          // Camera side angle
          targetPos.set(
            CHAIR_POS.x - 1.5,
            CHAIR_POS.y + 1.0,
            CHAIR_POS.z + 2.0
          );
          lookAtPos.set(CHAIR_POS.x, CHAIR_POS.y + 0.5, CHAIR_POS.z);
          targetFov = 40;
          cameraLogicOverridden = true;

          if (
            pos.distanceTo(TYPING_FINAL) < 0.3 &&
            Math.abs(rot.y - CHAIR_ROT_Y) < 0.1 &&
            !typingAnimFiredRef.current
          ) {
            typingAnimFiredRef.current = true;
            typingNavPhaseRef.current = 'TYPING';
            typingPhaseRef.current = 'TYPING';
            setTypingPhase('TYPING');
            lastTypingPhaseRef.current = 'TYPING';
            cm?.play('TYPING');
          }
        }

        // Phase: TYPING — she types, camera locked on desk
        else if (typingNavPhaseRef.current === 'TYPING') {
          damp3(pos, [TYPING_FINAL.x, TYPING_FINAL.y, TYPING_FINAL.z], 0.5, delta);
          damp(rot, 'y', CHAIR_ROT_Y, 0.5, delta);

          // Head bone pe camera chipkao — kiss sequence ki tarah
          const headBone = mainVrm?.humanoid?.getRawBoneNode('head');
          if (headBone) {
            const headPos = _frameLiveHead;
            headBone.getWorldPosition(headPos);

            const charForward = _frameCharFwd
              .set(0, 0, 1)
              .applyQuaternion(characterPositionRef.current.quaternion)
              .normalize();

            const charRight = _charRight.set(-1, 0, 0).applyQuaternion(characterPositionRef.current.quaternion).normalize();

            // Camera from BEHIND her, further away
            targetPos.copy(headPos)
              .addScaledVector(charForward, -4.5); // Further behind her
            targetPos.y += 1.2; // Slightly higher

            // Look towards the monitor
            lookAtPos.copy(headPos)
              .addScaledVector(charForward, 2.0);
            lookAtPos.y -= 0.1;
          } else {
            // Fallback
            targetPos.set(CHAIR_POS.x + 1.5, CHAIR_POS.y + 1.5, CHAIR_POS.z - 2.0);
            lookAtPos.set(CHAIR_POS.x, CHAIR_POS.y + 0.5, CHAIR_POS.z);
          }

          targetFov = 50;
          cameraLogicOverridden = true;
        }
        // Phase: EXIT_TURN — stand up and turn to face the center
        else if (typingNavPhaseRef.current === 'EXIT_TURN') {
          playTypingOnce('WALKING', 'EXIT_TURN');

          // Face the center (0,0)
          const dx = 0 - pos.x;
          const dz = 0 - pos.z;
          const targetAngle = Math.atan2(dx, dz);
          damp(rot, 'y', targetAngle, 0.1, delta);

          // Move slightly away from the desk to avoid clipping
          damp3(pos, [CHAIR_POS.x - 0.5, -1.3, CHAIR_POS.z - 0.5], 0.2, delta);

          // Return camera to default smoothly
          targetPos.copy(DEFAULT_CAMERA_POS);
          lookAtPos.copy(DEFAULT_LOOK_AT);
          targetFov = DEFAULT_FOV;
          cameraLogicOverridden = true;

          if (Math.abs(rot.y - targetAngle) < 0.2) {
            typingNavPhaseRef.current = 'EXIT_WALK';
          }
        }
        // Phase: EXIT_WALK — walk back to the center of the room AND wait for camera
        else if (typingNavPhaseRef.current === 'EXIT_WALK') {
          // 1. Character को सेंटर की तरफ भेजो
          damp3(pos, [0, -1.3, 0], 0.15, delta);

          // 2. कैमरे को Default Position की तरफ भेजो
          targetPos.copy(DEFAULT_CAMERA_POS);
          lookAtPos.copy(DEFAULT_LOOK_AT);
          targetFov = DEFAULT_FOV;
          cameraLogicOverridden = true;

          // चेक करो कि क्या Character अपनी जगह पहुँच गई है?
          const isCharacterHome = pos.distanceTo(_frameCharHome) < 0.2;

          if (isCharacterHome) {
            // Character पहुँच गई है: उसे तुरंत IDLE कर do (ताकि वो हवा में न चले)
            rot.y = 0;
            if (lastTypingPhaseRef.current !== 'IDLE') {
              playTypingOnce('IDLE', 'IDLE');
              setAnimationToPlay('IDLE');
            }

            console.log(" Reached center. Releasing cinematic locks natively.");

            typingNavPhaseRef.current = 'IDLE';
            typingPhaseRef.current = 'NONE';
            lastTypingPhaseRef.current = 'IDLE';
            setTypingPhase('NONE');
          } else {
            // Character अभी चल रही है
            playTypingOnce('WALKING', 'EXIT_WALK');
          }
        }
      }

      //  DYNAMIC POV & OFFSET ENGINE 
      if (!cameraLogicOverridden && bedState === 'SEX') {
        const config = INTERACTION_OFFSETS[currentAction] || INTERACTION_OFFSETS.DEFAULT;

        // 1. Position character on bed
        if (characterPositionRef.current) {
          damp3(characterPositionRef.current.position, _interactionCharPos.fromArray(config.charPos), 0.3, delta);
          damp(characterPositionRef.current.rotation, 'y', config.charRotY, 0.3, delta);
        }

        // 2. Adjust Camera POV
        targetPos.fromArray(config.camPos);
        lookAtPos.fromArray(config.camLookAt);
        targetFov = config.fov;
      }
      // 1. BLOWJOB SEQUENCE (NON-BED FALLBACK)
      else if (['BLOWJOB', 'BLOWJOB2', 'BLOWJOB3'].includes(currentAction)) {
        targetPos.set(0, 1.1, 1.9);
        lookAtPos.set(0, 0.2, 0);
      }
      // 2. BACKSHOT SEQUENCE
      else if (currentAction === 'BACKSHOT') {
        targetPos.set(0, 0.35, 2.0);
        lookAtPos.set(0, 0.5, 0);
      }
      else if (currentAction === 'BACKSHOT2') {
        targetPos.set(0, 0.35, -2.0);
        lookAtPos.set(0, 0.5, 0);
      }
      else if (currentAction === 'BACKSHOT3') {
        targetPos.set(0, 0.35, -2.0);
        lookAtPos.set(0, 0.9, 0);
      }
      else if (currentAction === 'BACKSHOT4') {
        targetPos.set(0, 0.35, -2.0);
        lookAtPos.set(0, 0.9, 0);
      }
      else if (currentAction === 'MASTURBATE') {
        targetPos.set(0, 0.25, 1.3); lookAtPos.set(0, 0.35, 0);
      }
      else if (['TYPING'].includes(currentAction)) {
        targetPos.set(0, 0.6, 4.5); lookAtPos.set(0, 0.3, 0);
      }
      else if (['SLEEPING', 'YAWN'].includes(currentAction)) {
        targetPos.set(0, 1.4, 9.5); lookAtPos.set(0, -0.4, 0);
      }
      else if (['KISS', 'HUG', 'REAL_KISS', 'LOVE'].includes(currentAction)) {
        targetPos.set(0, 0.55, 0.35); lookAtPos.set(0, 0.55, 0);
      }

      //  INTENT-BASED PROXIMITY (Natural Zoom & FOV Depth)
      const lockedActions = ['BLOWJOB', 'BLOWJOB2', 'BLOWJOB3', 'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'MASTURBATE', 'SLEEPING', 'YAWN', 'TYPING'];
      const behavior = parseBehaviorTags(currentAction);

      //  BED STATE CAMERA OVERRIDES (Moved logic to Engine block)
      if (bedState === 'SLEEP') {
        targetPos.set(0, 1.2, 3.5);
        lookAtPos.set(-2.5, -0.3, -3.2);
        targetFov = 40;
      }

      if (!cameraLogicOverridden && behavior.leanIn && !lockedActions.includes(currentAction)) {
        // Natural Zoom close up!
        targetPos.set(0, 0.85, 2.5);
        lookAtPos.set(0, 0.75, 0);
        targetFov = 25; // Smaller FOV = Zoomed in depth perception!
      }

      // Only write to GPU for the ACTIVE model
      if (activeVrm.expressionManager) {
        visemes.forEach(v => setBlendshapeIfChanged(activeVrm.expressionManager, v, blendedVisemes[v]));
        activeVrm.expressionManager.update();
      }

      //  SEQUENTIAL BED NAVIGATION STATE MACHINE
      if (characterPositionRef.current) {
        const pos = characterPositionRef.current.position;
        const rot = characterPositionRef.current.rotation;
        const BED_FLOOR = _frameBedFloor;   // floor-level waypoint
        const BED_FINAL = _frameBedFinal;   // on-mattress final position
        // const cm = characterManagerRef.current; // Removed to sync with React state machine instead

        // ── Detect bedState change and kick off the phase machine ──
        if (prevBedStateRef.current !== bedState) {
          prevBedStateRef.current = bedState;
          bedAnimFiredRef.current = false;
          lastPhaseRef.current = 'IDLE'; // reset gate
          if (bedState !== 'NONE') {
            bedPhaseRef.current = 'ROTATING';
          } else {
            bedPhaseRef.current = 'WALKING';
          }
        }

        // Helper: sync animation state exactly once per phase
        const playOnce = (anim: string, phase: BedPhase) => {
          if (lastPhaseRef.current !== phase) {
            lastPhaseRef.current = phase;
            setAnimationToPlay(anim); //  FIXED: Sync React State instead of imperative cm.play
          }
        };

        // ── Phase: NONE — walk back to center ──
        if (bedState === 'NONE' && typingNavPhaseRef.current === 'IDLE') {
          if (bedPhaseRef.current === 'WALKING') {
            playOnce('WALKING', 'WALKING');
            damp3(pos, [0, -1.3, 0], 0.06, delta);
            damp(rot, 'y', 0, 0.1, delta);
            if (pos.distanceTo(_frameCharHome) < 0.25) {
              bedPhaseRef.current = 'IDLE';
              playOnce('IDLE', 'IDLE');
            }
          } else if (typingNavPhaseRef.current === 'IDLE') {
            damp3(pos, [0, -1.3, 0], 0.5, delta);
            damp(rot, 'y', 0, 0.5, delta);
          }
        }

        // ── Phase 1: ROTATING — turn to face the bed ──
        else if (bedPhaseRef.current === 'ROTATING') {
          const dx = BED_FLOOR.x - pos.x;
          const dz = BED_FLOOR.z - pos.z;
          const targetAngle = Math.atan2(dx, dz);
          damp(rot, 'y', targetAngle, 0.08, delta);
          if (Math.abs(rot.y - targetAngle) < 0.1) {
            bedPhaseRef.current = 'WALKING';
          }
        }

        // ── Phase 2: WALKING — move toward bed at floor height ──
        else if (bedPhaseRef.current === 'WALKING') {
          playOnce('WALKING', 'WALKING');
          // Keep Y strictly at floor level while walking (prevent flying)
          damp3(pos, [BED_FLOOR.x, -1.3, BED_FLOOR.z], 0.15, delta);
          if (pos.distanceTo(BED_FLOOR) < 0.25) { // BED_FLOOR already at y=-1.3
            bedPhaseRef.current = 'SETTLING';
          }
        }

        // ── Phase 3: SETTLING — rotate + lift onto mattress ──
        else if (bedPhaseRef.current === 'SETTLING') {
          const finalAngle = bedState === 'SEX' ? Math.PI / 2 : 0;
          damp(rot, 'y', finalAngle, 0.15, delta);
          damp3(pos, [BED_FINAL.x, BED_FINAL.y, BED_FINAL.z], 0.12, delta);
          if (
            Math.abs(rot.y - finalAngle) < 0.08 &&
            pos.distanceTo(BED_FINAL) < 0.1 &&
            !bedAnimFiredRef.current
          ) {
            bedAnimFiredRef.current = true;
            bedPhaseRef.current = 'ON_BED';
            lastPhaseRef.current = 'ON_BED';

            //  FIXED: Check if the backend already requested a specific POV sex action
            const interactionActions = ['MASTURBATE', 'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BACKSHOT5', 'BLOWJOB', 'BLOWJOB2', 'BLOWJOB3', 'FRONT', 'FRONT2', 'FRONTSLOW'];
            const targetAnim = bedState === 'SLEEP' ? 'LAYING' : (interactionActions.includes(backendAction) ? backendAction : 'BACKSHOT');

            setAnimationToPlay(targetAnim); // Syncs perfectly with React lifecycle
          }
        }

        // ── Phase 4: ON_BED — hold, animation locked ──
        else if (bedPhaseRef.current === 'ON_BED') {
          //  Dynamic POV Alignment for SEX mode
          if (bedState === 'SEX') {
            // Priority: config.charPos > animation phases
            const config = INTERACTION_OFFSETS[animationToPlay] || INTERACTION_OFFSETS.DEFAULT;
            damp3(pos, config.charPos, 0.1, delta); // Faster damping for interaction switches
            damp(rot, 'y', config.charRotY, 0.1, delta);
          } else {
            damp3(pos, [BED_FINAL.x, BED_FINAL.y, BED_FINAL.z], 0.5, delta);
            damp(rot, 'y', 0, 0.5, delta);
          }
        }
      }
    }

    //  DYNAMIC CAMERA ENGINE (Free Roam vs Cinematic) 

    // Determine if we are in a locked cinematic sequence
    const isCinematicSequence =
      kissStateMachineRef.current.phase !== 'NONE' ||
      bedState !== 'NONE' ||
      typingNavPhaseRef.current !== 'IDLE' || //  FIX: यह EXIT_TURN और EXIT_WALK को कवर करेगा
      cameraLogicOverridden || //  FIX: Overridden कैमरा मूवमेंट्स को allow करेगा
      ['BACKSHOT', 'BLOWJOB', 'FRONT'].some(act => currentAction.includes(act));

    if (!state.camera.userData.currentLookAt) {
      state.camera.userData.currentLookAt = lookAtPos.clone();
    }

    if (isCinematicSequence !== prevCinematicRef.current) {
      if (isCinematicSequence) {
        userCameraOverrideRef.current = false; // Reset override when starting cinematic
      }
      prevCinematicRef.current = isCinematicSequence;
    }

    if (isCinematicSequence) {
      //  CINEMATIC MODE: Allow user to override camera
      if (controlsRef.current) controlsRef.current.enabled = true;

      // Only force camera position if user hasn't manually taken over
      if (!userCameraOverrideRef.current) {
        damp3(state.camera.position, targetPos, 0.3, delta);
      }

      damp3(state.camera.userData.currentLookAt, lookAtPos, 0.25, delta);
      damp(state.camera, 'fov', targetFov, 0.25, delta);

      state.camera.lookAt(state.camera.userData.currentLookAt);

      if (controlsRef.current) {
        controlsRef.current.target.copy(state.camera.userData.currentLookAt);
        controlsRef.current.update();
      }
    } else {
      //  GAME MODE (Free Roam): Yield to CinematicDirector (GameVibeR3F)
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }

      // We only update OrbitControls target to keep framing if user starts rotating
      if (controlsRef.current && controlsRef.current.enabled) {
        damp3(controlsRef.current.target, lookAtPos, 0.25, delta);
        damp(state.camera, 'fov', targetFov, 0.25, delta);
        controlsRef.current.update();
      }

      //  THE NUCLEAR MASTERSTROKE (POSTURE & SOUL ENGINE) 
      // ONLY process the ACTIVE model to save massive GPU/CPU resources
      const showAdult = (bedState as any) === 'SEX';
      const activeVrm = showAdult ? adultVrm : mainVrm;

      const currentPersona = (currentMode || 'DEFAULT').toUpperCase();
      const currentEmotion = (mascot?.emotion || 'NEUTRAL').toUpperCase();

      updatePosture(
        [activeVrm],
        delta,
        characterPositionRef.current,
        currentPersona,
        currentEmotion,
        emotionTimeRef.current,
        winkActiveRef.current
      );

      //  THE ADVANCED AWARENESS ENGINE 
      const isBusy = bedState !== 'NONE' || typingNavPhaseRef.current !== 'IDLE' || winkActiveRef.current;
      awareness.onTick(
        state,
        delta,
        characterPositionRef.current,
        activeVrm === mainVrm ? characterManagerRef.current : null, //  Protect mixed objects
        isBusy
      );

      //  THE AUTONOMOUS ENGINE (Micro-motion, Eye Darts, Blinks)
      if (activeVrm && !isMourning && !isSulking) {
        const isEmotionActive = mascot?.emotion && (mascot.emotion !== 'NEUTRAL');
        const suppressionValue = isEmotionActive ? 0.2 : 1.0;
        autonomousEngine.update(activeVrm, delta, state.clock, mascot?.emotion, winkActiveRef.current, suppressionValue);
      }

      // इसे सबसे आख़िर में रखना ताकि ये Mixamo को हरा सके
      const isCinematic = bedState !== 'NONE' || kissStateMachineRef.current.phase !== 'NONE' || winkActiveRef.current;
      (window as any).__cinematicLock = isCinematic;
      updateSoul([activeVrm], state, delta, isCinematic, mascot?.emotion, mascot?.speaking);
    } // Closes if (characterManagerRef.current && mainVrm && adultVrm)

    state.camera.updateProjectionMatrix();
  });

  return (
    <>
      {/*  THE ACTUAL 3D ROOM */}
      <RoomEnvironment />

      {/*  Horizontal-Only OrbitControls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        maxPolarAngle={Math.PI / 2 + 0.1}
        minDistance={1}
        maxDistance={8}
        onStart={() => { userCameraOverrideRef.current = true; }}
      />

      {/*  THE AURA LIGHTING ENGINE (Dynamic Vibe Engine) */}
      <PersonaAuraLighting />

      {/*  ATMOSPHERIC HORROR ENGINE */}
      <MistAura persona={currentMode || 'DEFAULT'} />
      <DustMotes persona={currentMode || 'DEFAULT'} />

      {/*  MAEVE (3D Character Container) - Always rendered so models can load */}
      <group ref={characterPositionRef} position={[0, -1.0, 0]} visible={isCharacterReadyToReveal}>
        {(mainPath === adultPath) ? (
          <group name="custom-model-container" position={[0, -0.05, 0]} rotation={[0, Math.PI, 0]}>
            <DynamicAvatar
              key={"custom-" + mainPath}
              url={mainPath}
              onLoad={(m) => {
                if (m.scene) m.scene.visible = false; //  HARD HIDE INSTANTLY
                handleModelLoaded(m, false);
                handleModelLoaded(m, true);
              }}
            />
          </group>
        ) : (
          <>
            <DynamicAvatar
              key={"main-" + mainPath}
              url={mainPath}
              onLoad={(m) => {
                if (m.scene) m.scene.visible = false; //  HARD HIDE INSTANTLY
                handleModelLoaded(m, false);
                setIsMainModelReady(true);
              }}
            />
            {isMainModelReady && (
              <group name="adult-model-container">
                <DynamicAvatar
                  key={"adult-" + adultPath}
                  url={adultPath}
                  onLoad={(m) => {
                    if (m.scene) m.scene.visible = false; //  HARD HIDE INSTANTLY
                    handleModelLoaded(m, true);
                  }}
                />
              </group>
            )}
          </>
        )}

        {/*  ANIME EXPRESSION VFX SUITE (Portaled to Head Bone) */}
        <AnimeVFXSuite vrm={mainVrm || adultVrm} emotion={mascot?.emotion || 'NEUTRAL'} />
      </group>


      {/*  Interaction Prop (Dick Prop) logic - BONE TRACKING ENABLED */}
      {/*  Lazy Loaded Interaction Prop - Protected by Suspense Boundary */}
      {bedState === 'SEX' && (
        <Suspense fallback={null}>
          <SexProp
            isVisible={true}
            animationName={animationToPlay}
            vrm={adultVrm || mainVrm}
          />
        </Suspense>
      )}

      {/* Verse & Reality Engine handles post-processing via GameVibeR3F */}
      <InteractionTouchEngine vrm={mainVrm || adultVrm} activePersona={currentMode} />
      <CinematicPostProcessing />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile detection — evaluated once at module load, zero runtime cost.
// ─────────────────────────────────────────────────────────────────────────────
const IS_MOBILE =
  /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

// DPR per performance tier — lower = faster, higher = sharper
const TIER_DPR = [0.5, 0.75, 1.0, 1.5] as const;

export const VRMScene = () => {
  const { isModelSwapping, setPerformanceTier, performanceTier, manualOverride } = useMoodStore(
    useShallow((state) => ({
      isModelSwapping: state.isModelSwapping,
      setPerformanceTier: state.setPerformanceTier,
      performanceTier: state.performanceTier,
      manualOverride: state.manualOverride,
    }))
  );

  // effectiveTier: what is actually being rendered. manualOverride wins over auto.
  const effectiveTier = manualOverride !== null ? manualOverride : performanceTier;

  // DPR is directly driven by effectiveTier — no separate useState needed.
  const dpr = IS_MOBILE ? Math.min(TIER_DPR[effectiveTier], 1.0) : TIER_DPR[effectiveTier];

  // Force Tier 1 immediately on mobile — don't wait for PerformanceMonitor.
  useEffect(() => {
    if (IS_MOBILE && performanceTier > 1) {
      setPerformanceTier(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute gl config once — avoids object recreation every render.
  const glConfig = useMemo(() => ({
    antialias: false,                      //  CRITICAL: MSAA is the #1 killer of mobile GPU
    alpha: false,
    stencil: false,
    depth: true,
    // Tier 0 & 1: cheap LinearToneMapping (1 multiply). Tier 2+: cinematic ACES.
    toneMapping: effectiveTier <= 1
      ? THREE.LinearToneMapping
      : THREE.ACESFilmicToneMapping,
    powerPreference: 'high-performance' as WebGLPowerPreference,
    // Tier 0 → lowp (saves ~30% fillrate), Tier 1 → lowp, Tier 2+ → mediump
    precision: effectiveTier <= 1 ? 'lowp' : 'mediump',
    preserveDrawingBuffer: false,
  }), [effectiveTier]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#080810', position: 'relative', overflow: 'hidden' }}>
      {/*  THE SWAP TRANSITION OVERLAY */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: '#050508',
          zIndex: 9999,
          opacity: isModelSwapping ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}
      />

      {/*
        frameloop='always' — NEVER use 'demand' with setInterval/advance().
        That pattern fires frames off-vsync and causes jitter/stuttering.
        Performance savings come from DPR reduction, shadows off, and AA off.
      */}
      <Canvas
        shadows={effectiveTier >= 2 && !IS_MOBILE}  // Shadows only on Tier 2+
        dpr={dpr}
        frameloop="always"
        camera={{ position: [0, 0.5, 4], fov: 35 }}
        gl={glConfig}
      >
        {/*
          4-Tier PerformanceMonitor with Yo-Yo prevention:
          - bounds: only fires if FPS drifts by >7% from 60fps (prevents micro-jitter triggers)
          - flipflops: must decline 3 consecutive samples before downgrading (prevents thrashing)
          - ms=500: averages over half a second, not a single spike (e.g. Ollama CPU spikes)
          - manualOverride check: if user locked a tier, ignore PerformanceMonitor writes.
        */}
        <PerformanceMonitor
          ms={500}
          iterations={4}
          bounds={(refreshrate) => [refreshrate * 0.93, refreshrate * 1.07]}
          flipflops={3}
          onChange={({ factor }) => {
            // Ignore if user has manually locked a tier
            if (useMoodStore.getState().manualOverride !== null) return;

            // Map the continuous 0–1 factor to discrete tiers 0–3
            const newTier = factor < 0.2 ? 0
              : factor < 0.45 ? 1
                : factor < 0.75 ? 2
                  : 3;

            // Only write to store if tier actually changed — prevents micro re-renders
            if (useMoodStore.getState().performanceTier !== newTier) {
              console.log(`[PerformanceTier] factor=${factor.toFixed(2)} → Tier ${newTier}`);
              setPerformanceTier(newTier);
            }
          }}
        />
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>

      {/* Manual Override UI — visible only when override is active */}
      {manualOverride !== null && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          borderRadius: 6, padding: '3px 8px',
          fontSize: 11, fontFamily: 'monospace',
          pointerEvents: 'none', zIndex: 9000,
        }}>
          ⚙️ Tier {manualOverride} (Locked)
        </div>
      )}
    </div>
  );
};

export default VRMScene;

useGLTF.preload('/models/P.glb');
