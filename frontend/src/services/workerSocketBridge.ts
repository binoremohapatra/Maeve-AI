export type WorkerMessageHandler = (data: any) => void;

class WorkerSocketBridge {
    private static instance: WorkerSocketBridge;
    private worker: Worker | null = null;
    private handlers: Map<string, WorkerMessageHandler[]> = new Map();
    private _isConnected = false;

    private constructor() {
        this.init();
    }

    public static getInstance(): WorkerSocketBridge {
        if (!WorkerSocketBridge.instance) {
            WorkerSocketBridge.instance = new WorkerSocketBridge();
        }
        return WorkerSocketBridge.instance;
    }

    private init() {
        if (typeof window === 'undefined') return;

        try {
            this.worker = new Worker(new URL('../workers/websocketWorker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e) => {
                const { type, data } = e.data;
                
                if (type === 'CONNECTED') this._isConnected = true;
                if (type === 'DISCONNECTED') this._isConnected = false;

                const eventHandlers = this.handlers.get(type);
                if (eventHandlers) {
                    eventHandlers.forEach(handler => handler(data));
                }
            };

            this.worker.postMessage({ type: 'INIT' });
        } catch (err) {
            console.error('Failed to initialize WebSocket Worker:', err);
        }
    }

    public on(type: string, handler: WorkerMessageHandler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
    }

    public off(type: string, handler: WorkerMessageHandler) {
        const h = this.handlers.get(type);
        if (h) {
            this.handlers.set(type, h.filter(x => x !== handler));
        }
    }

    public emit(event: string, data: any) {
        this.worker?.postMessage({ type: 'EMIT', payload: { event, data } });
    }

    public isConnected(): boolean {
        return this._isConnected;
    }

    public disconnect() {
        this.worker?.postMessage({ type: 'DISCONNECT' });
    }
}

export const workerSocketBridge = WorkerSocketBridge.getInstance();
