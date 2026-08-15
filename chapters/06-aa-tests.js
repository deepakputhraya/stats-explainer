"use strict";

(function(){

  const FONT = 'FuturaHandwritten, cursive';

  function circle(x, y, r, color, alpha){
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha != null ? alpha : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function label(text, x, y, color, size, align, alpha){
    ctx.fillStyle = color;
    ctx.font = (size || 13) + "px " + FONT;
    ctx.textAlign = align || "center";
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }
  // Tracks a scalar that eases from wherever it currently sits toward a target,
  // so a click mid-animation continues smoothly instead of snapping.
  function tweenTo(state, key, now, ms){
    const s = state[key];
    if (s.animStart == null) s.animStart = now;
    const p = clamp((now - s.animStart) / (ms || 800), 0, 1);
    s.cur = lerp(s.from, s.to, easeInOutCubic(p));
    return s.cur;
  }
  function retarget(state, key, to){
    const s = state[key];
    s.from = s.cur;
    s.to = to;
    s.animStart = null;
  }
  function makeTween(v){ return { cur: v, from: v, to: v, animStart: null }; }

  /* -------------------------------------------------------------------- */
  /* Scene 1 — Setup                                                       */
  /* -------------------------------------------------------------------- */

  const N1 = 60;
  const POOL = { cols: 10, rows: 6, marginX: 60, marginY: 40, radiusScale: 0.30 };

  const UNITS1 = (function(){
    const arr = [];
    for (let i = 0; i < N1; i++) arr.push({ id: i });
    // Coin flip per person: alternate then shuffle so groups interleave on screen.
    const order = shuffle(arr, mulberry32(4242));
    order.forEach((u, i) => { u.group = i % 2 === 0 ? "A" : "B"; });
    let ai = 0, bi = 0;
    order.forEach(u => { u.slot = u.group === "A" ? ai++ : bi++; });
    return { all: arr, order: order };
  })();

  function poolPos(i){
    const cellW = (LOGICAL_W - POOL.marginX * 2) / POOL.cols;
    const cellH = (LOGICAL_H - POOL.marginY * 2) / POOL.rows;
    return {
      x: POOL.marginX + cellW * (i % POOL.cols) + cellW / 2,
      y: POOL.marginY + cellH * Math.floor(i / POOL.cols) + cellH / 2,
      r: Math.min(cellW, cellH) * POOL.radiusScale
    };
  }
  function bucketPos(group, slot){
    const bx = group === "A" ? 60 : 480;
    const cols = 5, cellW = 340 / cols, cellH = 280 / 6;
    return {
      x: bx + cellW * (slot % cols) + cellW / 2,
      y: 60 + cellH * Math.floor(slot / cols) + cellH / 2,
      r: Math.min(cellW, cellH) * 0.30
    };
  }

  const scene1 = {
    title: "1. Two Groups, One Recipe",
    legend(state){
      if (state.phase === "pooled"){
        return [{ color: COLOR.muted, label: "A person", def: "not yet assigned to either group" }];
      }
      return [
        { color: COLOR.control, label: "Group A", def: "sees the current page" },
        { color: COLOR.treatment, label: "Group B", def: "sees the current page — the very same one" }
      ];
    },
    text(state){
      if (state.phase === "pooled") return "Sixty people are about to walk onto your website. Normally you'd show half of them something new. This time, don't. Flip a coin for each person, split them into two groups — and then show both groups the exact same page. That's an A/A test.";
      if (state.phase === "split") return "The coin has spoken: blue on the left, orange on the right. It looks like every experiment you've ever seen. Now ask the obvious question — what is actually different between these two groups?";
      return "Nothing. Not one thing. Both groups see the identical page, and no one gets anything new. There is no treatment in an A/A test. The only thing being tested is your own machinery.";
    },
    enter(state){
      state.phase = "pooled";
      state.animStart = null;
      state.labelStart = null;
      render1(state);
    },
    draw(c, now, state){
      if (state.phase === "pooled"){
        drawUnitGrid(UNITS1.all, () => COLOR.muted, {
          order: UNITS1.order, cols: POOL.cols, rows: POOL.rows,
          marginX: POOL.marginX, marginY: POOL.marginY, radiusScale: POOL.radiusScale
        });
        label("sixty people, not yet sorted", LOGICAL_W / 2, 445, COLOR.muted, 13);
        return;
      }

      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 1100, 0, 1));

      UNITS1.order.forEach((u, i) => {
        const a = poolPos(i);
        const b = bucketPos(u.group, u.slot);
        const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t), r = lerp(a.r, b.r, t);
        circle(x, y, r, COLOR.muted, 0.9);
        circle(x, y, r, u.group === "A" ? COLOR.control : COLOR.treatment, 0.9 * t);
      });

      label("Group A", 230, 380, COLOR.control, 15, "center", t);
      label("Group B", 650, 380, COLOR.treatment, 15, "center", t);

      let lt = 0;
      if (state.phase === "labeled"){
        if (state.labelStart == null) state.labelStart = now;
        lt = easeOutCubic(clamp((now - state.labelStart) / 800, 0, 1));
      }
      label("sees the current page", 230, 404, COLOR.muted, 13, "center", t);
      label("sees the current page", 650, 404, COLOR.muted, 13, "center", t);

      if (lt > 0){
        label("difference between the two groups: none", LOGICAL_W / 2, 445, COLOR.good, 14.5, "center", lt);
        ctx.save();
        ctx.globalAlpha = lt;
        ctx.strokeStyle = COLOR.good;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(440, 60);
        ctx.lineTo(440, 350);
        ctx.stroke();
        ctx.restore();
      }
    }
  };
  function render1(state){
    controlsEl.innerHTML = "";
    if (state.phase === "pooled"){
      makeBtn("🪙 Flip a coin for each person", "primary", () => {
        state.phase = "split";
        state.animStart = null;
        render1(state);
        updateText();
      });
    } else if (state.phase === "split"){
      makeBtn("What's different between the groups?", "primary", () => {
        state.phase = "labeled";
        state.labelStart = null;
        render1(state);
        updateText();
      });
    } else {
      makeNote("Same page on both sides. An A/A test compares a thing against itself.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 2 — Why Run One?                                                */
  /* -------------------------------------------------------------------- */

  const AVG_A = 4.05;
  const AVG_B_HEALTHY = 4.13;
  const AVG_B_BROKEN = 5.72;
  const WOBBLE = 0.34;

  const scene2 = {
    title: "2. Why Would Anyone Run That?",
    legend(state){
      const items = [
        { color: COLOR.control, label: "Group A", def: "average time on the current page" },
        { color: COLOR.treatment, label: "Group B", def: "average time on that same page" }
      ];
      if (state.mode === "broken"){
        items[1] = { color: COLOR.warn, label: "Group B", def: "same page, but the number came out wrong" };
      }
      items.push({
        color: state.mode === "broken" ? COLOR.warn : COLOR.good,
        label: "Noise band",
        def: "how far apart the two can drift by chance alone"
      });
      return items;
    },
    text(state){
      if (!state.touched) return "Because an A/A test checks the plumbing, not the product. Same page on both sides means the two averages should land on top of each other, give or take ordinary day-to-day wobble. Flip between a healthy pipeline and a broken one below.";
      if (state.mode === "healthy") return "Healthy: both groups spent about the same time on the page. The tiny gap that's left is just noise, the kind you'd get from re-running any two coin flips. Your splitting and measuring code is behaving.";
      return "Broken: one group looks dramatically better. But both groups saw the identical page, so this cannot be a real win — nothing was different to win with. The gap is coming from your own machinery: people bucketed twice, events logged to the wrong group, one side's data half-missing. Find that before you trust any real experiment.";
    },
    enter(state){
      state.mode = "healthy";
      state.touched = false;
      state.broken = makeTween(0);
      render2(state);
    },
    draw(c, now, state){
      const b = tweenTo(state, "broken", now, 900);
      const avgB = lerp(AVG_B_HEALTHY, AVG_B_BROKEN, b);

      const baseY = 372, topY = 70, maxV = 7;
      const toY = v => baseY - (v / maxV) * (baseY - topY);
      const bars = [
        { x: 240, v: AVG_A, color: COLOR.control, name: "Group A" },
        { x: 540, v: avgB, color: COLOR.treatment, name: "Group B" }
      ];
      const barW = 110;

      ctx.fillStyle = b > 0.02 ? COLOR.warn : COLOR.good;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(150, toY(AVG_A + WOBBLE), 510, toY(AVG_A - WOBBLE) - toY(AVG_A + WOBBLE));
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(150, baseY);
      ctx.lineTo(760, baseY);
      ctx.stroke();
      ctx.restore();

      label("range you'd expect from ordinary noise", 668, toY(AVG_A) + 4, COLOR.muted, 12, "left");

      bars.forEach(bar => {
        const h = baseY - toY(bar.v);
        ctx.fillStyle = bar.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(bar.x - barW / 2, toY(bar.v), barW, h);
        ctx.globalAlpha = 1;
        if (bar.name === "Group B" && b > 0){
          ctx.fillStyle = COLOR.warn;
          ctx.globalAlpha = 0.85 * b;
          ctx.fillRect(bar.x - barW / 2, toY(bar.v), barW, h);
          ctx.globalAlpha = 1;
        }
        label(bar.v.toFixed(1) + " min on page", bar.x, toY(bar.v) - 12, COLOR.ink, 13.5);
        label(bar.name, bar.x, baseY + 22, COLOR.muted, 13);
        label("current page", bar.x, baseY + 40, COLOR.muted, 11.5);
      });

      const hAlpha = Math.pow(1 - b, 2), wAlpha = Math.pow(b, 2);
      if (hAlpha > 0.01) label("✓ Pipeline looks healthy — same thing in, same numbers out.", LOGICAL_W / 2, 448, COLOR.good, 15, "center", hAlpha);
      if (wAlpha > 0.01) label("✕ Same thing on both sides, different numbers. The pipeline is lying to you.", LOGICAL_W / 2, 448, COLOR.warn, 15, "center", wAlpha);
    }
  };
  function render2(state){
    controlsEl.innerHTML = "";
    [["Healthy pipeline", "healthy", 0], ["Broken pipeline", "broken", 1]].forEach(opt => {
      makeBtn(opt[0], state.mode === opt[1] ? "primary selected" : null, () => {
        state.mode = opt[1];
        state.touched = true;
        retarget(state, "broken", opt[2]);
        render2(state);
        updateText();
      });
    });
  }

  /* -------------------------------------------------------------------- */
  /* Scene 3 — Sample-Ratio-Mismatch                                       */
  /* -------------------------------------------------------------------- */

  const N3 = 100;
  const UNITS3 = (function(){
    const slots = [];
    for (let i = 0; i < N3; i++) slots.push(i);
    const ranks = shuffle(slots, mulberry32(9191));
    // Each grid slot holds a fixed "coin value"; sweeping the split fraction
    // flips slots between groups in a spatially scattered way.
    return ranks.map((rank, slot) => ({ slot: slot, u: (rank + 0.5) / N3 }));
  })();

  const SPLITS = [
    { label: "50 / 50", frac: 0.50 },
    { label: "65 / 35", frac: 0.65 },
    { label: "80 / 20", frac: 0.80 }
  ];

  const scene3 = {
    title: "3. When the Two Groups Aren't the Same Size",
    legend(state){
      const skewed = state.frac && state.frac.to !== 0.50;
      return [
        { color: COLOR.control, label: "Group A", def: "people the pipeline put on one side" },
        { color: COLOR.treatment, label: "Group B", def: "people it put on the other side" },
        skewed
          ? { color: COLOR.warn, label: "Coin-flip line", def: "where the sizes should have landed — but didn't" }
          : { color: COLOR.good, label: "Coin-flip line", def: "where an even split lands, and these do" }
      ];
    },
    text(state){
      if (!state.touched) return "Here's the cheapest broken-pipeline alarm there is, and you can check it before looking at a single outcome number: count the people in each group. A fair coin flip over a hundred people lands close to fifty-fifty. Try the other splits.";
      if (state.frac.to === 0.50) return "Fifty-fifty, near enough. This is what a fair coin flip actually looks like, and it's the boring answer you want. Now go ahead and read the outcome numbers.";
      const missing = Math.round(state.frac.to * 100) - Math.round((1 - state.frac.to) * 100);
      return "This is a sample-ratio-mismatch: the group sizes came out lopsided when the coin flip should have split them evenly — a gap of about " + missing + " people. A coin does not do this by accident at this size. So someone's code is dropping people, double-counting them, or sending them to the wrong side. Stop here. Don't compare the outcome numbers at all, because whatever broke the sizes probably broke those too.";
    },
    enter(state){
      state.frac = makeTween(0.50);
      state.touched = false;
      render3(state);
    },
    draw(c, now, state){
      const frac = tweenTo(state, "frac", now, 900);
      const off = clamp(Math.abs(frac - 0.5) / 0.28, 0, 1);
      const countA = Math.round(frac * N3);
      const countB = N3 - countA;

      const cols = 20, gx = 60, gy = 44, gw = 760, gh = 150;
      const cellW = gw / cols, cellH = gh / 5;
      UNITS3.forEach(u => {
        const x = gx + cellW * (u.slot % cols) + cellW / 2;
        const y = gy + cellH * Math.floor(u.slot / cols) + cellH / 2;
        const isA = u.u < frac;
        circle(x, y, Math.min(cellW, cellH) * 0.32, isA ? COLOR.control : COLOR.treatment, 0.9);
      });
      label("one hundred people, colored by the group the pipeline put them in", LOGICAL_W / 2, 218, COLOR.muted, 12.5);

      const barX = 130, barMaxW = 620;
      [
        { y: 262, count: countA, color: COLOR.control, name: "Group A" },
        { y: 322, count: countB, color: COLOR.treatment, name: "Group B" }
      ].forEach(bar => {
        const w = (bar.count / N3) * barMaxW;
        ctx.fillStyle = bar.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(barX, bar.y, w, 34);
        ctx.globalAlpha = 1;
        if (off > 0){
          ctx.fillStyle = COLOR.warn;
          ctx.globalAlpha = 0.8 * off;
          ctx.fillRect(barX, bar.y, w, 34);
          ctx.globalAlpha = 1;
        }
        label(bar.name, barX - 12, bar.y + 23, COLOR.muted, 13, "right");
        label(bar.count + " people", barX + w + 12, bar.y + 23, COLOR.ink, 13.5, "left");
      });

      const halfX = barX + barMaxW / 2;
      ctx.save();
      ctx.strokeStyle = off > 0.03 ? COLOR.warn : COLOR.good;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(halfX, 250);
      ctx.lineTo(halfX, 368);
      ctx.stroke();
      ctx.restore();
      label("where a fair coin flip lands", halfX, 244, off > 0.03 ? COLOR.warn : COLOR.good, 12, "center");

      const okAlpha = Math.pow(1 - off, 2), badAlpha = Math.pow(off, 0.7);
      if (okAlpha > 0.01) label("✓ Sizes match the coin flip. Nothing wrong here — read the results.", LOGICAL_W / 2, 448, COLOR.good, 15, "center", okAlpha);
      if (badAlpha > 0.01) label("✕ Sizes don't match the coin flip. Stop — something upstream is broken.", LOGICAL_W / 2, 448, COLOR.warn, 15, "center", badAlpha);
    }
  };
  function render3(state){
    controlsEl.innerHTML = "";
    SPLITS.forEach(s => {
      makeBtn(s.label, state.frac.to === s.frac ? "primary selected" : null, () => {
        state.touched = true;
        retarget(state, "frac", s.frac);
        render3(state);
        updateText();
      });
    });
    makeNote("Group sizes are checkable before you look at any outcome.");
  }

  /* -------------------------------------------------------------------- */
  /* Scene 4 — Recap + Bridge                                              */
  /* -------------------------------------------------------------------- */

  const scene4 = {
    title: "4. What to Check Before You Trust Anything",
    legend: [
      { color: COLOR.control, label: "Group A", def: "one half of the split" },
      { color: COLOR.treatment, label: "Group B", def: "the other half" },
      { color: COLOR.good, label: "Healthy A/A", def: "even sizes, matching averages — trust it" },
      { color: COLOR.warn, label: "Broken A/A", def: "lopsided sizes — fix the pipeline first" }
    ],
    text(){
      return "An A/A test shows both groups the same thing on purpose. If a difference turns up anyway, the difference is your machinery, not your product — so you run one before you trust any real result. And the first thing to look at isn't the outcome at all, it's the group sizes: a lopsided split, a sample-ratio-mismatch, means stop and fix the pipeline. All of which assumes you can split people one at a time. Sometimes you can't — sometimes everyone in the same neighborhood, at the same hour, gets the same treatment no matter what your coin says. That's next.";
    },
    enter(state){
      state.animStart = null;
      render4(state);
    },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const p = clamp((now - state.animStart) / 1200, 0, 1);
      const lt = easeOutCubic(clamp(p / 0.6, 0, 1));
      const rt = easeOutCubic(clamp((p - 0.35) / 0.65, 0, 1));

      const panels = [
        { x: 55, t: lt, color: COLOR.good, head: "Healthy A/A", a: 12, b: 12,
          l1: "Sizes: 12 and 12 — like a coin flip.", l2: "Averages: basically on top of each other.", verdict: "✓ Trust the machinery." },
        { x: 465, t: rt, color: COLOR.warn, head: "Broken A/A", a: 19, b: 5,
          l1: "Sizes: 19 and 5 — a sample-ratio-mismatch.", l2: "One average oddly far from the other.", verdict: "✕ Fix the pipeline first." }
      ];

      panels.forEach(pn => {
        if (pn.t <= 0.01) return;
        ctx.save();
        ctx.globalAlpha = pn.t;
        ctx.strokeStyle = pn.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(pn.x, 40, 360, 300);
        ctx.restore();

        label(pn.head, pn.x + 180, 72, pn.color, 16, "center", pn.t);

        const cols = 6, cellW = 300 / cols, cellH = 46;
        for (let i = 0; i < 24; i++){
          const x = pn.x + 30 + cellW * (i % cols) + cellW / 2;
          const y = 96 + cellH * Math.floor(i / cols) + cellH / 2;
          circle(x, y, 12, i < pn.a ? COLOR.control : COLOR.treatment, 0.85 * pn.t);
        }
        label(pn.l1, pn.x + 180, 296, COLOR.muted, 12.5, "center", pn.t);
        label(pn.l2, pn.x + 180, 315, COLOR.muted, 12.5, "center", pn.t);
        label(pn.verdict, pn.x + 180, 366, pn.color, 14.5, "center", pn.t);
      });

      label("Check the group sizes first. It's free, and it catches the loudest breakage.", LOGICAL_W / 2, 428, COLOR.ink, 14, "center", rt);
      label("Next: what happens when you can't split people one at a time.", LOGICAL_W / 2, 456, COLOR.accent, 13, "center", rt);
    }
  };
  function render4(state){
    controlsEl.innerHTML = "";
    makeNote("Up next: Switchback Tests — when everyone nearby gets the same treatment at the same time.");
  }

  registerChapter("06-aa-tests", { scenes: [scene1, scene2, scene3, scene4] });

})();
