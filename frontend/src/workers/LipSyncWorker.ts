export type Visemes = { aa: number, ee: number, ih: number, oh: number, ou: number };

let currentVisemes: Visemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
let targetVisemes: Visemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

self.onmessage = (e: MessageEvent<{ dataArray: Uint8Array, deltaTime: number }>) => {
    const { dataArray, deltaTime } = e.data;

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const volume = sum / dataArray.length;

    // Threshold gate to eliminate background hiss/noise making lips jitter
    if (volume < 3) {
        targetVisemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
    } else {
        // Split frequency bins roughly
        const binCount = dataArray.length; 
        let low = 0, mid = 0, high = 0;
        
        const lowLimit = Math.floor(binCount * 0.3);
        const midLimit = Math.floor(binCount * 0.7);

        for (let i = 0; i < lowLimit; i++) low += dataArray[i];
        for (let i = lowLimit; i < midLimit; i++) mid += dataArray[i];
        for (let i = midLimit; i < binCount; i++) high += dataArray[i];

        // Normalize bounds (max value of a bin is 255)
        const EXAGGERATE = 1.8;
        
        low = (low / (Math.max(1, lowLimit) * 255)) * EXAGGERATE;
        mid = (mid / (Math.max(1, (midLimit - lowLimit)) * 255)) * EXAGGERATE;
        high = (high / (Math.max(1, (binCount - midLimit)) * 255)) * EXAGGERATE;

        // Map to target visemes
        let newTarget = {
            aa: mid,        // Mid freq -> aa
            ee: high,       // High freq -> ee
            ih: high * 0.8, // High freq -> ih
            oh: low,        // Low freq -> oh
            ou: low * 0.8   // Low freq -> ou
        };
        
        // Clamp visemes to [0, 1] bounds
        targetVisemes.aa = Math.min(1, Math.max(0, newTarget.aa));
        targetVisemes.ee = Math.min(1, Math.max(0, newTarget.ee));
        targetVisemes.ih = Math.min(1, Math.max(0, newTarget.ih));
        targetVisemes.oh = Math.min(1, Math.max(0, newTarget.oh));
        targetVisemes.ou = Math.min(1, Math.max(0, newTarget.ou));
    }

    // Smooth Lerp (Linear Interpolation) 
    const lerpSpeed = 15; 
    const factor = 1.0 - Math.exp(-lerpSpeed * deltaTime);

    currentVisemes.aa += (targetVisemes.aa - currentVisemes.aa) * factor;
    currentVisemes.ee += (targetVisemes.ee - currentVisemes.ee) * factor;
    currentVisemes.ih += (targetVisemes.ih - currentVisemes.ih) * factor;
    currentVisemes.oh += (targetVisemes.oh - currentVisemes.oh) * factor;
    currentVisemes.ou += (targetVisemes.ou - currentVisemes.ou) * factor;

    // Send back the interpolated result
    self.postMessage(currentVisemes);
};
