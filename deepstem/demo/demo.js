// DeepStem web demo: the plug-in's UI with pre-separated stems, played in sync with Web Audio.
(function () {
  "use strict";
  const root = document.getElementById("dsd-root");
  if (!root) return;
  const ICON = (n) => `<span class="ic">${(window.DS_ICONS || {})[n] || ""}</span>`;
  const BASE = root.dataset.base || "demo/";

  const STEM = {
    vocals: { label: "Vocals", color: "#00d4ff", icon: "microphone-2" },
    drums: { label: "Drums", color: "#ffc400", icon: "drum" },
    bass: { label: "Bass", color: "#a060ff", icon: "guitar-pick" },
    other: { label: "Other", color: "#00e676", icon: "piano" },
    instrumental: { label: "Instrumental", color: "#ff4fa3", icon: "piano" },
  };
  const MODELS = [
    { id: "prism", label: "Prism" },
    { id: "prismplus", label: "Prism+" },
    { id: "fusion", label: "Fusion" },
  ];
  const SOURCES = ["vocals", "drums", "bass", "other"];

  const S = {
    meta: null, model: 0, fourStems: true, format: 0,
    mode: "ready",                 // ready | busy | stems
    playing: false, pos: 0, startAt: 0, startPos: 0,
    solo: {}, gainDb: -3,
    ctx: null, master: null, gains: {}, sources: [], buffers: {}, loading: {},
  };

  // ---------- markup ----------
  root.innerHTML = `
  <div class="dsd-scale"><div class="dsd" tabindex="0" aria-label="Interactive DeepStem demo">
    <div class="hdr sec">
      <div class="logo"><svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="2.6" rx="1.3" fill="#00D4FF"/><rect x="3" y="4.47" width="18" height="2.6" rx="1.3" fill="#FFC400"/><rect x="6" y="8.93" width="12" height="2.6" rx="1.3" fill="#A060FF"/><rect x="9" y="13.4" width="6" height="2.6" rx="1.3" fill="#00E676"/></svg><span>deep<b>stem</b></span></div>
      <div class="file field"><div class="tile">${ICON("music")}</div>
        <div class="t"><div data-r="fname">Troublemaker.mp3</div><div class="n" data-r="fdet">0:30 · 44.1 kHz · stereo</div></div>
        <button class="gb" data-a="change" data-tip="In the plug-in you can load any song">${ICON("replace")}Change</button></div>
      <div class="hbtns">
        <a class="gb field" href="https://buymeacoffee.com/gabrielschq" target="_blank" rel="noopener" data-tip="Buy me a coffee">${ICON("coffee")}</a>
        <button class="gb field" data-a="folder" data-tip="Choose where stems are saved">${ICON("folder")}</button>
        <button class="gb field" data-a="help" data-tip="How to use DeepStem">${ICON("help-circle")}</button>
      </div>
    </div>
    <div class="disp sec">
      <div class="state" data-v="ready"><h4>Ready to separate</h4><p data-r="readydet"></p></div>
      <div class="state" data-v="busy" hidden><div class="pct" data-r="pct">0%</div><h4 style="font-size:13px;color:var(--soft)" data-r="busytitle"></h4><div class="bar"><i data-r="barfill"></i></div><p data-r="busydet">Estimating time left...</p></div>
      <div class="stems" data-v="stems" hidden>
        <div class="ruler"><div class="rl">${ICON("wave-sine")}<span class="n" data-r="nstems"></span></div><div class="rt" data-r="ruler"></div></div>
        <div class="lanes" data-r="lanes"></div>
        <div class="ph" data-r="ph"></div>
      </div>
    </div>
    <div class="tr sec">
      <button class="gb pri play isplay" data-a="play" data-tip="Play / pause">${ICON("player-play")}</button>
      <button class="gb back" data-a="back" data-tip="Back to start">${ICON("player-skip-back")}</button>
      <div class="time" data-r="time">0:00.00 <span>/ 0:00.00</span></div>
      <div class="pv">${ICON("volume")}Preview</div>
      <input type="range" min="-30" max="6" step="0.1" value="-3" data-r="vol" aria-label="Preview volume">
      <div class="db" data-r="db">-3.0 dB</div>
    </div>
    <div class="set sec">
      <div class="grp" style="width:110px"><label>Stems</label><div class="seg nums" data-seg="stems"><button>2</button><button class="on">4</button></div></div>
      <div class="grp" style="width:120px"><label>Format</label><div class="seg" data-seg="format"><button class="on">WAV</button><button>FLAC</button></div></div>
      <div class="grp" style="width:214px"><label>Model</label><div class="seg" data-seg="model"><button class="on">Prism</button><button>Prism+</button><button>Fusion</button></div></div>
      <button class="sep" data-a="separate">Separate</button>
    </div>
    <div class="stat"><div class="dot" data-r="dot"><i></i></div><div class="msg" data-r="msg">Ready · press Separate</div>
      <div class="out">${ICON("folder")}~/Music/DeepStem Stems</div></div>
    <div class="help" data-r="help" hidden><div class="pn"><button class="gb x" data-a="closehelp" aria-label="Close">${ICON("x")}</button>
      <h4>How to use DeepStem</h4><ol>
      <li>Drop a song onto the window, or press Choose file.</li>
      <li>Pick 2 stems (vocals and instrumental) or 4 stems, and a model: Prism, Prism+ or Fusion.</li>
      <li>Press Separate. If a song doesn't separate cleanly, try another model; songs suit them differently.</li>
      <li>Press play to preview. S solos a stem (right-click: only that one); click a waveform to jump.</li>
      <li>Drag a stem's handle into your DAW, or open the folder at the bottom right.</li></ol></div></div>
  </div></div>`;

  const app = root.querySelector(".dsd");
  const scaler = root.querySelector(".dsd-scale");
  const R = {};
  root.querySelectorAll("[data-r]").forEach((e) => (R[e.dataset.r] = e));

  // ---------- scaling ----------
  function fit() {
    const k = Math.min(1, root.clientWidth / 780);
    scaler.style.transform = `scale(${k})`;
    root.style.height = 620 * k + "px";
  }
  new ResizeObserver(fit).observe(root);
  fit();

  // ---------- helpers ----------
  const fmt = (s, cs) => {
    s = Math.max(0, s);
    const m = Math.floor(s / 60), r = s - m * 60;
    return cs ? `${m}:${r.toFixed(2).padStart(5, "0")}` : `${m}:${String(Math.floor(r)).padStart(2, "0")}`;
  };
  const lanesNow = () => (S.fourStems ? SOURCES : ["vocals", "instrumental"]);
  const modelId = () => MODELS[S.model].id;
  const length = () => (S.meta ? S.meta.duration : 30);
  function status(kind, text) {
    R.dot.className = "dot" + (kind ? " " + kind : "");
    R.dot.innerHTML = kind === "ok" ? ICON("check") : "<i></i>";
    R.msg.innerHTML = text;
  }

  // ---------- audio ----------
  function ensureCtx() {
    if (S.ctx) return S.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    S.ctx = new AC();
    S.master = S.ctx.createGain();
    S.master.gain.value = Math.pow(10, S.gainDb / 20);
    S.master.connect(S.ctx.destination);
    for (const s of SOURCES) {
      const g = S.ctx.createGain();
      g.connect(S.master);
      S.gains[s] = g;
    }
    return S.ctx;
  }

  function loadModel(id) {
    if (S.buffers[id]) return Promise.resolve(S.buffers[id]);
    if (S.loading[id]) return S.loading[id];
    const ctx = ensureCtx();
    S.loading[id] = Promise.all(SOURCES.map((s) =>
      fetch(`${BASE}${id}/${s}.mp3`).then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad)))))
      .then((bufs) => {
        const o = {};
        SOURCES.forEach((s, i) => (o[s] = bufs[i]));
        S.buffers[id] = o;
        return o;
      });
    return S.loading[id];
  }

  function position() {
    if (!S.playing) return S.pos;
    return Math.min(length(), S.startPos + (S.ctx.currentTime - S.startAt));
  }

  function stopSources() {
    for (const src of S.sources) { try { src.onended = null; src.stop(); } catch (e) {} }
    S.sources = [];
  }

  function startSources(at) {
    const bufs = S.buffers[modelId()];
    if (!bufs) return;
    stopSources();
    const ctx = S.ctx, t = ctx.currentTime + 0.04;
    for (const s of SOURCES) {
      const src = ctx.createBufferSource();
      src.buffer = bufs[s];
      src.connect(S.gains[s]);
      src.start(t, Math.min(at, bufs[s].duration - 0.01));
      S.sources.push(src);
    }
    S.sources[0].onended = () => { if (S.playing && position() >= length() - 0.05) { pause(); seek(0); } };
    S.startAt = t;
    S.startPos = at;
  }

  function applySolo() {
    if (!S.ctx) return;
    const lanes = lanesNow();
    const any = lanes.some((l) => S.solo[l]);
    for (const s of SOURCES) {
      const lane = S.fourStems ? s : (s === "vocals" ? "vocals" : "instrumental");
      const on = !any || S.solo[lane];
      S.gains[s].gain.setTargetAtTime(on ? 1 : 0, S.ctx.currentTime, 0.015);
    }
  }

  async function play() {
    if (S.mode !== "stems") return;
    const ctx = ensureCtx();
    if (ctx.state === "suspended") await ctx.resume();
    await loadModel(modelId());
    if (S.pos >= length() - 0.05) S.pos = 0;
    applySolo();
    startSources(S.pos);
    S.playing = true;
    renderTransport();
  }
  function pause() {
    if (!S.playing) return;
    S.pos = position();
    S.playing = false;
    stopSources();
    renderTransport();
  }
  function seek(t) {
    S.pos = Math.max(0, Math.min(length(), t));
    if (S.playing) startSources(S.pos);
    renderPlayhead();
  }

  // ---------- waveforms ----------
  function peaksFor(lane) {
    const m = S.meta.models[modelId()];
    return m[lane];
  }
  function drawLane(lane) {
    const cv = lane.canvas, box = cv.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5;   // stays crisp when the demo is scaled
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const data = peaksFor(lane.id).peaks, n = data.length;
    let max = 0;
    for (const v of data) max = Math.max(max, v);
    const k = 1 / Math.max(max, 0.25), mid = h / 2, half = h / 2 - 6;
    const col = new Array(Math.floor(w));
    for (let x = 0; x < col.length; x++) {
      const a = Math.floor((x * n) / col.length), b = Math.max(a + 1, Math.floor(((x + 1) * n) / col.length));
      let m = 0;
      for (let i = a; i < b && i < n; i++) m = Math.max(m, data[i]);
      col[x] = Math.max(0.6, Math.min(1, m * k) * half);
    }
    const path = new Path2D();
    path.moveTo(0, mid);
    col.forEach((v, x) => path.lineTo(x, mid - v));
    for (let x = col.length - 1; x >= 0; x--) path.lineTo(x, mid + col[x]);
    path.closePath();
    lane.path = path; lane.w = w; lane.h = h; lane.ctx = g;
    paintLane(lane);
  }
  function paintLane(lane) {
    const g = lane.ctx;
    if (!g) return;
    const { w, h } = lane, c = STEM[lane.id].color;
    const split = (position() / length()) * w;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, c); grad.addColorStop(0.5, c + "cc"); grad.addColorStop(1, c);
    g.fillStyle = grad;
    g.save(); g.beginPath(); g.rect(0, 0, split, h); g.clip(); g.globalAlpha = 1; g.fill(lane.path); g.restore();
    g.save(); g.beginPath(); g.rect(split, 0, w - split, h); g.clip(); g.globalAlpha = 0.32; g.fill(lane.path); g.restore();
    g.fillStyle = "rgba(255,255,255,.18)";
    g.fillRect(0, Math.round(h / 2), w, 1);
  }

  // ---------- rendering ----------
  let lanes = [];
  function buildLanes() {
    const ids = lanesNow();
    R.nstems.textContent = `${ids.length} stems`;
    R.lanes.innerHTML = "";
    lanes = ids.map((id) => {
      const st = STEM[id], el = document.createElement("div");
      el.className = "lane";
      const db = peaksFor(id).rmsDb.toFixed(1);
      el.innerHTML = `
        <div class="lab" style="background:linear-gradient(90deg,${st.color}1f,transparent)">
          <i class="cb" style="background:${st.color}"></i>
          <div class="st" style="background:${st.color}26;color:${st.color}">${ICON(st.icon)}</div>
          <div class="nm"><div>${st.label}</div><div>${db} dB</div></div>
          <button class="gb solo" data-tip="Solo this stem. Right-click: solo only this stem">S</button>
          <a class="gb drag" draggable="true" data-tip="Drag into your DAW (here: download the stem)" href="${BASE}${modelId()}/${id}.mp3" download="Troublemaker - ${st.label} (DeepStem ${MODELS[S.model].label}).mp3">${ICON("drag-drop")}</a>
        </div>
        <div class="wave"><canvas></canvas></div>`;
      R.lanes.appendChild(el);
      const lane = { id, el, canvas: el.querySelector("canvas"), solo: el.querySelector(".solo") };
      lane.solo.addEventListener("click", () => { S.solo[id] = !S.solo[id]; applySolo(); renderSolo(); });
      lane.solo.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        for (const k of lanesNow()) S.solo[k] = k === id;
        applySolo(); renderSolo();
      });
      const drag = el.querySelector(".drag");
      drag.addEventListener("dragstart", (e) => {
        const url = new URL(drag.getAttribute("href"), location.href).href;
        e.dataTransfer.setData("DownloadURL", `audio/mpeg:${drag.getAttribute("download")}:${url}`);
        e.dataTransfer.setData("text/uri-list", url);
      });
      const wave = el.querySelector(".wave");
      const seekFromEvent = (e) => {
        const r = wave.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * length());
      };
      wave.addEventListener("pointerdown", (e) => {
        seekFromEvent(e);
        wave.setPointerCapture(e.pointerId);
        const mv = (ev) => seekFromEvent(ev);
        wave.addEventListener("pointermove", mv);
        wave.addEventListener("pointerup", () => wave.removeEventListener("pointermove", mv), { once: true });
      });
      return lane;
    });
    renderSolo();
    requestAnimationFrame(() => { lanes.forEach(drawLane); renderRuler(); renderPlayhead(); });
  }

  function renderSolo() {
    for (const l of lanes) {
      const on = !!S.solo[l.id];
      l.solo.classList.toggle("on", on);
      l.solo.style.background = on ? STEM[l.id].color : "";
    }
  }

  function renderRuler() {
    const w = R.ruler.clientWidth, len = length();
    let step = 1;
    for (const c of [1, 2, 5, 10, 15, 30, 60]) { step = c; if ((c * w) / len >= 56) break; }
    let html = "";
    for (let t = 0; t < len; t += step) html += `<span style="left:${(t / len) * 100}%">${fmt(t, false)}</span>`;
    R.ruler.innerHTML = html;
  }

  function renderPlayhead() {
    const p = position(), len = length();
    R.time.innerHTML = `${fmt(p, true)} <span>/ ${fmt(S.mode === "stems" ? len : 0, true)}</span>`;
    if (S.mode !== "stems") return;
    const labelW = 196, waveW = R.lanes.clientWidth - labelW;
    R.ph.style.left = labelW + (p / len) * waveW + "px";
    lanes.forEach(paintLane);
  }

  function renderTransport() {
    const btn = root.querySelector('[data-a="play"]');
    btn.innerHTML = ICON(S.playing ? "player-pause" : "player-play");
    btn.classList.toggle("isplay", !S.playing);
    const off = S.mode !== "stems";
    btn.toggleAttribute("disabled", off);
    root.querySelector('[data-a="back"]').toggleAttribute("disabled", off);
  }

  function show(mode) {
    S.mode = mode;
    root.querySelectorAll("[data-v]").forEach((e) => (e.hidden = e.dataset.v !== mode));
    const sep = root.querySelector('[data-a="separate"]');
    sep.textContent = mode === "busy" ? "Cancel" : "Separate";
    sep.classList.toggle("cancel", mode === "busy");
    root.querySelectorAll(".seg").forEach((s) => s.classList.toggle("dis", mode === "busy"));
    app.style.setProperty("--glow2", S.fourStems ? "rgba(160,96,255,.13)" : "rgba(255,79,163,.11)");
    R.readydet.innerHTML = `<span class="n">${S.fourStems ? 4 : 2}</span> stems · ${MODELS[S.model].label} model`;
    renderTransport();
    renderPlayhead();
  }

  // ---------- separate (pre-computed; the animation stands in for the real run) ----------
  let busyTimer = null;
  function separate() {
    if (S.mode === "busy") {
      clearInterval(busyTimer);
      status("", "Cancelled");
      show(S.hadStems ? "stems" : "ready");
      return;
    }
    pause();
    const id = modelId();
    const load = loadModel(id);
    R.busytitle.textContent = "Separating " + (S.fourStems ? "4 stems" : "vocals and instrumental");
    status("busy", "Separating... 0%");
    show("busy");
    let p = 0, loaded = false;
    load.then(() => (loaded = true), () => status("", "Couldn't load the demo audio. Check your connection."));
    const t0 = performance.now();
    busyTimer = setInterval(() => {
      const target = loaded ? 1 : 0.9;
      p = Math.min(target, p + 0.012 + Math.random() * 0.018);
      const pct = Math.round(p * 100);
      R.pct.textContent = pct + "%";
      R.barfill.style.width = pct + "%";
      R.busydet.textContent = p > 0.15 ? `about ${Math.max(1, Math.round((performance.now() - t0) / 1000 / p * (1 - p)))} s left` : "Estimating time left...";
      status("busy", `Separating... ${pct}%`);
      if (p >= 1) {
        clearInterval(busyTimer);
        S.hadStems = true;
        S.solo = {};
        S.pos = 0;
        show("stems");
        buildLanes();
        status("ok", `Done · pre-separated with the ${MODELS[S.model].label} model · press play, solo stems, switch models`);
      }
    }, 45);
  }

  async function switchModel(i) {
    S.model = i;
    if (S.mode !== "stems") { show(S.mode); return; }
    status("busy", `Loading the ${MODELS[i].label} result...`);
    const wasPlaying = S.playing, at = position();
    try {
      await loadModel(modelId());
    } catch (e) {
      status("", "Couldn't load the demo audio. Check your connection.");
      return;
    }
    if (MODELS[S.model].id !== modelId()) return;
    buildLanes();
    if (wasPlaying) { applySolo(); startSources(at); }
    status("ok", `Now playing the ${MODELS[i].label} result · compare the models on the same song`);
  }

  // ---------- controls ----------
  function seg(name, onPick) {
    const el = root.querySelector(`[data-seg="${name}"]`);
    const btns = [...el.querySelectorAll("button")];
    btns.forEach((b, i) => b.addEventListener("click", () => {
      btns.forEach((x, j) => x.classList.toggle("on", j === i));
      onPick(i);
    }));
  }
  seg("stems", (i) => {
    S.fourStems = i === 1;
    S.solo = {};
    if (S.mode === "stems") { buildLanes(); applySolo(); }
    show(S.mode);
  });
  seg("format", (i) => {
    S.format = i;
    status("", `${i ? "FLAC" : "WAV"} selected · the plug-in writes 24-bit ${i ? "FLAC" : "WAV"} files (this demo streams MP3 previews)`);
  });
  seg("model", (i) => switchModel(i));

  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]");
    if (!a) return;
    switch (a.dataset.a) {
      case "play": S.playing ? pause() : play(); break;
      case "back": seek(0); break;
      case "separate": separate(); break;
      case "help": R.help.hidden = false; break;
      case "closehelp": R.help.hidden = true; break;
      case "folder": status("", "In the plug-in this chooses where stems are saved"); break;
      case "change": status("", "In the plug-in: drop any song onto the window, or press Change"); break;
    }
  });
  R.help.addEventListener("click", (e) => { if (e.target === R.help) R.help.hidden = true; });

  R.vol.addEventListener("input", () => {
    S.gainDb = parseFloat(R.vol.value);
    R.vol.style.setProperty("--p", ((S.gainDb + 30) / 36) * 100 + "%");
    R.db.textContent = (S.gainDb > 0.05 ? "+" : "") + S.gainDb.toFixed(1) + " dB";
    if (S.master) S.master.gain.setTargetAtTime(Math.pow(10, S.gainDb / 20), S.ctx.currentTime, 0.02);
  });
  R.vol.style.setProperty("--p", (27 / 36) * 100 + "%");

  app.addEventListener("keydown", (e) => {
    if (e.code === "Space" && S.mode === "stems") { e.preventDefault(); S.playing ? pause() : play(); }
  });

  // Tooltips
  let tip = null;
  app.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) return;
    tip?.remove();
    tip = document.createElement("div");
    tip.className = "tip";
    tip.textContent = t.dataset.tip;
    const a = app.getBoundingClientRect(), r = t.getBoundingClientRect(), k = a.width / 780;
    tip.style.left = ((r.left + r.width / 2 - a.left) / k) + "px";
    tip.style.top = ((r.bottom - a.top) / k + 8) + "px";
    app.appendChild(tip);
    const tr = tip.getBoundingClientRect();
    if (tr.right > a.right - 4) tip.style.left = parseFloat(tip.style.left) - (tr.right - a.right + 8) / k + "px";
    if (tr.left < a.left + 4) tip.style.left = parseFloat(tip.style.left) + (a.left - tr.left + 8) / k + "px";
    if (tr.bottom > a.bottom) tip.style.top = ((r.top - a.top) / k - 34) + "px";
  });
  app.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) { tip?.remove(); tip = null; } });

  // Animation loop
  (function tick() {
    if (S.playing) renderPlayhead();
    requestAnimationFrame(tick);
  })();
  new ResizeObserver(() => { if (S.mode === "stems") { lanes.forEach(drawLane); renderRuler(); renderPlayhead(); } }).observe(R.lanes);

  // ---------- start ----------
  // Open with the stems already separated; fetch and decode the audio in the background
  // (the AudioContext stays suspended until the first click on play).
  fetch(BASE + "peaks.json").then((r) => r.json()).then((m) => {
    S.meta = m;
    S.hadStems = true;
    R.fdet.textContent = `${fmt(m.duration, false)} · 44.1 kHz · stereo`;
    show("stems");
    buildLanes();
    status("ok", "Pre-separated with DeepStem · press play, solo stems, switch models");
    loadModel(modelId()).catch(() => {});
  });
})();
