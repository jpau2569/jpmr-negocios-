/**
 * Audio base sintetizado con WebAudio: sin assets, sin dependencias.
 * Cada efecto es una pequeña combinación de osciladores/ruido con envolvente.
 * El AudioContext se crea/reanuda en `unlock()` (requiere gesto del usuario).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Llamar desde un gesto del usuario (click en Jugar). Idempotente. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      } catch {
        return; // sin audio disponible: el juego sigue funcionando en silencio
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Tono con envolvente de ataque corto y decaimiento exponencial. */
  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    delay = 0,
    gain = 1,
    freqEnd?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Golpe de ruido filtrado (aterrizajes). */
  private thud(duration: number, cutoff: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const samples = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
  }

  coin(): void {
    this.tone(988, 0.08, 'sine', 0, 0.7);
    this.tone(1319, 0.16, 'sine', 0.06, 0.7);
  }

  jump(): void {
    this.tone(240, 0.14, 'triangle', 0, 0.5, 480);
  }

  land(impact: number): void {
    // Impactos más fuertes suenan más graves y más altos.
    const strength = Math.min(impact / 20, 1);
    this.thud(0.09, 400 + strength * 300, 0.25 + strength * 0.3);
  }

  missionComplete(): void {
    this.tone(659, 0.1, 'triangle', 0, 0.5);
    this.tone(880, 0.2, 'triangle', 0.09, 0.5);
  }

  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.28, 'triangle', i * 0.13, 0.6));
  }

  click(): void {
    this.tone(900, 0.04, 'triangle', 0, 0.3);
  }

  swoosh(): void {
    this.tone(720, 0.14, 'sawtooth', 0, 0.22, 150);
  }

  boing(): void {
    this.tone(280, 0.22, 'sine', 0, 0.4, 760);
  }

  squirt(): void {
    this.tone(420, 0.09, 'triangle', 0, 0.18, 820);
  }
}
