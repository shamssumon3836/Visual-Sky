// Web Audio API Synthesizer & Custom Audio Player
// Pure client-side, zero external assets required, works 100% offline & on localhost

class AudioNotificationEngine {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play synthesized notification sounds
  public playPreset(preset: 'chime' | 'bell' | 'ping' | 'crisp' | 'radar' | 'subtle' = 'chime', volume: number = 80) {
    try {
      const ctx = this.getAudioContext();
      const masterGain = ctx.createGain();
      masterGain.gain.value = Math.max(0, Math.min(1, volume / 100)) * 0.4;
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (preset) {
        case 'chime': {
          // Dual harmonic chime
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);
            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.6);
          });
          break;
        }

        case 'bell': {
          // Rich bell tone
          const fundamental = 880;
          [1, 2.76, 5.4, 8.9].forEach((harmonic, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = fundamental * harmonic;
            gain.gain.setValueAtTime(0.4 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2 / (idx + 1));
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.3);
          });
          break;
        }

        case 'ping': {
          // Futuristic neon ping
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }

        case 'crisp': {
          // Clean modern pop
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc1.frequency.linearRampToValueAtTime(880, now + 0.06);
          gain1.gain.setValueAtTime(0.4, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc1.connect(gain1);
          gain1.connect(masterGain);
          osc1.start(now);
          osc1.stop(now + 0.22);
          break;
        }

        case 'radar': {
          // Tactical radar pulse
          [700, 950].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            gain.gain.setValueAtTime(0.35, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.3);
          });
          break;
        }

        default: {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.25);
        }
      }
    } catch (e) {
      console.warn('Audio playback error (user interaction might be needed):', e);
    }
  }

  // Play custom uploaded base64 / audio URL
  public playCustomAudio(base64OrUrl: string, volume: number = 80) {
    try {
      const audio = new Audio(base64OrUrl);
      audio.volume = Math.max(0, Math.min(1, volume / 100));
      audio.play().catch(err => {
        console.warn('Custom audio playback failed, falling back to synthesizer:', err);
        this.playPreset('chime', volume);
      });
    } catch (e) {
      this.playPreset('chime', volume);
    }
  }
}

export const audioEngine = new AudioNotificationEngine();
