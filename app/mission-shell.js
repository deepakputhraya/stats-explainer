"use strict";

/* Mission shell. Wraps an existing chapter's scenes with the campaign
   lifecycle: Briefing → Prediction → Action (the chapter's own scenes) →
   Debrief → Unlock. The shell does NOT touch how chapters render on the
   canvas or build controls; it layers briefing/debrief/unlock surfaces above
   and below the existing #stage / #controls / #narrative region.

   The engine (engine.js) drives the scene loop and scene transitions. The
   shell hooks the engine's enterScene to insert briefing before scene 0 and
   debrief/unlock after the last scene. */

(function(global){
  "use strict";

  const PHASE = { BRIEFING: "briefing", PREDICTION: "prediction", ACTION: "action",
                  DEBRIEF: "debrief", UNLOCK: "unlock", COMPLETE: "complete" };

  let activeMission = null;
  let phase = null;
  let surface, surfaceTitle, surfaceBody, surfaceFooter;
  let onComplete = () => {};

  function ensure(){
    if (surface) return surface;
    surface = UI.el("div", { class: "ex-surface", role: "region", "aria-label": "Mission stage" });
    surfaceTitle = UI.el("h2", { class: "ex-surface__title" });
    surfaceBody = UI.el("div", { class: "ex-surface__body" });
    surfaceFooter = UI.el("div", { class: "ex-surface__footer" });
    surface.appendChild(surfaceTitle);
    surface.appendChild(surfaceBody);
    surface.appendChild(surfaceFooter);
    document.body.appendChild(surface);
    return surface;
  }

  function show(){
    ensure();
    surface.classList.add("open");
  }
  function hide(){ if (surface) surface.classList.remove("open"); }

  function clearSurface(){
    UI.clear(surfaceBody);
    UI.clear(surfaceFooter);
    // Re-trigger the fade-up animation so each phase transitions smoothly.
    [surfaceTitle, surfaceBody, surfaceFooter].forEach(el => {
      if (!el) return;
      el.classList.remove("ex-fade-up");
      void el.offsetWidth;
      el.classList.add("ex-fade-up");
    });
  }

  function start(mission){
    activeMission = mission;
    phase = PHASE.BRIEFING;
    Progress.setCurrentMission(mission.id);
    if (global.HUD) HUD.render(mission);
    renderBriefing();
  }

  function renderBriefing(){
    show();
    clearSurface();
    surfaceTitle.textContent = activeMission.title;
    const meta = UI.el("p", { class: "ex-surface__meta" }, [
      UI.el("span", { class: "ex-surface__objective", text: activeMission.objective }),
      UI.el("span", { class: "ex-surface__time", text: "· ~" + activeMission.estimatedMinutes + " min" })
    ]);
    surfaceBody.appendChild(meta);
    surfaceBody.appendChild(UI.el("p", { class: "ex-surface__briefing", text: activeMission.briefing }));

    const hasPrediction = activeMission.prediction && activeMission.prediction.choices.length;
    surfaceFooter.appendChild(UI.button(hasPrediction ? "Begin →" : "Start the experiment →",
      { kind: "primary", onClick: () => hasPrediction ? renderPrediction() : beginAction() }));
    A11y.focus(surfaceFooter.querySelector("button"));
    A11y.announce(activeMission.title + ". " + activeMission.briefing);
  }

  function renderPrediction(){
    phase = PHASE.PREDICTION;
    clearSurface();
    surfaceTitle.textContent = "Predict: " + activeMission.title;
    surfaceBody.appendChild(UI.el("p", { class: "ex-surface__prompt", text: activeMission.prediction.prompt }));
    surfaceBody.appendChild(UI.el("p", { class: "ex-surface__hint", text: "Your guess won't be judged — it just commits you before the reveal." }));

    const choices = UI.el("div", { class: "ex-choices" });
    let chosen = null;
    activeMission.prediction.choices.forEach(c => {
      const b = UI.button(c.label, { kind: "choice", onClick: () => {
        chosen = c.id;
        choices.querySelectorAll("button").forEach(x => x.classList.remove("ex-btn--selected"));
        b.classList.add("ex-btn--selected");
        confirmBtn.disabled = false;
      }});
      choices.appendChild(b);
    });
    surfaceBody.appendChild(choices);

    const confirmBtn = UI.button("Lock in & start →", { kind: "primary", disabled: true, onClick: () => {
      if (chosen != null) Progress.recordPrediction(activeMission.id, chosen);
      beginAction();
    }});
    surfaceFooter.appendChild(confirmBtn);
    A11y.focus(choices.querySelector("button"));
    A11y.announce(activeMission.prediction.prompt);
  }

  function beginAction(){
    phase = PHASE.ACTION;
    hide();
    // Hand control to the engine's existing scene loop.
    if (global.Engine && Engine.enterMission) Engine.enterMission(activeMission);
  }

  // Called by the engine when the chapter's last scene is finished.
  function finishAction(){
    if (!activeMission) return;
    phase = PHASE.DEBRIEF;
    renderDebrief();
  }

  function renderDebrief(){
    show();
    clearSurface();
    const d = activeMission.debrief;
    surfaceTitle.textContent = "Debrief";
    surfaceBody.appendChild(UI.el("p", { class: "ex-debrief__headline", text: d.headline }));
    surfaceBody.appendChild(UI.el("p", { class: "ex-debrief__explain", text: d.explanation }));
    surfaceBody.appendChild(UI.el("p", { class: "ex-debrief__term" }, [
      UI.el("b", { text: "Formal term: " }), document.createTextNode(d.term)
    ]));
    surfaceBody.appendChild(UI.el("p", { class: "ex-debrief__rule" }, [
      UI.el("b", { text: "Rule: " }), document.createTextNode(d.rule)
    ]));

    surfaceFooter.appendChild(UI.button("Continue →", { kind: "primary", onClick: renderUnlock }));
    A11y.focus(surfaceFooter.querySelector("button"));
    A11y.announce(d.headline);
  }

  function renderUnlock(){
    phase = PHASE.UNLOCK;
    clearSurface();
    surfaceTitle.textContent = "Unlocked";
    const toolIds = activeMission.unlocks || [];
    if (toolIds.length){
      toolIds.forEach(id => Progress.unlockTool(id));
      const tools = toolIds.map(Campaign.tool).filter(Boolean);
      tools.forEach(t => {
        surfaceBody.appendChild(UI.el("div", { class: "ex-unlock" }, [
          UI.el("span", { class: "ex-unlock__icon", "aria-hidden": "true", text: "🔓" }),
          UI.el("div", { class: "ex-unlock__text" }, [
            UI.el("h3", { class: "ex-unlock__name", text: t.name }),
            UI.el("p", { text: t.purpose })
          ])
        ]));
        A11y.announce("Unlocked " + t.name);
      });
    } else {
      surfaceBody.appendChild(UI.el("p", { class: "ex-surface__briefing", text: "No new tool — but you've sharpened what you already have." }));
    }

    Progress.complete(activeMission.id);
    phase = PHASE.COMPLETE;

    const next = Campaign.nextRecommended(Progress.get().completedMissionIds);
    const footer = [];
    if (next){
      footer.push(UI.button("Next: " + next.title + " →", { kind: "primary", onClick: () => { hide(); start(next); } }));
    } else {
      footer.push(UI.button("Open the map →", { kind: "primary", onClick: () => { hide(); onComplete(); } }));
    }
    footer.push(UI.button("Replay this mission", { kind: "ghost", onClick: () => { hide(); start(activeMission); } }));
    footer.push(UI.button("Replay (new seed)", { kind: "ghost", onClick: () => { hide(); global.__replaySeed = (Math.random() * 1e9) | 0; start(activeMission); } }));
    footer.forEach(b => surfaceFooter.appendChild(b));
    A11y.focus(surfaceFooter.querySelector("button"));
  }

  // Set the active mission + ACTION phase without showing briefing. Used by
  // the engine's hash-resume path so finishAction() has a mission to debrief.
  function resumeActive(mission){
    activeMission = mission;
    phase = PHASE.ACTION;
    if (global.HUD) HUD.render(mission);
  }

  function setPhase(p){ phase = p; }
  function getPhase(){ return phase; }
  function getActive(){ return activeMission; }

  function bind(opts){ if (opts.onComplete) onComplete = opts.onComplete; }

  global.MissionShell = {
    PHASE, start, finishAction, resumeActive, setPhase, getPhase, getActive, bind,
    show, hide
  };
})(window);