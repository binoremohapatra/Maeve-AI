// 🌐 Get Your PC IP Address for Maeve Vision System
// Run this script with: node scripts/get-ip.js

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`🔥 Your PC IP Address: ${iface.address}`);
        console.log(`📝 Update this in src/components/VisionManager.tsx`);
        console.log(`📝 Update this in src/services/api.ts`);
        return iface.address;
      }
    }
  }
  console.log('❌ No network interface found');
  return null;
}

getLocalIP();
