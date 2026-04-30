export interface BehaviorParams {
  leanIn: boolean;
  headTilt: [number, number, number] | null; 
  emotionOverride: string | null;
  lookAtTargetModifier: [number, number, number] | null;
  intensity: number;
  isFloatingUp: boolean;
}

export function parseBehaviorTags(text: string): BehaviorParams {
  const result: BehaviorParams = {
    leanIn: false,
    headTilt: null,
    emotionOverride: null,
    lookAtTargetModifier: null,
    intensity: 1.0,
    isFloatingUp: false
  };

  if (!text) return result;

  const lowerText = text.toLowerCase();

  // Parse "lean in" or proximity tags
  if (lowerText.includes('*leans in*') || lowerText.includes('*steps closer*') || lowerText.includes('*gets closer*')) {
    result.leanIn = true;
  }

  // Parse head tilts
  if (lowerText.includes('*tilts head*') || lowerText.includes('*tilts her head*')) {
    // slight tilt on the Z axis (roll)
    result.headTilt = [0, 0, 0.15]; 
  } else if (lowerText.includes('*nods*')) {
    result.headTilt = [0.1, 0, 0];
  } else if (lowerText.includes('*looks down*')) {
    result.lookAtTargetModifier = [0, -0.5, 0];
  } else if (lowerText.includes('*looks away*')) {
    result.lookAtTargetModifier = [0.5, 0, 0];
  } else if (lowerText.includes('*looks up*')) {
    result.lookAtTargetModifier = [0, 0.5, 0];
  }

  // Parse disgust or other strong tags
  if (lowerText.includes('*disgusted*') || lowerText.includes('*scoffs*') || lowerText.includes('*rolls eyes*')) {
    result.emotionOverride = 'DISGUST';
    result.headTilt = [-0.1, 0.2, 0]; // pull back and turn slightly
    if (lowerText.includes('*rolls eyes*')) {
      result.lookAtTargetModifier = [0, 0.8, 0]; 
    }
  }

  // Parse intensity
  if (lowerText.includes('intensely') || lowerText.includes('deeply')) {
    result.intensity = 1.5;
  } else if (lowerText.includes('slightly') || lowerText.includes('softly')) {
    result.intensity = 0.5;
  }

  // Parse Zero-Gravity Intents
  if (lowerText.includes('*floats*') || lowerText.includes('*floats up*') || lowerText.includes('*objects float*')) {
    result.isFloatingUp = true;
  }

  return result;
}
