/**
 * SharedAudioGraph.ts: Singleton Web Audio graph (Crash-Proof Version)
 */

export interface AudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode | null;
  analyser: AnalyserNode;
  filter: BiquadFilterNode;
  reverb: ConvolverNode;
  dryGain: GainNode;
  wetGain: GainNode;
}

// Global Singletons. We NEVER destroy these to prevent AudioContext limit exhaustion and GC spikes.
let sharedCtx: AudioContext | null = null;
let sharedNodes: AudioGraph | null = null;
let boundElement: HTMLAudioElement | null = null;

export function getAudioGraph(audio: HTMLAudioElement): AudioGraph {
  // 1. Return existing graph if already built for this exact element
  if (sharedNodes && boundElement === audio) return sharedNodes;

  // 2. Build the permanent AudioContext and core nodes once for the entire app lifecycle
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const analyser = sharedCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;

    const filter = sharedCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;

    // Synthetic reverb IR
    const irLen = sharedCtx.sampleRate * 2;
    const irBuffer = sharedCtx.createBuffer(2, irLen, sharedCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = irBuffer.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.2);
      }
    }
    const reverb = sharedCtx.createConvolver();
    reverb.buffer = irBuffer;

    const dryGain = sharedCtx.createGain();
    const wetGain = sharedCtx.createGain();
    dryGain.gain.value = 1.0;
    wetGain.gain.value = 0.0;

    analyser.connect(filter);
    filter.connect(dryGain);
    filter.connect(reverb);
    reverb.connect(wetGain);
    dryGain.connect(sharedCtx.destination);
    wetGain.connect(sharedCtx.destination);

    sharedNodes = { ctx: sharedCtx, analyser, filter, reverb, dryGain, wetGain, source: null };
  }

  // 3. Disconnect previous <audio> element safely
  if (sharedNodes!.source) {
    try {
      sharedNodes!.source.disconnect();
    } catch { /* ignore */ }
  }

  // 4. Attach the NEW <audio> element safely
  let source: MediaElementAudioSourceNode | null = null;
  
  try {
    // Check if we already tagged this HTML element with a source node
    if ((audio as any).__webAudioSourceNode) {
      source = (audio as any).__webAudioSourceNode;
    } else {
      source = sharedCtx.createMediaElementSource(audio);
      (audio as any).__webAudioSourceNode = source;
    }

    // Wire topology safely
    if (source) source.connect(sharedNodes!.analyser);
  } catch (e) {
    console.warn(" Web Audio API Guard: Element already connected. Preventing fatal crash.", e);
  }

  sharedNodes!.source = source;
  boundElement = audio;
  
  return sharedNodes!;
}

export function destroyAudioGraph() {
  if (!sharedNodes) return;
  // We ONLY disconnect the source. We DO NOT close the AudioContext.
  // Closing and recreating AudioContext causes massive browser freezing and crashes.
  try {
    if (sharedNodes.source) sharedNodes.source.disconnect();
  } catch { /* ignore */ }
  sharedNodes.source = null;
  boundElement = null;
}
