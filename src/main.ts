import * as THREE from 'three';
import { Engine, IS_TOUCH } from './core/engine';
import { Quality, TierSettings } from './core/quality';
import { mulberry32, randomSeed, seedFromString } from './core/rng';
import { glowUniforms, fxUniforms } from './kit/materials';
import { World } from './world/streamer';
import {
  CELL, districtAtCell, isOccupied, setDensityScale,
  findNearestLandmark, landmarkOf, LANDMARK_INFO, ICONIC_ORDER, IconicLandmark,
} from './world/districts';
import { setCharactersVisible, updateCharacterEffects } from './world/characters';
import { farUniforms } from './world/farfield';
import { Choreographer } from './world/motion';
import { Crow } from './player/crow';
import { Flight } from './player/flight';
import { CameraRig } from './player/camera';
import { Input } from './input/input';
import { collideSphere, escapeDirection } from './physics/collision';
import { createSky } from './fx/sky';
import { Motes } from './fx/motes';
import { Mist } from './fx/mist';
import { Weather } from './fx/weather';
import { Post } from './fx/post';
import { AudioEngine } from './audio/audio';
import { Hunt } from './game/hunt';
import { UI } from './ui/ui';

const params = new URLSearchParams(location.search);
const dev = params.get('dev');

if (dev) {
  void import('./dev/gallery').then((m) => m.runGallery(dev));
} else {
  game();
}

function game(): void {
  // ---- settings live in the URL: refresh-proof, shareable ----
  const num = (k: string, d: number) => {
    const v = Number(params.get(k));
    return Number.isFinite(v) && params.has(k) ? v : d;
  };
  const state = {
    seed: params.get('seed') ?? '99',
    q: params.get('q') ?? 'auto',
    motion: num('motion', 100),
    pace: num('pace', 100),
    weather: params.get('weather') ?? 'auto',
    mist: num('mist', 100),
    density: num('density', 100),
    music: num('music', 65),
    sfx: num('sfx', 90),
    light: num('light', 100),
    inv: params.get('inv') === '1',
    ghost: params.get('ghost') === '1',
    chars: params.get('chars') !== '0',
  };
  const syncUrl = () => {
    const u = new URL(location.href);
    u.search = '';
    for (const [k, v] of Object.entries(state)) {
      u.searchParams.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    history.replaceState(null, '', u.toString());
  };

  let seedStr = state.seed;
  let seed = seedFromString(seedStr);
  setDensityScale(state.density / 100);
  setCharactersVisible(state.chars);

  const engine = new Engine(document.getElementById('app')!);
  const quality = new Quality();
  const world = new World(seed);
  engine.scene.add(world.group);
  const choreo = new Choreographer();
  const waveRng = mulberry32(seed ^ 0x7a7a);

  const sky = createSky();
  engine.scene.add(sky.mesh);
  const motes = new Motes();
  engine.scene.add(motes.points);
  const mist = new Mist();
  engine.scene.add(mist.mesh);
  const weather = new Weather();
  const post = new Post(engine);
  const audio = new AudioEngine();

  const crow = new Crow();
  engine.scene.add(crow.root);
  const flight = new Flight();
  const rig = new CameraRig();
  const hunt = new Hunt();
  engine.scene.add(hunt.points);

  let spawn = world.findSpawn();
  flight.pos.copy(spawn.pos);
  flight.setLook(spawn.yaw, 0);

  let started = false;
  let paused = false;
  let ghost = state.ghost;
  /** 名场面自由探索锚点（非空时启用 WASD 六向自由漫游，飞出边界自动切回翱翔） */
  let exploreAnchor: THREE.Vector3 | null = null;
  let manualExplore = false;
  let iconicCursor = -1;
  const EXPLORE_RADIUS = 44;
  let stuckTimer = 0;
  let mistScale = state.mist / 100;
  let moteScaleApplied = 0.5 + 0.75 * mistScale;
  let lastBuilt = 0;
  let buildRate = 0;
  let genQuietUntil = 0;
  const escapeVec = new THREE.Vector3();
  const grazeProbe = new THREE.Vector3();
  const worldOccupied = (x: number, y: number, z: number, s: number) => isOccupied(x, y, z, s);

  // ---- UI ----
  const ui = new UI({
    initial: state,
    onStart: (mode) => {
      audio.init();
      // 启动纯程序化原创和风配乐与鸣女琵琶入城震弦
      audio.startMusic();
      audio.enterSound();
      input.enabled = true;
      input.requestLock();
      started = true;
      if (mode === 'hunt') {
        hunt.start(seed, seedStr, flight.pos.y);
        ui.setHunt(true);
      } else {
        hunt.stop();
        ui.setHunt(false);
      }
    },
    onDaily: () => {
      // one castle per day, shared by everyone on Earth
      const d = new Date();
      const key = `daily-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      reseed(key);
    },
    onShare: () => hunt.shareText(),
    onSeed: (s) => reseed(s),
    onQuality: (t) => {
      state.q = t === null ? 'auto' : String(t);
      syncUrl();
      quality.setManual(t);
    },
    onMotion: (v) => {
      state.motion = Math.round(v * 100);
      syncUrl();
      choreo.intensity = v;
    },
    onInvertY: (b) => {
      state.inv = b;
      syncUrl();
      input.invertY = b;
    },
    onGhost: (b) => {
      state.ghost = b;
      syncUrl();
      ghost = b;
    },
    onChars: (b) => {
      state.chars = b;
      syncUrl();
      setCharactersVisible(b);
    },
    onMute: (b) => audio.setMuted(b),
    onWeather: (w) => {
      state.weather = w ?? 'auto';
      syncUrl();
      weather.override = w;
    },
    onPace: (v) => {
      state.pace = Math.round(v * 100);
      syncUrl();
      flight.speedScale = v;
    },
    onMist: (v) => {
      state.mist = Math.round(v * 100);
      syncUrl();
      mistScale = v;
      // more air means more of everything airborne — reallocate the mote
      // field only when the dial has moved meaningfully
      const target = 0.5 + 0.75 * v;
      if (Math.abs(target - moteScaleApplied) > 0.2) {
        moteScaleApplied = target;
        motes.setCount(Math.round(quality.settings.motes * target));
      }
    },
    onLight: (v) => {
      state.light = Math.round(v * 100);
      syncUrl();
      engine.renderer.toneMappingExposure = 1.55 * v;
    },
    onMusicVol: (v) => {
      state.music = Math.round(v * 100);
      syncUrl();
      audio.setMusicVolume(v);
    },
    onSfxVol: (v) => {
      state.sfx = Math.round(v * 100);
      syncUrl();
      audio.setSfxVolume(v);
    },
    onDensity: (v) => {
      state.density = Math.round(v * 100);
      syncUrl();
      setDensityScale(v);
      reseed(seedStr); // regrow the same castle at the new density
    },
    onPause: (p) => {
      paused = p;
      audio.setPaused(p);
      if (p) {
        if (document.pointerLockElement) document.exitPointerLock();
      } else if (started) {
        input.requestLock();
      }
    },
    onQuit: () => {
      // the URL carries every setting — reload lands on the homepage intact
      location.reload();
    },
    onBiwa: () => {
      audio.init();
      audio.enterSound();
      choreo.triggerBiwaWave(started ? flight.pos : menuFocus, waveRng);
    },
    onWarp: (type) => warpToLandmark(type),
  });

  const input = new Input(engine.renderer.domElement);
  // losing pointer lock mid-flight (ESC) IS the pause gesture
  input.onLock = (locked) => {
    if (!locked && started && !paused) ui.openPause();
  };
  input.onKey = (code) => {
    if (!started) return;
    switch (code) {
      case 'Tab':
        iconicCursor = (iconicCursor + 1) % ICONIC_ORDER.length;
        warpToLandmark(ICONIC_ORDER[iconicCursor]);
        break;
      case 'ShiftTab':
        iconicCursor = (iconicCursor - 1 + ICONIC_ORDER.length) % ICONIC_ORDER.length;
        warpToLandmark(ICONIC_ORDER[iconicCursor]);
        break;
      case 'KeyP':
        if (exploreAnchor || manualExplore) {
          exploreAnchor = null;
          manualExplore = false;
          flight.forward(escapeVec);
          flight.vel.copy(escapeVec).multiplyScalar(14.5 * flight.speedScale);
          ui.announcePlace('自由翱翔', '已恢复六自由度高速飞行');
        } else {
          manualExplore = true;
          flight.vel.set(0, 0, 0);
          ui.announcePlace('自由漫游模式', 'WASD/方向键前后左右探索 · Space/Shift 升降 · 按 P 恢复翱翔');
        }
        break;
      case 'KeyB':
        audio.enterSound();
        choreo.triggerBiwaWave(flight.pos, waveRng);
        break;
      case 'KeyC':
        rig.firstPerson = !rig.firstPerson;
        crow.setVisible(!rig.firstPerson);
        break;
      case 'KeyH':
        ui.toggleHud();
        break;
      case 'KeyR':
        reseed(String(randomSeed() >>> 0));
        break;
      case 'KeyM':
        audio.setMuted(!audio.muted);
        ui.setMuteDisplay(audio.muted);
        break;
    }
  };

  /** 鸣女空间传送：瞬移至最近的特色动漫地标最佳俯瞰机位并自动开启自由漫游探索 */
  function warpToLandmark(type: IconicLandmark): void {
    const idx = ICONIC_ORDER.indexOf(type);
    if (idx >= 0) iconicCursor = idx;
    const focus = started ? flight.pos : menuFocus;
    const d = findNearestLandmark(type, focus.x, focus.y, focus.z, seed, 16);
    if (!d) return;
    audio.init();
    audio.enterSound();
    ui.beatFlash();

    if (type === 'doumaLotusPond') {
      // 前景朱红拱桥（蝴蝶忍/伊之助/香奈乎）、中景冰莲池、后景鸟居极乐殿（童磨）
      flight.pos.set(d.cx - 4.8, d.cy + 4.4, d.cz + 22.8);
      flight.setLook(-0.22, -0.18);
    } else if (type === 'nakimePlatform') {
      // 鸣女坐镇琵琶高台，恋柱蜜璃与蛇柱小芭内左右翼夹击
      flight.pos.set(d.cx, d.cy + 6.2, d.cz + 20.5);
      flight.setLook(0, -0.24);
    } else if (type === 'muzanChamber') {
      // 无惨暗室：黑漆书案、鬼王立姿、血红提灯与幽蓝药柜
      flight.pos.set(d.cx, d.cy - 4.2, d.cz + 15.5);
      flight.setLook(0, -0.14);
    } else if (type === 'akazaArena') {
      // 破晓罗针殿：前景炭治郎与义勇、地面旋转发光雪花罗针、正中猗窝座
      flight.pos.set(d.cx, d.cy + 5.2, d.cz + 20.5);
      flight.setLook(0, -0.22);
    } else if (type === 'zenitsuBridge') {
      // 雷渊悬桥：侧前高机位纵览善逸火雷神与狯岳黑雷隔桥对冲
      flight.pos.set(d.cx - 7.5, d.cy + 5.2, d.cz + 17.5);
      flight.setLook(-0.36, -0.18);
    } else {
      // 残月古殿：俯瞰岩风霞三柱围攻高台黑死牟与漫天残月刃
      flight.pos.set(d.cx, d.cy + 6.8, d.cz + 22.0);
      flight.setLook(0, -0.24);
    }

    exploreAnchor = new THREE.Vector3(d.cx, d.cy, d.cz);
    manualExplore = false;
    flight.vel.set(0, 0, 0);
    rig.snap(flight);
    menuFocus.set(d.cx, d.cy, d.cz);
    genQuietUntil = engine.time + 1.2;
    buildRate = 0;
    world.update(flight.pos, engine.time);
    const info = LANDMARK_INFO[type];
    const orderTag = `[${iconicCursor + 1}/${ICONIC_ORDER.length}] `;
    ui.announcePlace(orderTag + info.name, info.sub + ' · TAB 切换场景 · WASD 自由漫游');
  }

  function reseed(s: string): void {
    exploreAnchor = null;
    manualExplore = false;
    seedStr = s;
    seed = seedFromString(s);
    state.seed = s;
    syncUrl();
    world.reseed(seed);
    spawn = world.findSpawn();
    flight.pos.copy(spawn.pos);
    flight.setLook(spawn.yaw, 0);
    // launch ALONG the new facing at cruise — not down some stale world axis
    flight.forward(escapeVec);
    flight.vel.copy(escapeVec).multiplyScalar(14.5 * flight.speedScale);
    rig.snap(flight);
    // the whole neighbourhood rebuilds at once — let it do so quietly
    genQuietUntil = engine.time + 1.6;
    buildRate = 0;
    menuFocus.copy(spawn.pos);
    ui.setSeedDisplay(s);
    // a new castle is a new hunt
    if (hunt.active) hunt.start(seed, seedStr, spawn.pos.y);
  }

  // ---- quality wiring ----
  let baseFog = 0.014;
  const applyTier = (s: TierSettings) => {
    engine.setRenderScale(s.renderScale, s.dprCap);
    world.radiusCells = s.radiusCells;
    world.buildBudgetMs = s.buildBudgetMs;
    world.landmarkRadiusD = s.radiusCells * 0.62;
    world.farRadiusD = s.radiusCells * 0.9;
    motes.setCount(Math.round(s.motes * moteScaleApplied));
    mist.setLayers(s.mistLayers);
    post.setEnabled(s.bloom);
    hunt.setPixelRatio(engine.renderer.getPixelRatio());
    // fog is thin enough to see landmarks and far-field districts loom
    baseFog = 0.75 / (s.radiusCells * CELL);
  };
  quality.onChange((s) => applyTier(s));
  applyTier(quality.settings);

  // ---- apply the URL-carried settings to every system, then mirror them ----
  if (state.q !== 'auto') quality.setManual(Number(state.q));
  choreo.intensity = state.motion / 100;
  flight.speedScale = state.pace / 100;
  weather.override = state.weather === 'auto' ? null : state.weather;
  engine.renderer.toneMappingExposure = 1.55 * (state.light / 100);
  input.invertY = state.inv;
  audio.setMusicVolume(state.music / 100);
  audio.setSfxVolume(state.sfx / 100);
  syncUrl();

  // ---- audio hooks ----
  choreo.onBeat = (delay, strength) => audio.beat(delay, strength);
  choreo.onFrontPass = () => ui.beatFlash();
  flight.onFlap = () => audio.flap();
  hunt.onScore = (kind, combo) => {
    if (kind === 'wisp') audio.wispChime(combo);
    else audio.depthDrum();
  };

  // ---- HUD bookkeeping ----
  let fpsAcc = 0;
  let fpsFrames = 0;
  let hudTimer = 0;
  let fps = 60;

  const menuFocus = spawn.pos.clone();

  engine.onFrame((dt, t) => {
    // paused: time stands still — the frozen frame keeps rendering, the
    // theme keeps playing, but nothing in the castle moves
    if (paused) return;
    quality.update(dt);

    if (started) {
      const exploring = manualExplore || exploreAnchor !== null;
      if (exploring) {
        flight.updateExplore(dt, input);
        // 飞出名场面探索边界（44m）后，无缝衔接回无尽空间的六自由度高速翱翔
        if (exploreAnchor && !manualExplore && flight.pos.distanceTo(exploreAnchor) > EXPLORE_RADIUS) {
          exploreAnchor = null;
          flight.forward(escapeVec);
          flight.vel.copy(escapeVec).multiplyScalar(15.5 * flight.speedScale);
          ui.announcePlace('已飞离名场面', '恢复无限城自由翱翔');
        }
      } else {
        flight.update(dt, input);
      }
      // integrate in substeps so high speed can't tunnel through walls
      const steps = ghost ? 1 : Math.max(1, Math.ceil((flight.speed * dt) / 0.45));
      const sdt = dt / steps;
      let hit = 0;
      for (let i = 0; i < steps; i++) {
        flight.pos.addScaledVector(flight.vel, sdt);
        if (!ghost) hit = Math.max(hit, collideSphere(world, flight.pos, flight.vel, 0.45));
      }
      if (hit > 4) audio.impact(hit);

      // Unstick: a LAST RESORT for genuinely wedged geometry (or a district
      // that slid into you). It must not fire during normal slow flight, or
      // it shoves the crow through walls and collision stops feeling solid.
      if (!ghost) {
        const wedged = flight.speed < 1.6 && input.flap;
        if (wedged) stuckTimer += dt;
        else stuckTimer = Math.max(0, stuckTimer - dt * 3);
        if (stuckTimer > 1.4) {
          if (escapeDirection(world, flight.pos, worldOccupied, escapeVec)) {
            flight.pos.addScaledVector(escapeVec, dt * 5);
            flight.vel.addScaledVector(escapeVec, dt * 9);
          }
          if (stuckTimer > 3.5) stuckTimer = 0;
        }
      }

      flight.applyTo(crow.root);
      crow.update(dt, flight.speed, input.flap, input.brake, engine.camera.position, t);
      rig.update(dt, engine.camera, flight, (p, r) => {
        collideSphere(world, p, null, r);
      });
      audio.wind(flight.speed);

      // ---- the hunt: wisps, combo, and danger-pay ----
      if (hunt.active) {
        // graze probe: a fat ghost sphere — if it would be pushed, we are
        // skimming architecture. The real 0.45 m sphere didn't hit, so this
        // is flying CLOSE, which is exactly what pays.
        let grazing = false;
        if (!ghost && flight.speed > 18 && hit === 0) {
          grazeProbe.copy(flight.pos);
          grazing = collideSphere(world, grazeProbe, null, 2.4) > 0;
        }
        hunt.update(dt, flight.pos, flight.speed, grazing);
        ui.updateScore(hunt.score, hunt.combo, hunt.comboFraction, hunt.best);
      }
    } else {
      // menu: slow drift around the spawn area
      const a = t * 0.06;
      engine.camera.position.set(
        menuFocus.x + Math.cos(a) * 20,
        menuFocus.y + 5 + Math.sin(t * 0.045) * 4,
        menuFocus.z + Math.sin(a) * 20
      );
      engine.camera.lookAt(menuFocus);
      flight.pos.copy(spawn.pos);
    }

    world.heading.copy(flight.vel).normalize();
    world.update(started ? flight.pos : menuFocus, t);
    choreo.update(t, dt, world, started ? flight.pos : menuFocus, waveRng);
    updateCharacterEffects(t);

    // ---- construction soundscape: the world generating is ALWAYS audible ----
    const delta = world.cellsBuilt - lastBuilt;
    lastBuilt = world.cellsBuilt;
    if (dt > 0) {
      const inst = Math.min(delta / dt, 40);
      buildRate += (inst - buildRate) * Math.min(dt * 2.2, 1);
    }
    if (started) audio.construction(t < genQuietUntil ? 0 : buildRate);

    // ---- Director drives presentation from the district you are inside ----
    const focus = started ? flight.pos : menuFocus;
    const here = districtAtCell(
      Math.round(focus.x / CELL), Math.round(focus.y / CELL), Math.round(focus.z / CELL), seed
    );

    // ---- weather: layered air that hides the streaming edge ----
    weather.update(dt, t, here.def.type, here.seed & 7);
    fxUniforms.uFogColor.value.copy(weather.fog);
    fxUniforms.uFogGlow.value.copy(weather.glow);
    motes.setWeather(weather.moteA, weather.moteB, weather.moteFall,
      weather.moteSize * (0.7 + 0.45 * mistScale));
    // the mist dial is EXTREME by design: quadratic response, and it drags
    // the whole atmosphere (fog) with it — 0 is crystal air, max is a whiteout
    const mistMul = Math.pow(mistScale, 2.2);
    mist.update(t, engine.camera.position, weather.mist, weather.mistDensity * mistMul);

    const fogUser = 0.65 + 0.35 * mistScale;
    const targetFog = baseFog * here.def.fogMul * weather.fogMul * fogUser;
    engine.fog.density += (targetFog - engine.fog.density) * Math.min(dt * 0.6, 1);
    glowUniforms.uFog.value = engine.fog.density;
    fxUniforms.uFogDensity.value = engine.fog.density;
    fxUniforms.uTime.value = t;
    fxUniforms.uBuildOrigin.value.copy(focus);
    farUniforms.uFogDensity.value = engine.fog.density;
    farUniforms.uTime.value = t;

    sky.mesh.position.copy(engine.camera.position);
    sky.uniforms.uTime.value = t;
    // jade only shows through when the air itself has turned green
    sky.uniforms.uJade.value += (
      (weather.key === 'spiritmist' ? 0.85 : 0.06) - sky.uniforms.uJade.value
    ) * Math.min(dt * 0.25, 1);
    motes.update(t, engine.camera.position, engine.renderer.getPixelRatio());
    glowUniforms.uPx.value = engine.renderer.getPixelRatio();

    // HUD @ 4 Hz
    fpsAcc += dt;
    fpsFrames++;
    hudTimer += dt;
    if (hudTimer > 0.25) {
      fps = fpsFrames / fpsAcc;
      fpsAcc = 0;
      fpsFrames = 0;
      hudTimer = 0;
      if (started) {
        const info = engine.renderer.info.render;
        const lm = landmarkOf(here);
        const lmInfo = lm !== 'none' ? LANDMARK_INFO[lm] : null;
        ui.updateHud({
          fps,
          spd: flight.speed,
          alt: flight.pos.y,
          rooms: world.roomsLive,
          draws: info.calls,
          tris: info.triangles,
          tier: quality.settings.name + (quality.auto ? '·自动' : ''),
          waves: choreo.waveCount,
          district: lmInfo ? `${lmInfo.name} · ${here.def.label}` : here.def.label,
          chapter: (lmInfo ? lmInfo.sub : here.chapter) + ' · ' + weather.label,
        });
      }
    }
  });

  engine.start();

  // debug handle for dev tooling
  (window as unknown as Record<string, unknown>).__ic = { engine, world, choreo, flight, quality, input, weather, audio, hunt };
}
