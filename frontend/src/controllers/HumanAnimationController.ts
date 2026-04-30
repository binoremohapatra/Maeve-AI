import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { mixamoFbx2motion } from '../animation/mixamoFbx2motion';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { LipSyncSystem } from './LipSyncSystem';
import { useMoodStore } from '../stores/moodStore';
import { damp3, dampQ } from 'maath/easing';
import { createNoise2D } from 'simplex-noise';
import { parseBehaviorTags, BehaviorParams } from '../utils/BehaviorMapper';
import { EmotionDirector } from './EmotionDirector';
import { EyeOverrideLogic } from './EyeOverrideLogic';
import { PoseOverrideSystem, asteriskToPose } from '../animation/PoseOverrideSystem';

/**
 *  ULTRA SHUFFLE LIST
 * Mapping for the dance animations used during music playback.
 * These match your mixamo files exactly.
 */
const ALL_DANCES = [
    "DANCE_HAPPY",        // mapping to: standingdance.fbx
    "DANCE_COOL",         // mapping to: gooddancestep.fbx
    "DANCE_SEXY",         // mapping to: sexydance.fbx
    "DANCE_BOOTY",        // mapping to: bootyhiphop.fbx
    "DANCE_HH_VAR",       // mapping to: hhdance.fbx
    "DANCE_HIPHOP",       // mapping to: hiphop.fbx
    "DANCE_SABA",         // mapping to: salsadancing.fbx
    "DANCE_SOUL",         // mapping to: happydance.fbx
    "DANCE_ROBOT"         // mapping to: standingdance.fbx
];

/**
 *  CinematicFrame Interface
 * Defines the structure for facial expressions and head movement in cinematic sequences.
 */
export interface CinematicFrame {
    aa?: number;
    oh?: number;
    ih?: number;
    blink?: number;
    happy?: number;
    eyeRoll?: number;
    relaxed?: number;
    headTilt?: number;
    breathAmp?: number;
    tremble?: number;
    //  Anime-Specific Blendshapes (VRoid / UniVRM)
    joy?: number;
    angry?: number;
    sorrow?: number;
    fun?: number;
    surprised?: number;
    blush?: number;
    smirk?: number;
    tongueOut?: number;
    pout?: number;
}

/**
 *  HumanAnimationController
 * Handles complex VRM state management, automated wardrobe logic for merged meshes,
 * and high-fidelity facial animations with LERP smoothing.
 */

export class HumanAnimationController {
    //  COMPREHENSIVE ANIMATION & 27-EMOTION LIBRARY
    private static readonly ANIMATION_MAP: Record<string, string> = {
        // --- 1. Basic States & Interactions ---
        "IDLE": "/animations/femineidle.fbx",
        "FEMINEIDLE": "/animations/femineidle.fbx",
        "BREATHINGIDLE": "/animations/breathingidle.fbx",
        "WEIGHTSHIFT": "/animations/weightshift.fbx",
        "WAVE": "/animations/waving.fbx",
        "WALKING": "/animations/walking.fbx",
        "STEPPINGFORWARD": "/animations/steppingforward.fbx",
        "STEPPINGBACK": "/animations/steppingback.fbx",
        "SLEEPING": "/animations/laying.fbx",
        "LAYING": "/animations/laying.fbx",
        "DRINKING": "/animations/drinking.fbx",
        "SIPPING": "/animations/drinking.fbx",
        "TPOSE": "/animations/xbot.fbx",
        "XBOT": "/animations/xbot.fbx",

        // --- 2. Low Energy & Neutral Emotions ---
        "NEUTRAL": "/animations/femineidle.fbx",
        "CALMNESS": "/animations/breathingidle.fbx",
        "BOREDOM": "/animations/yawn.fbx",
        "YAWN": "/animations/yawn.fbx",
        "AWKWARDNESS": "/animations/lookawaygesture.fbx",
        "CONFUSION": "/animations/lookaround.fbx",
        "LOOKAROUND": "/animations/lookaround.fbx",
        "LOOKINGAROUND": "/animations/lookingaround.fbx",
        "SEARCHING": "/animations/lookingaround.fbx",
        "NOSTALGIA": "/animations/lengthyheadnod.fbx",
        "FEMALETHINKING": "/animations/femalethinking.fbx",
        "THINKING": "/animations/femalethinking.fbx",
        "FOCUS": "/animations/focus.fbx",
        "TYPING": "/animations/typing.fbx",

        // --- 3. Positive & Engaged Emotions ---
        "HAPPY": "/animations/happy.fbx",
        "JOY": "/animations/joy.fbx",
        "EXCITED": "/animations/excited.fbx",
        "EXCITEMENT": "/animations/excited.fbx",
        "LAUGHING": "/animations/laughing.fbx",
        "AMUSEMENT": "/animations/laughing.fbx",
        "RELIEVED": "/animations/relievedsigh.fbx",
        "RELIEF": "/animations/relievedsigh.fbx",
        "SATISFACTION": "/animations/hardheadnod.fbx",
        "AESTHETIC_APPRECIATION": "/animations/headnodyes.fbx",
        "ADMIRATION": "/animations/acknowledging.fbx",
        "ACKNOWLEDGE": "/animations/acknowledging.fbx",
        "PRIDE": "/animations/handsonhips.fbx",
        "HANDS_ON_HIPS": "/animations/handsonhips.fbx",
        "BEINGCOCKY": "/animations/beingcocky.fbx",
        "COCKY": "/animations/beingcocky.fbx",
        "TRIUMPH": "/animations/femalevictory.fbx",
        "FEMALEVICTORY": "/animations/femalevictory.fbx",
        "CHEERING": "/animations/cheering.fbx",
        "CLAPPING": "/animations/clapping.fbx",

        // --- 4. Sadness & Vulnerability Emotions ---
        // SAD: Soft melancholic pose — eyes down, subtle sorrow
        "SAD": "/animations/sadanimation.fbx",
        "EMPATHIC_PAIN": "/animations/sadanimation.fbx",
        "DISAPPOINTMENT": "/animations/sadanimation.fbx",
        "SYMPATHY": "/animations/thankfulwomen.fbx",
        // CRYING: Defeated, full breakdown pose — heavier animation
        "CRYING": "/animations/saddefeat.fbx",
        "CRY": "/animations/saddefeat.fbx",
        "SOBBING": "/animations/saddefeat.fbx",
        "SOB": "/animations/saddefeat.fbx",
        "TEARS": "/animations/saddefeat.fbx",
        "WEEPING": "/animations/saddefeat.fbx",
        "SADNESS": "/animations/saddefeat.fbx",
        "SAD_DEFEAT": "/animations/saddefeat.fbx",
        "GUILT": "/animations/saddefeat.fbx",
        "THANKFUL": "/animations/thankfulwomen.fbx",

        // --- 5. Anger & Toxicity Emotions ---
        "ANGER": "/animations/femaleangry.fbx",
        "ANGRY": "/animations/femaleangry.fbx",
        "ARGUING": "/animations/arguing.fbx",
        "CONTEMPT": "/animations/sarcasticheadnod.fbx",
        "SARCASTIC_NOD": "/animations/sarcasticheadnod.fbx",
        "DISGUST": "/animations/dismissinggesture.fbx",
        "DISMISS": "/animations/dismissinggesture.fbx",
        "ENVY": "/animations/lookingsideways.fbx",
        "LOOK_SIDEWAYS": "/animations/lookingsideways.fbx",
        "ANNOYED": "/animations/annoyedheadshake.fbx", //  FIXED THE SPACE!
        "ANNOYED_SHAKE": "/animations/annoyedheadshake.fbx", //  FIXED THE SPACE!

        // --- 6. Fear & Stress Emotions ---
        "ANXIETY": "/animations/nervouslylookaround.fbx",
        "NERVOUS_LOOK": "/animations/nervouslylookaround.fbx",
        "FEAR": "/animations/steppingback.fbx",
        "HORROR": "/animations/coveringmouth.fbx",
        "COVER_MOUTH": "/animations/coveringmouth.fbx",
        "SURPRISE": "/animations/surprised.fbx",
        "SURPRISED": "/animations/surprised.fbx",

        // --- 7. Romance, Intimacy & Desire ---
        "ROMANCE": "/animations/blowkiss.fbx",
        "ADORATION": "/animations/happyhandgesture.fbx",
        "HAPPY_GESTURE": "/animations/happyhandgesture.fbx",
        "SHY": "/animations/Bashful.fbx", // Exact case 'Bashful'
        "BASHFUL": "/animations/Bashful.fbx",
        "CRAVING": "/animations/Bashful.fbx",
        "SEXUAL_DESIRE": "/animations/sexydance.fbx",
        "SEXY": "/animations/sexydance.fbx",

        // --- 8. Head Gestures ---
        "NOD": "/animations/headnodyes.fbx",
        "HARD_NOD": "/animations/hardheadnod.fbx",
        "LENGTHY_NOD": "/animations/lengthyheadnod.fbx",
        "SHAKE_NO": "/animations/shakingheadno.fbx",
        "THOUGHTFUL_SHAKE": "/animations/thoughtfulheadshake.fbx",

        // --- 9. Dances (Frontend UI triggers) ---
        "HAPPYDANCE": "/animations/happydance.fbx",
        "BELLY": "/animations/bellydancing.fbx",
        "BELLYDANCE": "/animations/bellydancing.fbx",
        "HIPHOP": "/animations/hiphop.fbx",
        "BOOTY": "/animations/bootyhiphop.fbx",
        "BOOTYHIPHOP": "/animations/bootyhiphop.fbx",
        "SALSA": "/animations/salsadancing.fbx",
        "SALSADANCE": "/animations/salsadancing.fbx",
        "SEXYDANCE": "/animations/sexydance.fbx",
        "SOULDANCE": "/animations/souldance.fbx",
        "STANDINGDANCE": "/animations/standingdance.fbx",
        "HH": "/animations/hhdance.fbx",
        "HHDANCE": "/animations/hhdance.fbx",
        "COOL": "/animations/gooddancestep.fbx",
        "GOODDANCESTEP": "/animations/gooddancestep.fbx",

        // --- 10. Explicit & NSFW Content (ADULT) ---
        "KISS": "/animations/huggingkiss.fbx",
        "NORMALKISS": "/animations/normalkiss.fbx",
        "BLOWKISS": "/animations/blowkiss.fbx",
        "HUGGINGKISS": "/animations/huggingkiss.fbx",
        "LOVE": "/animations/blowkiss.fbx",

        "MASTURBATE": "/animations/mastubate.fbx", //  Spelled to match your EXACT file without 'r'
        "AHEGAO": "/animations/mastubate.fbx",

        "BACKSHOT": "/animations/backshot1.fbx",
        "BACKSHOT2": "/animations/backshot2.fbx",
        "BACKSHOT3": "/animations/backshot3.fbx",
        "BACKSHOT4": "/animations/backshot4.fbx",
        "BACKSHOT5": "/animations/backshot5.fbx",

        "BLOWJOB": "/animations/blow1.fbx",
        "BLOWJOB1": "/animations/blow1.fbx",
        "BLOWJOB2": "/animations/blow2.fbx",
        "BLOWJOB3": "/animations/blow3.fbx",

        "FRONT": "/animations/fromfront2.fbx",
        "FRONT2": "/animations/fromfront3.fbx",
        "FRONTSLOW": "/animations/frontslow.fbx"
    };

    private vrm: VRM | null = null;
    public isReversedModel: boolean = false; //  HACK: Toggle for custom models

    // --- ANTI-GRAVITY VARIABLES ---
    private mousePos = new THREE.Vector2();
    private headBaseQ = new THREE.Quaternion();
    private lastBlinkTime = 0;
    private isBlinking = false;

    private mixer: THREE.AnimationMixer | null = null;
    private currentAction: THREE.AnimationAction | null = null;
    private currentActionName: string = "IDLE";
    //  ALIVE TIMERS
    private lastBreakIdleTime: number = 0;
    private breakIdleInterval: number = 15 + Math.random() * 15; // 15-30s

    private loader: FBXLoader;
    private animationCache: Map<string, THREE.AnimationClip> = new Map();
    private pendingAnimations: Map<string, Promise<THREE.AnimationClip | null>> = new Map();
    private transitionDuration: number = 0.5;
    private isAdultMode: boolean = false;

    // Engine & Physics Logic
    private noise2D = createNoise2D();
    private headLookTarget = new THREE.Vector3();
    private currentBehavior: BehaviorParams | null = null;
    private neckBaseQ = new THREE.Quaternion();

    // Procedural Memory blocks
    private currentProceduralHeadQ = new THREE.Quaternion();
    private currentProceduralNeckQ = new THREE.Quaternion();
    private lastLookAtPoint = new THREE.Vector3();
    private gazeChangeTime = 0;
    private blinkPending = false;

    // Extrapolated Directors
    private emotionDirector: EmotionDirector;
    private eyeOverrideLogic: EyeOverrideLogic;

    // ─── Layer 3: Additive Pose Override ───────────────────────────────────
    private poseSystem: PoseOverrideSystem | null = null;

    // ---  TIMER MANAGEMENT ---
    private targetFaceState: any = {
        aa: 0, ih: 0, ou: 0, oh: 0, blink: 0, blinkLeft: 0, blinkRight: 0,
        relaxed: 0.2, happy: 0, eyeRoll: 0,
        //  Anime-Specific Blendshapes
        joy: 0, angry: 0, sorrow: 0, fun: 0, surprised: 0,
        blush: 0, smirk: 0, tongueOut: 0, pout: 0
    };

    private lerpSpeed: number = 6.0;

    //  SMOOTH TRANSITION WEIGHTS: Lerp between states instead of hard-cutting
    // smoothedIntentWeight: tracks how much the procedural look-at overrides the bone pose (0=none, high=strong)
    // smoothedSwayMultiplier: tracks how much organic torso noise is applied (1=idle, 0.05=action)
    private smoothedIntentWeight: number = 0.9;
    private smoothedSwayMultiplier: number = 1.0;


    // ---  DYNAMIC CINEMATIC EMOTION POOL (MOTION DRIVEN) ---
    // High-impact expressions with organic movement parameters
    private cinematicEmotionPool = [
        {
            aa: 0.95,
            oh: 0.30,
            blink: 0.12,   //  half-open sleepy look
            eyeRoll: -0.45,
            happy: 0.6,
            headTilt: 0.1,
            breathAmp: 0.05,
            tremble: 0.02
        },
        {
            aa: 0.85,
            oh: 0.40,
            blink: 0.15,   //  half-open sleepy look
            eyeRoll: -0.35,
            happy: 0.7,
            headTilt: -0.08,
            breathAmp: 0.06,
            tremble: 0.015
        },
        {
            aa: 1.0,
            oh: 0.20,
            blink: 0.10,   //  half-open sleepy look
            eyeRoll: -0.70,
            happy: 0.3,
            headTilt: 0.08,
            breathAmp: 0.07,
            tremble: 0.025
        }
    ];

    // ---  SOFT OVERWHELMED PHASE ---
    // Post-intensity drained expression
    private intenseAhegaoPool = [{
        aa: 1.0,        // Maximum vertical open
        ih: 0.6,        // Horizontal stretch for V-Shape
        oh: 0,
        blink: 0.22,    // Heavy/Nasheeli lids
        eyeRoll: -0.58, //  Safe deep iris roll up
        happy: 0.6,     // Intense blush/flush effect
        relaxed: 0.4,
        tremble: 0.05   // High intensity jitter
    }];

    //  Interaction Sequence Manager
    private interactionPhase: 'NONE' | 'INTRO' | 'LOOP' | 'OUTRO' = 'NONE';
    private interactionBaseName: string | null = null;
    private interactionTimer: number = 0;

    // ---  LipSync & SFX Instances ---
    public lipSync: LipSyncSystem;
    private timeAccumulator: number = 0;
    private currentSfx: HTMLAudioElement | null = null;
    private activeDecals: THREE.Mesh[] = [];

    // ---  Spring Bone Throttle (Performance Tier-Aware) ---
    // Accumulates delta so spring bones only update at the Hz appropriate for the current tier.
    // Tier 0=15Hz (~0.067s), Tier 1=20Hz (~0.05s), Tier 2=30Hz (~0.033s), Tier 3=60Hz (~0.016s)
    private springBoneAccumulator: number = 0;
    private static readonly SPRING_BONE_HZ = [15, 20, 30, 60] as const;

    // ---  Cinematic States ---
    private currentHeadTilt: number = 0;
    private currentTremble: number = 0;

    // --- References & Config ---

    constructor(model: VRM | THREE.Object3D, isAdult: boolean = false) {
        if ((model as any).isVRM || (model as any).expressionManager) {
            this.vrm = model as VRM;
        } else {
            this.vrm = null;
        }

        this.isAdultMode = isAdult;
        const scene = this.vrm ? this.vrm.scene : (model as THREE.Object3D);
        this.mixer = new THREE.AnimationMixer(scene);
        this.loader = new FBXLoader();
        this.lipSync = new LipSyncSystem();
        this.emotionDirector = new EmotionDirector();
        this.eyeOverrideLogic = new EyeOverrideLogic();

        // ─── Layer 3 boot ─────────────────────────────────────────────────
        if (this.vrm) {
            this.poseSystem = new PoseOverrideSystem(this.vrm);
            console.log(' PoseOverrideSystem initialized — Layer 3 active');
        }
        this.mixer.timeScale = 1.0;
        // this.initializeEyeBones(vrm.scene); // This function is not defined in the provided context.

        //  SSS Shader Hack (Ultra-Realism Skin)
        if (this.vrm) {
            this.vrm.scene.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh && obj.name.toLowerCase().includes("skin")) {
                    const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    if (material) {
                        material.roughness = 0.4;
                        material.metalness = 0.05;
                        material.emissive = new THREE.Color(0x220505);
                        material.emissiveIntensity = 0.2;
                    }
                }
            });
        }

        // Event listener for audio completionss boost for cinematic expressions
        if (this.vrm) {
            this.vrm.scene.traverse((obj: any) => {
                if (obj.material && obj.material.name?.toLowerCase().includes("mouth")) {
                    obj.material.roughness = 0.25;
                    obj.material.metalness = 0.1;
                }
            });
        }

        // Constructor ke andar ye line add kar:
        (window as any).currentVrm = this.vrm;
        (window as any).poseSystem = this.poseSystem;
        (window as any).currentController = this;

        // ---  DEPRECATION PREVENTION ---
        if (this.vrm && this.vrm.lookAt) {
            this.vrm.lookAt.autoUpdate = false;
        }

        console.log(" Controller Initialized - Single Instance Mode Active");

        // ---  MESH RECOVERY (Safety First) ---
        if (this.vrm) {
            this.vrm.scene.traverse((obj: any) => {
                if (obj.isMesh) {
                    obj.frustumCulled = false; // Disable culling
                    obj.visible = true;
                }
            });
        }

        //  Mouse Tracking for Head Movement (FIXED)
        //  FIX: Using bounded class method to prevent memory leak
        window.addEventListener('mousemove', this.handleMouseMove);

        // Save initial head & neck rotation so it doesn't snap
        if (this.vrm) {
            const head = this.vrm.humanoid?.getRawBoneNode('head');
            if (head) {
                this.headBaseQ.copy(head.quaternion);
            }
            const neck = this.vrm.humanoid?.getRawBoneNode('neck');
            if (neck) {
                this.neckBaseQ.copy(neck.quaternion);
            }
        }

        this.playAnimation("IDLE");

    }

    //  FIX: Bound class method for mouse movement
    private handleMouseMove = (e: MouseEvent) => {
        if (this.mousePos && e.buttons === 0) {
            this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
        }
    };

    /**
 *  applyFrontendTexture
 * Swaps textures directly on meshes. Supports user uploads of PNGs.
 */
    public async applyFrontendTexture(part: 'face' | 'body', url: string) {
        console.log(` Controller: Applying new ${part} texture from:`, url);
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync(url);

        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;

        if (!this.vrm) return;
        this.vrm.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh && obj.name.toLowerCase().includes(part)) {
                const mesh = obj as THREE.Mesh;
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                    mesh.material.map = texture;
                    mesh.material.needsUpdate = true;
                }
            }
        });
    }

    /**
     * toggleWardrobe
     * Simple mesh visibility toggle for single model
     */
    public toggleWardrobe() {
        if (!this.vrm) return;
        console.log(" Toggling Wardrobe Safely...");
        this.vrm.scene.traverse((obj: any) => {
            // Hum sirf 'Clothing' ya 'Outfit' meshes ko toggle karenge
            // 'Body' aur 'Face' hamesha visible rehne chahiye
            if (obj.isMesh && !obj.name.toLowerCase().includes("body") && !obj.name.toLowerCase().includes("face")) {
                obj.visible = !obj.visible;
            }
        });
    }

    /**
     * playSequence
     * Starts a strict 3-stage interaction sequence (1=Intro, 2=Loop, 3=Outro)
     */
    public playSequence(baseName: string) {
        console.log(` Interaction Sequence Start -> ${baseName}1`);
        this.interactionBaseName = baseName.toUpperCase();
        this.interactionPhase = 'INTRO';
        this.interactionTimer = 0;

        // Phase 1: Intro (THREE.LoopOnce)
        this.playAnimation(this.interactionBaseName + "1");
        if (this.currentAction) {
            this.currentAction.setLoop(THREE.LoopOnce, 1);
            this.currentAction.clampWhenFinished = true;
        }
    }

    /**
     * triggerEndAction
     * Triggers the final stage of the interaction sequence (Phase 3)
     */
    public triggerEndAction() {
        if (!this.interactionBaseName) return;

        console.log(` Interaction Sequence -> Phase 3 (OUTRO) [${this.interactionBaseName}3]`);
        this.interactionPhase = 'OUTRO';

        // Phase 3: Outro
        this.playAnimation(this.interactionBaseName + "3");
        if (this.currentAction) {
            this.currentAction.setLoop(THREE.LoopOnce, 1);
            this.currentAction.clampWhenFinished = true;
        }

        // After Phase 3 triggers, wait slight delay then trigger splatter
        setTimeout(() => {
            this.triggerFacialSplatter("/textures/splatter_white.png"); // Default splatter
        }, 1500);
    }

    /**
     * triggerFacialSplatter
     * Projects a decal texture onto the character's face
     */
    public triggerFacialSplatter(textureUrl: string) {
        if (!this.vrm) return;

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(textureUrl, (texture) => {
            // 1. Find the Face Mesh
            let faceMesh: THREE.SkinnedMesh | null = null;
            if (!this.vrm) return;
            this.vrm.scene.traverse((obj) => {
                if ((obj as THREE.SkinnedMesh).isSkinnedMesh && obj.name.toLowerCase().includes('face')) {
                    faceMesh = obj as THREE.SkinnedMesh;
                }
            });

            if (!faceMesh) {
                console.warn(" Facial Splatter: Could not find face mesh!");
                return;
            }

            // 2. Head Bone Ref for parenting
            if (!this.vrm) return;
            const headRaw = this.vrm.humanoid?.getRawBone('head');
            const headBone = headRaw?.node || this.vrm.scene.getObjectByName('Head') as THREE.Object3D;

            if (!headBone) {
                console.warn(" Facial Splatter: Could not find head bone!");
                return;
            }

            // 3. Project Decal
            // Position: Randomly around the mouth/nose area in local space
            const position = new THREE.Vector3(0, 0.05, 0.08); // Offset towards front of face
            const rotation = new THREE.Euler(0, 0, (Math.random() - 0.5) * 1);
            const size = new THREE.Vector3(0.12, 0.12, 0.12);

            const decalGeometry = new DecalGeometry(faceMesh, position, rotation, size);
            const decalMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                opacity: 0.95
            });

            const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
            decalMesh.name = "FacialSplatter";

            // Parent to head bone so it moves with animation!
            headBone.add(decalMesh);
            this.activeDecals.push(decalMesh);

            console.log(" Facial Splatter Applied to Head Bone");
        });
    }

    // Jab ADULT mode switch ho, purana instance isse saaf hoga
    public dispose() {
        console.log(" Disposing old controller & cleaning memory");

        //  FIX: Remove the global listener to prevent massive memory leaks on unmount/remount
        window.removeEventListener('mousemove', this.handleMouseMove);

        if (this.currentSfx) {
            this.currentSfx.pause();
            this.currentSfx.src = "";
            this.currentSfx = null;
        }

        if (this.lipSync) {
            try { (this.lipSync as any).stop?.(); } catch (e) { }
        }

        if (this.mixer) {
            this.mixer.stopAllAction();
            if (this.vrm) {
                this.mixer.uncacheRoot(this.vrm.scene);
            }
            this.mixer = null;
        }

        this.currentAction = null;
        this.animationCache.clear();
        this.activeDecals.forEach(d => {
            if (d.geometry) d.geometry.dispose();
            if (d.material) (d.material as THREE.Material).dispose();
        });
        this.activeDecals = [];
    }

    /**
     *  speak
     * Triggers the LipSync system to process TTS data.
     */
    public speak(audioBase64: string) {
        if (!this.lipSync) {
            console.error(" LipSync logic not initialized!");
            return;
        }
        this.lipSync.playAudioFromBase64(audioBase64);
    }

    /**
     *  extractAndMapAsteriskAction
     * Robust Regex engine to map natural language roleplay tags (*tilts head*)
     * to strict animation/emotion states.
     */



    public extractAndMapAsteriskAction(text: string) {
        if (!text) return;

        // 1. Regex Extraction
        const asteriskRegex = /\*(.*?)\*/g;
        const matches = [...text.matchAll(asteriskRegex)];
        if (matches.length === 0) return;

        const actionText = matches[matches.length - 1][1].toLowerCase();
        console.log(` Asterisk: "${actionText}"`);

        // ── LAYER 3: CHECK POSE SYSTEM FIRST ──────────────────────────────
        // PoseOverrideSystem maps natural language → bone override pose.
        // This runs INDEPENDENTLY of animation — both can fire simultaneously.
        const poseKey = asteriskToPose(actionText);
        if (poseKey && this.poseSystem) {
            console.log(` Pose Override: ${poseKey}`);
            this.poseSystem.activatePose(poseKey);
            // Don't return — still map to animation + emotion below
        }

        // ── LAYER 1: FBX ANIMATION MAPPING (unchanged) ────────────────────
        const mapping = [
            {
                keys: ['roll', 'eye', 'sigh', 'disgust', 'hiss', 'glare', 'scoff', 'angry', 'mad', 'frustrated', 'growl', 'snarl', 'annoyed'],
                anim: 'ANGER', emotion: 'ANGER'
            },
            {
                keys: ['tilt', 'think', 'wonder', 'curious', 'ponder', 'question', 'hmmm', 'interesting', 'studying', 'confused'],
                anim: 'FEMALETHINKING', emotion: 'CONFUSION'
            },
            {
                keys: ['blush', 'shy', 'nervous', 'look away', 'looks away', 'fidget', 'bashful', 'embarrassed', 'stutter', 'redden', 'shies'],
                anim: 'BASHFUL', emotion: 'SHY'
            },
            {
                keys: ['smile', 'giggle', 'warm', 'laugh', 'beam', 'happy', 'grin', 'softly', 'cheerful', 'chuckle'],
                anim: 'HAPPY', emotion: 'JOY'
            },
            {
                // Soft sad — hurt, frowning, looking down, general sadness
                keys: ['hurt', 'frown', 'look down', 'looks down', 'sad', 'miserable', 'melancholy', 'gloomy', 'downcast'],
                anim: 'SAD', emotion: 'SAD'
            },
            {
                // Full crying — active tears, sobbing, weeping
                keys: ['cry', 'crying', 'tear', 'sob', 'sobbing', 'weep', 'weeping', 'whimper', 'bawl', 'pout'],
                anim: 'CRYING', emotion: 'CRYING'
            },
            {
                // 'leans in' / 'lean in' → STEPPINGFORWARD animation
                keys: ['lean in', 'leans in', 'leans forward', 'steps closer', 'gets closer', 'moves closer'],
                anim: 'STEPPINGFORWARD', emotion: 'WARM'
            },
            {
                keys: ['bite lip', 'bites lip', 'seductive', 'sexy', 'desire', 'lust', 'hungry', 'suggestive', 'wink'],
                anim: 'SEXY', emotion: 'SEXUAL_DESIRE'
            },
            {
                keys: ['gasp', 'shock', 'surprise', 'wide eye', 'startled', 'whoa', 'jerk', 'steps back', 'step back'],
                anim: 'SURPRISE', emotion: 'SURPRISE'
            },
            {
                // Head shake → annoyed shake animation
                keys: ['shake', 'shakes', 'shaking', 'shakes head', 'no no', 'disagree'],
                anim: 'ANNOYED_SHAKE', emotion: 'ANNOYANCE'
            },
            {
                // Head nod → nod animation
                keys: ['nod', 'nods', 'nodding', 'agrees', 'nods head'],
                anim: 'NOD', emotion: 'SATISFACTION'
            },
            {
                keys: ['yawn', 'tired', 'sleepy'],
                anim: 'YAWN', emotion: 'CALMNESS'
            },
            {
                keys: ['wave', 'hello', 'hi', 'greet'],
                anim: 'WAVE', emotion: 'JOY'
            },
            {
                keys: ['drink', 'sip', 'sipping', 'drinking', 'takes a sip', 'takes a drink'],
                anim: 'DRINKING', emotion: 'CALMNESS'
            },
            {
                keys: ['search', 'look around', 'looks around', 'scanning', 'searching', 'glance around'],
                anim: 'LOOKINGAROUND', emotion: 'CONFUSION'
            },
            {
                keys: ['step forward', 'steps forward', 'move forward', 'walks forward', 'approach'],
                anim: 'STEPPINGFORWARD', emotion: 'NEUTRAL'
            },
            {
                keys: ['xbot', 'robot', 'mechanical'],
                anim: 'XBOT', emotion: 'NEUTRAL'
            }
        ];

        let foundAnim = 'IDLE';
        let foundEmotion = 'NEUTRAL';

        for (const entry of mapping) {
            if (entry.keys.some(k => actionText.includes(k))) {
                foundAnim = entry.anim;
                foundEmotion = entry.emotion;
                break;
            }
        }

        console.log(` Mapper: Result -> Anim: ${foundAnim}, Emotion: ${foundEmotion}`);
        this.playAnimation(foundAnim);
        this.emotionDirector.setEmotion(foundEmotion);
        useMoodStore.getState().setAction(foundAnim);
    }


    /**
     *  handleServerResponse
     * Processes backend action commands and audio streams.
     */
    public handleServerResponse(data: any) {
        console.log(" Received server instruction:", data);

        //  NEW: Check for Asterisk Actions in text or reply
        const textToScan = data.text || data.reply || "";
        if (textToScan && textToScan.includes("*")) {
            this.extractAndMapAsteriskAction(textToScan);
        }

        if (data.mascotAction) {
            this.currentBehavior = parseBehaviorTags(data.mascotAction);
            useMoodStore.getState().setAction(data.mascotAction);
            this.playAnimation(data.mascotAction);
        }

        // Agar action ke saath emotion bhi aayi hai toh apply karo
        const emotionIntent = data.emotion || data.mascotAction || "NEUTRAL";
        const stateChanged = this.emotionDirector.setEmotion(emotionIntent);

        //  ANIME PERSONA ENGINE: Trigger anime-specific facial blendshapes
        this.applyAnimePersonaFace(emotionIntent, 1.0);

        if (stateChanged && !this.isBlinking && (this.timeAccumulator - this.lastBlinkTime > 1.0)) {
            // Blink Sync: Force blink on major emotion/state transition to mask morph blending
            this.isBlinking = true;
            this.lastBlinkTime = this.timeAccumulator;
        }

        if (data.audioBase64) {
            this.playAudioData(data.audioBase64, data.isSFX || false);
        }
    }

    private playAudioData(base64: string, isLoopingSFX: boolean) {
        this.stopSfx();
        if (isLoopingSFX) {
            const audioSrc = "data:audio/mp3;base64," + base64;
            this.currentSfx = new Audio(audioSrc);
            this.currentSfx.loop = true;
            this.currentSfx.volume = 0.65;
            this.currentSfx.play().catch(e => console.error("Looping SFX Play Error:", e));

            if (this.vrm && this.vrm.expressionManager) {
                this.vrm.expressionManager.setValue('aa', 0.4);
                this.vrm.expressionManager.setValue('happy', 0.5);
            }
        } else {
            this.lipSync.playAudioFromBase64(base64);
        }
    }

    private stopSfx() {
        if (this.currentSfx) {
            console.log(" Ending Looping SFX Audio");
            this.currentSfx.pause();
            this.currentSfx.currentTime = 0;
            this.currentSfx = null;

            if (this.vrm && this.vrm.lookAt) {
                const applier = this.vrm.lookAt.applier as any;
                if (applier && applier.apply) {
                    applier.apply(new THREE.Euler(0, 0, 0));
                }
            }

            if (this.vrm && this.vrm.expressionManager) this.vrm.expressionManager.setValue('aa', 0);
        }
    }

    /**
     *  playCinematicKissAudio
     * Sequentially plays kiss SFX and then TTS dialogue.
     */
    public async playCinematicKissAudio(sfxBase64: string | null, ttsBase64: string | null, sfxDuration: number) {
        if (sfxBase64) {
            console.log(" Playing Cinematic Kiss SFX for", sfxDuration, "s");
            // Use playAudioData with SFX mode (loop=true is old logic, but we'll stop it after duration)
            this.playAudioData(sfxBase64, true);
            await new Promise(resolve => setTimeout(resolve, sfxDuration * 1000));
            this.stopSfx();
        }

        if (ttsBase64) {
            console.log(" Playing Cinematic TTS Dialogue");
            this.speak(ttsBase64);
        }
    }

    /**
     * applyCinematicFrame
     * Updates target state with dynamic motion parameters. The main update loop will LERP towards these targets.
     */
    private applyCinematicFrame(frame: CinematicFrame) {
        this.targetFaceState = {
            aa: frame.aa || 0,
            oh: frame.oh || 0,
            ih: frame.ih || 0,
            blink: frame.blink || 0,
            relaxed: 0.85,  //  heavy eyelids for half-eye effect
            happy: frame.happy || 0,
            eyeRoll: frame.eyeRoll || 0
        };

        this.currentHeadTilt = frame.headTilt || 0;
        this.currentTremble = frame.tremble || 0;
    }

    /**
     * applyFacialEmotion
     * Sets the target emotion through the EmotionDirector.
     */
    public applyFacialEmotion(emotion: string) {
        this.emotionDirector.setEmotion(emotion);
    }

    /**
     *  MASTER ANIME PERSONA ENGINE
     * Maps extreme psychological states to VRoid anime-specific blendshapes.
     * Supports 37+ persona archetypes (Yandere, Tsundere, Hajidere, etc.)
     */
    public applyAnimePersonaFace(emotionIntent: string, intensity: number = 1.0) {
        //  Reset all anime blendshapes first to prevent overlapping glitches
        this.targetFaceState.joy = 0;
        this.targetFaceState.angry = 0;
        this.targetFaceState.sorrow = 0;
        this.targetFaceState.fun = 0;
        this.targetFaceState.surprised = 0;
        this.targetFaceState.blush = 0;
        this.targetFaceState.smirk = 0;
        this.targetFaceState.tongueOut = 0;
        this.targetFaceState.pout = 0;

        const key = emotionIntent.toUpperCase();
        console.log(` Anime Persona Engine: Applying [${key}] at intensity ${intensity}`);

        switch (key) {
            // ---  YANDERE / SMUG ---
            case 'YANDERE':
            case 'YANDERE_STALKER':
            case 'SMUG':
            case 'POSSESSIVE':
            case 'COCKY':
                this.targetFaceState.smirk = 1.0 * intensity;
                this.targetFaceState.relaxed = 0.7 * intensity;
                this.targetFaceState.joy = 0.2 * intensity;
                break;

            // ---  TSUNDERE / ANGRY / POUT ---
            case 'TSUNDERE':
            case 'ANGRY':
            case 'ANGER':
            case 'ANNOYED':
            case 'CONTEMPT':
            case 'DISGUST':
                this.targetFaceState.angry = 0.6 * intensity;
                this.targetFaceState.pout = 1.0 * intensity;
                this.targetFaceState.blush = 0.5 * intensity;
                this.targetFaceState.eyeRoll = 0.2 * intensity;
                break;

            // ---  HAJIDERE / SHY ---
            case 'HAJIDERE':
            case 'SHY':
            case 'BASHFUL':
            case 'EMBARRASSED':
            case 'AWKWARDNESS':
                this.targetFaceState.blush = 1.0 * intensity;
                this.targetFaceState.sorrow = 0.5 * intensity;
                this.targetFaceState.eyeRoll = -0.15 * intensity;
                break;

            // ---  CRAVING / LUST / AHEGAO ---
            case 'CRAVING':
            case 'LUST':
            case 'SEXUAL_DESIRE':
            case 'AHEGAO':
                this.targetFaceState.tongueOut = 1.0 * intensity;
                this.targetFaceState.blush = 1.0 * intensity;
                this.targetFaceState.fun = 0.6 * intensity;
                this.targetFaceState.relaxed = 0.85 * intensity;
                this.targetFaceState.eyeRoll = -0.35 * intensity;
                this.targetFaceState.aa = 0.3 * intensity;
                break;

            // ---  AMADERE / JOY ---
            case 'AMADERE':
            case 'JOY':
            case 'HAPPY':
            case 'DEREDERE':
            case 'EXCITED':
            case 'AMUSEMENT':
                this.targetFaceState.joy = 1.0 * intensity;
                this.targetFaceState.fun = 0.5 * intensity;
                this.targetFaceState.blush = 0.4 * intensity;
                break;

            // ---  SAD (Light — melancholic, eyes cast down, soft expression) ---
            case 'SAD':
            case 'EMPATHIC_PAIN':
            case 'DISAPPOINTMENT':
                this.targetFaceState.sorrow = 0.55 * intensity;   // Soft sadness, not full breakdown
                this.targetFaceState.relaxed = 0.5 * intensity;   // Heavy-ish eyelids
                this.targetFaceState.eyeRoll = -0.15 * intensity; // Eyes slightly downcast
                this.targetFaceState.pout = 0.35 * intensity;     // Subtle lip trembling
                break;

            // ---  CRYING (Intense — full breakdown, trembling, scrunched, devastated) ---
            case 'CRYING':
            case 'CRY':
            case 'SOBBING':
            case 'SOB':
            case 'SADNESS':
            case 'GUILT':
            case 'TEARS':
                this.targetFaceState.sorrow = 1.0 * intensity;   // Maximum sorrow
                this.targetFaceState.relaxed = 0.85 * intensity; // Eyes almost shut from crying
                this.targetFaceState.eyeRoll = -0.3 * intensity; // Looking up/away in anguish
                this.targetFaceState.pout = 0.9 * intensity;     // Strong lip trembling
                this.targetFaceState.blush = 0.65 * intensity;   // Flushed face from crying
                this.currentTremble = 0.04 * intensity;          // Subtle body tremor
                break;

            // ---  SURPRISE ---
            case 'SURPRISE':
            case 'SURPRISED':
            case 'HORROR':
                this.targetFaceState.surprised = 1.0 * intensity;
                this.targetFaceState.aa = 0.4 * intensity;
                break;

            // ---  KUUDERE / CALM ---
            case 'KUUDERE':
            case 'CALMNESS':
            case 'NEUTRAL':
                this.targetFaceState.relaxed = 0.4 * intensity;
                break;

            // ---  DANDERE / ANXIOUS ---
            case 'DANDERE':
            case 'ANXIETY':
            case 'FEAR':
            case 'NERVOUS':
                this.targetFaceState.sorrow = 0.3 * intensity;
                this.targetFaceState.blush = 0.2 * intensity;
                this.targetFaceState.pout = 0.3 * intensity;
                break;

            default:
                // No specific persona mapping — leave at reset state
                break;
        }
    }

    // --- Legacy Triggers (for Controller Compatibility) ---
    activatePleasureFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 0.15 * intensity, ih: 0.1 * intensity, blink: 0.65 * intensity, happy: 0.7 * intensity });
    }
    activatePleasureFaceDynamic() { this.activatePleasureFace(1); }

    activateWildExcitedFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 0.8 * intensity, oh: 0.2 * intensity, happy: 0.9 * intensity, blink: 0.1 * intensity });
    }
    activateWildExcitedFaceDynamic() { this.activateWildExcitedFace(1); }

    activateOverwhelmedFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 0.95 * intensity, eyeRoll: -0.65 * intensity, happy: 0.65 * intensity, blink: 0.25 * intensity });
    }
    activateOverwhelmedFaceDynamic() { this.activateOverwhelmedFace(1); }

    activateSoftBreathFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 0.35 * intensity, blink: 0.3 * intensity, relaxed: 0.5 * intensity });
    }
    activateSoftBreathFaceDynamic() { this.activateSoftBreathFace(1); }

    activateFocusedTeaseFace(intensity: number = 1) {
        this.applyCinematicFrame({ ih: 0.3 * intensity, happy: 0.4 * intensity, blink: 0.15 * intensity });
    }
    activateFocusedTeaseFaceDynamic() { this.activateFocusedTeaseFace(1); }

    activateDramaticOpenMouthFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 1.0 * intensity, oh: 0.15 * intensity, happy: 0.3 * intensity });
    }

    activateDominantRoarFace(intensity: number = 1) {
        this.applyCinematicFrame({ aa: 1.0 * intensity, oh: 0.4 * intensity, happy: 0.2 * intensity });
    }
    activateDominantRoarFaceDynamic() { this.activateDominantRoarFace(1); }

    /**
     *  UNIFIED CONTINUOUS "ZINDA" UPDATE CHAIN
     * Replaces previous timer-based micro-behaviors with a persistent, noise-driven
     * biological update loop that layers over FBX poses.
     */
    update(delta: number) {
        if (!this.vrm || !this.mixer) return;

        // --- 1. CLOCK & ENGINE TICK ---
        this.mixer.update(delta);
        const elapsed = (this.timeAccumulator += delta);

        // --- 2. ZINDA LAYER: BONE NODE DEFINITIONS ---
        const humanoid = this.vrm.humanoid;
        if (!humanoid) return;

        const spine = humanoid.getRawBoneNode("spine");
        const chest = humanoid.getRawBoneNode("chest");
        const neck = humanoid.getRawBoneNode("neck") || humanoid.getNormalizedBoneNode("neck");
        const head = humanoid.getRawBoneNode("head");
        const leftShoulder = humanoid.getRawBoneNode("leftShoulder");
        const rightShoulder = humanoid.getRawBoneNode("rightShoulder");
        const leftEye = humanoid.getNormalizedBoneNode("leftEye");
        const rightEye = humanoid.getNormalizedBoneNode("rightEye");
        const jaw = humanoid.getRawBoneNode("jaw");

        // ======================================================================
        //  DYNAMIC AUTO-GROUNDING (Tera Delta Wala Rule)
        // Runs EVERY frame after mixer to keep feet on floor.
        // ======================================================================
        // ==========================================
        //  NATURAL GRAVITY / DYNAMIC GROUNDING (Fallback)
        // ==========================================
        // Mixer has set the animation, but we need to ensure basic root safety.
        // (Note: Hips adjustment removed in favor of mixamoFbx2motion offset)


        // --- 3. CONTEXTUAL FLAGS ---
        const currentAnim = this.currentActionName.toUpperCase();
        const emotionKey = this.currentBehavior?.emotionOverride || this.emotionDirector.getCurrentEmotion() || "NEUTRAL";
        const isAdult = this.isAdultMode && (
            ["BACKSHOT", "BLOWJOB", "MASTURBATE", "AHEGAO", "FRONT", "FRONT2", "FRONTSLOW"].some(a => currentAnim.includes(a))
            || this.currentActionName.toUpperCase().includes("KISS")
        );
        const isDancing = currentAnim.includes("DANCE") || useMoodStore.getState().isPlaying;

        // --- 4. CORE: PROCEDURAL TORSO SWAY & IRREGULAR BREATHING ---
        if (spine && chest) {
            // Irregular patterns based on emotion-driven damping (Anxiety/Fear = Fast, Sad = Heavy/Slow)
            let torsoFreq = 0.55, torsoAmp = 0.022; // Neutral Base: Long and Deep
            let chestFreq = 2.1, chestAmp = 0.012; // Breathing Layer

            if (emotionKey === "ANXIETY" || emotionKey === "FEAR" || isAdult) {
                torsoFreq = 1.75; torsoAmp = 0.016; // Fast, shallow, shaky
                chestFreq = 4.2; chestAmp = 0.009; // Intense panting
            } else if (emotionKey === "SAD" || emotionKey === "SADNESS") {
                torsoFreq = 0.3; torsoAmp = 0.038; // Heavy, slow gravitational sway
                chestFreq = 1.1; chestAmp = 0.018; // Deep, slow sighs
            } else if (emotionKey === "JOY" || emotionKey === "EXCITED") {
                torsoFreq = 1.35; torsoAmp = 0.024; // Bouncy, smoother sway
                chestFreq = 2.6; chestAmp = 0.014;
            }

            //  SMOOTH SWAY TRANSITION: Instead of instantly switching sway weight
            // when the animation changes, we lerp towards the target value over time.
            // This prevents the torso from "snapping" rigid/free on animation change.
            const isActuallyIdle = currentAnim === "IDLE" || currentAnim === "FEMINEIDLE" || currentAnim === "BREATHINGIDLE";
            const targetSwayMultiplier = isActuallyIdle ? 1.0 : 0.05;
            this.smoothedSwayMultiplier = THREE.MathUtils.lerp(
                this.smoothedSwayMultiplier,
                targetSwayMultiplier,
                delta * 3.5  // ~0.3s to fully transition — feels like clothing settling
            );

            //  Layer 3: PoseOverrideSystem scales fBm when a pose is active
            // (e.g. LEAN_IN sets idleScale=0.3 → sway drops to 30% of normal)
            const idleBlend = this.poseSystem?.idleScale ?? 1.0;

            const swayX = this.noise2D(elapsed * torsoFreq, 0) * (torsoAmp * this.smoothedSwayMultiplier * idleBlend);
            const swayZ = this.noise2D(0, elapsed * torsoFreq) * (torsoAmp * this.smoothedSwayMultiplier * idleBlend);
            const breath = this.noise2D(elapsed * chestFreq + 15, 15) * (chestAmp * this.smoothedSwayMultiplier * idleBlend);

            spine.rotation.x += swayX;
            spine.rotation.z += swayZ;
            chest.rotation.x += breath;

            if (leftShoulder && rightShoulder) {
                const sSway = this.noise2D(elapsed * torsoFreq, 30) * (torsoAmp * 0.45 * this.smoothedSwayMultiplier * idleBlend);
                leftShoulder.rotation.z += sSway;
                rightShoulder.rotation.z -= sSway;
            }
        }

        // --- 5. CONTINUOUS DAMPED GAZE & "EYE-LEAD" BLINK SYNC ---
        const lookAtPoint = this.eyeOverrideLogic.getEyeTarget();
        const gazeDamp = (emotionKey === "SAD" || emotionKey === "SADNESS") ? 0.65 : (emotionKey === "JOY" ? 0.18 : 0.32);

        // Target smoothing for gaze
        damp3(this.headLookTarget, lookAtPoint, gazeDamp, delta);

        // "Eye-Lead Rule": Biological trigger for blink on gaze shift with slight delay
        const gazeDelta = this.lastLookAtPoint.distanceTo(lookAtPoint);
        if (gazeDelta > 1.25 && !this.blinkPending && !this.isBlinking) {
            this.blinkPending = true;
            this.gazeChangeTime = elapsed;
        }

        if (this.blinkPending && (elapsed - this.gazeChangeTime > 0.12)) {
            this.isBlinking = true;
            this.lastBlinkTime = elapsed;
            this.blinkPending = false;
        }
        this.lastLookAtPoint.copy(lookAtPoint);

        // Continuous Anime Blinking Sequence
        if (elapsed - this.lastBlinkTime > (this.isBlinking ? 0.12 : 3.5 + Math.random() * 2.5)) {
            this.isBlinking = !this.isBlinking;
            this.lastBlinkTime = elapsed;
        }

        // --- 6. ADDITIVE BLENDING: LOOKAT OVERRIDE (HEAD/NECK) ---
        if (head && neck && !isAdult) {
            // 1. Capture Base Quat (from FBX pose)
            this.headBaseQ.copy(head.quaternion);
            this.neckBaseQ.copy(neck.quaternion);

            // 2. Procedural LookAt Intent
            const dummy = new THREE.Object3D();
            dummy.lookAt(this.headLookTarget);

            // Constraint: Prevent snapping by damping the procedural fraction independently
            const euler = new THREE.Euler().setFromQuaternion(dummy.quaternion, "YXZ");
            euler.x = THREE.MathUtils.clamp(euler.x, -0.45, 0.45);
            euler.y = THREE.MathUtils.clamp(euler.y, -0.75, 0.75);
            const targetProcQ = new THREE.Quaternion().setFromEuler(euler);

            //  SMOOTH INTENT TRANSITION: Instead of hard-cutting the look-at weight
            // when the animation changes, we lerp towards the target so the head
            // elegantly eases in/out of following the mouse across state shifts.
            const targetIntentWeight = isDancing ? 0.25 : (currentAnim === "IDLE" ? 0.9 : 0.6);
            this.smoothedIntentWeight = THREE.MathUtils.lerp(
                this.smoothedIntentWeight,
                targetIntentWeight,
                delta * 2.5  // ~0.4s blend — natural eye-focus settling speed
            );

            const headProc = new THREE.Quaternion().slerp(targetProcQ, this.smoothedIntentWeight);
            const neckProc = new THREE.Quaternion().slerp(targetProcQ, this.smoothedIntentWeight * 0.65);

            //  HEAD WHIP KILLER FIX: 
            // Pehle damping speed bahut fast thi (~0.16s), isliye tezi se mouse hilane par baal udate the.
            // Ab maine speed (0.8 aur 1.2) kar di hai. Ab agar tu mouse tezi se bhi hilayega, 
            // toh wo bilkul "Aaram se aur Elegantly" sir ghumayegi, jisse baalon pe force nahi padega!
            dampQ(this.currentProceduralNeckQ, neckProc, 0.8, delta);
            dampQ(this.currentProceduralHeadQ, headProc, 1.2, delta);

            // 3. Additive Multiplication Overlay
            neck.quaternion.copy(this.neckBaseQ).multiply(this.currentProceduralNeckQ);
            head.quaternion.copy(this.headBaseQ).multiply(this.currentProceduralHeadQ);

            // 4. Cinematic Head Tilt (Additive)
            if (this.currentHeadTilt !== 0) {
                const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, this.currentHeadTilt));
                neck.quaternion.multiply(tiltQ);
            }
        }

        // --- 7. ADVANCED MUSCLE TREMORS (50Hz) ---
        const intenseFactor = (this.emotionDirector.isIntenseState || isAdult) ? 1.0 : this.currentTremble;
        if (intenseFactor > 0) {
            const highFreqTremor = Math.sin(elapsed * 62.8) * 0.0055 * intenseFactor; // ~50Hz jitter
            if (jaw) jaw.rotation.x += highFreqTremor;
            if (neck) neck.rotation.z += highFreqTremor * 0.5;
        }

        // --- 8. EXPRESSION SMOOTHING & LIP-SYNC INTEGRATION ---
        if (this.vrm.expressionManager) {
            const expMan = this.vrm.expressionManager;

            // Level 1: Lip Sync (Audio/Music rhythm data)
            if (!this.currentSfx) {
                this.handleHybridLipSync(delta);
            }

            // Level 2: Emotion Directing (Smoothing targetFaceState)
            this.emotionDirector.update(delta, elapsed, this.vrm);

            // Level 3: Smooth Transitioning (damp3-like scalar lerping)
            const lerpFactor = Math.min(delta * this.lerpSpeed, 1.0);

            // Universal Expression Smoothing Loop (Now completely robust across models)
            const allKeys = new Set([
                ...Object.keys(this.targetFaceState),
                ...Object.keys((this.emotionDirector as any).currentTargets || {})
            ]);

            allKeys.forEach((key) => {
                let targetVal = key === "blink" ? (this.isBlinking ? 1 : 0) : (this.targetFaceState[key] || 0);

                const emotionTarget = (this.emotionDirector as any).currentTargets[key] || 0;
                if (emotionTarget > targetVal) {
                    targetVal = emotionTarget;
                }

                this.applyRobustBlendshape(expMan, key, targetVal, lerpFactor);
            });

            // LEVEL 4: ADULT OVERRIDES & INTENSE PRESETS
            if (isAdult) {
                expMan.setValue("aa", 1.0);
                expMan.setValue("blink", 0.15);
                expMan.setValue("angry", 0.35);
                if (leftEye && rightEye) {
                    leftEye.rotation.x = -0.28;  // Upward Eye-Roll
                    rightEye.rotation.x = -0.28;
                }
            }

            // Flush Surface Micro-Updates
            this.applySweatEffect(this.emotionDirector.isIntenseState || isAdult ? 0.8 : 0);

            expMan.update();
        }

        // --- 8b. LAYER 3: ADDITIVE POSE OVERRIDE (after fBm, before springBone) ─
        // Frame order is now guaranteed:
        //   mixer.update()       ← FBX sets base pose
        //   fBm sway (scaled)    ← organic noise adds on top
        //   poseSystem.update()  ← spring-damped intent deltas add on top
        //   springBoneManager    ← hair/bust physics — always last
        if (this.poseSystem) {
            this.poseSystem.update(delta);
        }

        // --- 8c. BONE SAFEGUARD (Anti-Exorcist Pass) ---
        // Final safety check to ensure that the combination of FBX + LookAt + Pose
        // doesn't rotate the neck or head into physically impossible angles.
        if (head && neck) {
            const headX = THREE.MathUtils.degToRad(60);
            const headY = THREE.MathUtils.degToRad(70);
            const headZ = THREE.MathUtils.degToRad(50);
            head.rotation.x = THREE.MathUtils.clamp(head.rotation.x, -headX, headX);
            head.rotation.y = THREE.MathUtils.clamp(head.rotation.y, -headY, headY);
            head.rotation.z = THREE.MathUtils.clamp(head.rotation.z, -headZ, headZ);

            const neckX = THREE.MathUtils.degToRad(45);
            const neckY = THREE.MathUtils.degToRad(55);
            const neckZ = THREE.MathUtils.degToRad(40);
            neck.rotation.x = THREE.MathUtils.clamp(neck.rotation.x, -neckX, neckX);
            neck.rotation.y = THREE.MathUtils.clamp(neck.rotation.y, -neckY, neckY);
            neck.rotation.z = THREE.MathUtils.clamp(neck.rotation.z, -neckZ, neckZ);
        }

        // --- 9. FINAL SYSTEM PASS (SpringBone Manager) — Tier-Throttled ---
        // We accumulate delta and only update spring bones at the Hz suited to the
        // current performance tier. This saves 15-30% CPU on low-end machines while
        // keeping spring bone motion smooth (physics is state-based, not frame-based).
        if (this.vrm.springBoneManager) {
            const tier = useMoodStore.getState().manualOverride ?? useMoodStore.getState().performanceTier;
            const targetHz = HumanAnimationController.SPRING_BONE_HZ[Math.max(0, Math.min(3, tier))];
            const minInterval = 1 / targetHz;

            this.springBoneAccumulator += delta;

            if (this.springBoneAccumulator >= minInterval) {
                // Clamp the delta to a maximum of 0.1 seconds (10 FPS equivalent)
                // This prevents physics explosions and "anti-gravity" glitches during heavy CPU loads.
                const subSteps = tier >= 2 ? 2 : 1;
                const safeDelta = Math.min(this.springBoneAccumulator, 0.1);
                const subDelta = safeDelta / subSteps;
                for (let i = 0; i < subSteps; i++) {
                    this.vrm.springBoneManager.update(subDelta);
                }
                this.springBoneAccumulator = 0;
            }
        }
    }

    /**
     * applyRobustBlendshape
     * Universal mapper that tries to apply an expression to a VRM model.
     * If the exact blendshape is missing, it intelligently falls back to synonymous shapes.
     * This guarantees emotions work perfectly on ANY custom user model (ARKit, VRoid, VRM 0.0/1.0).
     */
    private applyRobustBlendshape(expMan: any, key: string, targetVal: number, lerpFactor: number) {
        // Alias dictionary mapping ideal intents to fallback blendshapes
        const ALIASES: Record<string, string[]> = {
            // ARKit / High-Fidelity
            "smileFull": ["smileFull", "mouthSmile", "happy", "joy", "Fcl_ALL_Joy"],
            "eyesWide": ["eyesWide", "eyeWide", "surprised", "surprise", "Fcl_EYE_Surprised"],
            "eyesNarrow": ["eyesNarrow", "eyeSquint", "happy", "joy"],
            "browDown": ["browDown", "angry", "anger", "Fcl_ALL_Angry"],
            "browUp": ["browUp", "sad", "sorrow", "surprised"],
            "pout": ["pout", "mouthPout", "ou", "u", "angry"],
            "cheekPuff": ["cheekPuff", "cheekPuffLeft", "cheekPuffRight", "happy"],
            "mouthSmileLeft": ["mouthSmileLeft", "happy", "joy"],
            "mouthSmileRight": ["mouthSmileRight", "happy", "joy"],
            "browInnerUp": ["browInnerUp", "sad", "surprised"],
            "mouthFrownLeft": ["mouthFrownLeft", "sad", "angry"],
            "mouthFrownRight": ["mouthFrownRight", "sad", "angry"],
            "eyeBlinkLeft": ["eyeBlinkLeft", "blinkLeft", "blink_l", "blink"],
            "eyeBlinkRight": ["eyeBlinkRight", "blinkRight", "blink_r", "blink"],
            "jawOpen": ["jawOpen", "aa", "a", "surprised"],

            // Core VRM Variations
            "happy": ["happy", "joy", "Fcl_ALL_Joy", "Smile", "fun"],
            "joy": ["joy", "happy", "Fcl_ALL_Joy", "Smile", "fun"],
            "angry": ["angry", "anger", "Fcl_ALL_Angry", "Angry"],
            "sad": ["sad", "sorrow", "Fcl_ALL_Sorrow", "Sad"],
            "sorrow": ["sorrow", "sad", "Fcl_ALL_Sorrow", "Sad"],
            "surprised": ["surprised", "surprise", "Fcl_ALL_Surprised"],
            "fun": ["fun", "happy", "joy", "Fcl_ALL_Fun"],
            "relaxed": ["relaxed", "neutral", "happy", "joy"],

            // Lip Sync / Vowels
            "aa": ["aa", "a", "Fcl_MTH_A", "A", "ah"],
            "ih": ["ih", "i", "Fcl_MTH_I", "I", "ee"],
            "ou": ["ou", "u", "Fcl_MTH_U", "U", "oo"],
            "ee": ["ee", "e", "Fcl_MTH_E", "E", "eh"],
            "oh": ["oh", "o", "Fcl_MTH_O", "O"],

            // Core features
            "blink": ["blink", "Fcl_EYE_Close", "Blink"],
            "blinkLeft": ["blinkLeft", "blink_l", "Fcl_EYE_Close_L"],
            "blinkRight": ["blinkRight", "blink_r", "Fcl_EYE_Close_R"],
            "neutral": ["neutral", "Neutral", "Fcl_ALL_Neutral"]
        };

        const keysToTry = ALIASES[key] || [key];

        for (const k of keysToTry) {
            try {
                const currentVal = expMan.getValue(k);
                if (currentVal !== null && currentVal !== undefined) {
                    expMan.setValue(k, THREE.MathUtils.lerp(currentVal, targetVal, lerpFactor));
                    // Stop checking fallbacks once we found a working blendshape!
                    return;
                }
            } catch {
                // Safely ignore if a specific blendshape crashes
            }
        }
    }

    /**
     * handleHybridLipSync
     * Controls the mouth based on both real TTS audio and Spotify rhythm data.
     */
    handleHybridLipSync(delta: number) {
        if (!this.vrm || !this.vrm.expressionManager) return;

        // Level 1 Priority: TTS Speech
        if (this.lipSync.isPlaying) {
            const visemes = this.lipSync.getVowelValues();

            //  THE FIX: Scale down the intensity of mouth opening!
            const talkScale = 0.45;

            this.targetFaceState.aa = (visemes.vowelA || 0) * talkScale;
            this.targetFaceState.ih = (visemes.vowelI || 0) * (talkScale * 1.2);
            this.targetFaceState.ou = (visemes.vowelU || 0) * (talkScale * 0.8);

            if ((visemes as any).vowelO !== undefined) {
                this.targetFaceState.oh = (visemes as any).vowelO * (talkScale * 0.7);
            } else {
                this.targetFaceState.oh = 0;
            }

            if ((visemes as any).vowelE !== undefined) {
                this.targetFaceState.ih = Math.max(this.targetFaceState.ih, (visemes as any).vowelE * talkScale);
            }

            return;
        }

        // Level 2 Priority: Spotify Singing Sync
        const mood = useMoodStore.getState();
        if (mood.isSpotifyConnected && mood.isPlaying) {
            const beatFreq = (mood.bpm || 105 / 60) * Math.PI * 2;
            const beatPulse = (Math.sin(this.timeAccumulator * beatFreq) + 1) / 2;
            const trackEnergy = mood.energy || 0.55;

            this.targetFaceState.aa = trackEnergy > 0.75 ? beatPulse * 0.6 : beatPulse * 0.35;
            return;
        }

        // Level 3 Priority: Reset to Closed Mouth
        this.targetFaceState.aa = 0;
        this.targetFaceState.ih = 0;
        this.targetFaceState.ou = 0;
        this.targetFaceState.oh = 0;
    }

    /**
     * playAnimation
     * Logic for loading and playing FBX animations with seamless cross-fading.
     * @param actionKey Logical UPPERCASE action name
     */
    async playAnimation(actionKey: string) {
        if (!this.vrm || !this.mixer) return;

        const normalizedKey = actionKey.toUpperCase();
        this.vrm.scene.traverse(o => { if ((o as any).isMesh) o.visible = true; });

        const path = HumanAnimationController.ANIMATION_MAP[normalizedKey] || "/animations/femineidle.fbx";
        const isLoop = !["YAWN", "BLOWKISS", "NORMALKISS", "HUGGINGKISS", "WAVE", "CLAPPING", "CHEERING", "THANKFUL"].includes(normalizedKey);

        console.log(` Playback Engine: Resolved [${normalizedKey}] -> [${path}] (Loop: ${isLoop})`);

        try {
            let clip = this.animationCache.get(path);

            if (!clip) {
                // If it's already loading, wait for the pending promise instead of triggering another FBX Loader!
                if (this.pendingAnimations.has(path)) {
                    console.log(` Promise Cache Hit: Waiting for pending FBX load -> ${path}`);
                    const awaitedClip = await this.pendingAnimations.get(path);
                    if (awaitedClip) clip = awaitedClip;
                } else {
                    console.log(` Cache Miss: Loading from source -> ${path}`);

                    const loadPromise = (async () => {
                        try {
                            const fbx = await this.loader.loadAsync(path);
                            const converted = mixamoFbx2motion(fbx, this.vrm!, this.isReversedModel);
                            if (converted) {
                                this.animationCache.set(path, converted);
                                return converted;
                            }
                        } catch (e) {
                            console.error("FBX Load Failed:", e);
                        } finally {
                            this.pendingAnimations.delete(path);
                        }
                        return null;
                    })();

                    this.pendingAnimations.set(path, loadPromise);
                    const awaitedClip = await loadPromise;
                    if (awaitedClip) clip = awaitedClip;
                }
            }

            if (clip) {
                const action = this.mixer.clipAction(clip);
                const prevAction = this.currentAction;

                if (prevAction && prevAction.getClip() === clip && isLoop) return;

                action.reset();

                //  WuWa WEIGHT HACK: Active animations play at 0.85x to feel physically heavy.
                // IDLE stays at 1.0 so breathing looks natural and not sluggish.
                const isActiveAction = normalizedKey !== "IDLE" && normalizedKey !== "FEMINEIDLE";
                action.setEffectiveTimeScale(isActiveAction ? 0.85 : 1.0);

                action.setEffectiveWeight(1);
                action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
                action.clampWhenFinished = !isLoop;

                //  SMOOTH CROSSFADE: fadeOut old + fadeIn new is smoother than crossFadeFrom
                // crossFadeFrom can cause a snap if the prev action is already at weight < 1.
                // 0.8s gives a more organic blend — feels like real momentum and weight.
                const fadeTime = 0.8;
                if (prevAction) {
                    prevAction.fadeOut(fadeTime);
                    action.fadeIn(fadeTime);
                } else {
                    action.fadeIn(fadeTime);
                }

                action.play();
                this.currentAction = action;
                this.currentActionName = actionKey;
                useMoodStore.getState().setAction(actionKey);

                // Auto-return to IDLE for one-shots.
                // Account for 0.85x timeScale so the timeout matches real playback duration.
                if (!isLoop) {
                    const realDuration = clip.duration * 1000 * (1 / 0.85);
                    const returnTime = Math.max(realDuration - (fadeTime * 1000), 500);
                    setTimeout(() => {
                        if (this.currentActionName === actionKey) {
                            this.playAnimation("IDLE");
                        }
                    }, returnTime);
                }
            }
        } catch (error) {
            console.error(` Playback Error [${actionKey}]:`, error);
            if (actionKey !== "IDLE") this.playAnimation("IDLE");
        }
    }


    //  Wet Skin Effect (Glossy, not glowing)
    // Wet skin drops roughness so light reflects more sharply — no texture needed.
    //  Wet Skin Effect (Glossy, not glowing)
    // Wet skin drops roughness so light reflects more sharply — no texture needed.
    private applySweatEffect(intensity: number = 1) {
        if (!this.vrm) return;
        this.vrm.scene.traverse((obj: any) => {
            if (obj.isMesh && obj.name.toLowerCase().includes("face") && obj.material) {
                // Guard: some VRM materials have userData as undefined
                if (!obj.material.userData) obj.material.userData = {};
                // Cache original roughness on first call so we can lerp back to it
                if (obj.material.userData.originalRoughness === undefined) {
                    obj.material.userData.originalRoughness = obj.material.roughness ?? 0.4;
                }
                const baseRoughness = obj.material.userData.originalRoughness;
                // At intensity=1 roughness drops by 0.2 (shiny wet look)
                // At intensity=0 roughness returns to original (dry skin)
                const targetRoughness = baseRoughness - (0.2 * intensity);
                obj.material.roughness = THREE.MathUtils.lerp(obj.material.roughness, targetRoughness, 0.1);
            }
        });
    }

    /**
     *  applyFluidPhysics — Real-Hair Physics Engine v2
     *
     * KEY PHYSICS PRINCIPLES:
     * - Stiffness ≈ 0 almost everywhere. Real hair has near-zero stiffness.
     *   Stiffness > 0.1 causes the "Medusa floaty" effect.
     * - dragForce is what makes hair SETTLE. High drag = silky. Low drag = floaty.
     * - gravityPower controls how much the strand hangs downward.
     *   Tips need more gravity to counter spring bounce.
     * - Per-strand NOISE: slight random variance between strands prevents
     *   all hair moving in perfect lockstep (the dead-wig effect).
     * - springBoneManager.update() delta must be CLAMPED to 1/30s max
     *   (already done in SceneContent.useFrame via safeDelta).
     */
    public static applyFluidPhysics(vrm: VRM): void {
        const manager = (vrm as any).springBoneManager;
        if (!manager) return;

        // _sortedJoints is a pre-sorted Array; _joints is a Set — handle both
        const rawJoints = (manager as any)._sortedJoints
            ?? Array.from((manager as any)._joints ?? new Set());
        const joints: any[] = Array.isArray(rawJoints) ? rawJoints : Array.from(rawJoints);

        joints.forEach((joint: any) => {
            const node: THREE.Object3D = joint.bone ?? joint.node;
            if (!node) return;
            const name = (node.name ?? '').toLowerCase();

            // ── HAIR ─────────────────────────────────────────────────────────────
            if (name.includes('j_sec_hair') || name.includes('hair')) {
                if (joint.settings) {
                    //  STIFF HAIR: High stiffness → hair returns to resting position fast
                    // No air movement — hair only follows head, doesn't swing freely
                    joint.settings.stiffness = 0.5;  // moderate spring-back — moves less freely
                    joint.settings.dragForce = 0.95; // heavy damping — swings die quickly
                    joint.settings.gravityPower = 50;
                    joint.settings.gravityDir = new THREE.Vector3(0, -1, 0);
                    joint.settings.hitRadius = 0.02;
                }
            }
            // ── BUST ─────────────────────────────────────────────────────────────
            else if (name.includes('bust') || name.includes('j_sec_l_bust') || name.includes('j_sec_r_bust')) {
                if (joint.settings) {
                    joint.settings.stiffness = 0.22;
                    joint.settings.dragForce = 0.90;
                    joint.settings.gravityPower = 0.45;
                    joint.settings.gravityDir = new THREE.Vector3(0, -1, 0);
                    joint.settings.hitRadius = 0.04;
                }
            }
            // ── SKIRT / DRESS ─────────────────────────────────────────────────────
            else if (name.includes('skirt') || name.includes('dress') || name.includes('j_sec_skirt')) {
                if (joint.settings) {
                    joint.settings.stiffness = 0.08;
                    joint.settings.dragForce = 0.88;
                    joint.settings.gravityPower = 0.35;
                    joint.settings.gravityDir = new THREE.Vector3(0, -1, 0);
                    joint.settings.hitRadius = 0.03;
                }
            }
        });

        console.log(` Fluid physics applied to ${joints.length} joints (Unfrozen).`);
    }
}

