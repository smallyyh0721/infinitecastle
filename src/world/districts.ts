import { hash3, rand3, mulberry32, valueNoise3 } from '../core/rng';

// ---------------------------------------------------------------------------
// SPATIAL HIERARCHY
//   World  →  Chapter (288m)  →  District (72m)  →  Cell (12m)  →  Props
// Space is generated top-down: the Director lays out an emotional sequence of
// chapters, chapters deal out districts, districts carve their own negative
// space, and only then is architecture poured into what is left.
// ---------------------------------------------------------------------------

export const CELL = 12;
export const DCELLS = 6;
export const DSIZE = CELL * DCELLS; // 72 m district
export const CHAP_D = 4;

export type DistrictType =
  | 'residential'
  | 'labyrinth'
  | 'canyon'
  | 'shaft'
  | 'bridgeweb'
  | 'temple'
  | 'rotating'
  | 'void'
  | 'lanternOcean'
  | 'hangingGarden'
  | 'cathedralVoid';

export type LandmarkType =
  | 'none'
  | 'greatPillar'
  | 'invertedPagoda'
  | 'colossalTorii'
  | 'endlessStair'
  | 'suspendedShrine'
  | 'lanternChamber'
  | 'nakimePlatform'
  | 'muzanChamber'
  | 'doumaLotusPond'
  | 'akazaArena'
  | 'zenitsuBridge'
  | 'kokushiboHall';

export type IconicLandmark =
  | 'nakimePlatform'
  | 'muzanChamber'
  | 'doumaLotusPond'
  | 'akazaArena'
  | 'zenitsuBridge'
  | 'kokushiboHall';

export const ICONIC_ORDER: IconicLandmark[] = [
  'nakimePlatform',
  'muzanChamber',
  'doumaLotusPond',
  'akazaArena',
  'zenitsuBridge',
  'kokushiboHall',
];

export const LANDMARK_INFO: Record<Exclude<LandmarkType, 'none'>, { name: string; sub: string }> = {
  greatPillar: { name: '通天朱柱', sub: '贯通上下深渊的巨型朱漆支柱' },
  invertedPagoda: { name: '倒悬五重塔', sub: '逆重垂落于虚空中的古塔' },
  colossalTorii: { name: '巨构鸟居', sub: '横跨无尽街区的朱红神门' },
  endlessStair: { name: '无尽回旋梯', sub: '盘旋没入迷雾的螺旋木阶' },
  suspendedShrine: { name: '锁链悬社', sub: '巨链悬吊于深渊之上的古社' },
  lanternChamber: { name: '万灯大殿', sub: '数百提灯摇曳的宏阔殿堂' },
  nakimePlatform: { name: '鸣女高台', sub: '上弦之肆 · 恋柱与蛇柱突袭琵琶中枢' },
  muzanChamber: { name: '无惨暗室', sub: '鬼王居所 · 苍色彼岸花炼金秘室' },
  doumaLotusPond: { name: '童磨莲池', sub: '上弦之贰 · 蝴蝶忍/伊之助/香奈乎冰莲对峙' },
  akazaArena: { name: '破晓罗针殿', sub: '上弦之叁 · 炭治郎与义勇激战猗窝座' },
  zenitsuBridge: { name: '雷渊悬桥', sub: '新上弦之陆 · 善逸火雷神决战狯岳' },
  kokushiboHall: { name: '残月古殿', sub: '上弦之壹 · 岩风霞三柱围攻黑死牟' },
};

export interface DistrictDef {
  type: DistrictType;
  label: string;
  /** base chance a cell inside this district holds architecture */
  fill: number;
  /** chance a shared face is open (flyable) */
  openness: number;
  /** chance a room breaks the district's orientation (impossible geometry) */
  flip: number;
  /** multiplies fog density — dense districts feel closer */
  fogMul: number;
  /** how the whole district moves as one rigid body */
  motion: 'none' | 'rotate' | 'drift' | 'breathe';
  /** archetype pool (names must exist in archetypes.ts) */
  pool: string[];
  /** landmark table — 'none' entries make landmarks rarer */
  landmarks: LandmarkType[];
}

export const DISTRICTS: Record<DistrictType, DistrictDef> = {
  residential: {
    type: 'residential', label: '沉睡町屋', fill: 0.76, openness: 0.52, flip: 0.14,
    fogMul: 1.0, motion: 'none',
    pool: ['tatami-hall', 'plank-hall', 'balcony-ring', 'stair-shaft', 'corridor', 'pillar-forest'],
    landmarks: ['none', 'akazaArena', 'lanternChamber'],
  },
  labyrinth: {
    type: 'labyrinth', label: '提灯迷宫', fill: 0.94, openness: 0.44, flip: 0.28,
    fogMul: 1.45, motion: 'none',
    pool: ['cell-room', 'cell-room', 'corridor', 'tatami-hall'],
    landmarks: ['none', 'muzanChamber', 'akazaArena'],
  },
  canyon: {
    type: 'canyon', label: '长廊峡谷', fill: 0.86, openness: 0.48, flip: 0.1,
    fogMul: 0.85, motion: 'none',
    pool: ['plank-hall', 'corridor', 'balcony-ring', 'tatami-hall', 'cell-room'],
    landmarks: ['none', 'akazaArena', 'muzanChamber', 'colossalTorii'],
  },
  shaft: {
    type: 'shaft', label: '无底深井', fill: 0.88, openness: 0.52, flip: 0.16,
    fogMul: 0.8, motion: 'drift',
    pool: ['balcony-ring', 'stair-shaft', 'plank-hall', 'corridor', 'suspended'],
    landmarks: ['zenitsuBridge', 'nakimePlatform', 'greatPillar'],
  },
  bridgeweb: {
    type: 'bridgeweb', label: '悬桥织网', fill: 0.13, openness: 0.85, flip: 0.2,
    fogMul: 0.75, motion: 'drift',
    pool: ['bridge', 'void-lattice', 'gate', 'suspended'],
    landmarks: ['zenitsuBridge', 'zenitsuBridge', 'nakimePlatform', 'colossalTorii'],
  },
  temple: {
    type: 'temple', label: '悬空古寺', fill: 0.5, openness: 0.8, flip: 0.05,
    fogMul: 0.7, motion: 'breathe',
    pool: ['cathedral-bay', 'pavilion-isle', 'gate', 'bridge'],
    landmarks: ['kokushiboHall', 'kokushiboHall', 'doumaLotusPond'],
  },
  rotating: {
    type: 'rotating', label: '回转殿宇', fill: 0.56, openness: 0.62, flip: 0.4,
    fogMul: 0.8, motion: 'rotate',
    pool: ['tatami-hall', 'balcony-ring', 'void-lattice', 'bridge', 'pillar-forest'],
    landmarks: ['nakimePlatform', 'akazaArena', 'invertedPagoda'],
  },
  void: {
    type: 'void', label: '虚空之渊', fill: 0.05, openness: 0.95, flip: 0.5,
    fogMul: 0.62, motion: 'drift',
    pool: ['suspended', 'bridge', 'void-lattice'],
    landmarks: ['muzanChamber', 'zenitsuBridge', 'kokushiboHall', 'nakimePlatform'],
  },
  lanternOcean: {
    type: 'lanternOcean', label: '提灯之海', fill: 0.34, openness: 0.88, flip: 0.18,
    fogMul: 1.7, motion: 'drift',
    pool: ['lantern-cloud', 'lantern-cloud', 'suspended', 'balcony-ring', 'bridge'],
    landmarks: ['doumaLotusPond', 'lanternChamber', 'kokushiboHall'],
  },
  hangingGarden: {
    type: 'hangingGarden', label: '空中庭院', fill: 0.3, openness: 0.9, flip: 0.04,
    fogMul: 0.55, motion: 'breathe',
    pool: ['garden', 'garden', 'pavilion-isle', 'bridge'],
    landmarks: ['doumaLotusPond', 'doumaLotusPond', 'kokushiboHall'],
  },
  cathedralVoid: {
    type: 'cathedralVoid', label: '大殿虚空', fill: 0.03, openness: 0.97, flip: 0.3,
    fogMul: 0.55, motion: 'drift',
    pool: ['bridge', 'suspended', 'void-lattice'],
    landmarks: ['kokushiboHall', 'nakimePlatform', 'muzanChamber', 'zenitsuBridge'],
  },
};

// ---------------------------------------------------------------------------
// THE DIRECTOR
// Chapters are authored sequences, not noise. Each chapter deals its districts
// out along a fixed pattern so the player experiences deliberate rhythm:
// compression → release → awe → descent. Depth biases which chapters appear,
// so flying down really does mean descending into darkness.
// ---------------------------------------------------------------------------

interface ChapterDef {
  name: string;
  /** dealt out by position-derived index → runs and repeats, never confetti */
  seq: DistrictType[];
  density: number;
  /** preferred depth: -1 deep, 0 middle, +1 high */
  depth: number;
  weight: number;
}

const CHAPTERS: ChapterDef[] = [
  {
    name: '幽寂町域', depth: 0.2, weight: 12, density: 1.0,
    seq: ['residential', 'residential', 'canyon', 'lanternOcean', 'residential', 'labyrinth', 'canyon', 'cathedralVoid'],
  },
  {
    name: '无尽坠落', depth: -0.7, weight: 11, density: 0.95,
    seq: ['shaft', 'shaft', 'cathedralVoid', 'bridgeweb', 'shaft', 'void', 'shaft', 'labyrinth'],
  },
  {
    name: '错综迷廊', depth: -0.2, weight: 10, density: 1.05,
    seq: ['labyrinth', 'labyrinth', 'canyon', 'lanternOcean', 'void', 'labyrinth', 'residential', 'canyon'],
  },
  {
    name: '悬寺云阁', depth: 0.5, weight: 9, density: 0.85,
    seq: ['temple', 'hangingGarden', 'temple', 'bridgeweb', 'temple', 'cathedralVoid', 'lanternOcean', 'bridgeweb'],
  },
  {
    name: '千桥织网', depth: 0.1, weight: 9, density: 0.85,
    seq: ['bridgeweb', 'bridgeweb', 'cathedralVoid', 'bridgeweb', 'canyon', 'bridgeweb', 'hangingGarden', 'lanternOcean'],
  },
  {
    name: '回转奇殿', depth: -0.3, weight: 8, density: 0.9,
    seq: ['rotating', 'residential', 'rotating', 'void', 'rotating', 'canyon', 'rotating', 'lanternOcean'],
  },
  {
    name: '深渊长峡', depth: 0.0, weight: 9, density: 1.0,
    seq: ['canyon', 'canyon', 'residential', 'canyon', 'shaft', 'canyon', 'cathedralVoid', 'lanternOcean'],
  },
  {
    name: '无底冥渊', depth: -1.0, weight: 8, density: 0.6,
    seq: ['cathedralVoid', 'shaft', 'void', 'cathedralVoid', 'bridgeweb', 'void', 'shaft', 'lanternOcean'],
  },
  {
    name: '空中秘庭', depth: 0.7, weight: 6, density: 0.8,
    seq: ['hangingGarden', 'temple', 'hangingGarden', 'lanternOcean', 'hangingGarden', 'bridgeweb', 'residential', 'cathedralVoid'],
  },
];

const CHAP_SALT = 0x3a91c7;
const DIST_SALT = 0x7b2e05;
const OCC_SALT = 0x11ac4f;
const FACE_SALT = 0x515c3;
const LAND_SALT = 0x62d9a1;

// NOTE: districts are NOT rigidly rotated. That was tried and reverted: the
// streamer decides what to build/evict in grid space, so any district-level
// rotation makes cells render away from their grid position — the streamer
// then evicts geometry that is visibly in front of the player. "Impossible"
// orientation comes from per-CELL flips (district.def.flip), which are baked
// into vertices and therefore invisible to streaming and collision.

function chapterAt(chx: number, chy: number, chz: number, seed: number): ChapterDef {
  // depth bias: each chapter is 288 m tall. Going down favours dark chapters.
  const depthBias = Math.max(-1, Math.min(1, -chy * 0.45));
  let total = 0;
  const w: number[] = [];
  for (const c of CHAPTERS) {
    const affinity = 1.3 - Math.abs(c.depth - depthBias) * 0.9;
    const ww = Math.max(0.05, c.weight * affinity);
    w.push(ww);
    total += ww;
  }
  let r = (hash3(chx, chy, chz, seed ^ CHAP_SALT) / 4294967296) * total;
  for (let i = 0; i < CHAPTERS.length; i++) {
    r -= w[i];
    if (r <= 0) return CHAPTERS[i];
  }
  return CHAPTERS[0];
}

export interface District {
  dx: number;
  dy: number;
  dz: number;
  key: string;
  def: DistrictDef;
  chapter: string;
  density: number;
  landmark: LandmarkType;
  /** world-space centre */
  cx: number;
  cy: number;
  cz: number;
  spinAxis: 0 | 1 | 2;
  spinRate: number;
  driftAmp: number;
  driftFreq: number;
  phase: number;
  /** quarter-turn yaw shared by the whole district (keeps the mass coherent) */
  quarter: number;
  seed: number;
}

const districtCache = new Map<string, District>();
let cacheSeed = NaN;

export function districtKey(dx: number, dy: number, dz: number): string {
  return dx + '|' + dy + '|' + dz;
}

export function districtAtCoords(dx: number, dy: number, dz: number, seed: number): District {
  if (seed !== cacheSeed) {
    districtCache.clear();
    cacheSeed = seed;
  }
  const key = districtKey(dx, dy, dz);
  const hit = districtCache.get(key);
  if (hit) return hit;

  const chx = Math.floor(dx / CHAP_D);
  const chy = Math.floor(dy / CHAP_D);
  const chz = Math.floor(dz / CHAP_D);
  const chap = chapterAt(chx, chy, chz, seed);

  // deal the chapter's sequence out over its districts — ordered, not random
  const lx = ((dx % CHAP_D) + CHAP_D) % CHAP_D;
  const ly = ((dy % CHAP_D) + CHAP_D) % CHAP_D;
  const lz = ((dz % CHAP_D) + CHAP_D) % CHAP_D;
  const idx = (lx + ly * 2 + lz * 3 + (hash3(chx, chy, chz, seed ^ 0x99) & 3)) % chap.seq.length;
  const def = DISTRICTS[chap.seq[idx]];

  const h = hash3(dx, dy, dz, seed ^ DIST_SALT);
  const rng = mulberry32(h | 0);
  const landmark = def.landmarks[Math.floor(rng() * def.landmarks.length)];

  const d: District = {
    dx, dy, dz, key, def,
    chapter: chap.name,
    density: chap.density,
    landmark,
    cx: (dx + 0.5) * DSIZE,
    cy: (dy + 0.5) * DSIZE,
    cz: (dz + 0.5) * DSIZE,
    spinAxis: (h % 3) as 0 | 1 | 2,
    spinRate: def.motion === 'rotate' ? (rng() < 0.5 ? -1 : 1) * (0.0015 + rng() * 0.004) : 0,
    driftAmp: def.motion === 'drift' ? 1.4 + rng() * 3.2 : def.motion === 'breathe' ? 0.9 + rng() * 1.6 : 0,
    driftFreq: 0.008 + rng() * 0.014,
    phase: rng() * Math.PI * 2,
    quarter: h % 4,
    seed: h,
  };
  districtCache.set(key, d);
  if (districtCache.size > 4096) districtCache.clear();
  return d;
}

export function districtAtCell(cx: number, cy: number, cz: number, seed: number): District {
  return districtAtCoords(
    Math.floor(cx / DCELLS),
    Math.floor(cy / DCELLS),
    Math.floor(cz / DCELLS),
    seed
  );
}

// ---------------------------------------------------------------------------
// NEGATIVE SPACE — each district carves its own voids first. This is what
// turns a cloud of cubes into streets, shafts, canyons and cathedrals.
// ---------------------------------------------------------------------------

function localCell(c: number): number {
  return ((c % DCELLS) + DCELLS) % DCELLS;
}

/**
 * FLIGHT DESIGN — carve aerial highways and atriums through dense districts
 * before anything is built. These are the sweeping paths a crow can glide
 * along without fighting collision, and they turn a solid block into
 * multi-level streets with roofs lining them.
 */
function flightVoid(d: District, lx: number, ly: number, lz: number): boolean {
  const t = d.def.type;
  if (t === 'void' || t === 'bridgeweb' || t === 'cathedralVoid' || t === 'temple') return false;
  const s = d.seed;

  // two crossing highways at different levels → multi-level streets.
  // Kept to ONE cell wide: carving more than this guts the density.
  const alongZ = (s & 1) === 0;
  const hy1 = 1 + ((s >>> 1) % 4);
  const row1 = 1 + ((s >>> 3) % 4);
  if (ly === hy1 && (alongZ ? lz === row1 : lx === row1)) return true;

  const hy2 = 1 + ((s >>> 5) % 4);
  const row2 = 1 + ((s >>> 7) % 4);
  if (ly === hy2 && (alongZ ? lx === row2 : lz === row2)) return true;

  // a vertical light-well joining the two levels
  if (lx === row1 && lz === row2) return true;

  // an atrium: a round hollow carved out of the densest districts
  if (t === 'residential' || t === 'labyrinth' || t === 'canyon') {
    const ax = 1.5 + ((s >>> 9) % 3);
    const ay = 1.5 + ((s >>> 13) % 3);
    const az = 1.5 + ((s >>> 11) % 3);
    if (Math.hypot(lx - ax, ly - ay, lz - az) < 1.7) return true;
  }
  return false;
}

/** Structural mask: does the district's *shape* allow architecture here? */
function shapeAllows(d: District, lx: number, ly: number, lz: number): boolean {
  if (flightVoid(d, lx, ly, lz)) return false;
  switch (d.def.type) {
    case 'shaft': {
      // hollow tower: thick walls, gaping vertical core
      const r = Math.hypot(lx - (DCELLS - 1) / 2, lz - (DCELLS - 1) / 2);
      return r > 1.7;
    }
    case 'canyon': {
      // a street cut clean through the mass, oriented per district
      const axis = d.seed % 2 === 0 ? lz : lx;
      return axis !== 2 && axis !== 3;
    }
    case 'residential': {
      // carve a horizontal service corridor and a vertical light well
      if (ly === 2 && (d.seed & 3) === 0) return false;
      if (lx === 4 && lz === 1) return false;
      return true;
    }
    case 'temple':
      // huge hollow nave: only the shell builds, the interior is one volume
      return lx === 0 || lx === DCELLS - 1 || lz === 0 || lz === DCELLS - 1 || ly === 0 || ly === DCELLS - 1;
    case 'labyrinth':
    case 'bridgeweb':
    case 'void':
    case 'rotating':
    case 'lanternOcean':
    case 'hangingGarden':
    case 'cathedralVoid':
    default:
      return true;
  }
}

/** Final per-cell occupancy: shape mask × district fill × chapter density. */
export function isOccupiedScatter(cx: number, cy: number, cz: number, seed: number): boolean {
  const d = districtAtCell(cx, cy, cz, seed);
  if (!shapeAllows(d, localCell(cx), localCell(cy), localCell(cz))) return false;
  const p = Math.min(0.97, d.def.fill * d.density * densityScale);
  return rand3(cx, cy, cz, seed ^ OCC_SALT) < p;
}

// ---------------------------------------------------------------------------
// BUILDING PLOTS
// Dense districts are not filled cell-by-cell — that erodes buildings into
// half-finished rubble. Instead the ground is divided into plots, each plot
// decides ONCE whether it is built, how tall it stands and in what style, and
// then every cell in that column belongs to a single complete building.
// ---------------------------------------------------------------------------

export type BuildingStyle =
  | 'machiya'    // narrow latticed townhouse
  | 'minka'      // steep-thatched farmhouse
  | 'kura'       // white plaster storehouse
  | 'yashiki'    // sprawling samurai mansion
  | 'yagura'     // tapering watchtower
  | 'chashitsu'  // small teahouse
  | 'tenshu';    // tiered castle keep

const STYLE_TABLE: Record<DistrictType, BuildingStyle[]> = {
  residential: ['machiya', 'machiya', 'minka', 'yashiki', 'kura', 'chashitsu'],
  labyrinth: ['machiya', 'machiya', 'kura', 'kura', 'minka'],
  canyon: ['machiya', 'yagura', 'kura', 'yashiki', 'tenshu'],
  shaft: ['yagura', 'yagura', 'kura', 'machiya', 'tenshu'],
  rotating: ['yashiki', 'machiya', 'minka', 'yagura'],
  temple: ['tenshu', 'yashiki', 'chashitsu'],
  bridgeweb: ['yagura', 'kura'],
  void: ['chashitsu', 'yagura'],
  lanternOcean: ['machiya', 'chashitsu'],
  hangingGarden: ['chashitsu', 'minka', 'yashiki'],
  cathedralVoid: ['tenshu', 'yagura'],
};

export interface Plot {
  built: boolean;
  /** world cell Y where the building starts, and its height in cells */
  y0: number;
  h: number;
  style: BuildingStyle;
  /** plot anchor + footprint, in cells */
  ax: number;
  az: number;
  w: number;
  d: number;
}

const PLOT_SALT = 0x2b7f11;
const plotCache = new Map<string, Plot>();
let plotSeed = NaN;

/** User dial from settings: scales building density everywhere (0.4–1.6). */
let densityScale = 1;
export function setDensityScale(v: number): void {
  densityScale = Math.max(0.35, Math.min(1.65, v));
  plotCache.clear();
  plotSeed = NaN; // force cache rebuild even for the same seed
}

const UNBUILT: Plot = { built: false, y0: 0, h: 0, style: 'machiya', ax: 0, az: 0, w: 0, d: 0 };

/**
 * Which building owns this column, and what does it look like?
 * Plots are 2 cells (24 m) square, and one in four merges into a 4-cell (48 m)
 * mansion block, so footprints vary without ever leaving a building partial.
 */
export function plotAt(cx: number, cz: number, dyDistrict: number, seed: number): Plot {
  if (seed !== plotSeed) {
    plotCache.clear();
    plotSeed = seed;
  }
  const px = Math.floor(cx / 2);
  const pz = Math.floor(cz / 2);
  const bx = Math.floor(px / 2);
  const bz = Math.floor(pz / 2);

  // one block in four is a single large mansion instead of four townhouses
  const big = rand3(bx, dyDistrict, bz, seed ^ 0x51b3) < 0.26;
  const ax = big ? bx * 4 : px * 2;
  const az = big ? bz * 4 : pz * 2;
  const w = big ? 4 : 2;

  const key = ax + '_' + az + '_' + dyDistrict;
  const hit = plotCache.get(key);
  if (hit) return hit;

  const d = districtAtCell(ax, dyDistrict * DCELLS + 1, az, seed);
  const t = d.def.type;

  // the plot must clear the district's carved voids across its whole footprint
  let blocked = false;
  for (let ix = 0; ix < w && !blocked; ix++) {
    for (let iz = 0; iz < w && !blocked; iz++) {
      const lx = localCell(ax + ix);
      const lz = localCell(az + iz);
      if (!shapeAllowsColumn(d, lx, lz)) blocked = true;
    }
  }

  // density varies in drifting neighbourhoods rather than per-cell static
  const cluster = valueNoise3(ax * 0.09, dyDistrict * 0.5, az * 0.09, seed ^ 0x77aa);
  const chance = Math.min(0.99, d.def.fill * d.density * densityScale * (0.8 + cluster * 0.8));
  const roll = rand3(ax, dyDistrict, az, seed ^ PLOT_SALT);
  const built = !blocked && roll < chance;

  let plot: Plot = UNBUILT;
  if (built) {
    // buildings occupy a clear band shared by EVERY column of the footprint,
    // so streets stay open and no building is ever sliced by a corridor
    const band = freeBand(d, ax, az, w, dyDistrict, seed);
    if (band) {
      const styles = STYLE_TABLE[t];
      const sIdx = hash3(ax, dyDistrict, az, seed ^ 0x9c17) % styles.length;
      let style = styles[sIdx];
      // tall styles only for tall bands, squat styles only for short ones
      if (band.h >= 3 && (style === 'chashitsu')) style = 'yagura';
      if (band.h <= 1 && (style === 'tenshu' || style === 'yagura')) style = 'machiya';
      plot = { built: true, y0: band.y0, h: band.h, style, ax, az, w, d: w };
    }
  }
  plotCache.set(key, plot);
  if (plotCache.size > 8192) plotCache.clear();
  return plot;
}

/** Does the district shape allow a building anywhere in this column? */
function shapeAllowsColumn(d: District, lx: number, lz: number): boolean {
  for (let ly = 0; ly < DCELLS; ly++) {
    if (shapeAllows(d, lx, ly, lz)) return true;
  }
  return false;
}

/** The tallest run of cells clear in EVERY column of the plot's footprint. */
function freeBand(
  d: District, ax: number, az: number, w: number, dyDistrict: number, seed: number
): { y0: number; h: number } | null {
  const runs: { start: number; len: number }[] = [];
  let start = -1;
  for (let ly = 0; ly < DCELLS; ly++) {
    let ok = true;
    for (let ix = 0; ix < w && ok; ix++) {
      for (let iz = 0; iz < w && ok; iz++) {
        if (!shapeAllows(d, localCell(ax + ix), ly, localCell(az + iz))) ok = false;
      }
    }
    if (ok && start < 0) start = ly;
    if ((!ok || ly === DCELLS - 1) && start >= 0) {
      const end = ok ? ly : ly - 1;
      runs.push({ start, len: end - start + 1 });
      start = -1;
    }
  }
  if (runs.length === 0) return null;
  const pick = runs[hash3(ax, dyDistrict, az, seed ^ 0x3311) % runs.length];
  // most buildings fill their band; some are shorter, leaving skyline variety
  const r = rand3(ax, dyDistrict + 7, az, seed ^ 0x6f2a);
  const h = r < 0.55 ? pick.len : Math.max(1, Math.round(pick.len * (0.4 + r * 0.5)));
  const base = dyDistrict * DCELLS + pick.start;
  return { y0: base, h };
}

/** Coherent occupancy: a cell is built iff its building says so. */
export function isOccupied(cx: number, cy: number, cz: number, seed: number): boolean {
  const d = districtAtCell(cx, cy, cz, seed);
  // 六大原作特色名场面在街区中央保留 4×4×4 宏阔中庭，避免普通房间穿模遮挡
  const lm = landmarkOf(d);
  if (
    lm === 'nakimePlatform' || lm === 'muzanChamber' || lm === 'doumaLotusPond' ||
    lm === 'akazaArena' || lm === 'zenitsuBridge' || lm === 'kokushiboHall'
  ) {
    const lx = localCell(cx);
    const ly = localCell(cy);
    const lz = localCell(cz);
    if (lx >= 1 && lx <= 4 && ly >= 1 && ly <= 4 && lz >= 1 && lz <= 4) {
      return false;
    }
  }
  const t = d.def.type;
  // sparse / sculptural districts keep the scattered look on purpose
  if (t === 'bridgeweb' || t === 'void' || t === 'cathedralVoid' ||
      t === 'lanternOcean' || t === 'hangingGarden' || t === 'temple') {
    return isOccupiedScatter(cx, cy, cz, seed);
  }
  const plot = plotAt(cx, cz, Math.floor(cy / DCELLS), seed);
  if (!plot.built) return false;
  return cy >= plot.y0 && cy < plot.y0 + plot.h;
}

/** The style of the building this cell belongs to (for archetype selection). */
export function styleAt(cx: number, cy: number, cz: number, seed: number): BuildingStyle | null {
  const plot = plotAt(cx, cz, Math.floor(cy / DCELLS), seed);
  return plot.built ? plot.style : null;
}

/**
 * Is this cell the top of a building column? Those get a proper hipped roof,
 * which is what turns a stack of cells into a COMPLETE BUILDING rather than a
 * cut-off box.
 */
export function isRoofCell(cx: number, cy: number, cz: number, seed: number): boolean {
  if (!isOccupied(cx, cy, cz, seed)) return false;
  if (isOccupied(cx, cy + 1, cz, seed)) return false;
  const t = districtAtCell(cx, cy, cz, seed).def.type;
  return t !== 'bridgeweb' && t !== 'void' && t !== 'cathedralVoid' && t !== 'lanternOcean';
}

/** Is this cell the bottom of a column? Gets an underbelly of supports. */
export function isBaseCell(cx: number, cy: number, cz: number, seed: number): boolean {
  if (!isOccupied(cx, cy, cz, seed)) return false;
  return !isOccupied(cx, cy - 1, cz, seed);
}

/** Shared-face openness. The lower cell owns the face, so both sides agree. */
export function faceOpen(cx: number, cy: number, cz: number, face: number, seed: number): boolean {
  const axis = face >> 1;
  const positive = (face & 1) === 0;
  let ox = cx, oy = cy, oz = cz;
  if (!positive) {
    if (axis === 0) ox -= 1;
    else if (axis === 1) oy -= 1;
    else oz -= 1;
  }
  const d = districtAtCell(ox, oy, oz, seed);
  return rand3(ox, oy, oz, seed ^ (FACE_SALT + axis * 0x9101)) < d.def.openness;
}

/**
 * Connector across the face between this cell and its +axis neighbour.
 * 0 = none, 1 = enclosed corridor, 2 = open bridge.
 * Owned by the lower cell so it is built exactly once, and it always spans the
 * FULL gap — so it runs off into unloaded space instead of stopping mid-air.
 */
export function connectorAt(cx: number, cy: number, cz: number, axis: 0 | 1 | 2, seed: number): 0 | 1 | 2 {
  const here = isOccupied(cx, cy, cz, seed);
  const there = isOccupied(
    cx + (axis === 0 ? 1 : 0),
    cy + (axis === 1 ? 1 : 0),
    cz + (axis === 2 ? 1 : 0),
    seed
  );
  const d = districtAtCell(cx, cy, cz, seed);
  const r = rand3(cx * 3 + axis, cy * 5 - axis, cz * 7 + axis, seed ^ 0x51ce);
  const t = d.def.type;

  if (here && there) {
    // both solid: thread a corridor between them
    return r < (t === 'labyrinth' ? 0.5 : t === 'residential' || t === 'canyon' ? 0.38 : 0.26) ? 1 : 0;
  }
  if (here !== there) {
    // solid meets void: throw a bridge out into the emptiness
    const p = t === 'bridgeweb' ? 0.72 : t === 'void' ? 0.38 : t === 'shaft' ? 0.4 : 0.24;
    return r < p ? 2 : 0;
  }
  // pure void: long spans crossing the emptiness
  if (t === 'bridgeweb') return r < 0.4 ? 2 : 0;
  if (t === 'void' || t === 'temple') return r < 0.12 ? 2 : 0;
  return 0;
}

/** One landmark per district at most, and only when the hash agrees. */
export function landmarkOf(d: District): LandmarkType {
  if (d.landmark === 'none') return 'none';
  return (hash3(d.dx, d.dy, d.dz, d.seed ^ LAND_SALT) & 255) < 168 ? d.landmark : 'none';
}

/**
 * 确定性搜索距离指定世界坐标最近的特色地标所在街区。
 * 用于「名场面地标直达」传送功能（鸣女高台 / 无惨暗室 / 童磨莲池）。
 */
export function findNearestLandmark(
  type: Exclude<LandmarkType, 'none'>,
  fromX: number,
  fromY: number,
  fromZ: number,
  seed: number,
  maxRadius = 10
): District | null {
  const d0x = Math.floor(fromX / DSIZE);
  const d0y = Math.floor(fromY / DSIZE);
  const d0z = Math.floor(fromZ / DSIZE);

  let best: District | null = null;
  let bestDistSq = Infinity;

  for (let r = 0; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
          const d = districtAtCoords(d0x + dx, d0y + dy, d0z + dz, seed);
          if (landmarkOf(d) !== type) continue;
          const distSq = (d.cx - fromX) ** 2 + (d.cy - fromY) ** 2 + (d.cz - fromZ) ** 2;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = d;
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}
