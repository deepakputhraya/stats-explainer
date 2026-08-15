"use strict";

/* localStorage-backed progress. One shape, one place to read/write it.
   The engine reads `Progress.get()`; missions call `Progress.complete(id)`
   and `Progress.unlockTool(id)`; the HUD/map subscribe via `Progress.onChange`. */

(function(global){
  const KEY = "exlab.progress";
  const VERSION = 1;

  const DEFAULT = {
    version: VERSION,
    completedMissionIds: [],
    unlockedToolIds: [],
    completedChallengeIds: [],
    predictions: {},            // missionId -> choice id (last prediction)
    currentMissionId: null,
    reducedMotionOverride: null  // mirror of A11y override, persisted here for fast reads
  };

  const listeners = new Set();
  let state = load();

  function load(){
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) return Object.assign({}, DEFAULT);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return migrate(parsed);
      return Object.assign({}, DEFAULT, parsed);
    } catch (e){
      return Object.assign({}, DEFAULT);
    }
  }

  function migrate(prev){
    // Future versions go here. For now: any non-matching shape resets cleanly
    // but preserves completed ids if present.
    const next = Object.assign({}, DEFAULT);
    if (prev && Array.isArray(prev.completedMissionIds)) next.completedMissionIds = prev.completedMissionIds;
    return next;
  }

  function persist(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    listeners.forEach(fn => { try { fn(state); } catch (e) {} });
  }

  function get(){ return state; }

  function set(patch){
    state = Object.assign({}, state, patch);
    persist();
  }

  function complete(missionId){
    if (!missionId) return;
    if (!state.completedMissionIds.includes(missionId)){
      state = Object.assign({}, state, {
        completedMissionIds: state.completedMissionIds.concat(missionId)
      });
      persist();
    }
  }

  function completeChallenge(challengeId){
    if (!challengeId) return;
    if (!state.completedChallengeIds.includes(challengeId)){
      state = Object.assign({}, state, {
        completedChallengeIds: state.completedChallengeIds.concat(challengeId)
      });
      persist();
    }
  }

  function unlockTool(toolId){
    if (!toolId) return;
    if (!state.unlockedToolIds.includes(toolId)){
      state = Object.assign({}, state, {
        unlockedToolIds: state.unlockedToolIds.concat(toolId)
      });
      persist();
    }
  }

  function recordPrediction(missionId, choiceId){
    if (!missionId) return;
    const predictions = Object.assign({}, state.predictions, { [missionId]: choiceId });
    set({ predictions });
  }

  function setCurrentMission(missionId){
    set({ currentMissionId: missionId });
  }

  function reset(){
    state = Object.assign({}, DEFAULT);
    persist();
  }

  function onChange(fn){
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  global.Progress = {
    get,
    set,
    complete,
    completeChallenge,
    unlockTool,
    recordPrediction,
    setCurrentMission,
    reset,
    onChange,
    VERSION
  };
})(window);