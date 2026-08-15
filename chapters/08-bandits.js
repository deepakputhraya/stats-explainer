"use strict";

(function(){

  /* -------------------------------------------------------------------- */
  /* Arms & simulated test                                                 */
  /* -------------------------------------------------------------------- */

  const ARMS = [
    { name: "Classic",     sub: "the usual recipe",  rate: 0.50, color: colorAt(0) },
    { name: "Extra Lemon", sub: "sharper, tangier",  rate: 0.63, color: colorAt(1) },
    { name: "Minty Twist", sub: "a bold idea",       rate: 0.34, color: colorAt(2) }
  ];
  const NA = ARMS.length;

  const STEPS = 12;        // rounds of the test
  const PER_STEP = 60;     // kids served each round
  const MAX_SERVED = 500;  // shared bar scale so fixed vs adaptive compare fairly
  const MIN_SHARE = 0.06;  // every recipe always keeps a sliver of traffic

  // COLOR.good is the same hex as colorAt(2) (Minty Twist), so the adaptive
  // highlight uses accent instead to stay distinguishable from the arms.
  const MOVING = COLOR.accent;
  const LOCKED = COLOR.muted;

  function equalShares(){ return ARMS.map(() => 1 / NA); }

  // Leans harder toward whichever recipe is winning so far, but never drops
  // any recipe to zero. Deliberately described in plain words in the copy.
  function leaningShares(happy, served, step){
    const rates = ARMS.map((a, i) => (served[i] > 0 ? happy[i] / served[i] : 0.5));
    const lean = 1 + 6 * (step / (STEPS - 1));
    let w = rates.map(r => Math.pow(Math.max(r, 0.02), lean));
    const sum = w.reduce((s, v) => s + v, 0);
    let sh = w.map(v => v / sum);
    sh = sh.map(v => Math.max(v, MIN_SHARE));
    const s2 = sh.reduce((s, v) => s + v, 0);
    return sh.map(v => v / s2);
  }

  function simulate(mode, seed){
    const rng = mulberry32(seed);
    const served = ARMS.map(() => 0);
    const happy = ARMS.map(() => 0);
    const rounds = [];
    for (let s = 0; s < STEPS; s++){
      const shares = (mode === "fixed" || s === 0) ? equalShares() : leaningShares(happy, served, s);
      const counts = shares.map(sh => Math.max(1, Math.round(sh * PER_STEP)));
      counts.forEach((cnt, i) => {
        for (let k = 0; k < cnt; k++){
          served[i]++;
          if (rng() < ARMS[i].rate) happy[i]++;
        }
      });
      rounds.push({
        shares: shares.slice(),
        counts: counts.slice(),
        served: served.slice(),
        happy: happy.slice()
      });
    }
    return rounds;
  }

  const RUNS = {
    fixed: simulate("fixed", 8801),
    adaptive: simulate("adaptive", 8801)
  };

  const zeros = () => ARMS.map(() => 0);
  function servedAt(mode, k){ return k <= 0 ? zeros() : RUNS[mode][k - 1].served; }
  function happyAt(mode, k){ return k <= 0 ? zeros() : RUNS[mode][k - 1].happy; }
  function sharesAt(mode, k){ return RUNS[mode][clamp(k, 0, STEPS - 1)].shares; }
  function overallRate(mode, k){
    const s = servedAt(mode, k), h = happyAt(mode, k);
    const ts = s.reduce((a, b) => a + b, 0);
    return ts === 0 ? 0 : h.reduce((a, b) => a + b, 0) / ts;
  }
  function lerpArr(a, b, t){ return a.map((v, i) => lerp(v, b[i], t)); }
  const pct = v => Math.round(v * 100) + "%";

  /* -------------------------------------------------------------------- */
  /* Small drawing helpers                                                 */
  /* -------------------------------------------------------------------- */

  const FONT = 'FuturaHandwritten, cursive';
  function font(size, weight){ ctx.font = (weight ? weight + " " : "") + size + "px " + FONT; }

  function roundRect(x, y, w, h, r){
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function panelLabel(text, x, y, align){
    ctx.fillStyle = COLOR.muted;
    font(12.5);
    ctx.textAlign = align || "left";
    ctx.fillText(text, x, y);
  }

  // Horizontal stacked bar of the traffic split, with % labels inside.
  function drawSplitBar(shares, box){
    let x = box.x;
    shares.forEach((sh, i) => {
      const w = sh * box.w;
      ctx.fillStyle = ARMS[i].color;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(x, box.y, w, box.h);
      ctx.globalAlpha = 1;
      if (w > 34){
        ctx.fillStyle = "#fff";
        font(12.5, "bold");
        ctx.textAlign = "center";
        ctx.fillText(pct(sh), x + w / 2, box.y + box.h / 2 + 4.5);
      }
      x += w;
    });
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
  }

  // Stacked area of the traffic split over rounds. Flat bands = a fixed split;
  // bending bands = an allocation that moved while the test ran.
  function drawSplitHistory(mode, k, t, box){
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    const xOf = i => box.x + ((i + 1) / STEPS) * box.w;
    const cumOf = i => {
      const sh = RUNS[mode][i].shares;
      const out = [0];
      let acc = 0;
      sh.forEach(v => { acc += v; out.push(acc); });
      return out;
    };

    if (k >= 1){
      const pts = [{ x: box.x, cum: cumOf(0) }];
      for (let i = 0; i <= k - 2; i++) pts.push({ x: xOf(i), cum: cumOf(i) });
      const prev = pts[pts.length - 1];
      pts.push({ x: lerp(prev.x, xOf(k - 1), t), cum: lerpArr(prev.cum, cumOf(k - 1), t) });

      const yOf = v => box.y + box.h * (1 - v);
      for (let j = 0; j < NA; j++){
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const x = p.x, y = yOf(p.cum[j + 1]);
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        for (let idx = pts.length - 1; idx >= 0; idx--){
          ctx.lineTo(pts[idx].x, yOf(pts[idx].cum[j]));
        }
        ctx.closePath();
        ctx.fillStyle = ARMS[j].color;
        ctx.globalAlpha = 0.82;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const nowX = pts[pts.length - 1].x;
      ctx.strokeStyle = COLOR.ink;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nowX, box.y);
      ctx.lineTo(nowX, box.y + box.h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = COLOR.muted;
      font(13, "italic");
      ctx.textAlign = "center";
      ctx.fillText("nothing served yet", box.x + box.w / 2, box.y + box.h / 2);
    }
    panelLabel("Round 1", box.x, box.y + box.h + 16, "left");
    panelLabel("Round " + STEPS, box.x + box.w, box.y + box.h + 16, "right");
  }

  // Per-recipe cumulative "kids served" bars + how many came back for a second cup.
  function drawServedPanel(box, served, happy){
    const rowH = box.h / NA;
    ARMS.forEach((a, i) => {
      const y = box.y + rowH * i;
      const barY = y + rowH * 0.42;
      const barH = Math.min(18, rowH * 0.34);
      const w = (served[i] / MAX_SERVED) * box.w;

      ctx.fillStyle = a.color;
      font(12.5, "bold");
      ctx.textAlign = "left";
      ctx.fillText(a.name, box.x, y + rowH * 0.3);

      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, barY, box.w, barH);
      ctx.fillStyle = a.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(box.x, barY, Math.max(w, 0), barH);
      ctx.globalAlpha = 1;

      const n = Math.round(served[i]);
      const rate = served[i] > 0 ? happy[i] / served[i] : 0;
      ctx.fillStyle = COLOR.muted;
      font(11.5);
      ctx.textAlign = "right";
      ctx.fillText(n + " kids" + (n > 0 ? "  ·  " + pct(rate) + " came back" : ""), box.x + box.w, y + rowH * 0.3);
    });
  }

  // One horizontal meter: share of kids who came back, across the whole test.
  function drawOutcomeMeter(box, rate, label, color){
    panelLabel(label, box.x, box.y - 8, "left");
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = color || COLOR.accent;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(box.x, box.y, box.w * clamp(rate, 0, 1), box.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR.ink;
    font(14, "bold");
    ctx.textAlign = "left";
    ctx.fillText(pct(rate), box.x + box.w + 12, box.y + box.h / 2 + 5);
  }

  // The three recipes keep the same colors in every scene, so the legend is
  // shared; scenes append their own extra rows for non-arm colors they use.
  // reveal=false keeps Scene 1 from spoiling which recipe wins.
  function armLegend(reveal){
    const revealed = ["ends up middling", "ends up the favourite", "ends up the dud"];
    return ARMS.map((a, i) => ({
      color: a.color,
      label: a.name,
      def: reveal ? a.sub + ", " + revealed[i] : a.sub + " (quality still unknown)"
    }));
  }

  function armChips(y, startX){
    let x = startX != null ? startX : 44;
    ARMS.forEach(a => {
      ctx.beginPath();
      ctx.arc(x + 6, y - 4, 6, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.fillStyle = COLOR.muted;
      font(12);
      ctx.textAlign = "left";
      ctx.fillText(a.name, x + 18, y);
      x += 24 + ctx.measureText(a.name).width;
    });
  }

  /* -------------------------------------------------------------------- */
  /* Scene 1 — The Dilemma                                                 */
  /* -------------------------------------------------------------------- */

  const POOL_COLS = 9, POOL_ROWS = 8, POOL_N = POOL_COLS * POOL_ROWS;

  const scene1 = {
    title: "1. Three Recipes, One Summer",
    legend(state){
      const items = armLegend(false);
      if (state.phase === "pool") items.unshift({ color: "#d8d3c6", label: "A kid", def: "one customer you get to serve exactly once" });
      if (state.phase === "dilemma") items.push({ color: COLOR.warn, label: "Wasted traffic", def: "kids spent on a recipe you already suspect is bad" });
      return items;
    },
    text(state){
      if (state.phase === "pool") return "Three lemonade recipes you'd like to compare, and one summer's worth of thirsty kids to test them on. That crowd on the left is everyone you get — you can't order more kids. Nobody knows yet which recipe kids like best.";
      if (state.phase === "split") return "The obvious plan: chop the crowd into three equal groups, one recipe each, and keep it that way until the end. Every recipe gets a fair, identical shot.";
      return "Here's the catch. One of these recipes is probably a dud — and under the equal plan, a full third of your one and only crowd gets served that dud, right up to the last day. You'd be paying to re-learn the same bad news over and over.";
    },
    enter(state){
      state.phase = "pool";
      state.animStart = null;
      renderControls1(state);
    },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const raw = clamp((now - state.animStart) / 900, 0, 1);
      const tSplit = state.phase === "pool" ? 0 : easeOutCubic(raw);
      const tDud = state.phase === "dilemma" ? easeOutCubic(raw) : 0;

      // crowd of kids
      const box = { x: 44, y: 60, w: 360, h: 300 };
      const cellW = box.w / POOL_COLS, cellH = box.h / POOL_ROWS;
      const r = Math.min(cellW, cellH) * 0.3;
      panelLabel("Your whole crowd for the summer", box.x, box.y - 16, "left");
      for (let i = 0; i < POOL_N; i++){
        const col = i % POOL_COLS, row = Math.floor(i / POOL_COLS);
        const x = box.x + cellW * col + cellW / 2;
        const y = box.y + cellH * row + cellH / 2;
        const arm = Math.floor(i / (POOL_N / NA));
        const tinted = clamp(tSplit * POOL_N * 1.15 - i, 0, 1);
        const isDud = arm === 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = tinted > 0.5 ? ARMS[Math.min(arm, NA - 1)].color : "#d8d3c6";
        ctx.globalAlpha = 0.35 + 0.55 * tinted - (isDud ? 0.2 * tDud : 0);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // bracket over the possibly-wasted third
      if (tDud > 0){
        const topRow = Math.floor((POOL_N / NA) * 2 / POOL_COLS);
        const y0 = box.y + cellH * topRow + 2;
        const y1 = box.y + box.h - 2;
        ctx.save();
        ctx.globalAlpha = tDud;
        ctx.strokeStyle = COLOR.warn;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(box.x - 4, y0, box.w + 8, y1 - y0);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = tDud;
        ctx.fillStyle = COLOR.warn;
        font(12, "bold");
        ctx.textAlign = "left";
        ctx.fillText("if this recipe is a dud, this third of the summer is spent on it anyway", box.x - 2, y1 + 22);
        ctx.restore();
      }

      // recipe cards
      const cx = 470, cw = 366, ch = 84, gap = 20;
      ARMS.forEach((a, i) => {
        const y = 52 + i * (ch + gap);
        ctx.fillStyle = "#f6f3ec";
        roundRect(cx, y, cw, ch, 14);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 36, y + ch / 2, 17, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = COLOR.ink;
        font(15, "bold");
        ctx.textAlign = "left";
        ctx.fillText(a.name, cx + 66, y + 30);
        ctx.fillStyle = COLOR.muted;
        font(12);
        ctx.fillText(a.sub, cx + 66, y + 48);

        // unknown-quality meter
        const mx = cx + 66, my = y + 60, mw = 200, mh = 12;
        ctx.save();
        ctx.strokeStyle = COLOR.line;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(mx, my, mw, mh);
        ctx.restore();
        ctx.fillStyle = COLOR.muted;
        font(11.5, "italic");
        ctx.fillText("kids who'd come back:  ?", mx + mw + 10, my + 10);
      });
      armChips(430);
    }
  };
  function renderControls1(state){
    controlsEl.innerHTML = "";
    if (state.phase === "pool"){
      makeBtn("Split the crowd three ways", "primary", () => {
        state.phase = "split"; state.animStart = null; renderControls1(state); updateText();
      });
    } else if (state.phase === "split"){
      makeBtn("So what's the catch?", "primary", () => {
        state.phase = "dilemma"; state.animStart = null; renderControls1(state); updateText();
      });
      makeNote("Equal thirds, start to finish.");
    } else {
      makeBtn("🔄 Start over", null, () => {
        state.phase = "pool"; state.animStart = null; renderControls1(state); updateText();
      });
      makeNote("Next: watch the equal split actually run.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scenes 2 & 3 — shared running-test view                               */
  /* -------------------------------------------------------------------- */

  function enterRun(state, mode, render){
    state.mode = mode;
    state.step = 0;
    state.prev = 0;
    state.animStart = null;
    state.auto = false;
    state.fast = false;
    render(state);
  }

  function drawRun(now, state, render){
    const mode = state.mode;
    const dur = state.fast ? 320 : 700;
    if (state.animStart == null) state.animStart = now;
    let t = easeInOutCubic(clamp((now - state.animStart) / dur, 0, 1));

    if (t >= 1 && state.auto){
      if (state.step < STEPS){
        state.prev = state.step;
        state.step++;
        state.animStart = now;
        t = 0;
        updateText();
      } else {
        state.auto = false;
        state.fast = false;
        render(state);
        updateText();
      }
    }

    const served = lerpArr(servedAt(mode, state.prev), servedAt(mode, state.step), t);
    const happy = lerpArr(happyAt(mode, state.prev), happyAt(mode, state.step), t);
    const shares = lerpArr(sharesAt(mode, state.prev), sharesAt(mode, state.step), t);
    const rate = lerp(overallRate(mode, state.prev), overallRate(mode, state.step), t);

    // round counter
    const shown = Math.round(lerp(state.prev, state.step, t));
    ctx.fillStyle = COLOR.ink;
    font(14, "bold");
    ctx.textAlign = "left";
    ctx.fillText("Round " + shown + " of " + STEPS, 44, 28);
    armChips(28, 170);

    // current split bar
    panelLabel("Traffic split for the next round", 44, 58, "left");
    drawSplitBar(shares, { x: 44, y: 66, w: 792, h: 30 });

    // split history (left) + served tallies (right)
    panelLabel(mode === "fixed" ? "Split each round — flat, never moves" : "Split each round — it leans as it learns",
      44, 128, "left");
    drawSplitHistory(mode, state.step, t, { x: 44, y: 138, w: 372, h: 200 });

    panelLabel("Kids served so far, per recipe", 464, 128, "left");
    drawServedPanel({ x: 464, y: 138, w: 372, h: 200 }, served, happy);

    drawOutcomeMeter({ x: 44, y: 404, w: 640, h: 22 }, rate,
      "Kids who came back for a second cup — averaged over everyone served so far",
      mode === "fixed" ? LOCKED : MOVING);

    return { shown };
  }

  const scene2 = {
    title: "2. The Equal Split, Running",
    legend(){
      return armLegend(true).concat([
        { color: LOCKED, label: "Average summer", def: "share of all kids served so far who came back for a second cup" }
      ]);
    },
    text(state){
      if (state.step === 0) return "Same three recipes, sixty kids per round, twelve rounds. The split is locked at a third each. Run a round and watch both panels.";
      if (state.step < STEPS) return "Notice the bands on the left: perfectly flat. Round after round, the Minty Twist keeps getting exactly as many kids as the leader, even though it's already losing badly. That's the cost of a locked split — you keep buying information you already have.";
      return "Twelve rounds done. Every recipe ended with the same big pile of data, which is genuinely useful. But look at the bottom bar: across the whole summer, only about half your kids came back, because a third of them were drinking the worst lemonade the entire time.";
    },
    enter(state){ enterRun(state, "fixed", renderControls2); },
    draw(c, now, state){
      drawRun(now, state, renderControls2);
      if (state.step >= 4){
        ctx.fillStyle = COLOR.warn;
        font(12, "bold");
        ctx.textAlign = "left";
        ctx.fillText("↑ the worst recipe still gets a full third, every round", 44, 372);
      }
    }
  };
  function renderControls2(state){ runControls(state, renderControls2); }

  const scene3 = {
    title: "3. Letting the Split Move",
    legend(){
      return armLegend(true).concat([
        { color: MOVING, label: "Average summer", def: "same measure as before — it climbs higher when the split moves" }
      ]);
    },
    text(state){
      if (state.step === 0) return "Same recipes, same crowd, same twelve rounds — one change. After each round the stand looks at what's happened so far and hands more of the next round's kids to whichever recipe is doing best, while still giving the others some. Run it.";
      if (state.step < STEPS) return "The bands are bending. The system never stops serving the weaker recipes entirely — it just keeps shifting more of each round toward the current favourite. And because more kids get the good lemonade sooner, the bottom bar is climbing above where the equal split sat.";
      return "Same summer, same recipes, and more kids came back — simply because the crowd stopped being fed the dud in equal measure. Nobody told the stand which recipe was best; it kept leaning toward whatever was winning at the time.";
    },
    enter(state){ enterRun(state, "adaptive", renderControls3); },
    draw(c, now, state){
      drawRun(now, state, renderControls3);
      if (state.step >= 4){
        ctx.fillStyle = MOVING;
        font(12, "bold");
        ctx.textAlign = "left";
        ctx.fillText("↑ more of each round goes to whatever is winning so far", 44, 372);
      }
    }
  };
  function renderControls3(state){ runControls(state, renderControls3); }

  function runControls(state, render){
    controlsEl.innerHTML = "";
    if (state.auto){
      makeNote("Serving kids…");
      return;
    }
    if (state.step >= STEPS){
      makeBtn("🔄 Run it again", null, () => {
        state.step = 0; state.prev = 0; state.animStart = null; render(state); updateText();
      });
      makeNote(state.mode === "fixed"
        ? "Equal data on all three — but a mediocre summer."
        : "A better summer — and the losing recipes have thinner bars.");
      return;
    }
    makeBtn("▶ Run one round", "primary", () => {
      state.prev = state.step;
      state.step = Math.min(STEPS, state.step + 1);
      state.animStart = null;
      state.fast = false;
      render(state);
      updateText();
    });
    makeBtn("▶▶ Run to the end", null, () => {
      state.auto = true;
      state.fast = true;
      state.prev = state.step;
      state.step = Math.min(STEPS, state.step + 1);
      state.animStart = null;
      render(state);
      updateText();
    });
    if (state.step > 0){
      makeBtn("🔄 Reset", null, () => {
        state.prev = state.step; state.step = 0; state.animStart = null; render(state); updateText();
      });
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 4 — The Trade-off                                               */
  /* -------------------------------------------------------------------- */

  // Rough "how sure are we" half-width; drawn as a bracket, never named.
  function sureHalf(happy, served){
    if (served < 2) return 0.5;
    const p = clamp(happy / served, 0.05, 0.95);
    return 2.6 * Math.sqrt(p * (1 - p) / served);
  }

  const scene4 = {
    title: "4. What the Shift Costs You",
    legend(){
      return armLegend(true).concat([
        { color: LOCKED, label: "Locked split", def: "equal shares all the way — mediocre summer" },
        { color: MOVING, label: "Moving split", def: "shares shift toward the winner — better summer" }
      ]);
    },
    text(state){
      if (state.view === "fixed") return "End of the summer, equal split. Three fat bars of data, three tight brackets — you can say with real confidence how good each recipe is, including the bad ones. The price is at the bottom right: a mediocre average summer. Flip to the moving split.";
      if (!state.flipped) return "Moving split. Better summer at the bottom right — more kids came back. But look at the Minty Twist: a stubby data bar and a wide bracket. You know it lost; you can't say clearly by how much.";
      return "That's the whole trade. A locked split buys you equally solid answers about every option, and pays for them with a worse experience during the test. A moving split buys a better experience during the test, and pays for it with fuzzy answers about the options it starved.";
    },
    enter(state){
      state.view = "fixed";
      state.from = 0;
      state.to = 0;
      state.animStart = null;
      state.flipped = false;
      renderControls4(state);
    },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 800, 0, 1));
      const m = lerp(state.from, state.to, t); // 0 = locked split, 1 = moving split

      const fs = servedAt("fixed", STEPS), fh = happyAt("fixed", STEPS);
      const as = servedAt("adaptive", STEPS), ah = happyAt("adaptive", STEPS);
      const served = lerpArr(fs, as, m);
      const happy = lerpArr(fh, ah, m);

      ctx.fillStyle = COLOR.ink;
      font(15, "bold");
      ctx.textAlign = "left";
      ctx.fillText(m < 0.5 ? "Locked split — end of summer" : "Moving split — end of summer", 44, 30);

      const barMaxW = 250, axX = 380, axW = 250;
      panelLabel("How much data you ended up with", 44, 62, "left");
      panelLabel("How sure you are about it", axX, 62, "left");

      ARMS.forEach((a, i) => {
        const y = 84 + i * 118;
        ctx.fillStyle = a.color;
        font(13, "bold");
        ctx.textAlign = "left";
        ctx.fillText(a.name, 44, y + 14);

        const n = Math.round(served[i]);
        ctx.fillStyle = COLOR.muted;
        font(11.5);
        ctx.fillText(n + " kids served", 44, y + 54);

        ctx.strokeStyle = COLOR.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(44, y + 22, barMaxW, 20);
        ctx.fillStyle = a.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(44, y + 22, barMaxW * clamp(served[i] / MAX_SERVED, 0, 1), 20);
        ctx.globalAlpha = 1;

        // certainty bracket around the observed "came back" share
        const rate = served[i] > 0 ? happy[i] / served[i] : 0;
        const half = sureHalf(happy[i], served[i]);
        const toX = v => axX + clamp(v, 0, 1) * axW;
        const by = y + 32;
        ctx.strokeStyle = COLOR.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(axX, by + 22);
        ctx.lineTo(axX + axW, by + 22);
        ctx.stroke();

        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(rate - half), by);
        ctx.lineTo(toX(rate + half), by);
        ctx.stroke();
        [rate - half, rate + half].forEach(v => {
          ctx.beginPath();
          ctx.moveTo(toX(v), by - 7);
          ctx.lineTo(toX(v), by + 7);
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.arc(toX(rate), by, 5, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.fill();

        ctx.fillStyle = COLOR.muted;
        font(11.5);
        ctx.textAlign = "left";
        const fairShare = (STEPS * PER_STEP) / NA;
        const thin = served[i] / fairShare;
        const verdict = thin > 0.85 ? "narrow bracket — solid"
          : thin > 0.6 ? "wider bracket — less sure"
          : "wide bracket — fuzzy";
        ctx.fillText(pct(rate) + " came back  ·  " + verdict, axX, by + 40);
      });
      ctx.fillStyle = COLOR.muted;
      font(11);
      ctx.textAlign = "center";
      ctx.fillText("0%", axX, 442);
      ctx.fillText("100%", axX + axW, 442);
      ctx.fillText("share of kids who came back", axX + axW / 2, 442);

      // right column: average outcome during the test, both approaches
      const cx = 690, cw = 150;
      ctx.fillStyle = COLOR.ink;
      font(12.5, "bold");
      ctx.textAlign = "left";
      ctx.fillText("Average summer", cx, 62);
      ctx.fillStyle = COLOR.muted;
      font(11);
      ctx.fillText("kids who came back", cx, 78);

      const rates = [overallRate("fixed", STEPS), overallRate("adaptive", STEPS)];
      const labels = ["Locked", "Moving"];
      const baseY = 400, maxH = 280, maxR = 0.7;
      rates.forEach((r, i) => {
        const bw = 56, bx = cx + i * (bw + 30);
        const h = (r / maxR) * maxH;
        ctx.fillStyle = i === 0 ? LOCKED : MOVING;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(bx, baseY - h, bw, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = COLOR.ink;
        font(13, "bold");
        ctx.textAlign = "center";
        ctx.fillText(pct(r), bx + bw / 2, baseY - h - 8);
        ctx.fillStyle = COLOR.muted;
        font(11.5);
        ctx.fillText(labels[i], bx + bw / 2, baseY + 16);

        // highlight ring slides between the two bars
        const active = clamp(1 - Math.abs(m - i) , 0, 1);
        if (active > 0.02){
          ctx.save();
          ctx.globalAlpha = active;
          ctx.strokeStyle = COLOR.ink;
          ctx.lineWidth = 2;
          roundRect(bx - 6, baseY - h - 6, bw + 12, h + 12, 8);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
  };
  function renderControls4(state){
    controlsEl.innerHTML = "";
    makeBtn("Locked split", state.view === "fixed" ? "primary selected" : null, () => {
      if (state.view === "fixed") return;
      state.view = "fixed"; state.from = state.to; state.to = 0; state.animStart = null;
      renderControls4(state); updateText();
    });
    makeBtn("Moving split", state.view === "adaptive" ? "primary selected" : null, () => {
      if (state.view === "adaptive") return;
      state.view = "adaptive"; state.from = state.to; state.to = 1; state.flipped = state.flipped || false;
      state.animStart = null;
      renderControls4(state); updateText();
    });
    if (state.view === "adaptive"){
      makeBtn("So which is right?", null, () => {
        state.flipped = true; renderControls4(state); updateText();
      });
    }
    makeNote("Watch the data bars, the bracket widths, and the two “average summer” bars together.");
  }

  /* -------------------------------------------------------------------- */
  /* Scene 5 — Recap + Bridge                                              */
  /* -------------------------------------------------------------------- */

  const scene5 = {
    title: "5. Recap",
    legend(){
      return armLegend(true).concat([
        { color: LOCKED, label: "Locked split", def: "flat bands, equal data on every recipe" },
        { color: MOVING, label: "Moving split", def: "bending bands, thin data on the recipes it starved" }
      ]);
    },
    text(){
      return "A moving split lets the experiment act on what it's learning while it's still running: more traffic slides toward the current favourite, so the average experience during the test gets better. You pay for that in the end-of-test picture — the options you starved have thin data and fuzzy verdicts. Locked split when you need clean numbers on every option; moving split when the experience during the test is what matters most. Either way, notice that both designs still answer one yes-or-no question: is this one better? Next chapter: what if you wanted an actual probability instead — “there's a 94% chance this recipe wins”?";
    },
    enter(state){
      state.animStart = null;
      renderControls5(state);
    },
    draw(c, now, state){
      if (state.animStart == null) state.animStart = now;
      const t = easeOutCubic(clamp((now - state.animStart) / 900, 0, 1));
      ctx.save();
      ctx.globalAlpha = t;

      const boxes = [
        { mode: "fixed", x: 60, label: "Locked split", note: "flat bands · equal data · mediocre summer" },
        { mode: "adaptive", x: 470, label: "Moving split", note: "bands bend · thin data on losers · better summer" }
      ];
      boxes.forEach(b => {
        const box = { x: b.x, y: 70, w: 350, h: 190 };
        drawSplitHistory(b.mode, STEPS, 1, box);
        ctx.fillStyle = COLOR.ink;
        font(14, "bold");
        ctx.textAlign = "left";
        ctx.fillText(b.label, box.x, box.y - 26);
        ctx.fillStyle = COLOR.muted;
        font(12);
        ctx.fillText(b.note, box.x, box.y - 8);
        drawOutcomeMeter({ x: box.x, y: box.y + 250, w: 250, h: 20 },
          overallRate(b.mode, STEPS), "Average summer", b.mode === "fixed" ? LOCKED : MOVING);
      });
      armChips(430);
      ctx.restore();
    }
  };
  function renderControls5(state){
    controlsEl.innerHTML = "";
    makeNote("Up next: Bayesian Experiments — turning “is it better?” into “how likely is it that it's better?”");
  }

  registerChapter("08-bandits", {
    scenes: [scene1, scene2, scene3, scene4, scene5]
  });

})();
