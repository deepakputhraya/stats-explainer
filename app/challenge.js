"use strict";

/* Optional challenge wrapper. A challenge is a self-imposed constraint on a
   mission (e.g. "decide in one peek", "match a target false-discovery rate").
   Completion is tracked but never required for progress. The wrapper renders a
   small inline panel inside the mission shell, not a separate overlay. */

(function(global){
  "use strict";

  // Challenge catalog keyed by mission id. Each defines a prompt and an
  // inline verifier the mission can call. Challenges are opt-in.
  const CHALLENGES = {
    "04-peeking": {
      id: "peeking-one-look",
      prompt: "Commit to a single peek and stick to it.",
      verify(state){ return state && state.peeks <= 1 && state.committed; }
    },
    "05-multiple-testing": {
      id: "mtight-fdr",
      prompt: "Hold the false-discovery rate under 10%.",
      verify(state){ return state && state.fdr != null && state.fdr <= 0.1; }
    },
    "08-bandits": {
      id: "bandit-regret",
      prompt: "Beat the equal split on total cups earned.",
      verify(state){ return state && state.earned != null && state.baseline != null && state.earned > state.baseline; }
    }
  };

  function forMission(missionId){ return CHALLENGES[missionId] || null; }

  function complete(missionId, state){
    const c = forMission(missionId);
    if (!c || !c.verify) return false;
    try { return !!c.verify(state); } catch (e) { return false; }
  }

  function mark(missionId){
    const c = forMission(missionId);
    if (c) Progress.completeChallenge(c.id);
  }

  // Inline panel rendered into the mission shell footer area.
  function panel(missionId, state, onStatus){
    const c = forMission(missionId);
    if (!c) return null;
    const wrap = UI.el("div", { class: "ex-challenge" }, [
      UI.el("span", { class: "ex-challenge__icon", "aria-hidden": "true", text: "★" }),
      UI.el("span", { class: "ex-challenge__prompt", text: "Challenge: " + c.prompt })
    ]);
    const done = Progress.get().completedChallengeIds.includes(c.id);
    if (done) wrap.appendChild(UI.el("span", { class: "ex-challenge__done", text: "✓ done" }));
    return wrap;
  }

  global.Challenge = { forMission, complete, mark, panel, CHALLENGES };
})(window);