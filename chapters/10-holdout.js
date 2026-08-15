"use strict";

(function(){

  const FONT = 'FuturaHandwritten, cursive';
  const CHANCE = COLOR.accent;

  function label(text, x, y, opts){
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || COLOR.muted;
    ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || 12.5) + "px " + FONT;
    ctx.textAlign = opts.align || "center";
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function circle(x, y, r, color, alpha){
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha != null ? alpha : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------------- */
  /* Shared data — one lemonade stand, one new recipe, plus a holdout.     */
  /* -------------------------------------------------------------------- */

  const N = 40;
  const IDS = [];
  for (let i = 0; i < N; i++) IDS.push(i);

  const THIRST = (function(){
    const rng = mulberry32(8801);
    return IDS.map(() => clamp(randNormal(rng, 22, 6), 9, 37));
  })();

  // Fair random split (same construction as chapter 00).
  const FAIR = (function(){
    const order = shuffle(IDS, mulberry32(4242));
    const g = new Array(N);
    order.forEach((k, pos) => { g[k] = pos < N / 2 ? "B" : "A"; });
    return g;
  })();

  // Holdout split: 10 of the 20 control kids are peeled off as a holdout
  // (no recipe change, never analyzed), shrinking the analyzable control to 10.
  const HOLDOUT = (function(){
    const order = shuffle(IDS, mulberry32(4242));
    const g = new Array(N);
    order.forEach((k, pos) => {
      if (pos < N / 2) g[k] = "B";          // treatment (20)
      else if (pos < N / 2 + N / 4) g[k] = "A";      // control (10)
      else g[k] = "H";                                // holdout (10)
    });
    return g;
  })();

  const CUPS_NATURAL = (function(){
    const rng = mulberry32(3131);
    return IDS.map(i => clamp(THIRST[i] * 0.55 + randNormal(rng, 11, 3.4), 4, 40));
  })();

  const RECIPE_EFFECT = 5.5;
  const OUTCOME = IDS.map(i => clamp(CUPS_NATURAL[i] + (FAIR[i] === "B" ? RECIPE_EFFECT : 0), 4, 40));

  function meanOf(group){ return mean(IDS.filter(i => FAIR[i] === group).map(i => OUTCOME[i])); }
  const REAL_GAP = meanOf("B") - meanOf("A");

  // Holdout layout positions.
  function gridPos(i, cols, x0, y0, cellW, cellH){
    return {
      x: x0 + cellW * (i % cols) + cellW / 2,
      y: y0 + cellH * Math.floor(i / cols) + cellH / 2
    };
  }

  function groupColor(g){
    return g === "A" ? COLOR.control : g === "B" ? COLOR.treatment : COLOR.muted;
  }

  /* -------------------------------------------------------------------- */
  /* Scene 1 — The Idea of a Holdout                                       */
  /* -------------------------------------------------------------------- */

  const scene1 = {
    title: "1. A Group You Don't Touch",
    legend: [
      { color: COLOR.control, label: "Control", def: "usual recipe — measured" },
      { color: COLOR.treatment, label: "Treatment", def: "new recipe — measured" },
      { color: COLOR.muted, label: "Holdout", def: "usual recipe — set aside, never compared" }
    ],
    text(state){
      if (state.phase === "pooled")
        return "Forty kids, the same stand, the same recipe test. This time we'll split them three ways instead of two. Treatment gets the new recipe, control keeps the usual one — that's the comparison. But a third group also keeps the usual recipe, and we never compare them to anything. They're the holdout: a clean snapshot of the world untouched by the experiment.";
      if (state.phase === "split")
        return "Three groups: treatment (orange), control (blue, measured), and holdout (grey, set aside). The holdout doesn't make your test more sensitive — fewer control kids means more noise. Its job is different: it's a reference you keep pristine, so that weeks later you can ask 'did running tests at all shift our baseline?'";
      return "That's the holdout's purpose. It costs you sample and power now, in exchange for a clean baseline later. You wouldn't always keep one — only when you suspect the act of experimenting itself might move your numbers.";
    },
    enter(state){
      state.phase = "pooled";
      state.animStart = null;
      render1(state);
    },
    draw(c, now, state){
      const cols = 8, cellW = 90, cellH = 48, x0 = 80, y0 = 60;
      let t = 0;
      if (state.phase !== "pooled"){
        if (state.animStart == null) state.animStart = now;
        t = easeInOutCubic(clamp((now - state.animStart) / 1100, 0, 1));
      }
      IDS.forEach((k, i) => {
        const p = gridPos(i, cols, x0, y0, cellW, cellH);
        const r = 13;
        const g = state.phase === "pooled" ? null : HOLDOUT[k];
        const color = g ? groupColor(g) : COLOR.muted;
        circle(p.x, p.y, r, g ? color : COLOR.muted, g ? 0.9 * t : 0.9 * (1 - t));
        if (g) circle(p.x, p.y, r, color, 0.9 * t);
      });
      if (t > 0.4){
        const a = (t - 0.4) / 0.6;
        label("Treatment", x0 + cellW * 1.5, y0 - 8, { size: 14, weight: "600", color: COLOR.treatment, alpha: a });
        label("Control", x0 + cellW * 5.5, y0 - 8, { size: 14, weight: "600", color: COLOR.control, alpha: a });
        label("Holdout (set aside)", x0 + cellW * 1.5, y0 + cellH * 5 + 30, { size: 13, weight: "600", color: COLOR.muted, alpha: a });
      }
    }
  };
  function render1(state){
    controlsEl.innerHTML = "";
    if (state.phase === "pooled"){
      makeBtn("▶ Split into three groups", "primary", () => {
        state.phase = "split";
        state.animStart = null;
        render1(state);
        updateText();
      });
      makeNote("Treatment vs. control is the test. The holdout sits outside it.");
    } else if (state.phase === "split"){
      makeBtn("▶ Why keep a holdout at all?", "primary", () => {
        state.phase = "explained";
        render1(state);
        updateText();
      });
      makeNote("The holdout is not measured against treatment. It's a pristine reference.");
    } else {
      makeBtn("▶ See the cost", "primary", () => {
        // advance handled by continue; this is the last scene-state
      });
      makeNote("Up next: what a holdout costs you in the short run.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 2 — The Cost: Smaller Control, Noisier Estimate                  */
  /* -------------------------------------------------------------------- */

  function chanceGaps(nControl, nTreat, rng, count){
    const out = [];
    const pool = CUPS_NATURAL.slice();
    for (let i = 0; i < count; i++){
      const order = shuffle(IDS, rng);
      const b = order.slice(0, nTreat), a = order.slice(nTreat, nTreat + nControl);
      out.push(mean(b.map(x => CUPS_NATURAL[x])) - mean(a.map(x => CUPS_NATURAL[x])));
    }
    return out;
  }

  const CHANCE_N = 200;
  const GAPS_FULL = chanceGaps(20, 20, mulberry32(70707), CHANCE_N);
  const GAPS_HOLDOUT = chanceGaps(10, 20, mulberry32(80808), CHANCE_N);

  const HIST_LO = -9, HIST_HI = 9;
  function histGeom(plot, bins){
    const binW = plot.w / bins;
    return {
      bins, binW, dotR: 3.6, spacing: 8,
      baseline: plot.y + plot.h,
      binOf(g){ return clamp(Math.floor((g - HIST_LO) / (HIST_HI - HIST_LO) * bins), 0, bins - 1); },
      xOfBin(b){ return plot.x + binW * (b + 0.5); }
    };
  }
  function stackGaps(gaps, geo){
    const counts = new Array(geo.bins).fill(0);
    return gaps.map(g => {
      const b = geo.binOf(g);
      const s = counts[b]++;
      return { gap: g, bin: b, stack: s };
    });
  }
  function dotY(plot, geo, stack){
    const maxStack = Math.max(1, Math.floor((plot.h - 10) / geo.spacing));
    return geo.baseline - geo.dotR - 2 - Math.min(stack, maxStack - 1) * geo.spacing;
  }
  function drawAxis(plot, geo){
    ctx.save();
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.x, geo.baseline);
    ctx.lineTo(plot.x + plot.w, geo.baseline);
    ctx.stroke();
    [-8, -4, 0, 4, 8].forEach(v => {
      const x = plot.x + ((v - HIST_LO) / (HIST_HI - HIST_LO)) * plot.w;
      ctx.beginPath();
      ctx.moveTo(x, geo.baseline);
      ctx.lineTo(x, geo.baseline + 5);
      ctx.stroke();
      label(v === 0 ? "0" : (v > 0 ? "+" : "") + v, x, geo.baseline + 19, { size: 11, color: COLOR.muted });
    });
    ctx.restore();
  }

  const S2_LEFT = { x: 50, y: 110, w: 370, h: 230 };
  const S2_RIGHT = { x: 460, y: 110, w: 370, h: 230 };
  const GEO_L = histGeom(S2_LEFT, 16);
  const GEO_R = histGeom(S2_RIGHT, 16);
  const DOTS_L = stackGaps(GAPS_FULL, GEO_L);
  const DOTS_R = stackGaps(GAPS_HOLDOUT, GEO_R);
  const SD_FULL = stdev(GAPS_FULL);
  const SD_HOLD = stdev(GAPS_HOLDOUT);

  const scene2 = {
    title: "2. What a Holdout Costs You",
    legend: [
      { color: CHANCE, label: "Chance gaps", def: "gaps luck alone produces, with no real effect" },
      { color: COLOR.ink, label: "Your result", def: "the real recipe gap, dropped on each pile" }
    ],
    text(state){
      return "Same forty kids, two designs. Left: a 20/20 split — the whole chance pile has a spread of " + SD_FULL.toFixed(1) + " cups. Right: a 10/20 split with a holdout — only ten control kids, so the chance pile spreads to " + SD_HOLD.toFixed(1) + " cups. Peeling kids into a holdout made your estimate noisier. The real recipe gap (+" + REAL_GAP.toFixed(1) + ") is the same on both, but on the right it's harder to tell apart from luck. That's the trade: a pristine baseline later, a foggier test now.";
    },
    enter(state){
      state.dropped = false;
      state.animStart = null;
      render2(state);
    },
    draw(c, now, state){
      label("20 control / 20 treatment", S2_LEFT.x + S2_LEFT.w / 2, 80, { size: 14, weight: "600", color: COLOR.ink });
      label("10 control / 20 treatment / 10 holdout", S2_RIGHT.x + S2_RIGHT.w / 2, 80, { size: 14, weight: "600", color: COLOR.ink });

      drawAxis(S2_LEFT, GEO_L);
      drawAxis(S2_RIGHT, GEO_R);

      DOTS_L.forEach(d => { circle(GEO_L.xOfBin(d.bin), dotY(S2_LEFT, GEO_L, d.stack), GEO_L.dotR, CHANCE, 0.35); });
      DOTS_R.forEach(d => { circle(GEO_R.xOfBin(d.bin), dotY(S2_RIGHT, GEO_R, d.stack), GEO_R.dotR, CHANCE, 0.35); });

      label("spread " + SD_FULL.toFixed(1), S2_LEFT.x + S2_LEFT.w / 2, S2_LEFT.y + S2_LEFT.h + 40, { size: 12.5, color: COLOR.muted });
      label("spread " + SD_HOLD.toFixed(1), S2_RIGHT.x + S2_RIGHT.w / 2, S2_RIGHT.y + S2_RIGHT.h + 40, { size: 12.5, color: COLOR.warn });

      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
      const showGap = state.dropped ? lerp(0, REAL_GAP, t) : 0;

      [GEO_L, GEO_R].forEach((geo, i) => {
        const plot = i === 0 ? S2_LEFT : S2_RIGHT;
        const x = plot.x + ((clamp(showGap, HIST_LO, HIST_HI) - HIST_LO) / (HIST_HI - HIST_LO)) * plot.w;
        if (state.dropped){
          ctx.save();
          ctx.globalAlpha = t;
          ctx.strokeStyle = COLOR.good;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, plot.y - 18);
          ctx.lineTo(x, geo.baseline);
          ctx.stroke();
          ctx.fillStyle = COLOR.good;
          ctx.beginPath();
          ctx.moveTo(x - 6, plot.y - 24);
          ctx.lineTo(x + 6, plot.y - 24);
          ctx.lineTo(x, plot.y - 14);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      });

      if (state.dropped && t > 0.5){
        label("same real gap — harder to spot on the wider pile",
          LOGICAL_W / 2, 456, { size: 12.5, color: COLOR.good, alpha: t });
      }
    }
  };
  function render2(state){
    controlsEl.innerHTML = "";
    makeBtn(state.dropped ? "🔄 Reset" : "▼ Drop your result on both piles", "primary", () => {
      state.dropped = !state.dropped;
      state.animStart = null;
      render2(state);
      updateText();
    });
    makeNote("Fewer measured control kids → wider chance pile → same real gap is harder to see.");
  }

  /* -------------------------------------------------------------------- */
  /* Scene 3 — When the Holdout Pays Off                                    */
  /* -------------------------------------------------------------------- */

  const scene3 = {
    title: "3. When the Holdout Pays Off",
    legend: [
      { color: COLOR.control, label: "Control", def: "measured baseline during testing" },
      { color: COLOR.muted, label: "Holdout", def: "pristine baseline, never touched by any test" }
    ],
    text(state){
      if (!state.shifted)
        return "Here's what the holdout buys you. Suppose you've been running tests for months — new recipes, new signs, new layouts. Did all that experimenting itself change how customers behave? The control group was measured every week, so it absorbed every ripple. The holdout was never in any test.";
      return "Now you see it. The measured control drifted over time — it lived inside the experiment machinery, so it felt every change. The holdout stayed flat: a clean picture of customers who were never part of any test. The gap between them is how much your own testing program moved the baseline. You can only measure that if you kept a group pristine from the start.";
    },
    enter(state){
      state.shifted = false;
      state.animStart = null;
      render3(state);
    },
    draw(c, now, state){
      const baseY = 380, topY = 70;
      const toY = v => baseY - v * (baseY - topY);

      ctx.save();
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(70, baseY);
      ctx.lineTo(810, baseY);
      ctx.stroke();
      ctx.restore();

      const weeks = 8;
      const xs = [];
      for (let w = 0; w < weeks; w++) xs.push(90 + (720 / (weeks - 1)) * w);
      label("weeks of running tests →", 460, 412, { size: 12, color: COLOR.muted });

      // Holdout: flat baseline ~4.4
      const holdBaseline = 4.4;
      xs.forEach((x, w) => {
        const wob = (mulberry32(1000 + w)() - 0.5) * 0.15;
        circle(x, toY(holdBaseline + wob), 5, COLOR.muted, 0.7);
      });
      // draw holdout line
      ctx.save();
      ctx.strokeStyle = COLOR.muted;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      xs.forEach((x, w) => {
        const wob = (mulberry32(1000 + w)() - 0.5) * 0.15;
        const y = toY(holdBaseline + wob);
        if (w === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // Control: drifts upward over time
      let t = 0;
      if (state.shifted){
        if (state.animStart == null) state.animStart = now;
        t = easeInOutCubic(clamp((now - state.animStart) / 1200, 0, 1));
      }
      const ctrlVals = xs.map((x, w) => {
        const drift = (w / (weeks - 1)) * 1.6 * t;
        const wob = (mulberry32(2000 + w)() - 0.5) * 0.2;
        return holdBaseline + drift + wob;
      });
      ctx.save();
      ctx.strokeStyle = COLOR.control;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctrlVals.forEach((v, w) => {
        const y = toY(v);
        if (w === 0) ctx.moveTo(xs[w], y); else ctx.lineTo(xs[w], y);
      });
      ctx.stroke();
      ctrlVals.forEach((v, w) => circle(xs[w], toY(v), 5, COLOR.control, 0.9));
      ctx.restore();

      label("Holdout (pristine)", xs[0] + 8, toY(holdBaseline) - 14, { size: 12.5, color: COLOR.muted, align: "left" });
      if (t > 0.3){
        label("Control (measured each week)", xs[weeks - 1] - 8, toY(ctrlVals[weeks - 1]) - 14, { size: 12.5, color: COLOR.control, align: "right", alpha: t });
      }
      if (t > 0.6){
        const gap = ctrlVals[weeks - 1] - holdBaseline;
        label("baseline drift from testing: +" + gap.toFixed(1) + " cups",
          LOGICAL_W / 2, 456, { size: 13, weight: "600", color: COLOR.warn, alpha: (t - 0.6) / 0.4 });
      }
    }
  };
  function render3(state){
    controlsEl.innerHTML = "";
    if (!state.shifted){
      makeBtn("▶ Reveal months of testing", "primary", () => {
        state.shifted = true;
        state.animStart = null;
        render3(state);
        updateText();
      });
      makeNote("The holdout was never in any test. The control was measured every week.");
    } else {
      makeNote("Only a holdout kept pristine can show you this drift.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 4 — Recap                                                        */
  /* -------------------------------------------------------------------- */

  const scene4 = {
    title: "4. Recap",
    legend: [
      { color: COLOR.control, label: "Control", def: "measured against treatment" },
      { color: COLOR.treatment, label: "Treatment", def: "the change you're testing" },
      { color: COLOR.muted, label: "Holdout", def: "set aside — a clean baseline for later" }
    ],
    text(){
      return "A holdout is a group you never touch and never compare during a test. It costs you sample — fewer control kids means a wider chance pile and a foggier estimate. In exchange you keep a pristine baseline that can later reveal whether your whole testing program itself shifted behavior. Keep one when you suspect experimenting moves your numbers; skip it when every measured kid counts.";
    },
    enter(state){ state.animStart = null; render4(state); },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const p = easeOutCubic(clamp((now - state.animStart) / 1000, 0, 1));
      const cards = [
        { x: 60, head: "What it is", body: "A group set aside from every test, never compared to treatment." },
        { x: 310, head: "What it costs", body: "Fewer measured control units → wider chance pile → less power now." },
        { x: 560, head: "What it buys", body: "A pristine baseline that reveals drift your testing program caused." }
      ];
      cards.forEach((card, i) => {
        const a = easeOutCubic(clamp((p - i * 0.15) / 0.6, 0, 1));
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = COLOR.line;
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, card.x, 80, 250, 300, 12);
        ctx.fillStyle = "#f3f0e8";
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        label(card.head, card.x + 125, 118, { size: 14, weight: "600", color: COLOR.ink, alpha: a });
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = COLOR.muted;
        ctx.font = "12.5px " + FONT;
        ctx.textAlign = "center";
        const words = card.body.split(" ");
        let line = "", ly = 150;
        words.forEach(w => {
          const test = line ? line + " " + w : w;
          if (ctx.measureText(test).width > 220 && line){ ctx.fillText(line, card.x + 125, ly); ly += 17; line = w; }
          else line = test;
        });
        if (line) ctx.fillText(line, card.x + 125, ly);
        ctx.restore();
      });
    }
  };
  function roundRectPath(ctx, x, y, w, h, r){
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.rect(x, y, w, h); }
  }
  function render4(state){
    controlsEl.innerHTML = "";
    makeNote("Holdouts trade power now for a clean baseline later.");
  }

  registerChapter("10-holdout", { scenes: [scene1, scene2, scene3, scene4] });

})();