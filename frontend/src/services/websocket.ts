import { io, Socket } from 'socket.io-client';

// WebSocket Configuration
const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'https://adjusted-del-irc-documented.trycloudflare.com';

// Types for WebSocket events
export interface VoiceFeedbackEvent {
  text: string;
  voice: string;
  timestamp: number;
}

export interface LifeUpdateEvent {
  energy: number;
  stress: number;
  sleep: number;
  happiness: number;
  timestamp: number;
}

export interface CommandStatusEvent {
  commandId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
}

export interface DevicePresenceEvent {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  deviceInfo?: {
    cpu: number;
    ram: number;
    battery?: number;
  };
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners storage
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupSocket();
  }

  // Connection Management
  private setupSocket(): void {
    try {
      this.socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnection();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', { timestamp: Date.now() });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('disconnected', { reason, timestamp: Date.now() });
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('connection_error', { error, timestamp: Date.now() });
    });

    // Voice Feedback (NEW - for TTS)
    this.socket.on('voice_feedback', (data: VoiceFeedbackEvent) => {
      this.emit('voice_feedback', data);
    });

    // Life Updates (NEW - for Life Manager)
    this.socket.on('life_update', (data: LifeUpdateEvent) => {
      this.emit('life_update', data);
    });

    // Command Status
    this.socket.on('command_status', (data: CommandStatusEvent) => {
      this.emit('command_status', data);
    });

    this.socket.on('device_presence', (data: DevicePresenceEvent) => {
      this.emit('device_presence', data);
    });

    // Real-time updates
    this.socket.on('device_stats', (data: { cpu: number; ram: number; timestamp: number }) => {
      this.emit('device_stats', data);
    });

    this.socket.on('user_activity', (data: { userId: string; activity: string; timestamp: number }) => {
      this.emit('user_activity', data);
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.setupSocket();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('reconnection_failed', { attempts: this.reconnectAttempts });
    }
  }

  // Public API Methods
  connect(): void {
    if (!this.socket || !this.socket.connected) {
      this.setupSocket();
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Emit events to server
  sendCommand(command: string, parameters?: Record<string, any>): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('execute_command', {
        command,
        parameters,
        timestamp: Date.now()
      });
    }
  }

  sendChatMessage(userId: string, message: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_chat', {
        userId,
        message,
        timestamp: Date.now()
      });
    }
  }

  updatePresence(status: 'online' | 'offline' | 'away', activity?: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_presence', {
        status,
        activity,
        timestamp: Date.now()
      });
    }
  }

  subscribeToDeviceUpdates(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe_device_updates');
    }
  }

  unsubscribeFromDeviceUpdates(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe_device_updates');
    }
  }

  // Event Listener Management
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  off(event: string, callback?: Function): void {
    if (callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Utility Methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.reconnectAttempts = 0;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
