import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix THREE.js imports for React Three Fiber
      'three': 'three',
      '@react-three/fiber': '@react-three/fiber',
      '@react-three/drei': '@react-three/drei',
      '@react-three/postprocessing': '@react-three/postprocessing'
    }
  },
  optimizeDeps: {
    // Optimize Three.js dependencies
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing']
  },
  assetsInclude: ['**/*.vrm', '**/*.fbx', '**/*.bvH'],
  server: {
    port: 3001,
    host: true, // Allow network IPs
    strictPort: true, // Port 3001 lock karega
    
    //  BAS YAHI LINE MISSING THI TERE CODE MEIN 
    hmr: {
      clientPort: 3001, 
    },
    
    proxy: {
      '/api/vision': {
        target: 'http://127.0.0.1:5006',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/process': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})
