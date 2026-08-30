import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const WS_URL = import.meta.env.VITE_TTS_SERVER_URL || 'http://127.0.0.1:5000'; // Target backend

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        socket = io(WS_URL, {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5
        });

        socket.on('connect', () => self.postMessage({ type: 'CONNECTED' }));
        socket.on('disconnect', () => self.postMessage({ type: 'DISCONNECTED' }));
        
        socket.on('stream_start', (data) => self.postMessage({ type: 'STREAM_START', data }));
        socket.on('text_token', (data) => self.postMessage({ type: 'TEXT_TOKEN', data }));
        socket.on('sync_meta', (data) => self.postMessage({ type: 'SYNC_META', data }));
        socket.on('stream_end', (data) => self.postMessage({ type: 'STREAM_END', data }));
        socket.on('stream_error', (data) => self.postMessage({ type: 'STREAM_ERROR', data }));

        socket.on('audio_chunk', (data: any) => {
            try {
                // OFF-THREAD DECODING: Base64 decoding happens here
                const audioData = atob(data.audioB64);
                const arrayBuffer = new ArrayBuffer(audioData.length);
                const view = new Uint8Array(arrayBuffer);
                for (let i = 0; i < audioData.length; i++) {
                    view[i] = audioData.charCodeAt(i);
                }
                
                // TRANSFER: Send to main thread as transferable ArrayBuffer
                // using the options object to avoid ambiguity with window.postMessage
                self.postMessage({ 
                    type: 'AUDIO_CHUNK', 
                    data: { ...data, audioBuffer: arrayBuffer }
                }, { transfer: [arrayBuffer] } as any);
            } catch (err) {
                console.error('Worker failed to decode audio chunk:', err);
                self.postMessage({ type: 'DECODE_ERROR', error: 'atob_failed' });
            }
        });
    }

    if (type === 'EMIT' && socket?.connected) {
        const { event, data } = payload;
        socket.emit(event, data);
    }

    if (type === 'DISCONNECT') {
        socket?.disconnect();
        socket = null;
    }
};
