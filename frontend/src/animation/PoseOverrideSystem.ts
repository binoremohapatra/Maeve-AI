import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────
//  PoseOverrideSystem.ts
//  Additive Pose Layer — sits ON TOP of FBX + fBm procedural
//  Handles asterisk action bone targets with spring-damped blending
//  so transitions feel physical, not snapped.
//
//  Architecture:
//    FBX mixer sets base pose  →  fBm adds organic noise  →  THIS adds intent
//
//  Key design: every pose is a SET OF BONE TARGETS with a blend weight.
//  The weight spring-damps toward 1.0 on activation, 0.0 on deactivation.
//  This means ANY mid-pose interruption (new asterisk arrives) gracefully
//  cross-fades rather than snapping.
// ─────────────────────────────────────────────────────────────────────────

// ─── TYPES ────────────────────────────────────────────────────────────────

// A single bone's rotation target in ADDITIVE local euler space.
// Values are DELTAS from the bone's current pose — not absolute rotations.
// This is critical: absolute rotations fight FBX, deltas layer on top.
interface BoneTarget {
  bone:     string;          // VRM humanoid bone name
  x?:       number;          // additive rotation delta in radians
  y?:       number;
  z?:       number;
  // Per-bone spring override (optional — falls back to pose defaults)
  stiffness?: number;
  damping?:   number;
}

// A complete pose definition
interface PoseDef {
  bones:       BoneTarget[];
  // How fast this pose blends IN (higher = snappier)
  inStiffness:  number;
  inDamping:    number;
  // How fast this pose blends OUT when released
  outStiffness: number;
  outDamping:   number;
  // Seconds before auto-releasing (undefined = hold until manually released)
  holdTime?:    number;
  // Scale organic idle during this pose (0 = suppress sway, 1 = full sway)
  idleScale:    number;
}

// Runtime state per active bone within a pose
interface BoneSpring {
  bone:   string;
  tx: number; ty: number; tz: number;  // targets
  cx: number; cy: number; cz: number;  // current values
  vx: number; vy: number; vz: number;  // velocities
}

// ─── POSE LIBRARY ────────────────────────────────────────────────────────
// All rotations in radians. Positive X = forward lean, positive Z = right tilt.
// These are ADDITIVE deltas — 0.0 means "no change from FBX base".
//
// Tuning guide:
//   spine.x  > 0  = lean forward,  < 0 = lean back
//   spine.z  > 0  = tilt right,    < 0 = tilt left
//   neck.x   > 0  = look down,     < 0 = look up (chin up)
//   head.z   > 0  = tilt right,    < 0 = tilt left
//   chest.x  > 0  = hunch forward
// ─────────────────────────────────────────────────────────────────────────

export const POSE_LIBRARY: Record<string, PoseDef> = {

  // ── LEAN IN ─────────────────────────────────────────────────────────
  // Character leans toward user — intimate proximity signal
  // Spine tips forward, neck extends, head tilts slightly down
  LEAN_IN: {
    bones: [
      { bone: 'spine',      x:  0.18, z:  0.00 },
      { bone: 'chest',      x:  0.12 },
      { bone: 'upperChest', x:  0.08 },
      { bone: 'neck',       x: -0.06 },  // chin slightly up while leaning
      { bone: 'head',       x:  0.04 },
    ],
    inStiffness: 14, inDamping: 6,
    outStiffness: 8, outDamping: 5,
    idleScale: 0.3,   // reduce sway while leaning — feels intentional
  },

  // ── HEAD TILT ────────────────────────────────────────────────────────
  // Classic curious/listening tilt — head and neck tilt right
  HEAD_TILT: {
    bones: [
      { bone: 'neck', z: -0.14 },
      { bone: 'head', z: -0.18, x: -0.02 },
    ],
    inStiffness: 20, inDamping: 7,
    outStiffness: 10, outDamping: 5,
    holdTime: 3.5,    // auto-release after 3.5s
    idleScale: 0.7,
  },

  // ── LOOK AWAY ────────────────────────────────────────────────────────
  // Avoidance signal — neck and head turn to the side
  LOOK_AWAY: {
    bones: [
      { bone: 'neck', y:  0.35 },
      { bone: 'head', y:  0.25, z: -0.06 },
    ],
    inStiffness: 12, inDamping: 5,
    outStiffness: 7, outDamping: 4,
    holdTime: 2.5,
    idleScale: 0.8,
  },

  // ── SHY / LOOK DOWN ──────────────────────────────────────────────────
  // Head drops, slight forward hunch — vulnerable body language
  LOOK_DOWN: {
    bones: [
      { bone: 'spine',      x:  0.06 },
      { bone: 'chest',      x:  0.04 },
      { bone: 'neck',       x:  0.18 },
      { bone: 'head',       x:  0.14, z: -0.08 },
    ],
    inStiffness: 10, inDamping: 5,
    outStiffness: 6, outDamping: 4,
    idleScale: 0.5,
  },

  // ── PUFF CHEST / PRIDE ───────────────────────────────────────────────
  // Chest expands, spine straightens — confidence posture
  CHEST_OUT: {
    bones: [
      { bone: 'spine',      x: -0.08 },  // lean back slightly
      { bone: 'chest',      x: -0.12 },  // chest puffs
      { bone: 'upperChest', x: -0.06 },
      { bone: 'neck',       x:  0.04 },  // chin slightly down
    ],
    inStiffness: 16, inDamping: 7,
    outStiffness: 8, outDamping: 5,
    idleScale: 0.4,
  },

  // ── HUNCH / GUILT / DEFEATED ─────────────────────────────────────────
  // Full forward hunch — submissive/sad body language
  HUNCH: {
    bones: [
      { bone: 'spine',      x:  0.22 },
      { bone: 'chest',      x:  0.16 },
      { bone: 'upperChest', x:  0.10 },
      { bone: 'neck',       x:  0.20 },
      { bone: 'head',       x:  0.08 },
      { bone: 'leftShoulder',  z: -0.12 },
      { bone: 'rightShoulder', z:  0.12 },
    ],
    inStiffness: 8, inDamping: 5,
    outStiffness: 5, outDamping: 4,
    idleScale: 0.2,
  },

  // ── SHAKE HEAD NO ────────────────────────────────────────────────────
  // Horizontal head shake — disagreement
  // Note: actual oscillation is handled separately via the shakeTimer
  SHAKE_NO: {
    bones: [
      { bone: 'neck', y: 0.0 },  // base — oscillation added in update()
      { bone: 'head', y: 0.0 },
    ],
    inStiffness: 25, inDamping: 8,
    outStiffness: 12, outDamping: 6,
    holdTime: 1.8,
    idleScale: 0.1,
  },

  // ── NOD YES ──────────────────────────────────────────────────────────
  // Vertical head nod — agreement
  NOD_YES: {
    bones: [
      { bone: 'neck', x: 0.0 },  // oscillation added in update()
      { bone: 'head', x: 0.0 },
    ],
    inStiffness: 25, inDamping: 8,
    outStiffness: 12, outDamping: 6,
    holdTime: 1.5,
    idleScale: 0.1,
  },

  // ── STEP BACK / FEAR ─────────────────────────────────────────────────
  // Spine jerks back — startle response
  STEP_BACK: {
    bones: [
      { bone: 'spine',      x: -0.20 },
      { bone: 'chest',      x: -0.14 },
      { bone: 'neck',       x: -0.10 },
      { bone: 'head',       x: -0.06 },
    ],
    inStiffness: 35, inDamping: 6,   // fast snap in — startle is instant
    outStiffness: 5,  outDamping: 4, // slow ease out — recovery
    holdTime: 0.8,
    idleScale: 0.0,
  },

  // ── BITE LIP / SEDUCTIVE ─────────────────────────────────────────────
  // Subtle: slight forward tilt, chin slightly down — intense gaze pose
  BITE_LIP: {
    bones: [
      { bone: 'neck', x:  0.08, z: -0.04 },
      { bone: 'head', x:  0.06, z: -0.06 },
    ],
    inStiffness: 12, inDamping: 5,
    outStiffness: 6, outDamping: 4,
    idleScale: 0.6,
  },

  // ── SMIRK / COCKY ────────────────────────────────────────────────────
  // Head slightly back and tilted — superiority pose
  SMIRK: {
    bones: [
      { bone: 'spine', x: -0.05 },
      { bone: 'neck',  x: -0.08, z: -0.08 },
      { bone: 'head',  x: -0.06, z: -0.10 },
    ],
    inStiffness: 14, inDamping: 6,
    outStiffness: 7, outDamping: 4,
    idleScale: 0.5,
  },

  // ── IDLE (explicit return to neutral) ────────────────────────────────
  IDLE: {
    bones: [],        // no targets — just smoothly zeroes everything out
    inStiffness: 6, inDamping: 4,
    outStiffness: 6, outDamping: 4,
    idleScale: 1.0,
  },
};

// ─── ASTERISK TEXT → POSE MAPPING ────────────────────────────────────────
// Maps natural language asterisk actions to pose keys.
// Called by extractAndMapAsteriskAction in HumanAnimationController.
// ─────────────────────────────────────────────────────────────────────────

const ASTERISK_MAP: Array<{ keys: string[]; pose: string }> = [
  { keys: ['lean in', 'leans in', 'leans forward', 'moves closer', 'leans closer'],
    pose: 'LEAN_IN' },
  { keys: ['tilt', 'tilts head', 'tilts her head', 'curious', 'head tilt'],
    pose: 'HEAD_TILT' },
  { keys: ['look away', 'looks away', 'glances away', 'averts', 'turn away'],
    pose: 'LOOK_AWAY' },
  { keys: ['look down', 'looks down', 'glances down', 'shy', 'bashful', 'fidget'],
    pose: 'LOOK_DOWN' },
  { keys: ['puff', 'chest out', 'stands tall', 'straightens', 'proud', 'confident'],
    pose: 'CHEST_OUT' },
  { keys: ['hunch', 'slumps', 'deflates', 'shoulders drop', 'guilt', 'defeated'],
    pose: 'HUNCH' },
  { keys: ['shake', 'shakes head', 'shakes her head', 'no no', 'disagree'],
    pose: 'SHAKE_NO' },
  { keys: ['nod', 'nods', 'agrees', 'nods head', 'yes'],
    pose: 'NOD_YES' },
  { keys: ['step back', 'steps back', 'jumps back', 'flinch', 'startled', 'recoil'],
    pose: 'STEP_BACK' },
  { keys: ['bite lip', 'bites lip', 'smirk', 'seductive', 'sly', 'wink'],
    pose: 'BITE_LIP' },
  { keys: ['cocky', 'smug', 'rolls eyes', 'scoffs', 'superior'],
    pose: 'SMIRK' },
];

export function asteriskToPose(actionText: string): string | null {
  const lower = actionText.toLowerCase();
  for (const entry of ASTERISK_MAP) {
    if (entry.keys.some(k => lower.includes(k))) {
      return entry.pose;
    }
  }
  return null;
}

// ─── POSE OVERRIDE SYSTEM CLASS ──────────────────────────────────────────

export class PoseOverrideSystem {
  private vrm:          any;
  private activePose:   string | null  = null;
  private poseWeight:   number         = 0;    // 0 = fully out, 1 = fully in
  private weightVel:    number         = 0;
  private springs:      BoneSpring[]   = [];
  private elapsed:      number         = 0;
  private poseStart:    number         = 0;
  private shakeTimer:   number         = 0;    // for NOD/SHAKE oscillation

  // Exposed so HumanAnimationController can scale its fBm amplitude
  public  idleScale:    number         = 1.0;

  constructor(vrm: any) {
    this.vrm = vrm;
  }

  // ── PUBLIC: activate a pose by key ──────────────────────────────────
  public activatePose(poseKey: string): void {
    const def = POSE_LIBRARY[poseKey];
    if (!def) return;

    // If same pose — ignore (already playing)
    if (this.activePose === poseKey && this.poseWeight > 0.5) return;

    this.activePose = poseKey;
    this.poseStart  = this.elapsed;
    this.shakeTimer = 0;

    // Build spring states for each bone target
    this.springs = def.bones.map(bt => ({
      bone: bt.bone,
      tx: bt.x ?? 0, ty: bt.y ?? 0, tz: bt.z ?? 0,
      cx: 0,          cy: 0,          cz: 0,
      vx: 0,          vy: 0,          vz: 0,
    }));
  }

  // ── PUBLIC: release current pose (smooth return to neutral) ─────────
  public releasePose(): void {
    this.activePose = null;
    // Springs will naturally decay to 0 when targets are 0
    this.springs.forEach(s => { s.tx = 0; s.ty = 0; s.tz = 0; });
  }

  // ── PUBLIC: called every frame from HumanAnimationController.update() ──
  public update(delta: number): void {
    if (!this.vrm) return;

    const dt = Math.min(delta, 1 / 30);
    this.elapsed += dt;

    const def      = this.activePose ? POSE_LIBRARY[this.activePose] : null;
    const isActive = this.activePose !== null;

    // ── Auto-release after holdTime ─────────────────────────────────
    if (def?.holdTime && (this.elapsed - this.poseStart) >= def.holdTime) {
      this.releasePose();
    }

    // ── Global weight spring ─────────────────────────────────────────
    // This single weight multiplies ALL bone springs — so interrupting
    // a pose mid-blend fades everything out together, not bone by bone
    const targetWeight = isActive ? 1.0 : 0.0;
    const K = def ? def.inStiffness  : 6;
    const D = def ? def.inDamping    : 4;
    const accel = K * (targetWeight - this.poseWeight) - D * this.weightVel;
    this.weightVel   += accel * dt;
    this.poseWeight  += this.weightVel * dt;
    this.poseWeight   = THREE.MathUtils.clamp(this.poseWeight, 0, 1);

    // Update idleScale for HumanAnimationController to read
    this.idleScale = THREE.MathUtils.lerp(1.0, def?.idleScale ?? 1.0, this.poseWeight);

    // ── NOD / SHAKE oscillation ──────────────────────────────────────
    // These poses need temporal oscillation on top of the spring targets
    let shakeDeltaY = 0, nodDeltaX = 0;
    if (this.activePose === 'SHAKE_NO') {
      this.shakeTimer += dt;
      // 4Hz oscillation, amplitude fades as holdTime approaches
      const timeLeft = Math.max(0, (def!.holdTime! - (this.elapsed - this.poseStart)));
      const fadeFactor = Math.min(timeLeft * 2, 1.0);
      shakeDeltaY = Math.sin(this.shakeTimer * Math.PI * 2 * 4) * 0.25 * fadeFactor;
    }
    if (this.activePose === 'NOD_YES') {
      this.shakeTimer += dt;
      const timeLeft = Math.max(0, (def!.holdTime! - (this.elapsed - this.poseStart)));
      const fadeFactor = Math.min(timeLeft * 2, 1.0);
      nodDeltaX = Math.abs(Math.sin(this.shakeTimer * Math.PI * 2 * 3.5)) * 0.22 * fadeFactor;
    }

    // ── Apply each bone spring ───────────────────────────────────────
    const humanoid = this.vrm?.humanoid;
    if (!humanoid || this.poseWeight < 0.001) {
      // Even when weight is negligible, keep idleScale returning to 1
      if (this.poseWeight < 0.001 && !this.activePose) {
        this.idleScale = 1.0;
        this.springs   = [];
      }
      return;
    }

    for (const s of this.springs) {
      const boneNode = humanoid.getRawBoneNode(s.bone) ??
                       humanoid.getNormalizedBoneNode(s.bone);
      if (!boneNode) continue;

      // Step spring toward target
      const stepAxis = (
        current: number, vel: number, target: number
      ): [number, number] => {
        const bK = def?.inStiffness ?? 14;
        const bD = def?.inDamping   ?? 6;
        const a  = bK * (target - current) - bD * vel;
        const nv = vel     + a   * dt;
        const nc = current + nv  * dt;
        return [nc, nv];
      };

      // X axis
      const extraX = s.bone === 'neck' ? nodDeltaX : s.bone === 'head' ? nodDeltaX * 0.7 : 0;
      [s.cx, s.vx] = stepAxis(s.cx, s.vx, s.tx + extraX);

      // Y axis (shake delta applies here)
      const extraY = s.bone === 'neck' ? shakeDeltaY : s.bone === 'head' ? shakeDeltaY * 0.6 : 0;
      [s.cy, s.vy] = stepAxis(s.cy, s.vy, s.ty + extraY);

      // Z axis
      [s.cz, s.vz] = stepAxis(s.cz, s.vz, s.tz);

      // ADDITIVE application — this is the KEY difference vs absolute set
      // We ADD to whatever FBX + fBm has already set this frame
      boneNode.rotation.x += s.cx * this.poseWeight;
      boneNode.rotation.y += s.cy * this.poseWeight;
      boneNode.rotation.z += s.cz * this.poseWeight;

      //  ANTI-BRAZIL / ANTI-EXORCIST FIX: 
      // Clamp specific bones to human limits to prevent 360-degree neck breaks.
      if (s.bone === 'head' || s.bone === 'neck') {
        const limitX = THREE.MathUtils.degToRad(50); // Up/Down
        const limitY = THREE.MathUtils.degToRad(60); // Left/Right turn
        const limitZ = THREE.MathUtils.degToRad(45); // Side tilt
        
        boneNode.rotation.x = THREE.MathUtils.clamp(boneNode.rotation.x, -limitX, limitX);
        boneNode.rotation.y = THREE.MathUtils.clamp(boneNode.rotation.y, -limitY, limitY);
        boneNode.rotation.z = THREE.MathUtils.clamp(boneNode.rotation.z, -limitZ, limitZ);
      } else if (s.bone.includes('spine') || s.bone === 'chest') {
        // Also clamp spine to prevent extreme hunching/bending
        const limitSpine = THREE.MathUtils.degToRad(30);
        boneNode.rotation.x = THREE.MathUtils.clamp(boneNode.rotation.x, -limitSpine, limitSpine);
      }
    }
  }

  // ── Cleanup springs when pose fully decays ───────────────────────────
  public isFullyIdle(): boolean {
    return this.poseWeight < 0.001 && !this.activePose;
  }
}
