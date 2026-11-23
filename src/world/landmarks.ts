import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { Kit, bakeShading, buildGlowPoints } from '../kit/geoUtils';
import { opaqueMat, emissiveMat, glowMat, bindAssembly, C } from '../kit/materials';
import {
  pillar, bracketCluster, railing, stairs, torii, lantern, lanternHang,
  lanternTiny, lanternString, floorPlanks, floorTatami, slabBase, pavilion,
  roofTiered, wallShoji,
} from '../kit/parts';
import { District, DSIZE, LandmarkType, landmarkOf } from './districts';
import { attachCharacterDiorama } from './characters';

// ---------------------------------------------------------------------------
// LANDMARKS — monumental structures spanning 70–200 m, streamed at a much
// larger radius than rooms so they loom out of the fog long before you arrive.
// They are what make the scale jump from 10 m to 300 m in a single view, and
// what let a player say "meet me at the red pillar".
// ---------------------------------------------------------------------------

type LandmarkBuilder = (k: Kit, rng: () => number) => void;

/** Colossal red pillar rising far beyond the district in both directions. */
const greatPillar: LandmarkBuilder = (k, rng) => {
  const H = DSIZE * 2.6;
  const r = 3.4;
  // shaft in segments so the vertex-colour banding reads as scale
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const y = -H / 2 + (H / segs) * (i + 0.5);
    const taper = 1 - Math.abs(y) / (H * 1.6);
    k.box(r * 2 * taper, H / segs + 0.2, r * 2 * taper, 0, y, 0, i % 4 === 0 ? C.LACQ_B : C.LACQ, {
      jit: 0.08, collide: true,
    });
  }
  // iron bands + lantern rings marching up the shaft
  for (let i = 0; i < 14; i++) {
    const y = -H / 2 + (H / 14) * (i + 0.5);
    const taper = 1 - Math.abs(y) / (H * 1.6);
    const rr = r * taper;
    k.box(rr * 2.5, 1.1, rr * 2.5, 0, y, 0, C.TRIM_DARK, { jit: 0.1 });
    const n = 8;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + i * 0.3;
      lanternTiny(k, Math.cos(a) * rr * 1.5, y + 1.2, Math.sin(a) * rr * 1.5, 1.6);
    }
    // brackets and a ring balcony every few bands
    if (i % 3 === 1) {
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        bracketCluster(k, Math.cos(a) * rr * 1.2, y + 1.6, Math.sin(a) * rr * 1.2, 1.6);
      }
      const ring = rr * 2.6;
      for (const s of [-1, 1]) {
        railing(k, 0, y + 2.4, s * ring, ring * 2, true);
        railing(k, s * ring, y + 2.4, 0, ring * 2, false);
      }
      k.box(ring * 2.2, 0.5, ring * 2.2, 0, y + 2.1, 0, C.WOOD_D, { jit: 0.1, collide: true });
    }
  }
  k.glow(0, 0, 0, 26, 0xff7a33);
  void rng;
};

/** A pagoda hanging upside-down from nothing, tiers widening downward. */
const invertedPagoda: LandmarkBuilder = (k, rng) => {
  const tiers = 6;
  let y = DSIZE * 0.55;
  let w = 6;
  for (let i = 0; i < tiers; i++) {
    const h = 7 + i * 1.2;
    // body
    k.box(w, h, w, 0, y - h / 2, 0, i % 2 ? C.WOOD : C.WOOD_D, { jit: 0.12, collide: true });
    // inverted eave: wide slab under each tier
    const ew = w * 1.75;
    k.box(ew, 0.7, ew, 0, y - h - 0.35, 0, C.TRIM_DARK, { jit: 0.1, collide: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.box(ew * 0.34, 0.5, ew * 0.34, sx * ew * 0.46, y - h - 0.9, sz * ew * 0.46, C.TRIM_DARK, {
        rz: sx * 0.4, rx: -sz * 0.4,
      });
      bracketCluster(k, sx * w * 0.42, y - h + 0.3, sz * w * 0.42, 0.9);
    }
    // lit windows around the tier
    const n = 4;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const px = Math.cos(a) * (w / 2 + 0.05);
      const pz = Math.sin(a) * (w / 2 + 0.05);
      k.box(w * 0.42, h * 0.4, 0.3, px, y - h * 0.5, pz, C.PAPER, { em: true, ry: -a, jit: 0.25 });
      k.glow(px, y - h * 0.5, pz, 5, 0xffa050);
    }
    // lantern fringe along the eave
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      lanternTiny(k, Math.cos(a) * ew * 0.46, y - h - 1.6, Math.sin(a) * ew * 0.46, 1.5);
    }
    y -= h + 1.4;
    w *= 1.32;
  }
  // the spire, pointing down into the abyss
  k.box(1.4, 10, 1.4, 0, y - 5, 0, C.METAL, { jit: 0.1 });
  const g = new THREE.SphereGeometry(1.6, 8, 6);
  g.deleteAttribute('uv');
  k.place(g, 0, y - 11, 0, C.METAL);
  k.glow(0, y - 11, 0, 14, 0xffb060);
  void rng;
};

/** A torii gate the size of a city block, straddling the void. */
const colossalTorii: LandmarkBuilder = (k, rng) => {
  const W = DSIZE * 0.95;
  const H = DSIZE * 0.8;
  const pr = 3.0;
  for (const s of [-1, 1]) {
    // pillar with a slight batter, extended far below so it never "ends"
    k.box(pr * 2, H * 1.9, pr * 2, s * W / 2, -H * 0.25, 0, C.LACQ, { rz: s * 0.02, jit: 0.08, collide: true });
    k.box(pr * 3.2, 3, pr * 3.2, s * W / 2, H * 0.62, 0, C.TRIM_DARK, { jit: 0.1 });
    for (let i = 0; i < 10; i++) {
      lanternTiny(k, s * (W / 2) + (i % 2 ? pr * 1.6 : -pr * 1.6), -H * 0.6 + i * (H * 0.16), pr * 1.6, 1.8);
    }
  }
  // kasagi: double lintel with lifted tips
  k.box(W + 14, 2.6, 4.4, 0, H * 0.72, 0, C.LACQ, { jit: 0.08, collide: true });
  k.box(W + 22, 2.4, 5.6, 0, H * 0.80, 0, C.TRIM_DARK, { jit: 0.08, collide: true });
  for (const s of [-1, 1]) {
    k.box(9, 2.0, 5.2, s * (W / 2 + 13), H * 0.84, 0, C.TRIM_DARK, { rz: s * 0.28 });
  }
  // nuki tie + centre tablet
  k.box(W + 6, 2.2, 3.0, 0, H * 0.5, 0, C.LACQ, { jit: 0.08, collide: true });
  k.box(4.0, 5.0, 2.4, 0, H * 0.61, 0, C.LACQ_B);
  k.box(3.0, 3.6, 0.4, 0, H * 0.61, 1.4, C.PAPER, { em: true });
  k.glow(0, H * 0.61, 1.6, 12, 0xffa050);
  // lantern garland slung across the opening
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    lanternString(k, -W / 2, H * 0.46 - Math.sin(t * Math.PI) * 6, 0, W / 2, H * 0.46, 0, 7);
  }
  k.glow(0, 0, 0, 22, 0xff8035);
  void rng;
};

/** A staircase spiralling up and down past the limits of visibility. */
const endlessStair: LandmarkBuilder = (k, rng) => {
  const turns = 5;
  const stepsPerTurn = 22;
  const R = 13;
  const rise = 1.5;
  const total = turns * stepsPerTurn;
  for (let i = 0; i < total; i++) {
    const a = (i / stepsPerTurn) * Math.PI * 2;
    const y = -total * rise * 0.5 + i * rise;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    k.box(5.0, 0.5, 2.2, x, y, z, i % 5 === 0 ? C.LACQ : C.WOOD_L, { ry: -a, jit: 0.18, collide: true });
    if (i % 3 === 0) {
      k.box(0.34, 4.4, 0.34, Math.cos(a) * (R + 2.3), y + 2.2, Math.sin(a) * (R + 2.3), C.WOOD_D, { jit: 0.15 });
      k.box(2.2, 0.28, 0.28, Math.cos(a) * (R + 2.3), y + 4.3, Math.sin(a) * (R + 2.3), C.LACQ_B, { ry: -a });
    }
    if (i % 6 === 0) lanternTiny(k, Math.cos(a) * (R + 3.4), y + 3.6, Math.sin(a) * (R + 3.4), 1.8);
  }
  // the central column the stair wraps
  k.box(5.5, total * rise * 1.25, 5.5, 0, 0, 0, C.WOOD_D, { jit: 0.1, collide: true });
  for (let i = 0; i < 8; i++) {
    const y = -total * rise * 0.5 + (total * rise / 8) * i;
    k.box(7.0, 1.0, 7.0, 0, y, 0, C.TRIM_DARK, { jit: 0.1 });
  }
  k.glow(0, 0, 0, 18, 0xff9040);
  void rng;
};

/** A shrine hanging in the void on enormous chains. */
const suspendedShrine: LandmarkBuilder = (k, rng) => {
  const S = 22;
  const y = 0;
  slabBase(k, S, S, y, 2.0);
  floorPlanks(k, S - 1, S - 1, y + 0.01, true);
  for (const s of [-1, 1]) {
    railing(k, 0, y, s * (S / 2 - 0.6), S - 1.2, true);
    railing(k, s * (S / 2 - 0.6), y, 0, S - 1.2, false);
  }
  pavilion(k, 0, y, 0, S * 0.5, 9);
  // approach gate + path
  k.begin(0, 0, S * 0.34, 0);
  torii(k, 0, y, 0, 9, 12, C.LACQ);
  k.end();
  k.box(4.0, 0.16, S * 0.7, 0, y + 0.1, S * 0.1, C.STONE, { jit: 0.2 });
  // four titanic chains vanishing upward
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (S / 2 - 1.2);
      const cz = sz * (S / 2 - 1.2);
      for (let i = 0; i < 18; i++) {
        k.box(0.7, 2.6, 0.7, cx, y + 4 + i * 4.4, cz, C.METAL, { ry: i * 0.5, jit: 0.15 });
      }
      lanternPostTall(k, cx * 0.78, y, cz * 0.78);
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lanternHang(k, Math.cos(a) * S * 0.42, y + 8.5, Math.sin(a) * S * 0.42, 1.6, 1.4);
  }
  k.glow(0, y + 3, 0, 20, 0xffa855);
  void rng;
};

function lanternPostTall(k: Kit, x: number, yBase: number, z: number): void {
  k.box(0.4, 5.0, 0.4, x, yBase + 2.5, z, C.WOOD_D, { jit: 0.15 });
  k.box(1.0, 0.3, 1.0, x, yBase + 0.15, z, C.STONE);
  lantern(k, x, yBase + 5.6, z, 1.8);
}

/** A cathedral hall filled with hundreds of hanging lanterns. */
const lanternChamber: LandmarkBuilder = (k, rng) => {
  const S = DSIZE * 0.62;
  const H = DSIZE * 0.55;
  // floor and ceiling slabs
  k.box(S, 2.2, S, 0, -H / 2, 0, C.WOOD_D, { jit: 0.1, collide: true });
  floorPlanks(k, S - 1, S - 1, -H / 2 + 1.1, true);
  k.box(S, 2.0, S, 0, H / 2, 0, C.TRIM_DARK, { jit: 0.1, collide: true });
  // colonnade
  const n = 4;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i > 0 && i < n - 1 && j > 0 && j < n - 1) continue;
      const x = -S / 2 + (S / (n - 1)) * i;
      const z = -S / 2 + (S / (n - 1)) * j;
      pillar(k, x, z, -H / 2 + 1, H / 2 - 1, 1.8, (i + j) % 2 ? C.LACQ : C.WOOD_D);
      bracketCluster(k, x, H / 2 - 3.2, z, 1.5);
    }
  }
  // the lantern ocean
  const count = 150;
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * S * 0.92;
    const z = (rng() - 0.5) * S * 0.92;
    const drop = 3 + rng() * (H * 0.72);
    lanternTiny(k, x, H / 2 - drop, z, 1.5 + rng() * 1.6);
  }
  for (let i = 0; i < 10; i++) {
    lanternHang(k, (rng() - 0.5) * S * 0.7, H / 2 - 1.2, (rng() - 0.5) * S * 0.7, 3 + rng() * 8, 2.4);
  }
  k.glow(0, 0, 0, 30, 0xffa050);
};

/**
 * 鸣女高台（上弦之肆 · 琵琶空间中枢）
 * 悬空多层榻榻米主台、朱漆栏杆、巨型琵琶祭坛，周围环绕悬浮倾侧的发光障子门环阵、
 * 放射状悬空阶梯与赤金提灯花环，再现鸣女拨弦操控无限城的标志性场景。
 */
const nakimePlatform: LandmarkBuilder = (k, rng) => {
  const y = -2;
  // 1. 底部倒悬承重木构桁架与多层悬台基座
  k.box(14, 2.2, 14, 0, y - 4.2, 0, C.TRIM_DARK, { jit: 0.1, collide: true });
  k.box(10, 4.5, 10, 0, y - 7.5, 0, C.WOOD_D, { jit: 0.12 });
  k.box(5.5, 7.0, 5.5, 0, y - 13.0, 0, C.LACQ, { jit: 0.1 });
  // 倒悬尖锥
  k.box(2.2, 6.0, 2.2, 0, y - 19.0, 0, C.METAL, { jit: 0.08 });

  // 主榻榻米高台（18 × 18m）
  slabBase(k, 18, 18, y, 1.8);
  floorTatami(k, 16.8, 16.8, y + 0.05);
  // 朱漆金边内台
  k.box(8.8, 0.7, 8.8, 0, y + 0.35, 0, C.LACQ, { jit: 0.06, collide: true });
  floorTatami(k, 7.8, 7.8, y + 0.72);
  // 鸣女坐席（绯红座垫 + 矮几）
  k.box(2.8, 0.28, 2.8, 0, y + 0.86, 0.4, 0x9e1c24, { jit: 0.04 });
  k.box(3.1, 0.12, 3.1, 0, y + 0.74, 0.4, C.METAL, { jit: 0.04 });

  // 四角朱漆立柱、斗拱与四面栏杆
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * 8.2;
      const pz = sz * 8.2;
      pillar(k, px, pz, y, y + 10.5, 0.7, C.LACQ);
      bracketCluster(k, px, y + 9.2, pz, 1.1);
      lanternHang(k, px * 0.85, y + 9.8, pz * 0.85, 2.2, 1.6);
    }
    railing(k, 0, y, sx * 8.6, 17.2, true);
    railing(k, sx * 8.6, y, 0, 17.2, false);
  }
  // 高台上方悬浮朱漆桁框
  for (const s of [-1, 1]) {
    k.box(17.6, 0.8, 0.8, 0, y + 10.6, s * 8.2, C.LACQ_B, { jit: 0.08 });
    k.box(0.8, 0.8, 17.6, s * 8.2, y + 10.6, 0, C.LACQ_B, { jit: 0.08 });
  }

  // 2. 巨型象征性琵琶雕塑（矗立于主台后方，金弦发光）
  const bx = 0, by = y + 6.2, bz = -3.8;
  // 琵琶共鸣梨形琴箱
  const bodyGeo = new THREE.SphereGeometry(2.6, 12, 10);
  bodyGeo.scale(1.0, 1.45, 0.32);
  bodyGeo.deleteAttribute('uv');
  k.place(bodyGeo, bx, by - 0.8, bz, 0x6b2814);
  // 漆金半月拨面装饰
  k.box(3.4, 1.4, 1.05, bx, by - 1.2, bz + 0.25, C.METAL, { jit: 0.05 });
  // 琵琶琴颈与琴头（海老尾）
  k.box(0.75, 5.8, 0.55, bx, by + 4.4, bz, C.TRIM_DARK, { jit: 0.05 });
  k.box(0.95, 1.8, 0.65, bx, by + 7.6, bz - 0.45, C.LACQ, { rx: -0.55 });
  // 四个轸（弦轴）
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const py = by + 6.3 + Math.floor(i / 2) * 0.8;
    k.box(1.5, 0.22, 0.22, bx + side * 0.8, py, bz - 0.2, C.METAL);
  }
  // 四根发光金弦（鸣女血鬼术共鸣）
  for (let i = 0; i < 4; i++) {
    const sx = bx - 0.36 + i * 0.24;
    k.box(0.06, 9.2, 0.06, sx, by + 2.2, bz + 0.72, 0xffd275, { em: true });
  }
  // 琵琶背后赤金法阵光环
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    k.box(0.9, 0.22, 0.22, bx + Math.cos(a) * 5.2, by + 1.5 + Math.sin(a) * 5.2, bz - 0.7, 0xff6a30, {
      em: true, rz: a + Math.PI / 2,
    });
  }
  k.glow(bx, by + 1.2, bz + 0.5, 18, 0xff7035);

  // 3. 悬浮环绕的发光障子门矩阵（10 扇错落悬停，营造空间重组瞬间）
  const shojiCount = 10;
  for (let i = 0; i < shojiCount; i++) {
    const a = (i / shojiCount) * Math.PI * 2 + 0.22;
    const rad = 17.5 + (i % 2) * 4.5;
    const sy = y + ((i % 3) - 1) * 4.2 + 2.0;
    const px = Math.cos(a) * rad;
    const pz = Math.sin(a) * rad;
    k.begin(px, sy, pz, -a + Math.PI / 2);
    wallShoji(k, 7.2, 0, 8.8);
    // 障子顶部悬灯
    lanternTiny(k, 0, 9.4, 0.8, 1.5);
    k.end();
  }

  // 4. 四方向放射悬空木阶 + 提灯花环
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    k.begin(Math.cos(a) * 12.5, y - 2.2, Math.sin(a) * 12.5, -a + Math.PI / 2);
    stairs(k, { x: 0, y: 0, z: 0, rise: 4.5, run: 9.5, w: 3.2 });
    k.end();
    const nextA = ((i + 1) / 4) * Math.PI * 2;
    lanternString(
      k,
      Math.cos(a) * 15, y + 10.5, Math.sin(a) * 15,
      Math.cos(nextA) * 15, y + 10.5, Math.sin(nextA) * 15,
      6
    );
  }
  k.glow(0, y + 4, 0, 26, 0xff8c40);
  void rng;
};

/**
 * 无惨暗室（鬼王居所 · 苍色彼岸花炼金秘室）
 * 漆黑玄木与血红朱漆交织的压抑殿阁，四壁高耸药柜陈列着幽蓝与猩红发光器皿，
 * 中央黑漆书案与悬垂铁链血灯交映，顶部覆盖倒悬重檐黑瓦大顶。
 */
const muzanChamber: LandmarkBuilder = (k, rng) => {
  const S = 26;
  const H = 22;
  const y0 = -H / 2;

  // 1. 玄黑基台与血红纹饰地板
  k.box(S + 2, 2.2, S + 2, 0, y0 - 1.1, 0, 0x161018, { jit: 0.08, collide: true });
  k.box(S, 0.4, S, 0, y0 + 0.2, 0, 0x241822, { jit: 0.08, collide: true });
  // 地面血红十字铭文光带
  k.box(S * 0.72, 0.08, 0.45, 0, y0 + 0.44, 0, 0xc82230, { em: true });
  k.box(0.45, 0.08, S * 0.72, 0, y0 + 0.44, 0, 0xc82230, { em: true });
  // 暗室中央高台与黑漆书案（研究苍色彼岸花）
  k.box(8.5, 0.9, 6.5, 0, y0 + 0.85, -2.5, 0x1e131b, { jit: 0.06, collide: true });
  k.box(4.6, 1.1, 2.2, 0, y0 + 1.85, -2.5, 0x2e171c, { jit: 0.06 });
  // 桌案上的发光药剂瓶（幽蓝 & 猩红）与典籍
  const vials = [
    [-1.4, 0x3da6ff], [-0.8, 0xe82a3a], [-0.2, 0x4fc3ff],
    [0.5, 0xd82032], [1.2, 0x3da6ff], [1.7, 0xff5a6a],
  ] as const;
  for (const [vx, col] of vials) {
    k.box(0.28, 0.75, 0.28, vx, y0 + 2.78, -2.3, col, { em: true });
  }
  k.glow(0, y0 + 3.0, -2.3, 10, 0x4ca8ff);

  // 2. 八根玄黑血漆巨柱与重型铁构斗拱
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const rx = Math.cos(a) * (S * 0.44);
    const rz = Math.sin(a) * (S * 0.44);
    pillar(k, rx, rz, y0 + 0.4, y0 + H - 1.2, 1.05, i % 2 === 0 ? 0x20151c : 0x5c1418);
    bracketCluster(k, rx, y0 + H - 2.6, rz, 1.35);
    // 柱身铁箍
    for (let b = 1; b <= 3; b++) {
      k.box(1.6, 0.45, 1.6, rx, y0 + b * (H * 0.24), rz, 0x2a242c);
    }
  }

  // 3. 左右两侧高耸炼金药柜（陈列数十发光试剂瓶与实验器皿）
  for (const side of [-1, 1]) {
    const sx = side * (S * 0.39);
    // 柜体框架
    k.box(1.8, 12.5, 13.0, sx, y0 + 6.6, -0.5, 0x1b1218, { jit: 0.08, collide: true });
    for (let shelf = 0; shelf < 5; shelf++) {
      const sy = y0 + 2.0 + shelf * 2.2;
      k.box(2.1, 0.25, 12.6, sx, sy, -0.5, 0x382026);
      for (let j = 0; j < 7; j++) {
        const sz = -5.4 + j * 1.65;
        const isBlue = (shelf + j) % 3 === 0;
        const col = isBlue ? 0x389cff : 0xd62436;
        k.box(0.38, 0.72 + ((shelf + j) % 2) * 0.28, 0.38, sx - side * 0.65, sy + 0.55, sz, col, { em: true });
      }
    }
    k.glow(sx - side * 1.2, y0 + 6.5, -0.5, 12, side < 0 ? 0xd82838 : 0x3c98ff);
  }

  // 4. 顶部压抑黑漆天花与倒悬重檐巨顶
  k.box(S + 4, 1.8, S + 4, 0, y0 + H, 0, 0x18111a, { jit: 0.1, collide: true });
  roofTiered(k, S * 0.85, S * 0.85, y0 + H + 0.8, 2);

  // 5. 悬垂血红提灯、巨型铁链与空中猩红血阵
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rad = 7.5 + (i % 2) * 3.5;
    const lx = Math.cos(a) * rad;
    const lz = Math.sin(a) * rad;
    const ly = y0 + H - 3.5 - (i % 3) * 2.8;
    // 细铁链
    k.box(0.16, y0 + H - ly, 0.16, lx, (y0 + H + ly) / 2, lz, 0x302a34);
    // 血红灯笼
    k.box(0.95, 1.45, 0.95, lx, ly, lz, 0xe62b38, { em: true, jit: 0.08 });
    k.box(1.05, 0.22, 1.05, lx, ly + 0.78, lz, C.TRIM_DARK);
    k.box(1.05, 0.22, 1.05, lx, ly - 0.78, lz, C.TRIM_DARK);
  }
  // 空中悬垂铁链（向上下深渊延伸）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let c = 0; c < 10; c++) {
        k.box(0.5, 2.2, 0.5, sx * (S * 0.48), y0 - 4 - c * 3.2, sz * (S * 0.48), 0x2c2630, { ry: c * 0.5 });
      }
    }
  }
  // 暗室中央猩红血雾核心光源
  k.glow(0, y0 + H * 0.48, 0, 28, 0xe02838);
  void rng;
};

/**
 * 童磨莲池（上弦之贰 · 极乐教冰莲殿）
 * 广阔澄澈的冰翠莲花池、朱红拱桥、华丽金饰重檐极乐宝殿，池面盛开十余朵发光冰晶与粉白巨莲，
 * 殿檐悬垂翡翠与暖金灯笼，还原童磨充满妖异美感的冰莲大殿。
 */
const doumaLotusPond: LandmarkBuilder = (k, rng) => {
  const S = 40;
  const y = -4;

  // 1. 巨型石砌莲池基座与冰翠水面
  k.box(S + 3, 2.8, S + 3, 0, y - 1.5, 0, C.STONE, { jit: 0.12, collide: true });
  // 发光冰翠池水表面
  k.box(S, 0.35, S, 0, y + 0.05, 0, 0x1c6b6e, { em: true, jit: 0.06 });
  // 池面冰纹光环
  for (const r of [9.5, 15.5]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.box(1.8, 0.08, 0.22, Math.cos(a) * r, y + 0.28, Math.sin(a) * r, 0x7ef2e8, { em: true, ry: -a + Math.PI / 2 });
    }
  }
  // 四周朱红池岸与栏杆
  for (const s of [-1, 1]) {
    k.box(S + 3, 1.1, 1.5, 0, y + 0.45, s * (S / 2 + 0.75), C.LACQ, { jit: 0.08, collide: true });
    k.box(1.5, 1.1, S + 3, s * (S / 2 + 0.75), y + 0.45, 0, C.LACQ, { jit: 0.08, collide: true });
    railing(k, 0, y + 0.9, s * (S / 2 + 0.75), S + 1.5, true);
    railing(k, s * (S / 2 + 0.75), y + 0.9, 0, S + 1.5, false);
  }

  // 2. 池心极乐教宝殿（榻榻米御座 + 鎏金大屏风 + 三重飞檐金顶）
  const pS = 14.5;
  k.box(pS + 1.6, 2.2, pS + 1.6, 0, y + 0.9, -4.5, C.STONE, { jit: 0.1, collide: true });
  floorTatami(k, pS, pS, y + 2.05);
  // 鎏金屏风背景（极乐教金碧辉煌感）
  k.box(9.6, 5.2, 0.35, 0, y + 4.7, -9.8, 0xd9a838, { em: true, jit: 0.08 });
  k.box(10.0, 5.6, 0.25, 0, y + 4.7, -10.0, C.TRIM_DARK);
  // 宝殿御座高台
  k.box(4.8, 0.9, 3.6, 0, y + 2.5, -7.2, C.LACQ_B, { jit: 0.05 });
  k.box(2.4, 0.32, 2.2, 0, y + 3.1, -7.2, 0xe8d080);

  // 宝殿八根朱漆鎏金柱与三重飞檐大顶
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (pS * 0.44);
      const pz = -4.5 + sz * (pS * 0.44);
      pillar(k, px, pz, y + 2.0, y + 11.2, 0.75, C.LACQ);
      bracketCluster(k, px, y + 10.2, pz, 1.25);
      // 柱头金饰
      k.box(1.05, 0.55, 1.05, px, y + 10.9, pz, C.METAL);
    }
  }
  k.begin(0, 0, -4.5, 0);
  roofTiered(k, pS * 1.18, pS * 1.18, y + 11.2, 3);
  k.end();

  // 3. 通往宝殿的朱红拱桥（跨越南侧莲池）
  const bridgeSegs = 9;
  for (let i = 0; i < bridgeSegs; i++) {
    const t = i / (bridgeSegs - 1);
    const bz = 3.2 + t * 15.6;
    const arch = Math.sin(t * Math.PI) * 2.2;
    const by = y + 1.1 + arch;
    k.box(4.4, 0.42, 2.1, 0, by, bz, C.LACQ, { jit: 0.06, collide: true });
    for (const side of [-1, 1]) {
      k.box(0.24, 1.35, 0.24, side * 2.05, by + 0.75, bz, C.LACQ_B);
      k.box(0.32, 0.26, 0.32, side * 2.05, by + 1.48, bz, C.METAL);
    }
  }
  // 桥头大鸟居
  k.begin(0, y + 0.9, 18.8, 0);
  torii(k, 0, 0, 0, 8.6, 11.5, C.LACQ);
  k.end();

  // 4. 池面盛开的 16 朵巨型发光莲花（粉白佛莲 + 冰晶莲花）
  const lotusSpots: [number, number, number, boolean][] = [
    [-12, 10, 2.5, false], [-15, 2, 2.1, true], [-11, -8, 2.8, false], [-16, -13, 2.0, true],
    [12, 10, 2.6, true], [15, 1, 2.2, false], [11, -8, 2.7, true], [16, -13, 2.1, false],
    [-6, 14, 1.9, true], [6, 14, 2.0, false], [-13, 15, 1.8, false], [13, 15, 1.9, true],
    [-4, -15, 2.3, false], [4, -15, 2.2, true], [-16, -4, 1.9, false], [16, -4, 1.9, true],
  ];
  for (const [lx, lz, scale, isIce] of lotusSpots) {
    // 翠绿莲叶
    const pad = new THREE.CylinderGeometry(scale * 1.25, scale * 1.25, 0.14, 10);
    pad.deleteAttribute('uv');
    k.place(pad, lx, y + 0.28, lz, isIce ? 0x2d7a78 : 0x2f6e44);
    // 两层交错发光莲瓣
    const petalCol = isIce ? 0x8ef2ff : 0xffb8d4;
    const innerCol = isIce ? 0xd4fcff : 0xffe4ef;
    for (let p = 0; p < 8; p++) {
      const pa = (p / 8) * Math.PI * 2;
      k.box(scale * 0.42, scale * 0.16, scale * 0.95,
        lx + Math.cos(pa) * scale * 0.55, y + 0.55, lz + Math.sin(pa) * scale * 0.55,
        petalCol, { em: true, ry: -pa + Math.PI / 2, rx: -0.42 });
    }
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2 + 0.3;
      k.box(scale * 0.3, scale * 0.14, scale * 0.68,
        lx + Math.cos(pa) * scale * 0.32, y + 0.78, lz + Math.sin(pa) * scale * 0.32,
        innerCol, { em: true, ry: -pa + Math.PI / 2, rx: -0.75 });
    }
    // 金色花蕊
    k.box(scale * 0.34, scale * 0.34, scale * 0.34, lx, y + 0.85, lz, 0xffe270, { em: true });
  }

  // 5. 四角高挑冰翠提灯柱与宝殿悬灯
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (S * 0.46);
      const cz = sz * (S * 0.46);
      k.box(0.45, 7.5, 0.45, cx, y + 4.5, cz, C.LACQ_B);
      k.box(1.3, 1.9, 1.3, cx, y + 8.8, cz, C.LANT_JADE, { em: true });
      k.glow(cx, y + 8.8, cz, 11, C.GLOW_JADE);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    lanternHang(k, Math.cos(a) * 10.5, y + 12.2, -4.5 + Math.sin(a) * 10.5, 2.0, 1.5);
  }
  k.glow(0, y + 5.5, -4.5, 28, 0x70ebd0);
  k.glow(0, y + 3.0, 8.0, 20, 0xffb0d0);
  void rng;
};

/**
 * 破晓罗针殿（上弦之叁 · 炭治郎与义勇激战猗窝座）
 * 多层半毁和风武斗大殿，地面铺展巨型青蓝发光「破坏杀·罗针」十二角雪花阵，
 * 四周环绕崩裂的障子长廊、二层观战回廊与燃金提灯。
 */
const akazaArena: LandmarkBuilder = (k, rng) => {
  const S = 34;
  const y = -4;

  // 1. 宏阔多层木构大殿地面与战损木板
  slabBase(k, S + 2, S + 2, y, 2.2);
  floorPlanks(k, S, S, y + 0.04, true);

  // 地面巨型发光「破坏杀·罗针」十二角雪花阵（冰蓝发光）
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = i % 2 === 0 ? 12.5 : 8.2;
    k.box(0.32, 0.08, len, Math.cos(a) * len * 0.5, y + 0.16, Math.sin(a) * len * 0.5, 0x3ec8ff, {
      em: true, ry: -a + Math.PI / 2,
    });
    // 雪花分叉晶枝
    if (i % 2 === 0) {
      const mx = Math.cos(a) * 8.4;
      const mz = Math.sin(a) * 8.4;
      for (const side of [-0.65, 0.65]) {
        k.box(0.24, 0.08, 3.2, mx, y + 0.16, mz, 0x8ef0ff, { em: true, ry: -a + Math.PI / 2 + side });
      }
    }
  }
  // 罗针中心与外圈发光符环
  for (const rad of [4.2, 11.4]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.box(1.5, 0.08, 0.22, Math.cos(a) * rad, y + 0.16, Math.sin(a) * rad, 0x4ad8ff, {
        em: true, ry: -a + Math.PI / 2,
      });
    }
  }

  // 2. 四周双层开放回廊、朱漆立柱与半毁障子（营造激战后的空间层次）
  const half = S / 2 - 1.2;
  for (const s of [-1, 1]) {
    // 二层悬浮环廊
    k.box(S, 0.8, 3.6, 0, y + 10.2, s * (half - 0.8), C.WOOD_D, { jit: 0.1, collide: true });
    k.box(3.6, 0.8, S, s * (half - 0.8), y + 10.2, 0, C.WOOD_D, { jit: 0.1, collide: true });
    railing(k, 0, y + 10.6, s * (half - 2.4), S - 5, true);
    railing(k, s * (half - 2.4), y + 10.6, 0, S - 5, false);
    // 两侧立柱与障子残垣
    for (const o of [-11, -3.5, 3.5, 11]) {
      pillar(k, o, s * half, y, y + 19, 0.85, C.WOOD_D);
      pillar(k, s * half, o, y, y + 19, 0.85, C.WOOD_D);
    }
  }
  // 后方高耸发光障子墙与错落破损大梁
  k.begin(0, y + 0.2, -half + 0.5, 0);
  wallShoji(k, 14, 0, 9.6);
  k.end();
  k.begin(-half + 0.5, y + 0.2, -4, Math.PI / 2);
  wallShoji(k, 12, 0, 9.6);
  k.end();
  k.begin(half - 0.5, y + 0.2, -4, -Math.PI / 2);
  wallShoji(k, 12, 0, 9.6);
  k.end();
  // 激战崩断的悬空木梁与坠落灯笼
  k.box(10, 0.8, 0.9, -9, y + 14.5, -5, C.WOOD, { rz: -0.35, ry: 0.4 });
  k.box(9, 0.8, 0.9, 10, y + 13.8, 4, C.WOOD, { rz: 0.42, ry: -0.3 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lanternHang(k, Math.cos(a) * 14, y + 16.5, Math.sin(a) * 14, 2.6, 1.7);
  }
  k.glow(0, y + 2.5, 0, 26, 0x3ec8ff);
  k.glow(-7, y + 5, 4, 18, 0xff6e2e);
  void rng;
};

/**
 * 雷渊悬桥（新上弦之陆 · 善逸火雷神决战狯岳）
 * 跨越无底深渊的 42 米细长朱木悬桥、两端巍峨暗红鸟居楼阁、
 * 崩裂飞散的桥板碎木与缠绕桥身的金紫雷电灯串。
 */
const zenitsuBridge: LandmarkBuilder = (k, rng) => {
  const L = 42;
  const W = 7.4;
  const y = -2;

  // 1. 跨越深渊的主悬桥与微拱木板
  const segs = 14;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const bz = -L / 2 + t * L;
    const arch = Math.sin(t * Math.PI) * 1.8;
    const by = y + arch;
    k.box(W, 0.65, L / segs + 0.25, 0, by, bz, i % 3 === 0 ? C.LACQ : C.WOOD_D, { jit: 0.08, collide: true });
    for (const side of [-1, 1]) {
      k.box(0.32, 1.55, 0.32, side * (W / 2 - 0.3), by + 0.9, bz, C.LACQ_B);
      if (i < segs - 1) {
        k.box(0.24, 0.24, L / segs + 0.1, side * (W / 2 - 0.3), by + 1.5, bz + L / segs * 0.5, C.LACQ);
      }
    }
  }
  // 桥下深渊粗大吊索与倒悬横梁
  for (const side of [-1, 1]) {
    k.box(0.45, 0.45, L + 6, side * (W / 2 + 0.6), y - 1.8, 0, C.TRIM_DARK);
    for (let i = -3; i <= 3; i++) {
      k.box(0.35, 16, 0.35, side * (W / 2 + 0.6), y + 7.5, i * 6.2, C.METAL, { jit: 0.1 });
    }
  }

  // 2. 悬桥南北两端巍峨门楼与巨型朱红鸟居
  for (const end of [-1, 1]) {
    const ez = end * (L / 2 + 3.5);
    slabBase(k, 14, 11, y - 0.6, 2.2);
    floorPlanks(k, 13, 10, y - 0.55, true);
    k.begin(0, y - 0.2, ez - end * 3.8, 0);
    torii(k, 0, 0, 0, 9.8, 13.5, C.LACQ);
    k.end();
    // 门楼飞檐顶
    k.begin(0, 0, ez + end * 1.5, 0);
    roofTiered(k, 13, 10, y + 9.2, 2);
    k.end();
    for (const sx of [-5.2, 5.2]) {
      pillar(k, sx, ez + end * 1.5, y - 0.5, y + 9.2, 0.8, C.LACQ);
      lanternHang(k, sx, y + 8.5, ez - end * 1.8, 2.2, 1.6);
    }
  }

  // 3. 雷击震碎的浮空木梁与金紫灯链
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -14 + i * 4;
    k.box(2.8, 0.45, 0.55, side * (6.2 + (i % 3) * 1.8), y + 4.5 + (i % 3) * 2.4, z, C.WOOD, {
      rx: 0.35 * side, ry: i * 0.7, rz: 0.45,
    });
  }
  lanternString(k, -W / 2, y + 11, -L / 2, -W / 2, y + 11, L / 2, 10);
  lanternString(k, W / 2, y + 11, -L / 2, W / 2, y + 11, L / 2, 10);
  k.glow(0, y + 4.5, 6, 22, 0xffd240);
  k.glow(0, y + 4.5, -8, 22, 0x8042ff);
  void rng;
};

/**
 * 残月古殿（上弦之壹 · 岩风霞三柱围攻黑死牟）
 * 庄严肃杀的残破古寺正殿，八根朱漆巨柱半数被月之呼吸斜斩断裂、上半截悬于半空，
 * 顶部压低暗瓦巨檐，殿内弥漫紫红妖月光晕。
 */
const kokushiboHall: LandmarkBuilder = (k, rng) => {
  const S = 38;
  const y = -4;

  // 1. 古寺石阶基座与暗色榻榻米正殿
  k.box(S + 3, 2.4, S + 3, 0, y - 1.2, 0, C.STONE, { jit: 0.12, collide: true });
  floorTatami(k, S - 1, S - 1, y + 0.04);
  // 殿心神坛高台（黑死牟所立之处）
  k.box(12, 1.1, 10, 0, y + 0.55, -8.5, 0x261828, { jit: 0.08, collide: true });
  floorTatami(k, 10.6, 8.6, y + 1.12);
  // 地面紫金残月剑痕
  for (let i = 0; i < 6; i++) {
    const a = -0.8 + i * 0.32;
    k.box(8.5, 0.08, 0.24, Math.sin(a) * 6, y + 0.14, 2 + Math.cos(a) * 3, 0xd858a8, { em: true, ry: a });
  }

  // 2. 八根朱漆巨柱 —— 其中四根被斜斩成上下断柱（重现黑死牟月之呼吸破坏力）
  const ringR = S * 0.41;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * ringR;
    const pz = Math.sin(a) * ringR;
    if (i % 2 === 0) {
      // 完整巨柱
      pillar(k, px, pz, y, y + 18, 1.15, C.LACQ);
      bracketCluster(k, px, y + 16.2, pz, 1.5);
    } else {
      // 被月刃斜斩的断柱：下半截留地，上半截错位微倾悬吊于屋檐下
      pillar(k, px, pz, y, y + 7.2, 1.15, C.LACQ);
      k.box(2.1, 0.35, 2.1, px, y + 7.35, pz, 0xf288b8, { em: true, rz: 0.32 }); // 灼热斩口微光
      k.box(1.9, 8.2, 1.9, px + 0.55, y + 13.8, pz - 0.35, C.LACQ, { rz: 0.12, jit: 0.08 });
      bracketCluster(k, px + 0.4, y + 16.5, pz - 0.3, 1.4);
    }
  }

  // 3. 后方宏阔残破障子屏壁与高悬三重黑瓦大殿顶
  k.begin(0, y + 0.4, -S * 0.46, 0);
  wallShoji(k, 22, 0, 11.5);
  k.end();
  k.box(S + 2, 1.4, S + 2, 0, y + 18.2, 0, C.TRIM_DARK, { jit: 0.1, collide: true });
  roofTiered(k, S * 0.9, S * 0.9, y + 19.0, 3);

  // 4. 环殿暗紫/暖金悬灯
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    lanternHang(k, Math.cos(a) * 14.5, y + 17.0, Math.sin(a) * 14.5, 2.8 + (i % 3) * 1.4, 1.7);
  }
  k.glow(0, y + 7.0, -7.5, 28, 0xd04090);
  k.glow(0, y + 4.0, 5.0, 22, 0x62e8b0);
  void rng;
};

const BUILDERS: Record<Exclude<LandmarkType, 'none'>, LandmarkBuilder> = {
  greatPillar,
  invertedPagoda,
  colossalTorii,
  endlessStair,
  suspendedShrine,
  lanternChamber,
  nakimePlatform,
  muzanChamber,
  doumaLotusPond,
  akazaArena,
  zenitsuBridge,
  kokushiboHall,
};

export interface LandmarkData {
  key: string;
  root: THREE.Group;
  type: LandmarkType;
  district: District;
  disposables: THREE.BufferGeometry[];
  triCount: number;
}

/** Build the landmark for a district, or null if it has none. */
export function buildLandmark(d: District): LandmarkData | null {
  const type = landmarkOf(d);
  if (type === 'none') return null;
  const rng = mulberry32((d.seed ^ 0x5eed) | 0);
  const k = new Kit(rng);
  BUILDERS[type](k, rng);

  const glows = k.glows;
  const { opaque, emissive } = k.merge();
  const root = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];
  let triCount = 0;
  // landmarks are colossal, so they assemble slowly and never dissolve
  const times = { t0: -1e9, t1: Infinity };

  if (opaque) {
    bakeShading(opaque, glows, DSIZE * 0.8);
    opaque.computeBoundingSphere();
    const m = new THREE.Mesh(opaque, opaqueMat);
    m.matrixAutoUpdate = false;
    bindAssembly(m, times);
    root.add(m);
    disposables.push(opaque);
    triCount += (opaque.index?.count ?? 0) / 3;
  }
  if (emissive) {
    emissive.computeBoundingSphere();
    const m = new THREE.Mesh(emissive, emissiveMat);
    m.matrixAutoUpdate = false;
    bindAssembly(m, times);
    root.add(m);
    disposables.push(emissive);
    triCount += (emissive.index?.count ?? 0) / 3;
  }
  const pts = buildGlowPoints(glows, glowMat);
  if (pts) {
    pts.matrixAutoUpdate = false;
    root.add(pts);
    disposables.push(pts.geometry as THREE.BufferGeometry);
  }
  if (root.children.length === 0) return null;

  // 方案 A：在特色地标挂载 2.5D 高精动漫人物名场面 + 3D 招式特效
  attachCharacterDiorama(type, root, disposables);

  root.position.set(0, 0, 0); // district-local: landmarks sit at district centre
  return { key: d.key, root, type, district: d, disposables, triCount };
}
