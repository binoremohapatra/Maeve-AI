import { useRef, useMemo, createRef, useEffect } from 'react';
import { useFrame, createPortal } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMoodStore } from '../../stores/moodStore';

interface VFXProps {
  vrm: any;
  emotion: string;
}

export const AnimeVFXSuite = ({ vrm, emotion }: VFXProps) => {
  const isLowEnd = useMoodStore(s => s.isLowEnd);

  // ─── REFS ────────────────────────────────────────────────────────────────
  const angerRef = useRef<THREE.Group>(null);
  const sweatRef = useRef<THREE.Group>(null);
  const droolRef = useRef<THREE.Group>(null);
  const bubbleRef = useRef<THREE.Mesh>(null);
  const steamLRef = useRef<THREE.Mesh>(null);
  const steamRRef = useRef<THREE.Mesh>(null);
  const tearGroupRef = useRef<THREE.Group>(null);
  const zRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  const tearSlide = useRef(0);
  const droolSlide = useRef(0); //  Naya ref drool tapkane ke liye
  const zOffsets = useRef([0, 1.8, 3.6]);
  const prevAnxious = useRef(false);
  const shockGlowRef = useRef<THREE.Mesh>(null);
  const shockSteamRef = useRef<THREE.Group>(null);
  const shockTimer = useRef(0);
  const sweatTimer = useRef(0);

  // ── NEW REFS ──
  const symbolRef = useRef<THREE.Mesh>(null);
  const symbolPrev = useRef('');
  const symbolPop = useRef(0);

  const heartParticles = useMemo(() =>
    Array.from({ length: isLowEnd ? 2 : 5 }, (_, i) => ({
      phase: i * (isLowEnd ? 0.5 : 0.2),
      xSeed: (i % 2 === 0 ? -1 : 1) * (0.03 + i * 0.015),
      ref: createRef<THREE.Mesh>(),
    })), [isLowEnd]);

  const raindrops = useMemo(() =>
    Array.from({ length: isLowEnd ? 1 : 3 }, (_, i) => ({
      phase: i * 0.33,
      xOff: (i - 1) * 0.018,
      ref: createRef<THREE.Mesh>(),
    })), [isLowEnd]);

  const sparkleParticles = useMemo(() =>
    Array.from({ length: isLowEnd ? 2 : 6 }, (_, i) => ({
      phase: i * (isLowEnd ? 0.5 : 0.16),
      side: i % 2 === 0 ? -1 : 1,
      yLevel: 0.05 + (Math.floor(i / 2)) * 0.06,
      ref: createRef<THREE.Mesh>(),
    })), [isLowEnd]);

  const musicParticles = useMemo(() =>
    Array.from({ length: isLowEnd ? 4 : 12 }, (_, i) => ({
      phase: ((i % 6) / 6) * Math.PI * 2,
      ring: i < (isLowEnd ? 2 : 6) ? 'inner' : 'outer',
      ref: createRef<THREE.Mesh>(),
    })), [isLowEnd]);

  // ── NEW ADVANCED REFS ──
  const earSteamLRef = useRef<THREE.Mesh>(null);
  const earSteamRRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const iceParticles = useMemo(() =>
    Array.from({ length: isLowEnd ? 3 : 8 }, (_, i) => ({
      ref: createRef<THREE.Mesh>(),
      phase: i / (isLowEnd ? 3 : 8),
      xDir: (Math.random() - 0.5) * 0.04,
      yDir: (Math.random() - 0.5) * 0.02,
    })), [isLowEnd]);
  const glitchRef = useRef<THREE.Group>(null);
  const earSteamTimer = useRef(0);
  const auraRot = useRef(0);
  const hatchingGroupRef = useRef<THREE.Group>(null);
  const leftHornRef = useRef<THREE.Mesh>(null);
  const rightHornRef = useRef<THREE.Mesh>(null);
  const crownRef = useRef<THREE.Group>(null);

  // ─── EMOTION FLAGS ───────────────────────────────────────────────────────
  const e = emotion?.toUpperCase() || '';

  const isAngry = ['ANGRY', 'FRUSTRATED', 'DISGUST', 'ARGUING'].includes(e);
  const isAnxious = ['FLUSTERED', 'ANXIOUS', 'AWKWARDNESS', 'FUANDERE', 'NERVOUS'].includes(e);
  const isYandere = ['YANDERE', 'DARK_DEVOTION', 'COLD_ANGER', 'POSSESSIVE_KUBRICK', 'POSSESSIVE'].includes(e);
  const isBlushing = ['SHY_BASHFUL', 'LOVESTRUCK', 'LUST', 'AHEGAO', 'SHY', 'HAJIDERE'].includes(e);

  const isAhegao = ['AHEGAO', 'ECSTASY'].includes(e);
  const isLust = ['LUST', 'SEXY', 'LOVESTRUCK', 'PLEASURE'].includes(e);
  const isShock = ['SHOCKED', 'FEAR', 'SURPRISED', 'TERROR'].includes(e);
  const isSleepy = ['SLEEPY', 'SLEEPING', 'WAKING_UP'].includes(e);
  const isCrying = ['CRYING', 'TEARY', 'HURT'].includes(e);  // SAD removed — no tears for light sadness

  // ── NEW FLAGS ──
  const isLovestruck = ['LOVESTRUCK', 'AMADERE', 'LOVE'].includes(e);
  const isGloomy = ['MELANCHOLY', 'LONELY', 'DANDERE', 'SAD', 'HURT'].includes(e);
  const isHappy = ['EXCITED', 'PROUD', 'ADVENTUROUS', 'JOY', 'HAPPY'].includes(e);
  const isThinking = ['CONFUSED', 'SURPRISED', 'THINKING', 'SHOCKED', 'MILDLY_SURPRISED'].includes(e);

  // ── NEW PERSONA FLAGS ──
  const isGodMode = ['KAMIDERE', 'PROUD'].includes(e);
  const isDevious = ['TOXIC', 'SADODERE', 'GOTH_MOMMY', 'COLD_ANGER'].includes(e);
  const isEvil = ['EVIL', 'DEMONIC', 'SADISTIC'].includes(e);
  const isDominant = ['DOMINANT', 'BOSS', 'MISTRESS', 'QUEEN', 'HIMEDERE'].includes(e);
  const isSerious = ['SERIOUS', 'KUUDERE', 'STOIC', 'DETERMINED', 'FOCUSED', 'INDEPENDENT'].includes(e);

  // ── PERSONA ARCHETYPE FLAGS ──
  const isTsundere = ['TSUNDERE', 'FRUSTRATED', 'ANGRY', 'NARUDERE'].includes(e);
  const isKuudere = ['KUUDERE', 'COLD_ANGER', 'BUTSUDERE', 'INDEPENDENT'].includes(e);
  const isKichidere = ['KICHIDERE', 'EXCITED', 'ADVENTUROUS'].includes(e);
  const isSadodere = ['SADODERE'].includes(e);
  const isYandereWorship = ['YANDERE_WORSHIP', 'YANDERE_STALKER'].includes(e);

  // Add KICHIDERE to the isHappy logical group
  const isHappyWithExtra = isHappy || isKichidere;

  // ═══════════════════════════════════════════════════════════════════════
  //  TEXTURES
  // ═══════════════════════════════════════════════════════════════════════

  const shadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.3, 'rgba(10, 0, 30, 0.5)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.9)');
    grad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 512; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 150);
      ctx.lineTo(i, 380);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  //  ANIME CHEEK BLUSH: Curved cylinder wrap to perfectly hug the face
  const blushTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);

    // ── Wide horizontal gradient that wraps around the cylinder ──
    ctx.save();
    ctx.translate(256, 128);
    ctx.scale(1, 0.45);  // Squashed vertically to form a band
    const oval = ctx.createRadialGradient(0, 0, 0, 0, 0, 240);
    // Soft, realistic anime flush color
    oval.addColorStop(0, 'rgba(255,  90, 110, 0.75)'); // Center (nose)
    oval.addColorStop(0.35, 'rgba(255, 100, 120, 0.55)'); // Inner cheeks
    oval.addColorStop(0.70, 'rgba(255, 120, 140, 0.20)'); // Outer cheeks
    oval.addColorStop(1, 'rgba(255, 160, 180, 0.00)'); // Fade out
    ctx.beginPath();
    ctx.arc(0, 0, 240, 0, Math.PI * 2);
    ctx.fillStyle = oval;
    ctx.fill();
    ctx.restore();

    // ── Dense, fine anime diagonal hatching lines (////) ──
    ctx.lineWidth = 2.5; // Thicker lines
    ctx.lineCap = 'round';

    // Draw lines across the ENTIRE cheek and nose area
    for (let i = -160; i <= 160; i += 12) { // SPACED OUT so they don't blur into a solid block
      // Fade lines out near the edges
      const alpha = Math.max(0, 1 - Math.pow(Math.abs(i) / 160, 2));
      ctx.strokeStyle = `rgba(160, 10, 30, ${0.95 * alpha})`; // Much darker red so they pop out

      const heightOffset = Math.max(10, 40 - Math.abs(i) * 0.15); // Standard height

      ctx.beginPath();
      ctx.moveTo(256 + i - 15, 128 - heightOffset);
      ctx.lineTo(256 + i + 15, 128 + heightOffset);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Pre-curved geometry for the blush so it hugs the cheeks perfectly.
  // We use a cylinder segment translated so its origin is at the front surface.
  // This ensures it tracks the nose perfectly during head rotations without floating.
  const curvedBlushGeo = useMemo(() => {
    // Increased radius to 0.125 so the curve is gentler and doesn't slice into puffy cheeks
    const geo = new THREE.CylinderGeometry(0.125, 0.125, 0.05, 32, 1, true, -Math.PI / 3, Math.PI / 1.5);
    // Move the cylinder backwards by its radius so its local origin (0,0,0) is exactly at the front face (nose)
    geo.translate(0, 0, -0.125);
    return geo;
  }, []);

  const droolTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const strand = ctx.createLinearGradient(0, 0, 0, 200);
    strand.addColorStop(0.0, 'rgba(255,255,255,0.0)');
    strand.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    strand.addColorStop(0.9, 'rgba(255,255,255,0.40)');
    strand.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.bezierCurveTo(32, 30, 34, 80, 30, 140); ctx.bezierCurveTo(28, 200, 32, 215, 32, 230); ctx.bezierCurveTo(32, 245, 22, 250, 18, 240); ctx.bezierCurveTo(14, 250, 4, 245, 4, 230); ctx.bezierCurveTo(4, 215, 8, 200, 6, 140); ctx.bezierCurveTo(2, 80, 4, 30, 10, 0); ctx.closePath();
    ctx.fillStyle = strand; ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 5); ctx.bezierCurveTo(18, 50, 19, 120, 18, 190); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  }, []);



  const steamTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const puffs = [{ x: 90, y: 170, r: 60 }, { x: 140, y: 150, r: 52 }, { x: 175, y: 165, r: 46 }, { x: 112, y: 125, r: 38 }, { x: 158, y: 118, r: 34 }];
    puffs.forEach(({ x, y, r }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    return new THREE.CanvasTexture(canvas);
  }, []);

  const zzzTextures = useMemo(() =>
    (['Z', 'ZZ', 'ZZZ'] as string[]).map((text, idx) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.font = `900 ${28 + idx * 8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.strokeText(text, 64, 64);
      ctx.fillStyle = `rgba(${170 - idx * 15},${185 - idx * 10},240,0.9)`; ctx.fillText(text, 64, 64);
      return new THREE.CanvasTexture(canvas);
    })
    , []);

  const purpleBlushTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(256, 200, 0, 256, 200, 220);
    grad.addColorStop(0, 'rgba(180, 0, 255, 0.65)');
    grad.addColorStop(0.5, 'rgba(140, 0, 255, 0.3)');
    grad.addColorStop(1, 'rgba(140, 0, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(160 + i * 28, 150);
      ctx.lineTo(130 + i * 28, 300);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);


  //  FIXED: Sahi Aansoo ki shape (Upar point, neeche round)
  const tearTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const cx = 64;

    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.bezierCurveTo(cx + 40, 100, cx + 50, 160, cx + 50, 190);
    ctx.arc(cx, 190, 50, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - 50, 160, cx - 40, 100, cx, 20);
    ctx.closePath();

    const grad = ctx.createLinearGradient(30, 20, 90, 240);
    grad.addColorStop(0.0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.5, 'rgba(200,220,255,0.3)');
    grad.addColorStop(1.0, 'rgba(200,220,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(45, 175, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── NEW TEXTURES ──
  const floatingHeartTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    const halo = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    halo.addColorStop(0, 'rgba(255, 100, 180, 0.40)'); halo.addColorStop(0.5, 'rgba(255, 60, 140, 0.15)'); halo.addColorStop(1.0, 'rgba(255, 60, 140, 0.00)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 128, 128);
    const drawH = () => {
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.bezierCurveTo(0, -20, -15, -20, -15, -8); ctx.bezierCurveTo(-15, 2, 0, 14, 0, 18);
      ctx.bezierCurveTo(0, 14, 15, 2, 15, -8); ctx.bezierCurveTo(15, -20, 0, -20, 0, -12); ctx.closePath();
    };
    ctx.save(); ctx.translate(64, 68); ctx.scale(1.8, 1.8); drawH(); ctx.restore(); ctx.fillStyle = 'rgba(180, 0, 70, 0.45)'; ctx.fill();
    ctx.save(); ctx.translate(64, 65); ctx.scale(1.8, 1.8); drawH(); ctx.restore();
    const hfill = ctx.createLinearGradient(40, 30, 90, 100);
    hfill.addColorStop(0.0, 'rgba(255, 140, 210, 1.0)'); hfill.addColorStop(0.5, 'rgba(255, 50, 140, 1.0)'); hfill.addColorStop(1.0, 'rgba(200, 0, 90, 1.0)');
    ctx.fillStyle = hfill; ctx.fill();
    ctx.beginPath(); ctx.arc(52, 46, 8, 0, Math.PI * 2);
    const sp = ctx.createRadialGradient(52, 46, 0, 52, 46, 8);
    sp.addColorStop(0, 'rgba(255,255,255,0.85)'); sp.addColorStop(1.0, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = sp; ctx.fill();
    return new THREE.CanvasTexture(c);
  }, []);

  const raincloudTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);
    const puffs = [{ x: 128, y: 72, r: 42 }, { x: 90, y: 60, r: 36 }, { x: 166, y: 60, r: 36 }, { x: 112, y: 44, r: 30 }, { x: 150, y: 44, r: 28 }, { x: 62, y: 72, r: 24 }, { x: 194, y: 72, r: 24 }];
    puffs.forEach(({ x, y, r }) => {
      const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
      g.addColorStop(0, 'rgba(90, 90, 110, 0.90)'); g.addColorStop(0.6, 'rgba(70, 70, 90, 0.80)'); g.addColorStop(1.0, 'rgba(50, 50, 70, 0.00)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    const shadow = ctx.createLinearGradient(0, 60, 0, 128);
    shadow.addColorStop(0, 'rgba(30, 30, 50, 0.00)'); shadow.addColorStop(1.0, 'rgba(30, 30, 50, 0.30)');
    ctx.fillStyle = shadow; ctx.fillRect(0, 0, 256, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  const raindropTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 64; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 64);
    ctx.beginPath(); ctx.moveTo(16, 4); ctx.bezierCurveTo(22, 16, 26, 32, 26, 42); ctx.arc(16, 42, 10, 0, Math.PI, false); ctx.bezierCurveTo(6, 32, 10, 16, 16, 4); ctx.closePath();
    const grad = ctx.createLinearGradient(8, 4, 24, 52);
    grad.addColorStop(0.0, 'rgba(160, 190, 230, 0.90)'); grad.addColorStop(0.5, 'rgba(100, 140, 200, 0.80)'); grad.addColorStop(1.0, 'rgba( 70, 110, 180, 0.60)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.arc(12, 18, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    return new THREE.CanvasTexture(c);
  }, []);

  const sparkleTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128); const cx = 64, cy = 64;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
    glow.addColorStop(0, 'rgba(255, 245, 150, 0.50)'); glow.addColorStop(0.4, 'rgba(255, 230, 80, 0.20)'); glow.addColorStop(1.0, 'rgba(255, 230, 80, 0.00)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    const drawStar = (x: number, y: number, outer: number, inner: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2; const r = i % 2 === 0 ? outer : inner;
        if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle)); else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
      }
      ctx.closePath();
    };
    drawStar(cx, cy, 52, 8);
    const starFill = ctx.createRadialGradient(cx - 8, cy - 8, 0, cx, cy, 52);
    starFill.addColorStop(0.0, 'rgba(255, 255, 255, 1.00)'); starFill.addColorStop(0.3, 'rgba(255, 250, 180, 0.95)'); starFill.addColorStop(0.7, 'rgba(255, 215, 50, 0.70)'); starFill.addColorStop(1.0, 'rgba(255, 200, 0, 0.00)');
    ctx.fillStyle = starFill; ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.translate(-cx, -cy); drawStar(cx, cy, 28, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'; ctx.fill();
    return new THREE.CanvasTexture(c);
  }, []);

  const symbolTextures = useMemo(() => {
    const makeSymbol = (text: string, color: string) => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 128);
      ctx.font = '900 72px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillText(text, 67, 69);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeText(text, 64, 64);
      const grad = ctx.createLinearGradient(32, 20, 96, 108);
      grad.addColorStop(0, color.replace('1.0', '1.0')); grad.addColorStop(1.0, color.replace('1.0', '0.75'));
      ctx.fillStyle = grad; ctx.fillText(text, 64, 64);
      return new THREE.CanvasTexture(c);
    };
    return {
      question: makeSymbol('?', 'rgba(255, 210,  60, 1.0)'),
      exclamation: makeSymbol('!', 'rgba(255,  80,  80, 1.0)'),
      thinking: makeSymbol('…', 'rgba(160, 200, 255, 1.0)'),
    };
  }, []);

  // ── NEW PERSONA TEXTURES ──
  const jawGloomTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, 'rgba(10, 0, 30, 0.9)');
    grad.addColorStop(1, 'rgba(10, 0, 30, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 256);
    return new THREE.CanvasTexture(c);
  }, []);

  const haloTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d')!;
    ctx.beginPath(); ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff066'; ctx.lineWidth = 14; ctx.stroke();
    ctx.shadowBlur = 18; ctx.shadowColor = '#fff'; ctx.stroke();
    return new THREE.CanvasTexture(c);
  }, []);



  const hatchingTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; // Dark Ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    //  CURVED MANGA LINES (Bezier Arcs)
    for (let i = -30; i < 160; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      // bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
      // Custom offsets to create a natural cheekbone curve
      ctx.bezierCurveTo(i + 20, 40, i - 10, 80, i - 5, 128);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
  }, []);

  // ── PERSONA ARCHETYPE TEXTURES ──

  const earSteamTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    const puffs = [{ x: 64, y: 90, r: 38 }, { x: 44, y: 64, r: 28 }, { x: 80, y: 58, r: 22 }, { x: 54, y: 36, r: 16 }, { x: 76, y: 30, r: 12 }];
    puffs.forEach(({ x, y, r }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,100,100,0.50)'); g.addColorStop(0.6, 'rgba(255,60,60,0.25)'); g.addColorStop(1.0, 'rgba(255,60,60,0.00)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    return new THREE.CanvasTexture(c);
  }, []);



  const frostTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    const cx = 64, cy = 64; ctx.strokeStyle = 'rgba(180,220,255,0.70)'; ctx.lineWidth = 1.5;
    for (let a = 0; a < 6; a++) {
      const angle = (a * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(cx, cy); const ex = cx + Math.cos(angle) * 52, ey = cy + Math.sin(angle) * 52; ctx.lineTo(ex, ey);
      for (let b = 0.3; b < 0.9; b += 0.3) {
        const bx = cx + Math.cos(angle) * 52 * b, by = cy + Math.sin(angle) * 52 * b; ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(angle + Math.PI / 3) * 14, by + Math.sin(angle + Math.PI / 3) * 14); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(angle - Math.PI / 3) * 14, by + Math.sin(angle - Math.PI / 3) * 14);
      }
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64); glow.addColorStop(0, 'rgba(200,235,255,0.30)'); glow.addColorStop(1.0, 'rgba(150,200,255,0.00)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }, []);

  //  DEEP PURPLE AURA RING
  const purpleAuraTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d')!;
    const cx = 128, cy = 128;
    // Multi-layered purple glow
    [100, 85, 70].forEach((r, i) => {
      const g = ctx.createRadialGradient(cx, cy, r - 8, cx, cy, r + 8);
      g.addColorStop(0, 'rgba(120, 0, 255, 0)');
      g.addColorStop(0.5, `rgba(160, 40, 255, ${0.8 - i * 0.2})`);
      g.addColorStop(1, 'rgba(120, 0, 255, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.arc(cx, cy, r - 8, 0, Math.PI * 2, true); ctx.fill();
    });
    return new THREE.CanvasTexture(c);
  }, []);

  //  PURPLE MUSICAL NOTES (Sigils)
  const musicNoteTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#bc66ff'; ctx.font = 'bold 80px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Drawing a Treble Clef or Note symbol
    ctx.shadowColor = '#8000ff'; ctx.shadowBlur = 10;
    ctx.fillText('', 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  const glitchTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const ctx = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      const y = (i / 8) * 64 + 4; const offset = (Math.random() - 0.5) * 20;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,0,80,${0.6 + Math.random() * 0.3})` : `rgba(0,200,255,${0.4 + Math.random() * 0.3})`;
      ctx.fillRect(offset, y, 40 + Math.random() * 120, 3 + Math.random() * 3);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  // ─── TEXTURE DISPOSAL (prevent WebGL context exhaustion = browser crash) ──
  // Every CanvasTexture occupies a GPU slot. Without dispose() they accumulate
  // across hot-reloads and eventually crash the tab's WebGL context.
  useEffect(() => {
    return () => {
      shadowTexture.dispose();
      blushTexture.dispose();
      droolTexture.dispose();
      steamTexture.dispose();
      tearTexture.dispose();
      purpleBlushTexture.dispose();
      floatingHeartTex.dispose();
      raincloudTex.dispose();
      raindropTex.dispose();
      sparkleTex.dispose();
      haloTex.dispose();
      hatchingTex.dispose();
      earSteamTex.dispose();
      frostTex.dispose();
      purpleAuraTex.dispose();
      musicNoteTex.dispose();
      glitchTex.dispose();
      jawGloomTex.dispose();
      zzzTextures.forEach(t => t.dispose());
      symbolTextures.question.dispose();
      symbolTextures.exclamation.dispose();
      symbolTextures.thinking.dispose();
      curvedBlushGeo.dispose();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  //  useFrame
  // ═══════════════════════════════════════════════════════════════════════
  useFrame(({ clock }, delta) => {
    if (!vrm || !vrm.expressionManager) return;
    const t = clock.elapsedTime;
    // Zero-cost store read (no subscription) — used to gate expensive VFX math
    const perfTier = useMoodStore.getState().manualOverride ?? useMoodStore.getState().performanceTier;


    ['Crown', 'Extra', 'Accessory', 'Tiara', 'Headdress', 'Item'].forEach(name => {
      vrm.expressionManager?.setValue(name, 0);
    });

    if (angerRef.current && isAngry) {
      angerRef.current.scale.setScalar(0.85 + Math.sin(t * 12) * 0.15);
    }

    if (isAnxious && !prevAnxious.current) sweatTimer.current = 0;
    prevAnxious.current = isAnxious;
    if (sweatRef.current && isAnxious) {
      sweatTimer.current += delta * 1.5;
      const slide = Math.min(sweatTimer.current, 1.0);
      sweatRef.current.position.y = 0.10 - slide * 0.05;
      sweatRef.current.scale.setScalar(1 - slide * 0.3);
    }

    //  DROOL ANIMATION (Play Once & Hang)
    if (droolRef.current && isAhegao) {
      // Loop hataya. Jab tak limit (1.2) se kam hai, tab tak badhega, fir ruk jayega
      if (droolSlide.current < 1.2) {
        droolSlide.current += delta * 0.4;
      }

      // Scale set kar rahe hain (maximum 1.0 tak stretch hoga)
      const stretch = Math.min(droolSlide.current, 1.0);
      droolRef.current.scale.y = 0.1 + stretch;

      // Halka sa jiggle taaki latki hui laar natural lage
      droolRef.current.position.x = -0.015 + Math.sin(t * 1.5) * 0.001;
    } else if (droolRef.current) {
      // Emotion hatne par turant reset aur hide kar do
      droolSlide.current = 0;
      droolRef.current.scale.y = 0.001;
    }

    if (isLust) {
      const puff = (t * 0.25) % 1.0;
      if (steamLRef.current) {
        steamLRef.current.position.z = 0.095 + puff * 0.06;
        steamLRef.current.position.x = -0.02 - puff * 0.04;
        steamLRef.current.position.y = -0.045 + puff * 0.01;
        steamLRef.current.scale.setScalar(0.6 + puff * 0.8);
        (steamLRef.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - puff);
      }
      if (steamRRef.current) {
        const p2 = (puff + 0.5) % 1.0;
        steamRRef.current.position.z = 0.095 + p2 * 0.06;
        steamRRef.current.position.x = 0.02 + p2 * 0.04;
        steamRRef.current.position.y = -0.047 + p2 * 0.01;
        steamRRef.current.scale.setScalar(0.6 + p2 * 0.8);
        (steamRRef.current.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - p2);
      }
    }

    if (isShock) {
      shockTimer.current += delta;
      // 'pulse' हटा दिया, अब ये स्थिर रहेगा
      if (shockGlowRef.current) {
        shockGlowRef.current.scale.setScalar(1.0);
        (shockGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4; // हल्का बैंगनी साया
      }
      if (shockSteamRef.current) {
        const slide = Math.min(shockTimer.current / 3.0, 1.0);
        shockSteamRef.current.position.y = 0.16 + slide * 0.1;
        shockSteamRef.current.scale.setScalar(0.5 + slide * 1.2);
        shockSteamRef.current.children.forEach((child, i) => {
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1.0 - slide) * 0.7;
          child.rotation.z += delta * (i % 2 === 0 ? 1 : -1);
        });
      }
    } else {
      shockTimer.current = 0;
      if (shockGlowRef.current) (shockGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    if (isCrying) {
      //  FIXED: Delta ko add kiya taaki direction theek rahe
      tearSlide.current = (tearSlide.current + delta * 0.04) % 0.08;
      if (tearGroupRef.current) tearGroupRef.current.position.y = -tearSlide.current;
    }

    if (bubbleRef.current && isSleepy) {
      const breathe = 1.0 + Math.sin(t * 0.9) * 0.15;
      bubbleRef.current.scale.setScalar(breathe > 1.15 ? 0.01 : breathe);
    }

    zRefs.forEach((ref, i) => {
      if (!ref.current || !isSleepy) return;
      const loop = ((t * 0.4) + zOffsets.current[i]) % 1;
      ref.current.position.y = 0.065 + loop * 0.10;
      ref.current.position.x = 0.035 + loop * 0.045 + i * 0.012;
      ref.current.scale.setScalar(0.6 + loop * 0.5);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = loop < 0.2 ? loop / 0.2 : loop > 0.75 ? (1 - loop) / 0.25 : 0.85;
    });

    // ── HEARTS (Lovestruck) ── Skip on Tier 0 to save CPU
    heartParticles.forEach(({ phase, xSeed, ref }: any) => {
      if (!ref.current) return;
      if (isLovestruck && perfTier >= 1) {
        ref.current.visible = true;
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        const loop = (t * 0.38 + phase) % 1;
        const yPos = 0.14 + loop * 0.22;
        const xPos = xSeed * 0.12 + Math.sin(t * 1.1 + phase * 6.28) * 0.022;
        const scale = 0.55 + loop * 0.45;
        ref.current.position.set(xPos, yPos, 0.05);
        ref.current.scale.setScalar(scale);
        mat.opacity = loop < 0.15 ? loop / 0.15 : loop > 0.80 ? (1 - loop) / 0.20 : 0.88;
      } else {
        ref.current.visible = false;
      }
    });

    // ── RAINDROPS (Gloomy) ── Skip on Tier 0 to save CPU
    raindrops.forEach(({ phase, xOff, ref }: any) => {
      if (!ref.current) return;
      if (isGloomy && perfTier >= 1) {
        ref.current.visible = true;
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        const loop = (t * 0.55 + phase) % 1;
        const yPos = 0.22 - loop * 0.28;
        mat.opacity = loop < 0.1 ? loop / 0.1 : loop > 0.85 ? (1 - loop) / 0.15 : 0.75;
        ref.current.position.set(xOff, yPos, 0.04);
      } else {
        ref.current.visible = false;
      }
    });

    // ── SPARKLES (Happy) ── Skip on Tier 0 to save CPU
    sparkleParticles.forEach(({ phase, side, yLevel, ref }: any) => {
      if (!ref.current) return;
      if (isHappyWithExtra && perfTier >= 1) {
        ref.current.visible = true;
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        const loop = (t * 0.55 + phase) % 1;
        const xBase = side * (0.10 + Math.abs(Math.sin(phase * 3.14)) * 0.04);
        const xWobble = Math.sin(t * 2.2 + phase * 6.28) * 0.012;
        const scale = 0.4 + Math.sin(loop * Math.PI) * 0.7;
        const rot = t * (side > 0 ? 1.2 : -0.9) + phase * 3;
        ref.current.position.set(xBase + xWobble, yLevel, 0.06);
        ref.current.rotation.z = rot;
        ref.current.scale.setScalar(Math.max(0.01, scale));
        mat.opacity = loop < 0.1 ? loop / 0.1 : loop > 0.80 ? (1 - loop) / 0.20 : 0.90;
      } else {
        ref.current.visible = false;
      }
    });

    if (symbolRef.current) {
      const mat = symbolRef.current.material as THREE.MeshBasicMaterial;
      const curSymbol = ['CONFUSED', 'THINKING'].includes(e) ? 'question' : ['SURPRISED', 'SHOCKED', 'MILDLY_SURPRISED'].includes(e) ? 'exclamation' : 'thinking';
      if (isThinking) {
        if (symbolPrev.current !== curSymbol) {
          symbolPop.current = 0; symbolPrev.current = curSymbol;
          mat.map = symbolTextures[curSymbol as keyof typeof symbolTextures]; mat.needsUpdate = true;
        }
        symbolPop.current = Math.min(symbolPop.current + delta * 4, 1);
        const spring = symbolPop.current < 0.5 ? symbolPop.current * 2.4 : 1.0 + Math.sin((symbolPop.current - 0.5) * Math.PI) * 0.15;
        const tilt = curSymbol === 'question' ? Math.sin(t * 1.8) * 0.25 : Math.sin(symbolPop.current * Math.PI) * 0.15;
        symbolRef.current.scale.setScalar(Math.max(0.01, spring)); symbolRef.current.rotation.z = tilt;
        mat.opacity = Math.min(symbolPop.current * 3, 1.0);
      } else { symbolPop.current = 0; symbolPrev.current = ''; mat.opacity = 0; }
    }

    // ── NEW ARCHETYPE ANIMATIONS ──

    //  EAR STEAM (tsundere)
    if (isTsundere) {
      earSteamTimer.current = (earSteamTimer.current + delta * 0.6) % 1.0;
      const p = earSteamTimer.current;
      [earSteamLRef, earSteamRRef].forEach((ref) => {
        if (!ref.current) return;
        ref.current.position.y = 0.040 + p * 0.055;
        ref.current.position.z = 0.030 + p * 0.020;
        ref.current.scale.setScalar(0.5 + p * 1.0);
        (ref.current.material as THREE.MeshBasicMaterial).opacity = p < 0.15 ? p / 0.15 : p > 0.70 ? (1 - p) / 0.30 : 0.75;
      });
    } else {
      earSteamTimer.current = 0;
      [earSteamLRef, earSteamRRef].forEach(ref => {
        if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
      });
    }

    //  UPRIGHT CONCENTRIC MUSIC ORBIT (Front-visible)
    if (isYandereWorship) {
      if (auraRef.current) {
        auraRot.current += delta * 1.5;
        auraRef.current.rotation.z = auraRot.current;
        auraRef.current.rotation.x = Math.PI / 2; // Flat Halo plane
        (auraRef.current.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 3) * 0.2;
      }

      musicParticles.forEach(({ phase, ring, ref }: any) => {
        if (!ref.current) return;
        const isInner = ring === 'inner';
        const radius = isInner ? 0.09 : 0.22;
        const speed = isInner ? t * 1.2 : -t * 0.9;

        const x = Math.cos(phase + speed) * radius;
        const z = Math.sin(phase + speed) * radius;

        ref.current.position.set(x, 0, z);

        //  FIX: upright notes (standing up)
        ref.current.rotation.x = 0;

        // Face camera/orbit direction
        ref.current.rotation.y = -speed - phase + Math.PI / 2;

        (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.9;
      });
    } else {
      musicParticles.forEach(({ ref }: any) => {
        if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
      });
    }
    //  SAKUGA FROST BREATH (Kuudere / Cold Anger)
    if (isKuudere) {
      iceParticles.forEach((p: any) => {
        if (!p.ref.current) return;

        // Lifecycle logic (0 to 1)
        const cycle = (t * 0.5 + p.phase) % 1;
        const mat = p.ref.current.material as THREE.MeshBasicMaterial;

        // ORIGIN: Exactly at mouth (0, -0.028, 0.092)
        const startX = 0;
        const startY = -0.028;
        const startZ = 0.092;

        // MOTION: Particles move forward (Z), slightly spread (X,Y), and fall slightly
        p.ref.current.position.set(
          startX + p.xDir * cycle,
          startY + p.yDir * cycle - (cycle * 0.015), // Gravity effect
          startZ + (cycle * 0.12) // Moving away from face
        );

        // Scale: Small starts, grows slightly as mist spreads
        p.ref.current.scale.setScalar(0.3 + cycle * 0.7);
        p.ref.current.rotation.z += delta * 3;

        // Fading: Quick fade-in, long fade-out
        mat.opacity = cycle < 0.2 ? (cycle / 0.2) * 0.6 : (1 - cycle) * 0.6;
      });
    } else {
      iceParticles.forEach((p: any) => {
        if (p.ref.current) (p.ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
      });
    }

    //  REAL-ANIME FACE GLITCH (Sadodere / Corruption)
    if (glitchRef.current) {
      if (isSadodere) {
        // ग्लिच की फ्रीक्वेंसी (जितना कम नंबर, उतना तेज़ झटका)
        const isGlitchMoment = Math.random() > 0.88;

        glitchRef.current.children.forEach((child) => {
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;

          if (isGlitchMoment) {
            //  Face Limit: चेहरे के अंदर ही ब्लॉक्स को रैंडम जगह भेजना
            child.position.x = (Math.random() - 0.5) * 0.12; // गाल से गाल तक
            child.position.y = (Math.random() - 0.5) * 0.15 + 0.05; // ठुड्डी से माथे तक

            // Shard Size: रैंडम साइज़ के ब्लॉक्स
            child.scale.x = 0.2 + Math.random() * 1.5;
            child.scale.y = 0.5 + Math.random() * 2.0;

            mat.opacity = Math.random() > 0.5 ? 0.8 : 0.4;
          } else {
            // जब ग्लिच न हो तो सब गायब
            mat.opacity = 0;
          }
        });

        // पूरे चेहरे का हल्का सा "Ghosting" झटका
        glitchRef.current.position.x = isGlitchMoment ? (Math.random() - 0.5) * 0.01 : 0;
      } else {
        glitchRef.current.children.forEach(c => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0);
      }
    }
    //  SAKUGA HATCHING FIX (Boiling Lines)
    if (isSerious && hatchingGroupRef.current) {
      hatchingGroupRef.current.children.forEach((child, i) => {
        const isLeft = i === 0;
        // Soft boiling effect
        child.position.x = (isLeft ? -0.065 : 0.065) + (Math.random() - 0.5) * 0.002;
        child.rotation.z = (Math.random() - 0.5) * 0.03;

        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.4 + Math.random() * 0.2;
      });
    } else if (hatchingGroupRef.current) {
      hatchingGroupRef.current.children.forEach(c => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0);
    }

    //  DEVIL HORNS ANIMATION (isEvil)
    if (isEvil) {
      const hornScale = 1.0 + Math.sin(t * 3) * 0.05; // Breaking/Pulsing
      [leftHornRef, rightHornRef].forEach((ref) => {
        if (ref.current) {
          ref.current.scale.set(1, hornScale, 1);
          // Evil essence glow
          (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(t * 4) * 0.2;
        }
      });
    }

    //  DOMINANT CROWN ANIMATION (isDominant)
    if (isDominant && crownRef.current) {
      crownRef.current.position.y = 0.28 + Math.sin(t * 2) * 0.01; // Floating
      crownRef.current.rotation.y = t * 0.5; // Slow rotate

      // Flash/Shine Effect
      crownRef.current.children.forEach((child) => {
        if ((child as THREE.Mesh).material) {
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(t * 5) * 0.2;
        }
      });
    }
  });

  if (!vrm) return null;
  const headBone = vrm.humanoid?.getRawBoneNode('head') || vrm.humanoid?.getNormalizedBoneNode('head');
  if (!headBone) return null;

  return createPortal(
    <group name="anime-vfx-tracker">
      {/*  ANGER */}
      {isAngry && (
        <group ref={angerRef} position={[0.06, 0.08, 0.08]}>
          <Html center transform distanceFactor={0.4}>
            <div style={{ fontSize: '40px', color: '#ff0000', textShadow: '2px 2px 0 #fff,-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff', userSelect: 'none', pointerEvents: 'none', fontWeight: 'bold' }}></div>
          </Html>
        </group>
      )}

      {/*  SWEAT (ANXIOUS) */}
      {isAnxious && (
        <group ref={sweatRef} position={[-0.07, 0.08, 0.08]}>
          <Html center transform distanceFactor={0.4}>
            <div style={{ fontSize: '35px', textShadow: '1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff', userSelect: 'none', pointerEvents: 'none' }}></div>
          </Html>
        </group>
      )}

      {/*  YANDERE SHADOW ONLY (Red Dots Removed) */}
      {isYandere && (
        <mesh position={[0, 0.075, 0.002]}>
          <cylinderGeometry args={[0.091, 0.091, 0.16, 32, 1, true, -Math.PI / 3.5, Math.PI / 1.75]} />
          <meshBasicMaterial
            map={shadowTexture}
            transparent
            blending={THREE.MultiplyBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {/*  ANIME CHEEK BLUSH: Pre-curved translated cylinder to perfectly track face and hug cheeks */}
      {isBlushing && (
        <mesh position={[0, 0.032, 0.105]} rotation={[-0.05, 0, 0]}>
          <primitive object={curvedBlushGeo} attach="geometry" />
          <meshBasicMaterial
            map={blushTexture}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            opacity={0.9}
            polygonOffset
            polygonOffsetFactor={-5}
          />
        </mesh>
      )}

      {/*  HEART EYES REMOVED - Visual is now clean or dead-eyed based on state */}

      {/*  AHEGAO SUITE (Drool Only) */}
      {isAhegao && (
        <group ref={droolRef} position={[-0.015, -0.012, 0.092]}>
          <mesh position={[0, -0.022, 0]}>
            <planeGeometry args={[0.012, 0.045]} />
            <meshBasicMaterial map={droolTexture} transparent depthWrite={false} blending={THREE.NormalBlending} polygonOffset polygonOffsetFactor={-3} />
          </mesh>
        </group>
      )}

      {/*  MOUTH STEAM (कोनों से बाहर की तरफ निकलेगा) */}
      {(isLust || isAhegao) && (
        <>
          <mesh ref={steamLRef} position={[-0.035, -0.03, 0.1]}>
            <planeGeometry args={[0.05, 0.05]} />
            <meshBasicMaterial map={steamTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.6} />
          </mesh>
          <mesh ref={steamRRef} position={[0.035, -0.03, 0.1]}>
            <planeGeometry args={[0.05, 0.05]} />
            <meshBasicMaterial map={steamTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.6} />
          </mesh>
        </>
      )}

      {/*  SHOCK EFFECTS */}
      {isShock && (
        <>
          <mesh ref={shockGlowRef} position={[0, 0.05, 0.005]}>
            <cylinderGeometry args={[0.095, 0.095, 0.12, 32, 1, true, -Math.PI / 2, Math.PI]} />
            <meshBasicMaterial map={purpleBlushTexture} transparent depthWrite={false} side={THREE.DoubleSide} opacity={0} />
          </mesh>
          <group ref={shockSteamRef} position={[0, 0.15, 0]}>
            {[...Array(3)].map((_, i) => (
              <mesh key={i} rotation={[0, 0, (i * Math.PI) / 1.5]}>
                <planeGeometry args={[0.1, 0.08]} />
                <meshBasicMaterial map={steamTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            ))}
          </group>
        </>
      )}

      {/*  CRYING SUITE */}
      {isCrying && (
        <group ref={tearGroupRef}>
          {/* Left Eye Tear */}
          <mesh position={[-0.052, 0.01, 0.078]} rotation={[0, 0.35, 0]}>
            <planeGeometry args={[0.015, 0.030]} />
            <meshBasicMaterial map={tearTexture} transparent depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} />
          </mesh>

          {/* Right Eye Tear */}
          <mesh position={[0.052, 0.01, 0.078]} rotation={[0, -0.35, 0]}>
            <planeGeometry args={[0.015, 0.030]} />
            <meshBasicMaterial map={tearTexture} transparent depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} />
          </mesh>
        </group>
      )}

      {/*  SLEEPY BUBBLE & Zzz */}
      {isSleepy && (
        <>
          <mesh ref={bubbleRef} position={[0.015, 0.015, 0.095]}>
            <sphereGeometry args={[0.015, 32, 32]} />
            <meshBasicMaterial color="#e0ffed" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {zzzTextures.map((tex, i) => (
            <mesh key={i} ref={zRefs[i]} position={[0.035, 0.065, 0.088]}>
              <planeGeometry args={[0.025, 0.025]} />
              <meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          ))}
        </>
      )}

      {/* ── NEW PROPS ── */}

      {/* A: FLOATING HEARTS */}
      {isLovestruck && heartParticles.map(({ ref }: any, i: number) => (
        <mesh key={`heart-${i}`} ref={ref} position={[0, 0.14, 0.05]}>
          <planeGeometry args={[0.030, 0.030]} />
          <meshBasicMaterial map={floatingHeartTex} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}

      {isGloomy && (
        <mesh position={[0, 0.26, 0.0]}>
          <planeGeometry args={[0.13, 0.065]} />
          <meshBasicMaterial map={raincloudTex} transparent depthTest={false} depthWrite={false} blending={THREE.NormalBlending} opacity={0.82} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}

      {isGloomy && raindrops.map(({ ref, xOff }: any, i: number) => (
        <mesh key={`rain-${i}`} ref={ref} position={[xOff, 0.22, 0.04]}>
          <planeGeometry args={[0.009, 0.022]} />
          <meshBasicMaterial map={raindropTex} transparent depthTest={false} depthWrite={false} blending={THREE.NormalBlending} opacity={0} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}

      {isHappyWithExtra && sparkleParticles.map(({ ref, side, yLevel }: any, i: number) => (
        <mesh key={`spark-${i}`} ref={ref} position={[side * 0.10, yLevel, 0.06]}>
          <planeGeometry args={[0.028, 0.028]} />
          <meshBasicMaterial map={sparkleTex} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}

      <mesh ref={symbolRef} position={[0.10, 0.17, 0.05]}>
        <planeGeometry args={[0.048, 0.048]} />
        <meshBasicMaterial map={symbolTextures.question} transparent depthTest={false} depthWrite={false} blending={THREE.NormalBlending} opacity={0} polygonOffset polygonOffsetFactor={-4} />
      </mesh>

      {/*  JAW GLOOM (Devious Mode) */}
      {isDevious && (
        <mesh position={[0, -0.05, 0.06]}>
          <cylinderGeometry args={[0.096, 0.096, 0.08, 32, 1, true, -Math.PI / 2.2, Math.PI / 1.1]} />
          <meshBasicMaterial map={jawGloomTex} transparent depthWrite={false} blending={THREE.MultiplyBlending} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
      )}

      {/*  EVIL DEVIL HORNS (Exclusive to Evil Persona) */}
      {isEvil && (
        <group>
          {/* Left Horn */}
          <mesh
            ref={leftHornRef}
            position={[-0.055, 0.13, 0.07]}
            rotation={[0.4, 0.3, 0.4]}
          >
            <coneGeometry args={[0.018, 0.07, 4]} />
            <meshBasicMaterial color="#1a0000" transparent depthTest={false} />
          </mesh>

          {/* Right Horn */}
          <mesh
            ref={rightHornRef}
            position={[0.055, 0.13, 0.07]}
            rotation={[0.4, -0.3, -0.4]}
          >
            <coneGeometry args={[0.018, 0.07, 4]} />
            <meshBasicMaterial color="#1a0000" transparent depthTest={false} />
          </mesh>

          {/* Dark Glow at the base of horns */}
          <mesh position={[0, 0.12, 0.05]}>
            <planeGeometry args={[0.2, 0.1]} />
            <meshBasicMaterial map={jawGloomTex} transparent opacity={0.4} blending={THREE.MultiplyBlending} />
          </mesh>
        </group>
      )}

      {/*  GOLDEN DOMINANT CROWN (Mistress Mode) */}
      {isDominant && (
        <group ref={crownRef} position={[0, 0.28, -0.01]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.06, 0.005, 8, 32]} />
            <meshBasicMaterial color="#ffd700" transparent opacity={1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              position={[Math.cos(i * Math.PI * 2 / 5) * 0.06, 0.015, Math.sin(i * Math.PI * 2 / 5) * 0.06]}
              rotation={[0, -i * Math.PI * 2 / 5, 0]}
            >
              <coneGeometry args={[0.012, 0.035, 4]} />
              <meshBasicMaterial color="#ffd700" transparent opacity={1} />
            </mesh>
          ))}
          {/* Central Point */}
          <mesh position={[0, 0.02, 0]}>
            <coneGeometry args={[0.015, 0.05, 4]} />
            <meshBasicMaterial color="#ffd700" transparent opacity={1} />
          </mesh>
        </group>
      )}

      {/*  ANGELIC HALO (सिर के ऊपर) */}
      {isGodMode && (
        <mesh position={[0, 0.28, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.22, 0.22]} />
          <meshBasicMaterial map={haloTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}



      {/* ───  CURVED MANGA HATCHING (Natural Cheek Fit) ─── */}
      {isSerious && (
        <group ref={hatchingGroupRef} position={[0, 0.015, 0.096]}>
          {/* Left Side */}
          <mesh position={[-0.064, 0, 0]} rotation={[0, 0.45, 0.1]}>
            <planeGeometry args={[0.048, 0.035]} />
            <meshBasicMaterial
              map={hatchingTex}
              transparent={true}
              blending={THREE.NormalBlending}
              depthWrite={false}
              opacity={0}
              polygonOffset
              polygonOffsetFactor={-10}
            />
          </mesh>
          {/* Right Side */}
          <mesh position={[0.064, 0, 0]} rotation={[0, -0.45, -0.1]}>
            <planeGeometry args={[0.048, 0.035]} />
            <meshBasicMaterial
              map={hatchingTex}
              transparent={true}
              blending={THREE.NormalBlending}
              depthWrite={false}
              opacity={0}
              polygonOffset
              polygonOffsetFactor={-10}
            />
          </mesh>
        </group>
      )}

      {/*  EAR STEAM (TSUNDERE / ANGRY) */}
      <mesh ref={earSteamLRef} position={[-0.090, 0.040, 0.030]}>
        <planeGeometry args={[0.040, 0.040]} />
        <meshBasicMaterial map={earSteamTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <mesh ref={earSteamRRef} position={[0.090, 0.040, 0.030]}>
        <planeGeometry args={[0.040, 0.040]} />
        <meshBasicMaterial map={earSteamTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} polygonOffset polygonOffsetFactor={-3} />
      </mesh>



      {/* ───  YANDERE WORSHIP: VISIBLE MUSIC ORBIT ─── */}
      {isYandereWorship && (
        <group position={[0, 0.32, 0.02]}>

          {/* SPINNING PURPLE RING (Flat) */}
          <mesh ref={auraRef}>
            <planeGeometry args={[0.28, 0.28]} />
            <meshBasicMaterial
              map={purpleAuraTex}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* 12 UPRIGHT NOTES (Now visible from front) */}
          {musicParticles.map(({ ref }: any, i: number) => (
            <mesh key={i} ref={ref}>
              <planeGeometry args={[0.045, 0.045]} />
              <meshBasicMaterial
                map={musicNoteTex}
                transparent
                blending={THREE.AdditiveBlending}
                opacity={0}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}

      {/*  FROST CRYSTAL (Moved from Face to TOP of Head) */}
      {/*  REALISTIC ANIME FROST BREATH (At Mouth) */}
      {isKuudere && iceParticles.map((p: any, i: number) => (
        <mesh key={`frost-${i}`} ref={p.ref}>
          <planeGeometry args={[0.025, 0.025]} />
          <meshBasicMaterial
            map={frostTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0}
          />
        </mesh>
      ))}

      {/* ───  SADODERE: INTERNAL SYSTEM CORRUPTION ─── */}
      {isSadodere && (
        <group ref={glitchRef} position={[0, 0, 0.1]}> {/* चेहरे के ठीक ऊपर */}

          {/* Shard 1: Red Aberration */}
          <mesh>
            <planeGeometry args={[0.08, 0.005]} />
            <meshBasicMaterial color="#ff0044" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>

          {/* Shard 2: Cyan Ghosting */}
          <mesh>
            <planeGeometry args={[0.06, 0.01]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>

          {/* Shard 3: Data Block (White) */}
          <mesh>
            <planeGeometry args={[0.04, 0.02]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>

          {/* Shard 4: Main Glitch Texture */}
          <mesh>
            <planeGeometry args={[0.1, 0.008]} />
            <meshBasicMaterial map={glitchTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>

        </group>
      )}
    </group>,
    headBone
  );
};
