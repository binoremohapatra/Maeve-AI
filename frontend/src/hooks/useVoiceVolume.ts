import { useEffect, useRef } from 'react';
import { useMoodStore } from '../stores/moodStore';
import { getAudioGraph } from '../audio/SharedAudioGraph';

export const useVoiceVolume = (audioElement: HTMLAudioElement | null) => {
  const smoothed = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!audioElement) {
      useMoodStore.getState().setVoiceVolume(0);
      return;
    }

    try {
      // Use the unified global singleton to completely prevent InvalidStateError crashes
      // and prevent dual-creation of Web Audio elements which exhausts browser limits.
      const graph = getAudioGraph(audioElement);
      const analyser = graph.analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const s = (buf[i] - 128) / 128;
          sum += s * s;
        }
        const rms = Math.sqrt(sum / buf.length);

        // Fast attack (0.35), slow decay (0.05)
        const attack = rms > smoothed.current ? 0.35 : 0.05;
        smoothed.current += (rms - smoothed.current) * attack;

        useMoodStore.getState().setVoiceVolume(smoothed.current);
        rafRef.current = requestAnimationFrame(tick);
      };

      // Resume context if browser required user interaction
      if (graph.ctx.state === 'suspended') {
        graph.ctx.resume();
      }

      rafRef.current = requestAnimationFrame(tick);

    } catch (err) {
      console.warn('[useVoiceVolume] Audio Graph Error (Safely Caught):', err);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      useMoodStore.getState().setVoiceVolume(0);
    };
  }, [audioElement]);
};