import * as THREE from 'three';
import { damp3, dampE } from 'maath/easing';

export class EyeOverrideLogic {
    private eyeLookTarget = new THREE.Vector3();
    private currentSaccadeOffset = new THREE.Vector3();
    private targetSaccadeOffset = new THREE.Vector3();
    private nextSaccadeTime = 0;
    private nextDartTime = 5.0;
    private dartDurationEnd = 0;
    private isDarting = false;
    private dartOffset = new THREE.Vector3();
    
    // Update Logic replacing the monolithic controller block
    public update(delta: number, elapsed: number, vrm: any, mousePos: THREE.Vector2, behavior: any, isIntenseState: boolean, cameraPos: THREE.Vector3) {
        if (!vrm) return;

        // 1. Gaze Coordinate Targeting
        let targetX = mousePos.y * 2.5; 
        let targetY = mousePos.x * 2.5 + 1.2;
        
        //  Cognitive Gaze (Thinking State diverges eye-contact)
        if (behavior?.emotionOverride === 'THINKING') {
            targetX -= 1.2; // Up
            targetY += Math.sin(elapsed * 0.5) > 0 ? 1.0 : -1.0; // Left or Right
        }

        // 2. Micro-Saccades (Upgraded frequency: 0.005 limits every 0.5s)
        if (elapsed > this.nextSaccadeTime) {
            this.targetSaccadeOffset.set(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                0
            );
            // Increased tremble during intense ecstasy (0.2s refresh)
            this.nextSaccadeTime = elapsed + (isIntenseState ? 0.2 : 0.5 + Math.random() * 0.2);
        }
        damp3(this.currentSaccadeOffset, this.targetSaccadeOffset, 0.05, delta);

        // 3.  Cognitive Eye-Dart (Process simulation)
        // Har 5-10s mein, 200ms ke liye nazar hatai gi
        if (elapsed > this.nextDartTime) {
            this.isDarting = true;
            this.dartDurationEnd = elapsed + 0.2; // 200ms dart
            this.nextDartTime = elapsed + 5.0 + Math.random() * 5.0;
            const dartDirX = Math.random() > 0.5 ? 2.0 : -2.0;
            this.dartOffset.set(dartDirX, (Math.random() - 0.5) * 1.5, 0);
        }
        if (elapsed > this.dartDurationEnd) {
            this.isDarting = false;
        }

        const lookAtPoint = new THREE.Vector3(targetX, targetY, 5);
        lookAtPoint.add(this.currentSaccadeOffset);
        if (this.isDarting) lookAtPoint.add(this.dartOffset);

        if (behavior?.lookAtTargetModifier) {
            lookAtPoint.x += behavior.lookAtTargetModifier[0];
            lookAtPoint.y += behavior.lookAtTargetModifier[1];
            lookAtPoint.z += behavior.lookAtTargetModifier[2];
        }

        // Eye Lead rule: rapid snaps at 0.1s
        damp3(this.eyeLookTarget, lookAtPoint, 0.1, delta);

        // 4.  HIGH-INTENSITY "AHEGAO" OVERRIDE (Explicit Hijack)
        const leftEye = vrm.humanoid?.getRawBoneNode('leftEye');
        const rightEye = vrm.humanoid?.getRawBoneNode('rightEye');
        
        // Ensure standard lookAt applies first
        if (vrm.lookAt) {
            if (!vrm.lookAt.target) {
                vrm.lookAt.target = new THREE.Object3D();
            }
            vrm.lookAt.target.position.copy(this.eyeLookTarget);
            vrm.lookAt.update(delta); // Let standard framework apply
        }

        //  4B. Eye Vergence (Focus Shift mapping camera distance)
        if (!isIntenseState && leftEye && rightEye && cameraPos) {
            // IPD ~ 60mm (0.06m)
            const dist = cameraPos.distanceTo(vrm.scene.position) || 2.0;
            const vergenceAngle = Math.atan(0.06 / Math.max(dist, 0.4)); // cross-eye extent
            // Adjust local Y rotations inward
            leftEye.rotation.y += vergenceAngle * 0.5;
            rightEye.rotation.y -= vergenceAngle * 0.5;
        }

        // 5.  Ecstasy explicit pupil lock override
        if (isIntenseState && leftEye && rightEye) {
            // X-axis rotation up (-0.4 to -0.6 radians)
            const intenseTremble = (Math.random() - 0.5) * 0.05; 
            let targetRoll = -0.55 + intenseTremble;
            targetRoll = Math.max(-0.65, Math.min(0, targetRoll)); // Safety lock

            const intenseRotation = new THREE.Euler(targetRoll, leftEye.rotation.y, 0, 'YXZ');
            
            dampE(leftEye.rotation, intenseRotation, 0.1, delta);
            dampE(rightEye.rotation, new THREE.Euler(targetRoll, rightEye.rotation.y, 0, 'YXZ'), 0.1, delta);
        }
    }

    public getEyeTarget() {
        return this.eyeLookTarget;
    }
}
