import * as THREE from 'three';

let toonGradient: THREE.DataTexture | null = null;

/** Shared 4-step anime cel-shading gradient map. */
export function getToonGradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([
    108, 108, 108, 255,
    164, 164, 164, 255,
    218, 218, 218, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  toonGradient = tex;
  return tex;
}

const outlineMatCache = new Map<string, THREE.ShaderMaterial>();

/**
 * Vertex-normal extrusion ink outline material.
 * Never scales the whole mesh (which breaks thin cloth/hair); instead offsets
 * each vertex along its smooth normal by `width` in object space.
 */
export function getAnimeOutlineMaterial(
  width = 0.0052,
  colorHex = 0x160e1c
): THREE.ShaderMaterial {
  const key = `${width.toFixed(4)}_${colorHex}`;
  const cached = outlineMatCache.get(key);
  if (cached) return cached;

  const col = new THREE.Color(colorHex);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: width },
      uColor: { value: col },
    },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      void main() {
        vec3 p = position + normal * uWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
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
  outlineMatCache.set(key, mat);
  return mat;
}

const SKIP_OUTLINE_RE = /Haori|RobeCape|Coat|Cape|Fan|Leaf|Eye|Whip|Bead|Ribbon/i;

export interface AnimeToonOptions {
  outlineWidth?: number;
  outlineColor?: number;
  fog?: boolean;
  /** Optional glowing eye color override for meshes whose name starts with `Eye`. */
  glowingEyeColor?: number;
  /** Slight albedo multiplier to balance Infinity Castle's bright lantern hemi light. */
  albedoScale?: number;
}

/**
 * Converts a loaded GLTF scene to crisp 4-step anime cel-shading (`MeshToonMaterial`)
 * and attaches vertex-normal ink outlines to solid meshes.
 */
export function applyAnimeToonStyle(
  root: THREE.Object3D,
  opts: AnimeToonOptions = {}
): void {
  const {
    outlineWidth = 0.0052,
    outlineColor = 0x160e1c,
    fog = true,
    glowingEyeColor,
    albedoScale = 0.9,
  } = opts;

  const gradientMap = getToonGradient();
  const outlineMat = getAnimeOutlineMaterial(outlineWidth, outlineColor);
  const targets: THREE.Mesh[] = [];

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      targets.push(obj as THREE.Mesh);
    }
  });

  for (const mesh of targets) {
    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src) continue;

    if (glowingEyeColor !== undefined && /^Eye/i.test(mesh.name)) {
      mesh.material = new THREE.MeshBasicMaterial({
        color: glowingEyeColor,
        fog,
      });
      continue;
    }

    const baseColor = src.color ? src.color.clone() : new THREE.Color(0xffffff);
    if (!src.map && albedoScale !== 1) {
      baseColor.multiplyScalar(albedoScale);
    }

    const toon = new THREE.MeshToonMaterial({
      color: src.map ? new THREE.Color(albedoScale, albedoScale, albedoScale) : baseColor,
      map: src.map ?? null,
      gradientMap,
      side: THREE.DoubleSide,
      transparent: src.transparent ?? false,
      opacity: src.opacity ?? 1,
      alphaTest: src.alphaTest ?? 0,
      fog,
    });

    if (toon.map) {
      toon.map.colorSpace = THREE.SRGBColorSpace;
      toon.map.anisotropy = 4;
    }

    if (src.emissive && (src.emissive.r > 0.01 || src.emissive.g > 0.01 || src.emissive.b > 0.01)) {
      toon.emissive = src.emissive.clone();
      toon.emissiveIntensity = src.emissiveIntensity ?? 0.6;
    }

    mesh.material = toon;

    if (outlineWidth > 0 && !SKIP_OUTLINE_RE.test(mesh.name)) {
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.name = `${mesh.name}_Outline`;
      outline.raycast = () => {};
      mesh.add(outline);
    }
  }
}
