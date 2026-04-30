export class LipSyncAnalyzer {
  private static instance: LipSyncAnalyzer;

  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private worker: Worker | null = null;

  public currentVisemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
  private _lastDebugLog = 0;

  private constructor() {
    try {
      // Standard Vite-compatible worker initialization
      this.worker = new Worker(new URL('../workers/LipSyncWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        this.currentVisemes = e.data;
      };
      console.log(' LipSyncAnalyzer: Web Worker initialized');
    } catch (err) {
      console.error('Failed to initialize LipSyncWorker:', err);
    }
  }

  public static getInstance(): LipSyncAnalyzer {
    if (!LipSyncAnalyzer.instance) {
      LipSyncAnalyzer.instance = new LipSyncAnalyzer();
    }
    return LipSyncAnalyzer.instance;
  }

  public connect(audioContext: AudioContext, sourceNode: AudioNode) {
    if (!this.analyser || this.analyser.context !== audioContext) {
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(audioContext.destination);
      console.log(' LipSyncAnalyzer: New analyser connected');
    }
    sourceNode.connect(this.analyser);
    console.log(' LipSyncAnalyzer: source wired to analyser');
  }

  public update(deltaTime: number) {
    if (!this.analyser || !this.dataArray || !this.worker) return this.currentVisemes;

    // Web Audio API reading must occur on the main thread
    // @ts-ignore
    this.analyser.getByteFrequencyData(this.dataArray);

    // Offload the math & interpolation to the worker
    this.worker.postMessage({ dataArray: this.dataArray, deltaTime });

    this._lastDebugLog += deltaTime;
    if (this._lastDebugLog > 1.0) {
      this._lastDebugLog = 0;
      // Logging could be done here if needed
    }

    return this.currentVisemes;
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
