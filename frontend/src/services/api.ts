import axios from 'axios';
import { API_ENDPOINTS } from '../config/EcosystemConfig';

export interface ChatResponse {
  reply: string;
  providerUsed: string;
  mode: string;
  responseTime: number;
  audioBase64: string;
  action: string;
  expression: string;
}

class MaeveAPI {
  private _pingPromise: Promise<boolean> | null = null;
  private _lastPingTime: number = 0;
  private readonly PING_COOLDOWN_MS = 2000;

  //  PING CHECK: Fast check on Brain (Globally Debounced to prevent ERR_INSUFFICIENT_RESOURCES)
  async isPcOnline(): Promise<boolean> {
    const now = Date.now();

    // 1. If a request is already in-flight, return the existing Promise
    if (this._pingPromise) {
      return this._pingPromise;
    }

    // 2. Cooldown preventer: If we just checked less than 2s ago, return last known assumption
    if (now - this._lastPingTime < this.PING_COOLDOWN_MS) {
      return false; // Assuming false to prevent instant spam if it was failing
    }

    this._pingPromise = (async () => {
      try {
        const url = `${API_ENDPOINTS.BRAIN}/ping`;
        const res = await axios.get(url, { timeout: 10000 });
        console.log(" PC Signal Locked - Brain is Online");
        this._lastPingTime = Date.now();
        return res.status === 200;
      } catch (e) {
        console.warn(" Brain is busy or sleeping, will try again...");
        this._lastPingTime = Date.now();
        return false;
      } finally {
        this._pingPromise = null;
      }
    })();

    return this._pingPromise;
  }

  //  THE BULLETPROOF CHAT FUNCTION (Bypasses WebSocket completely)
  async sendDirectChat(
    userId: string, 
    message: string, 
    persona: string, 
    visualVibe: string = "", 
    apiKeys: { groq?: string, gemini?: string } = {}
  ) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.BRAIN}/process`, {
        user_input: message,
        userId: userId,
        persona: persona,
        visual_vibe: visualVibe,
        source: "ui",
        api_keys: apiKeys
      }, { timeout: 120000 }); //  FIX: Timeout badhakar 2 minute kar diya (120000 ms)
      return response.data;
    } catch (error) {
      console.error('Direct Chat Error:', error);
      throw error;
    }
  }

  //  CHAT WITH JAVA CORE (History/Database)
  async sendMessage(userId: string, message: string, mode: string = "CALM_SUPPORTIVE") {
    try {
      const response = await axios.post<ChatResponse>(`${API_ENDPOINTS.JAVA_CORE}/api/chat`, {
        message: message, userId: userId, deviceId: "web_client", mode: mode, preferLocal: true
      }, { timeout: 10000 });
      return response.data;
    } catch (error) {
      console.error('API Error (Java Chat):', error);
      throw error;
    }
  }

  //  SEND TO PYTHON BRAIN (Direct Neural Link)
  async sendMessageWithVision(
    userId: string, 
    message: string, 
    persona: string, 
    visualVibe: string = "", 
    apiKeys: { groq?: string, gemini?: string } = {}
  ) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.BRAIN}/process`, {
        user_input: message, 
        userId: userId, 
        persona: persona, 
        visual_vibe: visualVibe, 
        source: "ui",
        api_keys: apiKeys
      }, { timeout: 10000 });
      return response.data;
    } catch (error) {
      console.error('Brain Processing Error:', error);
      throw error;
    }
  }

  async getDeviceStatus(userId: string) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.JAVA_CORE}/device/${userId}/status`);
      return response.data;
    } catch (error) {
      console.error('API Error (Device Status):', error);
      throw error;
    }
  }

  async shutdownSystem(userId: string) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/mobile/command/${userId}`, {
        target: "pc_local",
        action: "SYSTEM_CONTROL",
        payload: "shutdown"
      });
      return response.data;
    } catch (error) {
      console.error('API Error (Shutdown):', error);
      throw error;
    }
  }

  async restartSystem(userId: string) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/mobile/command/${userId}`, {
        target: "pc_local",
        action: "SYSTEM_CONTROL",
        payload: "restart"
      });
      return response.data;
    } catch (error) {
      console.error('API Error (Restart):', error);
      throw error;
    }
  }

  async lockSystem(userId: string) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/mobile/command/${userId}`, {
        target: "pc_local",
        action: "SYSTEM_CONTROL",
        payload: "lock"
      });
      return response.data;
    } catch (error) {
      console.error('API Error (Lock):', error);
      throw error;
    }
  }

  async takeScreenshot(userId: string) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/mobile/command/${userId}`, {
        target: "pc_local",
        action: "SYSTEM_CONTROL",
        payload: "screenshot"
      });
      return response.data;
    } catch (error) {
      console.error('API Error (Screenshot):', error);
      throw error;
    }
  }

  async getFiles(userId: string) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.JAVA_CORE}/files/${userId}`);
      return response.data;
    } catch (error) {
      console.error('API Error (Get Files):', error);
      throw error;
    }
  }

  async uploadFile(userId: string, file: File) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log(" Uploading:", file.name, file.size);

      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/files/${userId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('API Error (Upload):', error);
      throw error;
    }
  }

  async downloadFileUrl(userId: string, fileId: string): Promise<string> {
    return `${API_ENDPOINTS.JAVA_CORE}/files/${userId}/files/${fileId}`;
  }

  async sendInteraction(userId: string, data: { type: 'action' | 'vent', category?: string, text?: string }) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.JAVA_CORE}/care/${userId}/interact`, data);
      return response.data;
    } catch (error) {
      console.error('Interaction Error:', error);
      return {
        replyText: "Connection Error",
        mascotAction: "SAD",
        emotion: "SAD",
        audioBase64: null
      };
    }
  }

  //  DYNAMIC API KEY MANAGEMENT
  async getKeyStatus() {
    try {
      const response = await axios.get(`${API_ENDPOINTS.BRAIN}/api/keys/status`);
      return response.data;
    } catch (error) {
      console.error('Fetch Key Status Error:', error);
      throw error;
    }
  }

  async setKeys(groq: string, gemini: string) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.BRAIN}/api/keys/set`, {
        groq_api_key: groq,
        gemini_api_key: gemini
      });
      return response.data;
    } catch (error) {
      console.error('Set Keys Error:', error);
      throw error;
    }
  }

  async clearKeys() {
    try {
      const response = await axios.post(`${API_ENDPOINTS.BRAIN}/api/keys/clear`);
      return response.data;
    } catch (error) {
      console.error('Clear Keys Error:', error);
      throw error;
    }
  }
}

export const maeveAPI = new MaeveAPI();
export default maeveAPI;
