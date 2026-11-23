/**
 * 无限城全程序化音频引擎（100% Web Audio API 原创合成，零外部版权音频）
 *
 * 音乐总线（music bus）：
 *  - 原创「无限城 · 幽玄」程序化循环配乐：
 *    - 深渊低频尺八/古琴感暗黑铺底（双失谐振荡器 + 慢扫低通滤波）
 *    - 平调子（Hirajōshi: D - Eb - G - A - Bb）琵琶乐句与泛音风铃定时演进
 *    - 远景大太鼓沉重脉动
 *
 * 音效总线（sfx bus）：
 *  - 入城鸣女琵琶震弦（enterSound）：多弦琵琶强拨 + 空间低频共振
 *  - 持续建造音景（construction）：随区块生成速率实时变化的木构震鸣、梁柱嘎吱、障子推拉与锤击
 *  - 空间异变波（beat）：鸣女琵琶连弦 + 太鼓轰鸣
 *  - 风声（wind）、振翅（flap）、碰撞（impact）、灵火拾取（wispChime）、深度里程碑鼓声（depthDrum）
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private plucks: AudioBuffer[] = [];
  private sfxVol = 0.9;
  private musicVol = 0.65;
  // 建造音景铺底增益，逐帧跟随建造速率变化
  private bedRumble: GainNode | null = null;
  private bedCreak: GainNode | null = null;
  private bedAir: GainNode | null = null;
  private nextShot = 0;

  // 原创程序化循环主题音乐调度
  private themeStarted = false;
  private themePaused = false;
  private themeTimer: number | null = null;
  private themeStep = 0;
  private droneGain: GainNode | null = null;

  muted = false;

  /** 必须在用户手势事件中调用 */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;

    // 柔和动态压缩器，防止多声部叠加削波
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master.connect(comp).connect(ctx.destination);

    // 音效与音乐双总线独立混音
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol * this.sfxVol * 1.5;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol * this.musicVol * 0.75;
    this.music.connect(this.master);

    // 共享白噪声缓冲
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // 飞行风声循环
    const src = ctx.createBufferSource();
    src.buffer = nb;
    src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 220;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    src.start();

    // Karplus-Strong 琵琶弦音（平调子 Hirajōshi 音阶：D3, Eb3, G3, A3, Bb3, D4）
    for (const f of [146.83, 155.56, 196.0, 220.0, 233.08, 293.66]) {
      this.plucks.push(this.renderPluck(ctx, f));
    }

    // ---- 持续建造音景铺底：三轨循环，由生成速率驱动 ----
    // 1. 低频木构轰鸣
    {
      const rSrc = ctx.createBufferSource();
      rSrc.buffer = nb;
      rSrc.loop = true;
      rSrc.playbackRate.value = 0.32;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 230;
      this.bedRumble = ctx.createGain();
      this.bedRumble.gain.value = 0;
      rSrc.connect(f).connect(this.bedRumble).connect(this.sfx);
      rSrc.start();
    }
    // 2. 古木承重嘎吱声
    {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 61;
      const lfoF = ctx.createOscillator();
      lfoF.frequency.value = 0.13;
      const lfoFG = ctx.createGain();
      lfoFG.gain.value = 9;
      lfoF.connect(lfoFG).connect(osc.frequency);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 330;
      f.Q.value = 7;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.61;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 130;
      lfo.connect(lfoG).connect(f.frequency);
      this.bedCreak = ctx.createGain();
      this.bedCreak.gain.value = 0;
      osc.connect(f).connect(this.bedCreak).connect(this.sfx);
      osc.start();
      lfo.start();
      lfoF.start();
    }
    // 3. 木屑微尘簌簌声
    {
      const aSrc = ctx.createBufferSource();
      aSrc.buffer = nb;
      aSrc.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2600;
      f.Q.value = 0.8;
      this.bedAir = ctx.createGain();
      this.bedAir.gain.value = 0;
      aSrc.connect(f).connect(this.bedAir).connect(this.sfx);
      aSrc.start();
    }

    void ctx.resume();
  }

  private renderPluck(ctx: AudioContext, freq: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.9);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = Math.round(sr / freq);
    // 带一点琵琶拨片击弦的尖锐泛音
    for (let i = 0; i < period; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - 0.25 * (i / period));
    }
    for (let i = period + 1; i < len; i++) {
      d[i] = 0.9965 * 0.5 * (d[i - period] + d[i - period - 1]);
    }
    // 整体衰减包络 + 琵琶共鸣箱「さわり（Sawari）」微颤
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      d[i] *= Math.exp(-t * 1.1) * (1 + 0.14 * Math.sin(t * 41));
    }
    return buf;
  }

  private playPluckOn(
    bus: GainNode | null,
    when: number,
    index: number,
    rate: number,
    gain: number,
    panValue = 0
  ): void {
    if (!this.ctx || !bus || this.plucks.length === 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.plucks[((index % this.plucks.length) + this.plucks.length) % this.plucks.length];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panValue;
    src.connect(g).connect(pan).connect(bus);
    src.start(when);
  }

  private playPluck(when: number, rate: number, gain: number): void {
    const idx = Math.floor(Math.random() * this.plucks.length);
    this.playPluckOn(this.sfx, when, idx, rate, gain, (Math.random() - 0.5) * 0.6);
  }

  /** 启动原创程序化「无限城」和风暗黑循环配乐（零外部文件依赖） */
  startMusic(): void {
    if (!this.ctx || !this.music || this.themeStarted) return;
    this.themeStarted = true;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // 深渊低频氛围铺底（D2 = 73.42 Hz 与 A2 = 110 Hz 双失谐和声）
    this.droneGain = ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, t0);
    this.droneGain.gain.exponentialRampToValueAtTime(0.24, t0 + 3.0);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 2.2;

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.07;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 110;
    filterLfo.connect(filterLfoGain).connect(droneFilter.frequency);
    filterLfo.start(t0);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = 73.42;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 73.85; // 轻微失谐营造空洞宏大感
    const osc2G = ctx.createGain();
    osc2G.gain.value = 0.25;

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = 110.0; // 五度悬置音
    const osc3G = ctx.createGain();
    osc3G.gain.value = 0.35;

    osc1.connect(droneFilter);
    osc2.connect(osc2G).connect(droneFilter);
    osc3.connect(osc3G).connect(droneFilter);
    droneFilter.connect(this.droneGain).connect(this.music);

    osc1.start(t0);
    osc2.start(t0);
    osc3.start(t0);

    // 步进乐句生成器：每 0.85 秒一个节拍，循环演进平调子琵琶、太鼓与幽玄泛音
    const motif = [0, -1, 3, 2, -1, 4, 3, 1, 0, -1, 5, 3, 2, -1, 1, 0];
    const tick = () => {
      if (!this.ctx || !this.music || this.themePaused) return;
      const now = this.ctx.currentTime + 0.04;
      const step = this.themeStep++;
      const note = motif[step % motif.length];

      // 琵琶旋律音符
      if (note >= 0) {
        const oct = step % 32 >= 16 && note === 5 ? 1.0 : 0.5;
        const pan = ((step % 5) - 2) * 0.28;
        this.playPluckOn(this.music, now, note, oct, 0.26, pan);
        // 偶尔叠加高八度余韵泛音
        if (step % 8 === 0) {
          this.playPluckOn(this.music, now + 0.14, note, 1.0, 0.14, -pan * 0.7);
        }
      }

      // 每 4 拍一声远景沉重太鼓
      if (step % 4 === 0) {
        const strong = step % 8 === 0;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(strong ? 66 : 54, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.55);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(strong ? 0.36 : 0.20, now + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
        osc.connect(g).connect(this.music);
        osc.start(now);
        osc.stop(now + 0.75);
      }

      // 每 12 拍一缕空灵尺八/金属风铃高音泛音
      if (step % 12 === 6) {
        const freqs = [587.33, 622.25, 880.0, 932.33]; // D5, Eb5, A5, Bb5
        const f = freqs[(step / 12 | 0) % freqs.length];
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.linearRampToValueAtTime(f * 0.994, now + 2.4);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.065, now + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = (Math.random() - 0.5) * 1.1;
        osc.connect(g).connect(pan).connect(this.music);
        osc.start(now);
        osc.stop(now + 2.7);
      }
    };

    tick();
    this.themeTimer = window.setInterval(tick, 850);
  }

  /**
   * 鸣女琵琶入城震弦（べん！）—— 空间骤然开启，吞噬来客。
   * 同时也可用于手动触发空间异变时的标志性琵琶重击。
   */
  enterSound(): void {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // 1. 标志性「べん！」双弦急扫（低音 D3 + 五度 A3 + 增二度 Eb4 妖异不协和）
    this.playPluckOn(this.sfx, t0, 0, 0.75, 0.85, -0.25);
    this.playPluckOn(this.sfx, t0 + 0.025, 3, 1.0, 0.75, 0.25);
    this.playPluckOn(this.sfx, t0 + 0.06, 1, 1.5, 0.55, 0.0);

    // 2. 空间折叠低频太鼓震荡
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(84, t0);
    sub.frequency.exponentialRampToValueAtTime(28, t0 + 1.1);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
    sub.connect(subG).connect(this.sfx);
    sub.start(t0);
    sub.stop(t0 + 1.4);

    // 3. 障子群落瞬开的气流呼啸
    if (this.noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.6;
      f.frequency.setValueAtTime(1400, t0);
      f.frequency.exponentialRampToValueAtTime(220, t0 + 0.85);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      n.connect(f).connect(ng).connect(this.sfx);
      n.start(t0, Math.random(), 0.95);
    }
  }

  /**
   * 无限城时刻都在自我生长 —— 逐帧传入平滑后的区块建造速率（cells/s），
   * 实时驱动低频木构铺底与随机立体声木工音效。
   */
  construction(rate: number): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const level = Math.min(rate / 6, 1);
    this.bedRumble?.gain.setTargetAtTime(level * 0.42, t, 0.25);
    this.bedCreak?.gain.setTargetAtTime(Math.min(rate / 9, 1) * 0.13, t, 0.4);
    this.bedAir?.gain.setTargetAtTime(level * 0.055, t, 0.3);

    if (rate < 0.15 || t < this.nextShot) return;
    this.nextShot = t + Math.min(Math.max(0.7 / (0.4 + rate * 0.35), 0.06), 1.0)
      * (0.75 + Math.random() * 0.5);
    this.carpentry(0.35 + level * 0.65);
  }

  /** 单次随机木构/障子建造音效 */
  private carpentry(intensity: number): void {
    if (!this.ctx || !this.sfx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const amp = 0.3 + intensity * 0.5;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.4;
    pan.connect(this.sfx);
    const r = Math.random();

    if (r < 0.3) {
      // 梁柱榫卯落位——清脆木击
      const knocks = Math.random() < 0.55 ? 2 : 1;
      for (let i = 0; i < knocks; i++) {
        const at = t0 + i * (0.08 + Math.random() * 0.06);
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 650 + Math.random() * 1100;
        f.Q.value = 8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(amp * (1 - i * 0.3), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
        src.connect(f).connect(g).connect(pan);
        src.start(at, Math.random(), 0.13);
      }
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + Math.random() * 90, t0);
      osc.frequency.exponentialRampToValueAtTime(95, t0 + 0.16);
      const og = ctx.createGain();
      og.gain.setValueAtTime(amp * 0.5, t0);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      osc.connect(og).connect(pan);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    } else if (r < 0.48) {
      // 急促木槌连敲
      const taps = 3 + Math.floor(Math.random() * 3);
      const gap = 0.07 + Math.random() * 0.035;
      const fq = 900 + Math.random() * 700;
      for (let i = 0; i < taps; i++) {
        const at = t0 + i * gap;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = fq * (1 + (Math.random() - 0.5) * 0.1);
        f.Q.value = 11;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(amp * 0.8 * (1 - i / (taps + 2)), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
        src.connect(f).connect(g).connect(pan);
        src.start(at, Math.random(), 0.08);
      }
    } else if (r < 0.68) {
      // 障子拉门急合
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2.2;
      f.frequency.setValueAtTime(380 + Math.random() * 220, t0);
      f.frequency.exponentialRampToValueAtTime(1150, t0 + 0.24);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amp * 0.8, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      src.connect(f).connect(g).connect(pan);
      src.start(t0, Math.random(), 0.32);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t0 + 0.24);
      osc.frequency.exponentialRampToValueAtTime(68, t0 + 0.37);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t0 + 0.24);
      og.gain.exponentialRampToValueAtTime(amp, t0 + 0.26);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.44);
      osc.connect(og).connect(pan);
      osc.start(t0 + 0.24);
      osc.stop(t0 + 0.5);
    } else if (r < 0.86) {
      // 老梁受压呻吟
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const base = 78 + Math.random() * 46;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.12), t0 + 0.42);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 290 + Math.random() * 190;
      f.Q.value = 6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amp * 0.55, t0 + 0.1);
      g.gain.setValueAtTime(amp * 0.45, t0 + 0.28);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(f).connect(g).connect(pan);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    } else {
      // 基石落位沉响
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.45;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 190;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amp * 1.15, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      src.connect(f).connect(g).connect(pan);
      src.start(t0, Math.random(), 0.6);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(56, t0);
      osc.frequency.exponentialRampToValueAtTime(33, t0 + 0.35);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(amp * 0.7, t0 + 0.04);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(og).connect(pan);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    }
  }

  /** 灵火拾取——随连击攀升的琵琶泛音 */
  wispChime(combo: number): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime;
    const rate = 1.0 + Math.min(combo, 9) * 0.14;
    this.playPluck(t0, rate, 0.4);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1040 * rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(g).connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  }

  /** 深度里程碑——深沉仪式大鼓 */
  depthDrum(): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(72, t0);
    osc.frequency.exponentialRampToValueAtTime(36, t0 + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    osc.connect(g).connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + 1.1);
  }

  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.sfx && this.ctx) {
      this.sfx.gain.setTargetAtTime(v * v * 1.5, this.ctx.currentTime, 0.08);
    }
  }

  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(v * v * 0.75, this.ctx.currentTime, 0.08);
    }
  }

  /** 空间异变波：远景太鼓轰鸣 + 波前抵达时的鸣女琵琶连弦 */
  beat(delay: number, strength: number): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.9);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.001, t0);
    og.gain.exponentialRampToValueAtTime(0.32 * (0.5 + strength * 0.5), t0 + 0.04);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    osc.connect(og).connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + 1.2);

    const tw = t0 + Math.max(delay, 0.05);
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) {
      this.playPluck(tw + i * (0.11 + Math.random() * 0.13), 0.85 + Math.random() * 0.5, 0.38 - i * 0.07);
    }
  }

  flap(): void {
    if (!this.ctx || !this.sfx || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const offset = Math.random() * 1.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(750, t0);
    f.frequency.exponentialRampToValueAtTime(170, t0 + 0.24);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0, offset, 0.3);
  }

  /** 逐帧风声调制 */
  wind(speed: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    const target = Math.min(0.015 + (speed / 30) * 0.13, 0.15);
    this.windGain.gain.setTargetAtTime(target, t, 0.18);
    this.windFilter.frequency.setTargetAtTime(170 + speed * 24, t, 0.2);
  }

  /** 擦碰建筑：木质撞击与低频闷响 */
  impact(strength: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime;
    const amp = Math.min(0.05 + strength * 0.01, 0.22);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.18);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(amp, t0 + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(og).connect(this.sfx!);
    osc.start(t0);
    osc.stop(t0 + 0.35);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 500;
    f.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp * 0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(t0, Math.random(), 0.2);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.1);
    }
  }

  /** 暂停菜单：冻结所有声音（配乐、风声与木构音效） */
  setPaused(p: boolean): void {
    this.themePaused = p;
    if (!this.ctx) return;
    if (p) {
      void this.ctx.suspend();
    } else {
      void this.ctx.resume();
    }
  }

  dispose(): void {
    if (this.themeTimer !== null) {
      window.clearInterval(this.themeTimer);
      this.themeTimer = null;
    }
  }
}
