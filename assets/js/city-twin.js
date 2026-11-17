/* City digital twin: a demonstration layer on the illustrative terrain-to-city model.
   Hazards, sensor readings, forecasts and damage states are SIMULATED for
   demonstration. No live sensors, real city or trained model is connected. */
import { createTerrainCity } from './terrain-city.js?v=2026-11-17';

export const CHAPTERS = {
  gis:    { label: 'GIS foundation',           dur: 16 },
  hazard: { label: 'Hazard and risk',          dur: 20 },
  zoning: { label: 'Planning and zoning',      dur: 14 },
  iot:    { label: 'Buildings and IoT',        dur: 18 },
  ai:     { label: 'AI monitoring',            dur: 24 },
  flood:  { label: 'Flood forecast and evacuation', dur: 30 },
  quake:  { label: 'Earthquake impact',        dur: 18 },
  fire:   { label: 'Fire scenario',            dur: 20 },
};
export const JOURNEY = ['gis', 'hazard', 'zoning', 'iot', 'ai', 'flood'];

const lerp = (a, b, t) => a + (b - a) * t, clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const win = (p, a, b, f = 0.05) => ss(a, a + f, p) * (1 - ss(b - f, b, p)); // fade in at a, out at b
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export function createCityTwin(opts) {
  const canvas = opts.canvas, labelsEl = opts.labels || null, capture = opts.mode === 'capture';
  let shake = 0;
  const tc = createTerrainCity({
    canvas, mode: capture ? 'capture' : 'viewer', quality: opts.quality, maxDpr: opts.maxDpr || 1.5, background: opts.background || '#0e1a26', zoom: 0.92,
    beforeRender: (cam) => { if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake * 0.6; } },
  });
  const I = tc.internals, { THREE, scene, camera, hN, hG, NX, NZ, id, hAtG, hAtN, riverZ, P, plots, roads, bI, bC, bldMesh } = I;

  /* ---------------- helpers ---------------- */
  const wsurf = (x) => hAtN(x, riverZ(x)) + 5.2;                     // normal river water surface
  const sample = (arr, x, z) => {
    const fi = Math.min(NX - 1e-6, Math.max(0, (x + P.W / 2) / P.W * NX)), fj = Math.min(NZ - 1e-6, Math.max(0, (z + P.D / 2) / P.D * NZ));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    return lerp(lerp(arr[id(i, j)], arr[id(i + 1, j)], u), lerp(arr[id(i, j + 1)], arr[id(i + 1, j + 1)], u), v);
  };
  const OW = capture ? 1024 : 512, OH = Math.round(OW * P.D / P.W);
  function overlay(fn) {
    const c = document.createElement('canvas'); c.width = OW; c.height = OH; const g = c.getContext('2d'), img = g.createImageData(OW, OH);
    for (let py = 0; py < OH; py++) for (let px = 0; px < OW; px++) {
      const x = -P.W / 2 + (px + 0.5) / OW * P.W, z = -P.D / 2 + (py + 0.5) / OH * P.D, o = (py * OW + px) * 4, c4 = fn(x, z, px, py);
      img.data[o] = c4[0]; img.data[o + 1] = c4[1]; img.data[o + 2] = c4[2]; img.data[o + 3] = c4[3];
    }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function drape(heights, tex, lift, order = 4) {
    const g = new THREE.PlaneGeometry(P.W, P.D, NX, NZ); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, heights[k] + lift);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.renderOrder = order; m.visible = false; scene.add(m); return m;
  }
  const setOp = (m, a) => { m.material.opacity = a; m.visible = a > 0.01; };
  const lazy = (f) => { let v; return () => v || (v = f()); };

  /* ---------------- hazard surfaces (natural ground) ---------------- */
  const hz = {
    flood: lazy(() => drape(hN, overlay((x, z) => { const d = hAtN(x, z) - wsurf(x); return d < 3 ? [30, 80, 200, 200] : d < 7 ? [60, 130, 230, 160] : d < 11 ? [130, 185, 245, 110] : [0, 0, 0, 0]; }), 1.2)),
    slide: lazy(() => drape(hN, overlay((x, z) => { const s = sample(I.slope, x, z); return s > 22 ? [205, 45, 40, 205] : s > 16 ? [240, 130, 40, 170] : s > 11 ? [245, 210, 70, 110] : [0, 0, 0, 0]; }), 1.2)),
    seismic: lazy(() => drape(hN, overlay((x, z) => { const d = Math.abs(z - riverZ(x)), e = hAtN(x, z) - wsurf(x); return d < 200 && e < 14 ? [150, 70, 200, d < 100 ? 190 : 120] : [0, 0, 0, 0]; }), 1.2)),
    risk: lazy(() => drape(hN, overlay((x, z) => {
      const e = hAtN(x, z) - wsurf(x), s = sample(I.slope, x, z), d = Math.abs(z - riverZ(x));
      const r = Math.max(e < 3.5 ? 3 : e < 7 ? 2 : e < 10 ? 1 : 0, s > 22 ? 3 : s > 16 ? 2 : s > 11 ? 1 : 0, d < 100 && e < 12 ? 1 : 0);
      return r >= 3 ? [200, 40, 45, 200] : r === 2 ? [240, 140, 40, 160] : r === 1 ? [245, 215, 80, 110] : [70, 180, 110, 60];
    }), 1.3)),
  };

  /* ---------------- flood scenario geometry ---------------- */
  const clear = bI.map((b) => b.y - wsurf(b.x)).sort((a, b) => a - b);
  const R = clear[Math.floor(clear.length * 0.16)] + 0.6;           // predicted rise: affects about 16% of buildings
  const flooded = bI.map((b) => b.y - wsurf(b.x) < R);
  const nFlood = flooded.filter(Boolean).length;
  const predicted = lazy(() => drape(hG, overlay((x, z, px, py) => { const d = hAtG(x, z) - (wsurf(x) + R); if (d >= 0) return [0, 0, 0, 0]; const st = ((px + py) % 9) < 4; return st ? [255, 80, 70, 210] : [255, 120, 90, 120]; }), 1.0, 6));
  const water = (() => {
    const g = new THREE.PlaneGeometry(P.W, P.D, 120, 84); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, wsurf(p.getX(k)) - 0.4);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3f7fa6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }));
    m.visible = false; m.renderOrder = 7; scene.add(m); return m;
  })();
  function ribbon(pl, w, lift, color, op = 0) {
    const v = []; const P3 = pl.map(([x, z]) => [x, hAtG(x, z) + lift, z]);
    for (let k = 0; k < P3.length - 1; k++) { const [x1, y1, z1] = P3[k], [x2, y2, z2] = P3[k + 1], tx = x2 - x1, tz = z2 - z1, L = Math.hypot(tx, tz) || 1, nx = -tz / L * w / 2, nz = tx / L * w / 2; v.push(x1 + nx, y1, z1 + nz, x2 + nx, y2, z2 + nz, x1 - nx, y1, z1 - nz, x1 - nx, y1, z1 - nz, x2 + nx, y2, z2 + nz, x2 - nx, y2, z2 - nz); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 8; m.visible = false; m.userData.n = v.length / 3; scene.add(m); return m;
  }
  const level = (x) => wsurf(x) + R;
  const evac = roads.local.filter((pl) => hAtG(pl[0][0], pl[0][1]) < level(pl[0][0]) + 4).map((pl) => pl);
  const evacRoutes = (evac.length ? evac : roads.local.slice(2, 5)).map((pl) => ribbon(pl, 14, 2.4, 0x2bea74));
  const shelters = (evac.length ? evac : roads.local.slice(2, 5)).map((pl) => pl[pl.length - 1]);
  const closed = (() => { const a = roads.arterial[0], segs = []; let cur = []; for (const p of a) { if (hAtG(p[0], p[1]) < level(p[0]) + 0.5) cur.push(p); else { if (cur.length > 1) segs.push(cur); cur = []; } } if (cur.length > 1) segs.push(cur); return segs.map((s) => ribbon(s, 22, 2.0, 0xff2d2d)); })();
  const shelterMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(9, 9, 18, 16).translate(0, 9, 0), new THREE.MeshBasicMaterial({ color: 0x2bea74, transparent: true, opacity: 0.9, toneMapped: false }), shelters.length);
  shelters.forEach(([x, z], k) => { const m4 = new THREE.Matrix4().makeTranslation(x, hAtG(x, z), z); shelterMesh.setMatrixAt(k, m4); }); shelterMesh.visible = false; scene.add(shelterMesh);

  /* rain */
  const rain = (() => {
    const n = capture ? 3000 : 1600, v = new Float32Array(n * 6), seed = [];
    for (let k = 0; k < n; k++) { const x = -950 + hash(k) * 1900, z = -650 + hash(k + 99) * 1300, y = 300 + hash(k + 7) * 700; seed.push([x, z, y]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbcd8f0, transparent: true, opacity: 0 })); m.visible = false; m.userData.seed = seed; scene.add(m); m.frustumCulled = false; return m;
  })();
  function updateRain(t, a) {
    rain.visible = a > 0.01; rain.material.opacity = 0.55 * a; if (!rain.visible) return;
    const p = rain.geometry.attributes.position.array, seed = rain.userData.seed;
    for (let k = 0; k < seed.length; k++) { const [x, z, y0] = seed[k]; const y = 260 + ((y0 - t * 380) % 700 + 700) % 700; p.set([x, y, z, x + 3, y - 26, z + 2], k * 6); }
    rain.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------------- IoT network ---------------- */
  const hubs = roads.local.map((pl) => { const [x, z] = pl[pl.length - 1]; return [x, hAtG(x, z) + 30, z]; });
  const platform = [I.tankPt[0] - 120, hAtG(I.tankPt[0], I.tankPt[1]) + 170, I.tankPt[1] - 120];
  const sensorPos = bI.map((b) => [b.x, b.y + b.sy + 4, b.z]);
  const sensorMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7cf3ff, transparent: true, opacity: 0 }), sensorPos.length);
  sensorPos.forEach((p, k) => sensorMesh.setMatrixAt(k, new THREE.Matrix4().makeTranslation(...p))); sensorMesh.visible = false; scene.add(sensorMesh);
  const nearestHub = (p) => { let b = 0, bd = 1e9; hubs.forEach((h, k) => { const d = Math.hypot(h[0] - p[0], h[2] - p[2]); if (d < bd) { bd = d; b = k; } }); return b; };
  const linkV = []; sensorPos.forEach((p) => linkV.push(...p, ...hubs[nearestHub(p)]));
  const arcs = hubs.map((h) => { const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24, mid = [(h[0] + platform[0]) / 2, Math.max(h[1], platform[1]) + 90, (h[2] + platform[2]) / 2]; pts.push([lerp(lerp(h[0], mid[0], t), lerp(mid[0], platform[0], t), t), lerp(lerp(h[1], mid[1], t), lerp(mid[1], platform[1], t), t), lerp(lerp(h[2], mid[2], t), lerp(mid[2], platform[2], t), t)]); } return pts; });
  arcs.forEach((a) => { for (let k = 0; k < a.length - 1; k++) linkV.push(...a[k], ...a[k + 1]); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linkV, 3));
  const links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5fe3f2, transparent: true, opacity: 0 })); links.visible = false; scene.add(links);
  const hubMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(6), new THREE.MeshBasicMaterial({ color: 0xbaf8ff, transparent: true, opacity: 0 }), hubs.length + 1);
  [...hubs, platform].forEach((p, k) => hubMesh.setMatrixAt(k, new THREE.Matrix4().makeScale(k === hubs.length ? 3 : 1, k === hubs.length ? 3 : 1, k === hubs.length ? 3 : 1).setPosition(...p))); hubMesh.visible = false; scene.add(hubMesh);
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0 }), arcs.length * 3); pulses.visible = false; pulses.frustumCulled = false; scene.add(pulses);
  // environmental gauges: rain gauges on the slopes, river level gauges
  const gauges = [[-520, riverZ(-520) - 330], [180, riverZ(180) - 360], [-120, riverZ(-120) + 14], [600, riverZ(600) + 14]];
  const gaugeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(3, 3, 26, 10).translate(0, 13, 0), new THREE.MeshBasicMaterial({ color: 0x8ab8ff, transparent: true, opacity: 0 }), gauges.length);
  gauges.forEach(([x, z], k) => gaugeMesh.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, hAtG(x, z), z))); gaugeMesh.visible = false; scene.add(gaugeMesh);

  /* ---------------- traffic ---------------- */
  const lanes = [roads.arterial[0], ...roads.collector.filter((pl) => pl.length > 40)];
  const laneLen = lanes.map((pl) => { let L = 0; for (let k = 0; k < pl.length - 1; k++) L += Math.hypot(pl[k + 1][0] - pl[k][0], pl[k + 1][1] - pl[k][1]); return L; });
  const nCars = capture ? 420 : opts.quality === 'low' ? 140 : 300;
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(15, 5, 7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), nCars); cars.visible = false; cars.frustumCulled = false; scene.add(cars);
  const carState = Array.from({ length: nCars }, (_, k) => ({ lane: k % lanes.length === 0 || k % 3 ? 0 : 1 + (k % (lanes.length - 1)), d: hash(k) * 1, dir: k % 2 ? 1 : -1, sp: 0.6 + hash(k + 3) * 0.6 }));
  const congestion = (x) => clamp01(Math.exp(-(((x + 40) / 260) ** 2)) * 1.1);            // simulated peak near the town centre
  function along(pl, f) { let d = f * laneLen[lanes.indexOf(pl)]; for (let k = 0; k < pl.length - 1; k++) { const L = Math.hypot(pl[k + 1][0] - pl[k][0], pl[k + 1][1] - pl[k][1]); if (d <= L) { const t = d / L; return [lerp(pl[k][0], pl[k + 1][0], t), lerp(pl[k][1], pl[k + 1][1], t)]; } d -= L; } return pl[pl.length - 1]; }
  const trafficMap = (() => {
    const v = [], c = [];
    for (const pl of lanes) for (let k = 0; k < pl.length - 1; k++) {
      const [x1, z1] = pl[k], [x2, z2] = pl[k + 1], y1 = hAtG(x1, z1) + 1.8, y2 = hAtG(x2, z2) + 1.8, tx = x2 - x1, tz = z2 - z1, L = Math.hypot(tx, tz) || 1, w = pl === lanes[0] ? 14 : 9, nx = -tz / L * w, nz = tx / L * w;
      v.push(x1 + nx, y1, z1 + nz, x2 + nx, y2, z2 + nz, x1 - nx, y1, z1 - nz, x1 - nx, y1, z1 - nz, x2 + nx, y2, z2 + nz, x2 - nx, y2, z2 - nz);
      const g = clamp01(congestion((x1 + x2) / 2) + 0.15 * Math.sin(x1 / 70)), cc = g < 0.35 ? [0.1, 0.9, 0.35] : g < 0.65 ? [1, 0.75, 0.05] : [1, 0.15, 0.12];
      for (let q = 0; q < 6; q++) c.push(...cc);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 8; m.visible = false; scene.add(m); return m;
  })();
  const col = new THREE.Color(), m4 = new THREE.Matrix4();
  function updateCars(dt, a) {
    cars.visible = a > 0.01; cars.material.opacity = a; if (!cars.visible) return;
    carState.forEach((c, k) => {
      const pl = lanes[c.lane], [x0] = along(pl, c.d), cg = congestion(x0);
      c.d = (c.d + c.dir * dt * c.sp * (1 - 0.8 * cg) * 60 / laneLen[c.lane] + 1) % 1;
      const [x, z] = along(pl, c.d); m4.makeTranslation(x, hAtG(x, z) + 3.4, z + c.dir * 3.5); cars.setMatrixAt(k, m4);
      col.setRGB(lerp(0.25, 1, cg), lerp(0.9, 0.25, cg), 0.3); cars.setColorAt(k, col);
    });
    cars.instanceMatrix.needsUpdate = true; if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }

  /* ---------------- analytics overlays (graded city) ---------------- */
  const heat = lazy(() => drape(hG, overlay((x, z) => {
    const urban = sample(I.dev, x, z), d = Math.abs(z - riverZ(x)), fo = sample(I.forest, x, z);
    const T = 23 + 8.5 * urban * (0.7 + 0.3 * Math.exp(-(((x + 40) / 420) ** 2))) - 3 * Math.exp(-d / 90) - 2.5 * fo;
    const k = clamp01((T - 21) / 11); if (fo > 0.5) return [0, 0, 0, 0]; return [lerp(40, 235, k), lerp(110, k > 0.5 ? 70 : 200, Math.abs(k - 0.5) * 2), lerp(230, 40, k), 150];
  }), 1.4));
  const aqi = lazy(() => drape(hG, overlay((x, z) => {
    const dz = Math.abs(z - (riverZ(x) - 95)), v = 35 + 120 * Math.exp(-dz / 70) * (0.45 + 0.55 * Math.exp(-(((x + 40) / 380) ** 2))) + 25 * sample(I.dev, x, z);
    if (sample(I.forest, x, z) > 0.5) return [0, 0, 0, 0]; const c = v < 50 ? [80, 200, 110] : v < 100 ? [245, 215, 70] : v < 150 ? [245, 140, 50] : [215, 55, 55]; return [...c, 140];
  }), 1.4));
  // building recolouring (energy, flood, quake, fire)
  const orig = bC.map((h) => new THREE.Color(h));
  let tint = null;
  function setTint(fn) { tint = fn; for (let k = 0; k < bI.length; k++) { bldMesh.setColorAt(k, fn ? fn(k) : orig[k]); } bldMesh.instanceColor.needsUpdate = true; }
  const energyCol = (k) => { const b = bI[k], kW = b.sx * b.sz * b.sy / 900 + hash(k) * 0.6; return new THREE.Color().setHSL(lerp(0.33, 0.0, clamp01(kW / 3.2)), 0.85, 0.55); };
  const damage = bI.map((b, k) => { const e = b.y - wsurf(b.x), s = (b.sy / 3.3 - 2) * 0.35 + (e < 12 ? 1.1 : 0) + (sample(I.slope, b.x, b.z) > 10 ? 0.5 : 0) + hash(k * 3) * 1.3; return s < 0.8 ? 0 : s < 1.5 ? 1 : s < 2.1 ? 2 : 3; });
  const DMG = ['#46c26b', '#f2d15c', '#ef8a3c', '#d83a34'];

  /* fire */
  const fireOrigin = (() => { let b = 0, bd = 1e9; bI.forEach((p, k) => { const d = Math.hypot(p.x + 380, p.z - (riverZ(-380) - 150)); if (d < bd && p.sy < 12) { bd = d; b = k; } }); return b; })();
  const igniteAt = bI.map(() => Infinity); igniteAt[fireOrigin] = 0;
  { const q = [fireOrigin]; while (q.length) { const a = q.shift(); bI.forEach((b, k) => { if (igniteAt[k] !== Infinity) return; const d = Math.hypot(b.x - bI[a].x, b.z - bI[a].z); if (d < 44 && igniteAt[a] < 0.42) { igniteAt[k] = igniteAt[a] + 0.07 + hash(k) * 0.1; q.push(k); } }); } }
  const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(13, 42, 8).translate(0, 21, 0), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.95, toneMapped: false }), bI.length); flames.visible = false; flames.frustumCulled = false; scene.add(flames);
  const station = (() => { const c = plots.filter((p) => p.use === 'com' && p.side > 0).sort((a, b) => Math.abs(a.u - 220) - Math.abs(b.u - 220))[0]; return c ? [c.cx, c.cz] : [200, riverZ(200) - 120]; })();
  const fireRoute = (() => {
    const art = roads.arterial[0], f = bI[fireOrigin];
    const iS = art.reduce((b, p, k) => Math.hypot(p[0] - station[0], p[1] - station[1]) < Math.hypot(art[b][0] - station[0], art[b][1] - station[1]) ? k : b, 0);
    const loc = roads.local.reduce((b, pl) => Math.abs(pl[0][0] - f.x) < Math.abs(b[0][0] - f.x) ? pl : b, roads.local[0]);
    const iL = art.reduce((b, p, k) => Math.abs(p[0] - loc[0][0]) < Math.abs(art[b][0] - loc[0][0]) ? k : b, 0);
    const seg = iS > iL ? art.slice(iL, iS + 1).reverse() : art.slice(iS, iL + 1);
    const up = []; for (const p of loc) { up.push(p); if (Math.hypot(p[0] - f.x, p[1] - f.z) < 45) break; }
    return [station, ...seg, ...up, [f.x, f.z]];
  })();
  const fireRouteMesh = ribbon(fireRoute, 18, 2.8, 0x2fc4ff);
  const hydr = []; for (let x = -800; x <= 800; x += 110) hydr.push([x, riverZ(x) - 104]);
  const hydMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 2.4, 9, 8).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0 }), hydr.length);
  hydr.forEach(([x, z], k) => hydMesh.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, hAtG(x, z), z))); hydMesh.visible = false; scene.add(hydMesh);

  /* ---------------- pins ---------------- */
  const midPlot = (u) => plots.filter((p) => p.use === u).sort((a, b) => Math.abs(a.u + 100) - Math.abs(b.u + 100))[0] || plots[0];
  const fl0 = bI.findIndex((b, k) => flooded[k]);
  const dmg3 = damage.indexOf(3) >= 0 ? damage.indexOf(3) : 0;
  const A = {
    river: [520, wsurf(520), riverZ(520)], ridge: [80, hAtN(80, -560), -560], south: [300, hAtN(300, riverZ(300) + 60), riverZ(300) + 60],
    steep: [700, hAtN(700, -520), -520], alluvium: [-300, hAtN(-300, riverZ(-300) - 40), riverZ(-300) - 40],
    zone: [midPlot('res').cx, hAtG(midPlot('res').cx, midPlot('res').cz), midPlot('res').cz], buffer: [300, hAtG(300, riverZ(300) - 30), riverZ(300) - 30],
    platform, hub: hubs[4] || hubs[0], gauge: [gauges[2][0], hAtG(gauges[2][0], gauges[2][1]) + 26, gauges[2][1]],
    centre: [-40, hAtG(-40, riverZ(-40) - 95), riverZ(-40) - 95], flooded: fl0 >= 0 ? [bI[fl0].x, bI[fl0].y + 10, bI[fl0].z] : [0, 300, 200],
    shelter: shelters[0] ? [shelters[0][0], hAtG(...shelters[0]) + 18, shelters[0][1]] : platform, closed: closed[0] ? (() => { const p = roads.arterial[0].find((q) => hAtG(q[0], q[1]) < level(q[0]) + 0.5) || [0, 0]; return [p[0], hAtG(p[0], p[1]), p[1]]; })() : [0, 300, 200],
    dmg: [bI[dmg3].x, bI[dmg3].y + bI[dmg3].sy, bI[dmg3].z], fire: [bI[fireOrigin].x, bI[fireOrigin].y + 22, bI[fireOrigin].z], station: [station[0], hAtG(...station) + 20, station[1]],
    hydrant: [hydr[7][0], hAtG(...hydr[7]) + 9, hydr[7][1]],
  };
  const PINS = [
    ['gis', 0.0, 0.34, 'Imagery layer', 'south'], ['gis', 0.34, 0.67, 'DEM / DTM', 'ridge'], ['gis', 0.67, 1, 'Contours and drainage', 'river'],
    ['hazard', 0.0, 0.25, 'Flood susceptibility (simulated)', 'alluvium'], ['hazard', 0.25, 0.5, 'Landslide-prone slopes', 'steep'], ['hazard', 0.5, 0.75, 'Seismic amplification on alluvium', 'alluvium'], ['hazard', 0.75, 1, 'Composite risk', 'river'],
    ['zoning', 0.0, 0.5, 'Hazard zones kept as protected green', 'buffer'], ['zoning', 0.5, 1, 'Residential zone', 'zone'],
    ['iot', 0.5, 1, 'Neighbourhood hub', 'hub'], ['iot', 0.5, 1, 'City data platform', 'platform'], ['iot', 0.5, 1, 'River level gauge', 'gauge'],
    ['ai', 0.0, 0.25, 'Urban heat island (simulated)', 'centre'], ['ai', 0.25, 0.5, 'AQI hotspot along arterial', 'centre'], ['ai', 0.5, 0.75, 'Congestion near town centre', 'centre'], ['ai', 0.75, 1, 'High-consumption blocks', 'centre'],
    ['flood', 0.22, 0.55, 'Forecast flood extent in 3 h (simulated)', 'flooded'], ['flood', 0.4, 1, 'Evacuation shelter', 'shelter'], ['flood', 0.55, 1, 'Road closed', 'closed'],
    ['quake', 0.3, 1, 'Extensive damage (simulated)', 'dmg'],
    ['fire', 0.05, 1, 'Ignition', 'fire'], ['fire', 0.25, 1, 'Fire station', 'station'], ['fire', 0.4, 1, 'Hydrant', 'hydrant'],
  ];
  const pinEls = [];
  if (labelsEl) { labelsEl.innerHTML = ''; for (const d of PINS) { const el = document.createElement('div'); el.className = 'tc-pin'; el.innerHTML = '<span>' + d[3] + '</span>'; labelsEl.appendChild(el); pinEls.push({ d, el }); } }
  const v3 = new THREE.Vector3();
  function updatePins(ch, p) {
    const r = canvas.getBoundingClientRect(), W = r.width, H = r.height;
    for (const { d, el } of pinEls) {
      const on = d[0] === ch ? win(p, d[1], d[2], 0.04) : 0, a = A[d[4]];
      if (on < 0.03 || !a) { el.style.opacity = 0; continue; }
      v3.set(a[0], a[1], a[2]).project(camera); const sx = (v3.x * 0.5 + 0.5) * W, sy = (-v3.y * 0.5 + 0.5) * H;
      const vis = v3.z < 1 && sx > 30 && sx < W - 30 && sy > 60 && sy < H - 40; el.style.opacity = vis ? on : 0; el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
  }

  /* ---------------- timeline ---------------- */
  // terrain-city stage driven by chapter progress (consecutive stages only)
  const seq = (p, segs) => { for (let j = 0; j < segs.length; j++) { const [a, st] = segs[j], nb = segs[j + 1]; if (!nb || p < nb[0]) { if (nb && p > nb[0] - 0.08) return st + 0.7 + 0.3 * ((p - (nb[0] - 0.08)) / 0.08); return st; } } return segs[segs.length - 1][1]; };
  const baseStage = { gis: (p) => seq(p, [[0, 1], [0.34, 2], [0.67, 3]]), hazard: () => 1, zoning: (p) => seq(p, [[0, 8], [0.5, 9]]), iot: (p) => seq(p, [[0, 10], [0.42, 11]]), ai: () => 11, flood: () => 11, quake: () => 11, fire: () => 11 };

  let mode = opts.chapter || 'journey', ch = mode === 'journey' ? JOURNEY[0] : mode, chT = 0, playing = false, raf = 0, last = 0, time = 0, lastTint = '';
  const onChapter = opts.onChapter || (() => {}), onDash = opts.onDash || (() => {});
  let dashT = 0;
  const series = { temp: [], aqi: [], traffic: [], energy: [], rain: [], river: [] };

  function metrics(chp, p, t) {
    const n = (k, f) => Math.sin(t * f + k) * 0.5 + Math.sin(t * f * 2.3 + k * 2) * 0.25;
    const flood = chp === 'flood';
    const rain = flood ? (p < 0.1 ? lerp(2, 18, p / 0.1) : p < 0.3 ? lerp(18, 64, (p - 0.1) / 0.2) : p < 0.65 ? 64 - (p - 0.3) * 40 : lerp(50, 4, (p - 0.65) / 0.35)) : 1.5 + 1.2 * n(5, 0.4);
    const river = flood ? 1.4 + R * ss(0.15, 0.8, p) * 0.75 : 1.4 + 0.08 * n(6, 0.2);
    const alerts = [];
    if (flood && p > 0.2) alerts.push({ lvl: 'warn', txt: `Forecast: ${nFlood} buildings and ${closed.length} road sections at risk within 3 h` });
    if (flood && p > 0.4) alerts.push({ lvl: 'ok', txt: `Evacuation routes issued to ${shelters.length} shelters` });
    if (chp === 'quake' && p > 0.3) { const c = [0, 0, 0, 0]; damage.forEach((d) => c[d]++); alerts.push({ lvl: 'warn', txt: `Damage estimate: ${c[3]} extensive, ${c[2]} moderate, ${c[1]} slight, ${c[0]} none` }); }
    if (chp === 'fire' && p > 0.1) alerts.push({ lvl: 'warn', txt: 'Fire detected by building sensors; station alerted' });
    if (chp === 'fire' && p > 0.3) alerts.push({ lvl: 'ok', txt: 'Engine route set: about 4 min access (simulated)' });
    if (!alerts.length) alerts.push({ lvl: 'ok', txt: 'All systems normal' });
    return {
      temp: +(27.2 + 1.6 * n(1, 0.3) - (flood ? 3 * ss(0.05, 0.3, p) : 0)).toFixed(1),
      aqi: Math.round(88 + 22 * n(2, 0.25) - (flood ? 30 * ss(0.1, 0.4, p) : 0)),
      traffic: Math.round(58 + 18 * n(3, 0.35) + (flood && p > 0.4 ? 20 : 0)),
      energy: +(41 + 5 * n(4, 0.2)).toFixed(1),
      rain: +rain.toFixed(1), river: +river.toFixed(2), riverForecast: +(1.4 + R * 0.75).toFixed(2), forecast: flood && p > 0.18,
      sensors: sensorPos.length + gauges.length, alerts, chapter: chp, focus: { gis: null, hazard: null, zoning: null, iot: 'sensors', ai: ['temp', 'aqi', 'traffic', 'energy'][Math.min(3, Math.floor(p * 4))], flood: 'rain', quake: 'alerts', fire: 'alerts' }[chp],
    };
  }

  function apply(chp, p, t, dt) {
    // reset scenario layers
    const show = {};
    const set = (k, v) => (show[k] = Math.max(show[k] || 0, v));
    if (chp === 'hazard') { set('flood', win(p, 0, 0.25)); set('slide', win(p, 0.25, 0.5)); set('seismic', win(p, 0.5, 0.75)); set('risk', win(p, 0.75, 1)); }
    if (chp === 'zoning') set('flood', 0.55 * win(p, 0, 0.55));
    const iotOn = chp === 'iot' ? ss(0.5, 0.62, p) : ['ai', 'flood', 'quake', 'fire'].includes(chp) ? 1 : 0;
    if (chp === 'ai') { set('heat', win(p, 0, 0.25)); set('aqi', win(p, 0.25, 0.5)); }
    const traffic = chp === 'ai' ? Math.max(win(p, 0.5, 0.75), 0.35) : chp === 'iot' ? ss(0.6, 0.8, p) * 0.6 : chp === 'flood' ? 0.6 : 0;
    for (const k of ['flood', 'slide', 'seismic', 'risk']) { if (show[k] || hz[k].made) { const m = hz[k](); hz[k].made = true; setOp(m, (show[k] || 0) * 0.92); } }
    for (const [k, f] of [['heat', heat], ['aqi', aqi]]) { if (show[k] || f.made) { const m = f(); f.made = true; setOp(m, (show[k] || 0) * 0.9); } }
    // IoT
    sensorMesh.visible = links.visible = hubMesh.visible = pulses.visible = gaugeMesh.visible = iotOn > 0.01;
    sensorMesh.material.opacity = iotOn * (0.75 + 0.25 * Math.sin(t * 5)); links.material.opacity = iotOn * (chp === 'iot' ? 0.4 : chp === 'ai' ? 0.22 : 0.1); hubMesh.material.opacity = iotOn; gaugeMesh.material.opacity = iotOn;
    if (iotOn > 0.01) { let k = 0; arcs.forEach((a, h) => { for (let j = 0; j < 3; j++) { const f = ((t * 0.35 + j / 3 + h * 0.13) % 1), q = a[Math.floor(f * (a.length - 1))]; pulses.setMatrixAt(k++, m4.makeTranslation(q[0], q[1], q[2])); } }); pulses.instanceMatrix.needsUpdate = true; pulses.material.opacity = iotOn; }
    updateCars(dt, traffic);
    const tmap = chp === 'ai' ? win(p, 0.5, 0.75) : 0; trafficMap.visible = tmap > 0.01; trafficMap.material.opacity = 0.9 * tmap;
    // flood scenario
    const fl = chp === 'flood';
    updateRain(t, fl ? win(p, 0.02, 0.7, 0.06) : 0);
    if (fl || predicted.made) { const m = predicted(); predicted.made = true; setOp(m, fl ? 0.9 * win(p, 0.2, 0.6, 0.05) : 0); }
    const rise = fl ? R * ss(0.5, 0.82, p) * (1 - ss(0.94, 1, p)) : 0;
    water.visible = rise > 0.3; water.position.y = rise;
    const ev = fl ? ss(0.4, 0.55, p) * (1 - ss(0.95, 1, p)) : 0;
    evacRoutes.forEach((m) => { m.visible = ev > 0.01; m.material.opacity = ev * (0.65 + 0.35 * Math.sin(t * 6)); m.geometry.setDrawRange(0, Math.floor(m.userData.n * clamp01((p - 0.4) / 0.12) / 6) * 6); });
    shelterMesh.visible = ev > 0.01; shelterMesh.material.opacity = ev;
    closed.forEach((m) => { m.visible = fl && p > 0.55; m.material.opacity = 0.9 * ss(0.55, 0.6, p) * (1 - ss(0.95, 1, p)); });
    // building colours
    let key = 'orig', fn = null;
    if (chp === 'ai' && p > 0.75) { key = 'energy'; fn = energyCol; }
    if (fl && p > 0.3 && p < 0.97) { key = 'flood'; fn = (k) => (flooded[k] ? new THREE.Color(p > 0.55 ? '#d83a34' : '#f2a33c') : orig[k]); key += p > 0.55 ? 'b' : 'a'; }
    if (chp === 'quake' && p > 0.3) { key = 'quake'; fn = (k) => new THREE.Color(DMG[damage[k]]); }
    if (chp === 'fire') { const step = Math.floor(p * 40); key = 'fire' + step; fn = (k) => { const ig = igniteAt[k] + 0.08; return p > ig && p < 0.82 + igniteAt[k] * 0.2 ? new THREE.Color('#3a2a22') : orig[k]; }; }
    if (key !== lastTint) { setTint(fn); lastTint = key; }
    // quake shake
    shake = chp === 'quake' ? 18 * win(p, 0.08, 0.3, 0.03) : 0;
    // fire
    if (chp === 'fire') {
      let k2 = 0; bI.forEach((b, k) => { const ig = igniteAt[k] + 0.08, out = 0.82 + igniteAt[k] * 0.2; const on = p > ig && p < out ? 1 : 0; const sc = on * (0.8 + 0.3 * Math.sin(t * 9 + k)); m4.makeScale(sc || 0.0001, (sc || 0.0001) * (1 + 0.2 * Math.sin(t * 13 + k)), sc || 0.0001).setPosition(b.x, b.y + b.sy, b.z); flames.setMatrixAt(k2++, m4); });
      flames.instanceMatrix.needsUpdate = true; flames.visible = true;
      fireRouteMesh.visible = p > 0.25; fireRouteMesh.material.opacity = 0.9 * ss(0.25, 0.3, p); fireRouteMesh.geometry.setDrawRange(0, Math.floor(fireRouteMesh.userData.n * clamp01((p - 0.25) / 0.15) / 6) * 6);
      hydMesh.visible = p > 0.4; hydMesh.material.opacity = ss(0.4, 0.45, p);
    } else { flames.visible = false; fireRouteMesh.visible = false; hydMesh.visible = false; }
    // dashboard
    dashT -= dt; if (dashT <= 0) { dashT = 0.25; const m = metrics(chp, p, t); for (const k in series) { series[k].push(m[k]); if (series[k].length > 60) series[k].shift(); } m.series = series; onDash(m); }
  }

  function renderAt(chp, p, t, dt = 0) {
    apply(chp, p, t, dt);           // overlays first, then a single render of the base city
    tc.renderAt(baseStage[chp](p), t);
    updatePins(chp, p);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; time += dt;
    if (playing) {
      chT += dt; const dur = CHAPTERS[ch].dur;
      if (chT >= dur) { chT = 0; if (mode === 'journey') { ch = JOURNEY[(JOURNEY.indexOf(ch) + 1) % JOURNEY.length]; } onChapter(ch); }
    }
    renderAt(ch, Math.min(0.9999, chT / CHAPTERS[ch].dur), time, playing ? dt : 0);
  }

  onChapter(ch);
  return {
    get chapter() { return ch; }, get playing() { return playing; },
    play() { if (playing && raf) return; playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    pause() { playing = false; }, stopLoop() { cancelAnimationFrame(raf); raf = 0; }, resumeLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    setChapter(c, keepMode) { if (!keepMode) mode = JOURNEY.includes(c) && mode === 'journey' ? 'journey' : c; ch = c; chT = 0; onChapter(ch); if (!raf) renderAt(ch, 0, time); },
    setMode(m) { mode = m; },
    _scene: scene, renderAt, info: { buildings: bI.length, flooded: nFlood, shelters: shelters.length, rise: R },
    setBackground: (c) => tc.setBackground(c),
    dispose() { cancelAnimationFrame(raf); tc.dispose(); },
  };
}
