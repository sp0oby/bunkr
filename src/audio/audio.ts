// BUNKR audio: every sound effect is synthesized live with Web Audio (no
// samples), plus a generative "bunker radio" music loop and HATCH's voice
// played through a little CRT-speaker filter.

export type Sfx =
  | 'click' | 'pop' | 'build' | 'dig' | 'pickup' | 'assign' | 'denied' | 'boop' | 'card'
  | 'tick' | 'bag' | 'death' | 'raid' | 'raidwon' | 'raidlost' | 'nuke' | 'cope' | 'day'
  | 'recruit' | 'quit' | 'open' | 'close' | 'smash' | 'crit' | 'fpress' | 'revive';

export type MusicMode = 'prep' | 'bunker' | 'raid' | 'off';
/** What the Shill Tower plays during bunker time. */
export type RadioStation = 'hopium' | 'blues' | 'doomer';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private voiceBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private mode: MusicMode = 'off';
  private station: RadioStation = 'hopium';
  private nextBeat = 0;
  private beat = 0;
  private lastTick = 0;
  private voiceCache = new Map<string, AudioBuffer | null>();
  private currentVoice: AudioBufferSourceNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('bunkr.muted') === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = this.bus(0.55);
    this.musicBus = this.bus(0.0);
    this.voiceBus = this.bus(0.9);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    window.setInterval(() => this.schedule(), 60);
    this.setMusic(this.mode === 'off' ? 'off' : this.mode, true);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('bunkr.muted', this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private bus(level: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = level;
    g.connect(this.master);
    return g;
  }

  // ------------------------------------------------------------------
  // Synth primitives
  // ------------------------------------------------------------------

  private tone(o: { f: number; f2?: number; t?: number; dur: number; type?: OscillatorType; vol?: number; attack?: number; out?: AudioNode; vibrato?: number }): void {
    const ctx = this.ctx!;
    const t = (o.t ?? 0) + ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      depth.gain.value = o.f * 0.06;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + o.dur);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(o.out ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private noise(o: { t?: number; dur: number; vol?: number; type?: BiquadFilterType; f: number; f2?: number; q?: number; attack?: number; out?: AudioNode }): void {
    const ctx = this.ctx!;
    const t = (o.t ?? 0) + ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type ?? 'lowpass';
    filt.frequency.setValueAtTime(o.f, t);
    if (o.f2) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    filt.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(filt).connect(g).connect(o.out ?? this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.05);
  }

  // ------------------------------------------------------------------
  // Sound effects
  // ------------------------------------------------------------------

  play(s: Sfx): void {
    if (!this.ctx || this.muted) return;
    const r = () => 0.94 + Math.random() * 0.12; // slight pitch variance so repeats don't grate
    switch (s) {
      case 'click':
        this.tone({ f: 900 * r(), f2: 600, dur: 0.05, type: 'square', vol: 0.12 });
        break;
      case 'pop':
        this.tone({ f: 420 * r(), f2: 980, dur: 0.09, type: 'sine', vol: 0.35 });
        break;
      case 'open':
        this.tone({ f: 300, f2: 900, dur: 0.18, type: 'triangle', vol: 0.25 });
        this.noise({ dur: 0.2, f: 600, f2: 3000, type: 'bandpass', vol: 0.12 });
        break;
      case 'close':
        this.tone({ f: 800, f2: 260, dur: 0.15, type: 'triangle', vol: 0.2 });
        break;
      case 'build':
        this.noise({ dur: 0.25, f: 500, f2: 80, vol: 0.6 });
        this.tone({ f: 110, f2: 55, dur: 0.25, type: 'sine', vol: 0.5 });
        [0.12, 0.2, 0.28].forEach((t, i) => this.tone({ t, f: 520 + i * 160, dur: 0.06, type: 'square', vol: 0.12 }));
        this.tone({ t: 0.34, f: 1046, dur: 0.25, type: 'triangle', vol: 0.18 });
        break;
      case 'dig':
        [0, 0.14, 0.28, 0.45].forEach((t) => this.noise({ t, dur: 0.12, f: 1800, f2: 300, type: 'bandpass', q: 1.5, vol: 0.5 }));
        this.tone({ t: 0.45, f: 70, f2: 40, dur: 0.4, type: 'sine', vol: 0.5 });
        break;
      case 'pickup':
        this.tone({ f: 300 * r(), f2: 700, dur: 0.12, type: 'triangle', vol: 0.25 });
        break;
      case 'assign':
        this.tone({ f: 260 * r(), f2: 520, dur: 0.22, type: 'sine', vol: 0.4, vibrato: 18 });
        this.noise({ dur: 0.1, f: 300, vol: 0.25 });
        break;
      case 'smash':
        this.noise({ dur: 0.07, f: 1800 * r(), f2: 400, type: 'bandpass', vol: 0.3 });
        this.tone({ f: 140 * r(), f2: 60, dur: 0.08, type: 'square', vol: 0.18 });
        break;
      case 'crit':
        this.noise({ dur: 0.18, f: 3000, f2: 200, type: 'bandpass', vol: 0.4 });
        this.tone({ f: 90, f2: 40, dur: 0.25, type: 'square', vol: 0.25 });
        this.tone({ t: 0.03, f: 880, f2: 1760, dur: 0.12, type: 'triangle', vol: 0.18 });
        break;
      case 'fpress': {
        // A tiny church bell per F, pitch creeping up with every press.
        const f = 660 * r();
        this.tone({ f, dur: 0.12, type: 'sine', vol: 0.18 });
        this.tone({ f: f * 2.01, dur: 0.08, type: 'sine', vol: 0.06 });
        break;
      }
      case 'revive':
        this.tone({ f: NOTE(60), dur: 0.5, type: 'sine', vol: 0.2, vibrato: 4 });
        this.tone({ t: 0.05, f: NOTE(67), dur: 0.5, type: 'sine', vol: 0.12 });
        break;
      case 'denied':
        this.tone({ f: 150, dur: 0.12, type: 'square', vol: 0.15 });
        this.tone({ t: 0.13, f: 120, dur: 0.18, type: 'square', vol: 0.15 });
        break;
      case 'boop': {
        const f = [392, 440, 523, 587, 659][Math.floor(Math.random() * 5)];
        this.tone({ f, f2: f * 1.6, dur: 0.14, type: 'triangle', vol: 0.35 });
        this.tone({ t: 0.06, f: f * 2, dur: 0.12, type: 'sine', vol: 0.15 });
        break;
      }
      case 'card':
        // News sting: "DUN dun DUNNN"
        [[72, 0], [67, 0.12], [79, 0.24]].forEach(([n, t]) => this.tone({ t, f: NOTE(n), dur: n === 79 ? 0.45 : 0.12, type: 'square', vol: 0.14 }));
        this.noise({ t: 0.24, dur: 0.4, f: 4000, type: 'highpass', vol: 0.06 });
        break;
      case 'tick': {
        const now = this.ctx.currentTime;
        if (now - this.lastTick < 0.12) return;
        this.lastTick = now;
        this.tone({ f: 1400 * r(), dur: 0.04, type: 'triangle', vol: 0.06 });
        break;
      }
      case 'bag':
        [84, 88, 91, 96].forEach((n, i) => this.tone({ t: i * 0.07, f: NOTE(n), dur: 0.3, type: 'sine', vol: 0.22 }));
        this.noise({ dur: 0.5, f: 6000, type: 'highpass', vol: 0.05 });
        break;
      case 'death':
        // Sad trombone-ish slide down.
        [[58, 0], [57, 0.3], [56, 0.6]].forEach(([n, t]) => this.tone({ t, f: NOTE(n), dur: 0.28, type: 'sawtooth', vol: 0.12, vibrato: 5 }));
        this.tone({ t: 0.9, f: NOTE(55), f2: NOTE(43), dur: 0.9, type: 'sawtooth', vol: 0.14, vibrato: 6 });
        break;
      case 'raid':
        for (let i = 0; i < 3; i++) this.tone({ t: i * 0.7, f: 500, f2: 950, dur: 0.65, type: 'sawtooth', vol: 0.14 });
        break;
      case 'raidwon':
        [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.5]].forEach(([n, t]) => this.tone({ t, f: NOTE(n), dur: 0.22, type: 'square', vol: 0.13 }));
        break;
      case 'raidlost':
        [[64, 0], [60, 0.25], [55, 0.5]].forEach(([n, t]) => this.tone({ t, f: NOTE(n), dur: 0.35, type: 'triangle', vol: 0.2 }));
        break;
      case 'nuke':
        // Siren wind-up, then the boom.
        this.tone({ f: 300, f2: 800, dur: 1.2, type: 'sawtooth', vol: 0.12 });
        this.noise({ t: 1.1, dur: 4.5, f: 3000, f2: 50, vol: 0.9, attack: 0.02 });
        this.tone({ t: 1.1, f: 60, f2: 24, dur: 4, type: 'sine', vol: 0.9, attack: 0.02 });
        this.noise({ t: 1.6, dur: 3, f: 400, f2: 80, type: 'lowpass', vol: 0.4 });
        break;
      case 'cope':
        this.noise({ dur: 0.7, f: 800, f2: 4000, type: 'bandpass', q: 2, vol: 0.25, attack: 0.3 });
        this.tone({ t: 0.5, f: NOTE(76), dur: 0.5, type: 'sine', vol: 0.12 });
        break;
      case 'day':
        this.tone({ f: NOTE(76), dur: 0.35, type: 'sine', vol: 0.12 });
        this.tone({ t: 0.15, f: NOTE(81), dur: 0.5, type: 'sine', vol: 0.12 });
        break;
      case 'recruit':
        // A porta-potty flush, then a cheerful blip: someone crawled in.
        this.noise({ dur: 1.0, f: 1200, f2: 200, type: 'bandpass', q: 3, vol: 0.35, attack: 0.05 });
        this.tone({ t: 0.9, f: 523, f2: 1046, dur: 0.15, type: 'square', vol: 0.12 });
        break;
      case 'quit':
        this.tone({ f: 600, f2: 120, dur: 0.6, type: 'triangle', vol: 0.2 });
        this.noise({ t: 0.5, dur: 0.15, f: 200, vol: 0.4 }); // door slam
        break;
    }
  }

  // ------------------------------------------------------------------
  // Bunker radio: a generative lo-fi loop that changes with the phase.
  // ------------------------------------------------------------------

  setMusic(mode: MusicMode, force = false): void {
    if (mode === this.mode && !force) return;
    this.mode = mode;
    if (!this.ctx) return;
    const level = mode === 'off' ? 0 : mode === 'raid' ? 0.22 : 0.16;
    this.musicBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
    if (this.nextBeat < this.ctx.currentTime) this.nextBeat = this.ctx.currentTime + 0.1;
  }

  /** Change the bunker-time station; takes over at the next bar. */
  setStation(st: RadioStation): void {
    this.station = st;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.mode === 'off') return;
    const radio = this.mode === 'bunker' ? this.station : null;
    const bpm = this.mode === 'raid' ? 150 : this.mode === 'prep' ? 104 : radio === 'hopium' ? 96 : radio === 'blues' ? 66 : 74;
    const step = 60 / bpm / 2; // eighth notes
    // Am F C G (bunker) / Dm Bb A (prep) / E power riff (raid)
    const progs: Record<Exclude<MusicMode, 'off'>, number[][]> = {
      bunker: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      prep: [[50, 53, 57], [46, 50, 53], [45, 49, 52], [45, 49, 52]],
      raid: [[52, 59, 64], [52, 59, 64], [55, 62, 67], [50, 57, 62]],
    };
    // Hopium FM: doo-wop I-vi-IV-V in C. Bear Market Blues: E minor blues. Doomer Wave: slow minor synth.
    const radios: Record<RadioStation, number[][]> = {
      hopium: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
      blues: [[52, 55, 59], [52, 55, 59], [57, 60, 64], [52, 55, 59], [59, 62, 66], [57, 60, 64], [52, 55, 59], [59, 62, 66]],
      doomer: [[45, 48, 52], [41, 45, 48], [43, 46, 50], [40, 43, 47]],
    };
    const prog = radio ? radios[radio] : progs[this.mode];
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const t = this.nextBeat - ctx.currentTime;
      const bar = Math.floor(this.beat / 8) % prog.length;
      const chord = prog[bar];
      const inBar = this.beat % 8;
      const out = this.musicBus;
      if (inBar === 0) {
        // Pad + bass at the top of each bar.
        const padType: OscillatorType = radio === 'doomer' ? 'sawtooth' : 'triangle';
        for (const n of chord) this.tone({ t, f: NOTE(n), dur: step * 8, type: padType, vol: radio === 'doomer' ? 0.035 : 0.07, attack: radio === 'doomer' ? 0.6 : 0.25, out });
        this.tone({ t, f: NOTE(chord[0] - 24), dur: step * 3, type: 'sine', vol: 0.35, out });
      }
      if (this.mode !== 'bunker' && inBar === 4) this.tone({ t, f: NOTE(chord[0] - 24), dur: step * 2, type: 'sine', vol: 0.3, out });
      if (this.mode === 'raid') {
        this.tone({ t, f: NOTE(chord[0] - 12), dur: step * 0.8, type: 'sawtooth', vol: 0.08, out });
        if (inBar % 2 === 0) this.noise({ t, dur: 0.12, f: 120, vol: 0.5, out }); // kick
      } else {
        // Hopium FM: doo-wop "shoo-bop" on the off-beats. Blues: a lazy bent lead.
        if (radio === 'hopium' && (inBar === 3 || inBar === 7)) this.tone({ t, f: NOTE(chord[2] + 12), dur: step * 0.7, type: 'square', vol: 0.03, out });
        if (radio === 'blues') {
          // Walking bass on every beat (root, third, fifth, sixth), and a bent "harmonica" lick.
          if (inBar % 2 === 0) {
            const walk = [0, 4, 7, 9][inBar / 2];
            this.tone({ t, f: NOTE(chord[0] - 12 + walk), dur: step * 1.6, type: 'triangle', vol: 0.16, out });
          }
          if (inBar === 3 || (inBar === 6 && Math.random() < 0.6)) {
            const n = chord[inBar === 3 ? 1 : 2] + 12;
            this.tone({ t, f: NOTE(n + 1), f2: NOTE(n), dur: step * 2.2, type: 'sawtooth', vol: 0.035, vibrato: 5, out });
          }
        }
        // Lazy arpeggio, a little swung.
        if (radio !== 'blues' && (inBar % 2 === 1 || Math.random() < 0.3)) {
          const n = chord[(this.beat * 7) % chord.length] + 12;
          this.tone({ t: t + (inBar % 2 ? step * 0.12 : 0), f: NOTE(n), dur: step * 1.5, type: 'sine', vol: 0.06, out });
        }
        if (inBar === 2 || inBar === 6) this.noise({ t, dur: 0.08, f: 180, vol: 0.25, out }); // soft kick
      }
      if (inBar % 2 === 1) this.noise({ t, dur: 0.04, f: 7000, type: 'highpass', vol: 0.05, out }); // hat
      // Old-radio crackle.
      if (Math.random() < 0.12) this.noise({ t: t + Math.random() * step, dur: 0.02, f: 3000, type: 'bandpass', vol: 0.05, out });
      this.nextBeat += step;
      this.beat++;
    }
  }

  // ------------------------------------------------------------------
  // HATCH voice
  // ------------------------------------------------------------------

  /** Play a pre-rendered HATCH line through a small, crunchy CRT speaker. */
  async voice(url: string): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    let buf = this.voiceCache.get(url);
    if (buf === undefined) {
      try {
        const res = await fetch(url);
        buf = res.ok ? await ctx.decodeAudioData(await res.arrayBuffer()) : null;
      } catch {
        buf = null;
      }
      this.voiceCache.set(url, buf);
    }
    if (!buf) return;
    this.currentVoice?.stop();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1.06;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 380;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1800;
    peak.gain.value = 6;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    src.connect(hp).connect(peak).connect(lp).connect(shaper).connect(this.voiceBus);
    // Duck the music while HATCH talks.
    this.musicBus.gain.setTargetAtTime(0.05, ctx.currentTime, 0.1);
    src.onended = () => this.setMusic(this.mode, true);
    src.start();
    this.currentVoice = src;
  }
}

export const audio = new AudioEngine();
