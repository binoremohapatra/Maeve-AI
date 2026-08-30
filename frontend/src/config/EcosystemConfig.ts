//  TERA LOCAL PC IP (ipconfig se jo mila)
export const PC_IP = "192.168.1.33"; 

export const isLocalDevelopment = () => {
  const host = window.location.hostname;
  // Agar tu PC par hai ya local wifi par hai, toh 'local' manega
  return host === 'localhost' || host === '127.0.0.1' || host === PC_IP;
};

export const getBaseUrl = (port: number, protocol = 'http') => {
  if (isLocalDevelopment()) {
    //  Fast Local Network Routing
    return `${protocol}://${window.location.hostname}:${port}`;
  }

  //  PHONE / CLOUD ROUTING (Tunnels)
  // Apne Cloudflare links yahan update karta rehna jab phone pe chalana ho
  const cloudLinks: Record<number, string> = {
    5000: "https://deviant-park-emacs-bars.trycloudflare.com",      // Brain
    5002: "wss://deviant-park-emacs-bars.trycloudflare.com",  // Ears
    5006: "wss://luther-live-addresses-joining.trycloudflare.com", // Vision
    8080: "https://deviant-park-emacs-bars.trycloudflare.com"        // Java Core
  };

  return cloudLinks[port] || `${protocol}://${window.location.hostname}:${port}`;
};

//  GLOBAL API ENDPOINTS (Exported for everywhere)
export const API_ENDPOINTS = {
    BRAIN: import.meta.env.VITE_TTS_SERVER_URL || getBaseUrl(5000),
    BRAIN_WS: (import.meta.env.VITE_TTS_SERVER_URL || getBaseUrl(5000)).replace(/^http/, 'ws'),
    VISION_WS: `${import.meta.env.VITE_VISION_SERVER_URL || getBaseUrl(5006, 'ws')}/ws/vision`,
    JAVA_CORE: import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || getBaseUrl(8080),
    TTS: import.meta.env.VITE_TTS_SERVER_URL || getBaseUrl(5003)
};

//  CROSS-ACTION SYSTEM
export const CROSS_ACTION_CONFIG = {
  javaBackend: getBaseUrl(8080),
  brainEndpoint: `${getBaseUrl(5000)}/api/cross-action`,
  supportedCommands: [
    'stop_spotify',
    'start_spotify', 
    'open_vscode',
    'close_vscode',
    'shutdown_pc',
    'restart_pc'
  ]
};

//  APPLE HAND-OFF SYSTEM
export const APPLE_HANDOFF = {
  enabled: true,
  phoneNumber: "+91XXXXXXXXXX", // तेरा phone number डालो
  commands: {
    "Maeve, stop Spotify on my PC": {
      action: "stop_spotify",
      description: "Spotify बंद कर देगा"
    },
    "Maeve, start Spotify on my PC": {
      action: "start_spotify", 
      description: "Spotify शुरू कर देगा"
    },
    "Maeve, open VS Code": {
      action: "open_vscode",
      description: "VS Code खोल देगा"
    },
    "Maeve, shutdown my PC": {
      action: "shutdown_pc",
      description: "PC शटडाउन कर देगा"
    }
  }
};

//  AUTO-DETECTION HELPERS
export const getCurrentEnvironment = () => {
  return {
    isLocal: isLocalDevelopment(),
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    chatApi: `${API_ENDPOINTS.JAVA_CORE}/api/chats`,
    brainWs: API_ENDPOINTS.BRAIN_WS,
    brainApi: API_ENDPOINTS.BRAIN,
    crossAction: CROSS_ACTION_CONFIG
  };
};
