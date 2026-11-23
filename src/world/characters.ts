import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LandmarkType } from './districts';
import { applyAnimeToonStyle } from '../kit/anime3d';

// ---------------------------------------------------------------------------
// 真 3D 动漫人物名场面展示模块（Blender 4.5 精雕 GLB + 四阶赛璐璐着色 + 法线外扩描边 + 真 3D 招式特效）
//
// 覆盖无限城六大原作名场面、共 17 位鬼灭核心角色：
//  1. 鸣女高台：鸣女 + 恋柱·甘露寺蜜璃 + 蛇柱·伊黑小芭内
//  2. 无惨暗室：鬼舞辻无惨
//  3. 童磨莲池：童磨 + 蝴蝶忍 + 嘴平伊之助 + 栗花落香奈乎
//  4. 破晓罗针殿：猗窝座 + 灶门炭治郎 + 水柱·富冈义勇
//  5. 雷渊悬桥：我妻善逸 + 狯岳
//  6. 残月古殿：黑死牟 + 岩柱·悲鸣屿行冥 + 风柱·不死川实弥 + 霞柱·时透无一郎
// ---------------------------------------------------------------------------

export type CharacterId =
  | 'shinobu' | 'douma' | 'nakime' | 'muzan'
  | 'obanai' | 'kanao' | 'mitsuri' | 'inosuke'
  | 'tanjiro' | 'giyu' | 'akaza' | 'zenitsu'
  | 'kaigaku' | 'kokushibo' | 'gyomei' | 'sanemi' | 'muichiro';

interface CachedCharacter {
  scene: THREE.Group;
  height: number;
  minY: number;
}

const gltfLoader = new GLTFLoader();
const modelCache = new Map<CharacterId, Promise<CachedCharacter>>();

function loadCharacterTemplate(id: CharacterId): Promise<CachedCharacter> {
  const cached = modelCache.get(id);
  if (cached) return cached;

  const p = new Promise<CachedCharacter>((resolve, reject) => {
    gltfLoader.load(
      `models/${id}.glb`,
      (gltf) => {
        const root = gltf.scene;
        applyAnimeToonStyle(root, {
          outlineWidth: 0.0052,
          outlineColor: 0x160e1c,
          fog: true,
          albedoScale: 0.92,
        });
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const height = Math.max(0.5, box.max.y - box.min.y);
        resolve({ scene: root, height, minY: box.min.y });
      },
      undefined,
      (err) => {
        console.warn(`[Characters] Failed to load models/${id}.glb:`, err);
        reject(err);
      }
    );
  });

  modelCache.set(id, p);
  return p;
}

interface DioramaAnim {
  root: THREE.Group;
  update: (t: number) => void;
}

const liveDioramas = new Set<DioramaAnim>();
let charactersVisible = true;

export function setCharactersVisible(visible: boolean): void {
  charactersVisible = visible;
  for (const d of liveDioramas) d.root.visible = visible;
}

export function getCharactersVisible(): boolean {
  return charactersVisible;
}

export function updateCharacterEffects(t: number): void {
  for (const d of liveDioramas) {
    if (!d.root.parent) {
      liveDioramas.delete(d);
      continue;
    }
    if (d.root.visible) d.update(t);
  }
}

interface FigurineOpts {
  id: CharacterId;
  height: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  accentColor: number;
  pedestalRadius?: number;
}

function buildFigurine(
  opts: FigurineOpts,
  disposables: THREE.BufferGeometry[]
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(opts.x, opts.y, opts.z);
  g.rotation.y = opts.rotY;

  const r = opts.pedestalRadius ?? 1.45;

  // Translucent glowing acrylic-style pedestal disc
  const baseGeo = new THREE.CylinderGeometry(r, r * 1.06, 0.12, 28);
  baseGeo.translate(0, 0.06, 0);
  disposables.push(baseGeo);
  const baseMat = new THREE.MeshBasicMaterial({
    color: opts.accentColor,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    fog: true,
  });
  g.add(new THREE.Mesh(baseGeo, baseMat));

  // Additive glowing rim ring
  const ringGeo = new THREE.RingGeometry(r * 0.9, r * 1.06, 36);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.translate(0, 0.13, 0);
  disposables.push(ringGeo);
  const ringMat = new THREE.MeshBasicMaterial({
    color: opts.accentColor,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  g.add(new THREE.Mesh(ringGeo, ringMat));

  // Lazy-attach True-3D GLB figurine scaled to exact monumental height
  loadCharacterTemplate(opts.id)
    .then((tpl) => {
      const clone = tpl.scene.clone(true);
      const sc = opts.height / tpl.height;
      clone.scale.setScalar(sc);
      clone.position.y = 0.12 - tpl.minY * sc;
      g.add(clone);
    })
    .catch(() => {
      // Already logged in loadCharacterTemplate
    });

  return g;
}

/** 1. 鸣女高台：鸣女抚琵琶 + 恋柱·甘露寺蜜璃 & 蛇柱·伊黑小芭内 夹击突袭 */
function buildNakimeDiorama(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y = -2;

  root.add(buildFigurine({
    id: 'nakime', height: 4.1, x: 0, y: y + 0.98, z: 0.7, rotY: 0, accentColor: 0xff6e38, pedestalRadius: 1.9,
  }, disposables));
  root.add(buildFigurine({
    id: 'mitsuri', height: 4.35, x: -5.8, y: y + 0.6, z: 5.6, rotY: 2.05, accentColor: 0xff7ac4, pedestalRadius: 1.45,
  }, disposables));
  root.add(buildFigurine({
    id: 'obanai', height: 4.35, x: 5.8, y: y + 0.2, z: 5.4, rotY: -2.05, accentColor: 0xc2a8ff, pedestalRadius: 1.45,
  }, disposables));

  const ringGeo = new THREE.TorusGeometry(1.0, 0.045, 8, 48);
  ringGeo.rotateX(Math.PI / 2);
  disposables.push(ringGeo);
  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i === 0 ? 0xffa84c : 0xff4e2a,
      transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(0, y + 1.25, 0.7);
    root.add(mesh);
    rings.push({ mesh, mat, phase: i / 3 });
  }

  const orbGeo = new THREE.OctahedronGeometry(0.24, 0);
  disposables.push(orbGeo);
  const pinkMat = new THREE.MeshBasicMaterial({ color: 0xff82cc, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const snakeMat = new THREE.MeshBasicMaterial({ color: 0xdcd0ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
  const ribbons: THREE.Mesh[] = [];
  const serpents: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(orbGeo, pinkMat);
    const s = new THREE.Mesh(orbGeo, snakeMat);
    p.scale.set(1.6, 0.5, 1.6);
    root.add(p, s);
    ribbons.push(p);
    serpents.push(s);
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      for (const r of rings) {
        const u = (t * 0.28 + r.phase) % 1;
        const sc = 1.6 + u * 7.6;
        r.mesh.scale.set(sc, 1, sc);
        r.mesh.position.y = y + 1.2 + u * 0.8;
        r.mat.opacity = Math.sin(u * Math.PI) * 0.72;
      }
      for (let i = 0; i < ribbons.length; i++) {
        const u = (t * 0.25 + i / ribbons.length) % 1;
        ribbons[i].position.set(-5.8 + u * 5.2, y + 2.6 + Math.sin(u * Math.PI * 3 + t * 2) * 1.4, 5.6 - u * 4.5);
        ribbons[i].rotation.y = t * 2 + i;
        serpents[i].position.set(5.8 - u * 5.2 + Math.sin(u * Math.PI * 4 + t * 3) * 0.9, y + 2.2 + Math.cos(u * Math.PI * 2) * 0.8, 5.4 - u * 4.3);
        serpents[i].rotation.z = t * 2.5 + i;
      }
    },
  };
}

/** 2. 无惨暗室：鬼王无惨立像 + 升腾猩红血雾丝缕 */
function buildMuzanDiorama(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y0 = -11;

  root.add(buildFigurine({
    id: 'muzan', height: 5.1, x: 0, y: y0 + 1.32, z: 0.65, rotY: 0, accentColor: 0xe62238, pedestalRadius: 1.65,
  }, disposables));

  const wispGeo = new THREE.BoxGeometry(0.08, 1.35, 0.08);
  disposables.push(wispGeo);
  const wispMat = new THREE.MeshBasicMaterial({
    color: 0xff2c44, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wisps: { mesh: THREE.Mesh; angle: number; rad: number; phase: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(wispGeo, wispMat);
    root.add(mesh);
    wisps.push({ mesh, angle: (i / 16) * Math.PI * 2, rad: 1.4 + (i % 4) * 0.75, phase: i / 16 });
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      for (const w of wisps) {
        const u = (t * 0.22 + w.phase) % 1;
        const a = w.angle + t * 0.45;
        w.mesh.position.set(Math.cos(a) * w.rad, y0 + 1.6 + u * 5.2, 0.65 + Math.sin(a) * w.rad);
        w.mesh.rotation.set(0.15, -a, Math.sin(t + w.angle) * 0.2);
        w.mesh.scale.set(1, 0.35 + Math.sin(u * Math.PI) * 1.1, 1);
      }
    },
  };
}

/** 3. 童磨莲池：童磨 vs 蝴蝶忍 + 嘴平伊之助 + 栗花落香奈乎 */
function buildDoumaStandoff(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y = -4;

  root.add(buildFigurine({
    id: 'shinobu', height: 4.3, x: -1.1, y: y + 3.45, z: 10.2, rotY: 2.55, accentColor: 0xb066ff, pedestalRadius: 1.5,
  }, disposables));
  root.add(buildFigurine({
    id: 'inosuke', height: 4.35, x: -5.4, y: y + 2.4, z: 7.2, rotY: 1.95, accentColor: 0x6ea8ff, pedestalRadius: 1.4,
  }, disposables));
  root.add(buildFigurine({
    id: 'kanao', height: 4.15, x: 5.2, y: y + 2.1, z: 7.4, rotY: -1.95, accentColor: 0xff9ad0, pedestalRadius: 1.35,
  }, disposables));
  root.add(buildFigurine({
    id: 'douma', height: 5.0, x: 0.5, y: y + 2.08, z: 0.6, rotY: 0.08, accentColor: 0x62ecff, pedestalRadius: 1.55,
  }, disposables));

  // Shaped 3D butterfly wings (replaces rectangular plane cards)
  interface Butterfly { pivot: THREE.Group; leftW: THREE.Mesh; rightW: THREE.Mesh; phase: number; speed: number; tOffset: number; arcRadius: number; }
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.18, 0.34, 0.48, 0.31, 0.4, 0.06);
  wingShape.bezierCurveTo(0.45, -0.14, 0.22, -0.32, 0, -0.08);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 8);
  disposables.push(wingGeo);
  const bMatPurple = new THREE.MeshBasicMaterial({ color: 0xd088ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const bMatCyan = new THREE.MeshBasicMaterial({ color: 0x70f4ff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const butterflies: Butterfly[] = [];
  for (let i = 0; i < 18; i++) {
    const pivot = new THREE.Group();
    const mat = i % 3 === 0 ? bMatCyan : bMatPurple;
    const leftW = new THREE.Mesh(wingGeo, mat);
    const rightW = new THREE.Mesh(wingGeo, mat);
    rightW.scale.x = -1;
    pivot.add(leftW, rightW);
    pivot.scale.setScalar(0.65 + (i % 4) * 0.22);
    root.add(pivot);
    butterflies.push({ pivot, leftW, rightW, phase: i * 1.17, speed: 7.5 + (i % 5) * 1.4, tOffset: i / 18, arcRadius: 1.3 + (i % 4) * 0.65 });
  }

  const shardGeo = new THREE.OctahedronGeometry(0.42, 0);
  shardGeo.scale(0.65, 1.9, 0.65);
  disposables.push(shardGeo);
  const shardMat = new THREE.MeshBasicMaterial({ color: 0x8ef8ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const shards: { mesh: THREE.Mesh; angle: number; radius: number; baseY: number; speed: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(shardGeo, shardMat);
    mesh.scale.setScalar(0.55 + (i % 3) * 0.38);
    root.add(mesh);
    shards.push({ mesh, angle: (i / 14) * Math.PI * 2, radius: 2.2 + (i % 3) * 1.45, baseY: y + 2.8 + (i % 4) * 0.95, speed: 0.35 + (i % 3) * 0.14 });
  }

  const petalGeo = new THREE.PlaneGeometry(0.32, 0.22);
  disposables.push(petalGeo);
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xffa8d8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const petals: { mesh: THREE.Mesh; phase: number; rad: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(petalGeo, petalMat);
    root.add(mesh);
    petals.push({ mesh, phase: i / 12, rad: 1.5 + (i % 3) * 1.1 });
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      for (const b of butterflies) {
        const u = (t * 0.14 + b.tOffset) % 1;
        const spiralA = u * Math.PI * 3.5 + b.phase;
        const r = b.arcRadius * (0.65 + 0.55 * Math.sin(u * Math.PI));
        b.pivot.position.set(-1.1 + u * 1.6 + Math.cos(spiralA) * r, y + 4.4 + Math.sin(u * Math.PI) * 2.4 + Math.sin(t * 2.0 + b.phase) * 0.35, 10.8 - u * 8.4 + Math.sin(spiralA) * r * 0.45);
        b.pivot.rotation.set(0.25, -spiralA, Math.sin(t * 2 + b.phase) * 0.25);
        const flap = 0.25 + Math.abs(Math.sin(t * b.speed + b.phase)) * 0.95;
        b.leftW.rotation.y = flap;
        b.rightW.rotation.y = -flap;
      }
      for (const s of shards) {
        const a = s.angle + t * s.speed;
        s.mesh.position.set(0.5 + Math.cos(a) * s.radius, s.baseY + Math.sin(t * 1.6 + s.angle) * 0.42, 0.6 + Math.sin(a) * s.radius);
        s.mesh.rotation.y = a * 1.5;
        s.mesh.rotation.z = Math.sin(t + s.angle) * 0.25;
      }
      for (const p of petals) {
        const a = t * 0.9 + p.phase * Math.PI * 2;
        p.mesh.position.set(5.2 + Math.cos(a) * p.rad, y + 2.8 + ((t * 0.6 + p.phase * 3) % 3.2), 7.4 + Math.sin(a) * p.rad);
        p.mesh.rotation.set(t + p.phase * 6, a, t * 0.7);
      }
    },
  };
}

/** 4. 破晓罗针殿：炭治郎 + 富冈义勇 vs 猗窝座 */
function buildAkazaDiorama(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y = -4;

  root.add(buildFigurine({
    id: 'tanjiro', height: 4.4, x: -4.2, y: y + 0.08, z: 6.2, rotY: 2.18, accentColor: 0xff6a28, pedestalRadius: 1.5,
  }, disposables));
  root.add(buildFigurine({
    id: 'giyu', height: 4.8, x: 4.4, y: y + 0.08, z: 5.8, rotY: -2.18, accentColor: 0x3ea8ff, pedestalRadius: 1.5,
  }, disposables));
  root.add(buildFigurine({
    id: 'akaza', height: 4.75, x: 0, y: y + 0.08, z: -2.2, rotY: 0, accentColor: 0x38d0ff, pedestalRadius: 1.75,
  }, disposables));

  const compassGeo = new THREE.TorusGeometry(6.8, 0.1, 8, 48);
  compassGeo.rotateX(Math.PI / 2);
  disposables.push(compassGeo);
  const compassMat = new THREE.MeshBasicMaterial({ color: 0x48e0ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const compassRing = new THREE.Mesh(compassGeo, compassMat);
  compassRing.position.set(0, y + 0.45, -2.2);
  root.add(compassRing);

  const orbGeo = new THREE.OctahedronGeometry(0.32, 0);
  disposables.push(orbGeo);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6e24, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false });
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x4cc4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames: THREE.Mesh[] = [];
  const waters: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const fm = new THREE.Mesh(orbGeo, fireMat);
    const wm = new THREE.Mesh(orbGeo, waterMat);
    root.add(fm, wm);
    flames.push(fm);
    waters.push(wm);
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      compassRing.rotation.z = t * 0.45;
      compassRing.scale.setScalar(1 + 0.04 * Math.sin(t * 2.4));
      for (let i = 0; i < flames.length; i++) {
        const a = t * 2.1 + (i / flames.length) * Math.PI * 2;
        flames[i].position.set(-4.2 + Math.cos(a) * 2.2, y + 1.8 + Math.sin(a * 2) * 1.3, 6.2 + Math.sin(a) * 2.2);
        flames[i].rotation.set(a, a * 1.4, 0);
        waters[i].position.set(4.4 + Math.cos(-a) * 2.4, y + 1.5 + Math.cos(a * 2) * 1.0, 5.8 + Math.sin(-a) * 2.4);
        waters[i].rotation.set(0, -a, a);
      }
    },
  };
}

/** 5. 雷渊悬桥：我妻善逸（火雷神） vs 狯岳（黑雷） */
function buildZenitsuDiorama(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y = -2;

  root.add(buildFigurine({
    id: 'zenitsu', height: 4.3, x: -0.6, y: y + 1.78, z: 6.5, rotY: 2.75, accentColor: 0xffd838, pedestalRadius: 1.5,
  }, disposables));
  root.add(buildFigurine({
    id: 'kaigaku', height: 4.7, x: 0.6, y: y + 1.72, z: -6.8, rotY: 0.15, accentColor: 0x8c4eff, pedestalRadius: 1.55,
  }, disposables));

  const boltGeo = new THREE.BoxGeometry(0.16, 0.16, 2.2);
  disposables.push(boltGeo);
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xffe44d, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x9b52ff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false });
  const goldBolts: THREE.Mesh[] = [];
  const darkBolts: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const gb = new THREE.Mesh(boltGeo, goldMat);
    const db = new THREE.Mesh(boltGeo, darkMat);
    root.add(gb, db);
    goldBolts.push(gb);
    darkBolts.push(db);
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      for (let i = 0; i < goldBolts.length; i++) {
        const u = (t * 0.75 + i / goldBolts.length) % 1;
        const jag = Math.sin(t * 14 + i * 2.3) * 1.4;
        goldBolts[i].position.set(-0.6 + jag, y + 3.2 + Math.cos(u * Math.PI * 3 + t * 5) * 1.1, 6.5 - u * 11.5);
        goldBolts[i].rotation.set(Math.sin(t * 9 + i) * 0.4, jag * 0.35, 0);

        const v = (t * 0.6 + i / darkBolts.length) % 1;
        const dj = Math.cos(t * 12 + i * 1.9) * 1.6;
        darkBolts[i].position.set(0.6 + dj, y + 3.4 + Math.sin(v * Math.PI * 3 - t * 4) * 1.2, -6.8 + v * 11.5);
        darkBolts[i].rotation.set(Math.cos(t * 8 + i) * 0.4, dj * 0.35, 0);
      }
    },
  };
}

/** 6. 残月古殿：黑死牟 vs 岩柱·悲鸣屿行冥 + 风柱·不死川实弥 + 霞柱·时透无一郎 */
function buildKokushiboDiorama(parent: THREE.Group, disposables: THREE.BufferGeometry[]): DioramaAnim {
  const root = new THREE.Group();
  root.visible = charactersVisible;
  const y = -4;

  root.add(buildFigurine({
    id: 'kokushibo', height: 5.3, x: 0, y: y + 1.15, z: -7.8, rotY: 0, accentColor: 0xe04898, pedestalRadius: 1.9,
  }, disposables));
  root.add(buildFigurine({
    id: 'gyomei', height: 5.45, x: 0, y: y + 0.08, z: 6.4, rotY: 2.85, accentColor: 0x98cc64, pedestalRadius: 1.85,
  }, disposables));
  root.add(buildFigurine({
    id: 'sanemi', height: 4.8, x: -7.2, y: y + 0.08, z: 3.4, rotY: 2.05, accentColor: 0x48e88a, pedestalRadius: 1.55,
  }, disposables));
  root.add(buildFigurine({
    id: 'muichiro', height: 4.2, x: 7.0, y: y + 0.08, z: 3.6, rotY: -2.05, accentColor: 0x7ef2e8, pedestalRadius: 1.4,
  }, disposables));

  const crescentGeo = new THREE.TorusGeometry(0.62, 0.08, 6, 16, Math.PI * 1.15);
  disposables.push(crescentGeo);
  const moonMatA = new THREE.MeshBasicMaterial({ color: 0xff70b8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const moonMatB = new THREE.MeshBasicMaterial({ color: 0xffe070, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const moons: { mesh: THREE.Mesh; angle: number; rad: number; baseY: number; speed: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const mesh = new THREE.Mesh(crescentGeo, i % 3 === 0 ? moonMatB : moonMatA);
    mesh.scale.setScalar(0.55 + (i % 4) * 0.32);
    root.add(mesh);
    moons.push({
      mesh,
      angle: (i / 24) * Math.PI * 2,
      rad: 3.2 + (i % 5) * 2.4,
      baseY: y + 2.2 + (i % 4) * 2.1,
      speed: (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 3) * 0.22),
    });
  }

  parent.add(root);
  return {
    root,
    update: (t: number) => {
      for (const m of moons) {
        const a = m.angle + t * m.speed;
        m.mesh.position.set(Math.cos(a) * m.rad, m.baseY + Math.sin(t * 2.0 + m.angle) * 0.6, -2.5 + Math.sin(a) * m.rad * 0.85);
        m.mesh.rotation.set(t * 1.8 + m.angle, a, t * 2.4);
      }
    },
  };
}

export function attachCharacterDiorama(
  type: LandmarkType,
  root: THREE.Group,
  disposables: THREE.BufferGeometry[]
): void {
  let anim: DioramaAnim | null = null;
  if (type === 'nakimePlatform') anim = buildNakimeDiorama(root, disposables);
  else if (type === 'muzanChamber') anim = buildMuzanDiorama(root, disposables);
  else if (type === 'doumaLotusPond') anim = buildDoumaStandoff(root, disposables);
  else if (type === 'akazaArena') anim = buildAkazaDiorama(root, disposables);
  else if (type === 'zenitsuBridge') anim = buildZenitsuDiorama(root, disposables);
  else if (type === 'kokushiboHall') anim = buildKokushiboDiorama(root, disposables);
  if (anim) liveDioramas.add(anim);
}
