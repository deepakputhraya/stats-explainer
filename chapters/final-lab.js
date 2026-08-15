"use strict";

(function(){

  const FONT = 'FuturaHandwritten, cursive';

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
  function bar(x, y, w, h, color, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 0.85;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /* -------------------------------------------------------------------- */
  /* Scenario data                                                          */
  /* -------------------------------------------------------------------- */

  const N = 60;
  const IDS = [];
  for (let i = 0; i < N; i++) IDS.push(i);

  const BASELINE = (function(){
    const rng = mulberry32(55001);
    return IDS.map(() => clamp(randNormal(rng, 18, 5), 5, 35));
  })();

  const CHANGES = [
    { id: "sign",    name: "New chalkboard sign",   trueEffect: 4.2 },
    { id: "recipe",  name: "Sweeter recipe",        trueEffect: 0.3 },
    { id: "layout",  name: "New counter layout",    trueEffect: -1.0 }
  ];

  const TRAFFIC_CAP = 40;

  function runExperiment(design, seed){
    const rng = mulberry32(seed);
    const change = CHANGES.find(c => c.id === design.changeId);
    const enrolled = IDS.slice(0, TRAFFIC_CAP);

    let assign;
    if (design.assignment === "random"){
      const sh = shuffle(enrolled, rng);
      const half = Math.floor(TRAFFIC_CAP / 2);
      assign = Object.create(null);
      sh.forEach((id, i) => { assign[id] = i < half ? "B" : "A"; });
    } else {
      const byBase = enrolled.slice().sort((a, b) => BASELINE[b] - BASELINE[a]);
      assign = Object.create(null);
      byBase.forEach((id, i) => { assign[id] = i < 20 ? "B" : "A"; });
    }

    const outcomes = Object.create(null);
    enrolled.forEach(id => {
      const g = assign[id];
      const noise = randNormal(rng, 0, design.variance > 0 ? 5 : 3);
      const adj = design.variance > 0 ? 0 : (BASELINE[id] - 18) * 0.5;
      const eff = g === "B" ? change.trueEffect : 0;
      outcomes[id] = clamp(BASELINE[id] + eff + noise - adj, 2, 40);
    });

    const aIds = enrolled.filter(id => assign[id] === "A");
    const bIds = enrolled.filter(id => assign[id] === "B");
    const avgA = mean(aIds.map(id => outcomes[id]));
    const avgB = mean(bIds.map(id => outcomes[id]));
    const gap = avgB - avgA;

    const chanceGaps = [];
    for (let i = 0; i < 200; i++){
      const sh = shuffle(enrolled, rng);
      const ca = sh.slice(0, aIds.length), cb = sh.slice(aIds.length);
      chanceGaps.push(mean(cb.map(id => outcomes[id])) - mean(ca.map(id => outcomes[id])));
    }
    const rarer = chanceGaps.filter(g => Math.abs(g) >= Math.abs(gap)).length;
    const significant = rarer / 200 < (design.correction === "bh" ? 0.05 : design.correction === "bonferroni" ? 0.0167 : 0.05);

    return { change, gap, avgA, avgB, significant, aIds, bIds, outcomes, assign, enrolled };
  }

  /* -------------------------------------------------------------------- */
  /* Single scene with internal phases: design → run → ship → process     */
  /* -------------------------------------------------------------------- */

  const scene = {
    title: "The Final Lab",
    legend: [
      { color: COLOR.control, label: "Control", def: "current stand" },
      { color: COLOR.treatment, label: "Treatment", def: "your chosen change" }
    ],
    text(state){
      if (state.phase === "design")
        return "Three changes could lift sales: a new sign, a sweeter recipe, a new counter layout. Traffic is tight — only 40 customers fit the study this week. Pick one change, then choose your methods from the toolbelt. Every choice shapes how clean the answer will be.";
      if (state.phase === "run"){
        const r = state.run;
        if (!r) return "Run the experiment to see results.";
        const verdict = r.significant ? "statistically significant" : "not significant";
        return "You tested " + r.change.name + ". Control averaged " + r.avgA.toFixed(1) + " cups, treatment averaged " + r.avgB.toFixed(1) + " — a gap of " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1) + " cups. The gap is " + verdict + " under your chosen correction. The real effect was " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) + " cups — so " + (Math.abs(r.gap - r.change.trueEffect) < 2 ? "your estimate landed close to the truth." : "your estimate was pulled off by noise or bias.");
      }
      if (state.phase === "ship"){
        const r = state.run;
        if (!state.shipped) return "You've seen the result. Now decide: do you ship " + r.change.name + " to the whole stand, or hold off? Your decision should rest on the design, not just the number — a biased split or an uncorrected comparison can hand you a fake win.";
        const correctShip = r.change.trueEffect > 1;
        const didShip = state.shipped === "ship";
        const good = (correctShip && didShip) || (!correctShip && !didShip);
        return (good ? "Good call. " : "Risky call. ") +
          "The true effect of " + r.change.name + " was " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) + " cups. " +
          (correctShip ? "It was a genuine improvement." : "It wasn't worth shipping.") +
          " Your design used " + (state.design.assignment === "random" ? "random assignment" : "a biased hand-picked split") +
          (state.design.variance === 1 ? " with baseline adjustment" : " with no variance reduction") +
          ", and " + (state.design.correction === "none" ? "no multiple-comparison correction." : "a " + state.design.correction + " correction.");
      }
      // process phase
      const d = state.design;
      const r = state.run;
      const designScore = (d.assignment === "random" ? 1 : 0) + (d.variance === 1 ? 1 : 0) + (d.correction !== "none" ? 1 : 0);
      return "Your design scored " + designScore + "/3: " +
        (d.assignment === "random" ? "random assignment ✓" : "biased assignment ✗") + ", " +
        (d.variance === 1 ? "baseline adjustment ✓" : "no variance reduction ✗") + ", " +
        (d.correction !== "none" ? "correction ✓" : "no correction ✗") + ". " +
        "The true effect of " + r.change.name + " was " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) + " and you estimated " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1) + ". " +
        (designScore === 3 ? "Every tool earned its place — this is the experiment a careful practitioner runs." :
         designScore >= 1 ? "You used some of the tools. The ones you skipped each left a specific weakness." :
         "A biased split with no noise control and no correction — luck alone decides this one.");
    },
    enter(state){
      state.phase = "design";
      state.design = { changeId: null, assignment: "random", variance: 0, correction: "none", stopping: "fixed" };
      state.run = null;
      state.shipped = null;
      state.animStart = null;
      renderControls(state);
    },
    draw(c, now, state){
      if (state.phase === "design"){
        label("Traffic budget: 40 of 60 customers can be enrolled", LOGICAL_W / 2, 40, { size: 14, weight: "600", color: COLOR.ink });
        label("Pick one change to test, then your experimental tools.", LOGICAL_W / 2, 60, { size: 12.5, color: COLOR.muted });
      } else if (state.phase === "run"){
        const r = state.run;
        if (!r){ label("Run the experiment to see results.", LOGICAL_W / 2, 240, { size: 14, color: COLOR.muted }); return; }
        label(r.change.name, LOGICAL_W / 2, 36, { size: 16, weight: "600", color: COLOR.ink });
        label("control " + r.avgA.toFixed(1) + "  •  treatment " + r.avgB.toFixed(1) + "  •  gap " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1), LOGICAL_W / 2, 56, { size: 13, color: COLOR.muted });
        const baseY = 380, topY = 90, maxV = 30;
        const toY = v => baseY - (v / maxV) * (baseY - topY);
        const bw = 120;
        bar(240 - bw / 2, toY(r.avgA), bw, baseY - toY(r.avgA), COLOR.control);
        bar(560 - bw / 2, toY(r.avgB), bw, baseY - toY(r.avgB), COLOR.treatment);
        label(r.avgA.toFixed(1), 240, toY(r.avgA) - 10, { size: 14, weight: "600", color: COLOR.control });
        label(r.avgB.toFixed(1), 560, toY(r.avgB) - 10, { size: 14, weight: "600", color: COLOR.treatment });
        label("Control", 240, baseY + 22, { size: 13, color: COLOR.control });
        label("Treatment", 560, baseY + 22, { size: 13, color: COLOR.treatment });
        const verdictColor = r.significant ? COLOR.good : COLOR.muted;
        label(r.significant ? "✓ Significant gap detected" : "✕ Not significant — gap within chance", LOGICAL_W / 2, baseY + 52, { size: 14, weight: "600", color: verdictColor });
        label("true effect was " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) + " cups", LOGICAL_W / 2, baseY + 72, { size: 12, color: COLOR.muted });
      } else if (state.phase === "ship"){
        const r = state.run;
        if (state.shipped){
          const correctShip = r.change.trueEffect > 1;
          const didShip = state.shipped === "ship";
          const good = (correctShip && didShip) || (!correctShip && !didShip);
          label(good ? "✓ Good call" : "✕ Risky call", LOGICAL_W / 2, 200, { size: 28, weight: "700", color: good ? COLOR.good : COLOR.warn });
          label("True effect: " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) + " cups", LOGICAL_W / 2, 250, { size: 16, color: COLOR.muted });
          label("Your estimate: " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1) + " cups", LOGICAL_W / 2, 276, { size: 14, color: COLOR.ink });
        } else {
          label("Ship " + r.change.name + "?", LOGICAL_W / 2, 200, { size: 22, weight: "600", color: COLOR.ink });
          label("Gap: " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1) + " cups  •  " + (r.significant ? "significant" : "not significant"), LOGICAL_W / 2, 232, { size: 14, color: COLOR.muted });
        }
      } else if (state.phase === "process"){
        if (state.animStart == null) state.animStart = now;
        const p = easeOutCubic(clamp((now - state.animStart) / 900, 0, 1));
        const d = state.design;
        const items = [
          { label: "Random assignment", ok: d.assignment === "random", note: d.assignment === "random" ? "groups comparable" : "biased — head start" },
          { label: "Baseline adjustment", ok: d.variance === 1, note: d.variance === 1 ? "noise shrunk" : "full noise" },
          { label: "Multiple-comparison correction", ok: d.correction !== "none", note: d.correction !== "none" ? "false wins held back" : "false wins pass through" }
        ];
        items.forEach((it, i) => {
          const y = 120 + i * 70;
          const a = easeOutCubic(clamp((p - i * 0.1) / 0.5, 0, 1));
          label((it.ok ? "✓" : "✕") + " " + it.label, LOGICAL_W / 2, y, { size: 16, weight: "600", color: it.ok ? COLOR.good : COLOR.warn, alpha: a });
          label(it.note, LOGICAL_W / 2, y + 24, { size: 13, color: COLOR.muted, alpha: a });
        });
      }
    }
  };

  function renderControls(state){
    controlsEl.innerHTML = "";

    if (state.phase === "design"){
      renderDesign(state);
    } else if (state.phase === "run"){
      const r = state.run;
      makeBtn("🔄 Run again (new seed)", "primary", () => {
        const seed = (Math.random() * 100000) | 0;
        state.run = runExperiment(state.design, seed);
        renderControls(state);
        updateText();
      });
      makeBtn("→ Make the ship decision", "primary", () => {
        state.phase = "ship";
        state.shipped = null;
        renderControls(state);
        updateText();
      });
      makeNote("The true effect is hidden from you in a real test — here it's shown so you can see how your design did.");
    } else if (state.phase === "ship"){
      if (!state.shipped){
        makeBtn("✓ Ship it", "primary", () => { state.shipped = "ship"; renderControls(state); updateText(); });
        makeBtn("✕ Don't ship", null, () => { state.shipped = "no-ship"; renderControls(state); updateText(); });
        makeNote("Defend the design: was the split fair? was noise controlled? did you correct for the metrics you checked?");
      } else {
        makeBtn("→ Review your process", "primary", () => {
          state.phase = "process";
          state.animStart = null;
          renderControls(state);
          updateText();
        });
      }
    } else if (state.phase === "process"){
      makeNote("That's the whole campaign: decide, predict, simulate, inspect, understand, unlock. Use 'Finish mission' to complete.");
    }
  }

  function renderDesign(state){
    const d = state.design;
    const progress = Progress.get();

    const changeLabel = document.createElement("div");
    changeLabel.className = "ctrl-note";
    changeLabel.textContent = "Which change to test?";
    controlsEl.appendChild(changeLabel);
    CHANGES.forEach(ch => {
      makeBtn(ch.name, d.changeId === ch.id ? "primary selected" : null, () => {
        d.changeId = ch.id; renderControls(state);
      });
    });

    const assignLabel = document.createElement("div");
    assignLabel.className = "ctrl-note";
    assignLabel.textContent = "Assignment method";
    controlsEl.appendChild(assignLabel);
    makeBtn("Random coin flip", d.assignment === "random" ? "primary selected" : null, () => { d.assignment = "random"; renderControls(state); });
    makeBtn("Hand-pick the biggest buyers", d.assignment === "biased" ? "primary selected" : "control-color", () => { d.assignment = "biased"; renderControls(state); });

    const varLabel = document.createElement("div");
    varLabel.className = "ctrl-note";
    varLabel.textContent = "Noise reduction";
    controlsEl.appendChild(varLabel);
    const hasBaseline = progress.unlockedToolIds.includes("baseline-behavior");
    makeBtn("None", d.variance === 0 ? "primary selected" : null, () => { d.variance = 0; renderControls(state); });
    const adjBtn = makeBtn("Adjust by baseline", d.variance === 1 ? "primary selected" : null, () => { d.variance = 1; renderControls(state); });
    if (!hasBaseline){ adjBtn.disabled = true; adjBtn.title = "Unlock 'Use baseline behavior' first"; }

    const corrLabel = document.createElement("div");
    corrLabel.className = "ctrl-note";
    corrLabel.textContent = "Correction policy";
    controlsEl.appendChild(corrLabel);
    const hasMC = progress.unlockedToolIds.includes("multiple-comparisons");
    makeBtn("None", d.correction === "none" ? "primary selected" : null, () => { d.correction = "none"; renderControls(state); });
    const bhBtn = makeBtn("Benjamini-Hochberg", d.correction === "bh" ? "primary selected" : null, () => { d.correction = "bh"; renderControls(state); });
    if (!hasMC){ bhBtn.disabled = true; bhBtn.title = "Unlock 'Correct for multiple comparisons' first"; }
    const bonfBtn = makeBtn("Bonferroni", d.correction === "bonferroni" ? "primary selected" : null, () => { d.correction = "bonferroni"; renderControls(state); });
    if (!hasMC){ bonfBtn.disabled = true; bonfBtn.title = "Unlock 'Correct for multiple comparisons' first"; }

    const canRun = d.changeId != null;
    makeBtn("▶ Run the experiment", canRun ? "primary" : null, () => {
      if (!canRun) return;
      const seed = (Math.random() * 100000) | 0;
      state.run = runExperiment(d, seed);
      state.phase = "run";
      renderControls(state);
      updateText();
    });
    if (!canRun) makeNote("Pick a change to test first.");
  }

  registerChapter("final-lab", { scenes: [scene] });

})();