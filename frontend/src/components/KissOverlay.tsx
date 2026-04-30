// KissOverlay.tsx — FINAL VERSION
// Zustand subscribe ki jagah window event bridge use karo
// Yeh guaranteed kaam karta hai kyunki window events React tree se independent hain

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export const KissOverlay = () => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = () => {
      console.log(' KissOverlay SHOW EVENT RECEIVED');
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '1';
        overlayRef.current.style.pointerEvents = 'all';
      }
    };

    const hide = () => {
      console.log(' KissOverlay HIDE EVENT RECEIVED');
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '0';
        overlayRef.current.style.pointerEvents = 'none';
      }
    };

    window.addEventListener('KISS_BLACKOUT_SHOW', show);
    window.addEventListener('KISS_BLACKOUT_HIDE', hide);

    return () => {
      window.removeEventListener('KISS_BLACKOUT_SHOW', show);
      window.removeEventListener('KISS_BLACKOUT_HIDE', hide);
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        transition: 'opacity 0.05s linear',
        pointerEvents: 'none',
      }}
    >
      <span style={{
        fontSize: '18rem',
        lineHeight: 1,
        filter: 'drop-shadow(0 0 60px rgba(255, 0, 100, 0.9))',
        userSelect: 'none',
      }}>
        💋
      </span>
    </div>,
    document.body
  );
};