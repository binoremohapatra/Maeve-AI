import { useEffect, useRef } from 'react';
import { useMoodStore } from '../../stores/moodStore';

interface OverlayConfig {
  vignetteColor: string;
  vignetteOpacity: number;
  vignetteSize: string;
  filmGrain: number;
  heartbeatAmplitude: number;  // opacity pulse depth
  heartbeatSqueezeAmt: number; // scale squeeze 0–0.015 (subtle!)
  heartbeatBpm: number;
  glitchEnabled: boolean;
  glitchIntervalBase: number;  // ms — actual interval = base + rand(0, base*0.6)
  saturationFilter: string;
  brightnessFilter: string;
  focusBlur: number;           // px of backdrop-filter blur on vignette div
}

const OVERLAY_CONFIGS: Record<string, OverlayConfig> = {
  // ── EXISTING (updated) ───────────────────────────────────────────────────
  YANDERE: {
    vignetteColor: '80,0,15',       
    vignetteOpacity: 0.80, vignetteSize: '42%',
    filmGrain: 0.14,
    heartbeatAmplitude: 0.20,       heartbeatSqueezeAmt: 0.012,
    heartbeatBpm: 90,
    glitchEnabled: true,            glitchIntervalBase: 3000,
    saturationFilter: 'saturate(1.45)',
    brightnessFilter: 'brightness(0.86)',
    focusBlur: 0,
  },
  YANDERE_STALKER: {
    vignetteColor: '60,0,10',       
    vignetteOpacity: 0.90, vignetteSize: '35%',
    filmGrain: 0.20,
    heartbeatAmplitude: 0.25,       heartbeatSqueezeAmt: 0.015,
    heartbeatBpm: 100,
    glitchEnabled: true,            glitchIntervalBase: 2000,
    saturationFilter: 'saturate(1.65)',
    brightnessFilter: 'brightness(0.80)',
    focusBlur: 0,
  },
  KAMIDERE: {
    vignetteColor: '200,150,0',     
    vignetteOpacity: 0.28, vignetteSize: '62%',
    filmGrain: 0.02,
    heartbeatAmplitude: 0.04,       heartbeatSqueezeAmt: 0.002,
    heartbeatBpm: 52,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.18)',
    brightnessFilter: 'brightness(1.06)',
    focusBlur: 0,
  },
  KUUDERE: {
    vignetteColor: '10,20,50',      
    vignetteOpacity: 0.55, vignetteSize: '50%',
    filmGrain: 0.04,
    heartbeatAmplitude: 0.03,       heartbeatSqueezeAmt: 0.001,
    heartbeatBpm: 44,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.55)',
    brightnessFilter: 'brightness(0.92) contrast(1.05)',
    focusBlur: 0,
  },
  LUST: {
    vignetteColor: '80,0,40',       
    vignetteOpacity: 0.55, vignetteSize: '45%',
    filmGrain: 0.05,
    heartbeatAmplitude: 0.10,       heartbeatSqueezeAmt: 0.006,
    heartbeatBpm: 78,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.2)',
    brightnessFilter: 'brightness(0.94)',
    focusBlur: 0,
  },
  SADODERE: {
    vignetteColor: '5,5,20',        
    vignetteOpacity: 0.85, vignetteSize: '38%',
    filmGrain: 0.22,
    heartbeatAmplitude: 0.06,       heartbeatSqueezeAmt: 0.004,
    heartbeatBpm: 38,
    glitchEnabled: true,            glitchIntervalBase: 4500,
    saturationFilter: 'saturate(0.28)',
    brightnessFilter: 'brightness(0.80) contrast(1.18)',
    focusBlur: 0,
  },
  SAD: {
    vignetteColor: '8,12,30',       
    vignetteOpacity: 0.45, vignetteSize: '52%',
    filmGrain: 0.03,
    heartbeatAmplitude: 0.02,       heartbeatSqueezeAmt: 0.001,
    heartbeatBpm: 48,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.65)',
    brightnessFilter: 'brightness(0.94)',
    focusBlur: 0,
  },
  FEAR: {
    vignetteColor: '5,5,15',        
    vignetteOpacity: 0.70, vignetteSize: '38%',
    filmGrain: 0.14,
    heartbeatAmplitude: 0.16,       heartbeatSqueezeAmt: 0.010,
    heartbeatBpm: 118,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.38)',
    brightnessFilter: 'brightness(0.84)',
    focusBlur: 3.5,                 // fear = tunnel vision
  },

  // ── NEW PERSONAS ──────────────────────────────────────────────────────────
  TSUNDERE: {
    vignetteColor: '180,60,0',      
    vignetteOpacity: 0.65, vignetteSize: '44%',
    filmGrain: 0.06,
    heartbeatAmplitude: 0.18,       heartbeatSqueezeAmt: 0.010,
    heartbeatBpm: 105,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.55)',
    brightnessFilter: 'brightness(0.92) contrast(1.08)',
    focusBlur: 0,
  },
  FRUSTRATED: {
    vignetteColor: '150,45,0',      
    vignetteOpacity: 0.58, vignetteSize: '46%',
    filmGrain: 0.05,
    heartbeatAmplitude: 0.15,       heartbeatSqueezeAmt: 0.008,
    heartbeatBpm: 98,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.40)',
    brightnessFilter: 'brightness(0.94)',
    focusBlur: 0,
  },
  ANGRY: {
    vignetteColor: '130,30,0',      
    vignetteOpacity: 0.60, vignetteSize: '45%',
    filmGrain: 0.07,
    heartbeatAmplitude: 0.16,       heartbeatSqueezeAmt: 0.009,
    heartbeatBpm: 100,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.45)',
    brightnessFilter: 'brightness(0.90) contrast(1.10)',
    focusBlur: 0,
  },
  DANDERE: {
    vignetteColor: '15,15,35',      
    vignetteOpacity: 0.75, vignetteSize: '40%',
    filmGrain: 0.06,
    heartbeatAmplitude: 0.04,       heartbeatSqueezeAmt: 0.002,
    heartbeatBpm: 42,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.35) grayscale(0.5)',
    brightnessFilter: 'brightness(0.88) contrast(0.95)',
    focusBlur: 2.5,                  
  },
  LONELY: {
    vignetteColor: '12,12,28',      
    vignetteOpacity: 0.68, vignetteSize: '42%',
    filmGrain: 0.05,
    heartbeatAmplitude: 0.03,       heartbeatSqueezeAmt: 0.001,
    heartbeatBpm: 40,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.40) grayscale(0.45)',
    brightnessFilter: 'brightness(0.90)',
    focusBlur: 2.0,
  },
  MELANCHOLY: {
    vignetteColor: '18,18,40',      
    vignetteOpacity: 0.60, vignetteSize: '44%',
    filmGrain: 0.04,
    heartbeatAmplitude: 0.03,       heartbeatSqueezeAmt: 0.001,
    heartbeatBpm: 44,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(0.50) grayscale(0.35)',
    brightnessFilter: 'brightness(0.92)',
    focusBlur: 1.5,
  },
  HIMEDERE: {
    vignetteColor: '160,100,0',     
    vignetteOpacity: 0.30, vignetteSize: '58%',
    filmGrain: 0.01,
    heartbeatAmplitude: 0.05,       heartbeatSqueezeAmt: 0.003,
    heartbeatBpm: 56,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.35)',
    brightnessFilter: 'brightness(1.08) contrast(1.12)',
    focusBlur: 0,
  },
  DOMINANT: {
    vignetteColor: '130,80,0',      
    vignetteOpacity: 0.28, vignetteSize: '60%',
    filmGrain: 0.01,
    heartbeatAmplitude: 0.04,       heartbeatSqueezeAmt: 0.002,
    heartbeatBpm: 55,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1.28)',
    brightnessFilter: 'brightness(1.06) contrast(1.10)',
    focusBlur: 0,
  },
  DORODERE: {
    vignetteColor: '80,20,60',      
    vignetteOpacity: 0.50, vignetteSize: '48%',
    filmGrain: 0.10,
    heartbeatAmplitude: 0.08,       heartbeatSqueezeAmt: 0.005,
    heartbeatBpm: 70,
    glitchEnabled: true,            glitchIntervalBase: 5500, 
    saturationFilter: 'saturate(1.10)',
    brightnessFilter: 'brightness(0.96)',
    focusBlur: 0,
  },
  TOXIC: {
    vignetteColor: '20,60,0',       
    vignetteOpacity: 0.55, vignetteSize: '46%',
    filmGrain: 0.08,
    heartbeatAmplitude: 0.07,       heartbeatSqueezeAmt: 0.004,
    heartbeatBpm: 68,
    glitchEnabled: true,            glitchIntervalBase: 4000,
    saturationFilter: 'saturate(0.90)',
    brightnessFilter: 'brightness(0.94) contrast(1.08)',
    focusBlur: 0,
  },

  DEFAULT: {
    vignetteColor: '0,0,0',         vignetteOpacity: 0.0,  vignetteSize: '60%',
    filmGrain: 0.0,
    heartbeatAmplitude: 0.0,        heartbeatSqueezeAmt: 0.0,
    heartbeatBpm: 60,
    glitchEnabled: false,           glitchIntervalBase: 0,
    saturationFilter: 'saturate(1)',
    brightnessFilter: 'brightness(1)',
    focusBlur: 0,
  },
};

export const PsychologicalOverlay = () => {
  const mascot  = useMoodStore(s => s.mascot);
  const persona = (mascot?.emotion || mascot?.action || 'DEFAULT').toUpperCase();

  const vignetteRef    = useRef<HTMLDivElement>(null);
  const grainRef       = useRef<HTMLDivElement>(null);
  const glitchRef      = useRef<HTMLDivElement>(null);
  const canvasWrapRef  = useRef<HTMLDivElement>(null); 

  const ls = useRef({
    opacity:    0,
    amplitude:  0,
    squeezeAmt: 0,
    filmGrain:  0,
    focusBlur:  0,
    personaKey: 'DEFAULT',
  });

  const glitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNextGlitch = (cfg: OverlayConfig) => {
    if (!cfg.glitchEnabled || cfg.glitchIntervalBase <= 0) return;
    
    const jitter   = cfg.glitchIntervalBase * 0.6 * Math.random();
    const interval = cfg.glitchIntervalBase + jitter;

    glitchTimer.current = setTimeout(() => {
      if (ls.current.personaKey !== persona) return; 
      
      const el = glitchRef.current;
      if (!el) return;
      el.style.opacity = '1';
      el.style.transform = `translate(${(Math.random()-0.5)*8}px, ${(Math.random()-0.5)*4}px)`;
      
      setTimeout(() => {
        if (el) { el.style.opacity = '0'; el.style.transform = 'none'; }
        setTimeout(() => {
          if (el) el.style.opacity = '1';
          setTimeout(() => {
            if (el) el.style.opacity = '0';
            scheduleNextGlitch(cfg); 
          }, 45);
        }, 85);
      }, 55);
    }, interval);
  };

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta    = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const cfg         = OVERLAY_CONFIGS[ls.current.personaKey] ?? OVERLAY_CONFIGS.DEFAULT;
      const lerpSpeed   = delta * 0.8;

      ls.current.opacity    += (cfg.vignetteOpacity    - ls.current.opacity)    * lerpSpeed;
      ls.current.amplitude  += (cfg.heartbeatAmplitude - ls.current.amplitude)  * lerpSpeed;
      ls.current.squeezeAmt += (cfg.heartbeatSqueezeAmt - ls.current.squeezeAmt) * lerpSpeed;
      ls.current.filmGrain  += (cfg.filmGrain           - ls.current.filmGrain)  * lerpSpeed;
      ls.current.focusBlur  += (cfg.focusBlur           - ls.current.focusBlur)  * lerpSpeed;

      const voiceVolume  = useMoodStore.getState().voiceVolume ?? 0;
      const audioOpacity = voiceVolume * 0.25;

      const beatHz    = cfg.heartbeatBpm / 60;
      const raw       = Math.sin(now * 0.001 * Math.PI * 2 * beatHz);
      const sharpened = Math.pow(Math.max(0, raw), 2.5); 
      const pulse     = sharpened * ls.current.amplitude;
      
      const finalOpacity = Math.min(ls.current.opacity + pulse + audioOpacity, 1.0);
      const squeeze      = sharpened * ls.current.squeezeAmt;

      if (vignetteRef.current) {
        vignetteRef.current.style.background =
          `radial-gradient(ellipse at center, 
             transparent ${cfg.vignetteSize}, 
             rgba(${cfg.vignetteColor},${finalOpacity.toFixed(3)}) 100%)`;
        
        const s = 1.0 + squeeze;
        vignetteRef.current.style.transform = `scale(${s.toFixed(4)})`;
        
        const blur = ls.current.focusBlur.toFixed(2);
        vignetteRef.current.style.backdropFilter = 
          ls.current.focusBlur > 0.1 ? `blur(${blur}px)` : '';
      }

      if (grainRef.current) {
        grainRef.current.style.opacity = ls.current.filmGrain.toFixed(3);
        const shift = ((now * 0.2) % 200).toFixed(0);
        grainRef.current.style.backgroundPosition = `${shift}px ${shift}px`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); 

  useEffect(() => {
    ls.current.personaKey = persona;
    const cfg = OVERLAY_CONFIGS[persona] ?? OVERLAY_CONFIGS.DEFAULT;

    if (glitchTimer.current) clearTimeout(glitchTimer.current);

    if (canvasWrapRef.current) {
      canvasWrapRef.current.style.transition = 'filter 2.5s ease';
      canvasWrapRef.current.style.filter = `${cfg.saturationFilter} ${cfg.brightnessFilter}`;
    }

    scheduleNextGlitch(cfg);
    return () => { if (glitchTimer.current) clearTimeout(glitchTimer.current); };
  }, [persona]);

  useEffect(() => {
    const el = document.querySelector('[data-aura-wrap]') as HTMLDivElement | null;
    if (el) {
      (canvasWrapRef as any).current = el;
    }
  }, []);

  return (
    <>
      <div 
        ref={vignetteRef}
        style={{
          position: 'absolute', inset: '-5%', 
          pointerEvents: 'none',
          zIndex: 51,
          transformOrigin: 'center center',
          willChange: 'transform, background', 
        }}
      />
      <div 
        ref={grainRef}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          zIndex: 52,
          opacity: 0,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          willChange: 'opacity',
        }}
      />
      <div 
        ref={glitchRef}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          zIndex: 53,
          opacity: 0,
          boxShadow: 'inset 5px 0 0 rgba(255,0,60,0.22), inset -5px 0 0 rgba(0,220,255,0.22)',
          mixBlendMode: 'screen',
          willChange: 'opacity, transform',
        }}
      />
    </>
  );
};
