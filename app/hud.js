"use strict";

/* Persistent HUD: the always-visible top bar. Shows the current mission
   title + objective, and offers Map and Notebook. The HUD owns
   no navigation logic itself; it emits intents (open-map / open-notebook /
   open-freelab) via callbacks the shell wires up. */

(function(global){
  "use strict";

  let hud, missionLabel, objectiveLabel, actions, freeLabBtn;
  let onMap = () => {}, onNotebook = () => {}, onFreeLab = () => {};

  function ensure(){
    if (hud) return hud;
    hud = UI.el("div", { class: "ex-hud", role: "banner" });
    const left = UI.el("div", { class: "ex-hud__left" });
    const brand = UI.el("div", { class: "ex-hud__brand" }, [
      UI.el("span", { class: "ex-hud__logo", "aria-hidden": "true", text: "🍋" }),
      UI.el("span", { class: "ex-hud__title", text: "The Experiment Lab" })
    ]);
    missionLabel = UI.el("span", { class: "ex-hud__mission", text: "" });
    objectiveLabel = UI.el("span", { class: "ex-hud__objective", text: "" });
    left.appendChild(brand);
    left.appendChild(UI.el("div", { class: "ex-hud__meta" }, [missionLabel, objectiveLabel]));
    hud.appendChild(left);

    actions = UI.el("div", { class: "ex-hud__actions" });
    actions.appendChild(UI.button("Map", { kind: "ghost", id: "hudMapBtn", ariaLabel: "Open campaign map", onClick: () => onMap() }));
    actions.appendChild(UI.button("Notebook", { kind: "ghost", id: "hudNotebookBtn", ariaLabel: "Open lab notebook", onClick: () => onNotebook() }));
    freeLabBtn = UI.button("Free Lab", { kind: "ghost", id: "hudFreeLabBtn", ariaLabel: "Open Free Lab sandbox", onClick: () => onFreeLab() });
    freeLabBtn.style.display = "none";
    actions.appendChild(freeLabBtn);
    hud.appendChild(actions);

    document.body.insertBefore(hud, document.body.firstChild);
    return hud;
  }

  function render(mission){
    ensure();
    if (mission){
      missionLabel.textContent = mission.title || "";
      objectiveLabel.textContent = mission.objective ? "— " + mission.objective : "";
    } else {
      missionLabel.textContent = "";
      objectiveLabel.textContent = "";
    }
  }

  function bind(opts){
    if (opts.onMap) onMap = opts.onMap;
    if (opts.onNotebook) onNotebook = opts.onNotebook;
    if (opts.onFreeLab) onFreeLab = opts.onFreeLab;
  }

  function showFreeLab(show){
    ensure();
    if (freeLabBtn) freeLabBtn.style.display = show ? "" : "none";
  }

  global.HUD = { render, bind, ensure, showFreeLab };
})(window);