// src/controllers/MusicAnalyzer.ts
export class MusicAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  async startListening() {
    try {
      // 1. माइक के लिए पूछो
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. AudioContext बनाओ (Cross-browser support)
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      //  CRITICAL: ब्राउज़र लॉक खोलना
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      console.log("� [Maeve Ears] Neural Uplink Established. Hearing now...");
      return true;
    } catch (err) {
      console.error(" [Maeve Ears] Mic Connection Failed:", err);
      alert("Please allow Microphone access to let Maeve dance!");
      return false;
    }
  }

  getMusicVibe(): string {
    if (!this.analyser) return "IDLE";

    this.analyser.getByteFrequencyData(this.dataArray);

    //  Low Frequency (Bass) - 0 se 15 Hz range
    let bassSum = 0;
    for (let i = 0; i < 15; i++) bassSum += this.dataArray[i];
    const bass = bassSum / 15;

    //  Mid-High Frequency (Vocals/Melody)
    let midSum = 0;
    for (let i = 20; i < 60; i++) midSum += this.dataArray[i];
    const mids = midSum / 40;

    //  Console me check karo ye number aa rahe hain ya nahi
    if (bass > 20) {
        console.log(` Vibe Analysis -> Bass: ${Math.round(bass)} | Mids: ${Math.round(mids)}`);
    }

    //  DANCE MATRIX (Sensitive Thresholds)
    if (bass > 140) return "DANCE_COOL";   // Hip Hop / High Bass
    if (bass > 80) return "DANCE_HAPPY";    // Normal Pop
    if (mids > 70 && bass < 80) return "DANCE_SEXY"; // Slow/Romantic

    return "IDLE";
  }

  // Class ke andar ye method add kar:
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  // Volume nikaalne ke liye (Lip Sync ke liye)
  getVolume(): number {
    if (!this.analyser) return 0;
    const data = this.getFrequencyData();
    let sum = 0;
    // Sirf vocal range (mid frequencies) ko focus karo
    for (let i = 20; i < 100; i++) {
        sum += data[i];
    }
    return sum / 80; // Average volume
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.audioCtx) this.audioCtx.close();
    console.log(" [Maeve Ears] System Offline.");
  }
}
