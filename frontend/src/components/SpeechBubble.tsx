import React from 'react';
import { motion } from 'framer-motion';

interface SpeechBubbleProps {
  text: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  isUser?: boolean;
  className?: string;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  position = 'right',
  isUser = false,
  className = ''
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'right-full mr-3';
      case 'right':
        return 'left-full ml-3';
      case 'top':
        return 'bottom-full mb-3';
      case 'bottom':
        return 'top-full mt-3';
      default:
        return 'left-full ml-3';
    }
  };

  const getTailPosition = () => {
    switch (position) {
      case 'left':
        return 'right-0 top-1/2 transform -translate-y-1/2 translate-x-1';
      case 'right':
        return 'left-0 top-1/2 transform -translate-y-1/2 -translate-x-1';
      case 'top':
        return 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1';
      case 'bottom':
        return 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-1';
      default:
        return 'left-0 top-1/2 transform -translate-y-1/2 -translate-x-1';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`absolute ${getPositionClasses()} ${className} pointer-events-none`}
    >
      {/* Bubble Tail */}
      <div className={`absolute ${getTailPosition()} w-0 h-0 border-8 border-transparent ${
        position === 'right' || position === 'left'
          ? position === 'right' 
            ? 'border-r-purple-500/20' 
            : 'border-l-blue-500/20'
          : position === 'top'
            ? 'border-b-purple-500/20'
            : 'border-t-purple-500/20'
      }`} />
      
      {/* Main Bubble */}
      <div className={`relative p-4 rounded-2xl backdrop-blur-xl border shadow-2xl max-w-xs ${
        isUser
          ? 'bg-blue-500/10 border-blue-400/20'
          : 'bg-purple-500/10 border-purple-400/20'
      }`}>
        <div className="relative">
          {/* Animated Background Effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl opacity-30"
            animate={{
              background: isUser 
                ? 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), transparent 70%)'
                : 'radial-gradient(circle at 70% 30%, rgba(147, 51, 234, 0.3), transparent 70%)'
            }}
          />
          
          {/* Text Content */}
          <p className="relative text-sm text-white/90 leading-relaxed font-light">
            {text}
          </p>
        </div>
        
        {/* Typing Indicator */}
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-400/60"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};
