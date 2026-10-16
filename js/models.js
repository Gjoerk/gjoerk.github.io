// Wireframe models beside the project titles on the landing page.
// Each model is fine lines: front lines bright, hidden lines faint (an
// invisible depth-only body hides them from the front pass). The cherries
// and the pawn are ports of the models on tastecherry and Chess Companion.
// A row's model turns slowly, and faster and tinted blue while the row is
// hovered (or revealed on touch screens). Only models on screen render.

import * as THREE from "three";

const INK = new THREE.Color("#f2f2f2");
const HOT = new THREE.Color("#7cc8f5");
const TAU = Math.PI * 2;

// ---------- line helpers ----------

// Collects polylines as line-segment pairs.
class Lines {
  constructor() { this.segs = []; }
  line(pts) {
    for (let i = 0; i < pts.length - 1; i++) this.segs.push(...pts[i].toArray(), ...pts[i + 1].toArray());
  }
  ring(r, y, n = 72, at = (p) => p) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; pts.push(at(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)))); }
    this.line(pts);
  }
}

const occluderMaterial = () => new THREE.MeshBasicMaterial({
  colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
});

// Front and ghost passes over the same segments, with optional occluders.
function wire(lines, occluders = [], { front = 0.9, ghost = 0.13 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines.segs, 3));
  const mat = (opacity, depthTest) => new THREE.LineBasicMaterial({ color: INK.clone(), transparent: true, opacity, depthTest, depthWrite: false });
  const back = new THREE.LineSegments(geo, mat(ghost, false));
  const fore = new THREE.LineSegments(geo, mat(front, true));
  back.renderOrder = 0; fore.renderOrder = 2;
  const g = new THREE.Group();
  g.add(back);
  for (const o of occluders) { o.renderOrder = 1; g.add(o); }
  g.add(fore);
  return g;
}

// Rings and meridians around a lathe profile [[radius, height], ...].
function lathe(profile, { rings = 16, meridians = 18, ringAt = null } = {}) {
  const L = new Lines();
  const P = resample(profile, 200);
  const R = ringAt || resample(profile, rings + 2).slice(1, -1);
  for (const [r, y] of R) if (r > 0.01) L.ring(r, y);
  for (let k = 0; k < meridians; k++) {
    const a = (k / meridians) * TAU, c = Math.cos(a), s = Math.sin(a);
    L.line(P.map(([r, y]) => new THREE.Vector3(r * c, y, r * s)));
  }
  const occ = new THREE.Mesh(new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(Math.max(r - 0.004, 0), y)), 64), occluderMaterial());
  return { lines: L, occ };
}

// Even arc-length resampling of a 2D polyline.
function resample(P, n) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const out = []; let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (L[L.length - 1] * k) / (n - 1);
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const t = (s - L[j]) / (L[j + 1] - L[j] || 1);
    out.push([P[j][0] + (P[j + 1][0] - P[j][0]) * t, P[j][1] + (P[j + 1][1] - P[j][1]) * t]);
  }
  return out;
}

const shift = (P, dy, s = 1) => P.map(([r, y]) => [r * s, (y + dy) * s]);

// ---------- models (each about 2 units across, centred on the origin) ----------

// Chess Companion: Staunton pawn, same profile as the pawn on that page.
function pawn() {
  const P = [];
  const arc = (cx, cy, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const bez = (p0, c, p1, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; P.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } };
  const D = Math.PI / 2;
  P.push([0, 0], [0.25, 0]);
  arc(0.27, 0.022, 0.022, -D, 0, 4); arc(0.27, 0.04, 0.022, 0, D, 4);
  arc(0.255, 0.082, 0.018, -D, -0.2, 3); arc(0.246, 0.098, 0.022, -D * 0.6, D, 6);
  P.push([0.2, 0.13]);
  bez([0.2, 0.13], [0.092, 0.2], [0.082, 0.47], 18);
  P.push([0.12, 0.5]); arc(0.14, 0.52, 0.026, -D, D, 8); P.push([0.072, 0.556]);
  const r = 0.145, cy = 0.566 + Math.sqrt(r * r - 0.058 * 0.058);
  arc(0, cy, r, -Math.acos(0.058 / r), D, 22);
  const h = P[P.length - 1][1];
  const { lines, occ } = lathe(shift(P, -h / 2, 2.25), { rings: 20, meridians: 18 });
  return { group: wire(lines, [occ]), spin: 0.45 };
}

// tastecherry: the pair of cherries with stems and a leaf from that site.
function cherries() {
  const L = new Lines();
  const occluders = [];
  const PROFILE = new THREE.SplineCurve([
    [0.0, -0.45], [0.14, -0.44], [0.36, -0.36], [0.5, -0.14], [0.52, 0.08], [0.44, 0.29], [0.24, 0.4], [0.08, 0.36], [0.0, 0.31],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const TOP = PROFILE.getPointAt(1);
  const onFruit = (v, phi) => {
    const p = PROFILE.getPointAt(v), r = p.x + 0.002;
    return new THREE.Vector3(r * Math.cos(phi), p.y, -r * Math.sin(phi));
  };
  const fruits = [
    { at: new THREE.Vector3(-0.33, -0.6, 0.1), scale: 0.74, lean: 0.12, turn: 0.4 },
    { at: new THREE.Vector3(0.35, -0.72, -0.08), scale: 0.7, lean: -0.1, turn: 1.9 },
  ];
  const tops = [];
  for (const f of fruits) {
    const m = new THREE.Matrix4().compose(f.at, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.turn, f.lean)), new THREE.Vector3().setScalar(f.scale));
    const tf = (p) => p.applyMatrix4(m);
    const RINGS = 9, MERIDIANS = 14;
    for (let k = 1; k < RINGS; k++) {
      const v = 0.04 + 0.86 * (k / RINGS), ring = [];
      for (let i = 0; i <= 64; i++) ring.push(tf(onFruit(v, (i / 64) * TAU)));
      L.line(ring);
    }
    for (let j = 0; j < MERIDIANS; j++) {
      const phi = (j / MERIDIANS) * TAU, mer = [];
      for (let i = 0; i <= 40; i++) mer.push(tf(onFruit(0.01 + 0.97 * (i / 40), phi)));
      L.line(mer);
    }
    const occ = new THREE.Mesh(new THREE.LatheGeometry(PROFILE.getSpacedPoints(48), 48), occluderMaterial());
    occ.applyMatrix4(m);
    occluders.push(occ);
    tops.push(tf(new THREE.Vector3(0, TOP.y + 0.02, 0)));
  }
  // stems: arc up from each fruit to a shared joint, drawn as thin tubes
  const joint = new THREE.Vector3(-0.06, 0.34, 0.02);
  const stems = [
    new THREE.CatmullRomCurve3([tops[0], new THREE.Vector3(-0.3, -0.12, 0.07), new THREE.Vector3(-0.18, 0.18, 0.04), joint]),
    new THREE.CatmullRomCurve3([tops[1], new THREE.Vector3(0.33, -0.24, -0.05), new THREE.Vector3(0.14, 0.16, -0.02), joint]),
  ];
  for (const curve of stems) {
    const frames = curve.computeFrenetFrames(30, false);
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * TAU, pts = [];
      for (let i = 0; i <= 30; i++) {
        const p = curve.getPointAt(i / 30);
        pts.push(p.add(frames.normals[i].clone().multiplyScalar(Math.cos(a) * 0.02).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a) * 0.02))));
      }
      L.line(pts);
    }
  }
  // leaf at the joint: outline, midrib and veins
  const up = new THREE.Vector3(0, 1, 0);
  const leafLen = 0.82, leafW = 0.24;
  const leafDir = new THREE.Vector3(-0.85, 0.28, -0.3).normalize();
  const flatSide = new THREE.Vector3().crossVectors(leafDir, up).normalize();
  const flatUp = new THREE.Vector3().crossVectors(flatSide, leafDir).normalize();
  const tilt = 1.05;
  const leafSide = flatSide.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(flatUp, Math.sin(tilt)).normalize();
  const leafUp = new THREE.Vector3().crossVectors(leafSide, leafDir).normalize();
  const leafAt = (t, x) => {
    const half = leafW * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.15 * t);
    return joint.clone().addScaledVector(leafDir, t * leafLen).addScaledVector(leafSide, x * half).addScaledVector(leafUp, -0.28 * t * t + 0.08 * x * x);
  };
  const outline = [];
  for (let i = 0; i <= 28; i++) outline.push(leafAt(i / 28, -1));
  for (let i = 28; i >= 0; i--) outline.push(leafAt(i / 28, 1));
  L.line(outline);
  L.line(Array.from({ length: 29 }, (_, i) => leafAt(i / 28, 0)));
  for (let k = 1; k <= 5; k++) {
    for (const side of [-1, 1]) L.line(Array.from({ length: 7 }, (_, i) => leafAt(Math.min(k / 6.5 + (i / 6) * 0.12, 1), side * (i / 6) * 0.85)));
  }
  const g = wire(L, occluders);
  g.scale.setScalar(1.4);
  g.position.y = 0.18;
  return { group: g, spin: 0.4 };
}

// DeepStem: a sphere split into four bands, the stems, that drift apart.
function stems() {
  const group = new THREE.Group();
  const bands = [];
  const N = 4;
  for (let k = 0; k < N; k++) {
    // band k spans latitudes so that each band has the same height
    const y0 = -1 + (2 * k) / N, y1 = -1 + (2 * (k + 1)) / N;
    const prof = [[0, y0]];
    for (let i = 0; i <= 24; i++) { const y = y0 + ((y1 - y0) * i) / 24; prof.push([Math.sqrt(Math.max(1 - y * y, 0)), y]); }
    prof.push([0, y1]);
    const ringAt = [0, 0.33, 0.66, 1].map((t) => { const y = y0 + (y1 - y0) * t; return [Math.sqrt(Math.max(1 - y * y, 0)), y]; });
    const { lines, occ } = lathe(prof, { meridians: 16, ringAt });
    const band = wire(lines, [occ]);
    band.userData.mid = (y0 + y1) / 2;
    bands.push(band);
    group.add(band);
  }
  group.scale.setScalar(0.86);
  const tick = (t, h) => {
    const gap = 0.07 + 0.04 * Math.sin(t * 1.3) + 0.16 * h;
    bands.forEach((b, k) => {
      b.position.y = (k - (N - 1) / 2) * gap;
      b.rotation.y = Math.sin(t * 0.6 + k) * 0.25 * (0.4 + h);
    });
  };
  return { group, spin: 0.35, tick, fit: 1.6 };
}

// Minecrawler: a classic spiked mine.
function mine() {
  const R = 0.6;
  const prof = [];
  for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 40; prof.push([R * Math.cos(a), R * Math.sin(a)]); }
  const { lines, occ } = lathe(prof, { rings: 9, meridians: 14 });
  const occluders = [occ];
  // spikes along the twelve icosahedron directions
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");
  const dirs = [];
  for (let i = 0; i < ico.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(ico, i).normalize();
    if (!dirs.some((d) => d.distanceTo(v) < 1e-3)) dirs.push(v);
  }
  const Y = new THREE.Vector3(0, 1, 0);
  for (const d of dirs) {
    const q = new THREE.Quaternion().setFromUnitVectors(Y, d);
    const at = (p) => p.applyQuaternion(q);
    const base = 0.56, tip = 0.98, rb = 0.075;
    lines.ring(rb, base, 16, at);
    lines.ring(0.03, tip - 0.02, 10, at);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      lines.line([at(new THREE.Vector3(rb * Math.cos(a), base, rb * Math.sin(a))), at(new THREE.Vector3(0.03 * Math.cos(a), tip - 0.02, 0.03 * Math.sin(a)))]);
    }
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.028, rb - 0.004, tip - 0.02 - base, 12), occluderMaterial());
    cone.position.y = (base + tip - 0.02) / 2;
    cone.applyQuaternion(q); cone.position.applyQuaternion(q);
    occluders.push(cone);
  }
  const g = wire(lines, occluders);
  g.scale.setScalar(0.98);
  g.rotation.z = 0.3;
  return { group: g, spin: 0.5 };
}

// MakerWorld: a vase that prints itself layer by layer, with the nozzle.
function vase() {
  const curve = new THREE.SplineCurve([[0.42, -1], [0.62, -0.72], [0.7, -0.3], [0.55, 0.15], [0.33, 0.55], [0.3, 0.78], [0.42, 1]].map(([x, y]) => new THREE.Vector2(x, y)));
  const LAYERS = 46, SEG = 64;
  const layers = curve.getSpacedPoints(LAYERS - 1);
  const L = new Lines();
  L.ring(0.42, -1, SEG);                              // the base outline
  for (const p of layers) L.ring(p.x, p.y, SEG);
  const occ = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, -1), ...curve.getSpacedPoints(48).map((p) => new THREE.Vector2(p.x - 0.004, p.y))], 48), occluderMaterial());
  const g = wire(L, [occ]);
  const perRing = SEG * 2;                            // vertices per ring
  const lineObjs = g.children.filter((c) => c.isLineSegments);
  // nozzle: a short cone that follows the current layer
  const nozzle = new THREE.Group();
  const N = new Lines();
  N.ring(0.06, 0.22, 16); N.ring(0.015, 0.02, 8);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; N.line([new THREE.Vector3(0.06 * Math.cos(a), 0.22, 0.06 * Math.sin(a)), new THREE.Vector3(0.015 * Math.cos(a), 0.02, 0.015 * Math.sin(a))]); }
  N.line([new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0, 0.4, 0)]);
  nozzle.add(wire(N, []));
  g.add(nozzle);
  g.scale.setScalar(1.02);
  const PRINT = 7, HOLD = 1.6;
  const tick = (t) => {
    const c = (t % (PRINT + HOLD)) / PRINT;
    const p = Math.min(c, 1);
    const shown = 1 + Math.floor(p * LAYERS);
    for (const o of lineObjs) o.geometry.setDrawRange(0, Math.min(shown, LAYERS + 1) * perRing);
    const layer = layers[Math.min(shown - 1, LAYERS - 1)];
    const a = (c * PRINT * 5) % TAU;
    nozzle.visible = c < 1;
    nozzle.position.set(layer.x * Math.cos(a), layer.y, layer.x * Math.sin(a));
  };
  return { group: g, spin: 0.3, tick };
}

// SoundCloud: a vinyl record spinning on its spindle, tilted towards you.
function vinyl() {
  const L = new Lines();
  const T = 0.025;
  for (const y of [-T, T]) L.ring(1, y, 96);
  for (let r = 0.4; r < 0.97; r += 0.045) L.ring(r, T, 80);
  L.ring(0.34, T + 0.002, 64); L.ring(0.2, T + 0.002, 48); L.ring(0.035, T + 0.002, 16);
  // print on the label, so the spin shows
  for (const [a, r0, r1] of [[0.3, 0.22, 0.32], [0.45, 0.24, 0.3], [2.5, 0.22, 0.3], [3.9, 0.21, 0.32], [4.05, 0.24, 0.29]]) {
    L.line([new THREE.Vector3(r0 * Math.cos(a), T + 0.002, r0 * Math.sin(a)), new THREE.Vector3(r1 * Math.cos(a), T + 0.002, r1 * Math.sin(a))]);
  }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; L.line([new THREE.Vector3(Math.cos(a), -T, Math.sin(a)), new THREE.Vector3(Math.cos(a), T, Math.sin(a))]); }
  const occ = new THREE.Mesh(new THREE.CylinderGeometry(0.995, 0.995, T * 2 - 0.004, 64), occluderMaterial());
  const disc = wire(L, [occ], { ghost: 0.08 });
  const g = new THREE.Group();
  g.add(disc);
  g.rotation.x = 0.95;
  g.scale.setScalar(0.95);
  const tick = (t, h, dt) => { disc.rotation.y -= dt * (0.9 + 2.4 * h); };
  return { group: g, spin: 0, sway: true, tick };
}

// nyon.space: the Neon Core, a glowing core with its ring, the shield arc
// circling it and anomalies flying in from outside.
function core() {
  const sphere = (R, rings, meridians) => {
    const prof = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 24; prof.push([R * Math.cos(a), R * Math.sin(a)]); }
    return lathe(prof, { rings, meridians });
  };
  const c = sphere(0.3, 7, 12);
  c.lines.ring(0.42, 0, 72); c.lines.ring(0.47, 0, 72);   // the ring around the core
  const body = wire(c.lines, [c.occ]);
  // shield: a curved band over 110 degrees of a circle around the core
  const S = new Lines(), half = (55 * Math.PI) / 180;
  const arc = (r, y) => S.line(Array.from({ length: 41 }, (_, i) => { const a = -half + (2 * half * i) / 40; return new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)); }));
  for (const r of [0.9, 1.0]) for (const y of [-0.07, 0.07]) arc(r, y);
  for (const a of [-half, half]) {
    const p = (r, y) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
    S.line([p(0.9, -0.07), p(1.0, -0.07), p(1.0, 0.07), p(0.9, 0.07), p(0.9, -0.07)]);
  }
  const shield = wire(S, []);
  // anomalies: small spheres that fly in towards the core and start over
  const anomalies = Array.from({ length: 4 }, (_, k) => {
    const a = sphere(0.055, 3, 6);
    const o = wire(a.lines, [a.occ]);
    o.userData = { dir: (k / 4) * TAU + 0.6, off: k * 0.37 };
    return o;
  });
  const g = new THREE.Group();
  g.add(body, shield, ...anomalies);
  g.rotation.x = 0.55;
  const tick = (t, h) => {
    shield.rotation.y = -t * (0.8 + 1.2 * h);
    for (const o of anomalies) {
      const { dir, off } = o.userData;
      const u = (t * 0.28 + off) % 1;                 // 0: far out, 1: at the core
      const r = 1.7 - 1.25 * u, d = dir + Math.floor(t * 0.28 + off) * 2.1;
      o.position.set(r * Math.cos(d), Math.sin(d * 3) * 0.1, r * Math.sin(d));
      o.visible = u < 0.92;
    }
  };
  return { group: g, spin: 0, sway: true, tick, fit: 1.8, size: 2.1 };
}

const MODELS = { cherries, stems, pawn, mine, vase, vinyl, core };

// ---------- one small renderer per row ----------

function mount(el, still) {
  const make = MODELS[el.dataset.model];
  if (!make) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.95, 4.4);
  camera.lookAt(0, 0, 0);
  const model = make();
  // centre the model and fit it to the frame, whatever size it was built at
  model.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.group);
  const dims = box.getSize(new THREE.Vector3());
  const inner = new THREE.Group(), fit = new THREE.Group(), pivot = new THREE.Group();
  inner.add(model.group);
  // models whose parts move around (the core's shield) give their full size instead
  if (!model.size) inner.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
  fit.add(inner);
  fit.scale.setScalar((model.fit || 1.95) / (model.size || Math.max(dims.x, dims.y, dims.z)));
  pivot.add(fit);
  scene.add(pivot);
  const mats = [];
  model.group.traverse((o) => { if (o.isLineSegments) mats.push(o.material); });

  const row = el.closest(".ix-row");
  let target = 0, h = 0, yaw = Math.random() * TAU, visible = false;
  const set = (v) => () => { target = v; };
  row.addEventListener("pointerenter", set(1));
  row.addEventListener("pointerleave", set(0));
  row.addEventListener("focus", set(1));
  row.addEventListener("blur", set(0));

  const size = () => {
    const w = el.clientWidth, hgt = el.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(size).observe(el);
  size();

  const frame = (t, dt) => {
    if (!visible) return;
    if (row.classList.contains("on")) target = 1;
    h += (target - h) * Math.min(dt * 4, 1);
    yaw += dt * (model.spin + 0.9 * h * (model.spin ? 1 : 0));
    pivot.rotation.y = model.sway ? Math.sin(t * 0.4) * 0.35 : yaw;
    pivot.position.y = Math.sin(t * 1.1) * 0.03;
    model.tick?.(t, h, dt);
    for (const m of mats) m.color.lerpColors(INK, HOT, h);
    renderer.render(scene, camera);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && still) { size(); frame(0, 0); }
  }).observe(el);
  return frame;
}

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const frames = [...document.querySelectorAll(".ix-model[data-model]")].map((el) => mount(el, still)).filter(Boolean);
if (frames.length && !still) {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const f of frames) f(now / 1000, dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
