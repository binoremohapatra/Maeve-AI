import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { damp3 } from 'maath/easing';
import { useMoodStore } from '../stores/moodStore';
import { parseBehaviorTags } from '../utils/BehaviorMapper';

interface UseFloatingBehaviorProps {
    ref: React.RefObject<THREE.Object3D | null>;
    floatAmplitude?: number;
    floatSpeed?: number;
    rotationDriftSpeed?: number;
    basePosition?: [number, number, number];
}

export function useFloatingBehavior({
    ref,
    floatAmplitude = 0.1,
    floatSpeed = 1.0,
    rotationDriftSpeed = 0.5,
    basePosition = [0, 0, 0]
}: UseFloatingBehaviorProps) {
    const { camera } = useThree();
    
    // Globally access the Mascot's dialogue to parse physical intent overrides
    const { mascot } = useMoodStore();
    const intent = parseBehaviorTags(mascot.replyText);
    const isFloatingUp = intent.isFloatingUp;
    
    useFrame((state, delta) => {
        if (!ref.current) return;

        // Perform rapid distance culling (Memory Optimization requested by user)
        // If the prop is > 20 meters away, skip expensive floating-point vector math
        if (camera.position.distanceToSquared(ref.current.position) > 400) {
            return;
        }

        const t = state.clock.elapsedTime;
        
        if (isFloatingUp) {
            // DIRECTED INTENT OVERRIDE: Fly upwards smoothly
            const targetY = basePosition[1] + floatAmplitude * 5; 
            damp3(ref.current.position, [basePosition[0], targetY, basePosition[2]], 0.4, delta);
            
            // Introduce rapid spin simulation indicating kinetic lift
            ref.current.rotation.x += delta * rotationDriftSpeed * 1.5;
            ref.current.rotation.y += delta * rotationDriftSpeed * 1.5;
        } else {
            // CALM ZERO-G DRIFT
            const driftY = basePosition[1] + Math.sin(t * floatSpeed) * floatAmplitude;
            // We use damp3 here to softly catch the object returning from a "Float Up" intent
            damp3(ref.current.position, [basePosition[0], driftY, basePosition[2]], 0.25, delta);
            
            // Slow, randomized axis tumbling
            ref.current.rotation.x += delta * rotationDriftSpeed * 0.1;
            ref.current.rotation.y += delta * rotationDriftSpeed * 0.2;
            ref.current.rotation.z += delta * rotationDriftSpeed * 0.05;
        }
    });
}
