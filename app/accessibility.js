"use strict";

/* Accessibility helpers: focus management, a live region for canvas
   outcomes, and reduced-motion detection (system + manual override). */

(function(global){
  const STORAGE_KEY = "exlab.reducedMotion";

  function systemPrefersReducedMotion(){
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Manual override: null = follow system, true = force reduce, false = force allow.
  function override(){
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  }
  function setOverride(v){
    if (v == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  }

  function reducedMotion(){
    const o = override();
    return o == null ? systemPrefersReducedMotion() : o;
  }

  // A single polite live region announcements get routed to. Created lazily.
  let region = null;
  function liveRegion(){
    if (region) return region;
    region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;" +
      "clip:rect(0,0,0,0);white-space:nowrap;border:0;";
    document.body.appendChild(region);
    return region;
  }
  function announce(text){
    if (!text) return;
    const r = liveRegion();
    // Re-trigger the announcement for identical strings.
    r.textContent = "";
    setTimeout(() => { r.textContent = text; }, 30);
  }

  // Move focus to an element and scroll it into view.
  function focus(el){
    if (!el) return;
    el.tabIndex = el.tabIndex < 0 ? -1 : el.tabIndex;
    el.focus({ preventScroll: false });
  }

  global.A11y = {
    systemPrefersReducedMotion,
    override,
    setOverride,
    reducedMotion,
    announce,
    focus
  };
})(window);