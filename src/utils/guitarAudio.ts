// Web Audio API Sound Synthesizer for Guitar Hero gameplay

class GuitarAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Guitar-like pluck with overdrive / harmonic richness
  public playNote(lane: number, rating: 'PERFECT' | 'GOOD' | 'MISS', combo: number = 0) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      if (rating === 'MISS') {
        // Discordant scratch / buzz
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
        return;
      }

      // Pentatonic rock notes for lanes 0..3: A3, C4, D4, E4
      const frequencies = [220, 261.63, 293.66, 329.63];
      const baseFreq = frequencies[lane % frequencies.length] || 261.63;
      const freq = rating === 'PERFECT' ? baseFreq * (combo >= 10 ? 2 : 1) : baseFreq;

      // Dual oscillator for rich guitar timbre (Fundamental + Overdrive octave)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';

      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.5, now);

      // Lowpass filter envelope for pluck dynamic
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(rating === 'PERFECT' ? 3200 : 1800, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);

      // Amplitude envelope
      const vol = rating === 'PERFECT' ? 0.28 : 0.18;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);

      // Special chord sting for big streaks
      if (rating === 'PERFECT' && combo > 0 && combo % 8 === 0) {
        this.playStreakChord(now + 0.05);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  private playStreakChord(when: number) {
    if (!this.ctx) return;
    const chord = [440, 554.37, 659.25]; // A Major power chord
    chord.forEach(f => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, when);
      g.gain.setValueAtTime(0.12, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.4);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(when);
      osc.stop(when + 0.42);
    });
  }
}

export const guitarAudio = new GuitarAudioSynthesizer();
