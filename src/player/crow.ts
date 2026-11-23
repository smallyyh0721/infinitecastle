import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fxUniforms } from '../kit/materials';
import { applyAnimeToonStyle } from '../kit/anime3d';

// ---------------------------------------------------------------------------
// WING WASH — a soft sheet of blurred air riding the wingspan. Streaks of
// displaced air slip backwards across it, faster and brighter with airspeed,
// flaring on every downstroke. One quad, pure shader.
// ---------------------------------------------------------------------------
function makeWash(): {
  mesh: THREE.Mesh;
  u: { uTime: { value: number }; uStrength: { value: number }; uSpeed: { value: number } };
} {
  const u = { uTime: { value: 0 }, uStrength: { value: 0 }, uSpeed: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...u, uEncode: fxUniforms.uEncode },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      uniform float uTime;
      uniform float uStrength;
      uniform float uSpeed;
      uniform float uEncode;
      void main() {
        // elliptical falloff around the wingspan
        float r = length(vP * vec2(0.85, 2.6));
        float body = smoothstep(1.0, 0.15, r);
        // air streaks flowing backwards over the wings — the "blur".
        // they race as the crow accelerates
        float v = mix(10.0, 42.0, uSpeed);
        float s1 = sin(vP.x * 34.0 + uTime * v) * sin(vP.x * 13.0 - uTime * v * 0.7);
        float s2 = sin((vP.x + vP.y) * 21.0 - uTime * v * 1.15);
        float streaks = 0.55 + 0.45 * (0.5 * s1 + 0.5 * s2);
        float a = body * streaks * uStrength * 0.5;
        vec3 col = vec3(0.72, 0.82, 1.08) * a;
        if (uEncode < 0.5) col = pow(col, vec3(2.2));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), mat);
  mesh.position.set(0, 0.04, 0.22);
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  return { mesh, u };
}

const crowLoader = new GLTFLoader();

/**
 * True-3D Kasugai Crow (鬼灭鎹鸦) sculpted in Blender 4.5 with cel-shaded
 * plumage, glowing crimson eyes, fluttering crimson scarf, bamboo message
 * scroll, and articulated hierarchical wings (shoulder → elbow) + tail fan.
 * Faces -Z.
 */
export class Crow {
  readonly root = new THREE.Group();
  private meshRoot = new THREE.Group();
  private wingLIn: THREE.Object3D | null = null;
  private wingLOut: THREE.Object3D | null = null;
  private wingRIn: THREE.Object3D | null = null;
  private wingROut: THREE.Object3D | null = null;
  private tail: THREE.Object3D | null = null;
  private scarf: THREE.Object3D | null = null;
  private wash = makeWash();
  private gust = 0;
  private flapPhase = 0;
  private flareT = 0;

  constructor() {
    this.meshRoot.scale.setScalar(0.95);
    this.root.add(this.meshRoot);
    this.meshRoot.add(this.wash.mesh);

    crowLoader.load(
      'models/kasugai_crow.glb',
      (gltf) => {
        const model = gltf.scene;
        applyAnimeToonStyle(model, {
          outlineWidth: 0.0055,
          outlineColor: 0x0f0b14,
          fog: true,
          glowingEyeColor: 0xff2424,
          albedoScale: 0.96,
        });

        this.wingLIn = model.getObjectByName('WingL_Inner') ?? null;
        this.wingLOut = model.getObjectByName('WingL_Outer') ?? null;
        this.wingRIn = model.getObjectByName('WingR_Inner') ?? null;
        this.wingROut = model.getObjectByName('WingR_Outer') ?? null;
        this.tail = model.getObjectByName('TailFan') ?? null;
        this.scarf = model.getObjectByName('Scarf') ?? null;

        this.meshRoot.add(model);
      },
      undefined,
      (err) => {
        console.warn('[Crow] Failed to load models/kasugai_crow.glb:', err);
      }
    );
  }

  setVisible(v: boolean): void {
    this.meshRoot.visible = v;
  }

  update(
    dt: number,
    speed: number,
    flapping: boolean,
    braking: boolean,
    _camPos?: THREE.Vector3,
    t = 0
  ): void {
    const freq = flapping ? 3.1 : braking ? 2.2 : 0.9;
    const targetAmp = flapping ? 0.78 : braking ? 0.5 : 0.1 + Math.min(speed * 0.004, 0.08);
    this.flapPhase += dt * freq * Math.PI * 2;
    const s = Math.sin(this.flapPhase);
    const sLag = Math.sin(this.flapPhase - 0.85);
    const base = flapping ? 0.14 : 0.22; // wings held slightly raised in glide

    if (this.wingLIn) this.wingLIn.rotation.z = -(base + s * targetAmp);
    if (this.wingRIn) this.wingRIn.rotation.z = base + s * targetAmp;
    if (this.wingLOut) this.wingLOut.rotation.z = -(sLag * targetAmp * 0.52 - 0.05);
    if (this.wingROut) this.wingROut.rotation.z = sLag * targetAmp * 0.52 - 0.05;

    // brake flare: nose-up body, tail spread down
    this.flareT += ((braking ? 1 : 0) - this.flareT) * Math.min(dt * 6, 1);
    this.meshRoot.rotation.x = this.flareT * 0.5;
    if (this.tail) {
      this.tail.rotation.x = -0.08 - this.flareT * 0.72 + Math.sin(this.flapPhase) * 0.05;
      this.tail.scale.x = 1 + this.flareT * 0.45;
    }

    // crimson scarf flutter driven by airspeed + flapping
    if (this.scarf) {
      const flutter = 0.08 + Math.min(speed * 0.006, 0.18) + (flapping ? 0.06 : 0);
      this.scarf.rotation.x = Math.sin(t * 9.5) * flutter;
      this.scarf.rotation.y = Math.cos(t * 6.8) * flutter * 0.75;
    }

    // subtle body bob while flapping
    this.meshRoot.position.y = flapping ? Math.sin(this.flapPhase) * 0.03 : 0;

    // ---- wing wash: the air made visible ----
    if (this.meshRoot.visible) {
      const stroke = flapping ? Math.max(0, -Math.cos(this.flapPhase)) : 0;
      this.gust += (stroke * 0.7 - this.gust) * Math.min(dt * 7, 1);
      const cruise = THREE.MathUtils.smoothstep(speed, 5, 25);
      this.wash.u.uTime.value = t;
      this.wash.u.uSpeed.value = cruise;
      this.wash.u.uStrength.value = 0.35 + cruise * 0.6 + this.gust * 0.45;
      const spread = 1 + this.gust * 0.2 + cruise * 0.18;
      this.wash.mesh.scale.set(spread, 1 + cruise * 0.3, 1);
    }
  }
}
