"use strict";

/* Shared DOM building blocks: cards, buttons, callouts. Works alongside the
   engine's canvas-era makeBtn/makeNote (which append into #controls); these
   are for the campaign chrome (overlays, briefing, debrief, notebook). */

(function(global){
  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, children){
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs){
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(e.style, attrs[k]);
      else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children){
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function clear(node){ if (node) node.innerHTML = ""; }

  // A button with optional primary/control/treatment accent. Returns the node.
  function button(label, opts){
    opts = opts || {};
    const b = el("button", {
      class: "ex-btn" + (opts.kind ? " ex-btn--" + opts.kind : ""),
      type: "button",
      text: label
    });
    if (opts.id) b.id = opts.id;
    if (opts.disabled) b.disabled = true;
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    if (opts.ariaLabel) b.setAttribute("aria-label", opts.ariaLabel);
    return b;
  }

  // Card container with optional title + body nodes.
  function card(opts){
    opts = opts || {};
    const c = el("div", { class: "ex-card" + (opts.kind ? " ex-card--" + opts.kind : "") });
    if (opts.id) c.id = opts.id;
    if (opts.title) c.appendChild(el("h3", { class: "ex-card__title", text: opts.title }));
    if (opts.body) c.appendChild(el("div", { class: "ex-card__body" }, opts.body));
    if (opts.footer) c.appendChild(el("div", { class: "ex-card__footer" }, opts.footer));
    return c;
  }

  // Callout block (info / warn / good).
  function callout(text, kind){
    return el("div", { class: "ex-callout" + (kind ? " ex-callout--" + kind : "") }, [
      el("p", { text })
    ]);
  }

  // Small pill/badge.
  function badge(text, kind){
    return el("span", { class: "ex-badge" + (kind ? " ex-badge--" + kind : ""), text });
  }

  // Status chip for a mission node (locked/available/in-progress/complete).
  function statusChip(state){
    const labels = {
      locked: "Locked",
      available: "Available",
      "in-progress": "In progress",
      complete: "Complete"
    };
    return badge(labels[state] || state, state);
  }

  global.UI = { el, clear, button, card, callout, badge, statusChip };
})(window);