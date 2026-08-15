"use strict";

(function(){

  const groupColor = g => g === "A" ? COLOR.control : COLOR.treatment;

  const LEGEND = [
    { color: COLOR.control, label: "Control", def: "usual lemonade stand" },
    { color: COLOR.treatment, label: "Treatment", def: "new recipe we're testing" }
  ];

  /* -------------------------------------------------------------------- */
  /* Data                                                                  */
  /* -------------------------------------------------------------------- */

  const N = 40;
  const EFFECT = 2.5;

  function generateKids(type, seed){
    const rng = mulberry32(seed);
    const kids = [];
    for (let i = 0; i < N; i++){
      const group = i % 2 === 0 ? "A" : "B"; // A = control, B = treatment (20/20)
      let pre, post;
      if (type === "sticky"){
        const baseline = randNormal(rng, 25, 6);
        pre = baseline + randNormal(rng, 0, 2.5);
        post = baseline + randNormal(rng, 0, 2.5) + (group === "B" ? EFFECT : 0);
      } else if (type === "lumpy"){
        pre = randNormal(rng, 25, 9);
        post = randNormal(rng, 25, 9) + (group === "B" ? EFFECT : 0);
      } else { // nohistory
        pre = 0;
        post = randNormal(rng, 25, 7) + (group === "B" ? EFFECT : 0);
      }
      kids.push({ id: i, group, pre, post });
    }
    kids.gridOrder = shuffle(kids, mulberry32(seed + 999));
    // bars are interleaved (not grouped by color) so position can't be used to average by eye
    kids.barOrder = shuffle(kids, mulberry32(seed + 555));
    return kids;
  }

  const DATA = {
    sticky: generateKids("sticky", 1001),
    lumpy: generateKids("lumpy", 2002),
    nohistory: generateKids("nohistory", 3003)
  };

  function toPoints(kids){
    return kids.map(k => ({ x: k.pre, y: k.post, color: groupColor(k.group) }));
  }

  /* -------------------------------------------------------------------- */
  /* Scene 1 — The Problem                                                 */
  /* -------------------------------------------------------------------- */

  const scene1 = {
    title: "1. The Problem",
    legend: LEGEND,
    text(state){
      if (state.phase === "grid" || !state.phase) return "Forty kids, two groups — blue got the usual lemonade stand, orange got a new recipe we're testing. Everyone's naturally thirstier or less thirsty than everyone else. Run the experiment and see what happened this week.";
      if (state.phase === "revealed") return "Here's how much each kid drank this week. Which group do you think drank more — blue or orange?";
      return "However you guessed, it probably felt like a coin flip. There IS a small real difference between the groups — but it's buried under how much natural variation there is from kid to kid. That's the problem noise causes.";
    },
    enter(state){
      state.phase = "grid";
      state.animStart = null;
      renderControls1(state);
    },
    draw(c, now, state){
      if (state.phase === "grid"){
        drawUnitGrid(DATA.sticky, k => groupColor(k.group), { order: DATA.sticky.gridOrder, cols: 8, rows: 5 });
      } else {
        if (state.animStart == null) state.animStart = now;
        const t = easeOutCubic(clamp((now - state.animStart) / 700, 0, 1));
        drawMorphBars(DATA.sticky, 0, {
          order: DATA.sticky.barOrder,
          valueOfRaw: k => k.post,
          valueOfAdjusted: k => k.post - k.pre,
          colorOfFn: k => groupColor(k.group),
          showAverages: state.phase === "answered",
          groupOfFn: k => k.group,
          groupColorFn: groupColor,
          avgAlpha: t
        });
      }
    }
  };
  function renderControls1(state){
    controlsEl.innerHTML = "";
    if (state.phase === "grid"){
      makeBtn("▶ Run Experiment", "primary", () => {
        state.phase = "revealed";
        state.animStart = null;
        renderControls1(state);
        updateText();
      });
    } else if (state.phase === "revealed"){
      makeBtn("Blue drank more", "control-color", () => { state.phase = "answered"; state.guess = "A"; renderControls1(state); updateText(); });
      makeBtn("Orange drank more", "treatment-color", () => { state.phase = "answered"; state.guess = "B"; renderControls1(state); updateText(); });
      makeBtn("Can't tell", null, () => { state.phase = "answered"; state.guess = null; renderControls1(state); updateText(); });
    } else {
      makeBtn("🔄 Try again", null, () => { state.phase = "grid"; state.animStart = null; renderControls1(state); updateText(); });
      makeNote("The dashed lines show each group's true average.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 2 — The Insight                                                 */
  /* -------------------------------------------------------------------- */

  const scene2 = {
    title: "2. The Insight",
    legend: LEGEND,
    text(state){
      return state.shown
        ? "See it? Most kids who drank a lot last week also drink a lot this week — and the low-drinkers stay low. Their points cluster near that diagonal line. Thirst habits are “sticky.”"
        : "Same 40 kids. This time, let's plot last week's amount against this week's amount. Toggle their history on and see if a pattern shows up.";
    },
    enter(state){
      state.shown = false;
      state.animStart = null;
      renderControls2(state);
    },
    draw(c, now, state){
      let t = 0;
      if (state.shown){
        if (state.animStart == null) state.animStart = now;
        t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
      }
      drawScatter(toPoints(DATA.sticky), { diagonalT: t, xLabel: "Last week's amount →", yLabel: "This week's amount →" });
    }
  };
  function renderControls2(state){
    controlsEl.innerHTML = "";
    makeBtn(state.shown ? "Hide history" : "Show history", "primary", () => {
      state.shown = !state.shown;
      state.animStart = null;
      renderControls2(state);
      updateText();
    });
  }

  /* -------------------------------------------------------------------- */
  /* Scene 3 — The Trick                                                   */
  /* -------------------------------------------------------------------- */

  const scene3 = {
    title: "3. The Trick",
    legend: LEGEND,
    text(state){
      if (state.phase === "raw") return "Here are the same raw bars from Scene 1. But now we know each kid's own baseline from last week. What if we just... subtract what we already expected from them?";
      if (state.phase === "adjusting" || state.phase === "adjusted") return "Watch the bars tighten up. We're not changing anyone's behavior — just removing the part of each bar we could already predict from last week.";
      return "Now look at the guess again. With the predictable, personal baseline subtracted out, the gap between blue and orange is obvious. Same data, same tiny true effect — just less noise in the way.";
    },
    enter(state){
      state.phase = "raw";
      state.animStart = null;
      state.guessed = false;
      renderControls3(state);
    },
    draw(c, now, state){
      let t = 0;
      if (state.phase === "adjusting" || state.phase === "adjusted"){
        if (state.animStart == null) state.animStart = now;
        t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
        if (t >= 1) state.phase = "adjusted";
      }
      const morphOpts = {
        order: DATA.sticky.barOrder,
        valueOfRaw: k => k.post,
        valueOfAdjusted: k => k.post - k.pre,
        colorOfFn: k => groupColor(k.group),
        showAverages: state.guessed,
        groupOfFn: k => k.group,
        groupColorFn: groupColor,
        avgAlpha: 1
      };
      drawMorphBars(DATA.sticky, t, morphOpts);
      if (state.guessed) drawSpreadMeter(DATA.sticky.map(k => k.post), DATA.sticky.map(k => k.post - k.pre), {});
    }
  };
  function renderControls3(state){
    controlsEl.innerHTML = "";
    if (state.phase === "raw"){
      makeBtn("− Subtract last week's amount", "primary", () => {
        state.phase = "adjusting";
        state.animStart = null;
        renderControls3(state);
        updateText();
      });
    } else if (state.phase === "adjusting"){
      makeNote("Subtracting each kid's own baseline…");
    } else if (!state.guessed){
      makeBtn("Now which group won?", "primary", () => { state.guessed = true; renderControls3(state); updateText(); });
    } else {
      makeNote("Blue vs. orange — the gap between the dashed lines is now visible, and the “After subtract” spread bar is shorter.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 4 — When It Backfires                                          */
  /* -------------------------------------------------------------------- */

  const scene4 = {
    title: "4. When It Backfires",
    legend: LEGEND,
    text(state){
      if (state.phase === "scatter") return "Same lemonade stand, different number: how many cups each kid bought on a whim, on top of their usual order. A whim is random — this week's whim says nothing about last week's. Toggle history — no diagonal pattern this time.";
      if (state.phase === "raw") return "Same trick, different number. We know last week's whim-cup count. Let's subtract it out anyway and see what happens.";
      if (state.phase === "adjusting" || state.phase === "adjusted") return "Watch closely — the bars are getting MORE jumpy, not less.";
      return "Because last week's whim-buying told us nothing about this week, subtracting it didn't remove noise — it added a whole new unrelated source of randomness. The spread went up, not down. This is CUPED backfiring.";
    },
    enter(state){
      state.phase = "scatter";
      state.shown = false;
      state.animStart = null;
      state.guessed = false;
      renderControls4(state);
    },
    draw(c, now, state){
      if (state.phase === "scatter"){
        let t = 0;
        if (state.shown){
          if (state.animStart == null) state.animStart = now;
          t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
        }
        drawScatter(toPoints(DATA.lumpy), { diagonalT: t, xLabel: "Last week's amount →", yLabel: "This week's amount →" });
      } else {
        let t = 0;
        if (state.phase === "adjusting" || state.phase === "adjusted"){
          if (state.animStart == null) state.animStart = now;
          t = easeInOutCubic(clamp((now - state.animStart) / 900, 0, 1));
          if (t >= 1) state.phase = "adjusted";
        }
        drawMorphBars(DATA.lumpy, t, {
          order: DATA.lumpy.barOrder,
          valueOfRaw: k => k.post,
          valueOfAdjusted: k => k.post - k.pre,
          colorOfFn: k => groupColor(k.group),
          showAverages: state.guessed,
          groupOfFn: k => k.group,
          groupColorFn: groupColor,
          avgAlpha: 1
        });
        if (state.guessed) drawSpreadMeter(DATA.lumpy.map(k => k.post), DATA.lumpy.map(k => k.post - k.pre), {});
      }
    }
  };
  function renderControls4(state){
    controlsEl.innerHTML = "";
    if (state.phase === "scatter"){
      makeBtn(state.shown ? "Hide history" : "Show history", "primary", () => {
        state.shown = !state.shown;
        state.animStart = null;
        renderControls4(state);
        updateText();
      });
      makeBtn("Try subtracting anyway →", null, () => {
        state.phase = "raw";
        renderControls4(state);
        updateText();
      });
    } else if (state.phase === "raw"){
      makeBtn("− Subtract last week's amount", "primary", () => {
        state.phase = "adjusting";
        state.animStart = null;
        renderControls4(state);
        updateText();
      });
    } else if (state.phase === "adjusting"){
      makeNote("Subtracting last week's splurge…");
    } else if (!state.guessed){
      makeBtn("Reveal the spread", "primary", () => { state.guessed = true; renderControls4(state); updateText(); });
    } else {
      makeNote("The “After subtract” bar is taller and red — spread went up.");
    }
  }

  /* -------------------------------------------------------------------- */
  /* Scene 5 — How Do You Know? (rewritten narrative, no "Guard" jump)     */
  /* -------------------------------------------------------------------- */

  const METRIC_INFO = {
    sticky: { label: "Sticky habit", advice: "Tight diagonal, kids stay near it → last week predicts this week → subtracting helps. Spread shrinks." },
    lumpy: { label: "One-off splurge", advice: "Scattered cloud, no pattern → last week says nothing about this week → subtracting hurts. Spread grows." },
    nohistory: { label: "Brand-new kids", advice: "No history exists at all → there's nothing to subtract → spread just stays the same." }
  };

  const scene5 = {
    title: "5. How Do You Know?",
    legend: LEGEND,
    text(state){
      const advice = METRIC_INFO[state.metric].advice;
      if (!state.interacted) return "You just watched the trick help in Scene 3, and hurt in Scene 4. So how do you know which one you've got, before you commit to subtracting? Flip between metrics below and watch the scatter shape and the spread bars react. " + advice;
      if (state.metric === "sticky" && !state.triedLumpy) return advice + " Try “One-off splurge” next — see what a metric with no history looks like.";
      return advice;
    },
    enter(state){
      state.metric = "sticky";
      state.interacted = false;
      state.triedLumpy = false;
      renderControls5(state);
    },
    draw(c, now, state){
      const kids = DATA[state.metric];
      drawScatter(toPoints(kids), {
        diagonalT: state.metric === "nohistory" ? 0 : 1,
        noData: state.metric === "nohistory",
        noDataLabel: "(these kids are brand new — no history to plot)",
        xLabel: "Last week's amount →",
        yLabel: "This week's amount →",
        plot: { x: 90, y: 30, w: 580, h: 360 }
      });
      drawSpreadMeter(kids.map(k => k.post), kids.map(k => k.post - k.pre), { x: 760, y: 30, h: 280 });
    }
  };
  function renderControls5(state){
    controlsEl.innerHTML = "";
    Object.keys(METRIC_INFO).forEach(key => {
      makeBtn(METRIC_INFO[key].label, key === state.metric ? "primary selected" : null, () => {
        state.metric = key;
        state.interacted = true;
        if (key === "lumpy") state.triedLumpy = true;
        renderControls5(state);
        updateText();
      });
    });
  }

  /* -------------------------------------------------------------------- */
  /* Scene 6 — Recap                                                       */
  /* -------------------------------------------------------------------- */

  const scene6 = {
    title: "6. Recap",
    legend: LEGEND,
    text(){ return "If the past reliably predicts the present, subtract out what you already expected — it strips away noise you never needed to re-measure. If the past has nothing to do with the present, leave it alone — subtracting just imports fresh randomness. CUPED works when history is sticky. What do you do when it isn't? That's next."; },
    enter(state){
      renderControls6(state);
    },
    draw(c, now, state){
      const keys = ["sticky", "lumpy", "nohistory"];
      const w = LOGICAL_W / 3;
      keys.forEach((key, i) => {
        const kids = DATA[key];
        const lo = Math.min(...kids.map(k => k.pre), ...kids.map(k => k.post)) - 4;
        const hi = Math.max(...kids.map(k => k.pre), ...kids.map(k => k.post)) + 4;
        const px = i * w + 30, py = 40, pw = w - 60, ph = 260;
        ctx.strokeStyle = COLOR.line;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, py, pw, ph);
        const toX = v => px + ((v - lo) / (hi - lo)) * pw;
        const toY = v => py + ph - ((v - lo) / (hi - lo)) * ph;
        kids.forEach(k => {
          ctx.beginPath();
          ctx.arc(toX(k.pre), toY(k.post), 4, 0, Math.PI * 2);
          ctx.fillStyle = groupColor(k.group);
          ctx.globalAlpha = 0.75;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
        ctx.fillStyle = COLOR.muted;
        ctx.font = "18px FuturaHandwritten, cursive";
        ctx.textAlign = "center";
        ctx.fillText(METRIC_INFO[key].label, px + pw / 2, py + ph + 22);
      });
    }
  };
  function renderControls6(state){
    controlsEl.innerHTML = "";
    makeNote("Sticky history → CUPED helps. No sticky history → look for another trick. Up next: Other Variance-Reduction Tricks.");
  }

  registerChapter("01-cuped", {
    scenes: [scene1, scene2, scene3, scene4, scene5, scene6]
  });

})();
