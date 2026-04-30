import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid,   
  Cpu,          
  HeartHandshake, 
  Activity,     
  Settings,     
  X,
  Calendar, //  Added for Routine
  Music, //  Added for Spotify Neural Link
  
} from 'lucide-react';
import { useScreenSize } from '../hooks/useScreenSize';
import { loginToSpotify } from '../utils/spotify';

interface RadialMenuProps {
  onNavigate: (screen: string) => void;
}

export default function RadialMenu({ onNavigate }: RadialMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { width } = useScreenSize();
  const isMobile = width < 768;
  const isLaptop = width >= 768 && width < 1280;
  
  //  ARC CONFIGURATION (RIGHT SIDE - HEAD TO TOE)
  // Radius adjust kiya hai taaki character ke around sahi fit baithe
  const radius = isMobile ? 140 : (isLaptop ? 280 : 340); 
  
  // Angles: 
  // -70 deg = Top Right (Head)
  // 70 deg = Bottom Right (Feet)
  // Flow: Feet to Head spread
  const startAngle = 70;  
  const endAngle = -70;   

  //  7 ITEMS LIST: Bottom (Settings) se Top (Wellness)
  const navItems = [
    { id: "settings", icon: Settings, label: "Settings", color: "from-gray-500 to-gray-700" }, 
    { id: "system", icon: Cpu, label: "System Core", color: "from-orange-500 to-red-600" },
    { id: "schedule", icon: Calendar, label: "Daily Routine", color: "from-blue-500 to-cyan-600" }, //  New Scheduler Icon
    { id: "care", icon: HeartHandshake, label: "Care Protocol", color: "from-pink-500 to-rose-600" },
   
    { id: "wellness", icon: Activity, label: "Life Stats", color: "from-green-500 to-teal-600" },
    { id: "spotify", icon: Music, label: "Spotify Neural Link", color: "from-green-400 to-emerald-600" } //  Spotify Neural Link
  ];

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const menuOverlay = (
    <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
            
            {/* Background Dim - Optional visual focus */}
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"
            />

            {/* Tech Ring Visual - Spacing fix */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ width: radius * 2, height: radius * 2 }}
                className="absolute rounded-full border border-white/5 border-dashed animate-spin-slow pointer-events-none"
            />

            {/* Icons Loop */}
            {navItems.map((item, index) => {
              const totalItems = navItems.length;
              const step = (endAngle - startAngle) / (totalItems - 1);
              const currentAngle = startAngle + (index * step);
              const angleRad = (currentAngle * Math.PI) / 180;

              const x = Math.cos(angleRad) * radius;
              const y = Math.sin(angleRad) * radius; 

              return (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0, x: 0, y: 100, opacity: 0 }} 
                  animate={{ scale: 1, x: x, y: y, opacity: 1 }} 
                  exit={{ scale: 0, x: 0, y: 100, opacity: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 250, 
                    damping: 20, 
                    delay: index * 0.05 
                  }}
                  className="absolute pointer-events-auto"
                  style={{ 
                      marginLeft: isMobile ? -20 : -32, 
                      marginTop: isMobile ? -20 : -32 
                  }} 
                >
                   <motion.button
                      onClick={() => {
                          if (item.id === 'spotify') {
                              loginToSpotify(); //  Trigger Spotify login
                          } else {
                              onNavigate(item.id);
                          }
                          setIsOpen(false);
                      }}
                      whileHover={{ scale: 1.15, x: 10 }} 
                      whileTap={{ scale: 0.9 }}
                      className={`
                          group relative rounded-full 
                          bg-gradient-to-br ${item.color}
                          shadow-[0_0_20px_rgba(0,0,0,0.6)] 
                          border-2 border-white/20 backdrop-blur-md
                          flex items-center justify-center
                          z-50
                          transition-all duration-300
                          w-12 h-12 md:w-16 md:h-16
                      `}
                   >
                      <item.icon className="text-white drop-shadow-md w-6 h-6 md:w-8 md:h-8" />

                      {/* Label - Right Side */}
                      <div className="absolute left-full ml-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-3 py-1.5 rounded-lg text-xs md:text-sm text-white whitespace-nowrap border border-white/20 font-mono tracking-widest pointer-events-none shadow-2xl">
                          {item.label}
                      </div>
                   </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
  );

  return (
    <>
      {mounted && createPortal(menuOverlay, document.body)}

      <div className="relative flex items-center justify-center z-50">
        <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
                relative rounded-full flex items-center justify-center pointer-events-auto
                border border-white/20 backdrop-blur-xl shadow-[0_0_20px_rgba(124,58,237,0.4)]
                transition-colors duration-300
                w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16
                ${isOpen ? 'bg-red-500/80 border-red-400' : 'bg-indigo-600 border-indigo-400'}
            `}
        >
            <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
                {isOpen ? <X className="text-white w-5 h-5 md:w-6 md:h-6" /> : <LayoutGrid className="text-white w-5 h-5 md:w-6 md:h-6" />}
            </motion.div>
        </motion.button>
      </div>
    </>
  );
}