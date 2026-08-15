"use strict";

(function(){

  const groupColor = g => g === "A" ? COLOR.control : COLOR.treatment;
  const FONT = 'FuturaHandwritten, cursive';
  const CHANCE_COLOR = COLOR.accent;

  // Same legend everywhere in this chapter — one story, one recipe test,
  // same colors and definitions from Scene 1 through the recap.
  const LEGEND = [
    { color: COLOR.control, label: "Control", def: "kept the usual lemonade recipe" },
    { color: COLOR.treatment, label: "Treatment", def: "got the new recipe we're testing" }
  ];

  /* -------------------------------------------------------------------- */
  /* Local drawing helpers (kept inside this IIFE)                          */
  /* -------------------------------------------------------------------- */

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
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha != null ? alpha : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r, fill, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  // Centered text on a soft pill so it stays readable over bars/dots.
  function badge(text, x, y, opts){
    opts = opts || {};
    const size = opts.size || 13;
    ctx.save();
    ctx.font = (opts.weight ? opts.weight + " " : "600 ") + size + "px " + FONT;
    const w = ctx.measureText(text).width + 22;
    ctx.restore();
    roundRect(x - w / 2, y - size, w, size + 15, 9, opts.bg || "#fff", opts.alpha != null ? opts.alpha : 1);
    label(text, x, y, { size, weight: opts.weight || "600", color: opts.color || COLOR.ink, alpha: opts.alpha });
    return w;
  }

  function wrapText(text, x, y, maxW, lineH, opts){
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || COLOR.muted;
    ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || 12) + "px " + FONT;
    ctx.textAlign = opts.align || "center";
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const words = text.split(" ");
    let line = "", ly = y;
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line){
        ctx.fillText(line, x, ly);
        ly += lineH;
        line = w;
      } else line = test;
    });
    if (line) ctx.fillText(line, x, ly);
    ctx.restore();
    return ly;
  }

  const fmt = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);

  /* -------------------------------------------------------------------- */
  /* Local histogram-of-gaps helpers                                        */
  /* -------------------------------------------------------------------- */

  const GAP_LO = -7, GAP_HI = 7;

  function histGeom(plot, bins){
    const binW = plot.w / bins;
    return {
      bins,
      binW,
      dotR: plot.dotR || 4.5,
      spacing: plot.spacing || 9.5,
      baseline: plot.y + plot.h,
      binOf(gap){
        return clamp(Math.floor((gap - GAP_LO) / (GAP_HI - GAP_LO) * bins), 0, bins - 1);
      },
      xOfBin(b){ return plot.x + binW * (b + 0.5); },
      xOfGap(g){ return plot.x + ((clamp(g, GAP_LO, GAP_HI) - GAP_LO) / (GAP_HI - GAP_LO)) * plot.w; }
    };
  }

  // Assigns each gap a bin + stack height, so dots pile up like a histogram.
  function stackGaps(gaps, geo){
    const counts = new Array(geo.bins).fill(0);
    return gaps.map(g => {
      const b = geo.binOf(g);
      const s = counts[b]++;
      return { gap: g, bin: b, stack: s };
    });
  }

  function dotY(plot, geo, stack){
    const maxStack = Math.max(1, Math.floor((plot.h - 14) / geo.spacing));
    return geo.baseline - geo.dotR - 2 - Math.min(stack, maxStack - 1) * geo.spacing;
  }

  function drawGapAxis(plot, geo, xLabel, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.x, geo.baseline);
    ctx.lineTo(plot.x + plot.w, geo.baseline);
    ctx.stroke();

    const zx = geo.xOfGap(0);
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = COLOR.muted;
    ctx.globalAlpha = (alpha != null ? alpha : 1) * 0.6;
    ctx.beginPath();
    ctx.moveTo(zx, geo.baseline);
    ctx.lineTo(zx, plot.y);
    ctx.stroke();
    ctx.restore();

    [-6, -4, -2, 0, 2, 4, 6].forEach(v => {
      const x = geo.xOfGap(v);
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, geo.baseline);
      ctx.lineTo(x, geo.baseline + 5);
      ctx.stroke();
      ctx.restore();
      label(v === 0 ? "0" : fmt(v).replace(".0", ""), x, geo.baseline + 19, { size: 11.5, alpha });
    });
    if (xLabel) label(xLabel, plot.x + plot.w / 2, geo.baseline + 39, { size: 12.5, alpha });
  }

  function drawGapMarker(x, topY, baseline, color, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, topY + 10);
    ctx.lineTo(x, baseline);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 7, topY - 2);
    ctx.lineTo(x + 7, topY - 2);
    ctx.lineTo(x, topY + 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* -------------------------------------------------------------------- */
  /* Data — one lemonade stand, one recipe test, used in every scene       */
  /* -------------------------------------------------------------------- */

  const N = 40;
  const IDS = [];
  for (let i = 0; i < N; i++) IDS.push(i);

  // How thirsty each kid naturally is. Drives circle size in Scene 1, and
  // feeds into how many cups they'd naturally buy (below).
  const THIRST = (function(){
    const rng = mulberry32(7001);
    return IDS.map(() => clamp(randNormal(rng, 22, 6), 9, 37));
  })();
  const T_LO = Math.min(...THIRST), T_HI = Math.max(...THIRST);
  const radiusOf = v => lerp(5.5, 11.5, (v - T_LO) / (T_HI - T_LO));

  // A deliberately unfair split: the 20 thirstiest kids all land in treatment.
  const RIGGED = (function(){
    const byThirst = IDS.slice().sort((a, b) => THIRST[b] - THIRST[a]);
    const g = new Array(N);
    byThirst.forEach((k, rank) => { g[k] = rank < N / 2 ? "B" : "A"; });
    return g;
  })();

  // A fair coin-flip split — this is the one the rest of the chapter uses.
  const FAIR = (function(){
    const order = shuffle(IDS, mulberry32(4242));
    const g = new Array(N);
    order.forEach((k, pos) => { g[k] = pos < N / 2 ? "B" : "A"; });
    return g;
  })();

  const POOL_ORDER = shuffle(IDS, mulberry32(9091));
  const POOL_SLOT = new Array(N);
  POOL_ORDER.forEach((k, i) => { POOL_SLOT[k] = i; });

  function slotsFor(groups){
    const slot = new Array(N);
    const counts = { A: 0, B: 0 };
    POOL_ORDER.forEach(k => { slot[k] = counts[groups[k]]++; });
    return slot;
  }
  const RIGGED_SLOT = slotsFor(RIGGED);
  const FAIR_SLOT = slotsFor(FAIR);

  // Each kid's natural cup-buying habit this week — nobody's recipe has
  // changed yet. This ONE array is reused everywhere: Scene 2 adds the real
  // recipe effect on top of it for treatment kids; Scenes 3-4 reshuffle it
  // completely unchanged to show what pure luck alone produces. Same 40
  // kids, same number, every time — nothing gets swapped out mid-story.
  const CUPS_NATURAL = (function(){
    const rng = mulberry32(3131);
    return IDS.map(i => clamp(THIRST[i] * 0.55 + randNormal(rng, 11, 3.4), 4, 40));
  })();

  // The real experiment: treatment kids get +5.5 cups from the new recipe.
  const RECIPE_EFFECT = 5.5;
  const OUTCOME = IDS.map(i => clamp(CUPS_NATURAL[i] + (FAIR[i] === "B" ? RECIPE_EFFECT : 0), 4, 40));
  const BAR_ORDER = shuffle(IDS, mulberry32(5555));

  const REAL_GAP = mean(IDS.filter(i => FAIR[i] === "B").map(i => OUTCOME[i]))
                 - mean(IDS.filter(i => FAIR[i] === "A").map(i => OUTCOME[i]));

  function randomSplit(rng){
    const order = shuffle(IDS, rng);
    const b = order.slice(0, N / 2), a = order.slice(N / 2);
    const groups = new Array(N);
    a.forEach(i => { groups[i] = "A"; });
    b.forEach(i => { groups[i] = "B"; });
    return { groups, gap: mean(b.map(i => CUPS_NATURAL[i])) - mean(a.map(i => CUPS_NATURAL[i])) };
  }

  const CHANCE_N = 160;
  const CHANCE_GAPS = (function(){
    const rng = mulberry32(60606);
    const out = [];
    for (let i = 0; i < CHANCE_N; i++) out.push(randomSplit(rng).gap);
    return out;
  })();

  function rarerCount(observed){
    const a = Math.abs(observed);
    return CHANCE_GAPS.filter(g => Math.abs(g) >= a).length;
  }

  /* -------------------------------------------------------------------- */
  /* Scene 1 — What Is an Experiment?                                      */
  /* -------------------------------------------------------------------- */

  const PANELS = [
    { x: 16, w: 416, title: "Hand-picked split", groups: RIGGED, slot: RIGGED_SLOT,
      caption: "We hand-picked it: the 20 thirstiest kids all went to treatment." },
    { x: 448, w: 416, title: "Coin-flip split", groups: FAIR, slot: FAIR_SLOT,
      caption: "Every kid flipped a coin. Heads = treatment, tails = control." }
  ];

  const POOL_TOP = 92;

  function poolPos(panel, slot){
    const cols = 8, cell = 34, rowH = 29;
    const x0 = panel.x + panel.w / 2 - (cols * cell) / 2 + cell / 2;
    return { x: x0 + (slot % cols) * cell, y: POOL_TOP + Math.floor(slot / cols) * rowH };
  }
  function groupPos(panel, group, slot){
    const cols = 4, cell = 30, rowH = 29;
    const cx = panel.x + panel.w * (group === "A" ? 0.26 : 0.74);
    const x0 = cx - (cols * cell) / 2 + cell / 2;
    return { x: x0 + (slot % cols) * cell, y: POOL_TOP + Math.floor(slot / cols) * rowH };
  }

  const AVG_BOTTOM = 396, AVG_H = 90, AVG_MAX = 34;

  const scene1 = {
    title: "1. What Is an Experiment?",
    legend: LEGEND,
    text(state){
      if (state.phase !== "split")
        return "You run a lemonade stand on your block. Every Saturday the same forty kids from the neighborhood stop by. This week you want to try a new recipe and see if kids actually buy more cups. That's an experiment: change one thing for half the kids (treatment), leave the other half getting what they always get (control), then compare. But first — how do you decide who lands in which half? Watch two different ways of deciding, side by side.";
      return "Left: we hand-picked it, stacking every thirsty kid into treatment. Treatment's average is already higher before the recipe has done anything — so whatever we compare afterward would be meaningless. Right: a coin flip decided each kid, and the two averages came out close all on their own. That's the whole point of splitting randomly — it doesn't let either side start out ahead.";
    },
    enter(state){
      state.phase = "pool";
      state.animStart = null;
      renderControls1(state);
    },
    draw(c, now, state){
      let move = 0, bars = 0;
      if (state.phase === "split"){
        if (state.animStart == null) state.animStart = now;
        const e = now - state.animStart;
        move = easeInOutCubic(clamp(e / 950, 0, 1));
        bars = easeOutCubic(clamp((e - 620) / 700, 0, 1));
      }

      ctx.save();
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(LOGICAL_W / 2, 20);
      ctx.lineTo(LOGICAL_W / 2, 440);
      ctx.stroke();
      ctx.restore();

      PANELS.forEach(panel => {
        const cx = panel.x + panel.w / 2;
        label(panel.title, cx, 32, { size: 15, weight: "600", color: COLOR.ink });
        label(state.phase === "split" ? panel.caption : "40 kids, not yet split", cx, 52, { size: 11.5 });

        IDS.forEach(k => {
          const g = panel.groups[k];
          const from = poolPos(panel, POOL_SLOT[k]);
          const to = groupPos(panel, g, panel.slot[k]);
          const x = lerp(from.x, to.x, move);
          const y = lerp(from.y, to.y, move);
          const r = radiusOf(THIRST[k]);
          circle(x, y, r, "#c9c2b4", 0.95 * (1 - move));
          circle(x, y, r, groupColor(g), 0.9 * move);
        });

        if (bars > 0){
          ["A", "B"].forEach(g => {
            const members = IDS.filter(k => panel.groups[k] === g);
            const avg = mean(members.map(k => THIRST[k]));
            const h = (avg / AVG_MAX) * AVG_H * bars;
            const bx = panel.x + panel.w * (g === "A" ? 0.26 : 0.74);
            const bw = 58;
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = groupColor(g);
            ctx.fillRect(bx - bw / 2, AVG_BOTTOM - h, bw, h);
            ctx.restore();
            label(avg.toFixed(1), bx, AVG_BOTTOM - h - 8, { size: 12.5, weight: "600", color: groupColor(g) });
            label(g === "A" ? "control" : "treatment", bx, AVG_BOTTOM + 17, { size: 11.5, color: groupColor(g) });
          });
          label("avg. thirst level", cx, AVG_BOTTOM + 36, { size: 12, color: COLOR.muted });
        }
      });

      if (state.phase === "split")
        label("Compare the two bars inside each panel — that's the real difference a bad split can create.", LOGICAL_W / 2, 464, { size: 12 });
      else
        label("Fair means: no head start on either side.", LOGICAL_W / 2, 464, { size: 12.5, color: COLOR.ink });
    }
  };
  function renderControls1(state){
    controlsEl.innerHTML = "";
    if (state.phase !== "split"){
      makeBtn("▶ Run both splits", "primary", () => {
        state.phase = "split";
        state.animStart = null;
        renderControls1(state);
        updateText();
      });
      makeNote("One half is hand-picked. The other is decided by coin flips.");
    } else {
      makeBtn("🔄 Run again", null, () => {
        state.phase = "pool";
        state.animStart = null;
        renderControls1(state);
        updateText();
      });
      makeNote("Compare the two bars inside a panel, not across panels.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 2 — Run the Experiment                                          */
  /* -------------------------------------------------------------------- */

  const S2_PLOT = { x: 62, y: 66, w: 700, h: 300 };

  const scene2 = {
    title: "2. Run the Experiment",
    legend: LEGEND,
    text(state){
      if (state.phase !== "avgs")
        return "Using the fair coin-flip split from Scene 1, treatment kids got the new recipe this week; control kids got the usual one. Every bar below is one kid's cups bought. Can you tell which side bought more just by looking?";
      return "Averages revealed: control bought " + mean(IDS.filter(i => FAIR[i] === "A").map(i => OUTCOME[i])).toFixed(1) + " cups, treatment bought " + mean(IDS.filter(i => FAIR[i] === "B").map(i => OUTCOME[i])).toFixed(1) + " — a gap of " + fmt(REAL_GAP).replace("+", "") + " cups. That's an experiment, start to finish: split randomly, change one thing for one side, compare the outcome afterward. But any random split wobbles a little even when nothing real is happening — so before trusting this gap, we need to ask: how big a gap would pure luck alone produce?";
    },
    enter(state){
      state.phase = "bars";
      state.animStart = null;
      renderControls2(state);
    },
    draw(c, now, state){
      let t = 0;
      if (state.phase === "avgs"){
        if (state.animStart == null) state.animStart = now;
        t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
      }

      label("cups of lemonade bought per kid this week", LOGICAL_W / 2, 34, { size: 14, weight: "600", color: COLOR.ink });
      label("control = usual recipe  •  treatment = new recipe", LOGICAL_W / 2, 52, { size: 11.5 });

      const geo = drawMorphBars(IDS, 0, {
        plot: S2_PLOT,
        order: BAR_ORDER,
        valueOfRaw: k => OUTCOME[k],
        colorOfFn: k => groupColor(FAIR[k])
      });

      const avgs = {};
      ["A", "B"].forEach(g => { avgs[g] = mean(IDS.filter(k => FAIR[k] === g).map(k => OUTCOME[k])); });

      if (t > 0){
        const ys = {};
        ["A", "B"].forEach(g => {
          const yEnd = geo.zeroY - avgs[g] * geo.scale;
          const y = lerp(geo.zeroY, yEnd, t);
          ys[g] = y;
          ctx.save();
          ctx.setLineDash([7, 5]);
          ctx.strokeStyle = groupColor(g);
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(S2_PLOT.x - 10, y);
          ctx.lineTo(S2_PLOT.x + S2_PLOT.w + 8, y);
          ctx.stroke();
          ctx.restore();
          label((g === "A" ? "control avg " : "treatment avg ") + avgs[g].toFixed(1),
            S2_PLOT.x + S2_PLOT.w + 15, y + 4,
            { size: 11.5, align: "left", weight: "600", color: groupColor(g), alpha: t });
        });

        const gap = avgs.B - avgs.A;
        const ax = S2_PLOT.x + 34;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.strokeStyle = COLOR.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax, ys.A);
        ctx.lineTo(ax, ys.B);
        ctx.moveTo(ax - 5, ys.A);
        ctx.lineTo(ax + 5, ys.A);
        ctx.moveTo(ax - 5, ys.B);
        ctx.lineTo(ax + 5, ys.B);
        ctx.stroke();
        ctx.restore();
        badge("gap " + fmt(gap) + " cups", ax + 74, (ys.A + ys.B) / 2 + 5, { size: 12.5, alpha: t });
      }

      label("one bar = one kid (control and treatment shuffled together)", LOGICAL_W / 2, S2_PLOT.y + S2_PLOT.h + 30, { size: 12 });
    }
  };
  function renderControls2(state){
    controlsEl.innerHTML = "";
    if (state.phase !== "avgs"){
      makeBtn("Show group averages", "primary", () => {
        state.phase = "avgs";
        state.animStart = null;
        renderControls2(state);
        updateText();
      });
      makeNote("Can you tell which side bought more just by looking?");
    } else {
      makeBtn("🔄 Hide averages", null, () => {
        state.phase = "bars";
        state.animStart = null;
        renderControls2(state);
        updateText();
      });
      makeNote("Control vs. treatment, compared on one outcome. That's the whole recipe.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 3 — Gaps From Pure Luck                                         */
  /* -------------------------------------------------------------------- */

  const S3_PLOT = { x: 70, y: 152, w: 740, h: 228 };
  const S3_GEO = histGeom(S3_PLOT, 18);

  const scene3 = {
    title: "3. Gaps From Pure Luck",
    legend(){
      return [
        { color: COLOR.control, label: "Group A", def: "one random half — no recipe change" },
        { color: COLOR.treatment, label: "Group B", def: "the other random half — no recipe change" }
      ];
    },
    text(state){
      const n = state.gaps.length;
      if (n === 0)
        return "Here's the test: take the same 40 kids' natural cup-buying habits from Scene 2 — but this time nobody's recipe changes for anyone. Split them at random anyway and measure the same kind of gap. Any gap you see now is pure luck of the draw. Hit reshuffle.";
      if (n === 1)
        return "Not zero — it can't be. Any two random halves of 20 kids differ somewhat just by chance, even though neither group's recipe changed. Reshuffle again and watch the next gap land somewhere else.";
      if (n < 10)
        return "Keep going. Every reshuffle is a world where nothing changed for anyone, yet each one still shows some gap between the two halves. This is exactly what luck alone can produce.";
      return "There it is: a pile. Small gaps happen constantly, big gaps happen rarely, and the pile sits thickest near zero. This is what “no real effect” looks like once you actually measure it — not a flat zero, but a spread of near-misses, in the same cups-bought units as Scene 2's gap. " + n + " reshuffles so far.";
    },
    enter(state){
      state.gaps = [];
      state.dots = [];
      state.groups = null;
      state.rng = mulberry32(21212);
      state.markerFrom = 0;
      state.markerTo = null;
      state.animStart = null;
      renderControls3(state);
    },
    draw(c, now, state){
      label("the same 40 kids, re-split at random — nobody's recipe changed",
        LOGICAL_W / 2, 28, { size: 13, color: COLOR.ink });

      const cols = 20, cell = 30;
      const x0 = LOGICAL_W / 2 - (cols * cell) / 2 + cell / 2;
      IDS.forEach(k => {
        const slot = POOL_SLOT[k];
        const x = x0 + (slot % cols) * cell;
        const y = 52 + Math.floor(slot / cols) * 26;
        const g = state.groups ? state.groups[k] : null;
        circle(x, y, 8.5, g ? groupColor(g) : "#c9c2b4", g ? 0.9 : 0.85);
      });

      if (state.animStart == null) state.animStart = now;
      const mt = easeOutCubic(clamp((now - state.animStart) / 550, 0, 1));

      drawGapAxis(S3_PLOT, S3_GEO, "gap between the two halves, in cups →");

      state.dots.forEach(d => {
        if (d.bornAt == null) d.bornAt = now + d.delay;
        const p = easeOutCubic(clamp((now - d.bornAt) / 520, 0, 1));
        if (p <= 0) return;
        const x = S3_GEO.xOfBin(d.bin);
        const yEnd = dotY(S3_PLOT, S3_GEO, d.stack);
        const y = lerp(S3_PLOT.y - 46, yEnd, p);
        circle(x, y, S3_GEO.dotR, CHANCE_COLOR, 0.18 + 0.32 * p);
      });

      if (state.markerTo != null){
        const g = lerp(state.markerFrom, state.markerTo, mt);
        const x = S3_GEO.xOfGap(g);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = COLOR.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, S3_PLOT.y - 4);
        ctx.lineTo(x, S3_GEO.baseline);
        ctx.stroke();
        ctx.restore();
        badge("this reshuffle's gap: " + fmt(state.markerTo) + " cups", clamp(x, 130, LOGICAL_W - 130), 122);
      } else {
        label("each reshuffle drops one dot: how far apart the two halves landed",
          LOGICAL_W / 2, 122, { size: 12.5 });
      }

      label(state.gaps.length + " reshuffle" + (state.gaps.length === 1 ? "" : "s") + " so far",
        LOGICAL_W - 20, S3_GEO.baseline + 39, { size: 12, align: "right" });
    }
  };

  function pushShuffles3(state, count){
    for (let i = 0; i < count; i++){
      const r = randomSplit(state.rng);
      const b = S3_GEO.binOf(r.gap);
      const stack = state.dots.filter(d => d.bin === b).length;
      state.dots.push({ gap: r.gap, bin: b, stack, delay: i * 55, bornAt: null });
      state.gaps.push(r.gap);
      state.groups = r.groups;
      state.markerFrom = state.markerTo != null ? state.markerTo : 0;
      state.markerTo = r.gap;
    }
    state.animStart = null;
  }

  function renderControls3(state){
    controlsEl.innerHTML = "";
    makeBtn("🎲 Reshuffle", "primary", () => {
      pushShuffles3(state, 1);
      renderControls3(state);
      updateText();
    });
    makeBtn("🎲 Reshuffle × 25", null, () => {
      pushShuffles3(state, 25);
      renderControls3(state);
      updateText();
    });
    if (state.gaps.length){
      makeBtn("↺ Clear", null, () => {
        state.gaps = [];
        state.dots = [];
        state.groups = null;
        state.rng = mulberry32(21212);
        state.markerFrom = 0;
        state.markerTo = null;
        state.animStart = null;
        renderControls3(state);
        updateText();
      });
    }
    makeNote(state.gaps.length < 10
      ? "Nothing changed for anyone. Every gap you see is pure luck of the draw."
      : "Notice where the pile is thick, and where it thins out.");
  }

  /* -------------------------------------------------------------------- */
  /* Scene 4 — Was Your Gap Rare, or Ordinary?                             */
  /* -------------------------------------------------------------------- */

  const S4_PLOT = { x: 70, y: 132, w: 740, h: 228 };
  const S4_GEO = histGeom(S4_PLOT, 18);
  const S4_DOTS = stackGaps(CHANCE_GAPS, S4_GEO);

  const scene4 = {
    title: "4. Was Your Gap Rare, or Ordinary?",
    legend(){
      return [
        { color: CHANCE_COLOR, label: "Purple dots", def: "160 gaps that pure luck alone produced" },
        { color: COLOR.ink, label: "Marker", def: "Scene 2's real experiment result" }
      ];
    },
    text(state){
      if (!state.dropped)
        return "Here's the same kind of pile from Scene 3, filled in for real: " + CHANCE_N + " random splits of kids where nothing changed. It's your yardstick for luck. Scene 2's real recipe experiment came back with a gap of " + fmt(REAL_GAP).replace("+", "") + " cups — drop that result onto the pile and see where it lands.";
      const c = rarerCount(REAL_GAP);
      return "Out of " + CHANCE_N + " luck-only splits, only " + c + " reached at least as far from zero as your " + fmt(REAL_GAP).replace("+", "") + "-cup gap. That's rare — luck alone almost never stretches this far, so “the new recipe worked” is a much better explanation than “the coin flips happened to favor treatment.” That's all “statistically significant” means: the gap you got would be rare if nothing real were going on.";
    },
    enter(state){
      state.dropped = false;
      state.animStart = null;
      renderControls4(state);
    },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 800, 0, 1));

      label(CHANCE_N + " luck-only splits of kids where nothing changed",
        LOGICAL_W / 2, 28, { size: 14, weight: "600", color: COLOR.ink });
      label("purple dots = gaps luck alone produced, in the same cups-bought units as Scene 2", LOGICAL_W / 2, 47, { size: 11.5 });

      drawGapAxis(S4_PLOT, S4_GEO, "gap between the two halves, in cups →");

      const thresh = state.dropped ? Math.abs(lerp(0, REAL_GAP, t)) : Infinity;

      S4_DOTS.forEach(d => {
        const x = S4_GEO.xOfBin(d.bin);
        const y = dotY(S4_PLOT, S4_GEO, d.stack);
        const beyond = Math.abs(d.gap) >= thresh;
        circle(x, y, S4_GEO.dotR, beyond ? COLOR.warn : CHANCE_COLOR, beyond ? 0.65 : 0.4);
      });

      if (state.dropped){
        const shownGap = lerp(0, REAL_GAP, t);
        const x = S4_GEO.xOfGap(shownGap);
        const topY = lerp(S4_PLOT.y - 60, S4_PLOT.y - 12, t);
        drawGapMarker(x, topY, S4_GEO.baseline, COLOR.good, t);
        badge("your result: " + fmt(shownGap) + " cups", clamp(x, 140, LOGICAL_W - 140), topY - 12,
          { size: 13, color: COLOR.good, alpha: t });

        const cnt = rarerCount(shownGap);
        label(t >= 0.98 ? "Significant." : "", LOGICAL_W / 2, S4_GEO.baseline + 63,
          { size: 15, weight: "600", color: COLOR.good, alpha: t });
        wrapText(Math.round(cnt) + " of " + CHANCE_N + " luck-only splits landed at least this far from zero (shown in red).",
          LOGICAL_W / 2, S4_GEO.baseline + 84, 660, 16, { size: 12.5, alpha: t });
      } else {
        label("Drop your result onto the pile.",
          LOGICAL_W / 2, S4_GEO.baseline + 68, { size: 13, color: COLOR.ink, alpha: t });
      }
    }
  };
  function renderControls4(state){
    controlsEl.innerHTML = "";
    makeBtn(state.dropped ? "🔄 Reset" : "▼ Drop your result onto the pile", "primary", () => {
      state.dropped = !state.dropped;
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
    makeNote(state.dropped
      ? "See how far out from the middle a " + fmt(REAL_GAP).replace("+", "") + "-cup gap lands."
      : "Same pile of luck, one real result to test against it.");
  }

  /* -------------------------------------------------------------------- */
  /* Scene 5 — Recap + Bridge                                             */
  /* -------------------------------------------------------------------- */

  const SMALL_EFFECT = 1.5;

  const CARDS = [
    { title: "1. Split random",
      body: "Let coin flips decide who lands in control and who lands in treatment. No head start on either side." },
    { title: "2. Change one thing, compare",
      body: "One half gets the new recipe, one half doesn't. Wait, then compare the two averages on cups bought." },
    { title: "3. Ask if the gap is rare",
      body: "Check the gap against the pile of luck-only gaps. Rare compared to luck → call it real." }
  ];

  const S5_MINI = { x: 0, y: 0, w: 216, h: 120 };
  const S5_GEO = histGeom(S5_MINI, 14);
  const S5_DOTS = stackGaps(CHANCE_GAPS.slice(0, 90), S5_GEO);

  const scene5 = {
    title: "5. Recap",
    legend: LEGEND,
    text(state){
      if (!state.caught)
        return "That's the whole idea, in three steps: split randomly so groups don't start out lopsided, change one thing for one group and compare the outcome, then judge the gap against how big a gap luck alone would give you. Before moving on, there's one catch worth seeing.";
      return "Here's the catch. A coin-flip split is fair, but it's still random — kids inside each half vary wildly from each other. That noisiness is exactly the pile you just built. A real improvement can land inside that pile and look like nothing at all — if the new recipe's true boost had only been " + SMALL_EFFECT.toFixed(1) + " cups instead of " + RECIPE_EFFECT.toFixed(1) + ", you'd likely walk away thinking it didn't work, even though it did. Chapter 1 shows a trick that shrinks the pile without touching the experiment itself.";
    },
    enter(state){
      state.caught = false;
      state.animStart = null;
      state.enterAt = null;
      renderControls5(state);
    },
    draw(c, now, state){
      if (state.enterAt == null) state.enterAt = now;
      const cardW = 276, gap = 12;
      const totalW = cardW * 3 + gap * 2;
      const x0 = (LOGICAL_W - totalW) / 2;

      CARDS.forEach((card, i) => {
        const a = easeOutCubic(clamp((now - state.enterAt - i * 150) / 600, 0, 1));
        if (a <= 0) return;
        const cx = x0 + i * (cardW + gap);
        const cy = lerp(46, 34, a);
        roundRect(cx, cy, cardW, 384, 14, "#f3f0e8", a);
        label(card.title, cx + cardW / 2, cy + 28, { size: 13.5, weight: "600", color: COLOR.ink, alpha: a });
        wrapText(card.body, cx + cardW / 2, cy + 50, cardW - 34, 16, { size: 11.5, alpha: a });

        if (i === 0) drawCardSplit(cx, cy, cardW, a);
        if (i === 1) drawCardBars(cx, cy, cardW, a);
        if (i === 2) drawCardPile(cx, cy, cardW, a, now, state);
      });
    }
  };

  function drawCardSplit(cx, cy, cardW, a){
    ["A", "B"].forEach(g => {
      const members = IDS.filter(k => FAIR[k] === g);
      const bx = cx + cardW * (g === "A" ? 0.28 : 0.72);
      members.forEach((k, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        circle(bx - 33 + col * 22, cy + 150 + row * 22, 7.5, groupColor(g), 0.85 * a);
      });
      label(g === "A" ? "control" : "treatment", bx, cy + 285, { size: 11, color: groupColor(g), alpha: a });
    });
  }

  function drawCardBars(cx, cy, cardW, a){
    const bottom = cy + 272;
    const ys = {};
    ["A", "B"].forEach(g => {
      const avg = mean(IDS.filter(k => FAIR[k] === g).map(k => OUTCOME[k]));
      const h = (avg / 30) * 130 * a;
      const bx = cx + cardW * (g === "A" ? 0.28 : 0.72);
      ctx.save();
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = groupColor(g);
      ctx.fillRect(bx - 30, bottom - h, 60, h);
      ctx.restore();
      ys[g] = bottom - h;
      label(avg.toFixed(1), bx, bottom - h - 8, { size: 11.5, weight: "600", color: groupColor(g), alpha: a });
      label(g === "A" ? "control" : "treatment", bx, cy + 285, { size: 11, color: groupColor(g), alpha: a });
    });
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + 26, ys.B);
    ctx.lineTo(cx + cardW - 26, ys.B);
    ctx.stroke();
    ctx.restore();
  }

  function drawCardPile(cx, cy, cardW, a, now, state){
    const plot = { x: cx + (cardW - S5_MINI.w) / 2, y: cy + 150, w: S5_MINI.w, h: S5_MINI.h };
    const binW = plot.w / S5_GEO.bins;
    const xOfBin = b => plot.x + binW * (b + 0.5);
    const xOfGap = g => plot.x + ((clamp(g, GAP_LO, GAP_HI) - GAP_LO) / (GAP_HI - GAP_LO)) * plot.w;
    const baseline = plot.y + plot.h;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.x, baseline);
    ctx.lineTo(plot.x + plot.w, baseline);
    ctx.stroke();
    ctx.restore();

    S5_DOTS.forEach(d => {
      const y = baseline - 4 - Math.min(d.stack, 15) * 7.5;
      circle(xOfBin(d.bin), y, 3.4, CHANCE_COLOR, 0.4 * a);
    });
    label("gaps luck alone gives you", plot.x + plot.w / 2, baseline + 18, { size: 10.5, alpha: a });

    let t = 0;
    if (state.caught){
      if (state.animStart == null) state.animStart = now;
      t = easeInOutCubic(clamp((now - state.animStart) / 1100, 0, 1));
    }
    const g = lerp(RECIPE_EFFECT, SMALL_EFFECT, t);
    const mx = xOfGap(g);
    const color = t > 0.55 ? COLOR.warn : COLOR.good;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx, plot.y - 6);
    ctx.lineTo(mx, baseline);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mx - 6, plot.y - 14);
    ctx.lineTo(mx + 6, plot.y - 14);
    ctx.lineTo(mx, plot.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    wrapText(t > 0.55 ? "real effect, buried in the pile" : "real effect, standing out",
      plot.x + plot.w / 2, baseline + 40, cardW - 40, 14, { size: 11, color, alpha: a, weight: "600" });
  }

  function renderControls5(state){
    controlsEl.innerHTML = "";
    if (!state.caught){
      makeBtn("▶ Show the catch", "primary", () => {
        state.caught = true;
        state.animStart = null;
        renderControls5(state);
        updateText();
      });
      makeNote("Random splits are fair. Fair is not the same as precise.");
    } else {
      makeNote("Up next — Chapter 1: a trick that strips noise out of an experiment so real effects stop hiding in the pile.");
    }
  }

  registerChapter("00-what-is-an-experiment", {
    scenes: [scene1, scene2, scene3, scene4, scene5]
  });

})();
