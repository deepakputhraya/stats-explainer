"use strict";

(function(){

const groupColor = g => (g === "A" ? COLOR.control : COLOR.treatment);

const RECIPE_LEGEND = [
  { color: COLOR.control, label: "Old recipe", def: "the usual lemonade" },
  { color: COLOR.treatment, label: "New recipe", def: "the one we're testing" }
];
const CURVE_ITEM = { color: COLOR.accent, label: "Belief curve", def: "how likely each outcome looks right now — taller means more likely" };

/* -------------------------------------------------------------------- */
/* Data — 20 pairs of kids, revealed 10 kids at a time                  */
/* -------------------------------------------------------------------- */

const PAIRS = 20;
const EFFECT = 2.6;

const pairs = (function(){
  const rng = mulberry32(1144);
  const out = [];
  for (let i = 0; i < PAIRS; i++){
    out.push({ a: randNormal(rng, 25, 6), b: randNormal(rng, 25 + EFFECT, 6) });
  }
  return out;
})();

const kids = [];
pairs.forEach((p, i) => {
  kids.push({ id: i * 2, group: "A", val: p.a });
  kids.push({ id: i * 2 + 1, group: "B", val: p.b });
});
const gridOrder = shuffle(kids, mulberry32(4242));

const spreadAll = stdev(kids.map(k => k.val));
const avgA = mean(kids.filter(k => k.group === "A").map(k => k.val));
const avgB = mean(kids.filter(k => k.group === "B").map(k => k.val));

function normalCdf(z){
  // Abramowitz–Stegun erf approximation, plenty accurate for a readout.
  const s = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}

const START_WIDTH = 6;
const WIDTH_SCALE = 1.3;

// Belief after each chunk of data: center = observed gap so far, width shrinks
// as more kids come in.
const STEPS = [{ n: 0, center: 0, width: START_WIDTH, prob: 0.5 }];
[5, 10, 15, 20].forEach(k => {
  const seen = pairs.slice(0, k);
  const center = mean(seen.map(p => p.b)) - mean(seen.map(p => p.a));
  const width = spreadAll * Math.sqrt(2 / k) * WIDTH_SCALE;
  STEPS.push({ n: k * 2, center, width, prob: normalCdf(center / width) });
});
const LAST = STEPS[STEPS.length - 1];

/* -------------------------------------------------------------------- */
/* Belief curve                                                          */
/* -------------------------------------------------------------------- */

const XMIN = -16, XMAX = 16;
const DEFAULT_CURVE_PLOT = { x: 80, y: 112, w: 720, h: 248 };
const PEAK_UNIT = 2.05;

function drawBeliefCurve(center, width, opts){
  opts = opts || {};
  const plot = opts.plot || DEFAULT_CURVE_PLOT;
  const alpha = opts.alpha != null ? opts.alpha : 1;
  const bottom = plot.y + plot.h;
  const toX = v => plot.x + ((v - XMIN) / (XMAX - XMIN)) * plot.w;
  const peak = clamp((PEAK_UNIT / width) * plot.h, 6, plot.h * 0.98);
  const heightAt = v => peak * Math.exp(-0.5 * Math.pow((v - center) / width, 2));

  ctx.save();
  ctx.globalAlpha = alpha;

  // shaded halves: which side of "no difference" does the belief sit on
  const fillSide = (from, to, color) => {
    ctx.beginPath();
    ctx.moveTo(toX(from), bottom);
    for (let i = 0; i <= 120; i++){
      const v = lerp(from, to, i / 120);
      ctx.lineTo(toX(v), bottom - heightAt(v));
    }
    ctx.lineTo(toX(to), bottom);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.2;
    ctx.fill();
    ctx.globalAlpha = alpha;
  };
  fillSide(XMIN, 0, COLOR.control);
  fillSide(0, XMAX, COLOR.treatment);

  ctx.beginPath();
  for (let i = 0; i <= 240; i++){
    const v = lerp(XMIN, XMAX, i / 240);
    const x = toX(v), y = bottom - heightAt(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COLOR.accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  // baseline + "no difference" marker
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.x, bottom);
  ctx.lineTo(plot.x + plot.w, bottom);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = COLOR.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(toX(0), plot.y - 4);
  ctx.lineTo(toX(0), bottom);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COLOR.muted;
  ctx.font = "12px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  ctx.fillText("no difference", toX(0), plot.y - 10);
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.control;
  ctx.fillText("← old recipe better", plot.x + 4, bottom + 20);
  ctx.textAlign = "right";
  ctx.fillStyle = COLOR.treatment;
  ctx.fillText("new recipe better →", plot.x + plot.w - 4, bottom + 20);
  ctx.textAlign = "center";
}

function drawReadout(pct, opts){
  opts = opts || {};
  const x = opts.x != null ? opts.x : LOGICAL_W / 2;
  const y = opts.y != null ? opts.y : 46;
  ctx.save();
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.accent;
  ctx.font = "bold 30px FuturaHandwritten, cursive";
  ctx.fillText(pct == null ? "?" : Math.round(pct * 100) + "%", x, y);
  ctx.fillStyle = COLOR.muted;
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.fillText(opts.label || "chance the new recipe is better", x, y + 19);
  ctx.restore();
}

function drawCaption(text, y, alpha){
  ctx.save();
  ctx.globalAlpha = alpha != null ? alpha : 1;
  ctx.fillStyle = COLOR.muted;
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  ctx.fillText(text, LOGICAL_W / 2, y);
  ctx.restore();
}

function tween(state, now, ms){
  if (state.animStart == null) state.animStart = now;
  return clamp((now - state.animStart) / ms, 0, 1);
}

/* -------------------------------------------------------------------- */
/* Scene 1 — A Different Question                                        */
/* -------------------------------------------------------------------- */

const scene1 = {
  title: "1. A Different Question",
  legend(state){
    const items = RECIPE_LEGEND.slice();
    if (state.phase === "asking"){
      items.push({ color: COLOR.accent, label: "?", def: "the chance the new recipe is better — the number we're about to build" });
    }
    return items;
  },
  text(state){
    if (state.phase === "groups"){
      return "Back to the lemonade stand, one last time. Forty kids: blue got the old recipe, orange got the new one. Orange sold a bit more on average. Every chapter so far has ended up asking the same kind of question about a gap like this.";
    }
    return "Chapter 3 asked: is this gap big enough to call it real — yes or no? A threshold, and a verdict. This chapter asks a different question entirely: given everything we've seen, how likely is it that the new recipe is actually better? Not a verdict. A number that can be 60%, or 94%, or anything in between.";
  },
  enter(state){
    state.phase = "groups";
    state.animStart = null;
    renderControls1(state);
  },
  draw(c, now, state){
    const asking = state.phase === "asking";
    const raw = asking ? tween(state, now, 1300) : 0;
    // Staged hand-off: grid clears out before the summary arrives, so the two
    // never overlap into visual mush.
    const out = easeInOutCubic(clamp(raw / 0.45, 0, 1));
    const t = easeOutCubic(clamp((raw - 0.5) / 0.5, 0, 1));

    if (out < 1){
      ctx.save();
      ctx.globalAlpha = 1 - out;
      drawUnitGrid(kids, k => groupColor(k.group), { order: gridOrder, cols: 10, rows: 4, marginY: 110 });
      ctx.textAlign = "center";
      ctx.font = "18px FuturaHandwritten, cursive";
      ctx.fillStyle = COLOR.control;
      ctx.fillText("old recipe: " + avgA.toFixed(1) + " cups on average", LOGICAL_W / 2 - 150, 64);
      ctx.fillStyle = COLOR.treatment;
      ctx.fillText("new recipe: " + avgB.toFixed(1) + " cups on average", LOGICAL_W / 2 + 150, 64);
      ctx.restore();
    }

    if (t > 0){
      ctx.save();
      ctx.globalAlpha = t;
      ctx.textAlign = "center";

      const bottom = 340, maxH = 210, scaleV = maxH / (avgB * 1.12);
      [
        { label: "old", avg: avgA, x: 150, color: COLOR.control },
        { label: "new", avg: avgB, x: 270, color: COLOR.treatment }
      ].forEach(b => {
        const h = b.avg * scaleV;
        ctx.fillStyle = b.color;
        ctx.globalAlpha = t * 0.85;
        ctx.fillRect(b.x - 38, bottom - h, 76, h);
        ctx.globalAlpha = t;
        ctx.fillStyle = b.color;
        ctx.font = "bold 20px FuturaHandwritten, cursive";
        ctx.fillText(b.avg.toFixed(1), b.x, bottom - h - 10);
        ctx.fillStyle = COLOR.muted;
        ctx.font = "18px FuturaHandwritten, cursive";
        ctx.fillText(b.label + " recipe", b.x, bottom + 20);
      });
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(90, bottom);
      ctx.lineTo(330, bottom);
      ctx.stroke();
      ctx.fillStyle = COLOR.muted;
      ctx.font = "18px FuturaHandwritten, cursive";
      ctx.fillText("cups sold, on average", 210, 100);

      ctx.fillStyle = COLOR.muted;
      ctx.font = "30px FuturaHandwritten, cursive";
      ctx.fillText("→", 400, 230);

      ctx.fillStyle = COLOR.accent;
      ctx.font = "bold 104px FuturaHandwritten, cursive";
      ctx.fillText("?", 620, 250);
      ctx.fillStyle = COLOR.ink;
      ctx.font = "21px FuturaHandwritten, cursive";
      ctx.fillText("chance the new recipe is better", 620, 292);
      ctx.restore();
      drawCaption("We'll build that number up over the next two screens.", LOGICAL_H - 24, t);
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  if (state.phase === "groups"){
    makeBtn("So… is the gap real?", "primary", () => {
      state.phase = "asking";
      state.animStart = null;
      renderControls1(state);
      setLegend(scene1.legend(state));
      updateText();
    });
  } else {
    makeNote("Same data as always. Different question about it.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 2 — The Starting Belief                                         */
/* -------------------------------------------------------------------- */

const scene2 = {
  title: "2. The Starting Belief",
  legend: [
    CURVE_ITEM,
    { color: COLOR.control, label: "Left half", def: "outcomes where the old recipe wins" },
    { color: COLOR.treatment, label: "Right half", def: "outcomes where the new recipe wins" }
  ],
  text(state){
    if (!state.started){
      return "Before a single cup is sold, what do we believe? Honestly: not much. The new recipe might help, might hurt, might do nothing at all. Let's draw that.";
    }
    return "This is a belief curve. Taller means \"more likely\", and it's spread out over every possible outcome — new recipe much worse on the left, much better on the right. Right now it's wide and flat and centered on no difference: we're admitting we have no idea. Half the curve sits on each side, so the honest answer today is a coin flip.";
  },
  enter(state){
    state.started = false;
    state.animStart = null;
    renderControls2(state);
  },
  draw(c, now, state){
    if (!state.started){
      drawCaption("(nothing measured yet)", LOGICAL_H / 2, 1);
      drawReadout(null, {});
      return;
    }
    const t = easeOutCubic(tween(state, now, 1100));
    drawBeliefCurve(0, lerp(13, START_WIDTH, t), { alpha: t });
    drawReadout(0.5, { alpha: t });
    drawCaption("Wide curve = wide open mind.", LOGICAL_H - 22, t);
  }
};
function renderControls2(state){
  controlsEl.innerHTML = "";
  if (!state.started){
    makeBtn("Start with an open mind", "primary", () => {
      state.started = true;
      state.animStart = null;
      renderControls2(state);
      updateText();
    });
  } else {
    makeNote("Nothing is ruled out yet — that's the point of starting wide.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 3 — Updating With Data                                          */
/* -------------------------------------------------------------------- */

const scene3 = {
  title: "3. Updating With Data",
  legend: [
    { color: COLOR.accent, label: "Updated belief", def: "narrows as more kids are counted, and slides toward what the data shows" },
    { color: COLOR.control, label: "Left half", def: "outcomes where the old recipe wins" },
    { color: COLOR.treatment, label: "Right half", def: "outcomes where the new recipe wins — this is the share the number reports" }
  ],
  text(state){
    const s = STEPS[state.step];
    if (state.step === 0){
      return "Now let the kids start selling. Each batch of results pulls the curve around: it gets narrower, because we know more, and it slides toward whatever the data is actually showing.";
    }
    if (state.step < STEPS.length - 1){
      return "After " + s.n + " kids the curve is tighter and has drifted right, toward \"new recipe better\". The number moves with it — no threshold was crossed, nothing was declared. Keep adding kids.";
    }
    return "All forty kids in. The curve is narrow and sits clearly to the right of no difference, and that shape is exactly what \"" + Math.round(LAST.prob * 100) + "% chance the new recipe is better\" means. Notice there was never a moment where the answer flipped from \"no\" to \"yes\" — it just got more confident.";
  },
  enter(state){
    state.step = 0;
    state.from = STEPS[0];
    state.animStart = null;
    renderControls3(state);
  },
  draw(c, now, state){
    const target = STEPS[state.step];
    const t = easeInOutCubic(tween(state, now, 900));
    const center = lerp(state.from.center, target.center, t);
    const width = lerp(state.from.width, target.width, t);
    const prob = lerp(state.from.prob, target.prob, t);

    drawBeliefCurve(center, width, {});
    drawReadout(prob, {});
    const shownKids = Math.round(lerp(state.from.n, target.n, t));
    drawCaption(shownKids === 0 ? "no data yet — starting belief" : shownKids + " kids counted so far", LOGICAL_H - 22, 1);
  }
};
function renderControls3(state){
  controlsEl.innerHTML = "";
  if (state.step < STEPS.length - 1){
    makeBtn(state.step === 0 ? "Add the first kids' data" : "Add more kids' data", "primary", () => {
      state.from = STEPS[state.step];
      state.step += 1;
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else {
    makeNote("Narrower and further right, every batch.");
  }
  if (state.step > 0){
    makeBtn("↻ Start over", null, () => {
      state.from = STEPS[state.step];
      state.step = 0;
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  }
}

/* -------------------------------------------------------------------- */
/* Scene 4 — Recap + Course Closer                                       */
/* -------------------------------------------------------------------- */

const scene4 = {
  title: "4. Two Ways to Answer",
  legend: [
    { color: COLOR.good, label: "Yes/no verdict", def: "Chapter 3's answer — one bit, decided by a threshold" },
    { color: COLOR.accent, label: "Belief curve", def: "this chapter's answer — a probability that keeps updating" }
  ],
  text(state){
    if (!state.revealed){
      return "Two answers to the same experiment. On the left, the yes/no verdict from Chapter 3: cross the line and it's real, miss the line and it isn't. On the right, this chapter's answer: a probability, updated continuously as data arrives, that never has to pretend uncertainty is a switch.";
    }
    return "That's the course. We started by asking what an experiment even is, and what \"significant\" is really claiming. We saw noise-reduction tricks like CUPED cut through the jitter so a small real effect could show up. We saw how checking too often, and checking too many things at once, invent false alarms out of thin air. We saw A/A tests catch broken pipelines before they cost you a decision, switchback tests handle things you can't split person by person, and bandits shift traffic as they learn. And here at the end, we saw that even the basic yes/no question can be reframed as a probability. None of these tools make uncertainty go away — they just stop it from fooling you. Go run a good experiment.";
  },
  enter(state){
    state.revealed = false;
    state.animStart = null;
    renderControls4(state);
  },
  draw(c, now, state){
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "18px FuturaHandwritten, cursive";
    ctx.fillStyle = COLOR.muted;
    ctx.fillText("Chapter 3's answer", 170, 74);
    ctx.fillText("This chapter's answer", 570, 74);
    ctx.restore();

    // Left: the threshold verdict
    const boxes = [
      { label: "YES, it's real", y: 176, on: true },
      { label: "NO, it isn't", y: 254, on: false }
    ];
    boxes.forEach(b => {
      ctx.save();
      ctx.globalAlpha = b.on ? 1 : 0.35;
      ctx.fillStyle = b.on ? COLOR.good : "#ffffff";
      ctx.strokeStyle = b.on ? COLOR.good : COLOR.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(60, b.y, 220, 54);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = b.on ? "#ffffff" : COLOR.muted;
      ctx.font = "bold 22px FuturaHandwritten, cursive";
      ctx.textAlign = "center";
      ctx.fillText(b.label, 170, b.y + 34);
      ctx.restore();
    });
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.muted;
    ctx.font = "18px FuturaHandwritten, cursive";
    ctx.fillText("one bit of information", 170, 348);
    ctx.restore();

    // Right: the belief curve
    drawBeliefCurve(LAST.center, LAST.width, { plot: { x: 360, y: 186, w: 460, h: 148 } });
    drawReadout(LAST.prob, { x: 590, y: 122 });

    if (state.revealed){
      const t = easeOutCubic(tween(state, now, 900));
      drawCaption("Ten chapters, one lesson: uncertainty is the thing you're measuring, not the thing in your way.", LOGICAL_H - 26, t);
    }
  }
};
function renderControls4(state){
  controlsEl.innerHTML = "";
  if (!state.revealed){
    makeBtn("Look back at the whole course", "primary", () => {
      state.revealed = true;
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
  } else {
    makeNote("That's the end of the course — thanks for clicking through.");
  }
}

registerChapter("09-bayesian", {
  scenes: [scene1, scene2, scene3, scene4]
});

})();
