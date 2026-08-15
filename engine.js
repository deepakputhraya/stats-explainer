"use strict";

/* ---------------------------------------------------------------------- */
/* RNG & math helpers                                                      */
/* ---------------------------------------------------------------------- */

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randNormal(rng, mean, std){
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}
function shuffle(arr, rng){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function lerp(a, b, t){ return a + (b - a) * t; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t){ return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
// Shorten animation durations when reduced-motion is active. Chapters call
// motionDuration(ms) instead of a bare ms constant; returns ~0 so transitions
// complete instantly without removing the information they convey.
function motionDuration(ms){
  if (typeof A11y !== "undefined" && A11y.reducedMotion && A11y.reducedMotion()) return 1;
  return ms;
}
function stdev(vals){
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - m) * (x - m), 0) / vals.length;
  return Math.sqrt(v);
}
function mean(vals){ return vals.reduce((s, v) => s + v, 0) / vals.length; }

/* ---------------------------------------------------------------------- */
/* Canvas setup                                                            */
/* ---------------------------------------------------------------------- */

const LOGICAL_W = 880, LOGICAL_H = 480;
const canvas = document.getElementById("canvas");

function setupCanvas(cv, w, h){
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const c = cv.getContext("2d");
  c.scale(dpr, dpr);
  return c;
}
const ctx = setupCanvas(canvas, LOGICAL_W, LOGICAL_H);
function clearStage(){
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
}

/* ---------------------------------------------------------------------- */
/* Palette                                                                  */
/* ---------------------------------------------------------------------- */

const COLOR = {
  control: "#4089DD",    /* ncase blue (tft) */
  treatment: "#e8902c",   /* clearer orange so "blue vs orange" text is accurate */
  ink: "#333333",
  muted: "#666666",        /* darker grey for readable canvas text on white */
  good: "#86C448",        /* ncase green (pavlov) */
  warn: "#FF5E5E",        /* ncase red (random) */
  line: "#bbbbbb"  /* darker for visible axis lines on white */,
  accent: "#52537F",     /* ncase purple — distinct from control blue */
  gold: "#efc701",
  pink: "#FF75FF",
  purple: "#52537F"
};

// Ordered qualitative palette for chapters with more than two groups
// (bandit arms, multi-metric grids, etc.). control/treatment stay first
// so two-group chapters keep the original blue/orange look via colorAt(0/1).
const PALETTE = ["#4089DD", "#e8902c", "#86C448", "#FF5E5E", "#52537F", "#efc701", "#FF75FF", "#88A8CE"];
function colorAt(i){ return PALETTE[i % PALETTE.length]; }

/* ---------------------------------------------------------------------- */
/* Generalized drawing primitives                                          */
/* ---------------------------------------------------------------------- */

// Draws each item as a circle in a grid. colorOfFn(item, i) picks fill color.
// opts.order lets callers pass a pre-shuffled render order without reordering
// the underlying data (so callers can still index into it by original index).
function drawUnitGrid(items, colorOfFn, opts){
  opts = opts || {};
  const cols = opts.cols || 8;
  const rows = opts.rows || Math.ceil(items.length / cols);
  const marginX = opts.marginX != null ? opts.marginX : 60;
  const marginY = opts.marginY != null ? opts.marginY : 30;
  const cellW = (LOGICAL_W - marginX * 2) / cols;
  const cellH = (LOGICAL_H - marginY * 2) / rows;
  const r = Math.min(cellW, cellH) * (opts.radiusScale || 0.32);
  const order = opts.order || items;
  order.forEach((item, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = marginX + cellW * col + cellW / 2;
    const y = marginY + cellH * row + cellH / 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colorOfFn(item, i);
    ctx.globalAlpha = opts.dim ? 0.25 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

const DEFAULT_BAR_PLOT = { x: 70, y: 30, w: 780, h: 400 };

function barLayout(n, plot){
  const perBar = plot.w / n;
  const barW = perBar * 0.62;
  const xs = [];
  for (let j = 0; j < n; j++) xs.push(plot.x + perBar * j + perBar / 2);
  return { xs, barW };
}

// Draws bars that morph between a "raw" (bottom-anchored) representation and
// a "centered" (adjusted, zero-anchored) representation via t in [0,1].
// opts: valueOfRaw(item,i), valueOfAdjusted(item,i) [defaults to raw], colorOfFn(item,i),
// order (pre-shuffled render order so color groups interleave, not block),
// showAverages + groupOfFn(item,i) + groupColorFn(group) to draw dashed group-average lines.
function drawMorphBars(items, t, opts){
  opts = opts || {};
  const plot = opts.plot || DEFAULT_BAR_PLOT;
  const order = opts.order || items;
  const { xs, barW } = barLayout(order.length, plot);
  const valueOfRaw = opts.valueOfRaw;
  const valueOfAdjusted = opts.valueOfAdjusted || opts.valueOfRaw;
  const colorOfFn = opts.colorOfFn;
  const rawVals = order.map((it, i) => valueOfRaw(it, i));
  const adjVals = order.map((it, i) => valueOfAdjusted(it, i));
  const maxRaw = Math.max(...rawVals, 5) * 1.15;
  const maxAdjAbs = Math.max(...adjVals.map(Math.abs), 3) * 1.3;

  const bottomY = plot.y + plot.h;
  const midY = plot.y + plot.h / 2;
  const zeroY = lerp(bottomY, midY, t);
  const rawScale = plot.h / maxRaw;
  const adjScale = (plot.h / 2) / maxAdjAbs;
  const scale = lerp(rawScale, adjScale, t);

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.x - 10, zeroY);
  ctx.lineTo(plot.x + plot.w + 10, zeroY);
  ctx.stroke();

  order.forEach((item, i) => {
    const raw = rawVals[i], adj = adjVals[i];
    const val = lerp(raw, adj, t);
    const barH = val * scale;
    const x = xs[i];
    const top = barH >= 0 ? zeroY - barH : zeroY;
    const h = Math.abs(barH);
    ctx.fillStyle = colorOfFn(item, i);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x - barW / 2, top, barW, Math.max(h, 1));
    ctx.globalAlpha = 1;
  });

  if (opts.showAverages && opts.groupOfFn){
    const groups = opts.groups || Array.from(new Set(order.map((it, i) => opts.groupOfFn(it, i))));
    groups.forEach(g => {
      const idxs = order.map((it, i) => (opts.groupOfFn(it, i) === g ? i : -1)).filter(i => i >= 0);
      if (!idxs.length) return;
      const avgRaw = mean(idxs.map(i => rawVals[i]));
      const avgAdj = mean(idxs.map(i => adjVals[i]));
      const avgVal = lerp(avgRaw, avgAdj, t);
      const y = zeroY - avgVal * scale;
      const gColor = opts.groupColorFn ? opts.groupColorFn(g) : colorOfFn(order[idxs[0]], idxs[0]);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = gColor;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85 * (opts.avgAlpha != null ? opts.avgAlpha : 1);
      ctx.beginPath();
      ctx.moveTo(plot.x - 10, y);
      ctx.lineTo(plot.x + plot.w + 10, y);
      ctx.stroke();
      ctx.restore();
    });
  }
  return { zeroY, scale };
}

const DEFAULT_SCATTER_PLOT = { x: 90, y: 30, w: 700, h: 360 };

// points: [{x, y, color}]. opts.diagonalT (0..1) tweens in a reference diagonal;
// opts.noData / opts.noDataLabel shows a placeholder instead of plotting.
function drawScatter(points, opts){
  opts = opts || {};
  const plot = opts.plot || DEFAULT_SCATTER_PLOT;
  const noData = opts.noData != null ? opts.noData : points.every(p => p.x === 0);
  const allX = points.map(p => p.x), allY = points.map(p => p.y);
  const lo = Math.min(...allX, ...allY) - 4;
  const hi = Math.max(...allX, ...allY) + 4;

  const toX = v => plot.x + ((v - lo) / (hi - lo)) * plot.w;
  const toY = v => plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h;

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.stroke();

  ctx.fillStyle = COLOR.muted;
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  if (opts.xLabel) ctx.fillText(opts.xLabel, plot.x + plot.w / 2, plot.y + plot.h + 34);
  if (opts.yLabel){
    ctx.save();
    ctx.translate(plot.x - 50, plot.y + plot.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }

  if (noData){
    ctx.fillStyle = COLOR.muted;
    ctx.font = "italic 20px FuturaHandwritten, cursive";
    ctx.fillText(opts.noDataLabel || "(no history to plot)", plot.x + plot.w / 2, plot.y + 20);
  } else if (opts.diagonalT > 0){
    const t = opts.diagonalT;
    ctx.save();
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(toX(lo), toY(lo));
    ctx.lineTo(lerp(toX(lo), toX(hi), t), lerp(toY(lo), toY(hi), t));
    ctx.stroke();
    ctx.restore();
  }

  points.forEach(p => {
    const x = toX(p.x), y = toY(p.y);
    ctx.beginPath();
    ctx.arc(x, y, opts.pointR || 6, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// rawVals/adjVals: plain number arrays. Draws two comparison bars ("Raw" vs
// opts.labels[1]) sized by standard deviation, second bar colored red/green
// depending on whether it grew or shrank relative to the first.
function drawSpreadMeter(rawVals, adjVals, opts){
  opts = opts || {};
  const raw = stdev(rawVals);
  const adj = stdev(adjVals);
  const maxV = Math.max(raw, adj, 1) * 1.25;
  const baseX = opts.x != null ? opts.x : 760, baseY = opts.y != null ? opts.y : 60;
  const barMaxH = opts.h != null ? opts.h : 320;
  const barW = 46, gap = 26;

  ctx.fillStyle = COLOR.muted;
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  ctx.fillText(opts.title || "Spread", baseX + barW / 2 + (barW + gap) / 2, baseY - 14);

  const bottom = baseY + barMaxH;
  const rawHeight = clamp((raw / maxV) * barMaxH, 4, barMaxH);
  const adjHeight = clamp((adj / maxV) * barMaxH, 4, barMaxH);

  const worse = adj > raw;
  const labels = opts.labels || ["Raw", "After\nsubtract"];
  [
    { label: labels[0], h: rawHeight, x: baseX, color: "#9c9587" },
    { label: labels[1], h: adjHeight, x: baseX + barW + gap, color: worse ? COLOR.warn : COLOR.good }
  ].forEach(bar => {
    ctx.fillStyle = bar.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(bar.x, bottom - bar.h, barW, bar.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR.muted;
    ctx.font = "16px FuturaHandwritten, cursive";
    const lines = bar.label.split("\n");
    lines.forEach((line, i) => ctx.fillText(line, bar.x + barW / 2, bottom + 16 + i * 13));
  });
}

/* ---------------------------------------------------------------------- */
/* UI chrome helpers                                                        */
/* ---------------------------------------------------------------------- */

const controlsEl = document.getElementById("controls");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneTextEl = document.getElementById("sceneText");
const progressEl = document.getElementById("sceneProgress");
const legendEl = document.getElementById("legend");
const narrativeEl = document.getElementById("narrative");

// Re-trigger a CSS fade-in animation by toggling a class off/on. Used to
// smooth scene-to-scene transitions without removing the persistent container.
function retriggerFade(el){
  if (!el || !A11y || A11y.reducedMotion()) return;
  el.classList.remove("ex-fade");
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add("ex-fade");
}

// items: [{color, label, def}] — def is the short plain-language meaning
// shown next to the label (e.g. "got the usual lemonade"). Always visible
// above the canvas so a scene's colors never require scrolling to explain.
function setLegend(items){
  legendEl.innerHTML = "";
  (items || []).forEach(it => {
    const span = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = "swatch";
    swatch.style.background = it.color;
    span.appendChild(swatch);
    const b = document.createElement("b");
    b.textContent = it.label;
    span.appendChild(b);
    if (it.def){
      span.appendChild(document.createTextNode(" — " + it.def));
    }
    legendEl.appendChild(span);
  });
}

function makeBtn(label, cls, onClick, disabled){
  const b = document.createElement("button");
  b.textContent = label;
  b.className = "ctrl-btn" + (cls ? " " + cls : "");
  if (disabled) b.disabled = true;
  b.addEventListener("click", onClick);
  controlsEl.appendChild(b);
  return b;
}
function makeNote(text){
  const s = document.createElement("span");
  s.className = "ctrl-note";
  s.textContent = text;
  controlsEl.appendChild(s);
}

// Wire the scene navigation buttons once. These live in #navButtons in the
// HTML and drive the per-scene step within a mission's action phase.
document.getElementById("continueBtn").addEventListener("click", onContinue);
document.getElementById("backBtn").addEventListener("click", onBack);
document.addEventListener("keydown", e => {
  // Don't hijack typing in overlays/controls; only act on bare arrow keys.
  const tag = (e.target && e.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  if (MissionShell.getPhase && MissionShell.getPhase() && /briefing|prediction|debrief|unlock|complete/.test(MissionShell.getPhase())) return;
  if (e.key === "ArrowRight" || e.key === " "){ e.preventDefault(); document.getElementById("continueBtn").click(); }
  else if (e.key === "ArrowLeft"){ e.preventDefault(); document.getElementById("backBtn").click(); }
});
window.Engine = { enterMission, startMissionById, enterScene, onContinue, onBack };

/* ---------------------------------------------------------------------- */
/* Chapter registry                                                         */
/* ---------------------------------------------------------------------- */

// Chapter files register themselves here by id. The campaign layer
// (app/campaign.js) maps mission ids -> chapter ids, so this stays a flat
// lookup table of built chapter scenes. Slots with no registered chapter
// are simply unavailable missions (the shell handles gating).
const CHAPTERS = {};
function registerChapter(id, def){ CHAPTERS[id] = Object.assign({ id }, def); }
// Top-level `const` doesn't attach to window, but app/ modules read these
// via global.* — expose explicitly so the campaign layer can resolve scenes.
window.CHAPTERS = CHAPTERS;
window.ctx = ctx;
window.COLOR = COLOR;

/* ---------------------------------------------------------------------- */
/* Campaign-driven engine                                                   */
/* ---------------------------------------------------------------------- */

// The engine keeps the existing scene loop (the canvas + per-scene
// enter/draw/text + controls). What changes is who picks the current chapter
// and what wraps it: the mission shell handles briefing/prediction/debrief/
// unlock; the engine drives the chapter's scenes in between.

let currentChapterId = null;
let currentSceneIndex = 0;
let rafHandle = null;
let activeMission = null;        // the Campaign mission currently in ACTION phase
let lastSceneReached = false;    // guard: only fire debrief once per playthrough

function currentChapter(){ return CHAPTERS[currentChapterId]; }
function currentScenes(){ return currentChapter() ? currentChapter().scenes : []; }
function currentScene(){ return currentScenes()[currentSceneIndex]; }

// Update the URL hash for shareability. replaceState (not pushState) keeps
// browser back/forward on page history rather than every scene.
let suppressHashSync = false;
function syncHash(){
  if (!currentChapterId) return;
  const newHash = "mission=" + (activeMission ? activeMission.id : currentChapterId) + "&scene=" + currentSceneIndex;
  if (location.hash.slice(1) !== newHash){
    suppressHashSync = true;
    history.replaceState(null, "", "#" + newHash);
    suppressHashSync = false;
  }
}

function renderProgress(){
  progressEl.innerHTML = "";
  currentScenes().forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === currentSceneIndex ? " active" : i < currentSceneIndex ? " done" : "");
    progressEl.appendChild(d);
  });
}

// Enter a chapter's scene directly. Used by the mission shell to hand off
// to the chapter scene loop once briefing/prediction is done.
function enterScene(i){
  const scenes = currentScenes();
  if (!scenes.length) return;
  currentSceneIndex = clamp(i, 0, scenes.length - 1);
  controlsEl.innerHTML = "";
  ctx.textBaseline = "alphabetic";  /* reset — chapters may override then forget */
  const scene = scenes[currentSceneIndex];
  scene.state = {};
  sceneTitleEl.textContent = scene.title;
  if (scene.enter) scene.enter(scene.state);
  setLegend(typeof scene.legend === "function" ? scene.legend(scene.state) : scene.legend);
  retriggerFade(narrativeEl);
  retriggerFade(controlsEl);
  updateText();
  renderProgress();
  const navBtns = document.getElementById("navButtons");
  if (navBtns) navBtns.style.display = "";
  const backBtn = document.getElementById("backBtn");
  const continueBtn = document.getElementById("continueBtn");
  if (backBtn) backBtn.disabled = currentSceneIndex === 0;
  if (continueBtn){
    const isLastScene = currentSceneIndex === scenes.length - 1;
    continueBtn.textContent = isLastScene ? "Finish mission →" : "Continue →";
  }
  syncHash();
}

function updateText(){
  const scene = currentScene();
  if (!scene) return;
  const raw = typeof scene.text === "function" ? scene.text(scene.state) : scene.text;
  sceneTextEl.innerHTML = raw ? raw.replace(/\n/g, "<br>") : "";
  if (typeof scene.legend === "function") setLegend(scene.legend(scene.state));
}

function mainLoop(now){
  // Skip canvas redraw when the mission surface or an overlay is open —
  // nothing on the canvas is visible, so we save the render cost.
  const surfaceOpen = document.querySelector(".ex-surface.open");
  const overlayOpen = document.querySelector(".ex-overlay.open");
  if (!surfaceOpen && !overlayOpen){
    clearStage();
    const scene = currentScene();
    if (scene && scene.draw) scene.draw(ctx, now, scene.state);
  }
  rafHandle = requestAnimationFrame(mainLoop);
}

// The continue button advances scenes; at the last scene it hands back to the
// mission shell for the debrief + unlock.
function onContinue(){
  const scenes = currentScenes();
  if (currentSceneIndex < scenes.length - 1){
    enterScene(currentSceneIndex + 1);
  } else {
    finishMission();
  }
}
function onBack(){
  if (currentSceneIndex > 0) enterScene(currentSceneIndex - 1);
}

function finishMission(){
  if (!activeMission || lastSceneReached) return;
  lastSceneReached = true;
  const navBtns = document.getElementById("navButtons");
  if (navBtns) navBtns.style.display = "none";
  MissionShell.finishAction();
}

// The mission shell calls this to begin a mission's action phase.
// sceneIndex (optional) jumps to a specific scene for deep-link resumes.
function enterMission(mission, sceneIndex){
  activeMission = mission;
  lastSceneReached = false;
  const scenes = Campaign.scenesFor(mission);
  if (!scenes || !scenes.length){
    // No built chapter (e.g. the capstone) — go straight to debrief.
    finishMission();
    return;
  }
  currentChapterId = mission.chapterId;
  HUD.render(mission);
  enterScene(sceneIndex || 0);
}

function startMissionById(missionId){
  const mission = Campaign.byId(missionId);
  if (!mission) return;
  // Respect gating: locked missions can't be started (but replays of
  // completed missions are always allowed).
  const progress = Progress.get();
  const completed = progress.completedMissionIds.includes(missionId);
  if (!completed && !Campaign.isUnlocked(mission, progress.completedMissionIds)) return;
  // Stop any running chapter; hand to the shell for briefing.
  currentChapterId = null;
  activeMission = null;
  MissionShell.start(mission);
}

/* ---------------------------------------------------------------------- */
/* Boot — call once, after all chapter <script> tags have registered.      */
/* ---------------------------------------------------------------------- */

function bootCampaign(forceStart){
  // Wire the chrome surfaces to the campaign.
  HUD.bind({
    onMap: () => Map.open(Progress.get()),
    onNotebook: () => Notebook.open(Progress.get()),
    onFreeLab: () => FreeLab.open(Progress.get())
  });
  Map.bind({ onSelect: startMissionById });
  Notebook.bind({ onReplay: startMissionById });
  MissionShell.bind({ onComplete: () => Map.open(Progress.get()) });
  Progress.onChange(() => {
    HUD.showFreeLab(FreeLab.isUnlocked(Progress.get()));
  });

  const progress = Progress.get();

  // Restore an in-flight mission if the hash points at one.
  const hashMission = /mission=([\w-]+)/.exec(location.hash);
  const hashScene = /scene=(\d+)/.exec(location.hash);

  let startId = null;
  if (forceStart){
    startId = null; // fall through to "next recommended"
  } else if (hashMission){
    const id = hashMission[1];
    const m = Campaign.byId(id);
    if (m){
      const completed = progress.completedMissionIds.includes(id);
      if (completed || Campaign.isUnlocked(m, progress.completedMissionIds)) startId = id;
    }
  }
  if (!startId){
    const next = Campaign.nextRecommended(progress.completedMissionIds);
    startId = next ? next.id : (Campaign.MISSIONS[0] && Campaign.MISSIONS[0].id);
  }

  if (!startId) return;

  const mission = Campaign.byId(startId);
  if (!mission) return;

  // If we're resuming mid-mission (hash scene on a started mission), jump
  // straight into the action phase at that scene; otherwise start fresh
  const resuming = hashMission && hashScene && Campaign.scenesFor(mission);
  if (resuming){
    // Initialize the shell's active mission so finishAction() works, then
    // jump straight into the action phase at the deep-linked scene.
    Progress.setCurrentMission(mission.id);
    MissionShell.resumeActive(mission);
    activeMission = mission;
    lastSceneReached = false;
    currentChapterId = mission.chapterId;
    enterMission(mission, parseInt(hashScene[1], 10) || 0);
  } else {
    MissionShell.start(mission);
  }

  HUD.showFreeLab(FreeLab.isUnlocked(Progress.get()));
  if (!rafHandle) rafHandle = requestAnimationFrame(mainLoop);
}

/* Backwards-compatible alias for any stale callers. */
function bootCourse(){ bootCampaign(); }
