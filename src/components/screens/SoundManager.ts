// ============================================================
// Eureka – Web Audio Sound Manager
// Programmatic audio synthesis — no external files required.
// ============================================================

class SoundManager {
  private context: AudioContext | null = null;
  private muted = false;

  constructor() {
    const saved = localStorage.getItem("eureka-sounds-muted");
    this.muted = saved === "true";
  }

  // ── Lazy-init AudioContext (must be triggered by user gesture) ──
  private ctx(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }
    return this.context;
  }

  // ── Public API ─────────────────────────────────────────────────
  play(name: string) {
    if (this.muted) return;
    try {
      switch (name) {
        case "click":
          this.playClick();
          break;
        case "unlock":
          this.playUnlock();
          break;
        case "screenEnter":
          this.playScreenEnter();
          break;
        case "completion":
          this.playCompletion();
          break;
      }
    } catch {
      // Swallow — audio is non-critical
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem("eureka-sounds-muted", String(this.muted));
    return this.muted;
  }

  isSoundsMuted(): boolean {
    return this.muted;
  }

  // ── Synthesized sounds ─────────────────────────────────────────

  /** Short tap — 80 ms, descending tone */
  private playClick() {
    const c = this.ctx();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain).connect(c.destination);

    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.08);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Gentle ding — 200 ms, two ascending tones */
  private playUnlock() {
    const c = this.ctx();
    const t = c.currentTime;

    [880, 1320].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.connect(gain).connect(c.destination);

      const start = t + i * 0.06;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  /** Subtle whoosh — filtered noise burst, 120 ms */
  private playScreenEnter() {
    const c = this.ctx();
    const t = c.currentTime;
    const len = 0.12;
    const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
    }

    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2200, t);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);

    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  /** Celebratory chime — ascending C-E-G-C arpeggio, 350 ms */
  private playCompletion() {
    const c = this.ctx();
    const t = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.connect(gain).connect(c.destination);

      const start = t + i * 0.07;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.start(start);
      osc.stop(start + 0.22);
    });
  }
}

export const soundManager = new SoundManager();
export const playSound = (name: string) => soundManager.play(name);
