import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export const StarryBackground: React.FC<{ mousePos: { x: number, y: number } }> = ({ mousePos }) => {
  const stars = useMemo(() => Array.from({ length: 150 }).map((_, i) => ({
    id: i,
    size: Math.random() * 2 + 1,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    duration: Math.random() * 3 + 2,
    opacity: Math.random() * 0.7 + 0.3
  })), []);

  return (
    <div className="fixed inset-0 z-0 bg-[#020205] overflow-hidden">
      {/*  Deep Nebula Glow */}
      <motion.div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at ${50 + mousePos.x * 10}% ${50 + mousePos.y * 10}%, #1e1b4b 0%, transparent 70%)` 
        }}
      />
      
      {/*  Animated Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white shadow-[0_0_10px_white]"
          style={{
            width: star.size,
            height: star.size,
            top: star.top,
            left: star.left,
            opacity: star.opacity
          }}
          animate={{
            x: mousePos.x * (star.size * 5),
            y: mousePos.y * (star.size * 5),
            opacity: [star.opacity, 0.2, star.opacity]
          }}
          transition={{
            x: { type: 'spring', stiffness: 50, damping: 20 },
            y: { type: 'spring', stiffness: 50, damping: 20 },
            opacity: { duration: star.duration, repeat: Infinity, ease: "easeInOut" }
          }}
        />
      ))}
    </div>
  );
};
