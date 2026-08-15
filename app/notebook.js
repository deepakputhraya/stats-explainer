"use strict";

/* Lab notebook overlay. Lists unlocked concept cards (the tool catalog),
   each with name, purpose, when-to-use, a warning, and a replay link back to
   the mission that earned it. Cards only appear once their tool is unlocked. */

(function(global){
  "use strict";

  let overlay, grid, onReplay = () => {};

  function ensure(){
    if (overlay) return overlay;
    overlay = UI.el("div", { class: "ex-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Lab notebook" });
    const header = UI.el("div", { class: "ex-overlay__header" }, [
      UI.el("h2", { class: "ex-overlay__title", text: "Lab Notebook" }),
      UI.button("Close", { kind: "ghost", ariaLabel: "Close notebook", onClick: close })
    ]);
    grid = UI.el("div", { class: "ex-notebook" });
    overlay.appendChild(header);
    overlay.appendChild(grid);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function card(tool, mission){
    const body = [
      UI.el("p", { class: "ex-tool__purpose", text: tool.purpose }),
      UI.el("p", { class: "ex-tool__when", }, [
        UI.el("b", { text: "When: " }),
        document.createTextNode(tool.when)
      ]),
      UI.el("p", { class: "ex-tool__warn" }, [
        UI.el("b", { text: "Watch out: " }),
        document.createTextNode(tool.warning)
      ])
    ];
    const footer = [];
    if (mission){
      footer.push(UI.button("Replay " + mission.title, { kind: "ghost", onClick: () => { close(); onReplay(mission.id); } }));
    }
    return UI.card({ title: tool.name, body, footer, kind: "tool" });
  }

  function render(progress){
    ensure();
    UI.clear(grid);
    const unlocked = progress.unlockedToolIds
      .map(id => Campaign.tool(id))
      .filter(Boolean);
    if (!unlocked.length){
      grid.appendChild(UI.el("p", { class: "ex-notebook__empty",
        text: "No tools unlocked yet. Complete a mission to earn your first method." }));
      return;
    }
    // preserve district order
    const ordered = Object.values(Campaign.TOOLS)
      .filter(t => progress.unlockedToolIds.includes(t.id));
    ordered.forEach(tool => {
      const mission = Campaign.MISSIONS.find(m => m.unlocks && m.unlocks.includes(tool.id));
      grid.appendChild(card(tool, mission));
    });
  }

  function open(progress){
    ensure();
    render(progress);
    overlay.classList.add("open");
    const first = grid.querySelector(".ex-card");
    if (first) A11y.focus(first);
  }
  function close(){ if (overlay) overlay.classList.remove("open"); }
  function isOpen(){ return !!(overlay && overlay.classList.contains("open")); }

  function bind(opts){ if (opts.onReplay) onReplay = opts.onReplay; }

  global.Notebook = { open, close, isOpen, render, bind };
})(window);