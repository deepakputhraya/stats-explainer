"use strict";

(function(){

const groupColor = g => g === "A" ? COLOR.control : COLOR.treatment;
// Chance-only gaps get their own color across every pile in this chapter, so it
// never shares a legend swatch with the blue "old sign" group.
const CHANCE = "#6b7a86";
function font(size, weight){ return (weight ? weight + " " : "") + size + "px FuturaHandwritten, cursive"; }
function text(str, x, y, opts){
  opts = opts || {};
  ctx.save();
  ctx.font = font(opts.size || 13, opts.weight);
  ctx.fillStyle = opts.color || COLOR.muted;
  ctx.textAlign = opts.align || "center";
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.fillText(str, x, y);
  ctx.restore();
}
function vline(x, y0, y1, color, opts){
  opts = opts || {};
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.width || 2;
  if (opts.dash) ctx.setLineDash(opts.dash);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.restore();
}
function dot(x, y, r, color, alpha){
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha != null ? alpha : 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------------- */
/* Data — this chapter's own lemonade-stand run                          */
/* -------------------------------------------------------------------- */

const N_MAIN = 60;            // 30 old sign / 30 new sign
const CUPS_MEAN = 9, CUPS_SD = 3;
const TRUE_EFFECT = 1.9;      // the real (fake) effect of the new sign

function makeKids(n, effect, seed){
  const rng = mulberry32(seed);
  const kids = [];
  for (let i = 0; i < n; i++){
    const group = i % 2 === 0 ? "A" : "B";
    const cups = Math.max(0.6, randNormal(rng, CUPS_MEAN, CUPS_SD) + (group === "B" ? effect : 0));
    kids.push({ id: i, group, cups });
  }
  // interleaved draw order so a color block can't be averaged by eye
  kids.drawOrder = shuffle(kids, mulberry32(seed + 77));
  kids.gridOrder = shuffle(kids, mulberry32(seed + 313));
  return kids;
}

const KIDS = makeKids(N_MAIN, TRUE_EFFECT, 4242);
const CUPS_A = KIDS.filter(k => k.group === "A").map(k => k.cups);
const CUPS_B = KIDS.filter(k => k.group === "B").map(k => k.cups);
const OBS_GAP = mean(CUPS_B) - mean(CUPS_A);

// "No real effect" world: keep every kid's number exactly as measured, and
// just re-draw the group labels at random. Any gap that shows up is chance only.
const POOL = KIDS.map(k => k.cups);
const N_SHUFFLES = 200;
const SHUFFLES = [];
{
  const rng = mulberry32(9001);
  const half = POOL.length / 2;
  const idxs = POOL.map((_, j) => j);
  for (let i = 0; i < N_SHUFFLES; i++){
    const s = shuffle(idxs, rng);
    const aIdx = s.slice(0, half), bIdx = s.slice(half);
    const isA = POOL.map(() => false);
    aIdx.forEach(j => { isA[j] = true; });
    SHUFFLES.push({ gap: mean(bIdx.map(j => POOL[j])) - mean(aIdx.map(j => POOL[j])), isA });
  }
}
const CHANCE_SPREAD = stdev(SHUFFLES.map(s => s.gap));
const OBS_RATIO = OBS_GAP / CHANCE_SPREAD;
const N_AS_BIG = SHUFFLES.filter(s => Math.abs(s.gap) >= OBS_GAP).length;

/* Pile geometry (scenes 2 & 3) */
const BIN_W = 0.2, X_MAX = 3.2;
const PILE = { x: 60, y: 128, w: 760, h: 232 };
const stackCount = {};
SHUFFLES.forEach(s => {
  s.bin = Math.round(s.gap / BIN_W);
  s.stack = stackCount[s.bin] = (stackCount[s.bin] || 0);
  stackCount[s.bin] = s.stack + 1;
});
const MAX_STACK = Math.max.apply(null, Object.keys(stackCount).map(k => stackCount[k]));
const DOT_SP = Math.min(11.5, PILE.h / (MAX_STACK + 1));
const DOT_R = Math.min(DOT_SP * 0.42, (BIN_W / (2 * X_MAX)) * PILE.w * 0.8);

function pileX(gap){ return PILE.x + PILE.w / 2 + (gap / X_MAX) * (PILE.w / 2); }
function pileBase(){ return PILE.y + PILE.h; }
function restY(s){ return pileBase() - (s.stack + 0.5) * DOT_SP; }

function drawPileAxis(opts){
  opts = opts || {};
  const base = pileBase();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PILE.x, base);
  ctx.lineTo(PILE.x + PILE.w, base);
  ctx.stroke();
  for (let g = -3; g <= 3; g++){
    const x = pileX(g);
    ctx.strokeStyle = COLOR.line;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base + 5);
    ctx.stroke();
    text((g > 0 ? "+" : "") + g, x, base + 19, { size: 11.5 });
  }
  vline(pileX(0), PILE.y - 6, base, COLOR.muted, { dash: [4, 4], width: 1.5, alpha: 0.8 });
  text("no gap", pileX(0), PILE.y - 12, { size: 11.5 });
  if (!opts.hideAxisLabel){
    text("gap between the two groups (cups)", PILE.x + PILE.w / 2, base + 38, { size: 12.5 });
  }
}

/* -------------------------------------------------------------------- */
/* Scene 1 — Hook                                                        */
/* -------------------------------------------------------------------- */

const S1_PLOT = { x: 70, y: 82, w: 740, h: 296 };

function drawKidGrid(alpha){
  if (alpha <= 0) return;
  const cols = 10, rows = 6;
  const cellW = (LOGICAL_W - 120) / cols, cellH = 330 / rows;
  KIDS.gridOrder.forEach((k, i) => {
    const x = 60 + cellW * (i % cols) + cellW / 2;
    const y = 60 + cellH * Math.floor(i / cols) + cellH / 2;
    dot(x, y, 15, groupColor(k.group), 0.9 * alpha);
  });
  text("30 kids kept the old sign · 30 got the new one", LOGICAL_W / 2, 440, { size: 13, alpha: alpha });
}

function drawCupBars(growElapsed, avgAlpha){
  const order = KIDS.drawOrder;
  const layout = barLayout(order.length, S1_PLOT);
  const maxV = Math.max.apply(null, KIDS.map(k => k.cups)) * 1.14;
  const base = S1_PLOT.y + S1_PLOT.h;
  const toY = v => base - (v / maxV) * S1_PLOT.h;

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(S1_PLOT.x - 10, base);
  ctx.lineTo(S1_PLOT.x + S1_PLOT.w + 10, base);
  ctx.stroke();

  order.forEach((k, i) => {
    const t = easeOutCubic(clamp((growElapsed - i * 11) / 460, 0, 1));
    const h = (k.cups / maxV) * S1_PLOT.h * t;
    ctx.fillStyle = groupColor(k.group);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(layout.xs[i] - layout.barW / 2, base - h, layout.barW, Math.max(h, 1));
    ctx.globalAlpha = 1;
  });
  text("one bar = one kid's cups this week", S1_PLOT.x + S1_PLOT.w / 2, base + 26, { size: 12.5 });

  if (avgAlpha > 0){
    const yA = toY(mean(CUPS_A)), yB = toY(mean(CUPS_B));
    ctx.save();
    ctx.globalAlpha = 0.12 * avgAlpha;
    ctx.fillStyle = COLOR.accent;
    ctx.fillRect(S1_PLOT.x - 10, yB, S1_PLOT.w + 20, yA - yB);
    ctx.restore();
    [["A", yA], ["B", yB]].forEach(([g, y]) => {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = groupColor(g);
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9 * avgAlpha;
      ctx.beginPath();
      ctx.moveTo(S1_PLOT.x - 10, y);
      ctx.lineTo(S1_PLOT.x + S1_PLOT.w + 10, y);
      ctx.stroke();
      ctx.restore();
    });
    text("the gap we measured: +" + (OBS_GAP * avgAlpha).toFixed(1) + " cups",
      S1_PLOT.x + S1_PLOT.w / 2, S1_PLOT.y - 26,
      { size: 15, weight: "600", color: COLOR.ink, alpha: avgAlpha });
    text("(dashed lines = each group's average)", S1_PLOT.x + S1_PLOT.w / 2, S1_PLOT.y - 8,
      { size: 12, alpha: avgAlpha });
  }
}

const OLD_SIGN = { color: COLOR.control, label: "Old sign", def: "the 30 kids who kept their usual sign" };
const NEW_SIGN = { color: COLOR.treatment, label: "New sign", def: "the 30 kids who got the new one" };

const scene1 = {
  title: "1. A Gap Shows Up. Now What?",
  legend: [
    OLD_SIGN,
    NEW_SIGN,
    { color: COLOR.accent, label: "The gap", def: "how far the two group averages sit apart" }
  ],
  text(state){
    if (state.phase === "grid") return "New running example: 60 kids at 60 lemonade stands. Half keep the old sign, half get a new one. We count cups sold in a week.";
    if (state.phase === "bars") return "Here's what every kid actually sold. Blue kids kept the old sign, orange kids got the new one. Eyeballing it, who did better?";
    return "The orange group averaged " + OBS_GAP.toFixed(1) + " cups more. You already know from earlier chapters that a random split alone produces some gap, and that noise-reduction tricks shrink how big those chance gaps get. So here's the question this chapter answers: for this one experiment, how do you decide whether this particular gap is real or just noise?";
  },
  enter(state){
    state.phase = "grid";
    state.animStart = null;
    renderControls1(state);
  },
  draw(c, now, state){
    if (state.phase === "grid"){
      drawKidGrid(1);
      return;
    }
    if (state.animStart == null) state.animStart = now;
    const elapsed = now - state.animStart;
    if (state.phase === "bars"){
      drawKidGrid(1 - easeOutCubic(clamp(elapsed / 350, 0, 1)));
      drawCupBars(elapsed, 0);
    } else {
      drawCupBars(100000, easeInOutCubic(clamp(elapsed / 800, 0, 1)));
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  if (state.phase === "grid"){
    makeBtn("▶ Run the experiment", "primary", () => {
      state.phase = "bars";
      state.animStart = null;
      renderControls1(state);
      updateText();
    });
  } else if (state.phase === "bars"){
    makeBtn("Show each group's average", "primary", () => {
      state.phase = "gap";
      state.animStart = null;
      renderControls1(state);
      updateText();
    });
  } else {
    makeNote("A gap of +" + OBS_GAP.toFixed(1) + " cups. Real, or just a lucky split? Next scene builds the yardstick.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 2 — Re-randomize, build the pile                                */
/* -------------------------------------------------------------------- */

const STRIP = { x: 70, y: 34, w: 740, cols: 30, rowGap: 26 };

function drawStrip(fromIdx, toIdx, t){
  const spacing = STRIP.w / STRIP.cols;
  const labelsFrom = fromIdx >= 0 ? SHUFFLES[fromIdx].isA : null;
  const labelsTo = toIdx >= 0 ? SHUFFLES[toIdx].isA : null;
  for (let i = 0; i < POOL.length; i++){
    const x = STRIP.x + spacing * (i % STRIP.cols) + spacing / 2;
    const y = STRIP.y + Math.floor(i / STRIP.cols) * STRIP.rowGap;
    const cFrom = labelsFrom ? (labelsFrom[i] ? COLOR.control : COLOR.treatment) : COLOR.muted;
    dot(x, y, 7, cFrom, 0.85);
    if (labelsTo && t > 0) dot(x, y, 7, labelsTo[i] ? COLOR.control : COLOR.treatment, 0.85 * t);
  }
  text("the same 60 kids and the same 60 numbers — only the labels get re-drawn at random",
    LOGICAL_W / 2, STRIP.y + STRIP.rowGap + 26, { size: 12.5 });
}

const S2_DUR = 520;
function s2Batch(state){ return Math.max(1, state.shown - state.prevShown); }
function s2Stagger(state){ return Math.min(42, 900 / s2Batch(state)); }
function s2Total(state){ return S2_DUR + s2Stagger(state) * (s2Batch(state) - 1); }

const CHANCE_DOT = { color: CHANCE, label: "Chance-only gap", def: "one gap from a reshuffle where nothing real happened" };

const scene2 = {
  title: "2. What Chance Alone Can Do",
  legend: [
    { color: COLOR.control, label: "Old-sign label", def: "randomly re-assigned, while the kid's number stays put" },
    { color: COLOR.treatment, label: "New-sign label", def: "also randomly re-assigned, so any gap is luck" },
    CHANCE_DOT
  ],
  text(state){
    if (state.shown === 0) return "Now pretend the new sign does nothing at all. Keep every kid's number exactly as measured and just re-draw the labels at random. Any gap that appears is pure chance. Do that over and over and pile up the gaps you get.";
    if (state.shown < 25) return "Each reshuffle drops one gap into the pile below, at the spot matching its size. A few of them already look surprisingly big — and remember, nothing real is going on here.";
    return "After " + state.shown + " reshuffles the pile has a clear shape: chance-only gaps cluster near zero, and get rarer the further out you look. This pile is the yardstick. It tells you how big a gap chance alone tends to produce with 60 kids.";
  },
  enter(state){
    state.shown = 0;
    state.prevShown = 0;
    state.animStart = null;
    state.clearing = false;
    renderControls2(state);
  },
  draw(c, now, state){
    if (state.animStart == null) state.animStart = now;
    const elapsed = now - state.animStart;

    if (state.clearing){
      const t = easeInOutCubic(clamp(elapsed / 600, 0, 1));
      drawStrip(-1, state.shown - 1, 1 - t);
      drawPileAxis();
      for (let i = 0; i < state.shown; i++){
        const s = SHUFFLES[i];
        dot(pileX(s.bin * BIN_W), restY(s) + t * 60, DOT_R, CHANCE, 0.75 * (1 - t));
      }
      if (t >= 1){
        state.clearing = false;
        state.shown = 0;
        state.prevShown = 0;
        state.animStart = null;
        renderControls2(state);
        updateText();
      }
      return;
    }

    const batch = s2Batch(state);
    const stagger = s2Stagger(state);
    const progress = clamp(elapsed / s2Total(state), 0, 1);
    drawStrip(state.prevShown - 1, state.shown - 1, state.shown === 0 ? 0 : easeInOutCubic(progress));
    drawPileAxis();

    for (let i = 0; i < state.shown; i++){
      const s = SHUFFLES[i];
      const x = pileX(s.bin * BIN_W);
      const y = restY(s);
      if (i < state.prevShown){
        dot(x, y, DOT_R, CHANCE, 0.75);
      } else {
        const local = i - state.prevShown;
        const t = easeOutCubic(clamp((elapsed - local * stagger) / S2_DUR, 0, 1));
        if (t <= 0) continue;
        dot(x, lerp(PILE.y - 34, y, t), DOT_R, CHANCE, 0.75 * Math.min(1, t * 3));
        if (t < 1 && batch <= 3){
          vline(x, PILE.y - 34, pileBase(), COLOR.accent, { dash: [3, 4], width: 1, alpha: 0.5 * (1 - t) });
        }
      }
    }

    if (state.shown === 0){
      text("the pile of chance-only gaps builds up here", PILE.x + PILE.w / 2, PILE.y + PILE.h / 2,
        { size: 13.5, color: COLOR.muted });
      text("press a reshuffle button to start", PILE.x + PILE.w / 2, PILE.y + PILE.h / 2 + 22, { size: 12 });
    } else {
      const g = SHUFFLES[state.shown - 1].gap;
      text("reshuffles so far: " + state.shown, PILE.x, PILE.y - 30, { align: "left", size: 13, color: COLOR.ink });
      text("last chance-only gap: " + (g >= 0 ? "+" : "") + g.toFixed(2) + " cups",
        PILE.x + PILE.w, PILE.y - 30, { align: "right", size: 13 });
    }
  }
};
function renderControls2(state){
  controlsEl.innerHTML = "";
  const busy = state.clearing;
  const add = n => () => {
    if (state.clearing) return;
    const next = Math.min(N_SHUFFLES, state.shown + n);
    if (next === state.shown) return;
    state.prevShown = state.shown;
    state.shown = next;
    state.animStart = null;
    renderControls2(state);
    updateText();
  };
  makeBtn("Reshuffle once", "primary", add(1), busy || state.shown >= N_SHUFFLES);
  makeBtn("Reshuffle ×10", null, add(10), busy || state.shown >= N_SHUFFLES);
  makeBtn("Reshuffle ×50", null, add(50), busy || state.shown >= N_SHUFFLES);
  makeBtn("Start over", null, () => {
    if (state.clearing || state.shown === 0) return;
    state.clearing = true;
    state.animStart = null;
    renderControls2(state);
    updateText();
  }, busy || state.shown === 0);
  if (state.shown >= N_SHUFFLES) makeNote("That's all 200 reshuffles. The shape stopped changing a while ago.");
  else if (state.shown >= 25) makeNote("Keep going — notice the outline barely changes now, it just gets denser.");
}

/* -------------------------------------------------------------------- */
/* Scene 3 — Overlay the real gap                                        */
/* -------------------------------------------------------------------- */

const scene3 = {
  title: "3. Real Gap vs. the Pile",
  legend: [
    CHANCE_DOT,
    { color: COLOR.warn, label: "Chance got this far", def: "the rare reshuffles that matched our real gap" },
    { color: COLOR.treatment, label: "Our real gap", def: "the +" + OBS_GAP.toFixed(1) + " cups we actually measured" },
    { color: COLOR.accent, label: "Pile-width", def: "how far a chance-only gap typically strays from zero" }
  ],
  text(state){
    if (state.phase === "pile") return "Here's that finished pile of chance-only gaps. Now drop our actual result on top of it: the +" + OBS_GAP.toFixed(1) + " cups we measured back in Scene 1.";
    if (state.phase === "marker") return "Our real gap lands out past almost the whole pile. " + (N_AS_BIG === 0 ? "Not one" : "Only " + N_AS_BIG) + " of the 200 chance-only reshuffles reached that far from zero. That's the whole judgement call, and now let's put a number on it.";
    return "Measure the gap in pile-widths. One width is how far a typical chance-only gap strays from zero; our real gap sits about " + OBS_RATIO.toFixed(1) + " widths out. Big gap plus tight pile equals a convincing result; the same gap against a sloppy, wide pile would prove nothing. This gap-to-spread comparison is the idea behind the classic \"t-test\" — the most common check for data shaped like this, though not the only one. Other data shapes use other named tests (chi-square for counts, rank-based tests for lopsided data): same core idea, different math underneath.";
  },
  enter(state){
    state.phase = "pile";
    state.animStart = null;
    renderControls3(state);
  },
  draw(c, now, state){
    if (state.animStart == null) state.animStart = now;
    const elapsed = now - state.animStart;
    const markerT = state.phase === "pile" ? 0
      : state.phase === "ruler" ? 1
      : easeInOutCubic(clamp(elapsed / 900, 0, 1));
    const rulerT = state.phase === "ruler" ? easeOutCubic(clamp(elapsed / 900, 0, 1)) : 0;
    const base = pileBase();

    drawPileAxis({ hideAxisLabel: rulerT > 0 });
    const markerGap = OBS_GAP * markerT;
    SHUFFLES.forEach(s => {
      const beyond = Math.abs(s.gap) >= OBS_GAP;
      const hot = beyond && markerT > 0.6 ? (markerT - 0.6) / 0.4 : 0;
      const x = pileX(s.bin * BIN_W);
      dot(x, restY(s), DOT_R, CHANCE, 0.6);
      if (hot > 0) dot(x, restY(s), DOT_R + 0.6, COLOR.warn, 0.85 * hot);
    });

    if (state.phase === "pile"){
      text("200 reshuffles of a world where the new sign does nothing", LOGICAL_W / 2, 44, { size: 13.5, color: COLOR.ink });
    } else {
      const mx = pileX(markerGap);
      vline(mx, PILE.y - 24, base, COLOR.treatment, { width: 3, alpha: 0.95 });
      text("our real gap  +" + markerGap.toFixed(1), mx, PILE.y - 32,
        { size: 13, weight: "600", color: COLOR.treatment });
      text("Our real gap is about " + (OBS_RATIO * markerT).toFixed(1) + " pile-widths from zero",
        LOGICAL_W / 2, 40, { size: 15.5, weight: "600", color: COLOR.ink });
      const tail = N_AS_BIG === 0 ? "not one of the 200 chance-only gaps got that far"
        : N_AS_BIG + " of the 200 chance-only gaps got that far";
      text(markerT >= 1 ? tail : "sliding out from zero…", LOGICAL_W / 2, 62, { size: 13, alpha: markerT });
    }

    if (rulerT > 0){
      const y = base + 44;
      const endGap = Math.min(X_MAX, 3 * CHANCE_SPREAD);
      const x0 = pileX(0), x1 = pileX(endGap * rulerT);
      ctx.save();
      ctx.strokeStyle = COLOR.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.restore();
      for (let k = 1; k <= 3; k++){
        const gx = k * CHANCE_SPREAD;
        if (gx > endGap * rulerT) break;
        const x = pileX(gx);
        vline(x, y - 6, y + 6, COLOR.accent, { width: 2 });
        text(k + (k === 1 ? " pile-width" : ""), x, y + 21, { size: 11.5, color: COLOR.accent });
      }
      text("one width = how far a chance-only gap typically strays from zero",
        pileX(0), y + 40, { size: 12, alpha: rulerT });
    }
  }
};
function renderControls3(state){
  controlsEl.innerHTML = "";
  if (state.phase === "pile"){
    makeBtn("Drop in our real gap", "primary", () => {
      state.phase = "marker";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else if (state.phase === "marker"){
    makeBtn("Measure it in pile-widths", "primary", () => {
      state.phase = "ruler";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else {
    makeNote("Big gap ÷ tight pile = convincing. Same gap ÷ wide pile = nothing to see.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 4 — More kids narrows the pile                                  */
/* -------------------------------------------------------------------- */

const N_OPTIONS = [20, 100, 500];
const SUBTLE_EFFECT = 0.9;      // a smaller real effect than Scene 1's sign
const N_SIM = 600;
const BIN_W4 = 0.15, X_MAX4 = 3.2;
const BINS4 = Math.round(X_MAX4 / BIN_W4) * 2 + 1;
const S4_PLOT = { x: 60, y: 118, w: 760, h: 244 };
// Shared height scale across all three sizes, so the pile visibly trades width
// for height instead of each one being re-stretched to fill the plot.
const S4_PEAK_FRACTION = 0.22;

function binFractions(gaps){
  const h = new Array(BINS4).fill(0);
  const mid = (BINS4 - 1) / 2;
  gaps.forEach(g => {
    const b = Math.round(g / BIN_W4) + mid;
    if (b >= 0 && b < BINS4) h[b] += 1 / gaps.length;
  });
  return h;
}
function chanceGapsFor(n, seed){
  const rng = mulberry32(seed);
  const half = n / 2;
  const out = [];
  for (let i = 0; i < N_SIM; i++){
    let a = 0, b = 0;
    for (let j = 0; j < half; j++) a += randNormal(rng, CUPS_MEAN, CUPS_SD);
    for (let j = 0; j < half; j++) b += randNormal(rng, CUPS_MEAN, CUPS_SD);
    out.push(b / half - a / half);
  }
  return out;
}
const SIM = N_OPTIONS.map((n, i) => {
  const gaps = chanceGapsFor(n, 5000 + i * 137);
  const spread = stdev(gaps);
  return {
    n: n,
    spread: spread,
    heights: binFractions(gaps),
    ratio: SUBTLE_EFFECT / spread,
    beyond: gaps.filter(g => Math.abs(g) >= SUBTLE_EFFECT).length
  };
});

function s4X(gap){ return S4_PLOT.x + S4_PLOT.w / 2 + (gap / X_MAX4) * (S4_PLOT.w / 2); }

function drawS4Axis(){
  const base = S4_PLOT.y + S4_PLOT.h;
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(S4_PLOT.x, base);
  ctx.lineTo(S4_PLOT.x + S4_PLOT.w, base);
  ctx.stroke();
  for (let g = -3; g <= 3; g++){
    const x = s4X(g);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base + 5);
    ctx.stroke();
    text((g > 0 ? "+" : "") + g, x, base + 18, { size: 11.5 });
  }
  vline(s4X(0), S4_PLOT.y, base, COLOR.muted, { dash: [4, 4], width: 1.5, alpha: 0.8 });
}

const scene4 = {
  title: "4. More Kids, Tighter Pile",
  legend: [
    { color: CHANCE, label: "Chance-only pile", def: "taller and narrower as you add more kids" },
    { color: COLOR.treatment, label: "The real gap", def: "fixed at +" + SUBTLE_EFFECT.toFixed(1) + " cups, never moves" },
    { color: COLOR.accent, label: "Pile-width", def: "how far a chance-only gap typically strays from zero" }
  ],
  text(state){
    const s = SIM[state.idx];
    const head = "Same question, subtler sign: this one truly adds only about +" + SUBTLE_EFFECT.toFixed(1) + " cups. The real effect never changes below — only how many kids we run it on. ";
    if (s.n === 20) return head + "With 20 kids the chance-only pile is wide and sloppy. Our real gap is buried inside it: " + s.beyond + " of 600 chance reshuffles matched it. You could not tell this apart from luck.";
    if (s.n === 100) return head + "At 100 kids the pile has pulled in around zero. The same real gap is now near the edge of it — suggestive, still not clean.";
    return head + "At 500 kids the pile is narrow and tall, and the same real gap sits far out in the tail: " + (s.beyond === 0 ? "not one" : "only " + s.beyond) + " of 600 chance reshuffles reached it. Nothing about the sign changed. More data simply squeezed the noise out.";
  },
  enter(state){
    state.idx = 0;
    state.from = { heights: new Array(BINS4).fill(0), spread: 0, ratio: 0, beyond: 0 };
    state.cur = { heights: new Array(BINS4).fill(0), spread: 0, ratio: 0, beyond: 0 };
    state.animStart = null;
    renderControls4(state);
  },
  draw(c, now, state){
    if (state.animStart == null) state.animStart = now;
    const t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
    const target = SIM[state.idx];
    const cur = state.cur;
    for (let i = 0; i < BINS4; i++) cur.heights[i] = lerp(state.from.heights[i], target.heights[i], t);
    cur.spread = lerp(state.from.spread, target.spread, t);
    cur.ratio = lerp(state.from.ratio, target.ratio, t);
    cur.beyond = lerp(state.from.beyond, target.beyond, t);

    const base = S4_PLOT.y + S4_PLOT.h;
    drawS4Axis();

    const barW = (BIN_W4 / (2 * X_MAX4)) * S4_PLOT.w;
    const mid = (BINS4 - 1) / 2;
    for (let i = 0; i < BINS4; i++){
      const h = clamp(cur.heights[i] / S4_PEAK_FRACTION, 0, 1) * S4_PLOT.h;
      if (h <= 0.2) continue;
      ctx.fillStyle = CHANCE;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(s4X((i - mid) * BIN_W4) - barW / 2 + 0.5, base - h, barW - 1, h);
      ctx.globalAlpha = 1;
    }

    vline(s4X(SUBTLE_EFFECT), S4_PLOT.y - 16, base, COLOR.treatment, { width: 3, alpha: 0.95 });
    text("real gap +" + SUBTLE_EFFECT.toFixed(1), s4X(SUBTLE_EFFECT), S4_PLOT.y - 24,
      { size: 12.5, weight: "600", color: COLOR.treatment });

    // spread ruler: how wide chance-only gaps usually are
    const ry = base + 44;
    const x0 = s4X(-cur.spread), x1 = s4X(cur.spread);
    ctx.save();
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, ry);
    ctx.lineTo(x1, ry);
    ctx.stroke();
    [x0, x1].forEach(x => { vline(x, ry - 6, ry + 6, COLOR.accent, { width: 2.5 }); });
    ctx.restore();
    text("one pile-width of pure chance", s4X(0), ry + 20, { size: 12, color: COLOR.accent });

    text("Kids in the experiment: " + target.n, S4_PLOT.x, 38, { align: "left", size: 15.5, weight: "600", color: COLOR.ink });
    text("the real gap is about " + cur.ratio.toFixed(1) + " pile-widths out from zero",
      S4_PLOT.x, 60, { align: "left", size: 13.5, color: COLOR.ink });
    text(Math.round(cur.beyond) + " of 600 chance-only gaps were this big",
      S4_PLOT.x, 80, { align: "left", size: 13 });
    text("gap between the two groups (cups)", S4_PLOT.x + S4_PLOT.w, 60, { align: "right", size: 12.5 });
  }
};
function renderControls4(state){
  controlsEl.innerHTML = "";
  SIM.forEach((s, i) => {
    makeBtn(s.n + " kids", i === state.idx ? "primary selected" : null, () => {
      if (i === state.idx) return;
      state.from = {
        heights: state.cur.heights.slice(),
        spread: state.cur.spread,
        ratio: state.cur.ratio,
        beyond: state.cur.beyond
      };
      state.idx = i;
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
  });
  makeNote("The orange line never moves. Only the pile around it changes.");
}

/* -------------------------------------------------------------------- */
/* Scene 5 — Recap + bridge                                              */
/* -------------------------------------------------------------------- */

const PANELS = [
  { lines: ["1. Split at random,", "measure the gap you got."] },
  { lines: ["2. Ask what gaps pure chance", "produces with no real effect."] },
  { lines: ["3. If chance rarely reaches", "your gap, call the result real."] }
];

function drawMiniPile(box, markerGap, alpha){
  const toX = g => box.x + box.w / 2 + (g / X_MAX) * (box.w / 2);
  const sp = Math.min(4.6, box.h / (MAX_STACK + 1));
  const base = box.y + box.h;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x, base);
  ctx.lineTo(box.x + box.w, base);
  ctx.stroke();
  ctx.restore();
  SHUFFLES.forEach(s => {
    const beyond = markerGap != null && Math.abs(s.gap) >= markerGap;
    dot(toX(s.bin * BIN_W), base - (s.stack + 0.5) * sp, 2.1,
      beyond ? COLOR.warn : CHANCE, (beyond ? 0.9 : 0.55) * alpha);
  });
  vline(toX(0), box.y, base, COLOR.muted, { dash: [3, 3], width: 1, alpha: 0.7 * alpha });
  if (markerGap != null){
    vline(toX(markerGap), box.y - 8, base, COLOR.treatment, { width: 2.5, alpha: 0.95 * alpha });
    text("real gap", toX(markerGap), box.y - 14, { size: 11, color: COLOR.treatment, alpha: alpha });
  }
}

function drawMiniSplit(box, alpha){
  const n = 20, cols = 10;
  const cellW = box.w / cols;
  for (let i = 0; i < n; i++){
    const x = box.x + cellW * (i % cols) + cellW / 2;
    const y = box.y + 16 + Math.floor(i / cols) * 24;
    dot(x, y, 8, i % 2 === 0 ? COLOR.control : COLOR.treatment, 0.85 * alpha);
  }
  const base = box.y + box.h;
  const bars = [[mean(CUPS_A), COLOR.control], [mean(CUPS_B), COLOR.treatment]];
  const maxV = Math.max(mean(CUPS_A), mean(CUPS_B)) * 1.25;
  bars.forEach(([v, col], i) => {
    const h = (v / maxV) * 78;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85 * alpha;
    ctx.fillRect(box.x + box.w / 2 - 58 + i * 62, base - h, 54, h);
    ctx.globalAlpha = 1;
  });
  text("+" + OBS_GAP.toFixed(1) + " cups", box.x + box.w / 2, base - 88,
    { size: 12, weight: "600", color: COLOR.ink, alpha: alpha });
}

function drawArrow(x0, x1, y, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLOR.muted;
  ctx.fillStyle = COLOR.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1 - 6, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x1 - 8, y - 5);
  ctx.lineTo(x1 - 8, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const scene5 = {
  title: "5. The Whole Idea, and What Breaks It",
  legend: [
    OLD_SIGN,
    NEW_SIGN,
    CHANCE_DOT,
    { color: COLOR.warn, label: "Chance got this far", def: "rare enough that we call our result real" }
  ],
  text(state){
    if (!state.showNote) return "Put plainly, the question is always: how often would pure chance alone produce a gap this big? If the answer is \"rarely,\" we call the result real. Everything else — the reshuffling, the pile, the pile-widths — is just a way to answer that one question honestly.";
    return "Scope note, same as before: this gap-versus-pile comparison is the classic \"t-test\", the standard tool for this shape of data. Other shapes have their own named tests, and they're not covered here. One more catch, and it's a big one: all of this assumes you ask the question exactly once, at the end. What if you check the results every single day instead? That's Chapter 4.";
  },
  enter(state){
    state.animStart = null;
    state.showNote = false;
    state.noteStart = null;
    renderControls5(state);
  },
  draw(c, now, state){
    if (state.animStart == null) state.animStart = now;
    const elapsed = now - state.animStart;
    text("The whole idea in three steps", LOGICAL_W / 2, 34, { size: 15.5, weight: "600", color: COLOR.ink });

    const boxes = [
      { x: 30, y: 96, w: 250, h: 150 },
      { x: 315, y: 96, w: 250, h: 150 },
      { x: 600, y: 96, w: 250, h: 150 }
    ];
    boxes.forEach((box, i) => {
      const t = easeOutCubic(clamp((elapsed - i * 430) / 700, 0, 1));
      if (t <= 0) return;
      const dy = (1 - t) * 18;
      const shifted = { x: box.x, y: box.y + dy, w: box.w, h: box.h };
      if (i > 0) drawArrow(boxes[i - 1].x + boxes[i - 1].w + 8, box.x - 8, box.y + box.h / 2, t);
      if (i === 0) drawMiniSplit(shifted, t);
      else drawMiniPile(shifted, i === 1 ? null : OBS_GAP, t);
      PANELS[i].lines.forEach((line, j) => {
        text(line, box.x + box.w / 2, box.y + box.h + 26 + j * 17 + dy,
          { size: 12.5, color: j === 0 ? COLOR.ink : COLOR.muted, alpha: t });
      });
    });

    if (state.showNote){
      if (state.noteStart == null) state.noteStart = now;
      const t = easeOutCubic(clamp((now - state.noteStart) / 700, 0, 1));
      const y = lerp(340, 326, t);
      ctx.save();
      ctx.globalAlpha = 0.9 * t;
      ctx.fillStyle = "#f3f0e8";
      ctx.fillRect(30, y, 820, 92);
      ctx.restore();
      text("The fine print", 46, y + 26, { align: "left", size: 13, weight: "600", color: COLOR.ink, alpha: t });
      [
        "This is the classic \"t-test\" — the usual check for data shaped like this. Other data shapes",
        "have their own named tests. And all of it assumes you ask the question once, at the end.",
        "Chapter 4: what happens when you check the results every single day instead?"
      ].forEach((line, i) => {
        text(line, 46, y + 48 + i * 17, { align: "left", size: 12.5, alpha: t, color: "#8a8375" });
      });
    }
  }
};
function renderControls5(state){
  controlsEl.innerHTML = "";
  makeBtn("↻ Walk through it again", "primary", () => {
    state.animStart = null;
    renderControls5(state);
    updateText();
  });
  if (!state.showNote){
    makeBtn("Show the fine print", null, () => {
      state.showNote = true;
      state.noteStart = null;
      renderControls5(state);
      updateText();
    });
  } else {
    makeNote("Next up: The Peeking Problem — checking every day quietly breaks the yardstick you just built.");
  }
}

registerChapter("03-signal-vs-noise", {
  scenes: [scene1, scene2, scene3, scene4, scene5]
});

})();
