import { useRef } from 'react';
import * as THREE from 'three';
import { useMoodStore } from '../stores/moodStore';

export const useBiologicalEngine = () => {
    // Blink Timer State
    const blinkState = useRef({ nextBlink: 0, blinkDuration: 0 });

    return (vrms: any[], state: any, delta: number) => {
        if (!vrms || vrms.length === 0) return;

        const t = state.clock.elapsedTime;
        const currentMode = useMoodStore.getState().currentMode || 'DEFAULT';
        const persona = currentMode.toUpperCase();

        // ========================================================================
        //  1. BIOLOGICAL PROFILES (सांस और बेचैनी की स्पीड)
        // ========================================================================
        let breathRate = 2.0;   // सांस लेने की स्पीड
        let breathDepth = 0.02; // छाती कितनी फूलेगी
        let swaySpeed = 0.5;    // कमर का हिलना (Fidgeting)
        let blinkInterval = 4;  // कितने सेकंड में पलक झपकाएगी

        if (['HAJIDERE', 'ANXIOUS', 'FUANDERE', 'DOROMUGA'].includes(persona)) {
            // घबराई हुई: तेज़ सांसें, ज़्यादा हिलना-डुलना, जल्दी-जल्दी पलकें झपकाना
            breathRate = 3.5;
            breathDepth = 0.015;
            swaySpeed = 1.5;
            blinkInterval = 2;
        }
        else if (['YANDERE', 'YANDERE_STALKER', 'SADODERE', 'DARK_DEVOTION'].includes(persona)) {
            // साइको किलर: बहुत शांत, गहरी सांसें, बिना पलक झपकाए घूरना
            breathRate = 1.0;
            breathDepth = 0.025;
            swaySpeed = 0.1; // बिल्कुल नहीं हिलेगी (Predator Mode)
            blinkInterval = 12; // 12 सेकंड तक पलक नहीं झपकाएगी! (Creepy Stare)
        }
        else if (['NYMPHO', 'DOMINANT_PASSION', 'LUST'].includes(persona)) {
            // भारी/रोमांटिक सांसें
            breathRate = 2.5;
            breathDepth = 0.035; // छाती ज़्यादा फूलेगी (Heavy breathing)
            swaySpeed = 0.8;
        }

        // ========================================================================
        //  2. THE BREATHING & SWAY MATH (Sine Waves)
        // ========================================================================
        // सांस लेते वक्त छाती ऊपर-नीचे (Pitch)
        const chestSine = Math.sin(t * breathRate) * breathDepth;

        // बेचैनी में कमर का हल्का सा दाएं-बाएं हिलना (Roll & Yaw)
        const swaySine = Math.cos(t * swaySpeed) * (breathDepth * 0.8);

        // Quaternions (ताकि Mixamo एनीमेशन खराब ना हो)
        const chestQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(chestSine, 0, 0));
        const spineQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, swaySine * 0.5, swaySine));

        // ========================================================================
        //  3. THE RANDOM BLINK ENGINE
        // ========================================================================
        if (t > blinkState.current.nextBlink) {
            // Natural blink is very fast (100-150ms)
            blinkState.current.blinkDuration = 0.12 + Math.random() * 0.05;

            // अगली बार कब झपकाएगी? (Stable base + small noise)
            // Humans blink 15-20 times per minute (every 3-4s)
            // For AI, we make it slightly more sparse (5-8s) to avoid being distracting
            blinkState.current.nextBlink = t + (blinkInterval * 1.2) + Math.random() * 4;
        }

        let blinkValue = 0;
        if (blinkState.current.blinkDuration > 0) {
            //  Biological Ease: Most blinks aren't 100% 
            // We use a slight reduction (0.8 - 0.95) so it doesn't look like a "clamp"
            blinkValue = 0.85 + Math.random() * 0.1;
            blinkState.current.blinkDuration -= delta;
        }

        // ========================================================================
        //  4. APPLY TO BONES & FACE
        // ========================================================================
        vrms.forEach(vrm => {
            // A. Apply Breathing & Fidgeting to Bones (Spine/Chest)
            const chest = vrm.humanoid?.getNormalizedBoneNode('chest') || vrm.humanoid?.getNormalizedBoneNode('upperChest');
            const spine = vrm.humanoid?.getNormalizedBoneNode('spine');

            if (chest) chest.quaternion.multiply(chestQuat);
            if (spine) spine.quaternion.multiply(spineQuat);

            // B. Apply Random Blink
            if (blinkValue > 0 && vrm.expressionManager) {
                vrm.expressionManager.setValue('blink', blinkValue);
                vrm.expressionManager.setValue('blinkLeft', blinkValue);
                vrm.expressionManager.setValue('blinkRight', blinkValue);
                vrm.expressionManager.update();
            }
        });
    };
};
