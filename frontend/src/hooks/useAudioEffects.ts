import { useEffect, useRef } from 'react';
import { useMoodStore } from '../stores/moodStore';
import { getAudioGraph } from '../audio/SharedAudioGraph';

/**
 * useAudioEffects: UPDATED to use SharedAudioGraph (Phase 2 Safe)
 * 
 * Replaces the previous version. Now all audio-reactive logic
 * for filters, reverb, and pitch is consolidated.
 */
const CREEPY_PERSONAS = new Set([
  'DORODERE', 'SADODERE', 'FEAR', 'YANDERE', 'YANDERE_STALKER'
]);

export const useAudioEffects = (audioElement: HTMLAudioElement | null) => {
  const pitchRafRef = useRef(0);

  useEffect(() => {
    if (!audioElement) return;
    // Graph is already built by useVoiceVolume — this call is free (returns singleton)
    // No wiring needed here, just return cleanup
    return () => cancelAnimationFrame(pitchRafRef.current);
  }, [audioElement]);

  useEffect(() => {
    if (!audioElement) return;

    const { ctx, filter, dryGain, wetGain } = getAudioGraph(audioElement);
    const persona = (() => {
      const m = useMoodStore.getState().mascot;
      return (m?.emotion || m?.action || 'DEFAULT').toUpperCase();
    })();

    const isCreepy = CREEPY_PERSONAS.has(persona);
    const now = ctx.currentTime;
    const rampEnd = now + 0.8; // 800ms smooth transition

    // ── Low-pass filter ──────────────────────────────────────────────────────
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(filter.frequency.value, now);
    filter.frequency.linearRampToValueAtTime(isCreepy ? 2600 : 20000, rampEnd);

    // ── Wet/dry reverb mix ───────────────────────────────────────────────────
    dryGain.gain.cancelScheduledValues(now);
    wetGain.gain.cancelScheduledValues(now);
    dryGain.gain.setValueAtTime(dryGain.gain.value, now);
    wetGain.gain.setValueAtTime(wetGain.gain.value, now);
    dryGain.gain.linearRampToValueAtTime(isCreepy ? 0.38 : 1.0, rampEnd);
    wetGain.gain.linearRampToValueAtTime(isCreepy ? 0.72 : 0.0, rampEnd);

    // ── Pitch via playbackRate (rAF animation — Web Audio has no ramp for this) ──
    cancelAnimationFrame(pitchRafRef.current);
    const targetPitch = isCreepy ? 0.87 : 1.0;
    const startRate = audioElement.playbackRate;
    const startTime = performance.now();
    const duration = 800;

    const animatePitch = (nowTick: number) => {
      const p = Math.min((nowTick - startTime) / duration, 1.0);
      // Ease out cubic for a natural deceleration
      const eased = 1 - Math.pow(1 - p, 3);
      audioElement.playbackRate = startRate + (targetPitch - startRate) * eased;
      if (p < 1) pitchRafRef.current = requestAnimationFrame(animatePitch);
    };
    pitchRafRef.current = requestAnimationFrame(animatePitch);

  }, [
    // Re-run when persona changes — read it from store directly to avoid stale closure
    useMoodStore.getState().mascot?.emotion,
    useMoodStore.getState().mascot?.action,
    audioElement
  ]);
};
