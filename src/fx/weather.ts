import * as THREE from 'three';
import type { DistrictType } from '../world/districts';

// ---------------------------------------------------------------------------
// WEATHER
// Distant architecture is cheap and low-detail by necessity. Rather than push
// the streaming radius (which low-end devices cannot afford), we hide the
// falloff the way shipping games do: layered mist, drifting haze and airborne
// particulate. Weather also makes the castle feel like a place with air in it.
//
// The red-gold core of the palette is preserved in every preset; jade only
// ever appears as an accent.
// ---------------------------------------------------------------------------

export interface WeatherPreset {
  name: string;
  /** multiplies the district's fog density */
  fogMul: number;
  /** near haze colour */
  fog: THREE.Color;
  /** what the deep distance burns toward */
  glow: THREE.Color;
  /** colour of the mist decks */
  mist: THREE.Color;
  /** how opaque the mist decks are */
  mistDensity: number;
  /** airborne particulate */
  moteA: THREE.Color;
  moteB: THREE.Color;
  /** particulate fall speed (negative rises) */
  moteFall: number;
  moteSize: number;
}

const P = (
  name: string, fogMul: number, fog: number, glow: number, mist: number,
  mistDensity: number, moteA: number, moteB: number, moteFall: number, moteSize: number
): WeatherPreset => ({
  name,
  fogMul,
  fog: new THREE.Color(fog),
  glow: new THREE.Color(glow),
  mist: new THREE.Color(mist),
  mistDensity,
  moteA: new THREE.Color(moteA),
  moteB: new THREE.Color(moteB),
  moteFall,
  moteSize,
});

export const WEATHER: Record<string, WeatherPreset> = {
  // 默认：暖干空气——无限城如熔炉般泛着琥珀金光，视野深远
  clear: P('静谧暖空', 0.72, 0x4a2a16, 0xe0a355, 0x7a5030, 0.22, 0xffb070, 0x8a90c8, 0.35, 0.9),
  // 炙暖薄雾——远景隐没于暖金氤氲之中
  haze: P('炙暖薄雾', 1.5, 0x5a3418, 0xe8ac5c, 0x8a5b30, 1.15, 0xffa860, 0xd08040, 0.2, 1.45),
  // 深渊垂雾——沉重雾气在深井中积聚
  mistfall: P('深渊垂雾', 1.65, 0x3e3020, 0xcf9a60, 0x97877a, 1.75, 0xd8cbb8, 0x9aa4b8, 0.65, 1.6),
  // 烬火风暴——炽热火星自提灯之海向上翻涌
  emberstorm: P('烬火风暴', 1.1, 0x552a12, 0xf5ae4a, 0x8a4c26, 0.5, 0xff8a2e, 0xffd08a, -1.6, 1.5),
  // 灰烬飘落——细密冷灰穿行于深井楼阁之间
  ashfall: P('灰烬飘落', 1.45, 0x453325, 0xd49a5e, 0x7d6d60, 1.35, 0xbdb3a4, 0x8d8478, 1.1, 1.45),
  // 碧灵鬼雾——幽冥翠绿雾气弥漫古寺回廊
  spiritmist: P('碧灵鬼雾', 1.5, 0x2f4034, 0xd8a862, 0x4f9a6a, 1.6, 0x8fe0b0, 0xffc888, 0.12, 1.5),
};

/** Which weather belongs to which district, before the global cycle mixes in. */
const BY_DISTRICT: Record<DistrictType, string[]> = {
  residential: ['clear', 'haze', 'emberstorm'],
  labyrinth: ['haze', 'haze', 'emberstorm'],
  canyon: ['clear', 'haze', 'ashfall'],
  shaft: ['ashfall', 'mistfall', 'haze'],
  bridgeweb: ['clear', 'mistfall', 'ashfall'],
  temple: ['spiritmist', 'mistfall', 'clear'],
  rotating: ['haze', 'ashfall', 'clear'],
  void: ['mistfall', 'mistfall', 'clear'],
  lanternOcean: ['emberstorm', 'emberstorm', 'haze'],
  hangingGarden: ['spiritmist', 'spiritmist', 'mistfall'],
  cathedralVoid: ['mistfall', 'spiritmist', 'clear'],
};

/**
 * Blends slowly between presets. Weather is driven by where you are plus a
 * slow global cycle, so the same district can feel different on a later visit.
 */
export class Weather {
  /** live, interpolated values — read these each frame */
  readonly fog = new THREE.Color();
  readonly glow = new THREE.Color();
  readonly mist = new THREE.Color();
  readonly moteA = new THREE.Color();
  readonly moteB = new THREE.Color();
  fogMul = 1;
  mistDensity = 0.4;
  moteFall = 0.35;
  moteSize = 1;
  key = 'clear';
  label = '静谧暖空';
  /** user override from settings — null lets the castle choose */
  override: string | null = null;

  private target: WeatherPreset = WEATHER.clear;
  private cycle = 0;

  constructor() {
    this.snapTo('clear', WEATHER.clear);
  }

  private snapTo(key: string, p: WeatherPreset): void {
    this.fog.copy(p.fog);
    this.glow.copy(p.glow);
    this.mist.copy(p.mist);
    this.moteA.copy(p.moteA);
    this.moteB.copy(p.moteB);
    this.fogMul = p.fogMul;
    this.mistDensity = p.mistDensity;
    this.moteFall = p.moteFall;
    this.moteSize = p.moteSize;
    this.key = key;
    this.label = p.name;
    this.target = p;
  }

  update(dt: number, t: number, district: DistrictType, chapterHash: number): void {
    // the global cycle drifts every ~90s so weather is never static
    this.cycle = Math.floor(t / 90) + chapterHash;
    const pool = BY_DISTRICT[district] ?? ['clear'];
    const pick = this.override ?? pool[Math.abs(this.cycle) % pool.length];
    const next = WEATHER[pick] ?? WEATHER.clear;
    if (next !== this.target) {
      this.target = next;
      this.key = WEATHER[pick] ? pick : 'clear';
      this.label = next.name;
    }

    // slow crossfade in ambient mode — but when the USER picks a weather it
    // must land fast enough to feel like their hand on the sky
    const k = 1 - Math.exp(-dt * (this.override ? 1.1 : 0.22));
    this.fog.lerp(this.target.fog, k);
    this.glow.lerp(this.target.glow, k);
    this.mist.lerp(this.target.mist, k);
    this.moteA.lerp(this.target.moteA, k);
    this.moteB.lerp(this.target.moteB, k);
    this.fogMul += (this.target.fogMul - this.fogMul) * k;
    this.mistDensity += (this.target.mistDensity - this.mistDensity) * k;
    this.moteFall += (this.target.moteFall - this.moteFall) * k;
    this.moteSize += (this.target.moteSize - this.moteSize) * k;
  }
}
