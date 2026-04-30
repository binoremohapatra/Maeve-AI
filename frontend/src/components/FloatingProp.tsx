import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFloatingBehavior } from '../hooks/useFloatingBehavior';

interface FloatingPropProps {
    children: React.ReactNode;
    position?: [number, number, number];
    floatAmplitude?: number;
    floatSpeed?: number;
    rotationDriftSpeed?: number;
}

export const FloatingProp: React.FC<FloatingPropProps> = ({
    children,
    position = [0, 0, 0],
    floatAmplitude = 0.1,
    floatSpeed = 1.0,
    rotationDriftSpeed = 0.5
}) => {
    const groupRef = useRef<THREE.Group>(null);

    useFloatingBehavior({
        ref: groupRef,
        basePosition: position,
        floatAmplitude,
        floatSpeed,
        rotationDriftSpeed
    });

    return (
        <group ref={groupRef} position={position}>
            {children}
        </group>
    );
};
