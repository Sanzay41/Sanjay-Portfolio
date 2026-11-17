/* Topography to connected building: an illustrative BIM sequence.
   Site, building and every dimension are assumptions for demonstration,
   not a project, survey data or a design standard. */
import * as THREE from './vendor/three.module.min.js';

export const STAGES = [
  { key: 'topo',   label: 'Existing topography' },
  { key: 'cut',    label: 'Basement excavation' },
  { key: 'found',  label: 'Footings' },
  { key: 'struct', label: 'Structural frame' },
  { key: 'rebar',  label: 'Reinforcement' },
  { key: 'plumb',  label: 'Plumbing and fire protection' },
  { key: 'hvac',   label: 'HVAC' },
  { key: 'elec',   label: 'Electrical system' },
  { key: 'iot',    label: 'IoT sensors' },
  { key: 'twin',   label: 'Complete building' },
];
export const SYSTEMS = [
  { key: 'terrain',  label: 'Terrain',          color: '#7fa35a' },
  { key: 'found',    label: 'Foundation',       color: '#9a958c' },
  { key: 'struct',   label: 'Structure',        color: '#cfcac1' },
  { key: 'rebar',    label: 'Rebar',            color: '#d9822b' },
  { key: 'plumb',    label: 'Plumbing',         color: '#2f7fd8' },
  { key: 'fire',     label: 'Fire protection',  color: '#e0453a' },
  { key: 'hvac',     label: 'HVAC',             color: '#5cc3cf' },
  { key: 'elec',     label: 'Electrical',       color: '#f2b632' },
  { key: 'iot',      label: 'IoT sensors',      color: '#7cf3ff' },
  { key: 'env',      label: 'Envelope',         color: '#9cc3dd' },
];

// stage targets (0..1)
const Z = { contours: 0, survey: 0, cut: 0, fill: 0, found: 0, struct: 0, rebar: 0, ghost: 0, plumb: 0, fire: 0, hvac: 0, elec: 0, iot: 0, env: 0 };
const K = [
  { ...Z, contours: 1, survey: 1 },
  { ...Z, contours: 0.35, cut: 1 },
  { ...Z, cut: 1, found: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, rebar: 1, ghost: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, ghost: 0.7, plumb: 1, fire: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, ghost: 0.7, plumb: 0.25, fire: 0.25, hvac: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, ghost: 0.7, plumb: 0.2, fire: 0.2, hvac: 0.25, elec: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, ghost: 0.75, plumb: 0.2, fire: 0.2, hvac: 0.2, elec: 0.3, iot: 1 },
  { ...Z, cut: 1, fill: 1, found: 1, struct: 1, ghost: 0, plumb: 1, fire: 1, hvac: 1, elec: 1, iot: 1, env: 1 },
];

const PIN_DEFS = [
  { s: [0], t: 'Contours 1 m*', at: 'slope' }, { s: [0], t: 'Survey points', at: 'survey' },
  { s: [1], t: 'Basement cut 4.6 m*', at: 'pit' }, { s: [1], t: 'Battered slope 1:1*', at: 'batter' },
  { s: [2], t: 'Footing 2.4 × 2.4 m*', at: 'footing' }, { s: [2], t: 'Lean concrete', at: 'pcc' },
  { s: [3], t: 'Column grid 7.5 m*', at: 'column' }, { s: [3], t: 'Retaining wall', at: 'wall' }, { s: [3], t: 'Lift and stair core', at: 'core' },
  { s: [4], t: 'Column cages', at: 'column' }, { s: [4], t: 'Slab mesh', at: 'slab' },
  { s: [5], t: 'Water riser', at: 'riser' }, { s: [5], t: 'Sprinkler mains', at: 'sprink' }, { s: [5], t: 'Roof tank', at: 'tank' },
  { s: [6], t: 'Air handling unit', at: 'ahu' }, { s: [6], t: 'Supply ducts', at: 'duct' },
  { s: [7], t: 'Transformer', at: 'xfmr' }, { s: [7], t: 'LV main panel', at: 'lv' }, { s: [7], t: 'Rooftop PV', at: 'pv' }, { s: [7], t: 'Cable trays', at: 'tray' },
  { s: [8], t: 'IoT gateway', at: 'gateway' }, { s: [8], t: 'Strain gauges', at: 'strain' }, { s: [8], t: 'Occupancy and climate', at: 'room' },
  { s: [9], t: 'Digital twin', at: 'gateway' },
];

function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = (x) => Math.min(1, Math.max(0, x)), sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createBimBuild(opts) {
  const canvas = opts.canvas, labelsEl = opts.labels || null, capture = opts.mode === 'capture', low = opts.quality === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, capture ? 1 : (opts.maxDpr || 1.5)));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const BG = new THREE.Color(opts.background || '#0f1b2a');
  const scene = new THREE.Scene(); scene.background = BG; scene.fog = new THREE.Fog(BG, 150, 330);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 900);

  /* ---------------- site ---------------- */
  const SW = 150, SD = 110, NX = low ? 110 : 150, NZ = Math.round(NX * SD / SW);
  const natural = (x, z) => 100 - 0.075 * z + 0.02 * x + (vnoise(x / 26 + 3, z / 26) - 0.5) * 3.2 + (vnoise(x / 9, z / 9) - 0.5) * 0.5;
  const GL = Math.round(natural(0, 0) * 10) / 10;
  const BX = 30, BZ = 20, HB = BX / 2, HZ = BZ / 2, FH = 3.5, NF = 5;           // building 30 x 20 m, G + 4
  const B1 = GL - 3.6, FOOT_T = 0.7, PIT = B1 - FOOT_T - 0.3;                   // basement level, pit bottom
  const LV = [B1, GL]; for (let k = 1; k <= NF; k++) LV.push(GL + FH * k);       // slab levels B1..roof
  const xs = [-15, -7.5, 0, 7.5, 15], zs = [-10, -10 / 3, 10 / 3, 10];
  const PAD = 2.5;                                                               // working space around walls
  function cutH(x, z) {
    const dx = Math.max(0, Math.abs(x) - (HB + PAD)), dz = Math.max(0, Math.abs(z) - (HZ + PAD)), d = Math.hypot(dx, dz);
    return Math.min(natural(x, z), PIT + d * 1.0);                               // 1:1 batter
  }
  function padH(x, z) {
    const dx = Math.max(0, Math.abs(x) - (HB + 8)), dz = Math.max(0, Math.abs(z) - (HZ + 8)), d = Math.hypot(dx, dz);
    return lerp(GL - 0.05, natural(x, z), sstep(0, 10, d));                       // graded site platform
  }

  const tgeo = new THREE.PlaneGeometry(SW, SD, NX, NZ); tgeo.rotateX(-Math.PI / 2);
  const tp = tgeo.attributes.position, N = tp.count;
  const hNat = new Float32Array(N), hCut = new Float32Array(N), hPad = new Float32Array(N), cols = new Float32Array(N * 3), baseCol = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const x = tp.getX(k), z = tp.getZ(k); hNat[k] = natural(x, z); hCut[k] = cutH(x, z); hPad[k] = padH(x, z);
    const n1 = vnoise(x / 3, z / 3), n2 = vnoise(x / 11 + 5, z / 11);
    baseCol[k * 3] = 0.22 + 0.1 * n1 + 0.06 * n2; baseCol[k * 3 + 1] = 0.36 + 0.12 * n1 + 0.04 * n2; baseCol[k * 3 + 2] = 0.14 + 0.06 * n2;
  }
  tgeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const soil = [0.55, 0.42, 0.29], pit = [0.47, 0.4, 0.33], gravel = [0.62, 0.6, 0.55];
  let lastT = '';
  function setTerrain(cut, fill) {
    const key = cut.toFixed(3) + fill.toFixed(3); if (key === lastT) return; lastT = key;
    for (let k = 0; k < N; k++) {
      const x = tp.getX(k), z = tp.getZ(k);
      const inside = Math.abs(x) < HB + 0.35 && Math.abs(z) < HZ + 0.35;
      const cutY = lerp(hNat[k], hCut[k], cut);
      const fillY = inside ? hCut[k] : Math.max(hCut[k], hPad[k]);
      const y = lerp(cutY, fillY, fill);
      tp.setY(k, y);
      const depth = clamp01((hNat[k] - y) / 1.2) * (1 - fill), padK = fill * clamp01(1 - (Math.max(0, Math.abs(x) - HB - 8) + Math.max(0, Math.abs(z) - HZ - 8)) / 6);
      const fl = Math.abs(y - PIT) < 0.05 ? 1 : 0;
      for (let c = 0; c < 3; c++) { let v = lerp(baseCol[k * 3 + c], fl ? pit[c] : soil[c], depth); v = lerp(v, gravel[c], padK * 0.85); cols[k * 3 + c] = v; }
    }
    tp.needsUpdate = true; tgeo.attributes.color.needsUpdate = true; tgeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); terrain.receiveShadow = true; scene.add(terrain);
  setTerrain(0, 0);
  // terrain skirt
  {
    const v = [], base = Math.min(...hNat) - 8;
    const edge = (f) => { const p = []; for (let t = 0; t <= 1.0001; t += 1 / 80) p.push(f(t)); return p; };
    for (const s of [edge((t) => [-SW / 2 + t * SW, SD / 2]), edge((t) => [SW / 2, SD / 2 - t * SD]), edge((t) => [SW / 2 - t * SW, -SD / 2]), edge((t) => [-SW / 2, -SD / 2 + t * SD])])
      for (let k = 0; k < s.length - 1; k++) { const [x1, z1] = s[k], [x2, z2] = s[k + 1], y1 = natural(x1, z1), y2 = natural(x2, z2); v.push(x1, y1, z1, x1, base, z1, x2, base, z2, x1, y1, z1, x2, base, z2, x2, y2, z2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    terrain.userData.skirt = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 1, side: THREE.DoubleSide })); scene.add(terrain.userData.skirt);
  }
  // contours (natural, 1 m)
  const contours = (() => {
    const v = [], step = SW / NX, I = NX + 1;
    const hmin = Math.ceil(Math.min(...hNat)), hmax = Math.floor(Math.max(...hNat));
    for (let L = hmin; L <= hmax; L += 1) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const id = (a, b) => b * I + a, a = hNat[id(i, j)], b = hNat[id(i + 1, j)], c = hNat[id(i + 1, j + 1)], d = hNat[id(i, j + 1)];
      const x0 = -SW / 2 + i * step, z0 = -SD / 2 + j * step, pts = [];
      for (const [h1, h2, xa, za, xb, zb] of [[a, b, x0, z0, x0 + step, z0], [b, c, x0 + step, z0, x0 + step, z0 + step], [c, d, x0 + step, z0 + step, x0, z0 + step], [d, a, x0, z0 + step, x0, z0]])
        if ((h1 - L) * (h2 - L) < 0) { const t = (L - h1) / (h2 - h1); pts.push([xa + t * (xb - xa), za + t * (zb - za)]); }
      if (pts.length >= 2) v.push(pts[0][0], L + 0.06, pts[0][1], pts[1][0], L + 0.06, pts[1][1]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0 })); scene.add(m); return m;
  })();

  /* ---------------- instancing with build animation ---------------- */
  const growMats = [];
  function mat(color, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, transparent: true, opacity: 1, emissive: o.emissive ? new THREE.Color(o.emissive) : new THREE.Color(0), emissiveIntensity: o.ei ?? 0 });
    const u = { uGrow: { value: 1 }, uMode: { value: o.rise ? 1 : 0 } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uGrow; uniform float uMode; attribute float aDelay;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float gk = clamp((uGrow * 1.25 - aDelay) / 0.25, 0.0, 1.0);\n if (uMode > 0.5) { transformed.y *= gk; transformed.xz *= step(0.0001, gk); } else { transformed *= gk; }');
    };
    m.userData.u = u; growMats.push(m); return m;
  }
  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
  const cylG = new THREE.CylinderGeometry(1, 1, 1, 10); cylG.translate(0, 0.5, 0);
  const sphG = new THREE.SphereGeometry(1, 12, 8);
  const groups = {}; SYSTEMS.forEach((s) => (groups[s.key] = new THREE.Group())); Object.values(groups).forEach((g) => scene.add(g));
  const meshesOf = {}; // system -> materials
  function inst(sys, geom, material, items, shadow = true) {
    if (!items.length) return null;
    const g = geom.clone(); const m = new THREE.InstancedMesh(g, material, items.length); const o = new THREE.Object3D(), c = new THREE.Color();
    items.forEach((it, k) => { o.position.set(it.p[0], it.p[1], it.p[2]); o.quaternion.copy(it.q || new THREE.Quaternion()); o.scale.set(it.s[0], it.s[1], it.s[2]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); if (it.c) { c.set(it.c); m.setColorAt(k, c); } });
    g.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(items.map((it) => it.d || 0)), 1));
    m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; groups[sys].add(m);
    (meshesOf[sys] = meshesOf[sys] || []).push(material); return m;
  }
  const up = new THREE.Vector3(0, 1, 0);
  // a box from point to point (axis-aligned members) or a cylinder segment
  const boxAt = (x, y, z, w, h, d, dl, c) => ({ p: [x, y, z], s: [w, h, d], d: dl, c });
  function segCyl(a, b, r, dl, c) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), L = dir.length();
    return { p: [A.x, A.y, A.z], q: new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()), s: [r, L, r], d: dl, c };
  }
  const lvlDelay = (k) => k / (LV.length + 0.5);

  /* foundation: lean concrete + footings */
  const pcc = [], foot = [];
  xs.forEach((x) => zs.forEach((z, j) => { const dl = (xs.indexOf(x) * 4 + j) / 22; pcc.push(boxAt(x, PIT, z, 2.8, 0.1, 2.8, dl)); foot.push(boxAt(x, PIT + 0.1, z, 2.4, FOOT_T, 2.4, dl + 0.04)); }));
  inst('found', boxG, mat(0x8e8a83), pcc); inst('found', boxG, mat(0xa9a59d), foot);

  /* structure: basement walls, columns, beams, slabs, core */
  const conc = mat(0xd3cec4, { rough: 0.85 }), concR = mat(0xd3cec4, { rough: 0.85, rise: true });
  const colI = [], beamI = [], slabI = [], wallI = [];
  for (let k = 0; k < LV.length - 1; k++) xs.forEach((x) => zs.forEach((z) => colI.push(boxAt(x, LV[k], z, 0.5, LV[k + 1] - LV[k] - 0.2, 0.5, lvlDelay(k)))));
  for (let k = 0; k < LV.length; k++) {
    slabI.push(boxAt(0, LV[k] - 0.2, 0, BX + 0.6, 0.2, BZ + 0.6, lvlDelay(k) + 0.06));
    if (k === 0) continue;
    zs.forEach((z) => { for (let i = 0; i < 4; i++) beamI.push(boxAt((xs[i] + xs[i + 1]) / 2, LV[k] - 0.75, z, 7.5, 0.55, 0.32, lvlDelay(k - 1) + 0.09)); });
    xs.forEach((x) => { for (let j = 0; j < 3; j++) beamI.push(boxAt(x, LV[k] - 0.75, (zs[j] + zs[j + 1]) / 2, 0.32, 0.55, BZ / 3, lvlDelay(k - 1) + 0.09)); });
  }
  // basement retaining walls
  wallI.push(boxAt(0, B1, -HZ - 0.15, BX + 0.6, GL - B1, 0.3, 0.02), boxAt(0, B1, HZ + 0.15, BX + 0.6, GL - B1, 0.3, 0.02), boxAt(-HB - 0.15, B1, 0, 0.3, GL - B1, BZ, 0.02), boxAt(HB + 0.15, B1, 0, 0.3, GL - B1, BZ, 0.02));
  // lift and stair core between x 7.5..15, z -3.3..3.3, rising to a roof overrun
  const coreTop = LV[LV.length - 1] + 3, cH = coreTop - B1;
  wallI.push(boxAt(7.5, B1, 0, 0.25, cH, 6.67, 0.1), boxAt(15, B1, 0, 0.25, cH, 6.67, 0.1), boxAt(11.25, B1, -3.33, 7.5, cH, 0.25, 0.1), boxAt(11.25, B1, 3.33, 7.5, cH, 0.25, 0.1));
  inst('struct', boxG, concR, colI); inst('struct', boxG, conc, beamI); inst('struct', boxG, conc, slabI); inst('struct', boxG, concR, wallI);

  /* rebar (line segments) */
  const rebar = (() => {
    const v = [];
    const L = (a, b) => v.push(...a, ...b);
    // footing mats
    xs.forEach((x) => zs.forEach((z) => { const y = PIT + 0.22; for (let t = -1.05; t <= 1.051; t += 0.15) { L([x - 1.1, y, z + t], [x + 1.1, y, z + t]); L([x + t, y + 0.04, z - 1.1], [x + t, y + 0.04, z + 1.1]); } }));
    // column cages
    for (let k = 0; k < LV.length - 1; k++) xs.forEach((x) => zs.forEach((z) => {
      const y0 = LV[k] - (k === 0 ? 0.8 : 0), y1 = LV[k + 1] + 0.6, r = 0.19;
      for (const [a, b] of [[-r, -r], [r, -r], [r, r], [-r, r], [0, -r], [r, 0], [0, r], [-r, 0]]) L([x + a, y0, z + b], [x + a, y1, z + b]);
      for (let y = LV[k] + 0.15; y < LV[k + 1]; y += 0.45) { L([x - r, y, z - r], [x + r, y, z - r]); L([x + r, y, z - r], [x + r, y, z + r]); L([x + r, y, z + r], [x - r, y, z + r]); L([x - r, y, z + r], [x - r, y, z - r]); }
    }));
    // beams: 4 bars + stirrups
    for (let k = 1; k < LV.length; k++) {
      const yb = LV[k] - 0.72, yt = LV[k] - 0.26;
      zs.forEach((z) => { for (const dz of [-0.11, 0.11]) for (const y of [yb, yt]) L([-15, y, z + dz], [15, y, z + dz]); for (let x = -15; x <= 15; x += 0.75) { L([x, yb, z - 0.11], [x, yt, z - 0.11]); L([x, yb, z + 0.11], [x, yt, z + 0.11]); } });
      xs.forEach((x) => { for (const dx of [-0.11, 0.11]) for (const y of [yb, yt]) L([x + dx, y, -10], [x + dx, y, 10]); });
      // slab mesh
      const ys = LV[k] - 0.12;
      for (let z = -10; z <= 10.01; z += 1.6) L([-15, ys, z], [15, ys, z]);
      for (let x = -15; x <= 15.01; x += 1.5) L([x, ys + 0.02, -10], [x, ys + 0.02, 10]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd9822b, transparent: true, opacity: 0 })); groups.rebar.add(m); return m;
  })();

  /* plumbing: cold-water riser, branches, roof tank, drainage stack and sewer */
  const WP = [], DP = [], tanks = [];
  const roof = LV[LV.length - 1];
  const rx = 6.2, rz = -1.2;
  WP.push(segCyl([rx, B1 + 0.3, rz], [rx, roof + 1.0, rz], 0.2, 0.05, '#2f7fd8'));
  for (let k = 1; k < LV.length - 1; k++) {
    const y = LV[k + 1] - 0.95, dl = lvlDelay(k);
    WP.push(segCyl([rx, y, rz], [-12.5, y, rz], 0.13, dl, '#2f7fd8'));
    for (const z of [-7, 7]) WP.push(segCyl([-12.5, y, rz], [-12.5, y, z], 0.1, dl + 0.05, '#2f7fd8'));
    DP.push(segCyl([-13.2, y - 0.3, 6.5], [4.6, y - 0.4, 1.2], 0.14, dl, '#3d8b5a'));
  }
  DP.push(segCyl([4.6, B1 + 0.2, 1.2], [4.6, roof + 1.2, 1.2], 0.22, 0.05, '#3d8b5a'));
  DP.push(segCyl([4.6, B1 + 0.2, 1.2], [4.6, B1 + 0.2, 26], 0.22, 0.05, '#3d8b5a'));
  tanks.push({ p: [-9, roof, -5], s: [1.6, 2.2, 1.6], c: '#c8d4dd', d: 0.6 }, { p: [-5.5, roof, -5], s: [1.6, 2.2, 1.6], c: '#c8d4dd', d: 0.65 });
  const pumps = [boxAt(5.5, B1, -6, 2.2, 1.2, 1.4, 0.02, '#2f7fd8')];
  inst('plumb', cylG, mat(0xffffff, { rough: 0.4 }), WP); inst('plumb', cylG, mat(0xffffff, { rough: 0.5 }), DP); inst('plumb', cylG, mat(0xffffff, { rough: 0.4 }), tanks); inst('plumb', boxG, mat(0xffffff, { rough: 0.5 }), pumps);

  /* fire protection: riser, mains, branch lines, sprinkler heads, fire pump */
  const F = [], heads = [];
  F.push(segCyl([-14, B1 + 0.3, -9], [-14, roof - 0.5, -9], 0.18, 0.04, '#e0453a'));
  for (let k = 0; k < LV.length - 1; k++) {
    const y = LV[k + 1] - 0.55, dl = lvlDelay(k);
    F.push(segCyl([-14, y, -9], [-14, y, 0], 0.13, dl, '#e0453a'), segCyl([-14, y, 0], [14, y, 0], 0.13, dl + 0.02, '#e0453a'));
    for (let x = -11.25; x <= 11.3; x += 3.75) { F.push(segCyl([x, y, -9], [x, y, 9], 0.08, dl + 0.05, '#e0453a')); for (let z = -7.5; z <= 7.6; z += 3) heads.push({ p: [x, y - 0.15, z], s: [0.16, 0.16, 0.16], d: dl + 0.08, c: '#ff6b5e' }); }
  }
  inst('fire', cylG, mat(0xffffff, { rough: 0.45 }), F); inst('fire', sphG, mat(0xffffff, { rough: 0.4 }), heads, false);
  inst('fire', boxG, mat(0xe0453a, { rough: 0.5 }), [boxAt(1.5, B1, -6.5, 1.8, 1.1, 1.2, 0.02)]);

  /* HVAC: rooftop AHU and chiller, shaft, mains, branches, diffusers */
  const Hm = [], diff = [];
  Hm.push(boxAt(-1, roof, 4.5, 7, 2.3, 3.2, 0.7, '#9fb4c3'), boxAt(-10, roof, 5, 4, 1.8, 3, 0.72, '#8ea4b4'));
  Hm.push(boxAt(9, GL - 0.2, 0, 1.4, roof - GL + 0.4, 0.9, 0.08, '#5cc3cf'));
  for (let k = 1; k < LV.length - 1; k++) {
    const y = LV[k + 1] - 1.15, dl = lvlDelay(k);
    Hm.push(boxAt(-3, y, -4.3, 22, 0.42, 1.0, dl, '#5cc3cf'));
    for (const x of [-11.25, -3.75, 3.75]) { Hm.push(boxAt(x, y, 0.6, 0.55, 0.32, 9.2, dl + 0.04, '#5cc3cf'), boxAt(x, y, -7.4, 0.55, 0.32, 5.2, dl + 0.04, '#5cc3cf')); for (const z of [-8.5, 4.5]) diff.push(boxAt(x, y - 0.06, z, 0.6, 0.06, 0.6, dl + 0.07, '#d8f3f6')); }
  }
  inst('hvac', boxG, mat(0xffffff, { rough: 0.45, metal: 0.25 }), Hm); inst('hvac', boxG, mat(0xffffff, { rough: 0.5 }), diff, false);

  /* electrical: transformer, trench, LV panel, generator, riser tray, floor boards, trays, lighting, rooftop PV */
  const E = [], lights = [], pv = [];
  const xfx = 30, xfz = 14, xfy = padH(xfx, xfz);
  E.push(boxAt(xfx, xfy, xfz, 2.6, 2.2, 2.0, 0.02, '#7d8c7a'), boxAt(xfx - 3.2, xfy, xfz, 1.4, 1.8, 0.8, 0.04, '#c9c4b8'));
  E.push(boxAt(11.5, B1, 7.6, 3.2, 2.0, 0.7, 0.05, '#f2b632'), boxAt(-2.5, B1, 7.2, 3.0, 1.6, 1.6, 0.06, '#b9b1a0'));
  E.push(boxAt(13.2, B1 + 0.2, 1.8, 0.5, roof - B1 + 0.6, 0.12, 0.08, '#f2b632'));
  for (let k = 1; k < LV.length - 1; k++) {
    const y = LV[k + 1] - 0.7, dl = lvlDelay(k);
    E.push(boxAt(13.0, LV[k] + 0.8, 3.0, 0.9, 1.3, 0.25, dl, '#f2b632'));
    E.push(boxAt(-0.5, y, 3.9, 27, 0.16, 0.6, dl + 0.03, '#f2b632'));
    for (let x = -13.1; x <= 13.2; x += 3.75) for (let z = -8.4; z <= 8.5; z += 3.36) lights.push(boxAt(x, LV[k + 1] - 0.32, z, 1.4, 0.08, 0.45, dl + 0.06, '#fff6d6'));
  }
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.32);
  for (let x = -13; x <= 4; x += 2.1) for (let z = -8.5; z <= 0.5; z += 1.7) if (!(x > -11 && x < -3.5 && z < -3)) pv.push({ p: [x, roof + 0.5, z], q, s: [2, 0.06, 1.1], d: 0.72 + (x + 13) / 60, c: '#1e3555' });
  inst('elec', boxG, mat(0xffffff, { rough: 0.55 }), E); inst('elec', boxG, mat(0xffffff, { rough: 0.3, emissive: '#fff2c4', ei: 0.9 }), lights, false); inst('elec', boxG, mat(0xffffff, { rough: 0.25, metal: 0.4 }), pv);
  // underground feeder from transformer to LV panel
  const feeder = [[xfx - 1.5, xfy - 0.6, xfz], [17.5, padH(17.5, xfz) - 0.6, xfz], [17.5, B1 + 1.2, 7.6], [13.1, B1 + 1.2, 7.6]];
  const feederLine = (() => { const v = []; for (let k = 0; k < feeder.length - 1; k++) v.push(...feeder[k], ...feeder[k + 1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xf2b632, transparent: true, opacity: 0 })); groups.elec.add(m); return m; })();

  /* IoT: room sensors, strain gauges, meters, gateway, links */
  const S = [], links = [], hubs = [];
  const gw = [11.25, roof + 3.8, 0];
  for (let k = 1; k < LV.length - 1; k++) {
    const y = LV[k + 1] - 0.4, hub = [12.6, LV[k] + 2.4, -2.6]; hubs.push(hub);
    for (const [x, z] of [[-11, -6], [-11, 6], [-3.5, -6], [-3.5, 6], [3.7, -6], [3.7, 6]]) { S.push({ p: [x, y, z], s: [0.38, 0.38, 0.38], d: lvlDelay(k), c: '#7cf3ff' }); links.push([x, y, z], hub); }
    links.push(hub, k === LV.length - 2 ? gw : [12.6, LV[k + 1] + 2.4, -2.6]);
  }
  xs.forEach((x) => [-10, 10].forEach((z) => { S.push({ p: [x, GL + 1.4, z + Math.sign(-z) * 0.4], s: [0.32, 0.32, 0.32], d: 0.1, c: '#ffc66d' }); links.push([x, GL + 1.4, z], [12.6, GL + 2.4, -2.6]); }));
  S.push({ p: [rx + 0.25, LV[2] + 1, rz], s: [0.16, 0.16, 0.16], d: 0.2, c: '#7cf3ff' }, { p: [13.0, LV[2] + 1.6, 3.2], s: [0.16, 0.16, 0.16], d: 0.2, c: '#ffc66d' });
  const iotMat = mat(0xffffff, { emissive: '#7cf3ff', ei: 1.4, rough: 0.3 });
  inst('iot', sphG, iotMat, S, false);
  inst('iot', cylG, mat(0xe7edf2, { rough: 0.4 }), [{ p: [gw[0], roof + 3, gw[2]], s: [0.07, 0.9, 0.07], d: 0.5 }, { p: [gw[0], gw[1], gw[2]], s: [0.22, 0.12, 0.22], d: 0.55 }]);
  const linkLines = (() => { const v = []; for (let k = 0; k < links.length; k += 2) v.push(...links[k], ...links[k + 1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x7cf3ff, transparent: true, opacity: 0 })); groups.iot.add(m); return m; })();
  // travelling pulses (data up to the gateway, power along the feeder and riser)
  const pulseG = new THREE.SphereGeometry(0.32, 8, 6);
  const dataPulse = new THREE.InstancedMesh(pulseG, new THREE.MeshBasicMaterial({ color: 0xbaf8ff, transparent: true }), 10); groups.iot.add(dataPulse); dataPulse.frustumCulled = false;
  const powerPulse = new THREE.InstancedMesh(pulseG, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true }), 12); groups.elec.add(powerPulse); powerPulse.frustumCulled = false;
  const powerPath = [...feeder, [13.2, B1 + 1.2, 1.8], [13.2, roof + 0.4, 1.8]];
  const dataPath = [[12.6, LV[1] + 2.4, -2.6], [12.6, LV[LV.length - 2] + 2.4, -2.6], gw];
  function along(path, t) {
    const seg = []; let tot = 0; for (let k = 0; k < path.length - 1; k++) { const l = Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1], path[k + 1][2] - path[k][2]); seg.push(l); tot += l; }
    let d = t * tot; for (let k = 0; k < seg.length; k++) { if (d <= seg[k]) { const f = d / seg[k]; return path[k].map((v, c) => v + (path[k + 1][c] - v) * f); } d -= seg[k]; } return path[path.length - 1];
  }

  /* envelope: curtain wall per storey, mullions, parapet */
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9cc3dd, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const envGroup = groups.env;
  const mull = [];
  for (let k = 1; k < LV.length - 1; k++) {
    const y0 = LV[k], h = LV[k + 1] - LV[k] - 0.2, ym = y0 + h / 2;
    for (const [w, x, z, ry] of [[BX + 0.6, 0, HZ + 0.32, 0], [BX + 0.6, 0, -HZ - 0.32, 0], [BZ + 0.6, HB + 0.32, 0, Math.PI / 2], [BZ + 0.6, -HB - 0.32, 0, Math.PI / 2]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); pl.position.set(x, ym, z); pl.rotation.y = ry; pl.renderOrder = 5; envGroup.add(pl);
    }
    for (let x = -15.3; x <= 15.31; x += 1.53) for (const z of [HZ + 0.34, -HZ - 0.34]) mull.push(x, y0, z, x, y0 + h, z);
    for (let z = -10.3; z <= 10.31; z += 1.47) for (const x of [HB + 0.34, -HB - 0.34]) mull.push(x, y0, z, x, y0 + h, z);
  }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mull, 3));
  const mullions = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ color: 0x3a4b5c, transparent: true, opacity: 0 })); envGroup.add(mullions);
  inst('env', boxG, mat(0xbfb9ae, { rough: 0.8 }), [boxAt(0, roof, -HZ - 0.15, BX + 0.6, 1.1, 0.25, 0.9), boxAt(0, roof, HZ + 0.15, BX + 0.6, 1.1, 0.25, 0.9), boxAt(-HB - 0.15, roof, 0, 0.25, 1.1, BZ + 0.6, 0.9), boxAt(HB + 0.15, roof, 0, 0.25, 1.1, BZ + 0.6, 0.9)]);

  /* survey points */
  const svy = []; for (let x = -60; x <= 60; x += 10) for (let z = -45; z <= 45; z += 10) svy.push({ p: [x, natural(x, z), z], s: [0.35, 1.2, 0.35], d: ((x + 60) / 120) * 0.8, c: '#ffd166' });
  const surveyMat = mat(0xffffff, { rough: 0.4, emissive: '#ffd166', ei: 0.4 });
  const surveyMesh = inst('terrain', new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), surveyMat, svy, false);
  void surveyMesh;

  /* lights */
  scene.add(new THREE.HemisphereLight(0xdde8f4, 0x4a4234, 1.05));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(-60, 90, 55); sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(capture ? 4096 : 2048, capture ? 4096 : 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 50, bottom: -50, near: 10, far: 300 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun);

  /* pins */
  const anchors = { slope: [-38, natural(-38, -30), -30], survey: [40, natural(40, -35), -35], pit: [0, PIT, 0], batter: [-HB - PAD - 2, cutH(-HB - PAD - 2, 6), 6],
    footing: [-7.5, PIT + 0.8, 10 / 3], pcc: [7.5, PIT + 0.1, -10], column: [-15, LV[3], 10], wall: [-HB, B1 + 2, -HZ], core: [11.25, coreTop, 0], slab: [-7.5, LV[2], -3],
    riser: [rx, LV[4], rz], sprink: [-11.25, LV[3] - 0.55, 9], tank: [-7, roof + 2.2, -5], ahu: [-1, roof + 2.3, 4.5], duct: [-12, LV[3] - 1.15, -4.3],
    xfmr: [xfx, xfy + 2.2, xfz], lv: [11.5, B1 + 2, 7.6], pv: [-8, roof + 0.8, -1.5], tray: [-10, LV[4] - 0.7, 3.9], gateway: gw, strain: [-15, GL + 1.4, 10], room: [-11, LV[3] - 0.4, 6] };
  const pinEls = [];
  if (labelsEl) { labelsEl.innerHTML = ''; for (const d of PIN_DEFS) { const el = document.createElement('div'); el.className = 'tc-pin'; el.innerHTML = '<span>' + d.t + '</span>'; labelsEl.appendChild(el); pinEls.push({ d, el }); } }

  /* ---------------- state ---------------- */
  const keys = Object.keys(Z);
  let explore = null; // Set of system keys when exploring
  function stateAt(s) {
    const n = STAGES.length, i = Math.floor(s) % n, f = s - Math.floor(s), prev = (i + n - 1) % n;
    const e0 = clamp01(f / 0.6), e = e0 * e0 * (3 - 2 * e0), o = { stage: i, enter: e };
    for (const k of keys) o[k] = lerp(K[prev][k], K[i][k], e);
    return o;
  }
  function opac(sys, v) { (meshesOf[sys] || []).forEach((m) => { m.opacity = v; m.depthWrite = v > 0.98; }); groups[sys].visible = v > 0.01; }
  function grow(sys, v) { (meshesOf[sys] || []).forEach((m) => (m.userData.u.uGrow.value = v)); }
  function apply(st, t) {
    let V;
    if (explore) {
      const on = (k) => (explore.has(k) ? 1 : 0), mep = ['plumb', 'fire', 'hvac', 'elec', 'iot', 'rebar'].some((k) => explore.has(k));
      V = { contours: 0, survey: 0, cut: 1, fill: 1, found: on('found'), struct: 1, structOp: explore.has('struct') ? (mep ? 0.35 : 1) : mep ? 0.12 : 0, rebar: on('rebar'), plumb: on('plumb'), fire: on('fire'), hvac: on('hvac'), elec: on('elec'), iot: on('iot'), env: on('env'), terrain: on('terrain') };
      V.foundOp = V.found ? 1 : 0;
    } else {
      V = { ...st, terrain: 1, structOp: 1 - 0.85 * st.ghost, foundOp: st.found > 0 ? 1 - 0.6 * st.ghost : 0 };
    }
    setTerrain(V.cut, V.fill);
    terrain.visible = V.terrain > 0.5; terrain.userData.skirt.visible = terrain.visible; groups.terrain.visible = V.survey > 0.01;
    contours.material.opacity = V.contours * 0.8; contours.visible = V.contours > 0.01;
    opac('terrain', V.survey); grow('terrain', V.survey);
    grow('found', V.found); opac('found', V.foundOp);
    grow('struct', V.struct); opac('struct', V.struct > 0 ? V.structOp : 0);
    rebar.material.opacity = V.rebar; groups.rebar.visible = V.rebar > 0.01;
    const OWN = { plumb: 5, fire: 5, hvac: 6, elec: 7, iot: 8 };
    for (const k of ['plumb', 'fire', 'hvac', 'elec', 'iot']) {
      const g = explore ? V[k] : st.stage === 0 ? 1 : OWN[k] < st.stage ? 1 : OWN[k] === st.stage ? st.enter : 0;
      grow(k, g); opac(k, V[k]);
    }
    feederLine.material.opacity = V.elec; linkLines.material.opacity = V.iot * (0.65 + 0.3 * Math.sin(t * 3));
    glassMat.opacity = 0.32 * V.env; mullions.material.opacity = 0.9 * V.env; opac('env', V.env); groups.env.visible = V.env > 0.01;
    iotMat.emissiveIntensity = 1.0 + 0.8 * Math.sin(t * 4);
    // pulses
    const o3 = new THREE.Object3D();
    for (let k = 0; k < 12; k++) { const p = along(powerPath, ((t * 0.18 + k / 12) % 1)); o3.position.set(...p); o3.scale.setScalar(V.elec > 0.3 ? 1 : 0.0001); o3.updateMatrix(); powerPulse.setMatrixAt(k, o3.matrix); }
    powerPulse.instanceMatrix.needsUpdate = true; powerPulse.material.opacity = V.elec;
    for (let k = 0; k < 10; k++) { const p = along(dataPath, ((t * 0.25 + k / 10) % 1)); o3.position.set(...p); o3.scale.setScalar(V.iot > 0.3 ? 1 : 0.0001); o3.updateMatrix(); dataPulse.setMatrixAt(k, o3.matrix); }
    dataPulse.instanceMatrix.needsUpdate = true; dataPulse.material.opacity = V.iot;
  }

  /* ---------------- camera ---------------- */
  const target = new THREE.Vector3(0, GL + 2.5, 0);
  let az = 0.78, el = 0.42, dist = 92, userAz = 0, userEl = 0, userUntil = 0, W = 1, H = 1;
  function resize() { const r = canvas.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); renderer.setSize(W, H, false); camera.aspect = W / H; dist = (W / H < 1.1 ? 112 : W / H < 1.5 ? 92 : 80) * (opts.zoom || 1); camera.updateProjectionMatrix(); }
  function placeCamera(t, now) {
    const auto = capture ? 0 : (now > userUntil ? 1 : 0);
    if (auto) userAz += 0.0006;
    const a = az + userAz + (capture ? 0 : Math.sin(t * 0.07) * 0.08), e = Math.min(1.25, Math.max(0.12, el + userEl));
    camera.position.set(target.x + Math.sin(a) * Math.cos(e) * dist, target.y + Math.sin(e) * dist, target.z + Math.cos(a) * Math.cos(e) * dist); camera.lookAt(target);
  }
  // drag to orbit (vertical page scroll still works on touch)
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: userAz, el: userEl }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; userAz = drag.az - (e.clientX - drag.x) * 0.006; if (e.pointerType === 'mouse') userEl = Math.max(-0.3, Math.min(0.6, drag.el + (e.clientY - drag.y) * 0.004)); userUntil = performance.now() + 6000; if (!raf) renderAt(s); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  const v3 = new THREE.Vector3();
  function updatePins(st) {
    for (const p of pinEls) {
      const on = explore ? 0 : (p.d.s.includes(st.stage) ? st.enter : 0);
      const a = anchors[p.d.at]; if (!a || on < 0.05) { p.el.style.opacity = 0; continue; }
      v3.set(a[0], a[1], a[2]).project(camera);
      const sx = (v3.x * 0.5 + 0.5) * W, sy = (-v3.y * 0.5 + 0.5) * H, vis = v3.z < 1 && sx > 20 && sx < W - 20 && sy > 50 && sy < H - 60;
      p.el.style.opacity = vis ? on : 0; p.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
  }

  let raf = 0, playing = false, s = 0, last = 0, time = 0, lastStage = -1;
  const onStage = opts.onStage || (() => {}), SPEED = 1 / (opts.stageSeconds || 7);
  function renderAt(sv, t) {
    const st = stateAt(sv); apply(st, t ?? time); placeCamera(t ?? time, performance.now()); renderer.render(scene, camera); updatePins(st);
    if (st.stage !== lastStage && !explore) { lastStage = st.stage; onStage(st.stage, STAGES[st.stage]); }
    return st;
  }
  function frame(now) { raf = requestAnimationFrame(frame); const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; time += dt; if (playing && !explore) s = (s + dt * SPEED) % STAGES.length; renderAt(s); }
  resize(); const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { resize(); if (!raf) renderAt(s); }) : null; if (ro) ro.observe(canvas);

  return {
    stages: STAGES, systems: SYSTEMS,
    play() { if (playing && raf) return; playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    pause() { playing = false; },
    stopLoop() { cancelAnimationFrame(raf); raf = 0; },
    resumeLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    get playing() { return playing; },
    setStage(i) { explore = null; s = i; lastStage = -1; if (!raf) renderAt(s); },
    explore(set) { explore = set && set.size ? new Set(set) : null; lastStage = -1; if (!raf) renderAt(s); },
    get exploring() { return !!explore; },
    renderAt, resize,
    dispose() { cancelAnimationFrame(raf); if (ro) ro.disconnect(); renderer.dispose(); },
  };
}
