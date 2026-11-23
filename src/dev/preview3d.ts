import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Crow } from '../player/crow';

// ---------------------------------------------------------------------------
// 独立 360° 3D 环绕预览展台（仅用于方案确认前检视 Blender 4.5 真 3D 人物与新版鬼灭鎹鸦）
// 不修改主无限城场景的任何代码。
// ---------------------------------------------------------------------------

const container = document.getElementById('viewport')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0916);
scene.fog = new THREE.FogExp2(0x160e20, 0.028);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 1.9, 4.9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1.05, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.maxDistance = 16;
controls.minDistance = 1.2;

// ---- 灯光系统（支持 无限城暖金 / 冰莲冷月 / 影棚白光 实时切换） ----
const hemi = new THREE.HemisphereLight(0xffddb0, 0x241838, 1.35);
const keyLight = new THREE.DirectionalLight(0xffcb88, 2.5);
keyLight.position.set(3.5, 6.0, 4.5);
const rimLight = new THREE.DirectionalLight(0x64e0ff, 1.85);
rimLight.position.set(-4.5, 3.2, -4.0);
const accentPt = new THREE.PointLight(0xff8c42, 12, 16);
accentPt.position.set(0, 2.4, 2.4);
scene.add(hemi, keyLight, rimLight, accentPt);

// ---- 4 阶卡通渐变贴图（MeshToonMaterial 赛璐璐阶梯高光） ----
function makeToonGradient(): THREE.DataTexture {
  const data = new Uint8Array([
    88, 88, 102, 255,
    148, 148, 162, 255,
    212, 212, 222, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
const toonGrad = makeToonGradient();

// ---- 底座展台（微缩和风冰莲池 + 朱红八角台） ----
const stageGroup = new THREE.Group();
scene.add(stageGroup);

const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2a1418, roughness: 0.55, metalness: 0.15 });
const rimGoldMat = new THREE.MeshStandardMaterial({ color: 0xc99c38, roughness: 0.3, metalness: 0.85 });
const pondMat = new THREE.MeshStandardMaterial({
  color: 0x155258, emissive: 0x0c3840, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3,
});
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.95, 0.24, 48), plinthMat);
plinth.position.y = -0.12;
const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.58, 2.58, 0.04, 48), pondMat);
pond.position.y = 0.01;
const goldRing = new THREE.Mesh(new THREE.TorusGeometry(2.74, 0.04, 12, 64), rimGoldMat);
goldRing.rotation.x = Math.PI / 2;
goldRing.position.y = 0.02;
const gridHelper = new THREE.PolarGridHelper(6.5, 12, 6, 64, 0x3b2a4a, 0x241832);
gridHelper.position.y = -0.24;
stageGroup.add(plinth, pond, goldRing, gridHelper);

// 展台周边 3D 发光小莲花
function addMiniLotus(x: number, z: number, color: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0.05, z);
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0x245e3c, roughness: 0.7 })
  );
  g.add(pad);
  const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const pGeo = new THREE.ConeGeometry(0.09, 0.24, 4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(pGeo, pMat);
    petal.position.set(Math.cos(a) * 0.11, 0.09, Math.sin(a) * 0.11);
    petal.rotation.z = -0.55;
    petal.rotation.y = -a;
    g.add(petal);
  }
  stageGroup.add(g);
}
addMiniLotus(-1.9, 1.1, 0xffa6d0);
addMiniLotus(1.85, 1.2, 0x7ef4ff);
addMiniLotus(-1.7, -1.3, 0x7ef4ff);
addMiniLotus(1.9, -1.1, 0xffa6d0);

// ---- 着色风格 & 反面膨胀日漫描边系统 ----
interface StylableMesh {
  mesh: THREE.Mesh;
  pbrMat: THREE.Material;
  toonMat: THREE.Material;
  outline: THREE.Mesh;
}
const stylables: StylableMesh[] = [];
/** 真正的顶点法线外扩日漫墨线描边着色器（彻底避免 scale 缩放导致的布料/发丝变黑穿帮） */
function makeNormalOutlineMat(width = 0.0085): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: width },
      uColor: { value: new THREE.Color(0x110c18) },
    },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      void main() {
        vec3 pos = position + normal * uWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

const charOutlineMat = makeNormalOutlineMat(0.0052);
const crowOutlineMat = makeNormalOutlineMat(0.0055);

let currentShade: 'toon' | 'pbr' = 'toon';
let outlineEnabled = true;
let wireEnabled = false;

function prepareAnimeModel(root: THREE.Object3D, isCrow = false): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });

  const oMat = isCrow ? crowOutlineMat : charOutlineMat;
  for (const mesh of meshes) {
    const src = mesh.material as THREE.MeshStandardMaterial;
    const pbrMat = src.clone();
    const isCrowEye = isCrow && /Eye/i.test(mesh.name);
    const toonMat = isCrowEye
      ? new THREE.MeshBasicMaterial({ color: 0xff2424 })
      : new THREE.MeshToonMaterial({
          color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
          map: src.map ?? null,
          emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
          emissiveIntensity: src.emissiveIntensity ?? 1,
          gradientMap: toonGrad,
          side: THREE.DoubleSide,
        });
    if (pbrMat.isMeshStandardMaterial) pbrMat.side = THREE.DoubleSide;

    // Skip outline on thin double-sided cloaks/fans where BackSide overlaps inner surface
    const skipOutline = /Haori|RobeCape|Fan|Leaf|Eye/i.test(mesh.name);
    const outline = new THREE.Mesh(mesh.geometry, oMat);
    outline.visible = outlineEnabled && !skipOutline;
    outline.userData.skipOutline = skipOutline;
    mesh.add(outline);

    mesh.material = currentShade === 'toon' ? toonMat : pbrMat;
    stylables.push({ mesh, pbrMat, toonMat, outline });
  }
}

function applyStyleState(): void {
  for (const s of stylables) {
    const active = currentShade === 'toon' ? s.toonMat : s.pbrMat;
    (active as THREE.MeshToonMaterial).wireframe = wireEnabled;
    s.mesh.material = active;
    s.outline.visible = outlineEnabled && !wireEnabled && !s.outline.userData.skipOutline;
  }
}

// ---- 动态 3D 特效组（蝴蝶忍紫青幻蝶 + 童磨冰晶 + 炭治郎火环） ----
const fxGroup = new THREE.Group();
scene.add(fxGroup);

interface BFly { pivot: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; phase: number; rad: number; }
const bflies: BFly[] = [];
const iceShards: THREE.Mesh[] = [];
const fireOrbs: THREE.Mesh[] = [];

{
  // 真实蝴蝶翼形 3D 翅膀（替代方形卡片）
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.06, 0.12, 0.17, 0.11, 0.14, 0.02);
  wingShape.bezierCurveTo(0.16, -0.05, 0.08, -0.11, 0, -0.03);
  const wGeo = new THREE.ShapeGeometry(wingShape, 8);
  const mP = new THREE.MeshBasicMaterial({ color: 0xd088ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mC = new THREE.MeshBasicMaterial({ color: 0x70f4ff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Group();
    const l = new THREE.Mesh(wGeo, i % 3 === 0 ? mC : mP);
    const r = new THREE.Mesh(wGeo, i % 3 === 0 ? mC : mP);
    r.scale.x = -1;
    p.add(l, r);
    fxGroup.add(p);
    bflies.push({ pivot: p, l, r, phase: i * 1.1, rad: 0.55 + (i % 3) * 0.25 });
  }

  const sGeo = new THREE.OctahedronGeometry(0.11, 0);
  sGeo.scale(0.6, 1.9, 0.6);
  const sMat = new THREE.MeshBasicMaterial({ color: 0x8ef8ff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(sGeo, sMat);
    fxGroup.add(m);
    iceShards.push(m);
  }

  const fGeo = new THREE.OctahedronGeometry(0.09, 0);
  const fMat = new THREE.MeshBasicMaterial({ color: 0xff6e24, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(fGeo, fMat);
    fxGroup.add(m);
    fireOrbs.push(m);
  }
}

// ---- 加载 4 个 Blender 4.5 导出的真 3D GLB 模型 + 旧版方块乌鸦 ----
const loader = new GLTFLoader();
const models: {
  shinobu?: THREE.Group;
  douma?: THREE.Group;
  tanjiro?: THREE.Group;
  newCrow?: THREE.Group;
  oldCrow: Crow;
} = {
  oldCrow: new Crow(),
};

const crowParts: {
  wingLIn?: THREE.Object3D;
  wingLOut?: THREE.Object3D;
  wingRIn?: THREE.Object3D;
  wingROut?: THREE.Object3D;
  tail?: THREE.Object3D;
  scarf?: THREE.Object3D;
} = {};

const modelRoot = new THREE.Group();
scene.add(modelRoot);
modelRoot.add(models.oldCrow.root);

let currentMode: 'standoff' | 'tanjiro' | 'crow' | 'all' = 'standoff';

function layoutMode(mode: typeof currentMode): void {
  currentMode = mode;
  const { shinobu, douma, tanjiro, newCrow, oldCrow } = models;
  if (shinobu) shinobu.visible = false;
  if (douma) douma.visible = false;
  if (tanjiro) tanjiro.visible = false;
  if (newCrow) newCrow.visible = false;
  oldCrow.root.visible = false;
  document.getElementById('compare-labels')!.classList.toggle('on', mode === 'crow');

  const desc = document.getElementById('scene-desc')!;
  if (mode === 'standoff') {
    desc.textContent = '童磨莲池 · 真 3D 蝴蝶忍 vs 童磨对峙：立体飘逸蝶翼羽织、3D 双金折扇与日轮刀，360° 任意角度皆为实体雕塑。';
    if (shinobu) { shinobu.visible = true; shinobu.position.set(-1.05, 0.03, 0.35); shinobu.rotation.y = Math.PI * 0.42; }
    if (douma) { douma.visible = true; douma.position.set(1.05, 0.03, -0.25); douma.rotation.y = -Math.PI * 0.36; }
    controls.target.set(0, 1.05, 0);
    camera.position.set(0, 1.85, 4.6);
  } else if (mode === 'tanjiro') {
    desc.textContent = '灶门炭治郎 · 3D 雕像鉴赏：立体刺猬发束、额纹与耳饰、飘逸绿黑格纹羽织、3D 日轮刀与火之神神乐焰环。';
    if (tanjiro) { tanjiro.visible = true; tanjiro.position.set(0, 0.03, 0); tanjiro.rotation.y = 0; }
    controls.target.set(0, 1.0, 0);
    camera.position.set(0.4, 1.65, 3.6);
  } else if (mode === 'crow') {
    desc.textContent = '主镜头飞鸟升级对比：左侧旧版方块乌鸦 vs 右侧 Blender 4.5 精雕鬼灭「鎹鸦」（流线羽翼、分层飞羽、赤红双眸、朱红围巾与传信竹筒）。';
    oldCrow.root.visible = true;
    oldCrow.root.position.set(-1.35, 1.35, 0);
    oldCrow.root.rotation.set(0, Math.PI, 0);
    oldCrow.root.scale.setScalar(1.35);
    if (newCrow) {
      newCrow.visible = true;
      newCrow.position.set(1.35, 1.35, 0);
      newCrow.rotation.set(0, Math.PI, 0);
      newCrow.scale.setScalar(1.2);
    }
    controls.target.set(0, 1.3, 0);
    camera.position.set(0, 2.35, 4.7);
  } else {
    desc.textContent = '全员 3D 合集展台：蝴蝶忍、童磨、灶门炭治郎三尊真 3D 雕像与空中振翅盘旋的新版鬼灭鎹鸦同屏 360° 检视。';
    if (shinobu) { shinobu.visible = true; shinobu.position.set(-1.45, 0.03, 0.45); shinobu.rotation.y = 0.45; }
    if (tanjiro) { tanjiro.visible = true; tanjiro.position.set(0, 0.03, 0.75); tanjiro.rotation.y = 0; }
    if (douma) { douma.visible = true; douma.position.set(1.45, 0.03, 0.1); douma.rotation.y = -0.45; }
    if (newCrow) {
      newCrow.visible = true;
      newCrow.scale.setScalar(1.0);
    }
    controls.target.set(0, 1.25, 0.2);
    camera.position.set(0, 2.35, 6.2);
  }
  controls.update();
}

let totalTris = 0;
let loadedCount = 0;
function countTris(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      n += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3;
    }
  });
  return Math.round(n);
}

function loadGlb(url: string, isCrow: boolean, onReady: (g: THREE.Group) => void): void {
  loader.load(url, (gltf) => {
    const g = gltf.scene;
    prepareAnimeModel(g, isCrow);
    totalTris += countTris(g);
    modelRoot.add(g);
    onReady(g);
    loadedCount++;
    document.getElementById('mesh-stats')!.textContent =
      `已加载 ${loadedCount}/4 真 3D GLB 模型 · 总计 ${(totalTris / 1000).toFixed(1)}k 三角面`;
    if (loadedCount === 4) layoutMode(currentMode);
  });
}

loadGlb('preview3d/shinobu_3d.glb', false, (g) => { models.shinobu = g; });
loadGlb('preview3d/douma_3d.glb', false, (g) => { models.douma = g; });
loadGlb('preview3d/tanjiro_3d.glb', false, (g) => { models.tanjiro = g; });
loadGlb('preview3d/kasugai_crow_3d.glb', true, (g) => {
  models.newCrow = g;
  crowParts.wingLIn = g.getObjectByName('WingL_Inner');
  crowParts.wingLOut = g.getObjectByName('WingL_Outer');
  crowParts.wingRIn = g.getObjectByName('WingR_Inner');
  crowParts.wingROut = g.getObjectByName('WingR_Outer');
  crowParts.tail = g.getObjectByName('TailFan');
  crowParts.scarf = g.getObjectByName('Scarf');
});

// ---- UI 交互绑定 ----
document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    layoutMode(btn.dataset.mode as typeof currentMode);
  });
});

(document.getElementById('c-orbit') as HTMLInputElement).addEventListener('change', (e) => {
  controls.autoRotate = (e.target as HTMLInputElement).checked;
});
(document.getElementById('c-outline') as HTMLInputElement).addEventListener('change', (e) => {
  outlineEnabled = (e.target as HTMLInputElement).checked;
  applyStyleState();
});
(document.getElementById('c-wire') as HTMLInputElement).addEventListener('change', (e) => {
  wireEnabled = (e.target as HTMLInputElement).checked;
  applyStyleState();
});
(document.getElementById('c-shade') as HTMLSelectElement).addEventListener('change', (e) => {
  currentShade = (e.target as HTMLSelectElement).value as 'toon' | 'pbr';
  applyStyleState();
});
(document.getElementById('c-light') as HTMLSelectElement).addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  if (v === 'castle') {
    scene.background = new THREE.Color(0x0d0916);
    hemi.color.setHex(0xffddb0); hemi.groundColor.setHex(0x241838); hemi.intensity = 1.35;
    keyLight.color.setHex(0xffcb88); keyLight.intensity = 2.5;
    rimLight.color.setHex(0x64e0ff); rimLight.intensity = 1.85;
    accentPt.color.setHex(0xff8c42); accentPt.intensity = 12;
  } else if (v === 'lotus') {
    scene.background = new THREE.Color(0x071218);
    hemi.color.setHex(0x9beeff); hemi.groundColor.setHex(0x162436); hemi.intensity = 1.3;
    keyLight.color.setHex(0xd6f6ff); keyLight.intensity = 2.2;
    rimLight.color.setHex(0xd088ff); rimLight.intensity = 2.2;
    accentPt.color.setHex(0x52e8d8); accentPt.intensity = 14;
  } else {
    scene.background = new THREE.Color(0x1d1c24);
    hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x4a4858); hemi.intensity = 1.7;
    keyLight.color.setHex(0xffffff); keyLight.intensity = 2.4;
    rimLight.color.setHex(0xd8e8ff); rimLight.intensity = 1.3;
    accentPt.color.setHex(0xfff4e0); accentPt.intensity = 6;
  }
});

document.querySelectorAll<HTMLButtonElement>('.mini-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tgt = controls.target.clone();
    const d = 4.4;
    const cam = btn.dataset.cam;
    if (cam === 'front') camera.position.set(tgt.x, tgt.y + 0.65, tgt.z + d);
    else if (cam === 'side') camera.position.set(tgt.x + d, tgt.y + 0.55, tgt.z);
    else if (cam === 'back') camera.position.set(tgt.x, tgt.y + 0.65, tgt.z - d);
    else if (cam === 'top') camera.position.set(tgt.x, tgt.y + d * 0.85, tgt.z + d * 0.65);
    controls.update();
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- 动画循环（新版鎹鸦双关节振翅 + 围巾飘动 + 3D 招式特效） ----
const clock = new THREE.Clock();
function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update();

  // 旧版方块乌鸦动画
  if (models.oldCrow.root.visible) {
    models.oldCrow.update(dt, 18, true, false, camera.position, t);
  }

  // 新版 Blender 精雕鬼灭鎹鸦动画
  if (models.newCrow && models.newCrow.visible) {
    const phase = t * 8.5;
    const s = Math.sin(phase);
    const sLag = Math.sin(phase - 0.85);
    if (crowParts.wingLIn) crowParts.wingLIn.rotation.z = -(0.18 + s * 0.58);
    if (crowParts.wingRIn) crowParts.wingRIn.rotation.z = 0.18 + s * 0.58;
    if (crowParts.wingLOut) crowParts.wingLOut.rotation.z = -(sLag * 0.42 - 0.05);
    if (crowParts.wingROut) crowParts.wingROut.rotation.z = sLag * 0.42 - 0.05;
    if (crowParts.tail) crowParts.tail.rotation.x = -0.08 + Math.sin(phase) * 0.08;
    if (crowParts.scarf) {
      crowParts.scarf.rotation.x = Math.sin(t * 7.5) * 0.14;
      crowParts.scarf.rotation.y = Math.cos(t * 5.2) * 0.12;
    }
    if (currentMode === 'all') {
      const a = t * 0.7;
      models.newCrow.position.set(Math.cos(a) * 1.9, 2.55 + Math.sin(t * 2.0) * 0.15, Math.sin(a) * 1.6);
      models.newCrow.rotation.set(0.08, -a, 0.22);
    } else if (currentMode === 'crow') {
      models.newCrow.position.y = 1.35 + Math.sin(phase) * 0.07;
    }
  }

  // 3D 特效展示
  const showStandoffFx = currentMode === 'standoff' || currentMode === 'all';
  const showFireFx = currentMode === 'tanjiro' || currentMode === 'all';
  const sx = currentMode === 'all' ? -1.45 : -1.05;
  const dx = currentMode === 'all' ? 1.45 : 1.05;
  const fz = currentMode === 'all' ? 0.75 : 0;

  for (let i = 0; i < bflies.length; i++) {
    const b = bflies[i];
    b.pivot.visible = showStandoffFx;
    if (!showStandoffFx) continue;
    const a = t * 1.4 + b.phase;
    b.pivot.position.set(sx + Math.cos(a) * b.rad, 1.0 + Math.sin(a * 1.7) * 0.55, 0.35 + Math.sin(a) * b.rad);
    b.pivot.rotation.y = -a;
    const flap = 0.25 + Math.abs(Math.sin(t * 10 + b.phase)) * 0.9;
    b.l.rotation.y = flap;
    b.r.rotation.y = -flap;
  }
  for (let i = 0; i < iceShards.length; i++) {
    const m = iceShards[i];
    m.visible = showStandoffFx;
    if (!showStandoffFx) continue;
    const a = t * 0.7 + (i / iceShards.length) * Math.PI * 2;
    m.position.set(dx + Math.cos(a) * 0.75, 0.7 + (i % 4) * 0.32 + Math.sin(t * 2 + i) * 0.12, -0.25 + Math.sin(a) * 0.75);
    m.rotation.y = a * 2;
  }
  for (let i = 0; i < fireOrbs.length; i++) {
    const m = fireOrbs[i];
    m.visible = showFireFx;
    if (!showFireFx) continue;
    const a = t * 2.2 + (i / fireOrbs.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.78, 0.85 + Math.sin(a * 2) * 0.45, fz + Math.sin(a) * 0.78);
    m.rotation.set(a, a * 1.5, 0);
  }

  renderer.render(scene, camera);
}
animate();
