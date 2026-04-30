/**
 *  Bone Structure Comparison Tool
 * Use this to verify that your clothing VRM has the same bone structure as your base VRM
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// Run this in your browser console when both VRMs are loaded
export function compareBoneStructures(baseVrmUrl: string, clothingVrmUrl: string) {
    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
    
    Promise.all([
        loader.loadAsync(baseVrmUrl),
        loader.loadAsync(clothingVrmUrl)
    ]).then(([baseGltf, clothingGltf]) => {
        const baseVrm = baseGltf.userData.vrm;
        const clothingVrm = clothingGltf.userData.vrm;
        
        // Extract bone names from both VRMs
        const baseBones = new Set<string>();
        const clothingBones = new Set<string>();
        
        // Helper function to collect bone names
        const collectBones = (obj: any, boneSet: Set<string>) => {
            if (obj.isBone && obj.name) {
                boneSet.add(obj.name);
            }
            if (obj.children) {
                obj.children.forEach((child: any) => collectBones(child, boneSet));
            }
        };
        
        // Collect bones from both VRMs
        baseVrm.scene.traverse((obj: any) => collectBones(obj, baseBones));
        clothingVrm.scene.traverse((obj: any) => collectBones(obj, clothingBones));
        
        // Compare bone sets
        const baseOnly = [...baseBones].filter(bone => !clothingBones.has(bone));
        const clothingOnly = [...clothingBones].filter(bone => !baseBones.has(bone));
        const common = [...baseBones].filter(bone => clothingBones.has(bone));
        
        console.group(' VRM Bone Structure Comparison');
        console.log(` Base VRM (${baseVrmUrl}): ${baseBones.size} bones`);
        console.log(` Clothing VRM (${clothingVrmUrl}): ${clothingBones.size} bones`);
        console.log(` Common bones: ${common.length}`);
        
        if (baseOnly.length > 0) {
            console.warn(' Bones only in base VRM:', baseOnly);
        }
        
        if (clothingOnly.length > 0) {
            console.warn(' Bones only in clothing VRM:', clothingOnly);
        }
        
        if (baseOnly.length === 0 && clothingOnly.length === 0) {
            console.log(' PERFECT MATCH! All bones are compatible.');
        } else {
            console.error(' Bone mismatch detected! Clothing may not bind correctly.');
            console.log(' Solution: Ensure both VRMs were exported from the same base model.');
        }
        
        // Show critical bones for humanoid animation
        const criticalBones = [
            'J_Bip_C_Hips', 'J_Bip_C_Spine', 'J_Bip_C_Chest', 'J_Bip_C_Neck',
            'J_Bip_C_Head', 'J_Bip_L_Shoulder', 'J_Bip_R_Shoulder',
            'J_Bip_L_Arm', 'J_Bip_R_Arm', 'J_Bip_L_Hand', 'J_Bip_R_Hand',
            'J_Bip_L_UpLeg', 'J_Bip_R_UpLeg', 'J_Bip_L_Leg', 'J_Bip_R_Leg',
            'J_Bip_L_Foot', 'J_Bip_R_Foot'
        ];
        
        const missingCritical = criticalBones.filter(bone => !common.includes(bone));
        if (missingCritical.length > 0) {
            console.error(' CRITICAL: Missing humanoid bones:', missingCritical);
        } else {
            console.log(' All critical humanoid bones present');
        }
        
        console.groupEnd();
        
        return {
            baseOnly,
            clothingOnly,
            common,
            isCompatible: baseOnly.length === 0 && clothingOnly.length === 0,
            missingCritical
        };
    }).catch(error => {
        console.error(' Error loading VRMs for comparison:', error);
    });
}

// Quick usage example:
// compareBoneStructures('/models/maeve.vrm', '/models/gothDress.vrm');
