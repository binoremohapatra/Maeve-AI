import { useEffect, useRef } from 'react';
import { getAudioGraph } from '../audio/SharedAudioGraph';
import { useMoodStore } from '../stores/moodStore';

export interface Visemes {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
}

export function useLipSync(audioElement: HTMLAudioElement | null) {
  // We use objects, but we will ONLY mutate their properties to prevent reference loss
  const visemes = useRef<Visemes>({ aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
  const targetVisemes = useRef<Visemes>({ aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });

  const audioGraphRef = useRef<any>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    //  1. THE UNMOUNT FREEZE FIX: Explicitly slam mouth shut if no audio
    if (!audioElement) {
      targetVisemes.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
      visemes.current.aa = 0;
      visemes.current.ee = 0;
      visemes.current.ih = 0;
      visemes.current.oh = 0;
      visemes.current.ou = 0;
      return;
    }

    const graph = getAudioGraph(audioElement);
    audioGraphRef.current = graph;

    if (!dataArrayRef.current || dataArrayRef.current.length !== graph.analyser.frequencyBinCount) {
      dataArrayRef.current = new Uint8Array(graph.analyser.frequencyBinCount);
    }

    const audioCtx = graph.ctx;
    const analyser = graph.analyser;

    const handlePlay = async () => { if (audioCtx.state === 'suspended') await audioCtx.resume(); };
    const handleEndedOrPause = () => {
      // Instantly target closed mouth on pause/end
      targetVisemes.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handleEndedOrPause);
    audioElement.addEventListener('ended', handleEndedOrPause);

    let animationFrameId: number;
    let lastTime = performance.now();

    const updateLoop = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      //  2. THE AUDIO ACTIVE GATE
      if (!audioElement.paused && !audioElement.ended && dataArrayRef.current) {
        // @ts-ignore
        analyser.getByteFrequencyData(dataArrayRef.current);

        const binSize = audioCtx.sampleRate / 2 / analyser.frequencyBinCount;

        const getBandEnergy = (startHz: number, endHz: number) => {
          const startBin = Math.max(0, Math.floor(startHz / binSize));
          const endBin = Math.min(analyser.frequencyBinCount, Math.ceil(endHz / binSize));
          let e = 0;
          for (let i = startBin; i < endBin; i++) e += dataArrayRef.current![i];
          return e / (Math.max(1, endBin - startBin) * 255.0);
        };

        const bass = getBandEnergy(80, 250);
        const mid = getBandEnergy(250, 1200);
        const high = getBandEnergy(1200, 3500);
        const sibilance = getBandEnergy(3500, 8000);

        const totalEnergy = bass + mid + high;

        //  HIGHER NOISE GATE: Filters out background static/breathing
        if (totalEnergy < 0.1) {
          targetVisemes.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
        } else {
          //  3. NaN CORRUPTION FIX: Prevent divide by zero
          const safeEnergy = totalEnergy || 1.0;

          const nBass = bass / safeEnergy;
          const nMid = mid / safeEnergy;
          const nHigh = high / safeEnergy;

          const volMult = Math.min(1.0, totalEnergy * 1.5);

          let aa = nMid * volMult * 0.8;
          let ee = nHigh * volMult * 1.2;
          let oh = nBass * volMult * 1.5;
          let ou = (nBass * 0.8) * volMult;
          let ih = sibilance * 1.5 * volMult;

          const maxShape = Math.max(aa, ee, oh, ih, ou);

          if (maxShape === oh || maxShape === ou) {
            aa *= 0.1; ee = 0; ih *= 0.2;
            oh = Math.min(0.7, oh);
          }
          else if (maxShape === ee || maxShape === ih) {
            oh = 0; ou = 0; aa *= 0.2;
            ee = Math.min(0.6, ee);
          }
          else {
            oh *= 0.2; ou = 0; ee *= 0.3;
            aa = Math.min(0.65, aa);
          }

          let plosiveDampener = 1.0;
          
          //  DYNAMIC STORE READ: Don't rely on React state/props to avoid re-renders!
          const text = useMoodStore.getState().mascot?.replyText || "";

          //  4. DURATION NaN FIX: Ensure duration is fully loaded before calculating
          if (text && text.length > 0 && audioElement.duration && isFinite(audioElement.duration)) {
            const progress = audioElement.currentTime / audioElement.duration;
            const charIndex = Math.floor(progress * text.length);

            const charWindow = text.substring(Math.max(0, charIndex - 1), charIndex + 2).toLowerCase();
            if (/[pbm]/.test(charWindow)) {
              plosiveDampener = 0.0;
            }
          }

          //  5. FALLBACK 0: Ensure absolutely no NaNs enter the target object
          targetVisemes.current = {
            aa: (aa * plosiveDampener) || 0,
            ee: (ee * plosiveDampener) || 0,
            ih: (ih * plosiveDampener) || 0,
            oh: (oh * plosiveDampener) || 0,
            ou: (ou * plosiveDampener) || 0
          };
        }
      } else {
        //  6. FORCED SHUTDOWN: If paused/ended, aggressively command lips to close
        targetVisemes.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
      }

      // Smooth Lerp (This keeps running even if audio is paused, allowing lips to close smoothly)
      const lerpSpeed = 18;
      const factor = 1.0 - Math.exp(-lerpSpeed * deltaTime);

      visemes.current.aa += (targetVisemes.current.aa - visemes.current.aa) * factor;
      visemes.current.ee += (targetVisemes.current.ee - visemes.current.ee) * factor;
      visemes.current.ih += (targetVisemes.current.ih - visemes.current.ih) * factor;
      visemes.current.oh += (targetVisemes.current.oh - visemes.current.oh) * factor;
      visemes.current.ou += (targetVisemes.current.ou - visemes.current.ou) * factor;

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handleEndedOrPause);
      audioElement.removeEventListener('ended', handleEndedOrPause);
    };
  }, [audioElement]);

  return visemes;
}
