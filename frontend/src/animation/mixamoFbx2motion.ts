import * as THREE from "three";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

export function mixamoFbx2motion(fbxObject: THREE.Group, vrm: VRM, isReversedModel: boolean = false) {
  const clip = fbxObject.animations[0];
  if (!clip) {
    console.error(" No animation found in FBX");
    return new THREE.AnimationClip("error", 0, []);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  const mixamoHips =
    fbxObject.getObjectByName("mixamorigHips") ||
    fbxObject.getObjectByName("mixamorig:Hips");

  if (!mixamoHips) {
    console.error(" Could not find Hips bone in FBX");
    return new THREE.AnimationClip("error", 0, []);
  }

  // ==========================================
  //  STANDARD MODEL GROUNDING LOGIC
  // (Pairo ki asli lambai naap kar scale karna)
  // ==========================================
  const motionHipsHeight = mixamoHips.position.y;
  const vrmHips = vrm.humanoid?.getNormalizedBoneNode("hips");
  const vrmLeftFoot = vrm.humanoid?.getNormalizedBoneNode("leftFoot");

  let vrmHipsHeight = 1.0;

  if (vrmHips && vrmLeftFoot) {
    const hipsY = vrmHips.getWorldPosition(_vec3).y;
    const footY = vrmLeftFoot.getWorldPosition(_vec3).y;
    vrmHipsHeight = Math.abs(hipsY - footY);
  } else if (vrmHips) {
    const vrmHipsY = vrmHips.getWorldPosition(_vec3).y;
    const vrmRootY = vrm.scene.getWorldPosition(_vec3).y;
    vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
  }

  const hipsPositionScale =
    motionHipsHeight === 0 ? 1 : vrmHipsHeight / motionHipsHeight;

  clip.tracks.forEach((track) => {
    const trackName = track.name.replace("mixamorig:", "mixamorig");
    const trackSplitted = trackName.split(".");
    const mixamoRigName = trackSplitted[0];

    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    if (!vrmBoneName) return;

    const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (!vrmNode) return;

    const vrmNodeName = vrmNode.name;
    const propertyName = trackSplitted[1];

    const mixamoRigNode =
      fbxObject.getObjectByName(mixamoRigName) ||
      fbxObject.getObjectByName(mixamoRigName.replace("mixamorig", "mixamorig:"));

    if (!mixamoRigNode) return;

    // =============================
    //  QUATERNION TRACK FIX
    // =============================
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const newValues: number[] = [];

      mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
      mixamoRigNode.parent?.getWorldQuaternion(parentRestWorldRotation);

      for (let i = 0; i < track.values.length; i += 4) {
        _quatA.fromArray(track.values, i);
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        _quatA.normalize();

        if (_quatA.lengthSq() === 0 || !Number.isFinite(_quatA.x)) {
          _quatA.set(0, 0, 0, 1);
        }

        if (
          vrmBoneName === "spine" || vrmBoneName === "chest" ||
          vrmBoneName === "upperChest" || vrmBoneName === "neck" ||
          vrmBoneName === "head"
        ) {
          const e = new THREE.Euler().setFromQuaternion(_quatA, "XYZ");
          e.x = THREE.MathUtils.clamp(e.x, -1.5, 1.5);
          e.y = THREE.MathUtils.clamp(e.y, -1.5, 1.5);
          e.z = THREE.MathUtils.clamp(e.z, -1.0, 1.0);
          _quatA.setFromEuler(e);
          _quatA.normalize();
        }

        // ==========================================
        //  TARGETED BONE ANIMATION (Custom Modifiers)
        // ==========================================
        const isLowerArm = vrmBoneName === "leftLowerArm" || vrmBoneName === "rightLowerArm";
        const isUpperArm = vrmBoneName === "leftUpperArm" || vrmBoneName === "rightUpperArm";

        if (isReversedModel && (isLowerArm || isUpperArm)) {
          //  MAGIC FIX: Sirf hatho ke liye X aur Z ko flip kar diya!
          // Taaki hath peeche jane ke bajaye aage ki taraf (sahi disha me) mude.
          newValues.push(-_quatA.x, _quatA.y, -_quatA.z, _quatA.w);
        } else {
          // STANDARD VRM 0.x Mapping (Baki sab haddiyon ke liye)
          if (vrm.meta?.metaVersion === "0") {
            newValues.push(-_quatA.x, -_quatA.y, -_quatA.z, _quatA.w);
          } else {
            newValues.push(_quatA.x, _quatA.y, _quatA.z, _quatA.w);
          }
        }
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times.slice(), newValues)
      );
    }

    // =============================
    //  POSITION TRACK (The TRUE Anti-Slip / Root Motion Logic)
    // =============================
    else if (track instanceof THREE.VectorKeyframeTrack) {
      const newValues: number[] = [];

      for (let i = 0; i < track.values.length; i += 3) {
        let animX = track.values[i];
        let animY = track.values[i + 1];
        let animZ = track.values[i + 2];

        //  DELTA Y LOGIC (Ye usko hawa me jhulne nahi dega)
        // Mixamo ki haddi apni jagah se kitni upar-neeche hui (Difference)
        let dy = animY - motionHipsHeight; 
        
        // Tere model ke asli leg-length (vrmHipsHeight) mein sirf motion ka difference jodo.
        let finalY = vrmHipsHeight + (dy * hipsPositionScale);
        
        // ANTI-GRAVITY CLAMP: Character apni position se neeche nahi jayega
        if (finalY < vrmHipsHeight) {
          finalY = vrmHipsHeight;
        }
        
        let finalX = animX * hipsPositionScale;
        let finalZ = animZ * hipsPositionScale;

        //  DIRECTION FIX
        if (isReversedModel) {
          // X aur Z ko zero (0) MAT KARNA! Warna Moonwalk/Slip hoga. 
          // Inko minus karo taaki wo sahi disha me root motion kare.
          finalX = -finalX;
          finalZ = -finalZ;
        } else if (vrm.meta?.metaVersion === "0") {
          finalX = -finalX;
          finalZ = -finalZ;
        }

        newValues.push(finalX, finalY, finalZ);
      }

      tracks.push(
        new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times.slice(), newValues)
      );
    }
  });

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

const mixamoVRMRigMap: Record<string, VRMHumanBoneName> = {
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbMetacarpal",
  mixamorigLeftHandThumb2: "leftThumbProximal",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandThumb1: "rightThumbMetacarpal",
  mixamorigRightHandThumb2: "rightThumbProximal",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
};