import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';

export const WakeWordOverlay: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const { sendMessage, mascot } = useMoodStore();

  useEffect(() => {
    // Standardize Speech Recognition for Chrome/Safari
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript.toLowerCase();
      
      //  WAKE WORD DETECTION
      if (transcriptText.includes("hey maeve") || transcriptText.includes("maeve")) {
        setIsListening(true);
        // Clean the wake word from the actual command
        const command = transcriptText.replace("hey maeve", "").replace("maeve", "").trim();
        setTranscript(command);
      } else if (isListening) {
        setTranscript(transcriptText);
      }
    };

    // Auto-send when user stops talking (final result)
    recognition.onend = () => {
      if (isListening && transcript.trim().length > 0) {
        sendMessage(transcript); // Send command to Python/Groq
        setTimeout(() => setIsListening(false), 3000); // Close overlay after sending
      }
      // Restart listening immediately if it stops (Always On)
      try { recognition.start(); } catch(e) {}
    };

    // Start the engine
    recognition.start();

    return () => recognition.stop();
  }, [isListening, transcript, sendMessage]);

  return (
    <AnimatePresence>
      {isListening && (
        <motion.div 
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          className="fixed inset-0 z-[9999] bg-black/60 flex flex-col items-center justify-end pb-32"
        >
          {/* Close Button */}
          <button onClick={() => setIsListening(false)} className="absolute top-10 right-10 p-4 bg-white/10 rounded-full text-white">
            <X size={24} />
          </button>

          <div className="flex flex-col items-center max-w-lg w-full text-center">
            {/* The Text You Spoke */}
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl font-black text-white tracking-tight mb-12 min-h-[80px]"
            >
              {transcript || "Listening, Darling..."}
            </motion.p>

            {/* Maeve's Reply Text (if she is responding) */}
            {mascot.speaking && (
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="mb-12 bg-indigo-600/20 border border-indigo-500/30 p-6 rounded-3xl"
               >
                 <p className="text-indigo-200 text-lg italic">"{mascot.replyText}"</p>
               </motion.div>
            )}

            {/* Siri-style Glowing Orb */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                boxShadow: [
                  "0 0 40px rgba(168,85,247,0.3)", 
                  "0 0 80px rgba(168,85,247,0.8)", 
                  "0 0 40px rgba(168,85,247,0.3)"
                ]
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center border-4 border-white/20"
            >
              <Mic size={32} className="text-white" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
