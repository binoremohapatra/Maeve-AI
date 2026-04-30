import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';
import { getCodeFromUrl } from '../utils/spotify';
import { useMoodStore } from '../stores/moodStore';
import { API_ENDPOINTS } from '../config/EcosystemConfig';

export const SpotifyCallback: React.FC = () => {
  const { setSpotifyToken } = useMoodStore();

  useEffect(() => {
    const handleCallback = async () => {
      const code = getCodeFromUrl();
      
      if (code) {
        console.log(' Spotify Authorization Code Received:', code);
        
        try {
          // Send code to backend for token exchange
          const response = await fetch(`${API_ENDPOINTS.JAVA_CORE}/api/spotify/exchange`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();
          
          if (data.access_token) {
            console.log(' Spotify Access Token Received!');
            setSpotifyToken(data.access_token);
            
            // Redirect back to main app after 2 seconds
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          } else {
            console.error(' Failed to get access token:', data);
            setTimeout(() => {
              window.location.href = '/';
            }, 3000);
          }
        } catch (error) {
          console.error(' Error exchanging code for token:', error);
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        }
      } else {
        console.error(' No authorization code found in URL');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, [setSpotifyToken]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="mb-6"
        >
          <Music size={64} className="text-green-400 mx-auto" />
        </motion.div>
        
        <h1 className="text-2xl font-bold text-white mb-4">
          Connecting to Spotify...
        </h1>
        
        <p className="text-gray-400 mb-6">
          Please wait while we establish the Neural Link
        </p>
        
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 200 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="h-1 bg-green-500 rounded-full mx-auto"
        />
      </motion.div>
    </div>
  );
};
