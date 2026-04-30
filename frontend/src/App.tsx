import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MavisDashboard } from './components/MavisDashboard';
import { Callback } from './pages/Callback';
import { WakeWordOverlay } from './components/WakeWordOverlay';
import { useFirebaseStore } from './stores/firebaseStore';
import { useMoodStore } from './stores/moodStore';
import { GameVibeProvider } from './vibe/GameVibeProvider';
import { useWorkerBridge } from './hooks/useWorkerBridge';
import { AnimationVFXTester } from './components/AnimationVFXTester';
import './index.css';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#050505] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-red-500 text-2xl mb-4">Application Error</h1>
            <p className="text-gray-400 mb-2">Something went wrong with the application.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              Reload Page
            </button>
            <details className="text-left text-gray-500 mt-4">
              <summary>Error Details</summary>
              <pre className="text-xs bg-gray-900 p-2 rounded mt-2">
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // Initialize Firebase connection
  useFirebaseStore();
  
  //  Initialize WebSocket Worker Bridge
  useWorkerBridge();
  
  //  Spotify Neural Link - Handle callback (for direct URL hash method)
  
  const { setSpotifyToken } = useMoodStore();
  
  useEffect(() => {
    // This handles old Implicit Grant Flow as fallback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (accessToken) {
      console.log(' Spotify Token Received (Implicit Flow)!');
      setSpotifyToken(accessToken);
      
      // Clean up the URL
      window.location.hash = '';
      console.log(' Spotify Neural Link Connected Successfully!');
    }
  }, [setSpotifyToken]);
  
  return (
    <ErrorBoundary>
      <GameVibeProvider>
        <WakeWordOverlay />
        <Router>
          <Routes>
            <Route path="/" element={<MavisDashboard />} />
            <Route path="/callback" element={<Callback />} />
          </Routes>
        </Router>
        {import.meta.env.DEV && <AnimationVFXTester />}
      </GameVibeProvider>
    </ErrorBoundary>
  );
}

export default App;
