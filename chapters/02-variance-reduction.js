"use strict";

(function(){

const groupColor = g => g === "A" ? COLOR.control : COLOR.treatment;

// Strata get neutral earth tones so blue/orange stays reserved for
// control/treatment — the two dimensions are drawn on top of each other.
const SIZE_COLOR = { big: "#8d8577", little: "#cdc6b6" };
const SIZE_LABEL = { big: "Big kids", little: "Little kids" };

// Blue/orange keep the same meaning as the rest of the course. The strata are
// a fact we already knew about each kid, not something the experiment did.
const GROUP_LEGEND = [
  { color: COLOR.control, label: "Control", def: "kept the usual lemonade recipe" },
  { color: COLOR.treatment, label: "Treatment", def: "got the new recipe we're testing" }
];
const STRATA_LEGEND = [
  { color: SIZE_COLOR.big, label: "Big kids", def: "drink much more every week, whichever group they're in" },
  { color: SIZE_COLOR.little, label: "Little kids", def: "drink much less, and we knew this before the experiment" }
];
const TREND_LEGEND = { color: COLOR.accent, label: "Trend line", def: "where a kid would sit if the helper number predicted drinking exactly" };

/* -------------------------------------------------------------------- */
/* Local drawing helpers                                                 */
/* -------------------------------------------------------------------- */

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(text, maxW){
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line){
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

// Canvas bg color; painting it over finished art fades that art out.
function fadeOut(alpha){
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = "#fdfcf9";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.restore();
}

function dashedLine(x1, y, x2, color, alpha, width){
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 2.5;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function label(text, x, y, opts){
  opts = opts || {};
  ctx.fillStyle = opts.color || COLOR.muted;
  ctx.font = opts.font || "18px FuturaHandwritten, cursive";
  ctx.textAlign = opts.align || "center";
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

// Tween bookkeeping: `startTween` records where the value is right now and
// where it should end up; `tweenNow` interpolates every frame and remembers
// the current value so a mid-flight retarget starts from the visible spot.
function startTween(state, key, to){
  const cur = state[key] ? state[key].now : to;
  state[key] = { from: cur, to, now: cur, start: null };
}
function tweenNow(state, key, now, dur, ease){
  const tw = state[key];
  if (!tw) return 0;
  if (tw.start == null) tw.start = now;
  const e = (ease || easeInOutCubic)(clamp((now - tw.start) / dur, 0, 1));
  tw.now = lerp(tw.from, tw.to, e);
  return tw.now;
}

/* -------------------------------------------------------------------- */
/* Data — fresh kids for this chapter                                    */
/* -------------------------------------------------------------------- */

const N = 40;

// 40 kids whose past drinking says nothing about this week, but whose SIZE
// says a lot. Sample is deliberately 70% big kids so Scene 3 has a mix to fix.
const STRATA_SPEC = [
  { size: "big",    n: 28, base: 34, spread: 4.5, effect: 4.0 },
  { size: "little", n: 12, base: 20, spread: 4.5, effect: 1.2 }
];

function generateStrataKids(seed){
  const rng = mulberry32(seed);
  const kids = [];
  let id = 0;
  STRATA_SPEC.forEach(s => {
    for (let i = 0; i < s.n; i++){
      const group = i % 2 === 0 ? "A" : "B";
      kids.push({
        id: id++,
        group,
        size: s.size,
        pre: randNormal(rng, 25, 7),                                        // useless history
        post: randNormal(rng, s.base, s.spread) + (group === "B" ? s.effect : 0)
      });
    }
  });
  kids.gridOrder = shuffle(kids, mulberry32(seed + 777));
  kids.barOrder = shuffle(kids, mulberry32(seed + 333));
  return kids;
}

function generatePlayKids(seed){
  const rng = mulberry32(seed);
  const kids = [];
  for (let i = 0; i < N; i++){
    const group = i % 2 === 0 ? "A" : "B";
    const base = randNormal(rng, 25, 7);
    kids.push({
      id: i,
      group,
      play: base + randNormal(rng, 0, 2.5),                                 // last week, before any treatment
      post: base + randNormal(rng, 0, 2.5) + (group === "B" ? 2.5 : 0)
    });
  }
  kids.barOrder = shuffle(kids, mulberry32(seed + 444));
  return kids;
}

const KIDS = generateStrataKids(4711);
const PLAY = generatePlayKids(8123);

const SAMPLE_BIG_FRAC = STRATA_SPEC[0].n / N;

function subset(size, group){
  return KIDS.filter(k => k.size === size && (group ? k.group === group : true));
}
const CELL_AVG = {
  bigA: mean(subset("big", "A").map(k => k.post)),
  bigB: mean(subset("big", "B").map(k => k.post)),
  littleA: mean(subset("little", "A").map(k => k.post)),
  littleB: mean(subset("little", "B").map(k => k.post))
};
const SIZE_AVG = {
  big: mean(subset("big").map(k => k.post)),
  little: mean(subset("little").map(k => k.post))
};
// Deviation from a kid's own stratum average — "within-group" noise.
const WITHIN_DEV = KIDS.map(k => k.post - SIZE_AVG[k.size]);

function reweighted(group, bigFrac){
  const big = group === "A" ? CELL_AVG.bigA : CELL_AVG.bigB;
  const little = group === "A" ? CELL_AVG.littleA : CELL_AVG.littleB;
  return bigFrac * big + (1 - bigFrac) * little;
}

/* -------------------------------------------------------------------- */
/* Scene 1 — When CUPED Isn't an Option                                  */
/* -------------------------------------------------------------------- */

const TRICKS = [
  { name: "Stratification",
    blurb: "Split kids into known groups BEFORE comparing, so you only ever compare like with like." },
  { name: "Post-Stratification",
    blurb: "Already collected a lopsided sample? Reweight the result afterward to match the real world." },
  { name: "Control Variates",
    blurb: "Subtract out any other number that predicts the outcome — it doesn't have to be past drinking." }
];

function drawTrickCards(alphaOf, opts){
  opts = opts || {};
  const marginX = 44, gap = 20;
  const w = (LOGICAL_W - marginX * 2 - gap * 2) / 3;
  const y = opts.y != null ? opts.y : 150;
  const h = opts.h != null ? opts.h : 200;
  TRICKS.forEach((trick, i) => {
    const a = clamp(alphaOf(i), 0, 1);
    if (a <= 0.001) return;
    const x = marginX + (w + gap) * i;
    const lift = (1 - a) * 26;                                              // slide up as it fades in
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#f3f0e8";
    roundRect(x, y + lift, w, h, 14);
    ctx.fill();
    if (opts.highlightOf){
      const hi = clamp(opts.highlightOf(i), 0, 1);
      if (hi > 0.001){
        ctx.globalAlpha = a * hi;
        ctx.fillStyle = "#ffffff";
        roundRect(x, y + lift, w, h, 14);
        ctx.fill();
        ctx.strokeStyle = COLOR.accent;
        ctx.lineWidth = 2.5;
        roundRect(x, y + lift, w, h, 14);
        ctx.stroke();
        ctx.globalAlpha = a;
      }
    }
    ctx.fillStyle = COLOR.accent;
    ctx.font = "600 18px FuturaHandwritten, cursive";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + w / 2, y + lift + 26);
    ctx.fillStyle = COLOR.ink;
    ctx.font = "600 21px FuturaHandwritten, cursive";
    ctx.fillText(trick.name, x + w / 2, y + lift + 50);
    ctx.fillStyle = COLOR.muted;
    ctx.font = "18px FuturaHandwritten, cursive";
    wrapLines(trick.blurb, w - 32).forEach((line, li) => {
      ctx.fillText(line, x + w / 2, y + lift + 76 + li * 17);
    });
    ctx.restore();
    if (opts.miniOf) opts.miniOf(i, x, y + lift, w, h, a);
  });
}

const scene1 = {
  title: "1. When CUPED Isn't an Option",
  legend: GROUP_LEGEND,
  text(state){
    if (state.phase === "problem"){
      return "Last chapter's trick needed sticky history: kids who drank a lot last week drank a lot again this week. This new class of 40 kids has history, but it's useless — plot last week against this week and there's no pattern to lean on. Subtracting it would only add noise.";
    }
    return "Good news: past-behaviour-of-the-same-metric is not the only thing you can lean on. Three other ways to shrink noise, one per scene from here.";
  },
  enter(state){
    state.phase = "problem";
    startTween(state, "reveal", 0);
    renderControls1(state);
  },
  draw(c, now, state){
    const reveal = tweenNow(state, "reveal", now, 1500);
    drawScatter(KIDS.map(k => ({ x: k.pre, y: k.post, color: groupColor(k.group) })), {
      plot: { x: 90, y: 40, w: 700, h: 350 },
      xLabel: "Last week's amount →",
      yLabel: "This week's amount →"
    });
    if (state.phase === "problem"){
      label("No diagonal. No pattern. Nothing to subtract.", LOGICAL_W / 2, 66,
        { font: "italic 20px FuturaHandwritten, cursive" });
    }
    fadeOut(clamp(reveal * 2.2, 0, 1));
    if (reveal > 0.001){
      label("Three other ways to shrink the noise", LOGICAL_W / 2, 96,
        { font: "600 24px FuturaHandwritten, cursive", color: COLOR.ink, alpha: clamp(reveal * 2.2, 0, 1) });
      // Stagger: each card starts 22% of the tween after the previous one.
      drawTrickCards(i => (reveal - 0.28 - i * 0.22) / 0.42, { y: 150, h: 200 });
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  if (state.phase === "problem"){
    makeBtn("Show me the options", "primary", () => {
      state.phase = "options";
      startTween(state, "reveal", 1);
      renderControls1(state);
      updateText();
    });
  } else {
    makeNote("Next up: stratification — the simplest of the three.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 2 — Stratification                                              */
/* -------------------------------------------------------------------- */

const S2_PLOT = { x: 58, y: 54, w: 620, h: 322 };

function drawStrataGrid(){
  const cols = 8, rows = 5;
  const marginX = 70, top = 44, bottomRoom = 86;
  const cellW = (LOGICAL_W - marginX * 2) / cols;
  const cellH = (LOGICAL_H - top - bottomRoom) / rows;
  const baseR = Math.min(cellW, cellH) * 0.32;
  KIDS.gridOrder.forEach((k, i) => {
    const x = marginX + cellW * (i % cols) + cellW / 2;
    const y = top + cellH * Math.floor(i / cols) + cellH / 2;
    ctx.beginPath();
    ctx.arc(x, y, baseR * (k.size === "big" ? 1.32 : 0.72), 0, Math.PI * 2);
    ctx.fillStyle = groupColor(k.group);
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  const legendY = LOGICAL_H - 46;
  const items = [
    { r: baseR * 1.32, text: "big kid", x: LOGICAL_W / 2 - 150 },
    { r: baseR * 0.72, text: "little kid", x: LOGICAL_W / 2 + 40 }
  ];
  items.forEach(it => {
    ctx.beginPath();
    ctx.arc(it.x, legendY, it.r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.muted;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    label("= " + it.text, it.x + it.r + 10, legendY + 5, { align: "left" });
  });
  label("Colour = which group. Size = which kind of kid.", LOGICAL_W / 2, 30,
    { font: "18px FuturaHandwritten, cursive" });
}

function drawStrataBars(splitT, appearT){
  const order = KIDS.barOrder;
  const n = order.length;
  const perBar = S2_PLOT.w / n;
  const barW = perBar * 0.6;

  const nBig = order.filter(k => k.size === "big").length;
  const nLit = n - nBig;
  const blockGap = 40;
  const availW = S2_PLOT.w - blockGap;
  const bigW = availW * (nBig / n), litW = availW - bigW;
  const bigX0 = S2_PLOT.x, litX0 = S2_PLOT.x + bigW + blockGap;

  let bi = 0, li = 0;
  const xs = order.map((k, i) => {
    const pooled = S2_PLOT.x + perBar * i + perBar / 2;
    let split;
    if (k.size === "big"){ split = bigX0 + (bigW / nBig) * (bi + 0.5); bi++; }
    else { split = litX0 + (litW / nLit) * (li + 0.5); li++; }
    return lerp(pooled, split, splitT);
  });

  const maxPost = Math.max(...KIDS.map(k => k.post)) * 1.12;
  const bottomY = S2_PLOT.y + S2_PLOT.h;
  const scale = S2_PLOT.h / maxPost;

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(S2_PLOT.x - 10, bottomY);
  ctx.lineTo(S2_PLOT.x + S2_PLOT.w + 10, bottomY);
  ctx.stroke();

  order.forEach((k, i) => {
    const h = k.post * scale * appearT;
    ctx.fillStyle = groupColor(k.group);
    ctx.globalAlpha = 0.85 * appearT;
    ctx.fillRect(xs[i] - barW / 2, bottomY - h, barW, Math.max(h, 1));
    ctx.globalAlpha = 1;
  });

  const pooledAvg = {
    A: mean(KIDS.filter(k => k.group === "A").map(k => k.post)),
    B: mean(KIDS.filter(k => k.group === "B").map(k => k.post))
  };
  const blocks = [
    { size: "big", x0: bigX0, x1: bigX0 + bigW },
    { size: "little", x0: litX0, x1: litX0 + litW }
  ];
  blocks.forEach(block => {
    ["A", "B"].forEach(g => {
      const cell = CELL_AVG[block.size + g];
      const y = bottomY - lerp(pooledAvg[g], cell, splitT) * scale * appearT;
      const x1 = lerp(S2_PLOT.x - 10, block.x0 - 6, splitT);
      const x2 = lerp(S2_PLOT.x + S2_PLOT.w + 10, block.x1 + 6, splitT);
      dashedLine(x1, y, x2, groupColor(g), 0.85 * appearT);
    });
    if (splitT > 0.02){
      label(SIZE_LABEL[block.size], (block.x0 + block.x1) / 2, bottomY + 24,
        { alpha: splitT, color: SIZE_COLOR[block.size] === "#cdc6b6" ? COLOR.muted : "#8d8577",
          font: "600 18px FuturaHandwritten, cursive" });
    }
  });

  label(splitT > 0.5 ? "Two smaller, fairer comparisons" : "One big pile — every kid next to every other kid",
    S2_PLOT.x + S2_PLOT.w / 2, 30, { font: "18px FuturaHandwritten, cursive" });
}

const scene2 = {
  title: "2. Stratification: Compare Like With Like",
  legend(state){
    // In the grid, size is drawn as circle size rather than a fill color, so
    // the strata entries describe the shape the reader actually sees there.
    if (state.phase === "grid"){
      return GROUP_LEGEND.concat([
        { color: SIZE_COLOR.big, label: "Big circle", def: "a big kid, who drinks much more every week" },
        { color: SIZE_COLOR.little, label: "Small circle", def: "a little kid, who drinks much less" }
      ]);
    }
    return GROUP_LEGEND.concat(STRATA_LEGEND);
  },
  text(state){
    if (state.phase === "grid"){
      return "Forty new kids. Their history is useless, but we know something else for free: big kids drink much more than little kids, every week, no matter which group they're in. Blue vs. orange is still the experiment; size is just a fact we already have.";
    }
    if (state.split && state.split.to === 1){
      return "Same kids, same data — just compared inside their own size group first. Now blue vs. orange is a fair fight in each half, and the leftover noise (the second bar on the right) is much smaller. Nothing was thrown away; we only stopped comparing big kids against little kids.";
    }
    return "One bar per kid, all mixed together. The dashed lines are the two group averages, and they sit almost on top of each other. The tall/short chaos isn't the experiment — it's mostly just big kids and little kids being different.";
  },
  enter(state){
    state.phase = "grid";
    startTween(state, "appear", 0);
    startTween(state, "split", 0);
    renderControls2(state);
  },
  draw(c, now, state){
    if (state.phase === "grid"){
      drawStrataGrid();
      return;
    }
    const appearT = tweenNow(state, "appear", now, 600, easeOutCubic);
    const splitT = tweenNow(state, "split", now, 1000);
    drawStrataBars(splitT, Math.max(appearT, 0.001));
    drawSpreadMeter(KIDS.map(k => k.post), WITHIN_DEV, {
      x: 742, y: 74, h: 268,
      title: "Noise left over",
      labels: ["Pooled", "Within-\ngroup"]
    });
  }
};
function renderControls2(state){
  controlsEl.innerHTML = "";
  if (state.phase === "grid"){
    makeBtn("Compare all 40 at once", "primary", () => {
      state.phase = "bars";
      startTween(state, "appear", 1);
      renderControls2(state);
      updateText();
      setLegend(scene2.legend(state));                                      // strata switch from circle size to bar blocks
    });
    return;
  }
  const isSplit = state.split.to === 1;
  makeBtn(isSplit ? "Back to one big pile" : "Split by size first", "primary", () => {
    startTween(state, "split", isSplit ? 0 : 1);
    renderControls2(state);
    updateText();
  });
  makeNote(isSplit
    ? "Compare like with like, then combine the two answers."
    : "You already know each kid's size — use it before you compare, not after.");
}

/* -------------------------------------------------------------------- */
/* Scene 3 — Post-Stratification                                         */
/* -------------------------------------------------------------------- */

const S3_MIX = { x: 56, w: 336, h: 34 };
const S3_BARS = { baseY: 402, top: 108, maxVal: 46, ctrlX: 552, trtX: 676, w: 78 };

function drawMixBar(y, bigFrac, title, opts){
  opts = opts || {};
  const bigW = S3_MIX.w * clamp(bigFrac, 0, 1);
  label(title, S3_MIX.x, y - 12, { align: "left", color: COLOR.ink,
    font: "600 19px FuturaHandwritten, cursive" });
  ctx.fillStyle = SIZE_COLOR.big;
  ctx.fillRect(S3_MIX.x, y, bigW, S3_MIX.h);
  ctx.fillStyle = SIZE_COLOR.little;
  ctx.fillRect(S3_MIX.x + bigW, y, S3_MIX.w - bigW, S3_MIX.h);
  const pct = Math.round(bigFrac * 100);
  if (pct >= 18) label(pct + "% big", S3_MIX.x + bigW / 2, y + 22, { color: "#ffffff", font: "600 17px FuturaHandwritten, cursive" });
  if (pct <= 82) label((100 - pct) + "% little", S3_MIX.x + bigW + (S3_MIX.w - bigW) / 2, y + 22, { color: "#6b6659", font: "600 17px FuturaHandwritten, cursive" });
  if (opts.note) label(opts.note, S3_MIX.x, y + S3_MIX.h + 20, { align: "left" });
}

function drawEstimateBars(bigFrac){
  const scale = (S3_BARS.baseY - S3_BARS.top) / S3_BARS.maxVal;
  const ctrl = reweighted("A", bigFrac);
  const trt = reweighted("B", bigFrac);

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(S3_BARS.ctrlX - 26, S3_BARS.baseY);
  ctx.lineTo(S3_BARS.trtX + S3_BARS.w + 26, S3_BARS.baseY);
  ctx.stroke();

  // Where your untouched 70%-big sample landed, for comparison.
  const rawCtrlY = S3_BARS.baseY - reweighted("A", SAMPLE_BIG_FRAC) * scale;
  const rawTrtY = S3_BARS.baseY - reweighted("B", SAMPLE_BIG_FRAC) * scale;
  dashedLine(S3_BARS.ctrlX - 20, rawCtrlY, S3_BARS.ctrlX + S3_BARS.w + 10, COLOR.muted, 0.9, 1.5);
  dashedLine(S3_BARS.trtX - 10, rawTrtY, S3_BARS.trtX + S3_BARS.w + 20, COLOR.muted, 0.9, 1.5);
  label("raw sample result", S3_BARS.trtX + S3_BARS.w + 22, Math.min(rawCtrlY, rawTrtY) - 8,
    { align: "right", font: "italic 22px FuturaHandwritten, cursive" });

  [{ v: ctrl, x: S3_BARS.ctrlX, color: COLOR.control, name: "Control" },
   { v: trt, x: S3_BARS.trtX, color: COLOR.treatment, name: "Treatment" }].forEach(b => {
    const h = b.v * scale;
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.88;
    ctx.fillRect(b.x, S3_BARS.baseY - h, S3_BARS.w, h);
    ctx.globalAlpha = 1;
    label(b.name, b.x + S3_BARS.w / 2, S3_BARS.baseY + 20, { color: b.color, font: "600 17px FuturaHandwritten, cursive" });
  });

  // Shade the gap the experiment actually cares about.
  const ctrlY = S3_BARS.baseY - ctrl * scale;
  const trtY = S3_BARS.baseY - trt * scale;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = COLOR.accent;
  ctx.fillRect(S3_BARS.ctrlX, trtY, S3_BARS.trtX + S3_BARS.w - S3_BARS.ctrlX, ctrlY - trtY);
  ctx.restore();
  label("the gap", S3_BARS.trtX + S3_BARS.w / 2, (ctrlY + trtY) / 2 + 4,
    { color: COLOR.accent, font: "600 17px FuturaHandwritten, cursive" });

  label("Reweighted estimate", (S3_BARS.ctrlX + S3_BARS.trtX + S3_BARS.w) / 2, 78,
    { color: COLOR.ink, font: "600 19px FuturaHandwritten, cursive" });
}

const scene3 = {
  title: "3. Post-Stratification: Fix the Mix Afterward",
  legend: GROUP_LEGEND.concat([
    { color: SIZE_COLOR.big, label: "Big kids", def: "the share of the mix bars on the left that's big kids" },
    { color: SIZE_COLOR.little, label: "Little kids", def: "the rest of each mix bar — you over-sampled big kids" }
  ]),
  text(state){
    const pct = Math.round((state.mix ? state.mix.now : SAMPLE_BIG_FRAC) * 100);
    if (!state.touched){
      return "Here's the wrinkle. Your 40 kids happened to be 70% big kids — but the real playground is not 70% big. Big kids react more strongly to the new recipe, so a sample with too many of them makes the average effect look bigger than it really is out on the real playground. The fix doesn't need new data: recompute each group's average by counting big-kid results and little-kid results in the real-world proportion, instead of whatever proportion your 40 kids happened to land in. Drag the slider to set what \"real-world\" means, and watch both group averages get recomputed live.";
    }
    if (pct > 60) return "Still mostly big kids, so barely anything changes — the reweighted bars sit near the dashed raw result.";
    if (pct > 40) return "A 50/50 world counts big-kid and little-kid results equally, instead of leaning on your over-sampled big kids. Both bars drop and the gap shrinks: the honest, real-world answer is smaller than your raw number suggested.";
    return "A mostly-little-kids world leans almost entirely on your 12 little kids' results. The gap nearly vanishes — same experiment, same kids, just weighted to match a different real world.";
  },
  enter(state){
    state.touched = false;
    state.sliderEl = null;
    startTween(state, "mix", SAMPLE_BIG_FRAC);
    state.mix.now = SAMPLE_BIG_FRAC;
    renderControls3(state);
  },
  draw(c, now, state){
    const bigFrac = tweenNow(state, "mix", now, 800);
    if (state.sliderEl && state.mix.to !== Number(state.sliderEl.value) / 100){
      state.sliderEl.value = String(Math.round(bigFrac * 100));
    }
    drawMixBar(120, SAMPLE_BIG_FRAC, "Your sample's mix", { note: "fixed — this is who you happened to get" });
    drawMixBar(250, bigFrac, "The real world's mix", { note: "you set this below" });
    drawEstimateBars(bigFrac);
  }
};
function renderControls3(state){
  controlsEl.innerHTML = "";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = String(Math.round(state.mix.now * 100));
  slider.style.width = "220px";
  slider.addEventListener("input", () => {
    const v = Number(slider.value) / 100;
    state.mix = { from: v, to: v, now: v, start: null };                     // live drag: no tween
    state.touched = true;
    updateText();
  });
  controlsEl.appendChild(slider);
  state.sliderEl = slider;
  makeNote("% big kids in the real world");
  makeBtn("Reality: 50/50", null, () => {
    startTween(state, "mix", 0.5);
    state.touched = true;
    updateText();
  });
  makeBtn("Back to my sample (70%)", null, () => {
    startTween(state, "mix", SAMPLE_BIG_FRAC);
    state.touched = true;
    updateText();
  });
}

/* -------------------------------------------------------------------- */
/* Scene 4 — Control Variates                                            */
/* -------------------------------------------------------------------- */

const S4_PLOT = { x: 58, y: 40, w: 620, h: 336 };

const scene4 = {
  title: "4. Control Variates: Borrow a Different Signal",
  legend(state){
    return state.phase === "scatter" && state.shown
      ? GROUP_LEGEND.concat([TREND_LEGEND])
      : GROUP_LEGEND;
  },
  text(state){
    if (state.phase === "scatter"){
      return state.shown
        ? "There it is — a clear diagonal, and it has nothing to do with lemonade history. Active kids get thirsty; minutes outdoors last week predicts cups drunk this week. That's all a control variate needs to be: any number, measured before the experiment, that tracks the outcome."
        : "These kids' drinking history is useless too. But we also logged something unrelated-sounding: minutes spent playing outside last week. Plot it against this week's drinking and see whether it's worth anything.";
    }
    if (state.phase === "raw"){
      return "Same subtract-and-tighten move as last chapter — but the thing we subtract is outdoor play time, not past drinking.";
    }
    if (!state.guessed){
      return "The predictable, active-kid part of each bar is being removed. Nobody's behaviour changed; we're just no longer surprised that the outdoorsy kids drank a lot.";
    }
    return "Blue vs. orange finally separates, and the noise bar on the right is much shorter. The lesson: the helper number doesn't have to be the same metric's past. Any well-correlated number you measured beforehand will do.";
  },
  enter(state){
    state.phase = "scatter";
    state.shown = false;
    state.guessed = false;
    startTween(state, "trend", 0);
    startTween(state, "adj", 0);
    renderControls4(state);
  },
  draw(c, now, state){
    if (state.phase === "scatter"){
      const t = tweenNow(state, "trend", now, 900);
      drawScatter(PLAY.map(k => ({ x: k.play, y: k.post, color: groupColor(k.group) })), {
        plot: { x: 90, y: 40, w: 700, h: 350 },
        diagonalT: t,
        xLabel: "Minutes outside last week →",
        yLabel: "This week's amount →"
      });
      return;
    }
    const t = tweenNow(state, "adj", now, 900);
    drawMorphBars(PLAY, t, {
      plot: S4_PLOT,
      order: PLAY.barOrder,
      valueOfRaw: k => k.post,
      valueOfAdjusted: k => k.post - k.play,
      colorOfFn: k => groupColor(k.group),
      showAverages: state.guessed,
      groupOfFn: k => k.group,
      groupColorFn: groupColor,
      avgAlpha: 1
    });
    if (state.guessed){
      drawSpreadMeter(PLAY.map(k => k.post), PLAY.map(k => k.post - k.play), {
        x: 742, y: 74, h: 268,
        title: "Noise left over",
        labels: ["Raw", "After\nsubtract"]
      });
    }
  }
};
function renderControls4(state){
  controlsEl.innerHTML = "";
  if (state.phase === "scatter"){
    makeBtn(state.shown ? "Hide the trend" : "Show the trend", "primary", () => {
      state.shown = !state.shown;
      startTween(state, "trend", state.shown ? 1 : 0);
      renderControls4(state);
      updateText();
      setLegend(scene4.legend(state));                                      // trend line enters/leaves the picture
    });
    if (state.shown){
      makeBtn("Subtract it out →", null, () => {
        state.phase = "raw";
        renderControls4(state);
        updateText();
        setLegend(scene4.legend(state));
      });
    }
    return;
  }
  if (state.phase === "raw"){
    makeBtn("− Subtract the outdoor-play part", "primary", () => {
      state.phase = "adjusted";
      startTween(state, "adj", 1);
      renderControls4(state);
      updateText();
    });
    return;
  }
  if (!state.guessed){
    makeBtn("Now which group won?", "primary", () => {
      state.guessed = true;
      renderControls4(state);
      updateText();
    });
  } else {
    makeNote("Orange is clearly above blue, and the leftover-noise bar shrank.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 5 — Recap                                                       */
/* -------------------------------------------------------------------- */

const TRICK_WHEN = [
  "Use it when you know a category up front that predicts the outcome — size, country, device, new vs. returning. Decide the split before you look at results.",
  "Use it when your sample's mix doesn't match the real world's mix. You can only fix this afterward if you recorded which category each unit belongs to.",
  "Use it when you have any other number measured beforehand that moves with the outcome. It does not have to be the same metric's own past."
];

function drawMini(i, x, y, w, h, alpha){
  const cx = x + w / 2, top = y + h - 62;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (i === 0){
    [-1, 1].forEach(side => {
      const bx = cx + side * 46 - 30;
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, top, 60, 44);
      [[COLOR.control, 16], [COLOR.treatment, 40]].forEach(([col, dx]) => {
        ctx.beginPath();
        ctx.arc(bx + dx, top + 22, side < 0 ? 9 : 5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      });
    });
  } else if (i === 1){
    const bw = 84;
    [[cx - 60 - bw / 2, 0.72], [cx + 60 - bw / 2, 0.4]].forEach(([bx, frac], k) => {
      ctx.fillStyle = SIZE_COLOR.big;
      ctx.fillRect(bx, top + 14, bw * frac, 20);
      ctx.fillStyle = SIZE_COLOR.little;
      ctx.fillRect(bx + bw * frac, top + 14, bw * (1 - frac), 20);
      if (k === 0){
        ctx.strokeStyle = COLOR.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, top + 24);
        ctx.lineTo(cx + 12, top + 24);
        ctx.lineTo(cx + 5, top + 18);
        ctx.moveTo(cx + 12, top + 24);
        ctx.lineTo(cx + 5, top + 30);
        ctx.stroke();
      }
    });
  } else {
    const px = cx - 52, py = top + 2, pw = 104, ph = 42;
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLOR.accent;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + ph - 6);
    ctx.lineTo(px + pw - 6, py + 6);
    ctx.stroke();
    ctx.restore();
    const rng = mulberry32(99);
    for (let d = 0; d < 12; d++){
      const u = rng();
      ctx.beginPath();
      ctx.arc(px + 8 + u * (pw - 16), py + ph - 8 - u * (ph - 16) + (rng() - 0.5) * 12, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = d % 2 ? COLOR.treatment : COLOR.control;
      ctx.fill();
    }
  }
  ctx.restore();
}

const scene5 = {
  title: "5. Three Tricks, One Idea",
  legend: GROUP_LEGEND.concat([
    { color: SIZE_COLOR.big, label: "Big kids", def: "the known category from cards 1 and 2" },
    { color: SIZE_COLOR.little, label: "Little kids", def: "the other side of that category" },
    TREND_LEGEND
  ]),
  text(state){
    if (state.sel == null){
      return "All three do the same thing: remove the part of the outcome you could already have predicted, so the part left over is mostly the experiment. Tap a trick to see when to reach for it.";
    }
    return TRICK_WHEN[state.sel] + "  —  Every trick in this chapter and the last one shrinks noise before you even ask whether the gap is real. But how do you actually decide if a gap is real? That's the t-test, and it's next.";
  },
  enter(state){
    state.sel = null;
    startTween(state, "reveal", 1);
    state.reveal.from = 0;
    state.reveal.now = 0;
    [0, 1, 2].forEach(i => startTween(state, "hi" + i, 0));
    renderControls5(state);
  },
  draw(c, now, state){
    const reveal = tweenNow(state, "reveal", now, 1400);
    label("Remove what you could already predict. Keep what the experiment did.",
      LOGICAL_W / 2, 62, { font: "600 22px FuturaHandwritten, cursive", color: COLOR.ink,
        alpha: clamp(reveal * 3, 0, 1) });
    const his = [0, 1, 2].map(i => tweenNow(state, "hi" + i, now, 500, easeOutCubic));
    drawTrickCards(i => (reveal - i * 0.22) / 0.5, {
      y: 108, h: 250,
      highlightOf: i => his[i],
      miniOf: drawMini
    });
    label("Next chapter: is the gap real, or is it luck?", LOGICAL_W / 2, LOGICAL_H - 42,
      { font: "italic 19px FuturaHandwritten, cursive", alpha: clamp((reveal - 0.7) / 0.3, 0, 1) });
  }
};
function renderControls5(state){
  controlsEl.innerHTML = "";
  TRICKS.forEach((trick, i) => {
    makeBtn(trick.name, state.sel === i ? "primary selected" : null, () => {
      state.sel = i;
      [0, 1, 2].forEach(j => startTween(state, "hi" + j, j === i ? 1 : 0));
      renderControls5(state);
      updateText();
    });
  });
}

registerChapter("02-variance-reduction", { scenes: [scene1, scene2, scene3, scene4, scene5] });

})();
