import { useState, useEffect, useRef, useCallback } from 'react';
import { useMoodStore } from '../stores/moodStore';
import { LipSyncAnalyzer } from '../utils/LipSyncAnalyzer';
import { workerSocketBridge } from '../services/workerSocketBridge';

interface AudioChunk {
  seq_id: number;
  audioB64?: string;
  audioBuffer?: ArrayBuffer; // Received from worker (transferable)
  emotion: string;
  animation: string;
  is_last: boolean;
}

export const useMaeveStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const { userId, visualVibe, setStreamingState } = useMoodStore();

  // Audio Context Ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isProcessingQueueRef = useRef(false);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const charManager = (window as any).characterManager;
      const existingCtx = charManager?.mainController?.lipSync?.audioCtx;

      if (existingCtx) {
        audioContextRef.current = existingCtx;
      } else {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
          console.error(" Failed to create AudioContext:", e);
        }
      }
    }

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(e => console.warn("Failed to resume AudioContext:", e));
    }
  }, []);

  useEffect(() => {
    //  Listener Handlers
    const onConnected = () => setIsConnected(true);
    const onDisconnected = () => setIsConnected(false);

    const onStreamStart = (data: any) => {
      console.log(' Worker Stream Starting:', data);
      setStreamingText('');
      setIsStreaming(true);
      setStreamingState(true, '');
      audioQueueRef.current = [];
      nextStartTimeRef.current = 0;
    };

    const onTextToken = (data: { token: string }) => {
      setStreamingText((prev) => {
        const newText = prev + data.token;
        setStreamingState(true, newText);
        return newText;
      });
    };

    const onAudioChunk = (data: AudioChunk) => {
      audioQueueRef.current.push(data);
      audioQueueRef.current.sort((a, b) => a.seq_id - b.seq_id);
      processAudioQueue();
    };

    const onStreamEnd = (data: any) => {
      console.log(' Worker Stream Ended', data);
      setIsStreaming(false);

      const currentState = useMoodStore.getState();
      const finalText = currentState.streamingText;

      const replyTimestamp = Date.now();
      const replyMsg = {
        id: `reply-${replyTimestamp}`,
        message: finalText,
        sender: 'maeve' as const,
        timestamp: replyTimestamp
      };

      useMoodStore.setState((state) => ({
        chatHistory: [...state.chatHistory, replyMsg],
        isStreaming: false,
        streamingText: ''
      }));

      const charManager = (window as any).characterManager;
      if (charManager?.mainController?.lipSync) {
        charManager.mainController.lipSync.isPlaying = false;
      }
    };

    const onStreamError = (data: any) => {
      console.error(' Worker Stream Error:', data.error);
      setIsStreaming(false);
    };

    // Wire bridge listeners
    workerSocketBridge.on('CONNECTED', onConnected);
    workerSocketBridge.on('DISCONNECTED', onDisconnected);
    workerSocketBridge.on('STREAM_START', onStreamStart);
    workerSocketBridge.on('TEXT_TOKEN', onTextToken);
    workerSocketBridge.on('AUDIO_CHUNK', onAudioChunk);
    workerSocketBridge.on('STREAM_END', onStreamEnd);
    workerSocketBridge.on('STREAM_ERROR', onStreamError);

    // Sync initial state
    setIsConnected(workerSocketBridge.isConnected());

    //  Stealth Mic Voice Events (SSE stays on main thread for now as it's infrequent)
    const voiceEvents = new EventSource('http://127.0.0.1:5004/events');
    voiceEvents.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.replyText) {
          useMoodStore.getState().sendMessage('', data);
        }
      } catch (err) {
        console.error('Failed to parse voice event:', err);
      }
    };

    return () => {
      workerSocketBridge.off('CONNECTED', onConnected);
      workerSocketBridge.off('DISCONNECTED', onDisconnected);
      workerSocketBridge.off('STREAM_START', onStreamStart);
      workerSocketBridge.off('TEXT_TOKEN', onTextToken);
      workerSocketBridge.off('AUDIO_CHUNK', onAudioChunk);
      workerSocketBridge.off('STREAM_END', onStreamEnd);
      workerSocketBridge.off('STREAM_ERROR', onStreamError);
      voiceEvents.close();
    };
  }, [setStreamingState]);

  const processAudioQueue = async () => {
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0) return;
    isProcessingQueueRef.current = true;

    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) {
      isProcessingQueueRef.current = false;
      return;
    }

    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { }
    }

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;

      try {
        //  OPTIMIZED: Use worker-decoded ArrayBuffer (Zero-copy transfer)
        const arrayBuffer = chunk.audioBuffer;
        if (!arrayBuffer) {
          console.warn('Chunk missing pre-decoded buffer');
          continue;
        }

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        // Lip Sync Sync
        LipSyncAnalyzer.getInstance().connect(ctx, source);

        const charManager = (window as any).characterManager;
        if (charManager?.mainController?.lipSync?.analyser) {
          const charAnalyser = charManager.mainController.lipSync.analyser;
          if (charAnalyser.context === ctx) {
            source.connect(charAnalyser);
            charManager.mainController.lipSync.isPlaying = true;
          }
        }

        source.connect(ctx.destination);

        const currentTime = ctx.currentTime;
        const startTime = Math.max(currentTime + 0.05, nextStartTimeRef.current);

        source.start(startTime);

        const timeToStart = (startTime - currentTime) * 1000;
        setTimeout(() => {
          const currentState = useMoodStore.getState();
          if (chunk.animation) {
            (window as any).characterManager?.play(chunk.animation);
            currentState.setAction(chunk.animation);
          }
          if (chunk.emotion) {
            useMoodStore.setState((state) => ({
              currentMood: (chunk.emotion.toLowerCase() as any) || state.currentMood,
              mascot: { ...state.mascot, emotion: chunk.emotion, speaking: true }
            }));
          }
        }, Math.max(0, timeToStart));

        nextStartTimeRef.current = startTime + audioBuffer.duration;
      } catch (err) {
        console.error('Failed to decode/play audio chunk:', err);
      }
    }

    isProcessingQueueRef.current = false;
    if (audioQueueRef.current.length > 0) processAudioQueue();
  };

  const sendMessage = useCallback(async (message: string) => {
    if (workerSocketBridge.isConnected()) {
      useMoodStore.getState().sendMessage(message);
      workerSocketBridge.emit('chat_message', {
        message,
        text: message,
        userId,
        persona: useMoodStore.getState().currentMode,
        visual_vibe: visualVibe,
        api_keys: useMoodStore.getState().apiKeys || {}
      });
    } else {
      console.warn('Bridge not connected, falling back to HTTP...');
      useMoodStore.getState().sendMessage(message);
      try {
        const { maeveAPI } = await import('../services/api');
        const store = useMoodStore.getState();
        const responseData = await maeveAPI.sendMessageWithVision(
          userId, 
          message, 
          store.currentMode, 
          visualVibe,
          store.apiKeys || {}
        );
        if (responseData) {
          useMoodStore.getState().sendMessage('', responseData);
        }
      } catch (err) {
        console.error("HTTP Fallback failed:", err);
      }
    }
  }, [userId, visualVibe]);

  const interrupt = useCallback(() => {
    if (workerSocketBridge.isConnected()) {
      workerSocketBridge.emit('interrupt', {});
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => { audioContextRef.current = null; });
      }
      setIsStreaming(false);
    }
  }, []);

  return {
    sendMessage,
    interrupt,
    isStreaming,
    streamingText,
    isConnected
  };
};
