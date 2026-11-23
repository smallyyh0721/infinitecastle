import { IS_TOUCH } from '../core/engine';
import type { IconicLandmark } from '../world/districts';

export interface UIInitial {
  seed: string;
  q: string;
  motion: number;
  pace: number;
  weather: string;
  mist: number;
  density: number;
  music: number;
  sfx: number;
  light: number;
  inv: boolean;
  ghost: boolean;
  chars: boolean;
}

export interface UIOptions {
  initial: UIInitial;
  onStart: (mode: 'free' | 'hunt') => void;
  onDaily: () => void;
  onShare: () => string;
  onSeed: (seed: string) => void;
  onQuality: (tier: number | null) => void;
  onMotion: (v: number) => void;
  onInvertY: (b: boolean) => void;
  onGhost: (b: boolean) => void;
  onChars: (b: boolean) => void;
  onMute: (b: boolean) => void;
  onWeather: (w: string | null) => void;
  onPace: (v: number) => void;
  onMist: (v: number) => void;
  onDensity: (v: number) => void;
  onLight: (v: number) => void;
  onMusicVol: (v: number) => void;
  onSfxVol: (v: number) => void;
  onPause: (paused: boolean) => void;
  onQuit: () => void;
  onBiwa: () => void;
  onWarp: (landmark: IconicLandmark) => void;
}

export interface HudData {
  fps: number;
  spd: number;
  alt: number;
  rooms: number;
  draws: number;
  tris: number;
  tier: string;
  waves: number;
  district: string;
  chapter: string;
}

const HINTS = [
  IS_TOUCH ? '按住「振翅」加速俯冲 · 「悬停」减速刹车' : '按 TAB 键在六大原作名场面间循环穿梭（Shift+TAB 反向切换）',
  IS_TOUCH ? '打开顶部「设定」可直达六大原作名场面' : '名场面中用 W/S 前后、A/D 左右平移、空格/Shift 升降自由探索，飞出边界自动翱翔',
  '鸣女拨动琵琶之时，整座无限城将随之移位翻转 — 按 B 键可随时拨弦触发异变',
  IS_TOUCH ? '拖动屏幕右侧调整飞行视角' : '任意位置按 P 键可手动切换漫游/翱翔 · ESC 开启神社设定 · H 键隐藏界面截图',
  '当前网址已保存世界种子与全部参数，复制链接即可分享同一座无限城',
  '向深渊之下俯冲吧——这座木构迷城没有尽头',
];

const HUNT_HINTS = [
  '碧绿灵火潜藏于紧邻木构的险峻处——街巷、廊道与屋檐之间',
  '连续穿过灵火即可叠加连击倍率，停顿数秒后连击将消散',
  '高速贴近梁柱与墙壁掠飞（擦墙滑行）将持续获得高额危险加分',
  '每向下突破 100 米新深度，太鼓轰鸣并奖励 +200 分',
];

export class UI {
  private hud!: HTMLElement;
  private gear!: HTMLElement;
  private hint!: HTMLElement;
  private flash!: HTMLElement;
  private intro!: HTMLElement;
  private settings!: HTMLElement;
  private hintIdx = 0;
  private hintTimer: number | null = null;
  private started = false;
  private hudHidden = false;
  private pauseOpenedAt = 0;
  private pendingMode: 'free' | 'hunt' = 'free';
  private hintPool: string[] = HINTS;

  /** 正式进入无限城——由开城门与入城须知共用 */
  private begin(): void {
    this.started = true;
    this.intro.classList.add('hidden');
    this.hud.classList.add('on');
    this.startHints();
    this.o.onStart(this.pendingMode);
  }

  constructor(private o: UIOptions) {
    const ini = o.initial;
    const ui = document.getElementById('ui')!;
    ui.innerHTML = `
      <div id="intro">
        <div class="title-kanji">無限城</div>
        <div class="title-en">鬼灭之刃 · 异次元木构迷城</div>
        <div class="title-sub">无天无地 · 鸣女琵琶所织之无尽空间</div>
        <button id="start-btn">展翼入城</button>
        <div id="mode-row">
          <button id="hunt-btn">狩 灵火狩猎</button>
          <button id="daily-btn">日 今日无限城</button>
        </div>
        <div id="mode-note">灵火狩猎 — 穿行险峻回廊追逐碧绿灵火 · 今日无限城 — 每日同步同一座世界种子</div>
        <div class="controls-hint">${
          IS_TOUCH
            ? '<span><b>左侧摇杆</b> 移动/转向</span><span><b>右侧拖动</b> 视角</span><span><b>振翅</b> 加速</span><span><b>⛩ 设定</b> 六大名场面直达</span>'
            : '<span><b>TAB</b> 切换六大名场面（Shift+TAB 反向）</span><span><b>W / S / A / D</b> 名场面自由前后左右探索（翱翔时加速/转向）</span><span><b>空格 / Shift</b> 升降 / 振翅刹车</span><span><b>Q / E</b> 横滚</span><span><b>P</b> 漫游/翱翔切换</span><span><b>B</b> 琵琶异变</span><span><b>C</b> 视角</span><span><b>H</b> 摄影隐藏</span><span><b>ESC</b> 神社设定</span>'
        }</div>
        <div class="seed-line">世界种子 · ${this.esc(ini.seed)}</div>
      </div>
      <div id="hud">
        <div class="hud-tl">
          <div>速度 <b id="h-spd">0</b></div>
          <div>海拔 <b id="h-alt">0</b></div>
          <div>异变 <b id="h-waves">0</b></div>
        </div>
        <div id="score-row">
          <div id="h-score">0</div>
          <div id="h-combo"></div>
          <div id="combo-bar"><i></i></div>
          <div id="h-best"></div>
        </div>
        <div class="hud-tr">
          <div><b id="h-fps">0</b> FPS</div>
          <div><b id="h-rooms">0</b> 区块 · <b id="h-draws">0</b> 绘制</div>
          <div><b id="h-tris">0</b>k 面 · <b id="h-tier"></b></div>
        </div>
        <div id="place">
          <div id="h-district"></div>
          <div id="h-chapter"></div>
        </div>
        <div id="hint"></div>
        <div id="beat-flash"></div>
      </div>
      <div id="touch-ui">
        <div id="stick-zone"><div id="stick-base"><div id="stick-nub"></div></div></div>
        <div class="tbtn" id="btn-flap">振翅</div>
        <div class="tbtn" id="btn-brake">悬停</div>
      </div>
      <div id="gear">⛩<span>设定</span></div>
      <div id="tour">
        <div id="tour-card">
          <h3>入城须知 · 鎹鸦飞行指引</h3>
          ${
            IS_TOUCH
              ? `<div class="tour-row"><b>自由飞行</b>左侧浮现虚拟摇杆控制方向 · 右侧拖动调整视线 · 「振翅」加速 · 「悬停」减速</div>
                 <div class="tour-row"><b>无重天地</b>无限城内没有固定上下方向，倒悬俯冲与盘旋皆为常态</div>
                 <div class="tour-row"><b>⛩ 神社设定</b>点击顶部「设定」暂停一切——可自由调节天气、雾气、光照、密度、速度与音效</div>
                 <div class="tour-row"><b>分享世界</b>网址实时记录当前种子与全部参数，刷新不丢失，分享即同游</div>`
              : `<div class="tour-row"><b>名场面切换</b>按 <b>TAB</b> 键在六大原作名场面间一键循环穿梭（Shift+TAB 反向）：鸣女高台（恋蛇双柱）→ 无惨暗室 → 童磨莲池（忍/伊之助/香奈乎）→ 破晓罗针殿（炭治郎/义勇 vs 猗窝座）→ 雷渊悬桥（善逸 vs 狯岳）→ 残月古殿（岩风霞三柱 vs 黑死牟）</div>
                 <div class="tour-row"><b>WASD 漫游</b>进入名场面后自动开启自由漫游：<b>W / S</b> 前进后退 · <b>A / D</b> 左右平移绕行 · <b>空格 / Shift</b> 上升下降 · 鼠标 360° 环顾 · 松键即悬停，飞出场景边界后自动恢复高速翱翔（任意处按 <b>P</b> 键可手动切换）</div>
                 <div class="tour-row"><b>六自由度翱翔</b>城内飞行时：移动鼠标转向 · <b>W / 空格 / 左键</b> 振翅加速 · <b>S / Shift</b> 减速 · <b>Q / E</b> 横滚倒飞 · <b>C</b> 切换鎹鸦/第一人称视角</div>
                 <div class="tour-row"><b>琵琶与神社</b>按 <b>B</b> 键鸣女拨弦触发空间异变 · <b>ESC</b> 暂停开启神社设定（可直达任意名场面、调节天象与开关人物）· <b>H</b> 隐藏界面截图 · <b>R</b> 重塑新城</div>`
          }
          <button id="tour-go">踏入无限城</button>
        </div>
      </div>
      <div id="settings">
        <div id="pause-card">
          <div class="pause-side">設定</div>
          <div class="pause-body">
            <h3><span>⛩</span> 无限城 · 驻停设定</h3>
            <div class="set-grp">飛行 · 飞行操控</div>
            <div class="set-row"><label>飞行速度</label><input id="s-pace" type="range" min="20" max="180" value="${ini.pace}"/></div>
            <div class="set-row"><label>反转上下视角（Y轴）</label><input id="s-invert" type="checkbox" ${ini.inv ? 'checked' : ''}/></div>
            <div class="set-row"><label>幽灵穿墙模式（无碰撞）</label><input id="s-ghost" type="checkbox" ${ini.ghost ? 'checked' : ''}/></div>
            <div class="set-grp">天候 · 氛围与光影</div>
            <div class="set-row"><label>城内天象</label>
              <select id="s-weather">
                <option value="auto">随无限城自然流转</option>
                <option value="clear">静谧暖空</option>
                <option value="haze">炙暖薄雾</option>
                <option value="mistfall">深渊垂雾</option>
                <option value="emberstorm">烬火风暴</option>
                <option value="ashfall">灰烬飘落</option>
                <option value="spiritmist">碧灵鬼雾</option>
              </select>
            </div>
            <div class="set-row"><label>浓雾浓度</label><input id="s-mist" type="range" min="0" max="200" value="${ini.mist}"/></div>
            <div class="set-row"><label>提灯光照强度</label><input id="s-light" type="range" min="60" max="160" value="${ini.light}"/></div>
            <div class="set-grp">城 · 空间构造</div>
            <div class="set-row"><label>空间异变幅度</label><input id="s-motion" type="range" min="0" max="200" value="${ini.motion}"/></div>
            <div class="set-row"><label>建筑密度（调整后重建）</label><input id="s-density" type="range" min="40" max="160" value="${ini.density}"/></div>
            <div class="set-row"><label>渲染画质</label>
              <select id="s-quality">
                <option value="auto">自动适配</option>
                <option value="0">微烬（省电）</option>
                <option value="1">流畅</option>
                <option value="2">高画质</option>
                <option value="3">极致（含辉光）</option>
              </select>
            </div>
            <div class="set-row"><label>世界种子</label><input id="s-seed" type="text" value="${this.esc(ini.seed)}"/></div>
            <div class="set-row set-btns">
              <button class="set-btn" id="s-apply">重塑此城</button>
              <button class="set-btn" id="s-random">随机种子</button>
              <button class="set-btn" id="s-biwa">琵琶异变</button>
              <button class="set-btn" id="s-tour">飞行指引</button>
            </div>
            <div class="set-grp">名所 · 六大原作名场面直达（TAB 循环切换）</div>
            <div class="set-row"><label>动漫人物名场面展示</label><input id="s-chars" type="checkbox" ${ini.chars ? 'checked' : ''}/></div>
            <div class="set-row set-btns" style="flex-wrap:wrap">
              <button class="set-btn" id="w-nakime">鸣女高台</button>
              <button class="set-btn" id="w-muzan">无惨暗室</button>
              <button class="set-btn" id="w-douma">童磨莲池</button>
              <button class="set-btn" id="w-akaza">破晓罗针殿</button>
              <button class="set-btn" id="w-zenitsu">雷渊悬桥</button>
              <button class="set-btn" id="w-kokushibo">残月古殿</button>
            </div>
            <div class="set-grp">音 · 程序化音景</div>
            <div class="set-row"><label>和风配乐音量</label><input id="s-music" type="range" min="0" max="100" value="${ini.music}"/></div>
            <div class="set-row"><label>琵琶与木构音效</label><input id="s-sfx" type="range" min="0" max="100" value="${ini.sfx}"/></div>
            <div class="set-row"><label>全部静音</label><input id="s-mute" type="checkbox"/></div>
            <div class="pause-actions">
              <button id="p-share">共 复制狩猎战绩</button>
              <button id="p-resume">↩ 继续探索无限城</button>
              <button id="p-quit">鳥居 返回开城门</button>
            </div>
            <a id="p-star" href="https://github.com/Thre4dripper/Infinity-Castle-ThreeJs" target="_blank" rel="noopener">纯 WebGL 程序化建筑 · 原创 Web Audio 合成音景 · MIT 开源致谢</a>
          </div>
        </div>
      </div>
    `;

    this.intro = document.getElementById('intro')!;
    this.hud = document.getElementById('hud')!;
    this.gear = document.getElementById('gear')!;
    this.hint = document.getElementById('hint')!;
    this.flash = document.getElementById('beat-flash')!;
    this.settings = document.getElementById('settings')!;

    this.gear.classList.add('on');
    if (IS_TOUCH) document.getElementById('rotate-hint')!.classList.add('armed');
    (document.getElementById('s-quality') as HTMLSelectElement).value = ini.q;
    (document.getElementById('s-weather') as HTMLSelectElement).value = ini.weather;

    document.getElementById('start-btn')!.addEventListener('click', () => {
      this.pendingMode = 'free';
      this.intro.classList.add('hidden');
      document.getElementById('tour')!.classList.add('open');
    });
    document.getElementById('hunt-btn')!.addEventListener('click', () => {
      this.pendingMode = 'hunt';
      this.intro.classList.add('hidden');
      document.getElementById('tour')!.classList.add('open');
    });
    document.getElementById('daily-btn')!.addEventListener('click', () => {
      this.pendingMode = 'hunt';
      o.onDaily();
      this.intro.classList.add('hidden');
      document.getElementById('tour')!.classList.add('open');
    });
    document.getElementById('p-share')!.addEventListener('click', () => {
      const btn = document.getElementById('p-share')!;
      void navigator.clipboard.writeText(o.onShare()).then(() => {
        btn.textContent = '✓ 已复制战绩';
        window.setTimeout(() => (btn.textContent = '共 复制狩猎战绩'), 1600);
      }).catch(() => { /* clipboard unavailable */ });
    });
    document.getElementById('tour-go')!.addEventListener('click', () => {
      document.getElementById('tour')!.classList.remove('open');
      if (!this.started) this.begin();
    });
    document.getElementById('s-tour')!.addEventListener('click', () => {
      document.getElementById('tour')!.classList.add('open');
    });
    document.getElementById('s-biwa')!.addEventListener('click', () => {
      this.closePause();
      o.onBiwa();
    });
    document.getElementById('w-nakime')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('nakimePlatform');
    });
    document.getElementById('w-muzan')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('muzanChamber');
    });
    document.getElementById('w-douma')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('doumaLotusPond');
    });
    document.getElementById('w-akaza')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('akazaArena');
    });
    document.getElementById('w-zenitsu')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('zenitsuBridge');
    });
    document.getElementById('w-kokushibo')!.addEventListener('click', () => {
      this.closePause();
      o.onWarp('kokushiboHall');
    });

    this.gear.addEventListener('click', () => this.openPause());
    document.getElementById('p-resume')!.addEventListener('click', () => this.closePause());
    document.getElementById('p-quit')!.addEventListener('click', () => o.onQuit());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.settings.classList.contains('open')
        && performance.now() - this.pauseOpenedAt > 400) {
        this.closePause();
      }
    });

    (document.getElementById('s-light') as HTMLInputElement).addEventListener('input', (e) => {
      o.onLight(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-quality') as HTMLSelectElement).addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      o.onQuality(v === 'auto' ? null : Number(v));
    });
    (document.getElementById('s-motion') as HTMLInputElement).addEventListener('input', (e) => {
      o.onMotion(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-pace') as HTMLInputElement).addEventListener('input', (e) => {
      o.onPace(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-weather') as HTMLSelectElement).addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      o.onWeather(v === 'auto' ? null : v);
    });
    (document.getElementById('s-mist') as HTMLInputElement).addEventListener('input', (e) => {
      o.onMist(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-density') as HTMLInputElement).addEventListener('change', (e) => {
      o.onDensity(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-music') as HTMLInputElement).addEventListener('input', (e) => {
      o.onMusicVol(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-sfx') as HTMLInputElement).addEventListener('input', (e) => {
      o.onSfxVol(Number((e.target as HTMLInputElement).value) / 100);
    });
    (document.getElementById('s-invert') as HTMLInputElement).addEventListener('change', (e) => {
      o.onInvertY((e.target as HTMLInputElement).checked);
    });
    (document.getElementById('s-ghost') as HTMLInputElement).addEventListener('change', (e) => {
      o.onGhost((e.target as HTMLInputElement).checked);
    });
    (document.getElementById('s-chars') as HTMLInputElement).addEventListener('change', (e) => {
      o.onChars((e.target as HTMLInputElement).checked);
    });
    (document.getElementById('s-mute') as HTMLInputElement).addEventListener('change', (e) => {
      o.onMute((e.target as HTMLInputElement).checked);
    });
    document.getElementById('s-apply')!.addEventListener('click', () => {
      o.onSeed((document.getElementById('s-seed') as HTMLInputElement).value);
      this.closePause();
    });
    document.getElementById('s-random')!.addEventListener('click', () => {
      const s = String((Math.random() * 0xffffffff) >>> 0);
      (document.getElementById('s-seed') as HTMLInputElement).value = s;
      o.onSeed(s);
      this.closePause();
    });
  }

  private esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  setSeedDisplay(seed: string): void {
    (document.getElementById('s-seed') as HTMLInputElement).value = seed;
  }

  setMuteDisplay(m: boolean): void {
    (document.getElementById('s-mute') as HTMLInputElement).checked = m;
  }

  /** H 键切换纯景摄影模式（隐藏/显示全部 HUD 与设定按钮） */
  toggleHud(): void {
    this.hudHidden = !this.hudHidden;
    this.hud.classList.toggle('photo-hidden', this.hudHidden);
    this.gear.classList.toggle('photo-hidden', this.hudHidden);
  }

  openPause(): void {
    if (this.settings.classList.contains('open')) return;
    this.pauseOpenedAt = performance.now();
    this.settings.classList.add('open');
    this.o.onPause(true);
  }

  closePause(): void {
    if (!this.settings.classList.contains('open')) return;
    this.settings.classList.remove('open');
    this.o.onPause(false);
  }

  setHunt(on: boolean): void {
    document.getElementById('score-row')!.classList.toggle('on', on);
    (document.getElementById('p-share') as HTMLElement).style.display = on ? '' : 'none';
    this.hintPool = on ? [...HUNT_HINTS, ...HINTS] : HINTS;
    this.hintIdx = 0;
  }

  updateScore(score: number, combo: number, comboFrac: number, best: number): void {
    document.getElementById('h-score')!.textContent = Math.floor(score).toLocaleString();
    const c = document.getElementById('h-combo')!;
    c.textContent = combo > 1 ? '×' + combo : '';
    (document.getElementById('combo-bar')!.firstElementChild as HTMLElement).style.width =
      (comboFrac * 100).toFixed(0) + '%';
    document.getElementById('h-best')!.textContent =
      best > 0 ? '最高 ' + best.toLocaleString() : '';
  }

  setCursorFree(_free: boolean): void { /* superseded by the pause menu */ }

  private startHints(): void {
    const show = () => {
      this.hint.textContent = this.hintPool[this.hintIdx % this.hintPool.length];
      this.hintIdx++;
      this.hint.classList.add('show');
      window.setTimeout(() => this.hint.classList.remove('show'), 6000);
    };
    window.setTimeout(show, 2500);
    this.hintTimer = window.setInterval(show, 18000);
  }

  beatFlash(): void {
    this.flash.style.opacity = '1';
    window.setTimeout(() => (this.flash.style.opacity = '0'), 280);
  }

  /** 主动播报地标或区域到达横幅 */
  announcePlace(title: string, subtitle: string): void {
    document.getElementById('h-district')!.textContent = title;
    document.getElementById('h-chapter')!.textContent = subtitle;
    const p = document.getElementById('place')!;
    p.classList.remove('show');
    void p.offsetWidth;
    p.classList.add('show');
  }

  updateHud(d: HudData): void {
    (document.getElementById('h-spd')!).textContent = d.spd.toFixed(0);
    (document.getElementById('h-alt')!).textContent = d.alt.toFixed(0);
    (document.getElementById('h-waves')!).textContent = String(d.waves);
    (document.getElementById('h-fps')!).textContent = d.fps.toFixed(0);
    (document.getElementById('h-rooms')!).textContent = String(d.rooms);
    (document.getElementById('h-draws')!).textContent = String(d.draws);
    (document.getElementById('h-tris')!).textContent = (d.tris / 1000).toFixed(0);
    (document.getElementById('h-tier')!).textContent = d.tier;
    const dEl = document.getElementById('h-district')!;
    if (dEl.textContent !== d.district) {
      dEl.textContent = d.district;
      document.getElementById('h-chapter')!.textContent = d.chapter;
      const p = document.getElementById('place')!;
      p.classList.remove('show');
      void p.offsetWidth;
      p.classList.add('show');
    }
  }
}
