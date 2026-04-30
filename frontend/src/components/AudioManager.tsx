import React from 'react';
import { Music, Activity } from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';
import { motion, AnimatePresence } from 'framer-motion';
import { loginToSpotify } from '../utils/spotify'; //  Import Spotify login

export const AudioManager: React.FC = () => {
  const { isSpotifyConnected } = useMoodStore(); // � Check Spotify connection status
  
  const handleSpotifyConnect = () => {
    loginToSpotify(); //  Connect to Spotify
  };

  return (
    <div className="relative z-50">
      <AnimatePresence mode="wait">
        {!isSpotifyConnected ? (
          <motion.button 
            key="idle"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSpotifyConnect}
            className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] group transition-all"
          >
            <Music size={24} className="text-purple-400 group-hover:text-white transition-colors" />
            
            {/* Tooltip */}
            <div className="absolute left-full ml-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold text-white whitespace-nowrap pointer-events-none">
              Connect Spotify
            </div>
          </motion.button>
        ) : (
          <motion.button 
            key="active"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-14 h-14 rounded-full bg-green-500/10 border border-green-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]"
          >
            {/* Spinning Ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-500/80"
            />
            
            <Activity size={24} className="text-green-400" />

            {/* Tooltip */}
            <div className="absolute left-full ml-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold text-white whitespace-nowrap pointer-events-none">
              Spotify Connected
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
