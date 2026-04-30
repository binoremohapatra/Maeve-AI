# 👁️ Maeve Vision System Setup Guide

## 🚀 Quick Start (Local WiFi)

### 1. Update Your IP Address
Your PC IP is already configured as: `192.168.1.33`

If you need to update it:
```bash
node scripts/get-ip.cjs
```

### 2. Start Your Backend Services
Make sure your Python services are running:
- **Brain**: Port 5000 (Chat processing)
- **Eyes**: Port 5006 (Vision processing)
- **Hands**: Port 5001 (PC control)
- **Ears**: Port 5002 (Audio processing)

### 3. Start Frontend
```bash
npm run dev -- --host
```

### 4. Test on Phone
1. Connect phone to same WiFi
2. Open browser: `http://192.168.1.33:3002`
3. Allow camera permissions
4. Look for "God-Mode Active 👁️" status

### 5. Test Vision
Make an expression (angry, happy, sad) and say:
> "Maeve, how do I look?"

Maeve should respond based on what she sees through your camera!

## 🔧 Architecture Overview

```
Phone (5G/WiFi) → Frontend → VisionManager → WebSocket (Port 5006) → Python Vision Service
                                                          ↓
                                                       Visual Vibe
                                                          ↓
Frontend → sendMessage() → Brain (Port 5000) → LLM → Response with visual context
```

## 🌍 Global Access (Phase 2)

When you want to control your PC from outside your home:

### 1. Install Cloudflare Tunnel
```bash
npm install -g cloudflared
cloudflared tunnel login
```

### 2. Create Tunnel
```bash
cloudflared tunnel create maeve-global
```

### 3. Use Config File
```bash
cloudflared tunnel --config cloudflare-tunnel-config.yml run maeve-global
```

### 4. Update Frontend URLs
Replace local IPs with your tunnel URLs in:
- `src/components/VisionManager.tsx`
- `src/services/api.ts`

## 🛠️ Troubleshooting

### Vision Not Working?
1. Check if Python service on Port 5006 is running
2. Verify camera permissions on phone
3. Check WiFi connection (same network)
4. Look for WebSocket errors in browser console

### PC Not Reachable?
1. Run `node scripts/get-ip.cjs` to verify IP
2. Check firewall settings
3. Ensure Python services are running
4. Test with: `curl http://192.168.1.33:5000/ping`

### Camera Permission Denied?
1. In browser settings, allow camera for this site
2. Use HTTPS if required (Cloudflare tunnel)
3. Try different browser (Chrome recommended)

## 📱 Features Enabled

✅ **Real-time Vision Processing** - Camera frames sent every 3 seconds  
✅ **Visual Context Integration** - LLM knows what you look like  
✅ **Battery Optimized** - Low frequency frame sending  
✅ **Status Indicators** - Visual feedback for connection status  
✅ **Fallback to Cloud** - Works even when PC is offline  

## 🎯 Next Steps

1. **Test Local Setup** - Verify everything works on WiFi
2. **Add More Expressions** - Train vision to detect emotions
3. **Global Deployment** - Set up Cloudflare tunnels
4. **Mobile App** - Create native app for better performance

---

🔥 **Your Maeve now has eyes! She can see you and respond to your expressions!** 👁️📱
