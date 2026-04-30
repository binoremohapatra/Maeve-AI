import * as THREE from 'three';

let vrmInstance = null;
let isPlaying = false;

export function initializeLipSync(vrm) {
  vrmInstance = vrm;
  console.log('LipSync initialized for VRM');
}

export function playLipSync(text) {
  if (!vrmInstance || !vrmInstance.expressionManager) return;
  
  isPlaying = true;
  console.log('Playing lip sync for:', text);
  
  // Simple lip sync animation based on text length
  const duration = text.length * 0.05; // 50ms per character
  const interval = setInterval(() => {
    if (!isPlaying || !vrmInstance?.expressionManager) {
      clearInterval(interval);
      return;
    }
    
    // Random mouth opening for talking effect
    const mouthOpenness = Math.random() * 0.5 + 0.3;
    vrmInstance.expressionManager.setValue('mouth_open', mouthOpenness);
  }, 100);
  
  setTimeout(() => {
    clearInterval(interval);
    stopLipSync();
  }, duration * 1000);
}

export function stopLipSync() {
  isPlaying = false;
  if (vrmInstance?.expressionManager) {
    vrmInstance.expressionManager.setValue('mouth_open', 0);
  }
}
