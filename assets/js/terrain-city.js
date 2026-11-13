/* Terrain-to-city: an illustrative, procedurally generated landscape that is
   progressively engineered into a planned town. Every dimension is an
   illustrative assumption, not survey data or a regulatory standard.
   One seed, one terrain, one camera for all twelve stages. */
import * as THREE from './vendor/three.module.min.js';

/* ------------------------------------------------------------------ */
/* Illustrative parameters (metres)                                    */
/* ------------------------------------------------------------------ */
export const P = {
  W: 2000, D: 1400,            // landscape extent
  riverSetback: 50,            // river setback buffer
  forestBuffer: 30,            // forest conservation buffer
  maxSlope: 15,                // development limit (degrees)
  terrace: 5,                  // platform step height
  contour: 5,                  // contour interval
  roadW: { arterial: 14, collector: 9, local: 6 },
  lot: 34,                     // lot frontage
};

export const STAGES = [
  { key: 'terrain',   label: 'Natural terrain',              short: 'Terrain' },
  { key: 'imagery',   label: 'Satellite imagery',            short: 'Imagery' },
  { key: 'dtm',       label: '3D DTM from LiDAR',            short: 'DTM' },
  { key: 'elevation', label: 'Elevation, hillshade and contours', short: 'Elevation' },
  { key: 'slope',     label: 'Slope analysis',               short: 'Slope' },
  { key: 'grading',   label: 'Site grading: cut and fill',   short: 'Grading' },
  { key: 'roads',     label: 'Road hierarchy',               short: 'Roads' },
  { key: 'drainage',  label: 'Stormwater drainage',          short: 'Drainage' },
  { key: 'buffers',   label: 'River and forest buffers',     short: 'Buffers' },
  { key: 'plots',     label: 'Land subdivision',             short: 'Plots' },
  { key: 'build',     label: 'Construction',                 short: 'Construction' },
  { key: 'city',      label: 'Planned city',                 short: 'City' },
];

const LEGENDS = [
  [['#2f5d34', 'Forest'], ['#a9b97a', 'Grassland and farmland'], ['#4f8fae', 'River']],
  [['#2f5d34', 'Forest canopy'], ['#c2b56f', 'Cultivated fields'], ['#4f8fae', 'River channel']],
  [['#67e3f0', 'DTM mesh'], ['#ffd166', 'LiDAR swath']],
  [['#2e7d4f', 'Low'], ['#d8c86a', 'Mid'], ['#a1663a', 'High'], ['#3b3b3b', 'Contour (5 m)*']],
  [['#2e7d4f', '0–5°'], ['#9cc96b', '5–10°'], ['#f2d15c', '10–15°'], ['#ef8a3c', '15–25°'], ['#c7372f', '> 25°']],
  [['#d9534f', 'Cut'], ['#3d7cc9', 'Fill'], ['#e8e2d4', 'Retaining wall']],
  [['#c0392b', 'Arterial 14 m*'], ['#f39c12', 'Collector 9 m*'], ['#f7f1e3', 'Local 6 m*']],
  [['#2c9be0', 'Roadside drain'], ['#76d4f5', 'Natural channel'], ['#1b4f72', 'Culvert'], ['#4f8fae', 'Detention pond']],
  [['#3fae6a', 'River setback 50 m*'], ['#1f7a5a', 'Forest buffer 30 m*']],
  [['#f4d35e', 'Residential'], ['#e4572e', 'Commercial'], ['#4c7bd9', 'Institutional'], ['#5fb36b', 'Open space']],
  [['#f1e6d0', 'Housing'], ['#9db4c9', 'Commercial blocks'], ['#c9d6e8', 'Public buildings'], ['#5fb36b', 'Parks']],
  [['#3fae6a', 'Protected green'], ['#c0392b', 'Arterial road'], ['#4f8fae', 'River']],
];
export const legendFor = (i) => LEGENDS[i];

/* Per-stage targets. Values interpolate smoothly between stages. */
// tex: satellite, elevation, slope, cutfill, site, urban
const T = (sat, el, sl, cf, si, ur) => [sat, el, sl, cf, si, ur];
const K = [
  { tex: T(1,0,0,0,0,0), grade:0, wire:0, lidar:0, cont:0, walls:0, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:1, forest:1, gold:0.15 },
  { tex: T(1,0,0,0,0,0), grade:0, wire:0, lidar:0, cont:0, walls:0, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0.0, forest:0.0, gold:0 },
  { tex: T(1,0,0,0,0,0), grade:0, wire:1, lidar:1, cont:0, walls:0, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:0, gold:0 },
  { tex: T(0,1,0,0,0,0), grade:0, wire:0, lidar:0, cont:1, walls:0, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:0, gold:0 },
  { tex: T(0,0,1,0,0,0), grade:0, wire:0, lidar:0, cont:0.45, walls:0, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:0, gold:0 },
  { tex: T(0,0,0,1,0,0), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:0, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:1, gold:0 },
  { tex: T(0,0,0,0,1,0), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:0, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:1, gold:0 },
  { tex: T(0,0,0,0,1,0), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:1, buf:0, plots:0, bld:0, park:0, natTrees:0, forest:1, gold:0 },
  { tex: T(0,0,0,0,1,0), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:0.35, buf:1, plots:0, bld:0, park:0, natTrees:0, forest:1, gold:0 },
  { tex: T(0,0,0,0,1,0), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:0, buf:0.45, plots:1, bld:0, park:0, natTrees:0, forest:1, gold:0 },
  { tex: T(0,0,0,0,0.35,0.65), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:0, buf:0.25, plots:0.35, bld:1, park:1, natTrees:0, forest:1, gold:0.3 },
  { tex: T(0,0,0,0,0,1), grade:1, wire:0, lidar:0, cont:0, walls:1, roads:1, drains:0, buf:0.18, plots:0, bld:1, park:1, natTrees:0, forest:1, gold:1 },
];
// Stage 2 (imagery) keeps trees hidden so the satellite texture reads as imagery.
K[1].natTrees = 0; K[1].forest = 0;

/* Pins: [stage indices, label, world-anchor resolver] — resolved after build. */
const PIN_DEFS = [
  { s: [0], t: 'Ridge', at: 'ridge' }, { s: [0], t: 'River', at: 'river' }, { s: [0], t: 'Forest', at: 'forestN' }, { s: [0], t: 'Valley floor', at: 'valley' },
  { s: [1], t: 'Cultivated fields', at: 'valley' }, { s: [1], t: 'Riparian strip', at: 'river' },
  { s: [2], t: 'DTM mesh*', at: 'ridge' }, { s: [2], t: 'LiDAR swath', at: 'lidar' },
  { s: [3], t: 'Contour interval 5 m*', at: 'slopeN' }, { s: [3], t: 'Highest ground', at: 'ridge' },
  { s: [4], t: 'Slope > 15° excluded*', at: 'steep' }, { s: [4], t: 'Gentle valley floor', at: 'valley' },
  { s: [5], t: 'Cut', at: 'cut' }, { s: [5], t: 'Fill', at: 'fill' }, { s: [5], t: 'Retaining wall, 5 m steps*', at: 'wall' },
  { s: [6], t: 'Arterial 14 m*', at: 'arterial' }, { s: [6], t: 'Collector 9 m*', at: 'collector' }, { s: [6], t: 'Bridge', at: 'bridge' },
  { s: [7], t: 'Culvert', at: 'culvert' }, { s: [7], t: 'Detention pond', at: 'pond' }, { s: [7], t: 'Natural channel', at: 'channel' },
  { s: [8], t: 'River setback 50 m*', at: 'setback' }, { s: [8], t: 'Forest buffer 30 m*', at: 'fbuffer' },
  { s: [9], t: 'Residential', at: 'res' }, { s: [9], t: 'Commercial', at: 'com' }, { s: [9], t: 'Institutional', at: 'inst' }, { s: [9], t: 'Open space', at: 'park' },
  { s: [10], t: 'Water reservoir', at: 'tank' }, { s: [10], t: 'Neighbourhood park', at: 'park' },
  { s: [11], t: 'Protected river corridor', at: 'setback' }, { s: [11], t: 'Town centre', at: 'com' },
];

/* ------------------------------------------------------------------ */
/* Noise                                                               */
/* ------------------------------------------------------------------ */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + 17.3 * i, y * f - 9.1 * i); n += a; a *= 0.5; f *= 2.03; } return s / n; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ */
/* Landscape                                                           */
/* ------------------------------------------------------------------ */
export const riverZ = (x) => 245 + 70 * Math.sin(x / 390 + 0.6) + 28 * Math.sin(x / 150 + 2.1);
const riverHW = (x) => 15 + 4 * Math.sin(x / 210);
function naturalH(x, z) {
  const d = z - riverZ(x), dn = Math.max(0, -d), ds = Math.max(0, d), ad = Math.abs(d);
  let h = 300 - 0.028 * x;
  h += 0.075 * dn + 0.05 * ds;
  h += 105 * sstep(380, 900, dn) + 22 * sstep(160, 460, ds);
  h += (fbm(x / 430 + 3, z / 430 - 2) - 0.5) * 46 * sstep(70, 280, ad);
  h += (fbm(x / 120, z / 120) - 0.5) * 8 * sstep(30, 120, ad);
  const hw = riverHW(x);
  h -= 7.5 * Math.exp(-Math.pow(d / (hw * 1.25), 2));
  return h;
}
function isForest(x, z) {
  const d = z - riverZ(x), dn = -d, n = fbm(x / 260 + 11, z / 260 + 5);
  if (dn > 470 + 90 * (n - 0.5)) return true;
  if (d > 300 + 60 * (n - 0.5)) return true;
  if (Math.abs(d) > 150 && fbm(x / 160 - 7, z / 160 + 3) > 0.72) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Main factory                                                        */
/* ------------------------------------------------------------------ */
export function createTerrainCity(opts) {
  const mode = opts.mode || 'viewer';           // 'hero' | 'viewer' | 'capture'
  const canvas = opts.canvas, labelsEl = opts.labels || null;
  const small = opts.quality === 'low';
  const capture = mode === 'capture';
  const NX = capture ? 300 : small ? 150 : 230, NZ = Math.round(NX * P.D / P.W);
  const TW = capture ? 2048 : small ? 1024 : 1536, TH = Math.round(TW * P.D / P.W);
  const rnd = mulberry32(20261113);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !capture || !!opts.transparent, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, capture ? 1 : (opts.maxDpr || (small ? 1.25 : 1.75))));
  if (opts.transparent) renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(opts.background || '#e9eef2');
  if (capture && !opts.transparent) scene.background = skyTexture();
  scene.fog = new THREE.Fog(bg, 2600, 5200);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 10, 9000);
  const camBase = { az: 0.30, el: 0.43, dist: 2150, target: new THREE.Vector3(-30, 325, 20) };

  /* ---------------- grids ---------------- */
  const N = (NX + 1) * (NZ + 1);
  const gx = (i) => -P.W / 2 + (i / NX) * P.W, gz = (j) => -P.D / 2 + (j / NZ) * P.D;
  const hN = new Float32Array(N), hG = new Float32Array(N), slope = new Float32Array(N), forest = new Uint8Array(N), fdist = new Float32Array(N), dev = new Float32Array(N);
  const id = (i, j) => j * (NX + 1) + i;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = gx(i), z = gz(j); hN[id(i, j)] = naturalH(x, z); forest[id(i, j)] = isForest(x, z) ? 1 : 0; }
  const cell = P.W / NX;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(NX, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(NZ, j + 1);
    const dx = (hN[id(i1, j)] - hN[id(i0, j)]) / ((i1 - i0) * cell), dz = (hN[id(i, j1)] - hN[id(i, j0)]) / ((j1 - j0) * cell);
    slope[id(i, j)] = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  }
  // chamfer distance to forest (metres)
  for (let k = 0; k < N; k++) fdist[k] = forest[k] ? 0 : 1e9;
  const a1 = cell, a2 = cell * Math.SQRT2;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { let v = fdist[id(i, j)]; if (i > 0) v = Math.min(v, fdist[id(i - 1, j)] + a1); if (j > 0) { v = Math.min(v, fdist[id(i, j - 1)] + a1); if (i > 0) v = Math.min(v, fdist[id(i - 1, j - 1)] + a2); if (i < NX) v = Math.min(v, fdist[id(i + 1, j - 1)] + a2); } fdist[id(i, j)] = v; }
  for (let j = NZ; j >= 0; j--) for (let i = NX; i >= 0; i--) { let v = fdist[id(i, j)]; if (i < NX) v = Math.min(v, fdist[id(i + 1, j)] + a1); if (j < NZ) { v = Math.min(v, fdist[id(i, j + 1)] + a1); if (i < NX) v = Math.min(v, fdist[id(i + 1, j + 1)] + a2); if (i > 0) v = Math.min(v, fdist[id(i - 1, j + 1)] + a2); } fdist[id(i, j)] = v; }
  // developable mask (before smoothing)
  const devRaw = new Float32Array(N);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = gx(i), z = gz(j), k = id(i, j), ad = Math.abs(z - riverZ(x));
    const ok = !forest[k] && fdist[k] > P.forestBuffer && ad > P.riverSetback && slope[k] < P.maxSlope && Math.abs(x) < 930 && z > -660 && z < 660;
    devRaw[k] = ok ? 1 : 0;
  }
  // smooth mask (box blur x2)
  const tmp = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? dev : devRaw, dst = pass ? tmp : dev;
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { let s = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii > NX || jj > NZ) continue; s += src[id(ii, jj)]; c++; } dst[id(i, j)] = s / c; }
    if (pass) dev.set(tmp);
  }
  hG.set(hN); // graded surface is computed once roads and plots are laid out

  const sample = (arr, x, z) => {
    const fi = Math.min(NX - 1e-6, Math.max(0, (x + P.W / 2) / P.W * NX)), fj = Math.min(NZ - 1e-6, Math.max(0, (z + P.D / 2) / P.D * NZ));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    return lerp(lerp(arr[id(i, j)], arr[id(i + 1, j)], u), lerp(arr[id(i, j + 1)], arr[id(i + 1, j + 1)], u), v);
  };
  const hAtG = (x, z) => sample(hG, x, z), hAtN = (x, z) => sample(hN, x, z);
  const devAt = (x, z) => sample(devRaw, x, z);

  /* ---------------- roads ---------------- */
  const roads = { arterial: [], collector: [], local: [] };
  const arterial = []; for (let x = -1000; x <= 1000; x += 8) arterial.push([x, riverZ(x) - 95]);
  roads.arterial.push(arterial);
  const southRoad = []; for (let x = -470; x <= 330; x += 8) southRoad.push([x, riverZ(x) + 112]);
  roads.collector.push(southRoad);
  // bridge collector crossing the river at x = -120
  const bx = -120, bridge = []; for (let z = riverZ(bx) - 95; z <= riverZ(bx) + 112; z += 6) bridge.push([bx, z]);
  roads.collector.push(bridge);
  // contour-following collectors on the north slope: constant gentle grade, bend with the terrain
  const collectorV = [];
  for (const off of [205, 320]) {
    const xs = []; for (let x = -880; x <= 880; x += 8) xs.push(x);
    const prof = xs.map((x) => hAtN(x, riverZ(x) - off));
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, mh = prof.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0; xs.forEach((x, k) => { sxy += (x - mx) * (prof[k] - mh); sxx += (x - mx) ** 2; });
    const b = sxy / sxx, a = mh - b * mx;
    const line = [], vline = [];
    xs.forEach((x) => {
      const L = a + b * x; let lo = riverZ(x) - (off + 85), hi = riverZ(x) - (off - 70);
      for (let it = 0; it < 26; it++) { const m = (lo + hi) / 2; if (hAtN(x, m) > L) lo = m; else hi = m; }
      line.push([x, (lo + hi) / 2]);
    });
    // smooth the path
    for (let pass = 0; pass < 6; pass++) for (let k = 1; k < line.length - 1; k++) line[k][1] = (line[k - 1][1] + 2 * line[k][1] + line[k + 1][1]) / 4;
    line.forEach(([x, z]) => vline.push(riverZ(x) - z));
    roads.collector.push(line); collectorV.push(vline);
  }
  // local connectors between arterial and collectors
  const localU = [-770, -590, -410, -230, -50, 130, 310, 490, 670, 830];
  for (const x0 of localU) {
    const k = Math.round((x0 + 880) / 8);
    const v1 = collectorV[0][k], v2 = collectorV[1][k];
    const seg = []; for (let v = 95; v <= v2; v += 6) { const x = x0 + (v - 95) * 0.18; seg.push([x, riverZ(x) - v]); }
    if (seg.length > 2) roads.local.push(seg);
    void v1;
  }
  const roadPolys = [];
  for (const cls of ['arterial', 'collector', 'local']) for (const pl of roads[cls]) roadPolys.push({ cls, pl, w: P.roadW[cls] });
  function distToRoads(x, z) {
    let best = 1e9;
    for (const r of roadPolys) {
      const pl = r.pl;
      for (let k = 0; k < pl.length - 1; k++) {
        const [ax, az] = pl[k], [bx2, bz] = pl[k + 1];
        const vx = bx2 - ax, vz = bz - az, wx = x - ax, wz = z - az, L2 = vx * vx + vz * vz;
        const t = L2 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / L2)) : 0;
        const d = Math.hypot(wx - t * vx, wz - t * vz) - r.w / 2;
        if (d < best) best = d;
      }
    }
    return best;
  }

  /* ---------------- plots ---------------- */
  const plots = [];
  const vC = (x, which) => { const k = Math.max(0, Math.min(collectorV[0].length - 1, Math.round((x + 880) / 8))); return collectorV[which][k]; };
  function addBand(side, vFrom, vTo, x0, x1) {
    for (let u = x0; u < x1; u += P.lot) {
      const ua = u + 2, ub = u + P.lot - 2;
      const va = typeof vFrom === 'function' ? vFrom(u + P.lot / 2) : vFrom, vb = typeof vTo === 'function' ? vTo(u + P.lot / 2) : vTo;
      if (vb - va < 30) continue;
      const mid = (va + vb) / 2;
      for (const [r0, r1] of [[va, mid - 2], [mid + 2, vb]]) {
        if (r1 - r0 < 14) continue;
        const toZ = (x, v) => side > 0 ? riverZ(x) - v : riverZ(x) + v;
        const corners = [[ua, r0], [ub, r0], [ub, r1], [ua, r1]].map(([x, v]) => [x, toZ(x, v)]);
        const cx = (ua + ub) / 2, cz = toZ(cx, (r0 + r1) / 2);
        const okC = corners.every(([x, z]) => devAt(x, z) > 0.5) && devAt(cx, cz) > 0.5;
        if (!okC) continue;
        if (Math.min(...corners.map(([x, z]) => distToRoads(x, z)), distToRoads(cx, cz)) < 1.5) continue;
        const front = Math.abs(r0 - va) < 1;
        plots.push({ corners, cx, cz, side, front, band: 0, u: cx, v: (r0 + r1) / 2 });
      }
    }
  }
  addBand(1, 95 + 13, (x) => vC(x, 0) - 9, -900, 900);
  addBand(1, (x) => vC(x, 0) + 9, (x) => vC(x, 1) - 9, -880, 880);
  addBand(1, (x) => vC(x, 1) + 9, (x) => vC(x, 1) + 82, -880, 880);
  addBand(-1, P.riverSetback + 6, 112 - 10, -470, 330);
  addBand(-1, 112 + 10, 200, -470, 330);
  // land use
  plots.forEach((p, k) => {
    const nearArterial = p.side > 0 && p.v < 140, central = p.u > -420 && p.u < 380;
    if (p.side > 0 && p.u > -40 && p.u < 120 && p.v > 150 && p.v < 260) p.use = 'inst';
    else if ((p.u > 150 && p.u < 260 && p.side > 0 && p.v < 230) || (k % 11 === 5) || (p.side < 0 && p.v < 80)) p.use = 'park';
    else if (nearArterial && central) p.use = 'com';
    else if (p.side < 0 && p.v > 100 && p.u > -150 && p.u < 50) p.use = 'com';
    else p.use = 'res';
  });

  /* ---------------- grading: only the development footprint ---------------- */
  {
    const fc = document.createElement('canvas'); fc.width = NX + 1; fc.height = NZ + 1; const g = fc.getContext('2d');
    const toG = (x, z) => [(x + P.W / 2) / P.W * NX + 0.5, (z + P.D / 2) / P.D * NZ + 0.5];
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of plots) { g.beginPath(); p.corners.forEach(([x, z], k) => { const [a, b] = toG(x, z); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill(); g.lineWidth = 10 / cell; g.stroke(); }
    for (const r of roadPolys) { g.beginPath(); r.pl.forEach(([x, z], k) => { const [a, b] = toG(x, z); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.lineWidth = (r.w + 14) / cell; g.stroke(); }
    const px = g.getImageData(0, 0, NX + 1, NZ + 1).data;
    for (let k = 0; k < N; k++) devRaw[k] = px[k * 4] / 255;
    const t2 = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) { const src = pass ? t2 : devRaw, dst = pass ? dev : t2; for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { let sm = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii > NX || jj > NZ) continue; sm += src[id(ii, jj)]; c++; } dst[id(i, j)] = sm / c; } }
    for (let k = 0; k < N; k++) { const m = sstep(0.15, 0.85, dev[k]); dev[k] = m; const q = Math.round(hN[k] / P.terrace) * P.terrace; hG[k] = hN[k] + m * (q - hN[k]); }
  }

  /* ---------------- drainage ---------------- */
  function trace(x, z, surf) {
    const pts = [[x, z]];
    for (let s = 0; s < 400; s++) {
      const e = 6, h = surf(x, z), gxv = (surf(x + e, z) - surf(x - e, z)) / (2 * e), gzv = (surf(x, z + e) - surf(x, z - e)) / (2 * e);
      const g = Math.hypot(gxv, gzv) || 1e-6;
      // bias toward the river so flat platforms still drain
      const toR = Math.sign(riverZ(x) - z);
      let dx = -gxv / g, dz = -gzv / g; dz = dz * 0.6 + toR * 0.4; const n = Math.hypot(dx, dz); dx /= n; dz /= n;
      x += dx * 8; z += dz * 8; pts.push([x, z]);
      if (Math.abs(z - riverZ(x)) < riverHW(x)) break;
      void h;
    }
    return pts;
  }
  const drains = [], channels = [];
  for (const x0 of [-700, -470, -250, -60, 140, 330, 520, 720]) {
    const k = Math.round((x0 + 880) / 8); drains.push(trace(x0, riverZ(x0) - collectorV[1][k] - 40, hAtG));
  }
  for (const x0 of [-610, -150, 420, 840]) channels.push(trace(x0, riverZ(x0) - 640, hAtN));
  channels.push(trace(-300, riverZ(-300) + 400, hAtN)); channels.push(trace(560, riverZ(560) + 380, hAtN));
  // roadside drains: offset arterial and collectors
  const roadside = [];
  for (const r of [roads.arterial[0], roads.collector[2], roads.collector[3]]) {
    const off = []; for (let k = 0; k < r.length; k++) { const [x, z] = r[k]; const [x2, z2] = r[Math.min(r.length - 1, k + 1)], [x1, z1] = r[Math.max(0, k - 1)]; const tx = x2 - x1, tz = z2 - z1, L = Math.hypot(tx, tz) || 1; off.push([x - tz / L * 10, z + tx / L * 10]); }
    roadside.push(off);
  }
  // culverts: drain crossing the arterial
  const culverts = [];
  for (const d of drains) for (const [x, z] of d) { if (Math.abs(z - (riverZ(x) - 95)) < 5) { culverts.push([x, z]); break; } }
  const ponds = drains.filter((_, k) => k % 3 === 1).map((d) => { const p = d.find(([x, z]) => Math.abs(z - riverZ(x)) < P.riverSetback + 26); return p || d[d.length - 1]; });

  /* ---------------- textures ---------------- */
  const texCanvas = () => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; };
  const pxToWorld = (px, py) => [-P.W / 2 + (px + 0.5) / TW * P.W, -P.D / 2 + (py + 0.5) / TH * P.D];
  const imgs = { sat: texCanvas(), elev: texCanvas(), slope: texCanvas(), cut: texCanvas(), site: texCanvas(), urban: texCanvas(), buf: texCanvas(), plots: texCanvas() };
  const ctx = {}; for (const k in imgs) ctx[k] = imgs[k].getContext('2d');
  const data = {}; for (const k in imgs) data[k] = ctx[k].createImageData(TW, TH);
  const sun = new THREE.Vector3(-0.55, 0.62, 0.35).normalize();
  const shade = (arr, x, z) => { const e = cell; const dx = (sample(arr, x + e, z) - sample(arr, x - e, z)) / (2 * e), dz = (sample(arr, x, z + e) - sample(arr, x, z - e)) / (2 * e); const n = new THREE.Vector3(-dx * 1.4, 1, -dz * 1.4).normalize(); return Math.max(0, n.dot(sun)); };
  const hmin = Math.min(...hN), hmax = Math.max(...hN);
  const ramp = (t, stops) => { for (let k = 0; k < stops.length - 1; k++) { const [t0, c0] = stops[k], [t1, c1] = stops[k + 1]; if (t <= t1) { const f = (t - t0) / (t1 - t0); return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)]; } } return stops[stops.length - 1][1]; };
  const HYP = [[0, [46, 125, 79]], [0.25, [120, 170, 90]], [0.5, [216, 200, 106]], [0.75, [161, 102, 58]], [1, [235, 228, 220]]];
  const set = (d, o, r, g, b, a = 255) => { d.data[o] = r; d.data[o + 1] = g; d.data[o + 2] = b; d.data[o + 3] = a; };
  for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
    const [x, z] = pxToWorld(px, py), o = (py * TW + px) * 4;
    const d = z - riverZ(x), ad = Math.abs(d), hw = riverHW(x);
    const hn = hAtN(x, z), s = sample(slope, x, z), fo = sample(forest, x, z) > 0.5, dv = sample(dev, x, z);
    const shN = shade(hN, x, z), shG = shade(hG, x, z);
    const fine = vnoise(x / 3.1, z / 3.1), mid = vnoise(x / 14, z / 14);
    // --- satellite ---
    let c;
    if (ad < hw) c = [62 + 20 * mid, 108 + 18 * mid, 120 + 15 * mid];
    else if (ad < hw + 7) c = [176 + 20 * fine, 166 + 18 * fine, 140 + 10 * fine];
    else if (fo) { const t = vnoise(x / 4.5, z / 4.5); c = [30 + 34 * t, 62 + 40 * t, 34 + 22 * t]; }
    else if (ad < 45 && hash2(Math.floor(x / 9), Math.floor(z / 9)) > 0.55) { const t = fine; c = [52 + 30 * t, 86 + 34 * t, 46 + 20 * t]; }
    else {
      const fu = Math.floor((x + 13 * Math.sin(z / 50)) / 58), fv = Math.floor(d / 42), hsh = hash2(fu, fv);
      const pal = [[170, 182, 108], [196, 184, 112], [150, 168, 92], [184, 160, 104], [140, 156, 86], [206, 196, 140]];
      const base = s > 14 ? [128, 140, 92] : pal[Math.floor(hsh * pal.length)];
      const edge = (((x + 13 * Math.sin(z / 50)) / 58) % 1 + 1) % 1 < 0.04 || ((d / 42) % 1 + 1) % 1 < 0.05;
      const k2 = edge ? 0.78 : 1; c = [base[0] * k2 + 14 * (fine - 0.5), base[1] * k2 + 14 * (fine - 0.5), base[2] * k2 + 10 * (fine - 0.5)];
    }
    const L = 0.62 + 0.55 * shN;
    set(data.sat, o, c[0] * L, c[1] * L, c[2] * L);
    // --- elevation (hypsometric x hillshade) ---
    const e = ramp((hn - hmin) / (hmax - hmin), HYP); const Le = 0.55 + 0.6 * shN;
    set(data.elev, o, e[0] * Le, e[1] * Le, e[2] * Le);
    // --- slope classes ---
    const sc = s < 5 ? [46, 125, 79] : s < 10 ? [156, 201, 107] : s < 15 ? [242, 209, 92] : s < 25 ? [239, 138, 60] : [199, 55, 47];
    const Ls = 0.7 + 0.4 * shN; set(data.slope, o, sc[0] * Ls, sc[1] * Ls, sc[2] * Ls);
    // --- cut / fill on graded ground ---
    const diff = hAtG(x, z) - hn, g0 = 110 + 125 * shG;
    let cf = [g0, g0, g0 * 0.98];
    if (dv > 0.05) { const m = clamp01(Math.abs(diff) / 2.5); cf = diff < 0 ? [lerp(g0, 217, m), lerp(g0, 83, m), lerp(g0, 79, m)] : [lerp(g0, 61, m), lerp(g0, 124, m), lerp(g0, 201, m)]; }
    if (ad < hw) cf = [90, 130, 150];
    set(data.cut, o, cf[0], cf[1], cf[2]);
    // --- site (graded earth platforms on imagery) ---
    let si = [c[0], c[1], c[2]];
    const earth = [196 + 18 * fine, 172 + 14 * fine, 134 + 10 * fine];
    si = [lerp(si[0], earth[0], dv), lerp(si[1], earth[1], dv), lerp(si[2], earth[2], dv)];
    const Lg = 0.62 + 0.55 * shG; set(data.site, o, si[0] * Lg, si[1] * Lg, si[2] * Lg);
    // urban, buffers and plots are painted below with vector drawing
    set(data.urban, o, si[0] * Lg, si[1] * Lg, si[2] * Lg);
    // --- buffers overlay ---
    const fd = sample(fdist, x, z);
    const stripe = ((x + z) / 9 % 2 + 2) % 2 < 0.55;
    if (ad < P.riverSetback && ad >= hw) set(data.buf, o, 63, 174, 106, stripe ? 225 : 150);
    else if (!fo && fd <= P.forestBuffer + cell && fd > 0) set(data.buf, o, 24, 110, 84, stripe ? 235 : 160);
    else set(data.buf, o, 0, 0, 0, 0);
    set(data.plots, o, 0, 0, 0, 0);
  }
  for (const k of ['sat', 'elev', 'slope', 'cut', 'site', 'urban', 'buf', 'plots']) ctx[k].putImageData(data[k], 0, 0);
  // vector layers on textures
  const W2P = (x, z) => [(x + P.W / 2) / P.W * TW, (z + P.D / 2) / P.D * TH];
  const pathOn = (c, pl) => { c.beginPath(); pl.forEach(([x, z], k) => { const [a, b] = W2P(x, z); k ? c.lineTo(a, b) : c.moveTo(a, b); }); };
  const sc2 = TW / P.W;
  const USE = { res: ['#f4d35e', '#e9e2c8'], com: ['#e4572e', '#b9b3aa'], inst: ['#4c7bd9', '#ddd6c8'], park: ['#5fb36b', '#6f9e57'] };
  for (const p of plots) {
    // plots overlay (stage 10)
    const c = ctx.plots; pathOn(c, [...p.corners, p.corners[0]]); c.fillStyle = USE[p.use][0] + 'f0'; c.fill(); c.lineWidth = Math.max(1, 1.2 * sc2); c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
    // urban texture: lawns, paving, parks
    const u = ctx.urban; pathOn(u, [...p.corners, p.corners[0]]);
    u.fillStyle = p.use === 'park' ? '#6f9e57' : p.use === 'res' ? '#9fb07a' : p.use === 'com' ? '#b7b0a6' : '#c9c0ae'; u.globalAlpha = 0.92; u.fill(); u.globalAlpha = 1;
    u.lineWidth = Math.max(1, 0.8 * sc2); u.strokeStyle = 'rgba(80,80,70,.35)'; u.stroke();
  }
  for (const r of roadPolys) for (const c of [ctx.site, ctx.urban]) { pathOn(c, r.pl); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = (r.w + 4) * sc2; c.strokeStyle = c === ctx.urban ? '#8d8a82' : 'rgba(150,135,110,.0)'; c.stroke(); }
  const texOf = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
  const TX = {}; for (const k in imgs) TX[k] = texOf(imgs[k]);

  /* ---------------- terrain mesh ---------------- */
  const geo = new THREE.PlaneGeometry(P.W, P.D, NX, NZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const VEX = 1.0; // vertical exaggeration
  const setHeights = (g) => { for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const k = id(i, j); pos.setY(k, lerp(hN[k], hG[k], g) * VEX); } pos.needsUpdate = true; geo.computeVertexNormals(); };
  setHeights(0);
  const tmat = new THREE.MeshStandardMaterial({ map: TX.sat, roughness: 0.96, metalness: 0 });
  const wU = { uT1: { value: TX.elev }, uT2: { value: TX.slope }, uT3: { value: TX.cut }, uT4: { value: TX.site }, uT5: { value: TX.urban }, uW0: { value: new THREE.Vector4(1, 0, 0, 0) }, uW1: { value: new THREE.Vector2(0, 0) } };
  tmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wU);
    sh.fragmentShader = 'uniform sampler2D uT1; uniform sampler2D uT2; uniform sampler2D uT3; uniform sampler2D uT4; uniform sampler2D uT5; uniform vec4 uW0; uniform vec2 uW1;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 tc = texture2D(map, vMapUv) * uW0.x + texture2D(uT1, vMapUv) * uW0.y + texture2D(uT2, vMapUv) * uW0.z + texture2D(uT3, vMapUv) * uW0.w + texture2D(uT4, vMapUv) * uW1.x + texture2D(uT5, vMapUv) * uW1.y;
        diffuseColor *= tc;
      #endif`);
  };
  const terrain = new THREE.Mesh(geo, tmat); terrain.receiveShadow = true; scene.add(terrain);
  // terrain skirt (side walls) for a clean "model" edge
  const skirt = buildSkirt(); scene.add(skirt);

  // overlays draped on graded ground
  function drape(tex, lift) {
    const g = new THREE.PlaneGeometry(P.W, P.D, NX, NZ); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let k = 0; k < N; k++) p.setY(k, hG[k] * VEX + lift); g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; mesh.visible = false; scene.add(mesh); return mesh;
  }
  const bufMesh = drape(TX.buf, 0.6), plotMesh = drape(TX.plots, 0.7);

  /* water */
  const water = (() => {
    const pts = []; for (let x = -1000; x <= 1000; x += 10) pts.push(x);
    const v = [], idx = [];
    pts.forEach((x, k) => { const z = riverZ(x), hw = riverHW(x) + 1, y = (hAtN(x, z) + 5.2) * VEX; v.push(x, y, z - hw, x, y, z + hw); if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4f8fae, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    m.receiveShadow = true; scene.add(m); return m;
  })();

  /* ---------------- DTM wire + LiDAR ---------------- */
  const wire = (() => {
    const v = [], step = Math.max(2, Math.round(NX / 60));
    for (let j = 0; j <= NZ; j += step) for (let i = 0; i < NX; i++) { v.push(gx(i), hN[id(i, j)] * VEX + 1.2, gz(j), gx(i + 1), hN[id(i + 1, j)] * VEX + 1.2, gz(j)); }
    for (let i = 0; i <= NX; i += step) for (let j = 0; j < NZ; j++) { v.push(gx(i), hN[id(i, j)] * VEX + 1.2, gz(j), gx(i), hN[id(i, j + 1)] * VEX + 1.2, gz(j + 1)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x67e3f0, transparent: true, opacity: 0 })); m.visible = false; scene.add(m); return m;
  })();
  const lidar = (() => {
    const n = 70, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((n + 1) * 3 + 3), 3));
    const idx = []; for (let k = 0; k < n; k++) idx.push(0, k + 1, k + 2); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false; m.userData.n = n; scene.add(m);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((n + 1) * 3), 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0 })); line.visible = false; scene.add(line);
    m.userData.line = line; return m;
  })();
  function updateLidar(t, a) {
    const n = lidar.userData.n, p = lidar.geometry.attributes.position, lp = lidar.userData.line.geometry.attributes.position;
    const x = -900 + ((t * 0.12) % 1) * 1800, ax = x, ay = 1350, az = 120;
    p.setXYZ(0, ax, ay, az);
    for (let k = 0; k <= n; k++) { const z = -650 + k / n * 1300, y = hAtN(x, z) * VEX + 2; p.setXYZ(k + 1, x, y, z); lp.setXYZ(k, x, y + 1, z); }
    p.needsUpdate = true; lp.needsUpdate = true;
    lidar.material.opacity = 0.07 * a; lidar.userData.line.material.opacity = a; lidar.visible = a > 0.01; lidar.userData.line.visible = a > 0.01;
    return [x, 260, 0];
  }

  /* ---------------- contours (natural) and retaining walls ---------------- */
  function contourSegs(arr, levelFn, maskFn) {
    const segs = [];
    const levels = levelFn();
    for (const L of levels) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = arr[id(i, j)], b = arr[id(i + 1, j)], c = arr[id(i + 1, j + 1)], d = arr[id(i, j + 1)];
      const pts = []; const E = [[a, b, gx(i), gz(j), gx(i + 1), gz(j)], [b, c, gx(i + 1), gz(j), gx(i + 1), gz(j + 1)], [c, d, gx(i + 1), gz(j + 1), gx(i), gz(j + 1)], [d, a, gx(i), gz(j + 1), gx(i), gz(j)]];
      for (const [h1, h2, x1, z1, x2, z2] of E) if ((h1 - L) * (h2 - L) < 0) { const t = (L - h1) / (h2 - h1); pts.push([x1 + t * (x2 - x1), z1 + t * (z2 - z1)]); }
      if (pts.length >= 2) { if (maskFn && !maskFn(pts[0][0], pts[0][1])) continue; segs.push([pts[0], pts[1], L]); if (pts.length === 4) segs.push([pts[2], pts[3], L]); }
    }
    return segs;
  }
  const contours = (() => {
    const lv = () => { const o = []; for (let L = Math.ceil(hmin / P.contour) * P.contour; L < hmax; L += P.contour) o.push(L); return o; };
    const segs = contourSegs(hN, lv), v = [], col = [];
    for (const [[x1, z1], [x2, z2], L] of segs) { const major = Math.round(L) % 25 === 0, k = major ? 0.12 : 0.28; v.push(x1, hAtN(x1, z1) * VEX + 1, z1, x2, hAtN(x2, z2) * VEX + 1, z2); col.push(k, k, k, k, k, k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 })); m.visible = false; scene.add(m); return m;
  })();
  const walls = (() => {
    const lv = () => { const o = []; for (let L = Math.ceil(hmin / P.terrace) * P.terrace + P.terrace / 2; L < hmax; L += P.terrace) o.push(L); return o; };
    const segs = contourSegs(hN, lv, (x, z) => sample(dev, x, z) > 0.75 && distToRoads(x, z) > 2);
    const v = [];
    for (const [[x1, z1], [x2, z2]] of segs) {
      const y1a = (hAtG(x1, z1)) * VEX, top = (Math.max(hAtG(x1, z1), hAtN(x1, z1)) + P.terrace * 0.55) * VEX, bot = (Math.min(hAtG(x1, z1), hAtN(x1, z1)) - P.terrace * 0.55) * VEX;
      const top2 = (Math.max(hAtG(x2, z2), hAtN(x2, z2)) + P.terrace * 0.55) * VEX, bot2 = (Math.min(hAtG(x2, z2), hAtN(x2, z2)) - P.terrace * 0.55) * VEX;
      void y1a;
      v.push(x1, bot, z1, x2, bot2, z2, x2, top2, z2, x1, bot, z1, x2, top2, z2, x1, top, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
    m.castShadow = true; m.visible = false; scene.add(m); return m;
  })();

  /* ---------------- ribbons (roads, drains, channels) ---------------- */
  function ribbon(pl, w, lift, surf, bridgeOver) {
    const v = [];
    const P3 = pl.map(([x, z]) => { let y = surf(x, z); if (bridgeOver) { const ad = Math.abs(z - riverZ(x)); if (ad < 70) y = Math.max(y, bridgeOver); } return [x, y * VEX + lift, z]; });
    for (let k = 0; k < P3.length - 1; k++) {
      const [x1, y1, z1] = P3[k], [x2, y2, z2] = P3[k + 1]; const tx = x2 - x1, tz = z2 - z1, L = Math.hypot(tx, tz) || 1, nx = -tz / L * w / 2, nz = tx / L * w / 2;
      v.push(x1 + nx, y1, z1 + nz, x2 + nx, y2, z2 + nz, x1 - nx, y1, z1 - nz, x1 - nx, y1, z1 - nz, x2 + nx, y2, z2 + nz, x2 - nx, y2, z2 - nz);
    }
    return v;
  }
  function ribbonMesh(list, color, lift, surf, extra = {}) {
    const v = []; for (const it of list) v.push(...ribbon(it.pl, it.w, lift, surf, it.bridge));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: extra.rough ?? 0.85, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.receiveShadow = true; m.visible = false; m.renderOrder = 3; m.userData.count = v.length / 3; scene.add(m); return m;
  }
  const bridgeDeck = hAtN(bx, riverZ(bx) - 60) + 1;
  const roadMeshes = {
    arterial: ribbonMesh(roads.arterial.map((pl) => ({ pl, w: P.roadW.arterial })), 0xc0392b, 0.9, hAtG),
    collector: ribbonMesh(roads.collector.map((pl, k) => ({ pl, w: P.roadW.collector, bridge: k === 1 ? bridgeDeck : 0 })), 0xf39c12, 0.95, hAtG),
    local: ribbonMesh(roads.local.map((pl) => ({ pl, w: P.roadW.local })), 0xf7f1e3, 1.0, hAtG),
  };
  const asphalt = ribbonMesh([...roads.arterial.map((pl) => ({ pl, w: P.roadW.arterial })), ...roads.collector.map((pl, k) => ({ pl, w: P.roadW.collector, bridge: k === 1 ? bridgeDeck : 0 })), ...roads.local.map((pl) => ({ pl, w: P.roadW.local * 0.9 }))], 0x6a6d72, 0.85, hAtG, { rough: 0.75 });
  const drainMesh = ribbonMesh([...drains.map((pl) => ({ pl, w: 6 })), ...roadside.map((pl) => ({ pl, w: 3.5 }))], 0x2c9be0, 1.3, hAtG, { rough: 0.3 });
  const channelMesh = ribbonMesh(channels.map((pl) => ({ pl, w: 7 })), 0x76d4f5, 1.2, (x, z) => Math.max(hAtG(x, z), hAtN(x, z)), { rough: 0.3 });
  // bridge piers + culverts + ponds
  const extras = new THREE.Group(); scene.add(extras);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0xbfb8aa, roughness: 0.8, transparent: true, opacity: 0 });
  for (const dz of [-14, 0, 14]) { const z = riverZ(bx) + dz, base = hAtN(bx, z) * VEX, top = bridgeDeck * VEX; const m = new THREE.Mesh(new THREE.BoxGeometry(4, top - base + 2, 4), pierMat); m.position.set(bx, (top + base) / 2, z); m.castShadow = true; extras.add(m); }
  const culvMat = new THREE.MeshStandardMaterial({ color: 0x1b4f72, roughness: 0.5, transparent: true, opacity: 0 });
  for (const [x, z] of culverts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 22, 14), culvMat); m.rotation.x = Math.PI / 2; m.position.set(x, hAtG(x, z) * VEX + 2, z); extras.add(m); }
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x4f8fae, roughness: 0.2, transparent: true, opacity: 0 });
  for (const [x, z] of ponds) { const m = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 1.2, 28), pondMat); m.position.set(x, hAtG(x, z) * VEX + 0.8, z); m.scale.z = 0.7; extras.add(m); }

  /* ---------------- instancing helpers ---------------- */
  function growMaterial(base, mode2) {
    const u = { uGrow: { value: 1 } };
    base.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uGrow; attribute float aDelay;\n' + sh.vertexShader.replace('#include <begin_vertex>', mode2 === 'rise'
        ? '#include <begin_vertex>\n float gk = clamp((uGrow - aDelay) / 0.35, 0.0, 1.0); transformed.y *= gk; transformed.xz *= mix(0.0, 1.0, step(0.001, gk));'
        : '#include <begin_vertex>\n float gk = clamp((uGrow - aDelay * 0.5) / 0.5, 0.0, 1.0); transformed *= gk;');
    };
    base.userData.u = u; return base;
  }
  function instanced(geom, mat, items, colors, delays) {
    const m = new THREE.InstancedMesh(geom, mat, items.length); const o = new THREE.Object3D(), c = new THREE.Color();
    items.forEach((it, k) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.r || 0, 0); o.scale.set(it.sx, it.sy, it.sz); o.updateMatrix(); m.setMatrixAt(k, o.matrix); c.set(colors[k]); m.setColorAt(k, c); });
    geom.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(delays || items.map(() => 0)), 1));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
  }

  /* trees */
  const coneG = new THREE.ConeGeometry(1, 1, 6); coneG.translate(0, 0.5, 0);
  const forestItems = [], forestCols = [], natItems = [], natCols = [];
  const maxF = capture ? 9000 : small ? 1800 : 4800;
  const step = Math.sqrt((P.W * P.D * 0.42) / maxF);
  for (let z = -P.D / 2 + 6; z < P.D / 2 - 6; z += step) for (let x = -P.W / 2 + 6; x < P.W / 2 - 6; x += step) {
    const jx = x + (rnd() - 0.5) * step, jz = z + (rnd() - 0.5) * step;
    const fo = isForest(jx, jz), ad = Math.abs(jz - riverZ(jx));
    const sz = 7 + rnd() * 7, hgt = sz * (1.8 + rnd() * 0.8);
    const shade2 = ['#24532c', '#2f6435', '#3a7040', '#1f4a2a', '#456f3a'][Math.floor(rnd() * 5)];
    if (fo) { forestItems.push({ x: jx, y: hAtN(jx, jz) * VEX - 1, z: jz, sx: sz, sy: hgt, sz }); forestCols.push(shade2); }
    else if (ad > riverHW(jx) + 5 && (ad < 45 ? rnd() < 0.55 : rnd() < 0.05)) { natItems.push({ x: jx, y: hAtN(jx, jz) * VEX - 1, z: jz, sx: sz * 0.8, sy: hgt * 0.8, sz: sz * 0.8 }); natCols.push(shade2); }
  }
  const forestMesh = instanced(coneG, growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9 })), forestItems, forestCols);
  // riparian trees stay (inside the setback); other scattered trees go with grading
  const ripI = [], ripC = [], scatI = [], scatC = [];
  natItems.forEach((it, k) => { if (Math.abs(it.z - riverZ(it.x)) < P.riverSetback) { ripI.push(it); ripC.push(natCols[k]); } else { scatI.push(it); scatC.push(natCols[k]); } });
  const ripMesh = instanced(coneG.clone(), growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9 })), ripI, ripC);
  const natMesh = instanced(coneG.clone(), growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9 })), scatI, scatC);

  /* buildings */
  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
  const bI = [], bC = [], bD = [], rI = [], rC = [], rD = [], pI = [], pC = [], pD = [];
  const angAt = (x) => Math.atan2(riverZ(x + 1) - riverZ(x - 1), 2);
  plots.forEach((p) => {
    const y = hAtG(p.cx, p.cz) * VEX, r = -angAt(p.cx), dly = clamp01((p.u + 950) / 1900) * 0.55 + rnd() * 0.08;
    if (p.use === 'park') { for (let k = 0; k < 5; k++) { const x = p.cx + (rnd() - 0.5) * 24, z = p.cz + (rnd() - 0.5) * 14, s = 4 + rnd() * 3; pI.push({ x, y: hAtG(x, z) * VEX, z, sx: s, sy: s * 2.2, sz: s }); pC.push(['#3f7d3a', '#4f8f45', '#2f6a35'][k % 3]); pD.push(dly); } return; }
    if (p.use === 'res') {
      const n = 2;
      for (let k = 0; k < n; k++) { const off = (k - 0.5) * 16; const x = p.cx + Math.cos(r) * off, z = p.cz - Math.sin(r) * off, fl = 2 + Math.floor(rnd() * 2); bI.push({ x, y, z, r, sx: 12, sy: fl * 3.3, sz: 11 }); bC.push(['#f1e6d0', '#ece3cf', '#f4ede0', '#e6dccb'][Math.floor(rnd() * 4)]); bD.push(dly);
        rI.push({ x, y: y + fl * 3.3, z, r, sx: 13, sy: 1.8, sz: 12 }); rC.push(['#b5543c', '#9c4a36', '#7f8a8f', '#a85c3c'][Math.floor(rnd() * 4)]); rD.push(dly + 0.05); }
    } else if (p.use === 'com') { const fl = 4 + Math.floor(rnd() * 5); bI.push({ x: p.cx, y, z: p.cz, r, sx: 26, sy: fl * 3.6, sz: 18 }); bC.push(['#9db4c9', '#8fa7bd', '#aebfcf'][Math.floor(rnd() * 3)]); bD.push(dly); rI.push({ x: p.cx, y: y + fl * 3.6, z: p.cz, r, sx: 26.5, sy: 0.8, sz: 18.5 }); rC.push('#d7dde2'); rD.push(dly + 0.05); }
    else { bI.push({ x: p.cx, y, z: p.cz, r, sx: 28, sy: 10, sz: 16 }); bC.push('#c9d6e8'); bD.push(dly); rI.push({ x: p.cx, y: y + 10, z: p.cz, r, sx: 28.5, sy: 0.8, sz: 16.5 }); rC.push('#eef1f4'); rD.push(dly + 0.05); }
  });
  const bldMesh = instanced(boxG, growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.75 }), 'rise'), bI, bC, bD);
  const roofMesh = instanced(boxG.clone(), growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.8 }), 'rise'), rI, rC, rD);
  const parkMesh = instanced(coneG.clone(), growMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9 })), pI, pC, pD);
  // water reservoir on the upper slope
  const tankPt = (() => { const x = 320, z = riverZ(320) - vC(320, 1) - 110; return [x, z]; })();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 12, 32), growMaterial(new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.5 }), 'rise'));
  tank.geometry.translate(0, 6, 0); tank.geometry.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(tank.geometry.attributes.position.count).fill(0.3), 1));
  tank.position.set(tankPt[0], hAtG(tankPt[0], tankPt[1]) * VEX, tankPt[1]); tank.castShadow = true; scene.add(tank);

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0xdfeaf5, 0x6b6150, 1.15); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xfff4e0, 2.3); sunL.position.copy(sun).multiplyScalar(2400); sunL.castShadow = renderer.shadowMap.enabled;
  sunL.shadow.mapSize.set(capture ? 4096 : 2048, capture ? 4096 : 2048);
  Object.assign(sunL.shadow.camera, { left: -1150, right: 1150, top: 900, bottom: -900, near: 100, far: 6000 }); sunL.shadow.bias = -0.0006; sunL.shadow.normalBias = 1.2;
  scene.add(sunL); scene.add(sunL.target);

  /* ---------------- pins ---------------- */
  const anchors = {
    ridge: [80, -560], river: [520, riverZ(520)], forestN: [-640, -500], valley: [-330, riverZ(-330) - 160],
    lidar: null, slopeN: [-520, riverZ(-520) - 300], steep: [700, -520], cut: null, fill: null, wall: null,
    arterial: [620, riverZ(620) - 95], collector: [-540, null], bridge: [bx, riverZ(bx)], culvert: culverts[2] || culverts[0],
    pond: ponds[0], channel: channels[0][Math.floor(channels[0].length * 0.35)], setback: [300, riverZ(300) + 30], fbuffer: null,
    res: null, com: null, inst: null, park: null, tank: tankPt,
  };
  anchors.collector[1] = roads.collector[2][Math.round((-540 + 880) / 8)][1];
  // cut/fill anchors: strongest values in the visible development zone
  let bestC = -1, bestF = -1;
  for (let j = 0; j <= NZ; j += 2) for (let i = 0; i <= NX; i += 2) { const k = id(i, j), df = hG[k] - hN[k], x = gx(i); if (Math.abs(x) > 600) continue; if (-df > bestC && dev[k] > 0.9) { bestC = -df; anchors.cut = [x, gz(j)]; } if (df > bestF && dev[k] > 0.9) { bestF = df; anchors.fill = [x, gz(j)]; } }
  const wp = walls.geometry.attributes.position; if (wp.count) { const k = Math.floor(wp.count * 0.45); anchors.wall = [wp.getX(k), wp.getZ(k)]; }
  for (let x = 420; x > -800; x -= 10) { const z = riverZ(x) - 340; if (sample(fdist, x, z) < P.forestBuffer && !isForest(x, z)) { anchors.fbuffer = [x, z]; break; } }
  if (!anchors.fbuffer) anchors.fbuffer = [400, riverZ(400) - 330];
  const firstOf = (u) => plots.filter((p) => p.use === u).sort((a, b) => Math.abs(a.u - 60) - Math.abs(b.u - 60))[0];
  for (const u of ['res', 'com', 'inst', 'park']) { const p = firstOf(u); if (p) anchors[u] = [p.cx, p.cz]; }
  const resP = plots.filter((p) => p.use === 'res').sort((a, b) => Math.abs(a.u + 420) - Math.abs(b.u + 420))[0]; if (resP) anchors.res = [resP.cx, resP.cz];
  const pinEls = [];
  if (labelsEl) {
    labelsEl.innerHTML = '';
    for (const d of PIN_DEFS) { const el = document.createElement('div'); el.className = 'tc-pin'; el.innerHTML = '<span>' + d.t + '</span>'; labelsEl.appendChild(el); pinEls.push({ d, el, vis: 0 }); }
  }
  const v3 = new THREE.Vector3();

  /* ---------------- helpers ---------------- */
  function buildSkirt() {
    const v = [], col = [];
    const edge = (fx) => { const pts = []; for (let t = 0; t <= 1.0001; t += 1 / 120) pts.push(fx(t)); return pts; };
    const sides = [edge((t) => [-P.W / 2 + t * P.W, P.D / 2]), edge((t) => [P.W / 2, P.D / 2 - t * P.D]), edge((t) => [P.W / 2 - t * P.W, -P.D / 2]), edge((t) => [-P.W / 2, -P.D / 2 + t * P.D])];
    const base = (Math.min(...hN) - 28) * VEX;
    for (const s of sides) for (let k = 0; k < s.length - 1; k++) { const [x1, z1] = s[k], [x2, z2] = s[k + 1]; const y1 = hAtN(x1, z1) * VEX, y2 = hAtN(x2, z2) * VEX; v.push(x1, y1, z1, x1, base, z1, x2, base, z2, x1, y1, z1, x2, base, z2, x2, y2, z2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9c8c74, roughness: 1, side: THREE.DoubleSide }));
  }
  function skyTexture() {
    const c = document.createElement('canvas'); c.width = 2; c.height = 512; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#9fc0dc'); gr.addColorStop(0.55, '#dfe9f1'); gr.addColorStop(1, '#f3f1ea'); g.fillStyle = gr; g.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ---------------- state ---------------- */
  const keys = Object.keys(K[0]).filter((k) => k !== 'tex');
  function stateAt(s) {
    const n = STAGES.length, i = Math.floor(s) % n, f = s - Math.floor(s), j = (i + 1) % n;
    const hold = j === 0 ? 0.62 : 0.70, tt = f < hold ? 0 : (f - hold) / (1 - hold), e = tt * tt * (3 - 2 * tt);
    const o = { stage: i, mix: e, tex: K[i].tex.map((v, k) => lerp(v, K[j].tex[k], e)) };
    for (const k of keys) o[k] = lerp(K[i][k], K[j][k], e);
    return o;
  }
  let lastGrade = -1;
  const goldCol = new THREE.Color(0xffc98a), dayCol = new THREE.Color(0xfff4e0);
  function apply(st, time) {
    wU.uW0.value.set(st.tex[0], st.tex[1], st.tex[2], st.tex[3]); wU.uW1.value.set(st.tex[4], st.tex[5]);
    if (Math.abs(st.grade - lastGrade) > 0.002) { setHeights(st.grade); lastGrade = st.grade; }
    const op = (m, a) => { m.material.opacity = a; m.visible = a > 0.01; };
    op(wire, st.wire * 0.75); op(contours, st.cont); op(walls, st.walls * st.grade);
    bufMesh.material.opacity = st.buf; bufMesh.visible = st.buf > 0.01;
    plotMesh.material.opacity = st.plots; plotMesh.visible = st.plots > 0.01;
    // roads draw on along their length, then asphalt replaces class colours in the final city
    const city = clamp01((st.tex[5] - 0.3) / 0.7);
    for (const m of Object.values(roadMeshes)) { const n = m.userData.count; m.geometry.setDrawRange(0, Math.floor(n * clamp01(st.roads) / 6) * 6); op(m, clamp01(st.roads * 3) * (1 - city)); }
    asphalt.geometry.setDrawRange(0, asphalt.userData.count); op(asphalt, city * st.roads);
    for (const m of [drainMesh, channelMesh]) { m.geometry.setDrawRange(0, Math.floor(m.userData.count * clamp01(st.drains * 1.4) / 6) * 6); op(m, clamp01(st.drains * 2.5)); }
    pierMat.opacity = clamp01(st.roads * 2); culvMat.opacity = st.drains; pondMat.opacity = Math.max(st.drains, city * 0.9);
    extras.visible = st.roads > 0.01 || st.drains > 0.01;
    forestMesh.material.userData.u.uGrow.value = st.forest; forestMesh.visible = st.forest > 0.01;
    ripMesh.material.userData.u.uGrow.value = Math.max(st.forest, st.natTrees); ripMesh.visible = ripMesh.material.userData.u.uGrow.value > 0.01;
    natMesh.material.userData.u.uGrow.value = st.natTrees * (1 - st.grade); natMesh.visible = natMesh.material.userData.u.uGrow.value > 0.01;
    for (const m of [bldMesh, roofMesh]) { m.material.userData.u.uGrow.value = st.bld; m.visible = st.bld > 0.01; }
    parkMesh.material.userData.u.uGrow.value = st.park; parkMesh.visible = st.park > 0.01;
    tank.material.userData.u.uGrow.value = st.bld; tank.visible = st.bld > 0.01;
    const lidarPt = updateLidar(time, st.lidar); anchors.lidar = [lidarPt[0], 0];
    sunL.color.copy(dayCol).lerp(goldCol, st.gold); sunL.intensity = lerp(2.3, 2.6, st.gold);
    const sp = new THREE.Vector3(lerp(-0.55, -0.82, st.gold), lerp(0.62, 0.38, st.gold), lerp(0.35, 0.3, st.gold)).normalize();
    sunL.position.copy(sp).multiplyScalar(2400); hemi.intensity = lerp(1.15, 0.95, st.gold);
    renderer.toneMappingExposure = lerp(1.05, 1.0, st.gold);
  }

  /* ---------------- camera & render ---------------- */
  let W = 0, H = 0, shiftX = opts.shiftX || 0;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false); camera.aspect = W / H;
    camBase.dist = (W / H < 1.2 ? 3000 : 2150) * (opts.zoom || 1);
    if (shiftX && W / H > 1.3) camera.setViewOffset(W, H, -W * shiftX, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function placeCamera(t) {
    const drift = capture || opts.static ? 0 : Math.sin(t * 0.05) * 0.05;
    const az = camBase.az + drift, el = camBase.el + (capture ? 0 : Math.sin(t * 0.037) * 0.012), d = camBase.dist;
    camera.position.set(camBase.target.x + Math.sin(az) * Math.cos(el) * d, camBase.target.y + Math.sin(el) * d, camBase.target.z + Math.cos(az) * Math.cos(el) * d);
    camera.lookAt(camBase.target);
  }
  function updatePins(st) {
    if (!pinEls.length) return;
    const rectW = W, rectH = H, minX = (opts.pinMinX || 0) * rectW;
    for (const p of pinEls) {
      const on = p.d.s.includes(st.stage) ? 1 - st.mix : p.d.s.includes((st.stage + 1) % STAGES.length) ? st.mix : 0;
      const a = anchors[p.d.at]; if (!a || on < 0.02) { p.el.style.opacity = 0; continue; }
      const [x, z] = a; const y = (st.grade > 0.5 ? hAtG(x, z) : hAtN(x, z)) * VEX + 6;
      v3.set(x, y, z).project(camera);
      const sx = (v3.x * 0.5 + 0.5) * rectW, sy = (-v3.y * 0.5 + 0.5) * rectH;
      const vis = v3.z < 1 && sx > minX && sx < rectW - 20 && sy > 40 && sy < rectH - 30;
      p.el.style.opacity = vis ? on : 0; p.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
  }

  let raf = 0, playing = false, s = 0, last = 0, time = 0, onStage = opts.onStage || (() => {}), lastStage = -1;
  const SPEED = 1 / (opts.stageSeconds || 6.5);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; time += dt;
    if (playing) s = (s + dt * SPEED) % STAGES.length;
    renderAt(s, time);
  }
  function renderAt(sv, t) {
    const st = stateAt(sv); apply(st, t ?? time); placeCamera(t ?? time); renderer.render(scene, camera); updatePins(st);
    const shown = st.mix > 0.5 ? (st.stage + 1) % STAGES.length : st.stage;
    if (shown !== lastStage) { lastStage = shown; onStage(shown, STAGES[shown]); }
    return st;
  }
  resize();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);

  return {
    THREE, scene, camera, stages: STAGES, params: P, legendFor,
    play() { if (playing) return; playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    pause() { playing = false; },
    stopLoop() { playing = false; cancelAnimationFrame(raf); raf = 0; },
    resumeLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    get playing() { return playing; },
    setStage(i) { s = ((i % STAGES.length) + STAGES.length) % STAGES.length; if (!raf) renderAt(s); },
    get stage() { return Math.floor(s); },
    setBackground(c) { scene.fog.color.set(c); if (!raf) renderAt(s); },
    setShift(v) { shiftX = v; resize(); },
    renderAt, resize,
    stats: { plots: plots.length, buildings: bI.length, trees: forestItems.length + natItems.length, grid: NX + 'x' + NZ },
    dispose() { cancelAnimationFrame(raf); if (ro) ro.disconnect(); renderer.dispose(); },
  };
}
