'use strict';
/* Minecrawler: roguelike Minesweeper. See DESIGN.md for the rules this implements. */
(() => {
const T = 16;
const $ = id => document.getElementById(id);
const now = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (n, cls) => Sprites.img(n, cls);
const isTouch = matchMedia('(pointer: coarse)').matches;

/* ---------------- storage ---------------- */
const META_KEY = 'minecrawler.meta.v1', RUN_KEY = 'minecrawler.run.v1';
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
const meta = Object.assign({ best: [], maxDepth: 0, wins: 0, runs: 0, sound: true, daily: {} }, lsGet(META_KEY) || {});
const saveMeta = () => lsSet(META_KEY, meta);
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------------- seeded RNG (all gameplay randomness goes through R) ---------------- */
function makeRng(state) {
  let s = state >>> 0;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.get = () => s;
  return f;
}
let R = makeRng(Date.now());
const ri = n => Math.floor(R() * n);
const pick = a => a[ri(a.length)];
const chance = p => R() < p;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weighted(obj) { const e = Object.entries(obj); let t = R() * e.reduce((s, [, w]) => s + w, 0); for (const [k, w] of e) { if ((t -= w) < 0) return k; } return e[0][0]; }
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------------- sound ---------------- */
const Snd = (() => {
  let ac = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, d = .08, type = 'square', vol = .05, slide = 0, delay = 0) {
    if (!meta.sound) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  function noise(d = .4, vol = .25, lp = 1200) {
    if (!meta.sound) return; const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  const seq = (notes, d, step, type = 'square', vol = .045) => notes.forEach((f, i) => tone(f, d, type, vol, 0, i * step));
  return {
    unlock: ctx,
    click: () => tone(900, .03, 'square', .03),
    open: n => tone(380 + Math.min(n, 40) * 10, .07, 'triangle', .06, 220),
    flag: () => { tone(660, .05, 'square', .035); tone(990, .06, 'square', .035, 0, .05); },
    unflag: () => tone(500, .05, 'square', .03, -200),
    coin: () => { tone(988, .06, 'square', .035); tone(1319, .12, 'square', .035, 0, .06); },
    gem: () => seq([1047, 1319, 1568, 2093], .08, .05, 'square', .03),
    heal: () => seq([523, 659, 784], .1, .07, 'triangle', .06),
    boom: () => { noise(.6, .35, 900); tone(120, .4, 'sawtooth', .07, -80); },
    dud: () => { noise(.25, .12, 500); tone(200, .15, 'triangle', .05, -120); },
    hurt: () => tone(220, .25, 'square', .05, -150),
    shift: () => { noise(.7, .14, 220); tone(60, .6, 'sawtooth', .05, -20); },
    clear: () => seq([523, 659, 784, 1047, 784, 1047], .12, .09),
    buy: () => { tone(1200, .05, 'square', .035); tone(1600, .1, 'square', .035, 0, .05); },
    deny: () => tone(150, .15, 'square', .05),
    die: () => seq([392, 349, 330, 294, 262], .18, .15),
    win: () => seq([523, 523, 523, 698, 880, 784, 880, 1047], .14, .12),
    item: () => tone(700, .15, 'triangle', .06, 500),
    stairs: () => seq([784, 659, 523, 392], .09, .07, 'triangle', .06),
  };
})();

/* ---------------- game data ---------------- */
const ITEMS = {
  probe: { name: 'Probe', price: 6, w: 3, desc: 'Check one tile safely. A mine gets flagged instead of exploding.', target: true },
  sonar: { name: 'Sonar', price: 12, w: 2, desc: 'Safely uncover a 3×3 area. Mines inside get flagged.', target: true },
  potion: { name: 'Potion', price: 9, w: 2, desc: 'Heal 1 HP.' },
  lantern: { name: 'Lantern', price: 7, w: 2, desc: 'Briefly lights up every mine on the floor.' },
  shield: { name: 'Shield', price: 9, w: 2, desc: 'Blocks the next mine you trigger.' },
  compass: { name: 'Compass', price: 5, w: 1.5, desc: 'Shows where the stairs are.' },
};
const RELICS = {
  hardhat: { name: 'Hard Hat', desc: '+1 max HP.', gain: r => { r.maxHp++; r.hp++; } },
  clover: { name: 'Four-Leaf Clover', desc: '1 in 4 mines you trigger is a dud.' },
  goldpan: { name: 'Gold Pan', desc: '+50% gold from coins and gems.' },
  magnet: { name: 'Magnet', desc: 'Taking the stairs early still collects every item left on the floor.' },
  canary: { name: 'Canary', desc: 'Flags 2 random mines at the start of each floor.' },
  medkit: { name: 'Medkit', desc: 'Heal 1 HP whenever you fully clear a floor.' },
  map: { name: "Miner's Map", desc: 'The stairs are marked at the start of each floor.' },
  specs: { name: 'Spectacles', desc: 'You can read smudged numbers.' },
  stopwatch: { name: 'Stopwatch', desc: 'Cave-in timers are 50% longer. Mines shift half as often.' },
  piggy: { name: 'Piggy Bank', desc: 'Earn 10% interest on your gold at each stairwell (max 15).' },
  backpack: { name: 'Backpack', desc: '+1 item slot.', gain: r => { r.slots++; } },
  boots: { name: 'Steel-Toe Boots', desc: 'The first mine you trigger on each floor deals no damage.' },
  rod: { name: 'Dowsing Rod', desc: 'Every 30 tiles you uncover, a random mine gets flagged.' },
  coupon: { name: 'Coupon', desc: 'Shop prices are 25% off.' },
};
const CHARS = {
  sweeper: { name: 'The Sweeper', icon: 'face_smile', hp: 3, gold: 0, items: ['probe'], relics: [], desc: 'Steady and reliable. Starts with a Probe.' },
  prospector: { name: 'The Prospector', icon: 'goldpan', hp: 2, gold: 15, items: ['compass'], relics: ['goldpan'], desc: 'Greedy. Gold Pan, Compass and 15 gold.', unlock: { depth: 4, text: 'Reach Depth 4 to unlock.' } },
  engineer: { name: 'The Engineer', icon: 'backpack', hp: 2, gold: 0, items: ['sonar', 'probe', 'lantern'], relics: ['backpack'], desc: 'Gadgets. Backpack, Sonar, Probe and Lantern.', unlock: { depth: 7, text: 'Reach Depth 7 to unlock.' } },
  daredevil: { name: 'The Daredevil', icon: 'clover', hp: 1, gold: 0, items: [], relics: ['clover', 'boots'], goldMult: 2, desc: 'Lives on luck. Clover, Steel-Toe Boots, double gold.', unlock: { win: true, text: 'Win a run to unlock.' } },
};
const MODS = {
  smudged: { name: 'Smudged', desc: 'Some numbers are smudged into "?". You can\'t chord on them.' },
  volatile: { name: 'Volatile', desc: 'Mines deal 2 damage.' },
  goldrush: { name: 'Gold Rush', desc: 'Three times the coins.' },
  timed: { name: 'Cave-in', desc: 'Beat the countdown or the ceiling falls on you (1 damage), then it resets.' },
  shifting: { name: 'Shifting', desc: 'Unflagged mines creep to a neighbouring tile every few seconds. Correct flags pin mines in place.' },
  crowded: { name: 'Crowded', desc: '20% more mines, but a heart is hidden here.' },
  blind: { name: 'Pitch Black', desc: 'Your first click opens just one tile.' },
};
const DOORS = {
  shop: { name: 'Shop', icon: 'coin', desc: 'Buy items and relics.' },
  shrine: { name: 'Shrine', icon: 'heart', desc: 'Heal, or make an offering.' },
  chest: { name: 'Chest', icon: 'chest', desc: 'Free loot.' },
  gamble: { name: 'Gambler', icon: 'dice', desc: 'Feeling lucky?' },
  vault: { name: 'Vault', icon: 'gem', desc: 'Next floor: more mines, triple coins.' },
};
const FLOORS = [null, [9, 9, 10], [10, 10, 14], [11, 11, 18], [12, 12, 22], [13, 12, 26], [14, 13, 31], [15, 14, 37], [16, 14, 42], [16, 16, 48], [18, 16, 54]];
const floorConfig = d => d <= 10 ? FLOORS[d] : [18, 16, Math.min(54 + (d - 10) * 3, 90)];

function isUnlocked(id) {
  const u = CHARS[id].unlock;
  if (!u) return true;
  if (u.depth) return meta.maxDepth >= u.depth;
  if (u.win) return meta.wins > 0;
  return false;
}

/* ---------------- state ---------------- */
let run = null;       // the run in progress
let F = null;         // the current floor
let room = null;      // {type, data} while a between-floor screen is open
let targeting = null; // {slot, id} while aiming a Probe/Sonar
let flagMode = false;
let hover = -1, press = null, mouseL = false, mouseR = false;
let fx = [];
let faceTemp = null, faceHold = false;
let minimized = false;

const has = id => !!run && run.relics.includes(id);
const hasMod = m => !!F && !!F.mods && F.mods.includes(m);
const dialogOpen = () => $('dlgLayer').children.length > 0;
const canPlay = () => run && F && !F.demo && !F.over && !room && !dialogOpen() && !minimized;

/* ---------------- runs & floors ---------------- */
function newRun(charId, daily = false) {
  closeAllDialogs();
  const seed = daily ? hashStr('minecrawler-' + todayStr()) : (Math.random() * 2 ** 32) >>> 0;
  R = makeRng(seed);
  const ch = CHARS[charId];
  run = {
    char: charId, daily, dailyDate: daily ? todayStr() : null, hp: ch.hp, maxHp: ch.hp, gold: ch.gold, depth: 0,
    items: [...ch.items], slots: 3, relics: [], shield: 0, endless: false, won: false, winBonus: 0, vaultNext: false,
    goldMult: ch.goldMult || 1, recorded: false, unlockedAtStart: Object.keys(CHARS).filter(isUnlocked),
    stats: { gold: 0, tiles: 0, hits: 0, cleared: 0, items: 0, time: 0 },
  };
  ch.relics.forEach(id => gainRelic(id, true));
  meta.runs++; saveMeta();
  prevHp = run.hp; prevGold = run.gold;
  enterFloor(1);
}

function pickMods(d) {
  if (d === 10) return ['shifting', 'smudged'];
  if (d <= 2) return [];
  const all = Object.keys(MODS);
  const pool = d <= 3 ? ['goldrush', 'smudged', 'crowded'] : all;
  const out = [];
  const add = p => { const left = p.filter(m => !out.includes(m)); if (left.length) out.push(pick(left)); };
  if (d > 10) { add(all); add(all); return out; }
  if (d % 3 === 0) { add(pool); if (d >= 9) add(pool); return out; }
  if (d >= 4 && chance(.45)) add(pool);
  return out;
}
const shiftInterval = () => (F.boss ? 10000 : 15000) * (has('stopwatch') ? 2 : 1);
const caveTime = () => 30000 * (has('stopwatch') ? 1.5 : 1);

function enterFloor(d) {
  closeAllDialogs();
  room = null; targeting = null;
  run.depth = d;
  if (d > meta.maxDepth) { meta.maxDepth = d; saveMeta(); }
  const [cols, rows, base] = floorConfig(d);
  F = { depth: d, cols, rows, mods: [], cells: [] };
  F.mods = pickMods(d);
  F.vault = run.vaultNext; run.vaultNext = false;
  let mines = base;
  if (hasMod('crowded')) mines = Math.round(mines * 1.2);
  if (F.vault) mines = Math.round(mines * 1.25);
  mines = Math.min(mines, cols * rows - 12);
  Object.assign(F, {
    cells: Array.from({ length: cols * rows }, () => ({ m: 0, a: 0, r: 0, f: 0, x: 0, sm: 0, it: null })),
    mineCount: mines, safeTotal: cols * rows - mines, started: false, over: false, cleared: false, dead: false,
    boss: d === 10, guardian: d < 10 && d % 3 === 0, elapsed: 0, timeLeft: 0, shiftT: 0, stairs: -1,
    stairsKnown: false, stairsFound: false, bootsUsed: false, revealedSafe: 0, rodCount: 0, flags: 0, hits: 0, lastRa: 0,
  });
  if (hasMod('timed')) F.timeLeft = Math.round(cols * rows * 500 * (has('stopwatch') ? 1.5 : 1));
  F.shiftT = shiftInterval();
  fx = []; $('fx').innerHTML = '';
  setupBoard();
  updateHUD();
  const tags = [];
  if (F.boss) tags.push("THE MINE KING'S HOARD");
  else if (F.guardian) tags.push('GUARDIAN');
  if (F.vault) tags.push('VAULT');
  F.mods.forEach(m => tags.push(MODS[m].name.toUpperCase()));
  showBanner(`DEPTH ${d}`, tags.join(' · '));
  status(F.mods.length ? F.mods.map(m => `${MODS[m].name}: ${MODS[m].desc}`).join('  ') : defaultHint());
  save();
}

function nb(i) {
  const { cols, rows } = F, x = i % cols, y = (i / cols) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
  }
  return out;
}
const recalc = i => { F.cells[i].a = nb(i).reduce((s, j) => s + F.cells[j].m, 0); };

function generate(first) {
  const C = F.cells, n = C.length;
  const excl = new Set([first]);
  if (!hasMod('blind')) nb(first).forEach(i => excl.add(i));
  const cand = shuffle([...Array(n).keys()].filter(i => !excl.has(i)));
  const count = Math.min(F.mineCount, cand.length);
  for (let k = 0; k < count; k++) C[cand[k]].m = 1;
  F.mineCount = count; F.safeTotal = n - count;
  for (let i = 0; i < n; i++) recalc(i);
  const safe = shuffle(cand.slice(count));
  if (!F.boss && safe.length) { F.stairs = safe.pop(); C[F.stairs].it = 'stairs'; }
  const put = (it, k) => { for (let j = 0; j < k && safe.length; j++) C[safe.pop()].it = it; };
  put('heart', hasMod('crowded') ? 1 : chance(.3) ? 1 : 0);
  put('bag', chance(.45) ? 1 : 0);
  put('gem', (F.vault ? 2 : chance(.55) ? 1 : 0) + (F.boss ? 2 : 0));
  put('coin', Math.round(F.safeTotal * .05 * (hasMod('goldrush') ? 3 : 1) * (F.vault ? 3 : 1)));
  if (hasMod('smudged')) C.forEach(c => { if (!c.m && c.a > 0 && c.it !== 'stairs' && chance(F.boss ? .12 : .18)) c.sm = 1; });
  F.started = true;
  if (has('canary')) autoFlag(2, 'Canary!');
  if (has('map') && F.stairs >= 0) F.stairsKnown = true;
}

function autoFlag(k, label) {
  const C = F.cells;
  const cand = shuffle(C.map((c, i) => i).filter(i => C[i].m && !C[i].f && !C[i].r));
  const t = now();
  cand.slice(0, k).forEach((i, n) => {
    C[i].f = 1; C[i].fa = t + n * 150; F.flags++;
    setTimeout(() => { addFx({ type: 'spark', i }); floatAt(i, label, 'info'); }, n * 150);
  });
}

/* ---------------- player actions ---------------- */
function primary(i) {
  if (i < 0 || !canPlay()) return;
  if (targeting) return useTarget(i);
  const c = F.cells[i];
  if (c.r) {
    if (c.it === 'stairs') return askDescend();
    return chord(i);
  }
  if (flagMode) return toggleFlag(i);
  dig(i);
}

function dig(i) {
  const c = F.cells[i];
  if (c.r || c.f) return;
  if (!F.started) generate(i);
  if (c.m) triggerMine(i);
  else Snd.open(revealFrom([i]));
  after();
}

function chord(i) {
  if (!canPlay()) return;
  const c = F.cells[i];
  if (!c.r || c.x) return;
  if (c.sm && !has('specs')) { status("That number is smudged, so you can't chord on it."); return; }
  const ns = nb(i), C = F.cells;
  if (ns.filter(j => C[j].f || C[j].x).length !== c.a) return;
  const hidden = ns.filter(j => !C[j].r && !C[j].f);
  if (!hidden.length) return;
  const safe = hidden.filter(j => !C[j].m), bad = hidden.filter(j => C[j].m);
  if (safe.length) Snd.open(revealFrom(safe));
  for (const j of bad) { if (F.over) break; triggerMine(j); }
  after();
}

function toggleFlag(i) {
  if (i < 0 || !canPlay()) return;
  if (targeting) { cancelTarget(); return; }
  const c = F.cells[i];
  if (c.r) return;
  c.f = c.f ? 0 : 1; F.flags += c.f ? 1 : -1; c.fa = now();
  c.f ? Snd.flag() : Snd.unflag();
  after();
}

// Reveal safe cells (flood fill from zeros). Returns how many were uncovered.
function revealFrom(starts) {
  const C = F.cells, t = now(), dist = new Map(), q = [];
  for (const s of starts) if (!C[s].r && !C[s].f && !C[s].m && !dist.has(s)) { dist.set(s, 0); q.push(s); }
  let count = 0;
  while (q.length) {
    const i = q.shift(), c = C[i];
    if (c.r) continue;
    const d = dist.get(i);
    c.r = 1; c.ra = t + d * 28; count++;
    F.revealedSafe++; run.stats.tiles++;
    F.lastRa = Math.max(F.lastRa, c.ra);
    if (c.it === 'stairs') {
      if (!F.stairsFound) { F.stairsFound = true; setTimeout(() => { floatAt(i, 'Stairs!', 'info'); Snd.stairs(); updateHUD(); }, c.ra - t); }
    } else if (c.it) {
      const it = c.it; c.it = null;
      const p = grantPickup(it);
      setTimeout(() => { floatAt(i, p.txt, p.cls, p.icon); p.snd(); }, c.ra - t + 40);
    }
    if (c.a === 0) for (const n of nb(i)) {
      if (!dist.has(n) && !C[n].r && !C[n].f && !C[n].m) { dist.set(n, d + 1); q.push(n); }
    }
  }
  if (has('rod') && count) {
    F.rodCount += count;
    while (F.rodCount >= 30) { F.rodCount -= 30; autoFlag(1, 'Rod!'); }
  }
  return count;
}

function grantPickup(it) {
  const mult = (has('goldpan') ? 1.5 : 1) * run.goldMult;
  if (it === 'coin') return { txt: '+' + gainGold((1 + ri(3)) * mult), cls: 'gold', icon: 'coin', snd: Snd.coin };
  if (it === 'gem') return { txt: '+' + gainGold(8 * mult), cls: 'gold', icon: 'gem', snd: Snd.gem };
  if (it === 'heart') {
    if (run.hp < run.maxHp) { heal(1); return { txt: '+1', cls: 'good', icon: 'heart', snd: Snd.heal }; }
    return { txt: '+' + gainGold(5), cls: 'gold', icon: 'coin', snd: Snd.coin };
  }
  if (it === 'bag') {
    const id = randomItem();
    if (addItem(id)) return { txt: ITEMS[id].name, cls: 'info', icon: id, snd: Snd.item };
    return { txt: '+' + gainGold(5), cls: 'gold', icon: 'coin', snd: Snd.coin };
  }
  return { txt: '', cls: '', icon: 'coin', snd: () => {} };
}

function triggerMine(i) {
  const c = F.cells[i];
  c.r = 1; c.x = 1; c.ra = now(); F.hits++; run.stats.hits++;
  let blocked = null;
  if (run.shield > 0) { run.shield--; blocked = 'Blocked!'; }
  else if (has('boots') && !F.bootsUsed) { F.bootsUsed = true; blocked = 'Steel toes!'; }
  else if (has('clover') && chance(.25)) blocked = 'Dud!';
  if (blocked) {
    c.dud = 1;
    addFx({ type: 'puff', i }); Snd.dud(); floatAt(i, blocked, 'info'); shake(false); updateHUD();
  } else {
    addFx({ type: 'boom', i, parts: debris(i) }); Snd.boom(); shake(true);
    damage(hasMod('volatile') ? 2 : 1, i);
  }
}

function damage(n, i) {
  run.hp = Math.max(0, run.hp - n);
  setFace('hurt', 700); setTimeout(Snd.hurt, 120);
  if (i != null) floatAt(i, '-' + n, 'bad', 'heart');
  updateHUD();
  if (run.hp <= 0) die();
}
function heal(n) { run.hp = Math.min(run.maxHp, run.hp + n); updateHUD(); }
function gainGold(g) { g = Math.round(g); run.gold += g; run.stats.gold += g; updateHUD(); return g; }
function addItem(id) { if (run.items.length >= run.slots) return false; run.items.push(id); updateHUD(); return true; }
function randomItem() { return weighted(Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.w]))); }
function randomRelics(k) { return shuffle(Object.keys(RELICS).filter(id => !has(id))).slice(0, k); }
function gainRelic(id, silent) {
  if (!id || has(id)) return;
  run.relics.push(id);
  RELICS[id].gain?.(run);
  run.newRelic = id;
  if (!silent) { Snd.item(); status(`${RELICS[id].name}: ${RELICS[id].desc}`); }
  updateHUD();
}

function after() {
  updateHUD();
  if (F && F.started && !F.over && F.revealedSafe >= F.safeTotal) floorCleared();
  save();
}

function die() {
  F.over = true; F.dead = true; targeting = null;
  setFace('dead');
  setTimeout(Snd.die, 350);
  run.stats.time += F.elapsed;
  const result = finishRun();
  setTimeout(() => showGameOver(result), 1400);
}

function floorCleared() {
  F.over = true; F.cleared = true; targeting = null;
  const t = now(), start = Math.max(t, F.lastRa);
  let k = 0;
  F.cells.forEach(c => { if (c.m && !c.f && !c.x) { c.f = 1; c.fa = start + (k++) * 30; F.flags++; } });
  const bonus = gainGold(5 + F.depth * 3);
  run.stats.cleared++;
  run.stats.time += F.elapsed;
  let healed = false;
  if (has('medkit') && run.hp < run.maxHp) { heal(1); healed = true; }
  F.clearInfo = { bonus, healed };
  setFace();
  updateHUD();
  save();
  setTimeout(Snd.clear, start - t);
  setTimeout(() => showClearDialog(), start - t + k * 30 + 600);
}

function askDescend() {
  if (!canPlay()) return;
  const lose = [];
  lose.push('the clear bonus');
  if (F.guardian) lose.push('the Guardian relic');
  dialog({
    title: 'Take the stairs?',
    body: `<div class="row">${img('stairs', 'big')}<div><p>Leave Depth ${F.depth} now?</p><p>You'll miss ${lose.join(' and ')}${has('magnet') ? '. Your Magnet still pulls in everything left on this floor.' : ', and anything still buried here.'}</p></div></div>`,
    buttons: [{ label: 'Descend', def: true, click: descend }, { label: 'Stay', cancel: true }],
  });
}

function descend() {
  if (!F || F.over) return;
  F.over = true; targeting = null;
  run.stats.time += F.elapsed;
  if (has('magnet')) {
    let got = 0;
    F.cells.forEach(c => { if (c.it && c.it !== 'stairs' && !c.r) { grantPickup(c.it); c.it = null; got++; } });
    if (got) status(`Your Magnet pulled in ${got} item${got > 1 ? 's' : ''}.`);
  }
  Snd.stairs();
  toStairwell();
}

/* ---------------- items ---------------- */
function useItem(slot) {
  if (!canPlay()) return;
  const id = run.items[slot];
  if (!id) return;
  if (targeting && targeting.slot === slot) { cancelTarget(); return; }
  const it = ITEMS[id];
  const needsBoard = !['potion', 'shield'].includes(id);
  if (needsBoard && !F.started) { status('Open your first tile before using that.'); Snd.deny(); return; }
  if (it.target) {
    targeting = { slot, id };
    $('field').classList.add('target');
    status(`${it.name}: pick a tile. Right click or Esc to cancel.`);
    updateHUD();
    return;
  }
  if (id === 'potion') {
    if (run.hp >= run.maxHp) { status("You're already at full health."); Snd.deny(); return; }
    heal(1); Snd.heal();
  } else if (id === 'shield') {
    run.shield++; Snd.item(); status('Shield up. The next mine you trigger is blocked.');
  } else if (id === 'lantern') {
    addFx({ type: 'lantern', dur: 1700 }); Snd.item(); status('The lantern flares…');
  } else if (id === 'compass') {
    if (F.stairs < 0) { status('There are no stairs on this floor.'); Snd.deny(); return; }
    if (F.stairsFound || F.stairsKnown) { status('You already know where the stairs are.'); Snd.deny(); return; }
    F.stairsKnown = true; addFx({ type: 'spark', i: F.stairs }); Snd.item(); status('The needle points to the stairs.');
  }
  consumeItem(slot);
  after();
}
function consumeItem(slot) { run.items.splice(slot, 1); run.stats.items++; }
function cancelTarget() { targeting = null; $('field').classList.remove('target'); status(defaultHint()); updateHUD(); }

function useTarget(i) {
  const { slot, id } = targeting, C = F.cells, c = C[i];
  const flagIt = (j, delay = 0) => { if (!C[j].f) { C[j].f = 1; F.flags++; } C[j].fa = now() + delay; };
  if (id === 'probe') {
    if (c.r) { status('Pick a covered tile.'); Snd.deny(); return; }
    consumeItem(slot); cancelTarget();
    if (c.m) { flagIt(i); addFx({ type: 'spark', i }); floatAt(i, 'Mine!', 'info'); Snd.flag(); }
    else { if (c.f) { c.f = 0; F.flags--; } Snd.open(revealFrom([i])); }
  } else if (id === 'sonar') {
    consumeItem(slot); cancelTarget();
    const safe = [];
    [i, ...nb(i)].forEach(j => {
      if (C[j].r) return;
      if (C[j].m) flagIt(j, 120);
      else { if (C[j].f) { C[j].f = 0; F.flags--; } safe.push(j); }
    });
    addFx({ type: 'ring', i }); Snd.item();
    revealFrom(safe);
  }
  after();
}

/* ---------------- floor hazards ---------------- */
function shiftMines() {
  const C = F.cells, t = now();
  const movable = shuffle(C.map((c, i) => i).filter(i => C[i].m && !C[i].f && !C[i].x));
  const want = F.boss ? 3 : 2, touched = new Set();
  let moved = 0;
  for (const i of movable) {
    if (moved >= want) break;
    const tg = nb(i).filter(j => !C[j].m && !C[j].r && !C[j].f && !C[j].it);
    if (!tg.length) continue;
    const j = pick(tg);
    C[i].m = 0; C[j].m = 1; moved++;
    [i, j, ...nb(i), ...nb(j)].forEach(k => touched.add(k));
  }
  if (!moved) return;
  touched.forEach(k => { const old = C[k].a; recalc(k); if (C[k].r && C[k].a !== old) C[k].fl = t; });
  Snd.shift(); shake(false);
  status('The ground shifts… Flash = changed number.');
  save();
}

function caveIn() {
  F.timeLeft = caveTime();
  addFx({ type: 'rocks', parts: rocks() }); Snd.boom(); shake(true);
  floatAt(Math.floor(F.rows / 2) * F.cols + Math.floor(F.cols / 2), 'Cave-in!', 'bad');
  damage(1, null);
}

/* ---------------- between floors ---------------- */
const priceOf = p => Math.ceil(p * (has('coupon') ? .75 : 1));

function toStairwell() {
  let interest = 0;
  if (has('piggy')) interest = gainGold(Math.min(15, Math.floor(run.gold * .1)));
  let doors;
  if (run.depth === 9 && !run.endless) doors = ['shop', 'shrine'];
  else {
    const w = { shop: 3, shrine: 2, chest: 2, gamble: 1.5, vault: 1.5 };
    doors = [];
    while (doors.length < 3) { const d = weighted(w); delete w[d]; doors.push(d); }
  }
  room = { type: 'stairwell', data: { doors, interest } };
  save();
  showRoom();
}

function chooseDoor(type) {
  if (type === 'vault') { run.vaultNext = true; return nextFloor(); }
  const d = run.depth, data = {};
  if (type === 'shop') {
    const ids = shuffle(Object.keys(ITEMS)).slice(0, 4);
    data.stock = ids.map(id => ({ kind: 'item', id, price: priceOf(ITEMS[id].price + Math.floor(d / 4)), sold: false }));
    const rel = randomRelics(1)[0];
    if (rel) data.stock.push({ kind: 'relic', id: rel, price: priceOf(36 + d * 2), sold: false });
    data.stock.push({ kind: 'heal', id: 'potion', price: priceOf(10), sold: false });
  }
  if (type === 'chest') {
    data.gold = 8 + ri(10) + d; data.item = randomItem(); data.relic = chance(.2) ? randomRelics(1)[0] || null : null; data.opened = false;
  }
  if (type === 'gamble') { data.bet = false; data.bag = false; data.log = []; }
  if (type === 'shrine') { data.used = null; data.relic = randomRelics(1)[0] || null; }
  room = { type, data };
  save();
  showRoom();
}

function nextFloor() { room = null; enterFloor(run.depth + 1); }

function victory() {
  run.won = true; run.winBonus = 500 + 50 * run.hp;
  meta.wins++; saveMeta();
  room = { type: 'victory', data: {} };
  save();
  Snd.win();
  showRoom();
}

/* ---------------- scoring ---------------- */
function scoreParts() {
  const s = run.stats, parts = [['Gold earned', s.gold], [`Depth ${run.depth} reached`, 50 * (run.depth - 1)], [`${s.cleared} floor${s.cleared === 1 ? '' : 's'} cleared`, 25 * s.cleared]];
  if (run.won) parts.push(['Found the Motherlode', run.winBonus]);
  return parts;
}
function finishRun() {
  const parts = scoreParts(), total = parts.reduce((a, [, v]) => a + v, 0);
  let rank = -1, unlocked = [];
  if (!run.recorded) {
    run.recorded = true;
    const entry = { score: total, depth: run.depth, char: run.char, win: run.won, daily: run.daily, date: todayStr() };
    meta.best.push(entry);
    meta.best.sort((a, b) => b.score - a.score);
    meta.best = meta.best.slice(0, 10);
    rank = meta.best.indexOf(entry);
    if (run.daily) meta.daily[run.dailyDate] = Math.max(meta.daily[run.dailyDate] || 0, total);
    saveMeta();
    unlocked = Object.keys(CHARS).filter(id => isUnlocked(id) && !run.unlockedAtStart.includes(id));
  }
  lsSet(RUN_KEY, null);
  return { parts, total, rank, unlocked };
}

/* ---------------- save / load ---------------- */
function save() {
  if (!run || run.recorded) return;
  const f = F && !F.demo ? { ...F, cells: F.cells.map(({ m, a, r, f, x, sm, it, dud }) => ({ m, a, r, f, x, sm, it, dud })) } : null;
  lsSet(RUN_KEY, { v: 1, rng: R.get(), run, F: f, room });
}
function load() {
  const s = lsGet(RUN_KEY);
  if (!s || s.v !== 1 || !s.run || !s.F) return false;
  run = s.run; F = s.F; room = s.room; R = makeRng(s.rng);
  prevHp = run.hp; prevGold = run.gold;
  return true;
}

/* ---------------- rendering: board ---------------- */
const cv = $('board'), g = cv.getContext('2d');
const S = Sprites.get;

function setupBoard() {
  cv.width = F.cols * T; cv.height = F.rows * T;
  cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
  layout();
}

function pressedCells() {
  const out = new Set();
  if (!press || press.i < 0 || !canPlay() || targeting) return out;
  const c = F.cells[press.i];
  if (press.chordOnly || c.r) {
    if (!c.r && !c.f) out.add(press.i);
    nb(press.i).forEach(j => { if (!F.cells[j].r && !F.cells[j].f) out.add(j); });
  } else if (!c.f) out.add(press.i);
  return out;
}

function draw(t) {
  if (!F) return;
  g.imageSmoothingEnabled = false;
  const C = F.cells, cols = F.cols, pressed = pressedCells();
  const lantern = fx.find(e => e.type === 'lantern');
  const lanternOn = lantern && Math.floor((t - lantern.t0) / 120) % 4 !== 3;
  const area = new Set();
  if (targeting && hover >= 0) { area.add(hover); if (targeting.id === 'sonar') nb(hover).forEach(j => area.add(j)); }
  for (let i = 0; i < C.length; i++) {
    const c = C[i], x = (i % cols) * T, y = ((i / cols) | 0) * T;
    const shown = c.r && !(c.ra > t);
    if (!shown) {
      const flagVisible = c.f && !(c.fa > t);
      g.drawImage(S(pressed.has(i) ? 'tileOpen' : 'tileHidden'), x, y);
      if (F.dead && c.m && !c.f) { g.drawImage(S('tileOpen'), x, y); g.drawImage(S('mine'), x, y); }
      else if (F.dead && c.f && !c.m) { g.drawImage(S('tileOpen'), x, y); g.drawImage(S('mineX'), x, y); }
      else if (flagVisible) {
        let oy = 0;
        const k = c.fa ? (t - c.fa) / 220 : 1;
        if (k < 1) oy = k < .6 ? Math.round(-8 * (1 - k / .6) ** 2) : Math.round(-2 * Math.sin((k - .6) / .4 * Math.PI));
        g.drawImage(S('flag'), x, y + oy);
      } else if (F.stairsKnown && c.it === 'stairs') {
        g.globalAlpha = .45 + .25 * Math.sin(t / 250); g.drawImage(S('stairs'), x, y); g.globalAlpha = 1;
      }
      if (lanternOn && c.m && !c.f) { g.globalAlpha = .85; g.drawImage(S('mineGhost'), x, y); g.globalAlpha = 1; }
    } else {
      if (c.x) { g.drawImage(S(c.dud ? 'tileOpen' : 'tileRed'), x, y); g.drawImage(S('mine'), x, y); }
      else {
        g.drawImage(S('tileOpen'), x, y);
        if (c.it === 'stairs') { g.drawImage(S('stairs'), x, y); if (c.a) g.drawImage(S('tiny' + c.a), x + 12, y + 10); }
        else if (c.a) g.drawImage(S(c.sm && !has('specs') ? 'num?' : 'num' + c.a), x, y);
      }
      if (c.ra && t - c.ra < 130) {
        const s = Math.round(T * (1 - (t - c.ra) / 130));
        if (s > 1) { const o = ((T - s) / 2) | 0; g.drawImage(S('tileHidden'), x + o, y + o, s, s); }
      }
      if (c.fl && t - c.fl < 900) {
        const k = (t - c.fl) / 900;
        if (Math.floor(k * 6) % 2 === 0) { g.fillStyle = `rgba(255,255,0,${.65 * (1 - k)})`; g.fillRect(x + 1, y + 1, T - 1, T - 1); }
      }
    }
    if (area.has(i)) {
      g.fillStyle = 'rgba(0,0,255,.22)'; g.fillRect(x, y, T, T);
      if (i === hover) { g.strokeStyle = '#0000ff'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, T - 1, T - 1); }
    }
  }
  drawFx(t);
}

/* ---------------- rendering: effects ---------------- */
function addFx(e) { e.t0 = e.t0 ?? now(); fx.push(e); }
function cellCenter(i) { return [(i % F.cols) * T + 8, ((i / F.cols) | 0) * T + 8]; }
function debris(i) {
  const [cx, cy] = cellCenter(i), cols = ['#fff', '#ff0', '#f80', '#f00', '#555', '#222'];
  return Array.from({ length: 22 }, () => {
    const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, c: cols[(Math.random() * cols.length) | 0], s: Math.random() < .4 ? 2 : 1 };
  });
}
function rocks() {
  return Array.from({ length: 34 }, () => ({ x: Math.random() * F.cols * T, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 20, vy: 40 + Math.random() * 60, c: ['#5a3010', '#808080', '#404040', '#a0682c'][(Math.random() * 4) | 0], s: 2 + ((Math.random() * 2) | 0) }));
}
function disc(cx, cy, r, colorAt) {
  const R0 = Math.ceil(r);
  for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > r) continue;
    const col = colorAt(d / Math.max(r, .01), dx, dy);
    if (col) { g.fillStyle = col; g.fillRect(cx + dx, cy + dy, 1, 1); }
  }
}
function drawFx(t) {
  fx = fx.filter(e => {
    const age = t - e.t0;
    if (e.type === 'boom') {
      const D = 700;
      if (age > D) return false;
      const [cx, cy] = cellCenter(e.i), k = age / D;
      if (k < .55) {
        const r = 3 + 12 * Math.sqrt(k / .55);
        const ring = k < .12 ? ['#fff', '#fff', '#ff0'] : k < .3 ? ['#fff', '#ff0', '#f80'] : ['#ff0', '#f80', '#c00'];
        disc(cx, cy, r, (q, dx, dy) => (q > .85 && (dx + dy) & 1) ? null : ring[q < .4 ? 0 : q < .75 ? 1 : 2]);
      } else {
        const kk = (k - .55) / .45;
        disc(cx, cy - kk * 6, 12 * (1 - kk * .4), (q, dx, dy) => ((dx * 3 + dy * 5 + Math.floor(kk * 8)) % 3 === 0 || q > 1 - kk) ? null : (q < .5 ? '#666' : '#333'));
      }
      const tt = age / 1000;
      e.parts.forEach(p => { g.fillStyle = p.c; g.fillRect(Math.round(p.x + p.vx * tt), Math.round(p.y + p.vy * tt + 160 * tt * tt), p.s, p.s); });
      return true;
    }
    if (e.type === 'puff') {
      if (age > 500) return false;
      const [cx, cy] = cellCenter(e.i), k = age / 500;
      disc(cx, cy - k * 8, 3 + k * 6, (q, dx, dy) => ((dx + dy) & 1 && q > .5) ? null : (k < .5 ? '#ddd' : '#999'));
      return true;
    }
    if (e.type === 'spark') {
      if (age > 400) return false;
      const [cx, cy] = cellCenter(e.i), r = 2 + age / 400 * 9;
      g.fillStyle = age < 200 ? '#fff' : '#ff0';
      for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; g.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 2, 2); }
      return true;
    }
    if (e.type === 'ring') {
      if (age > 500) return false;
      const [cx, cy] = cellCenter(e.i), r = Math.round(4 + age / 500 * 22);
      g.strokeStyle = `rgba(0,255,120,${1 - age / 500})`; g.lineWidth = 2;
      g.strokeRect(cx - r, cy - r, r * 2, r * 2);
      return true;
    }
    if (e.type === 'rocks') {
      if (age > 1300) return false;
      const tt = age / 1000;
      e.parts.forEach(p => { g.fillStyle = p.c; g.fillRect(Math.round(p.x + p.vx * tt), Math.round(p.y + p.vy * tt + 120 * tt * tt), p.s, p.s); });
      return true;
    }
    if (e.type === 'lantern') return age < e.dur;
    return false;
  });
}

function floatAt(i, txt, cls = '', icon = null) {
  if (!F || i < 0 || i == null) return;
  const [cx, cy] = cellCenter(i);
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.style.left = cx + 'px'; el.style.top = (cy - 4) + 'px';
  el.innerHTML = (icon ? img(icon) : '') + `<span>${esc(txt)}</span>`;
  $('fx').append(el);
  setTimeout(() => el.remove(), 1050);
}
function shake(big) {
  const el = $('field');
  el.classList.remove('shake', 'big'); void el.offsetWidth;
  el.classList.add('shake'); if (big) el.classList.add('big');
}
function showBanner(a, b) {
  $('banner').innerHTML = `<div class="b-in"><div class="b1">${esc(a)}</div>${b ? `<div class="b2">${esc(b)}</div>` : ''}</div>`;
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => { $('banner').innerHTML = ''; }, 2200);
}

/* ---------------- HUD ---------------- */
let prevHp = 0, prevGold = 0;
const ledCache = new WeakMap();
function setLed(el, v) {
  const s = v < 0 ? '-' + String(Math.min(99, -v)).padStart(2, '0') : String(Math.min(999, v)).padStart(3, '0');
  if (ledCache.get(el) === s) return;
  ledCache.set(el, s);
  if (el.children.length !== 3) el.innerHTML = '<canvas width="13" height="23"></canvas>'.repeat(3);
  [...s].forEach((ch, k) => { const c = el.children[k].getContext('2d'); c.drawImage(S('led' + ch), 0, 0); });
}
function baseFace() {
  if (!F || F.demo) return 'smile';
  if (F.dead) return 'dead';
  if (F.cleared || (run && run.won && F.boss)) return 'cool';
  if (F.boss) return 'boss';
  return 'smile';
}
let faceShown = '';
function drawFace() {
  const k = faceHold && canPlay() ? 'oh' : faceTemp || baseFace();
  if (k === faceShown) return;
  faceShown = k;
  const c = $('face').getContext('2d'); c.clearRect(0, 0, 17, 17); c.drawImage(S('face_' + k), 0, 0);
  $('crown').hidden = !(F && F.boss);
}
function setFace(kind, ms) {
  faceTemp = kind || null;
  clearTimeout(setFace.t);
  if (ms) setFace.t = setTimeout(() => { faceTemp = null; }, ms);
}

function updateHUD() {
  if (!run) {
    $('hearts').innerHTML = ''; $('gold').innerHTML = ''; $('slots').innerHTML = ''; $('relics').innerHTML = '<span class="none">No run in progress.</span>';
    $('descendBtn').hidden = true; $('depthInfo').textContent = 'Depth –';
    return;
  }
  // hearts: animate lost/gained ones
  let h = '';
  for (let k = 0; k < run.maxHp; k++) {
    const full = k < run.hp;
    const cls = !full && k < prevHp ? 'break' : full && k >= prevHp ? 'gain' : '';
    h += `<span data-tip="HP ${run.hp}/${run.maxHp}">${img(full ? 'heart' : 'heartEmpty', cls)}</span>`;
  }
  for (let k = 0; k < run.shield; k++) h += `<span data-tip="Shield: blocks the next mine">${img('shield')}</span>`;
  if (run.hp !== prevHp || $('hearts').dataset.sig !== `${run.maxHp}/${run.shield}`) {
    $('hearts').innerHTML = h; $('hearts').dataset.sig = `${run.maxHp}/${run.shield}`;
  }
  prevHp = run.hp;
  const goldEl = $('gold');
  goldEl.innerHTML = `${img('coin')}<span>${run.gold}</span>`;
  goldEl.dataset.tip = `${run.gold} gold`;
  if (run.gold !== prevGold) { goldEl.classList.remove('bump'); void goldEl.offsetWidth; goldEl.classList.add('bump'); prevGold = run.gold; }
  // item slots
  let sl = '';
  for (let k = 0; k < run.slots; k++) {
    const id = run.items[k];
    if (id) sl += `<button class="slot${targeting && targeting.slot === k ? ' on' : ''}" data-slot="${k}" data-tip="${esc(`${ITEMS[id].name} [${k + 1}]: ${ITEMS[id].desc}`)}" aria-label="${ITEMS[id].name}">${img(id)}<span class="k">${k + 1}</span></button>`;
    else sl += `<span class="slot empty" data-tip="Empty item slot"></span>`;
  }
  $('slots').innerHTML = sl;
  $('flagBtn').classList.toggle('on', flagMode);
  $('descendBtn').hidden = !(F && F.stairsFound && !F.over && !F.demo);
  // relics
  $('relics').innerHTML = run.relics.length
    ? run.relics.map(id => `<span class="relic${run.newRelic === id ? ' new' : ''}" data-tip="${esc(`${RELICS[id].name}: ${RELICS[id].desc}`)}">${img(id)}</span>`).join('')
    : '<span class="none">No relics yet.</span>';
  run.newRelic = null;
  updateDepthInfo();
  if ($('win').offsetHeight !== lastWinH) layout();
}
let lastWinH = 0;
function updateDepthInfo() {
  if (!run || !F || F.demo) return;
  let s = run.endless || F.depth > 10 ? `Depth ${F.depth} ∞` : `Depth ${F.depth}/10`;
  if (F.mods.length) s += ' · ' + F.mods.map(m => MODS[m].name).join(', ');
  if (hasMod('shifting') && F.started && !F.over) s += ` · shift ${Math.ceil(F.shiftT / 1000)}s`;
  const el = $('depthInfo');
  if (el.textContent !== s) el.textContent = s;
}
function updateLeds() {
  if (!F) return;
  const left = F.demo ? 10 : F.mineCount - F.flags - F.cells.reduce((s, c) => s + (c.x && !c.f ? 1 : 0), 0);
  setLed($('ledMines'), left);
  const timed = hasMod('timed') && !F.over;
  const v = timed ? Math.ceil(F.timeLeft / 1000) : Math.floor((F.elapsed || 0) / 1000);
  setLed($('ledTime'), v);
  $('ledTime').classList.toggle('blink', timed && F.started && F.timeLeft < 10000);
  $('ledTime').title = timed ? 'Cave-in countdown' : 'Time';
}

let statusSticky = '';
function status(msg) { statusSticky = msg; $('status').textContent = msg; }
const defaultHint = () => isTouch ? 'Tap to dig · hold to flag · tap a number to chord.' : 'Left click to dig · right click to flag · click a number to chord.';

/* ---------------- input ---------------- */
function cellAt(e) {
  if (!F) return -1;
  const r = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * F.cols), y = Math.floor((e.clientY - r.top) / r.height * F.rows);
  return x >= 0 && y >= 0 && x < F.cols && y < F.rows ? y * F.cols + x : -1;
}
function demoClick() { if (F && F.demo && !dialogOpen()) openCharSelect(); }

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
  e.preventDefault(); Snd.unlock(); closeMenus();
  if (!canPlay()) return demoClick();
  const i = cellAt(e);
  if (e.button === 2) {
    if (targeting) return cancelTarget();
    if (mouseL) { press = { i, chordOnly: true }; mouseR = true; return; }
    mouseR = true;
    return toggleFlag(i);
  }
  if (e.button === 0) { mouseL = true; press = { i, chordOnly: mouseR }; faceHold = true; }
  if (e.button === 1) { press = { i, chordOnly: true, middle: true }; faceHold = true; }
});
window.addEventListener('mousemove', e => {
  hover = e.target === cv ? cellAt(e) : -1;
  if (press && !press.touch) press.i = hover;
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouseL = false;
  if (e.button === 2) mouseR = false;
  if (!press || press.touch) return;
  const p = press;
  if (p.chordOnly) {
    if (p.middle || (!mouseL && !mouseR)) { press = null; faceHold = false; if (p.i >= 0) chord(p.i); }
    return;
  }
  if (e.button === 0) { press = null; faceHold = false; primary(p.i); }
});

// Touch and pen: tap = dig (or flag in flag mode), hold = the other one.
let holdTimer = 0;
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  e.preventDefault(); Snd.unlock(); closeMenus();
  if (!canPlay()) return demoClick();
  const i = cellAt(e);
  press = { i, touch: true, id: e.pointerId };
  faceHold = true; hover = i;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (!press || !press.touch || press.i !== i) return;
    press.done = true; faceHold = false;
    navigator.vibrate?.(15);
    const c = F.cells[i];
    if (targeting) cancelTarget();
    else if (c.r) chord(i);
    else if (flagMode) dig(i);
    else toggleFlag(i);
  }, 330);
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' || !press || !press.touch) return;
  if (cellAt(e) !== press.i) { clearTimeout(holdTimer); press = null; faceHold = false; hover = -1; }
});
const endTouch = e => {
  if (e.pointerType === 'mouse' || !press || !press.touch) return;
  clearTimeout(holdTimer);
  const p = press; press = null; faceHold = false;
  if (e.type === 'pointerup' && !p.done) primary(p.i);
  if (!targeting) hover = -1;
};
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

window.addEventListener('keydown', e => {
  if (e.key === 'F2') { e.preventDefault(); openCharSelect(); return; }
  const top = $('dlgLayer').lastElementChild;
  if (top) {
    if (e.key === 'Escape') top._cancel?.();
    return;
  }
  if (e.key === 'Escape') { closeMenus(); if (targeting) cancelTarget(); return; }
  if (/^[1-9]$/.test(e.key) && run) useItem(+e.key - 1);
  if (e.key === 'f' || e.key === 'F') toggleFlagMode();
});
function toggleFlagMode() { flagMode = !flagMode; status(flagMode ? 'Flag mode on: taps place flags, hold to dig.' : defaultHint()); updateHUD(); }

$('slots').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { Snd.unlock(); useItem(+b.dataset.slot); } });
$('flagBtn').addEventListener('click', () => toggleFlagMode());
$('descendBtn').addEventListener('click', askDescend);
$('faceBtn').addEventListener('click', () => {
  Snd.unlock();
  if (!run || (F && F.dead)) return openCharSelect();
  if (room || dialogOpen()) return;
  confirmAbandon();
});
$('depthInfo').addEventListener('click', showFloorInfo);

// Status bar tips (hover on desktop, tap on touch).
document.addEventListener('mouseover', e => { const t = e.target.closest?.('[data-tip]'); if (t) $('status').textContent = t.dataset.tip; });
document.addEventListener('mouseout', e => { const t = e.target.closest?.('[data-tip]'); if (t && !t.contains(e.relatedTarget)) $('status').textContent = statusSticky; });
$('relics').addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t) status(t.dataset.tip); });
$('hearts').addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t) status(t.dataset.tip); });

/* ---------------- dialogs ---------------- */
const layer = $('dlgLayer');
function refreshLayer() {
  const n = layer.children.length;
  layer.classList.toggle('modal', n > 0);
  [...layer.children].forEach((d, k) => d.querySelector('.titlebar').classList.toggle('inactive', k < n - 1));
  $('titlebar').classList.toggle('inactive', n > 0);
}
let stillNext = false;
function dialog({ title, body, buttons = [], wide = false, onCancel }) {
  const el = document.createElement('div');
  el.className = 'win dlg' + (wide ? ' wide' : '') + (stillNext ? ' still' : '');
  stillNext = false;
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="titlebar"><span class="ttl">${esc(title)}</span><button class="tb-btn close" aria-label="Close">✕</button></div><div class="body"></div><div class="btns"></div>`;
  const bodyEl = el.querySelector('.body');
  const api = {
    el, body: bodyEl,
    close() { el.remove(); refreshLayer(); },
    setBody(h) { bodyEl.innerHTML = h; },
    setButtons(bs) {
      const row = el.querySelector('.btns');
      row.innerHTML = ''; row.hidden = !bs.length;
      bs.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'btn'; btn.innerHTML = b.html || esc(b.label); btn.disabled = !!b.disabled;
        btn.addEventListener('click', () => { Snd.click(); if (!b.keep) api.close(); b.click?.(); });
        row.append(btn);
        if (b.def) setTimeout(() => btn.focus(), 0);
        if (b.cancel) el._cancel = () => btn.click();
      });
    },
  };
  if (typeof body === 'string') bodyEl.innerHTML = body;
  api.setButtons(buttons);
  if (onCancel) el._cancel = () => { api.close(); onCancel(); };
  el.querySelector('.titlebar .close').addEventListener('click', () => { Snd.click(); if (el._cancel) el._cancel(); });
  layer.append(el);
  refreshLayer();
  return api;
}
function closeAllDialogs() { layer.innerHTML = ''; refreshLayer(); }

function confirmAbandon(then) {
  if (!run || run.recorded) return then ? then() : openCharSelect();
  dialog({
    title: 'Minecrawler',
    body: `<div class="row">${img('skull', 'big')}<div><p>Abandon this run?</p><p class="muted">The current run is lost and won't count toward the Hall of Fame.</p></div></div>`,
    buttons: [
      { label: 'Abandon', click: () => { lsSet(RUN_KEY, null); run = null; room = null; showDemo(); (then || openCharSelect)(); } },
      { label: 'Keep playing', def: true, cancel: true },
    ],
  });
}

function openCharSelect() {
  if (run && !run.recorded && !(F && F.dead)) return confirmAbandon(openCharSelect);
  closeAllDialogs();
  let sel = 'sweeper';
  const d = dialog({ title: 'New Run', wide: true, body: '', onCancel: () => { if (!run) showDemo(); } });
  const render = () => {
    const today = meta.daily[todayStr()];
    d.setBody(`<p><b>Choose your miner.</b> Go down ten floors of mines. A mine costs a heart, not the run.</p>
      <div class="choices">${Object.entries(CHARS).map(([id, c]) => {
        const ok = isUnlocked(id);
        return `<button class="choice${sel === id ? ' sel' : ''}" data-c="${id}" ${ok ? '' : 'disabled'}>${img(ok ? c.icon : 'skull')}
          <span class="col"><span class="t">${ok ? c.name : '???'}</span> <span class="pill">${ok ? img('heart').repeat(c.hp) : ''}</span><br>
          <span class="d">${ok ? c.desc : c.unlock.text}</span></span></button>`;
      }).join('')}</div>
      <p class="muted" style="margin:8px 0 0">Daily Dig: the same seeded run for everyone today, played as The Sweeper.${today ? ` Your best today: <b>${today}</b>.` : ''}</p>`);
    d.body.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { Snd.click(); sel = b.dataset.c; render(); }));
  };
  render();
  d.setButtons([
    { label: 'Start', def: true, click: () => newRun(sel) },
    { label: 'Daily Dig', click: () => newRun('sweeper', true) },
  ]);
}

function showClearDialog() {
  const info = F.clearInfo || { bonus: 0, healed: false };
  const tm = Math.floor(F.elapsed / 1000);
  dialog({
    title: F.boss ? 'The Hoard is yours!' : 'Floor cleared!',
    body: `<div class="row">${img('face_cool', 'big')}<div style="flex:1"><p><b>Depth ${F.depth} swept clean.</b></p>
      <table><tr><td>Time</td><td class="r">${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}</td></tr>
      <tr><td>Mines triggered</td><td class="r">${F.hits}</td></tr>
      <tr><td>Clear bonus</td><td class="r"><span class="pill">+${info.bonus} ${img('coin')}</span></td></tr>
      ${info.healed ? `<tr><td>Medkit</td><td class="r"><span class="pill">+1 ${img('heart')}</span></td></tr>` : ''}
      ${F.guardian ? '<tr><td colspan="2"><b>The Guardian drops a relic!</b></td></tr>' : ''}</table></div></div>`,
    buttons: [{ label: 'Continue', def: true, cancel: true, click: afterClear }],
  });
}
function afterClear() {
  if (F.boss && !run.won) return victory();
  if (F.guardian) {
    room = { type: 'relic', data: { choices: randomRelics(3) } };
    save();
    return showRoom();
  }
  toStairwell();
}

function showRoom() {
  stillNext = !!room && layer.lastElementChild?.dataset.room === room.type;
  closeAllDialogs();
  if (!room) return;
  const { type, data } = room;
  queueMicrotask(() => { const top = layer.lastElementChild; if (top) top.dataset.room = type; });
  if (type === 'stairwell') {
    const d = dialog({
      title: `Stairwell: below Depth ${run.depth}`, wide: true,
      body: `<p>${data.interest ? `Your Piggy Bank earned <b>${data.interest}</b> gold. ` : ''}${data.doors.length === 2 ? 'Two doors lead' : 'Three doors lead'} down to Depth ${run.depth + 1}. Pick one.</p>
        <div class="doors">${data.doors.map(k => `<button class="choice doorbtn" data-door="${k}"><span class="stack">${img('door')}${img(DOORS[k].icon, 'ico')}</span><span class="t">${DOORS[k].name}</span><span class="d">${DOORS[k].desc}</span></button>`).join('')}</div>`,
    });
    d.body.querySelectorAll('[data-door]').forEach(b => b.addEventListener('click', () => { Snd.click(); chooseDoor(b.dataset.door); }));
    return;
  }
  if (type === 'shop') return showShop();
  if (type === 'relic') {
    const d = dialog({
      title: 'Guardian relic', wide: true,
      body: `<p>Pick one relic. It stays with you for the rest of the run.</p><div class="choices">${data.choices.map(id => `<button class="choice" data-r="${id}">${img(id)}<span class="col"><span class="t">${RELICS[id].name}</span><br><span class="d">${RELICS[id].desc}</span></span></button>`).join('')}</div>`,
      buttons: [{ label: 'Skip (+10 gold)', click: () => { gainGold(10); toStairwell(); } }],
    });
    d.body.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { gainRelic(b.dataset.r); d.close(); toStairwell(); }));
    return;
  }
  if (type === 'shrine') {
    const opts = [
      { k: 'pray', t: 'Pray', dsc: 'Heal to full HP.', ok: run.hp < run.maxHp, icon: 'heart' },
      { k: 'blood', t: 'Offer blood', dsc: 'Lose 1 max HP. Gain a random relic.', ok: run.maxHp > 1 && !!data.relic, icon: 'skull' },
      { k: 'tithe', t: 'Tithe', dsc: `Pay ${priceOf(20)} gold for +1 max HP.`, ok: run.gold >= priceOf(20), icon: 'coin' },
    ];
    const d = dialog({
      title: 'Shrine', wide: true, buttons: [{ label: 'Leave', cancel: true, click: nextFloor }],
      body: data.used ? `<div class="row">${img('heart', 'big')}<p>${data.used}</p></div>`
        : `<p>A quiet shrine glows in the dark. It grants one wish.</p><div class="choices">${opts.map(o => `<button class="choice" data-s="${o.k}" ${o.ok ? '' : 'disabled'}>${img(o.icon)}<span class="col"><span class="t">${o.t}</span><br><span class="d">${o.dsc}</span></span></button>`).join('')}</div>`,
    });
    d.body.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.s;
      if (k === 'pray') { run.hp = run.maxHp; Snd.heal(); data.used = 'Warmth fills you. You are fully healed.'; }
      if (k === 'blood') { run.maxHp--; run.hp = Math.min(run.hp, run.maxHp); gainRelic(data.relic); data.used = `The shrine takes its price and gives you the <b>${RELICS[data.relic].name}</b>: ${RELICS[data.relic].desc}`; }
      if (k === 'tithe') { run.gold -= priceOf(20); run.maxHp++; run.hp++; Snd.heal(); data.used = 'Your gold melts into the altar. +1 max HP.'; }
      updateHUD(); save(); showRoom();
    }));
    return;
  }
  if (type === 'chest') {
    const loot = () => `<ul class="help-list"><li><span class="pill">+${data.gold} ${img('coin')}</span></li><li>${data.itemGot ? `<span class="pill">${img(data.item)} ${ITEMS[data.item].name}</span>` : `<span class="pill">${img(data.item)} ${ITEMS[data.item].name}</span> <span class="muted">(no room, sold for 5 gold)</span>`}</li>${data.relic ? `<li><span class="pill">${img(data.relic)} ${RELICS[data.relic].name}</span>: ${RELICS[data.relic].desc}</li>` : ''}</ul>`;
    const d = dialog({
      title: 'Chest', wide: true,
      body: data.opened ? `<div class="row">${img('chestOpen', 'big')}<div><p>Inside you find:</p>${loot()}</div></div>`
        : `<div class="row"><span id="chestIco">${img('chest', 'big')}</span><p>A dusty chest, half-buried in rubble.</p></div>`,
      buttons: data.opened ? [{ label: 'Continue', def: true, cancel: true, click: nextFloor }] : [{ label: 'Open it', def: true, keep: true, click: () => {
        d.setButtons([]);
        const ico = d.body.querySelector('#chestIco img'); ico.classList.add('wobble');
        setTimeout(() => {
          data.opened = true;
          gainGold(data.gold);
          data.itemGot = addItem(data.item);
          if (!data.itemGot) gainGold(5);
          if (data.relic) gainRelic(data.relic, true);
          Snd.gem(); save(); showRoom();
        }, 900);
      } }],
    });
    return;
  }
  if (type === 'gamble') {
    const bet = Math.max(5, Math.floor(run.gold / 2)), bagPrice = priceOf(10);
    const d = dialog({
      title: 'The Gambler', wide: true, buttons: [{ label: 'Leave', cancel: true, click: nextFloor }],
      body: `<div class="row">${img('dice', 'big')}<p>"Heh. Care for a little game, miner?"</p></div>
        <div class="choices">
          <button class="choice" data-g="bet" ${!data.bet && run.gold >= 5 ? '' : 'disabled'}>${img('coin')}<span class="col"><span class="t">Double or nothing</span><br><span class="d">Bet ${bet} gold on a coin flip.</span></span></button>
          <button class="choice" data-g="bag" ${!data.bag && run.gold >= bagPrice ? '' : 'disabled'}>${img('bag')}<span class="col"><span class="t">Mystery bag</span><br><span class="d">A random item, or sometimes a relic.</span></span><span class="price">${bagPrice} ${img('coin')}</span></button>
        </div>${data.log.length ? `<hr class="groove"><p>${data.log.join('<br>')}</p>` : ''}`,
    });
    d.body.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.g === 'bet') {
        data.bet = true;
        if (chance(.5)) { run.gold += bet; Snd.gem(); data.log.push(`Heads! You win <b>${bet}</b> gold.`); }
        else { run.gold -= bet; Snd.deny(); data.log.push(`Tails. You lose <b>${bet}</b> gold.`); }
      } else {
        data.bag = true; run.gold -= bagPrice;
        const rel = chance(.15) ? randomRelics(1)[0] : null;
        if (rel) { gainRelic(rel, true); Snd.gem(); data.log.push(`A relic! <b>${RELICS[rel].name}</b>: ${RELICS[rel].desc}`); }
        else { const id = randomItem(); if (addItem(id)) { Snd.item(); data.log.push(`You got a <b>${ITEMS[id].name}</b>.`); } else { run.gold += 5; data.log.push(`A ${ITEMS[id].name}, but your pack is full. He gives you 5 gold for it.`); } }
      }
      updateHUD(); save(); showRoom();
    }));
    return;
  }
  if (type === 'victory') {
    const parts = scoreParts(), total = parts.reduce((a, [, v]) => a + v, 0);
    dialog({
      title: 'You found the Motherlode!', wide: true,
      body: `<div class="row">${img('crown', 'big')}<div style="flex:1"><p><b>The Mine King's Hoard is yours.</b> You swept all ten floors.</p>
        <table>${parts.map(([k, v]) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`).join('')}<tr><td><b>Score so far</b></td><td class="r big-score">${total}</td></tr></table>
        <p style="margin-top:8px">Retire now and bank your score, or keep going into the endless depths. Every floor adds to the score, but dying there still ends the run.</p></div></div>`,
      buttons: [
        { label: 'Endless Descent', click: () => { run.endless = true; toStairwell(); } },
        { label: 'Retire', def: true, click: () => { const r = finishRun(); showGameOver(r, true); } },
      ],
    });
  }
}

function showShop() {
  const { data } = room;
  const canBuy = s => !s.sold && run.gold >= s.price && (s.kind !== 'item' || run.items.length < run.slots) && (s.kind !== 'heal' || run.hp < run.maxHp);
  const d = dialog({
    title: 'Shop: The Mole Merchant', wide: true, buttons: [{ label: 'Leave', cancel: true, click: nextFloor }],
    body: `<div class="row">${img('bag', 'big')}<div><p>"Psst. Fresh tools, cheap. Mostly not cursed."</p><p class="pill">You have ${run.gold} ${img('coin')} · slots ${run.items.length}/${run.slots}</p></div></div>
      <div class="choices">${data.stock.map((s, k) => {
        const name = s.kind === 'relic' ? RELICS[s.id].name : s.kind === 'heal' ? 'First aid' : ITEMS[s.id].name;
        const desc = s.kind === 'relic' ? `Relic. ${RELICS[s.id].desc}` : s.kind === 'heal' ? 'Heal 1 HP right now.' : ITEMS[s.id].desc;
        return `<button class="choice" data-k="${k}" ${canBuy(s) ? '' : 'disabled'}>${img(s.kind === 'heal' ? 'heart' : s.id)}<span class="col"><span class="t">${name}</span>${s.sold ? ' <span class="muted">(sold)</span>' : ''}<br><span class="d">${desc}</span></span><span class="price">${s.price} ${img('coin')}</span></button>`;
      }).join('')}</div>`,
  });
  d.body.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const s = data.stock[+b.dataset.k];
    if (!canBuy(s)) return;
    run.gold -= s.price; s.sold = true;
    if (s.kind === 'item') addItem(s.id);
    if (s.kind === 'relic') gainRelic(s.id, true);
    if (s.kind === 'heal') heal(1);
    Snd.buy(); updateHUD(); save(); showRoom();
  }));
}

function showGameOver(result, retired = false) {
  closeAllDialogs();
  const { parts, total, rank, unlocked } = result;
  const title = retired ? 'Retired in glory' : 'Game Over';
  const lead = retired ? `<b>You retire with the Motherlode.</b>` : `<b>BOOM!</b> You were blown up on Depth ${run.depth}.`;
  dialog({
    title, wide: true,
    body: `<div class="row">${img(retired ? 'crown' : 'skull', 'big')}<div style="flex:1"><p>${lead}</p>
      <table>${parts.map(([k, v]) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`).join('')}
      <tr><td><b>Score</b></td><td class="r big-score">${total}</td></tr></table>
      ${rank >= 0 ? `<p style="margin-top:8px">You placed <b>#${rank + 1}</b> in the Hall of Fame!</p>` : ''}
      ${run.daily ? `<p>Daily Dig best today: <b>${meta.daily[run.dailyDate]}</b></p>` : ''}
      ${unlocked.map(id => `<p class="pill">${img(CHARS[id].icon)} New miner unlocked: ${CHARS[id].name}!</p>`).join('')}</div></div>`,
    buttons: [
      { label: 'New Run', def: true, click: openCharSelect },
      { label: 'Hall of Fame', click: () => showHallOfFame(openCharSelect) },
    ],
  });
}

function showHallOfFame(then) {
  const rows = meta.best.map((b, k) => `<tr><td>${k + 1}.</td><td>${img(CHARS[b.char]?.icon || 'face_smile')}</td><td class="r"><b>${b.score}</b></td><td>D${b.depth}${b.win ? ' ' + img('crown') : ''}</td><td class="muted">${b.daily ? 'Daily ' : ''}${b.date}</td></tr>`).join('');
  const d = dialog({
    title: 'Hall of Fame', wide: true,
    body: `<p><b>Greatest Mine Crawlers</b></p><div class="inset">${rows ? `<table>${rows}</table>` : '<p class="muted" style="margin:0">No runs yet. Go dig!</p>'}</div>
      <table><tr><td>Runs started</td><td class="r">${meta.runs}</td></tr><tr><td>Deepest depth</td><td class="r">${meta.maxDepth}</td></tr><tr><td>Wins</td><td class="r">${meta.wins}</td></tr>
      <tr><td>Today's Daily Dig best</td><td class="r">${meta.daily[todayStr()] ?? '–'}</td></tr></table>`,
    buttons: [
      { label: 'Reset Scores', keep: true, click: () => dialog({ title: 'Reset Scores', body: '<p>Clear the Hall of Fame? Unlocked miners stay unlocked.</p>', buttons: [{ label: 'Reset', click: () => { meta.best = []; meta.daily = {}; saveMeta(); d.close(); showHallOfFame(then); } }, { label: 'Cancel', cancel: true, def: true }] }) },
      { label: 'OK', def: true, cancel: true, click: () => then?.() },
    ],
  });
}

function showHelp() {
  dialog({
    title: 'How to Play', wide: true,
    body: `<p><b>Minecrawler</b> is Minesweeper as a roguelike. Go down ten floors and find the Motherlode.</p>
      <ul class="help-list">
        <li>Numbers tell you how many of the 8 surrounding tiles hide a mine.</li>
        <li>A mine costs a <b>heart</b> instead of ending the game. At 0 hearts the run is over.</li>
        <li>Uncover every safe tile to <b>clear</b> a floor: bonus gold, and on Guardian floors (3, 6, 9) a relic.</li>
        <li>Or find the <b>stairs</b> ${img('stairs')} and leave early.</li>
        <li>Coins, gems, hearts and item bags are hidden under safe tiles.</li>
        <li>Between floors, pick a door: Shop, Shrine, Chest, Gambler or Vault.</li>
        <li>Depth 10 is the Mine King's Hoard. Clear it to win.</li>
      </ul>
      <p><b>Mouse:</b> left click digs, right click flags, click a number with all its flags placed (or press both buttons) to chord.<br>
      <b>Touch:</b> tap digs, hold flags, tap a number to chord. The flag button swaps tap and hold.<br>
      <b>Keys:</b> 1–4 use items, F toggles flag mode, F2 starts a new run, Esc cancels.</p>`,
    buttons: [{ label: 'OK', def: true, cancel: true }],
  });
}
function showCatalog() {
  const row = (ic, n, d) => `${img(ic)}<div><b>${n}</b>: ${d}</div>`;
  dialog({
    title: 'Items, Relics & Floors', wide: true,
    body: `<h3>Items (used from your slots)</h3><div class="kv">${Object.entries(ITEMS).map(([k, v]) => row(k, v.name, v.desc)).join('')}</div>
      <h3>Relics (always on)</h3><div class="kv">${Object.entries(RELICS).map(([k, v]) => row(k, v.name, v.desc)).join('')}</div>
      <h3>Floor modifiers</h3><ul class="help-list">${Object.values(MODS).map(m => `<li><b>${m.name}</b>: ${m.desc}</li>`).join('')}</ul>`,
    buttons: [{ label: 'OK', def: true, cancel: true }],
  });
}
function showAbout() {
  dialog({
    title: 'About Minecrawler',
    body: `<div class="row">${img('mine', 'big')}<div><p><b>Minecrawler</b><br>Version 1.0</p><p>A roguelike tribute to the Minesweeper that came with Windows.</p><p class="muted">All art is pixel art drawn in code. No mines were harmed. Some were flagged.</p></div></div>`,
    buttons: [{ label: 'OK', def: true, cancel: true }],
  });
}
function showFloorInfo() {
  if (!run || !F || F.demo) return;
  const lines = [];
  if (F.boss) lines.push("<li><b>The Mine King's Hoard</b>: there are no stairs. Clear the floor to win.</li>");
  if (F.guardian) lines.push('<li><b>Guardian</b>: clear this floor fully to earn a relic.</li>');
  if (F.vault) lines.push('<li><b>Vault</b>: more mines, triple coins, two gems.</li>');
  F.mods.forEach(m => lines.push(`<li><b>${MODS[m].name}</b>: ${MODS[m].desc}</li>`));
  dialog({
    title: `Depth ${F.depth}`,
    body: `<p>${F.cols}×${F.rows} with ${F.mineCount} mines.</p>${lines.length ? `<ul class="help-list">${lines.join('')}</ul>` : '<p class="muted">A plain floor. No surprises… probably.</p>'}`,
    buttons: [{ label: 'OK', def: true, cancel: true }],
  });
}

/* ---------------- menus, window chrome, taskbar ---------------- */
const MENUS = {
  game: () => [
    { label: 'New Run…', key: 'F2', click: openCharSelect },
    { label: 'Daily Dig', click: () => run && !run.recorded && !(F && F.dead) ? confirmAbandon(() => newRun('sweeper', true)) : newRun('sweeper', true) },
    '-',
    { label: 'Hall of Fame…', click: () => showHallOfFame() },
    { label: 'Sound', check: meta.sound, click: toggleSound },
    { label: 'Flag mode', key: 'F', check: flagMode, click: toggleFlagMode },
    '-',
    { label: 'Exit', click: () => confirmAbandon() },
  ],
  help: () => [
    { label: 'How to Play…', click: showHelp },
    { label: 'Items & Relics…', click: showCatalog },
    '-',
    { label: 'About Minecrawler…', click: showAbout },
  ],
};
function closeMenus() { document.querySelectorAll('.dropdown').forEach(d => d.remove()); document.querySelectorAll('.menubar .m.open').forEach(m => m.classList.remove('open')); $('startMenu').hidden = true; $('startBtn').classList.remove('on'); }
function openMenu(m) {
  closeMenus();
  m.classList.add('open');
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  MENUS[m.dataset.menu]().forEach(it => {
    if (it === '-') { dd.append(document.createElement('hr')); return; }
    const el = document.createElement('div');
    el.className = 'it' + (it.check ? ' check' : '');
    el.innerHTML = `<span>${esc(it.label)}</span>${it.key ? `<span>${it.key}</span>` : ''}`;
    el.addEventListener('click', e => { e.stopPropagation(); closeMenus(); Snd.click(); it.click(); });
    dd.append(el);
  });
  m.append(dd);
}
$('menubar').addEventListener('click', e => {
  const m = e.target.closest('.m');
  if (!m || e.target.closest('.dropdown')) return;
  m.classList.contains('open') ? closeMenus() : openMenu(m);
});
$('menubar').addEventListener('mouseover', e => {
  const m = e.target.closest('.m');
  if (m && !m.classList.contains('open') && document.querySelector('.menubar .m.open')) openMenu(m);
});
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.menubar') && !e.target.closest('#startMenu') && !e.target.closest('#startBtn')) closeMenus();
});

function toggleSound() { meta.sound = !meta.sound; saveMeta(); $('soundIcon').innerHTML = soundIcon(); if (meta.sound) Snd.click(); }
const soundIcon = () => meta.sound ? '🔊' : '🔇';

$('minBtn').addEventListener('click', () => { minimized = true; $('win').style.visibility = 'hidden'; $('taskBtn').classList.remove('on'); });
$('maxBtn').addEventListener('click', () => status('Minecrawler is already as big as it gets.'));
$('closeBtn').addEventListener('click', () => {
  if (run && !run.recorded) return confirmAbandon();
  dialog({ title: 'Minecrawler', body: `<div class="row">${img('mine', 'big')}<p>You can't leave the mines that easily.</p></div>`, buttons: [{ label: 'OK', def: true, cancel: true }] });
});
$('taskBtn').addEventListener('click', () => {
  minimized = !minimized;
  $('win').style.visibility = minimized ? 'hidden' : '';
  $('taskBtn').classList.toggle('on', !minimized);
});
$('startBtn').addEventListener('click', () => {
  const sm = $('startMenu');
  if (!sm.hidden) return closeMenus();
  closeMenus();
  const items = [
    ['mine', 'New Run…', openCharSelect], ['coin', 'Daily Dig', MENUS.game()[1].click], ['crown', 'Hall of Fame', () => showHallOfFame()],
    '-', ['map', 'How to Play', showHelp], ['bag', 'Items & Relics', showCatalog], '-', ['lantern', meta.sound ? 'Sound: On' : 'Sound: Off', toggleSound],
  ];
  sm.innerHTML = `<div class="side"><b>Mine</b>crawler 95</div><div class="items"></div>`;
  const box = sm.querySelector('.items');
  items.forEach(it => {
    if (it === '-') { box.append(document.createElement('hr')); return; }
    const el = document.createElement('div');
    el.className = 'it'; el.innerHTML = `${img(it[0])}<span>${esc(it[1])}</span>`;
    el.addEventListener('click', () => { closeMenus(); Snd.click(); it[2](); });
    box.append(el);
  });
  sm.hidden = false; $('startBtn').classList.add('on');
});
function tickClock() { const d = new Date(); $('clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }

/* ---------------- layout: scale the whole window in crisp steps ---------------- */
function layout() {
  const z0 = $('zoomer');
  z0.style.zoom = 1;
  const w = $('win').offsetWidth, h = $('win').offsetHeight;
  const fit = (tz) => Math.min((innerWidth - 8) / w, (innerHeight - 28 * tz - 8) / h);
  let z = fit(1);
  const tz = z >= 3 ? 2 : z >= 2 ? 1.5 : 1;
  z = fit(tz);
  z = z >= 1.5 ? Math.min(4, Math.floor(z * 2) / 2) : Math.max(.5, Math.floor(z * 20) / 20);
  z0.style.zoom = z;
  lastWinH = $('win').offsetHeight;
  const dz = clamp(Math.floor(Math.min(innerWidth / 380, innerHeight / 520) * 2) / 2, 1, 2);
  const root = document.documentElement.style;
  root.setProperty('--z', z); root.setProperty('--tz', tz); root.setProperty('--dz', dz);
}
window.addEventListener('resize', () => layout());

/* ---------------- main loop ---------------- */
let lastT = now();
function frame(t) {
  const dt = Math.min(100, t - lastT); lastT = t;
  if (canPlay() && F.started && !document.hidden) {
    F.elapsed += dt;
    if (hasMod('timed')) { F.timeLeft -= dt; if (F.timeLeft <= 0) caveIn(); }
    if (hasMod('shifting') && canPlay()) { F.shiftT -= dt; if (F.shiftT <= 0) { F.shiftT = shiftInterval(); shiftMines(); } }
  }
  updateLeds();
  drawFace();
  updateDepthInfo();
  draw(t);
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

/* ---------------- boot ---------------- */
function showDemo() {
  run = null; room = null; targeting = null; fx = [];
  F = { demo: true, cols: 9, rows: 9, mods: [], cells: Array.from({ length: 81 }, () => ({ m: 0, a: 0, r: 0, f: 0, x: 0, it: null })), elapsed: 0, mineCount: 10, flags: 0 };
  setupBoard();
  updateHUD();
  status('Game › New Run, or click the board to start.');
}

function boot() {
  $('titleIcon').innerHTML = img('mine');
  $('startBtn').innerHTML = `${img('mine')}<span>Start</span>`;
  $('taskBtn').innerHTML = `${img('mine')}<span>Minecrawler</span>`;
  $('flagBtn').innerHTML = img('flag');
  $('descendBtn').innerHTML = `${img('stairs')}<span>Descend</span>`;
  $('crown').innerHTML = img('crown', 'crown');
  $('soundIcon').innerHTML = soundIcon();
  $('soundIcon').addEventListener('click', toggleSound);
  tickClock(); setInterval(tickClock, 10000);
  requestAnimationFrame(frame);

  if (load()) {
    setupBoard();
    updateHUD();
    status(defaultHint());
    const c = CHARS[run.char];
    dialog({
      title: 'Welcome back',
      body: `<div class="row">${img(c.icon, 'big')}<div><p>Continue your run as <b>${c.name}</b>?</p><p class="pill">Depth ${run.depth} · ${img('heart')} ${run.hp}/${run.maxHp} · ${img('coin')} ${run.gold}</p></div></div>`,
      buttons: [
        { label: 'Continue', def: true, cancel: true, click: () => { if (room) showRoom(); else if (F.cleared) showClearDialog(); } },
        { label: 'New Run', click: () => confirmAbandon() },
      ],
    });
  } else {
    showDemo();
    openCharSelect();
  }
}
boot();
// Test hook for automated play-throughs: open with ?debug.
if (/[?&]debug\b/.test(location.search)) {
  window.MC = { get F() { return F; }, get run() { return run; }, get room() { return room; }, primary, toggleFlag, useItem, gainRelic, addItem, newRun, enterFloor, shiftMines, caveIn, descend };
}
})();
