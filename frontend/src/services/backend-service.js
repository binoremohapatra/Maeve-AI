import { apiClient, MascotAction } from './api-client';

// Mock backend service for development
export class BackendService {
  constructor() {
    this.storeAction = null;
    this.storeEmotion = null;
    this.storeResponse = null;
  }

  setStoreFunctions(actionFn, emotionFn, responseFn) {
    this.storeAction = actionFn;
    this.storeEmotion = emotionFn;
    this.storeResponse = responseFn;
  }

  async sendMessage(message) {
    // Mock implementation
    const response = await apiClient.sendMessage(message);

    this.storeResponse?.(response);
    return response;
  }

  // Mock situation trigger for testing
  triggerSituation(situation) {
    this.storeAction?.(situation);
    this.storeEmotion?.(this.getEmotionFromSituation(situation));
  }

  getEmotionFromSituation(situation) {
    const emotionMap = {
      [MascotAction.VICTORY]: 'HAPPY',
      [MascotAction.KISS]: 'HAPPY',
      [MascotAction.BLOW_KISS]: 'HAPPY',
      [MascotAction.HUG]: 'HAPPY',
      [MascotAction.CLAP]: 'HAPPY',
      [MascotAction.THANKFUL]: 'HAPPY',
      [MascotAction.SAD]: 'SAD',
      [MascotAction.SHY]: 'SAD',
      [MascotAction.THINKING]: 'THINKING',
      [MascotAction.ANGRY]: 'ANGRY',
      [MascotAction.IDLE]: 'NEUTRAL',
      [MascotAction.TYPING]: 'NEUTRAL',
      [MascotAction.WAVE]: 'HAPPY',
      [MascotAction.GREETING]: 'HAPPY'
    };
    return emotionMap[situation] || 'NEUTRAL';
  }
}

export const backendService = new BackendService();
