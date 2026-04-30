import * as THREE from 'three';
import {
  VRM,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneCollider
} from '@pixiv/three-vrm';

//  THE FACE MASK STRATEGY
// Coordinates assume the 'head' bone origin is at the base of the skull/neck top.
// Y is up/down, Z is forward/back, X is left/right.
//  REFINED COLLIDERS: Removed Neck and Shoulder colliders completely!
// Unhone IDLE mein arms down hone par baalon ko crush kar diya tha.
const BODY_COLLIDER_DEFS: Record<string, { radius: number; offset: [number, number, number] }[]> = {
  head: [
    { radius: 0.055, offset: [0.0, -0.04, 0.0] },  // back-of-skull blocker
    { radius: 0.045, offset: [0.0, -0.04, 0.06] },  // front-skull (face) blocker
  ],
  //  NECK AND SHOULDERS DELETED TO PREVENT BALLOONING IN IDLE
  upperChest: [
    { radius: 0.065, offset: [0.0, 0.05, 0.03] },  // front chest
    { radius: 0.055, offset: [0.0, 0.05, -0.05] },  // back (stops rear hair clip)
  ],
  chest: [
    { radius: 0.060, offset: [0.0, 0.03, 0.02] },
  ]
};

export function injectBodyColliders(vrm: VRM): void {
  const manager = vrm.springBoneManager;
  if (!manager) return;

  // Supports both v2.0+ specs
  const joints = manager.joints ?? manager.springBones ?? [];
  const colliderGroups = manager.colliderGroups ?? [];
  const newColliders: VRMSpringBoneCollider[] = [];

  for (const [boneName, defs] of Object.entries(BODY_COLLIDER_DEFS)) {
    const boneNode: THREE.Object3D | null =
      vrm.humanoid?.getRawBoneNode(boneName as any) ?? null;
    if (!boneNode) continue;

    for (const def of defs) {
      const shape = new VRMSpringBoneColliderShapeSphere({
        radius: def.radius,
        offset: new THREE.Vector3(...def.offset)
      });

      const collider = new VRMSpringBoneCollider(shape);
      boneNode.add(collider);
      newColliders.push(collider);

      //  DEBUG MODE: Temporarily set visible to true if you need to tweak the Face Mask
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false })
      );
      collider.add(mesh);
    }
  }

  if (newColliders.length === 0) return;

  const newGroup = {
    colliders: newColliders,
    name: 'InjectedFaceAndBodyColliders'
  };

  colliderGroups.push(newGroup);

  // Attach the new Face Mask to all spring joints EXCEPT hair joints
  // (hair joints are fully frozen via applyFluidPhysics — no colliders needed)
  joints.forEach((joint: any) => {
    const node: THREE.Object3D = joint.bone ?? joint.node;
    const name = (node?.name ?? '').toLowerCase();
    const isHair = name.includes('j_sec_hair') || name.includes('hair');
    if (isHair) return; //  Skip hair — frozen in applyFluidPhysics

    const groups: any[] = joint.colliderGroups ?? [];
    if (!groups.includes(newGroup)) {
      groups.push(newGroup);
      joint.colliderGroups = groups;
    }
  });

  console.log(` Injected ${newColliders.length} precision colliders. Face Mask active.`);
}
