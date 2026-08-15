"use strict";

/* Free Lab: a sandbox unlocked after the campaign. Players combine unlocked
   tools without a prescribed path — pick a change, pick tools, run, inspect.
   Shares the final-lab's simulation engine via a lightweight re-implementation
   so it stays self-contained and doesn't depend on chapter loading order. */

(function(global){
  "use strict";

  let overlay, onReplay = () => {};
  let design = { changeId: null, assignment: "random", variance: 0, correction: "none" };
  let lastRun = null;

  const CHANGES = [
    { id: "sign",   name: "New chalkboard sign", trueEffect: 4.2 },
    { id: "recipe", name: "Sweeter recipe",     trueEffect: 0.3 },
    { id: "layout", name: "New counter layout", trueEffect: -1.0 }
  ];

  function runExperiment(d, seed){
    const rng = mulberry32(seed);
    const change = CHANGES.find(c => c.id === d.changeId);
    const N = 60, cap = 40;
    const ids = []; for (let i = 0; i < N; i++) ids.push(i);
    const baseline = ids.map(() => clamp(randNormal(rng, 18, 5), 5, 35));
    const enrolled = ids.slice(0, cap);
    let assign;
    if (d.assignment === "random"){
      const sh = shuffle(enrolled, rng);
      const half = Math.floor(cap / 2);
      assign = Object.create(null);
      sh.forEach((id, i) => { assign[id] = i < half ? "B" : "A"; });
    } else {
      const byBase = enrolled.slice().sort((a, b) => baseline[b] - baseline[a]);
      assign = Object.create(null);
      byBase.forEach((id, i) => { assign[id] = i < 20 ? "B" : "A"; });
    }
    const outcomes = Object.create(null);
    enrolled.forEach(id => {
      const g = assign[id];
      const noise = randNormal(rng, 0, d.variance > 0 ? 5 : 3);
      const adj = d.variance > 0 ? 0 : (baseline[id] - 18) * 0.5;
      const eff = g === "B" ? change.trueEffect : 0;
      outcomes[id] = clamp(baseline[id] + eff + noise - adj, 2, 40);
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
    const sig = rarer / 200 < (d.correction === "bh" ? 0.05 : d.correction === "bonferroni" ? 0.0167 : 0.05);
    return { change, gap, avgA, avgB, significant: sig };
  }

  function isUnlocked(progress){
    return Campaign.MISSIONS.every(m => m.id !== "final-lab" || progress.completedMissionIds.includes(m.id))
      && progress.completedMissionIds.includes("final-lab");
  }

  function ensure(){
    if (overlay) return overlay;
    overlay = UI.el("div", { class: "ex-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Free Lab" });
    const header = UI.el("div", { class: "ex-overlay__header" }, [
      UI.el("h2", { class: "ex-overlay__title", text: "Free Lab" }),
      UI.button("Close", { kind: "ghost", ariaLabel: "Close Free Lab", onClick: close })
    ]);
    overlay.appendChild(header);
    overlay.appendChild(UI.el("div", { class: "ex-freelab", id: "freelabBody" }));
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function render(progress){
    ensure();
    const body = document.getElementById("freelabBody");
    UI.clear(body);
    if (!isUnlocked(progress)){
      body.appendChild(UI.el("p", { class: "ex-notebook__empty",
        text: "Free Lab unlocks after you complete The Final Lab." }));
      return;
    }

    body.appendChild(UI.el("p", { class: "ex-surface__briefing",
      text: "No prescribed path. Combine any unlocked tools, run a study, and inspect the result. The true effect is shown so you can see how your design performs." }));

    // Change selection
    body.appendChild(UI.el("p", { class: "ex-surface__hint", text: "Change to test" }));
    CHANGES.forEach(ch => {
      body.appendChild(UI.button(ch.name, {
        kind: design.changeId === ch.id ? "primary" : "ghost",
        onClick: () => { design.changeId = ch.id; render(progress); }
      }));
    });

    const progress2 = progress;
    // Assignment
    body.appendChild(UI.el("p", { class: "ex-surface__hint", text: "Assignment" }));
    body.appendChild(UI.button("Random", {
      kind: design.assignment === "random" ? "primary" : "ghost",
      onClick: () => { design.assignment = "random"; render(progress2); }
    }));
    body.appendChild(UI.button("Biased (hand-pick)", {
      kind: design.assignment === "biased" ? "primary" : "ghost",
      onClick: () => { design.assignment = "biased"; render(progress2); }
    }));

    // Variance
    body.appendChild(UI.el("p", { class: "ex-surface__hint", text: "Noise reduction" }));
    const hasBaseline = progress.unlockedToolIds.includes("baseline-behavior");
    body.appendChild(UI.button("None", {
      kind: design.variance === 0 ? "primary" : "ghost",
      onClick: () => { design.variance = 0; render(progress2); }
    }));
    const adjBtn = UI.button("Baseline adjustment", {
      kind: design.variance === 1 ? "primary" : "ghost",
      disabled: !hasBaseline,
      onClick: () => { if (hasBaseline) { design.variance = 1; render(progress2); } }
    });
    if (!hasBaseline) adjBtn.title = "Unlock 'Use baseline behavior' first";
    body.appendChild(adjBtn);

    // Correction
    body.appendChild(UI.el("p", { class: "ex-surface__hint", text: "Correction" }));
    const hasMC = progress.unlockedToolIds.includes("multiple-comparisons");
    body.appendChild(UI.button("None", {
      kind: design.correction === "none" ? "primary" : "ghost",
      onClick: () => { design.correction = "none"; render(progress2); }
    }));
    const bhBtn = UI.button("Benjamini-Hochberg", {
      kind: design.correction === "bh" ? "primary" : "ghost",
      disabled: !hasMC,
      onClick: () => { if (hasMC) { design.correction = "bh"; render(progress2); } }
    });
    if (!hasMC) bhBtn.title = "Unlock 'Correct for multiple comparisons' first";
    body.appendChild(bhBtn);

    // Run
    body.appendChild(UI.el("div", { class: "ex-surface__footer" }, [
      UI.button("▶ Run study", {
        kind: "primary",
        disabled: !design.changeId,
        onClick: () => {
          if (!design.changeId) return;
          const seed = (Math.random() * 100000) | 0;
          lastRun = runExperiment(design, seed);
          render(progress2);
        }
      })
    ]));

    // Result
    if (lastRun){
      const r = lastRun;
      const result = UI.el("div", { class: "ex-card ex-card--tool" }, [
        UI.el("h3", { class: "ex-card__title", text: r.change.name }),
        UI.el("p", { text: "Control " + r.avgA.toFixed(1) + "  •  Treatment " + r.avgB.toFixed(1) + "  •  Gap " + (r.gap >= 0 ? "+" : "") + r.gap.toFixed(1) }),
        UI.el("p", { text: (r.significant ? "✓ Significant" : "✕ Not significant") + " — true effect " + (r.change.trueEffect >= 0 ? "+" : "") + r.change.trueEffect.toFixed(1) })
      ]);
      body.appendChild(result);
    }
  }

  function open(progress){
    ensure();
    render(progress);
    overlay.classList.add("open");
  }
  function close(){ if (overlay) overlay.classList.remove("open"); }
  function isOpen(){ return !!(overlay && overlay.classList.contains("open")); }

  global.FreeLab = { open, close, isOpen, render, isUnlocked };
})(window);