"use strict";

/* Campaign map overlay. Shows districts and their missions as a path of
   nodes, each with state (locked/available/in-progress/complete), objective,
   estimated time, earned tool, and prerequisites. The map is opened from the
   HUD and emits `onSelect(missionId)` when a player picks an available node. */

(function(global){
  "use strict";

  let overlay, scroll, onOpen = () => {}, onSelect = () => {};

  function ensure(){
    if (overlay) return overlay;
    overlay = UI.el("div", { class: "ex-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Campaign map" });
    const header = UI.el("div", { class: "ex-overlay__header" }, [
      UI.el("h2", { class: "ex-overlay__title", text: "Campaign Map" }),
      UI.button("Close", { kind: "ghost", ariaLabel: "Close campaign map", onClick: close })
    ]);
    scroll = UI.el("div", { class: "ex-map" });
    overlay.appendChild(header);
    overlay.appendChild(scroll);

    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function missionState(mission, progress){
    const done = progress.completedMissionIds.includes(mission.id);
    if (done) return "complete";
    if (Campaign.isUnlocked(mission, progress.completedMissionIds)) return "available";
    if (progress.currentMissionId === mission.id) return "in-progress";
    return "locked";
  }

  function node(mission, progress){
    const state = missionState(mission, progress);
    const completed = progress.completedMissionIds.includes(mission.id);
    const unlocked = Campaign.isUnlocked(mission, progress.completedMissionIds);
    const tool = mission.unlocks && mission.unlocks[0] ? Campaign.tool(mission.unlocks[0]) : null;

    const body = [];
    body.push(UI.el("div", { class: "ex-node__objective", text: mission.objective }));
    body.push(UI.el("div", { class: "ex-node__time", text: "~" + mission.estimatedMinutes + " min" }));
    if (mission.prerequisites.length){
      body.push(UI.el("div", { class: "ex-node__prereqs",
        text: "Needs: " + mission.prerequisites.map(p => {
          const pm = Campaign.byId(p); return pm ? pm.title : p;
        }).join(", ")
      }));
    }
    if (tool){
      body.push(UI.el("div", { class: "ex-node__unlock" }, [
        UI.el("span", { class: "ex-node__unlock-icon", "aria-hidden": "true", text: "🔓" }),
        UI.el("span", { text: "Unlocks: " + tool.name })
      ]));
    }

    const nodeEl = UI.el("div", {
      class: "ex-node ex-node--" + state + (completed ? " ex-node--done" : ""),
      tabindex: unlocked ? "0" : "-1",
      role: unlocked ? "button" : null,
      "aria-label": mission.title + ", " + state + (completed ? ", replayable" : ""),
      onClick: unlocked ? () => { close(); onSelect(mission.id); } : null,
      onKeydown: unlocked ? (e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); close(); onSelect(mission.id); } }) : null
    }, [
      UI.el("div", { class: "ex-node__head" }, [
        UI.el("span", { class: "ex-node__state", "aria-hidden": "true",
          text: state === "complete" ? "✓" : state === "locked" ? "🔒" : state === "in-progress" ? "●" : "○" }),
        UI.el("h3", { class: "ex-node__title", text: mission.title })
      ]),
      UI.el("div", { class: "ex-node__body" }, body),
      unlocked ? UI.el("div", { class: "ex-node__cta", text: completed ? "Replay →" : "Start →" }) : null
    ].filter(Boolean));
    return nodeEl;
  }

  function render(progress){
    ensure();
    UI.clear(scroll);
    const recommended = Campaign.nextRecommended(progress.completedMissionIds);
    Campaign.DISTRICTS.forEach(d => {
      const missions = Campaign.byDistrict(d.id);
      if (!missions.length) return;
      const section = UI.el("div", { class: "ex-district" }, [
        UI.el("div", { class: "ex-district__head" }, [
          UI.el("h3", { class: "ex-district__name", text: d.name }),
          UI.el("span", { class: "ex-district__tag", text: d.tag })
        ])
      ]);
      const path = UI.el("div", { class: "ex-path" });
      missions.forEach(m => {
        const n = node(m, progress);
        if (recommended && m.id === recommended.id) n.classList.add("ex-node--next");
        path.appendChild(n);
      });
      section.appendChild(path);
      scroll.appendChild(section);
    });
  }

  function open(progress){
    ensure();
    render(progress);
    overlay.classList.add("open");
    onOpen();
    // focus the first available/recommended node for keyboard users
    const focusable = scroll.querySelector(".ex-node:not(.ex-node--locked) .ex-node__title, .ex-node[tabindex='0']");
    const target = scroll.querySelector(".ex-node--next") || scroll.querySelector(".ex-node[tabindex='0']");
    if (target) A11y.focus(target);
  }
  function close(){ if (overlay) overlay.classList.remove("open"); }
  function isOpen(){ return !!(overlay && overlay.classList.contains("open")); }

  function bind(opts){
    if (opts.onOpen) onOpen = opts.onOpen;
    if (opts.onSelect) onSelect = opts.onSelect;
  }

  global.Map = { open, close, isOpen, render, bind };
})(window);