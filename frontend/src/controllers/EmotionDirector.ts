import { damp } from 'maath/easing';

import { FULL_EMOTION_MAP, EXTREME_PERSONAS } from '../hooks/animeFaceWeights';

const ADULT_EMOTIONS: Record<string, Record<string, number>> = {
  AHEGAO: { happy: 0.2, blush: 0.9, aa: 1.0, tongueOut: 1.0, relaxed: 0.5 }, // High-Intensity Ecstasy Combo
  ECSTASY: { happy: 0.3, blush: 0.7, aa: 0.8, tongueOut: 0.5, relaxed: 0.3 },
  LUST: { happy: 0.3, eyeBlinkLeft: 0.5, eyeBlinkRight: 0.5, jawOpen: 0.25, mouthSmileLeft: 0.4, mouthSmileRight: 0.4 }
};

export const EMOTION_LIBRARY: Record<string, Record<string, number>> = {
  ...FULL_EMOTION_MAP,
  ...EXTREME_PERSONAS,
  ...ADULT_EMOTIONS,
  NEUTRAL: { neutral: 1.0, relaxed: 0.1 }
};

export class EmotionDirector {
  private currentTargets: Record<string, number> = {};
  private activeEmotionData: Record<string, number> = {};
  public isIntenseState: boolean = false;
  private currentEmotionKey: string = "NEUTRAL";
  private asymmetryOffsets: Record<string, number> = {};

  // Registers requested morph targets onto the tracker
  public setEmotion(emotionKey: string) {
    if (!emotionKey) return false;

    // Attempt fallback parsing
    let key = emotionKey.toUpperCase();
    if (key === "MASTURBATE" || key === "BLOWJOB" || key === "BACKSHOT") {
      key = "ECSTASY"; // Standard intense mapping
    }

    const emotionData = EMOTION_LIBRARY[key];
    if (emotionData) {
      if (this.currentEmotionKey !== key) {
        this.currentEmotionKey = key;
        this.activeEmotionData = { ...emotionData };
        this.isIntenseState = (key === 'AHEGAO' || key === 'ECSTASY');
        return true; // Indicates a state change (trigger blink logic upstream)
      }
    }
    return false;
  }

  // Update loop for smoothing VRM expressions exclusively via damping
  public update(delta: number, elapsed: number, vrm: any) {
    if (!vrm || !vrm.expressionManager) return;

    // The damping speed accelerates drastically for High-Intensity transitions
    const dampSpeed = this.isIntenseState ? 0.1 : 0.3;

    // Muscular Trembling (High-Intensity states induce micro-twitches on lips/mouth)
    let jitter = 0;
    if (this.isIntenseState) {
      jitter = (Math.random() - 0.5) * 0.05; // 5% jitter
    }

    // Identify all keys needed
    const allKeys = new Set([
      ...Object.keys(this.currentTargets),
      ...Object.keys(this.activeEmotionData)
    ]);

    // Dampen everything smoothly ensuring overriding over FBX base mesh states
    allKeys.forEach((morphName) => {
      let targetValue = this.activeEmotionData[morphName] || 0;

      //  Biological Asymmetry (Left != Right) 5-10% Offset
      if (targetValue > 0 && (morphName.toLowerCase().includes('left') || morphName.toLowerCase().includes('right'))) {
        if (!this.asymmetryOffsets[morphName]) {
          // Permanently assigns a side-specific weakening factor per load (0.9 to 1.0)
          this.asymmetryOffsets[morphName] = 1.0 - (Math.random() * 0.1);
        }
        targetValue *= this.asymmetryOffsets[morphName];
      }

      // Inject muscular trembling to specific areas during intensity
      if (this.isIntenseState && (morphName === 'aa' || morphName === 'happy' || morphName === 'tongueOut')) {
        if (targetValue > 0) targetValue = Math.max(0, Math.min(1, targetValue + jitter));
      }

      let currentValue = vrm.expressionManager.getValue(morphName) || 0;

      // Damp wrapper object simulating single scalar damping natively
      const valObj = { val: currentValue };
      damp(valObj, 'val', targetValue, dampSpeed, delta);

      vrm.expressionManager.setValue(morphName, valObj.val);
      // Persist local tracking
      this.currentTargets[morphName] = valObj.val;
    });
  }

  public getCurrentEmotion() {
    return this.currentEmotionKey;
  }
}
