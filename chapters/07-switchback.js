"use strict";

(function(){

/* -------------------------------------------------------------------- */
/* Local drawing helpers                                                */
/* -------------------------------------------------------------------- */

const FONT = 'FuturaHandwritten, cursive';
function font(size, style){ ctx.font = (style ? style + " " : "") + size + "px " + FONT; }

// "C" = old policy (control), "T" = new policy (treatment)
const condColor = c => (c === "C" ? COLOR.control : COLOR.treatment);

function roundRect(x, y, w, h, r){
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function label(text, x, y, size, color, align, style){
  ctx.fillStyle = color || COLOR.muted;
  font(size || 13, style);
  ctx.textAlign = align || "center";
  ctx.fillText(text, x, y);
}

function wrapLines(text, maxW){
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

// The core visual of this chapter: a horizontal band of time windows, each
// window painted with the single condition the whole shared unit ran then.
// opts.reveal (0..1) fills windows in one by one so alternation is watchable.
function drawStrip(conds, box, opts){
  opts = opts || {};
  const n = conds.length;
  const segW = box.w / n;
  const gap = opts.gap != null ? opts.gap : 2;
  const reveal = opts.reveal != null ? opts.reveal : 1;

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  for (let i = 0; i < n; i++){
    const local = clamp(reveal * n - i, 0, 1);
    if (local <= 0) continue;
    const w = Math.max(easeOutCubic(local) * (segW - gap), 1);
    ctx.fillStyle = condColor(conds[i]);
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 0.9;
    ctx.fillRect(box.x + segW * i + gap / 2, box.y, w, box.h);
    ctx.globalAlpha = 1;
  }

  if (opts.labels){
    opts.labels.forEach((t, i) => {
      if (clamp(reveal * n - i, 0, 1) <= 0) return;
      label(t, box.x + segW * i + segW / 2, box.y + box.h + 17, 11.5, COLOR.muted);
    });
  }
}

function drawTimeAxis(box, y){
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x, y);
  ctx.lineTo(box.x + box.w, y);
  ctx.lineTo(box.x + box.w - 9, y - 4.5);
  ctx.moveTo(box.x + box.w, y);
  ctx.lineTo(box.x + box.w - 9, y + 4.5);
  ctx.stroke();
  label("time →", box.x + box.w / 2, y + 18, 12.5, COLOR.muted);
}

function drawHMeter(text, value, box, color, valueText){
  label(text, box.x - 14, box.y + box.h / 2 + 4.5, 13, COLOR.ink, "right");
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  roundRect(box.x, box.y, box.w, box.h, box.h / 2);
  ctx.stroke();
  const w = clamp(value, 0, 1) * box.w;
  if (w > 1.5){
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    roundRect(box.x, box.y, w, box.h, box.h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  label(valueText, box.x + box.w + 12, box.y + box.h / 2 + 4.5, 12.5, color, "left");
}

/* -------------------------------------------------------------------- */
/* Scene 1 — Problem: some things can't be split person by person       */
/* -------------------------------------------------------------------- */

const SEATS = 24, SEAT_COLS = 6;
const SEAT_MIX = shuffle(
  Array.from({ length: SEATS }, (_, i) => (i % 2 === 0 ? "C" : "T")),
  mulberry32(7001)
);

function seatPos(box, i){
  const cellW = box.w / SEAT_COLS;
  const cellH = box.h / (SEATS / SEAT_COLS);
  return {
    x: box.x + cellW * (i % SEAT_COLS) + cellW / 2,
    y: box.y + cellH * Math.floor(i / SEAT_COLS) + cellH / 2,
    r: Math.min(cellW, cellH) * 0.3
  };
}

function drawSeats(box, colorOf, alphaOf){
  for (let i = 0; i < SEATS; i++){
    const p = seatPos(box, i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colorOf(i);
    ctx.globalAlpha = 0.9 * (alphaOf ? alphaOf(i) : 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const scene1 = {
  title: "1. Some Things Can't Be Split",
  legend: [
    { color: COLOR.control, label: "Old price", def: "the price you already charge" },
    { color: COLOR.treatment, label: "New price", def: "the price you want to test" },
    { color: COLOR.muted, label: "Circle", def: "one customer in the room" }
  ],
  text(state){
    if (state.phase === "one")
      return "The split collapses. Whoever is in the room at 7:00 pm gets one price — there is no way to hand half of them a different number off the same menu board. The thing you can actually switch isn't a person. It's the whole place, for a stretch of time.";
    return "Every experiment so far split people one at a time: this person sees the old thing, the next sees the new thing. That works when the change lives on one person's screen. A restaurant's prices don't. Everyone who walks in at 7:00 pm reads the same menu board. Try splitting them.";
  },
  enter(state){
    state.phase = "split";
    state.animStart = null;
    renderControls1(state);
  },
  draw(c, now, state){
    const left = { x: 45, y: 96, w: 350, h: 216 };
    const right = { x: 485, y: 96, w: 350, h: 216 };

    let t = 0;
    if (state.phase === "one"){
      if (state.animStart == null) state.animStart = now;
      t = easeInOutCubic(clamp((now - state.animStart) / 1700, 0, 1));
    }
    const pMix = clamp(t / 0.45, 0, 1);
    const pOne = clamp((t - 0.5) / 0.5, 0, 1);

    // Left: person-by-person split — every circle assigned independently.
    label("Person-by-person split", left.x + left.w / 2, 74, 14, COLOR.ink, "center", "bold");
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left.x, left.y, left.w, left.h);
    ctx.restore();
    drawSeats(left, i => condColor(SEAT_MIX[i]));
    label("One app. Each person gets their own price.", left.x + left.w / 2, left.y + left.h + 26, 12.5, COLOR.muted);
    label("Works fine.", left.x + left.w / 2, left.y + left.h + 44, 12.5, COLOR.good);

    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(440, 88);
    ctx.lineTo(440, 336);
    ctx.stroke();

    // Right: one shared room — the split gets overwritten by a single policy.
    label("Everyone here, right now", right.x + right.w / 2, 74, 14, COLOR.ink, "center", "bold");
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2;
    roundRect(right.x, right.y, right.w, right.h, 10);
    ctx.stroke();
    label("ONE RESTAURANT · 7:00 pm", right.x + right.w / 2, right.y - 8, 11.5, COLOR.muted);

    drawSeats(right, () => COLOR.muted, () => 1 - pMix * 0.9);
    if (pMix > 0) drawSeats(right, i => condColor(SEAT_MIX[i]), () => pMix);
    if (pOne > 0) drawSeats(right, () => COLOR.treatment, () => pOne);

    if (pOne > 0){
      ctx.globalAlpha = pOne;
      label("The whole room runs ONE price at a time.", right.x + right.w / 2, right.y + right.h + 26, 12.5, COLOR.warn);
      label("The split can't survive.", right.x + right.w / 2, right.y + right.h + 44, 12.5, COLOR.warn);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1 - pMix;
      label("Try handing half of them a different price.", right.x + right.w / 2, right.y + right.h + 26, 12.5, COLOR.muted);
      ctx.globalAlpha = 1;
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  if (state.phase === "split"){
    makeBtn("▶ Try to split this restaurant", "primary", () => {
      state.phase = "one";
      state.animStart = null;
      renderControls1(state);
      updateText();
    });
  } else {
    makeNote("The unit you can switch is the whole restaurant — not the individual customer.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 2 — Trick: flip the whole unit, over and over                  */
/* -------------------------------------------------------------------- */

const HOURS = ["5p", "6p", "7p", "8p", "9p", "10p", "11p", "12a", "1a", "2a", "3a", "4a"];
const CONDS2 = HOURS.map((h, i) => (i % 2 === 0 ? "C" : "T"));
const BOX2 = { x: 60, y: 196, w: 760, h: 62 };
const RUN2_MS = 2600;

const scene2 = {
  title: "2. Flip the Whole Place, Over and Over",
  legend: [
    { color: COLOR.control, label: "Old-price window", def: "a stretch of time the whole place ran the old price" },
    { color: COLOR.treatment, label: "New-price window", def: "a stretch of time it ran the new price" },
    { color: COLOR.ink, label: "Playhead", def: "the clock moving through the evening" }
  ],
  text(state){
    if (state.phase === "idle")
      return "If you can't split the people, split the TIME instead. Run the old price for an hour. Then the new price for an hour. Then back. And keep flipping all night. That's a switchback test.";
    if (state.phase === "running")
      return "Each block is one window of time, painted with the single price that ran during it. Everyone who walks in during a block gets that block's price — no contradiction, no split room.";
    return "Twelve windows: six old-price hours, six new-price hours, same restaurant, same night, same staff. Now the comparison is between WINDOWS rather than between people — and the restaurant only ever ran one price at a time.";
  },
  enter(state){
    state.phase = "idle";
    state.animStart = null;
    renderControls2(state);
  },
  draw(c, now, state){
    let prog = 0;
    if (state.phase === "running"){
      if (state.animStart == null) state.animStart = now;
      prog = clamp((now - state.animStart) / RUN2_MS, 0, 1);
    } else if (state.phase === "done"){
      prog = 1;
    }

    label("One restaurant, one evening", BOX2.x + BOX2.w / 2, 60, 14, COLOR.ink, "center", "bold");

    // Customers arriving in each window inherit that window's condition.
    const segW = BOX2.w / CONDS2.length;
    CONDS2.forEach((cond, i) => {
      const local = clamp(prog * CONDS2.length - i, 0, 1);
      if (local <= 0) return;
      const a = easeOutCubic(local);
      const cx = BOX2.x + segW * i + segW / 2;
      for (let k = 0; k < 3; k++){
        ctx.beginPath();
        ctx.arc(cx + (k - 1) * 15, 158 - a * 4, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = condColor(cond);
        ctx.globalAlpha = 0.75 * a;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    label("everyone who walks in during this window…", BOX2.x + BOX2.w / 2, 128, 12, COLOR.muted);

    drawStrip(CONDS2, BOX2, { reveal: prog, labels: HOURS });
    label("…gets that window's price", BOX2.x + BOX2.w / 2, BOX2.y + BOX2.h + 40, 12, COLOR.muted);

    // Playhead: makes the strip read as time advancing, not as a static bar.
    if (state.phase === "running" && prog < 1){
      const px = BOX2.x + prog * BOX2.w;
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, BOX2.y - 14);
      ctx.lineTo(px, BOX2.y + BOX2.h + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 5, BOX2.y - 14);
      ctx.lineTo(px + 5, BOX2.y - 14);
      ctx.lineTo(px, BOX2.y - 6);
      ctx.closePath();
      ctx.fillStyle = COLOR.ink;
      ctx.fill();
    }

    drawTimeAxis(BOX2, 322);

    if (prog >= 1 && state.phase === "running"){
      state.phase = "done";
      renderControls2(state);
      updateText();
    }
  }
};
function renderControls2(state){
  controlsEl.innerHTML = "";
  if (state.phase === "idle"){
    makeBtn("▶ Run the timeline", "primary", () => {
      state.phase = "running";
      state.animStart = null;
      renderControls2(state);
      updateText();
    });
  } else if (state.phase === "running"){
    makeNote("Flipping the whole restaurant, hour by hour…");
  } else {
    makeBtn("↻ Replay", null, () => {
      state.phase = "running";
      state.animStart = null;
      renderControls2(state);
      updateText();
    });
    makeNote("6 old-price windows vs. 6 new-price windows — 12 chances to compare.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 3 — Interactive: pick your switch interval                     */
/* -------------------------------------------------------------------- */

const INTERVALS = [
  { label: "Every 15 min", segs: 32, data: 1.00, risk: 0.93,
    note: "Loads of windows — but 15 minutes is barely time for one table to finish. Whatever happened in one window is still happening in the next.",
    verdict: "warn" },
  { label: "Every hour", segs: 16, data: 0.62, risk: 0.58,
    note: "A reasonable middle. Plenty of windows to compare, and an hour is long enough for most of a dinner service to turn over — though not all of it.",
    verdict: "mid" },
  { label: "Every 4 hours", segs: 8, data: 0.34, risk: 0.26,
    note: "Each window now covers a whole shift. Almost nothing leaks across the boundary — but you only collect a handful of comparisons.",
    verdict: "mid" },
  { label: "Every day", segs: 4, data: 0.15, risk: 0.07,
    note: "Beautifully clean separation: a full day between switches. But four windows is barely an experiment — one odd rainy day could swamp the whole result.",
    verdict: "good" }
];

function condsFor(n){ return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "C" : "T")); }

const BOX3 = { x: 60, y: 116, w: 760, h: 56 };

const scene3 = {
  title: "3. How Often Should You Flip?",
  legend: [
    { color: COLOR.control, label: "Old-price window", def: "one block of old-price time" },
    { color: COLOR.treatment, label: "New-price window", def: "one block of new-price time" },
    { color: COLOR.good, label: "Comparisons collected", def: "how much data the week gives you" },
    { color: COLOR.warn, label: "Contamination risk", def: "chance one window bleeds into the next" }
  ],
  text(state){
    const opt = INTERVALS[state.idx];
    const head = state.touched ? "" : "Now you choose. How long should each window last? There's no free answer — the two things you want pull in opposite directions. ";
    return head + opt.note;
  },
  enter(state){
    state.idx = 1;
    state.prevIdx = 1;
    state.animStart = null;
    state.touched = false;
    renderControls3(state);
  },
  draw(c, now, state){
    if (state.animStart == null) state.animStart = now;
    const t = easeInOutCubic(clamp((now - state.animStart) / 850, 0, 1));
    const cur = INTERVALS[state.idx], prev = INTERVALS[state.prevIdx];

    label("One week of switching", BOX3.x + BOX3.w / 2, 62, 14, COLOR.ink, "center", "bold");
    label("(same total week — only the window length changes)", BOX3.x + BOX3.w / 2, 82, 12, COLOR.muted);

    // Wipe the new segmentation over the old, left to right.
    const wipeX = lerp(BOX3.x, BOX3.x + BOX3.w, t);
    const clipDraw = (conds, x0, x1) => {
      if (x1 - x0 <= 0.5) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, BOX3.y - 2, x1 - x0, BOX3.h + 4);
      ctx.clip();
      drawStrip(conds, BOX3, {});
      ctx.restore();
    };
    clipDraw(condsFor(cur.segs), BOX3.x, wipeX);
    clipDraw(condsFor(prev.segs), wipeX, BOX3.x + BOX3.w);
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(BOX3.x, BOX3.y, BOX3.w, BOX3.h);

    if (t < 1 && state.idx !== state.prevIdx){
      ctx.strokeStyle = COLOR.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wipeX, BOX3.y - 10);
      ctx.lineTo(wipeX, BOX3.y + BOX3.h + 10);
      ctx.stroke();
    }
    drawTimeAxis(BOX3, BOX3.y + BOX3.h + 24);

    const segs = Math.round(lerp(prev.segs, cur.segs, t));
    label(segs + " switch windows across the week", BOX3.x + BOX3.w / 2, BOX3.y + BOX3.h + 62, 13, COLOR.ink);

    const mBox = { x: 300, w: 380, h: 20 };
    const dataV = lerp(prev.data, cur.data, t);
    const riskV = lerp(prev.risk, cur.risk, t);
    drawHMeter("Comparisons collected", dataV, { x: mBox.x, y: 296, w: mBox.w, h: mBox.h },
      COLOR.good, Math.round(dataV * 100) + "%");
    drawHMeter("Contamination risk", riskV, { x: mBox.x, y: 342, w: mBox.w, h: mBox.h },
      COLOR.warn, Math.round(riskV * 100) + "%");

    const vColor = cur.verdict === "warn" ? COLOR.warn : cur.verdict === "good" ? COLOR.good : COLOR.muted;
    const vText = cur.verdict === "warn" ? "Short windows: more data, but windows bleed into each other."
      : cur.verdict === "good" ? "Long windows: clean separation, but very little data."
      : "A middle setting: decent data, some bleed.";
    label(vText, LOGICAL_W / 2, 412, 13, vColor);
  }
};
function renderControls3(state){
  controlsEl.innerHTML = "";
  INTERVALS.forEach((opt, i) => {
    makeBtn(opt.label, i === state.idx ? "primary selected" : null, () => {
      if (i === state.idx) return;
      state.prevIdx = state.idx;
      state.idx = i;
      state.touched = true;
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  });
}

/* -------------------------------------------------------------------- */
/* Scene 4 — Guard: carryover bleeding past the switch                  */
/* -------------------------------------------------------------------- */

const CONDS4 = ["C", "T", "C", "T"];
const S4 = { x: 60, w: 760, stripY: 306, stripH: 46, base: 300, peak: 186 };
const SEG4 = S4.w / CONDS4.length;
const XS4 = S4.x + SEG4;          // start of the new-price window
const XE4 = S4.x + SEG4 * 2;      // the switch back to the old price
const HALF_LIFE = { short: 9, long: 178 };

function effectAt(x, hl){
  if (x < XS4) return 0;
  if (x <= XE4) return easeOutCubic(clamp((x - XS4) / (SEG4 * 0.3), 0, 1));
  return Math.exp(-Math.LN2 * (x - XE4) / hl);
}

// Average leftover effect sitting inside window i — how polluted its reading is.
function bleedInto(i, hl){
  const a = S4.x + SEG4 * i, b = a + SEG4;
  let s = 0;
  for (let x = a; x < b; x += 2) s += effectAt(x, hl);
  return s / ((b - a) / 2);
}

const scene4 = {
  title: "4. The Guard: Carryover",
  legend: [
    { color: COLOR.control, label: "Old-price window", def: "supposed to be a clean old-price reading" },
    { color: COLOR.treatment, label: "New-price window", def: "where the effect is created" },
    { color: COLOR.warn, label: "Carryover", def: "leftover effect that leaked past the switch and pollutes the next window" }
  ],
  text(state){
    if (state.phase === "idle")
      return "One more thing can break a switchback. The clock says the window ended — but does the EFFECT end with it? Discount an hour of diners and some of them linger, tell a friend, come back tomorrow. Play the new-price window and watch what happens after the switch.";
    if (state.kind === "long")
      return "The effect doesn't stop at the boundary. It spills across the switch and sits inside the next window — which is supposed to be a clean OLD-price reading. That window now looks better than the old price really is, so the gap you measure between the two prices shrinks. The comparison is polluted.";
    return "A short-lived effect dies inside its own window. By the time the switch happens there's almost nothing left to spill, so the next window really is a clean old-price reading. This is the case where switchbacks work beautifully.";
  },
  enter(state){
    state.phase = "idle";
    state.kind = "long";
    state.prevHl = HALF_LIFE.long;
    state.animStart = null;
    renderControls4(state);
  },
  draw(c, now, state){
    let sweep = 0, hl = HALF_LIFE[state.kind];
    if (state.phase === "played"){
      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 950, 0, 1));
      sweep = state.swept ? 1 : t;
      hl = lerp(state.prevHl, HALF_LIFE[state.kind], t);
      if (t >= 1) state.swept = true;
    }

    const box = { x: S4.x, y: S4.stripY, w: S4.w, h: S4.stripH };
    const bleed2 = bleedInto(2, hl);

    label("How long does the effect actually last?", LOGICAL_W / 2, 56, 14, COLOR.ink, "center", "bold");

    // Filled effect curve: treatment-colored inside its own window,
    // warn-colored for everything that leaks past the switch.
    if (sweep > 0){
      const xEnd = lerp(XS4, S4.x + S4.w, sweep);
      const fill = (a, b, color, alpha) => {
        if (b - a <= 0.5) return;
        ctx.beginPath();
        ctx.moveTo(a, S4.base);
        for (let x = a; x <= b; x += 1.5) ctx.lineTo(x, S4.base - effectAt(x, hl) * S4.peak);
        ctx.lineTo(b, S4.base - effectAt(b, hl) * S4.peak);
        ctx.lineTo(b, S4.base);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      fill(XS4, Math.min(XE4, xEnd), COLOR.treatment, 0.4);
      fill(XE4, xEnd, COLOR.warn, 0.35);

      ctx.beginPath();
      let started = false;
      for (let x = XS4; x <= xEnd; x += 1.5){
        const y = S4.base - effectAt(x, hl) * S4.peak;
        if (!started){ ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = COLOR.treatment;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      label("effect size", XS4 - 10, S4.base - S4.peak + 4, 12, COLOR.muted, "right");
    }

    // The switch boundary the effect is supposed to respect.
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(XE4, S4.base - S4.peak - 14);
    ctx.lineTo(XE4, S4.stripY + S4.stripH + 6);
    ctx.stroke();
    ctx.restore();
    label("switch back", XE4, S4.base - S4.peak - 22, 12, COLOR.ink);

    drawStrip(CONDS4, box, {});

    // Warn tint over the old-price window the leftover effect is sitting inside.
    if (sweep > 0.05 && bleed2 > 0.02){
      ctx.fillStyle = COLOR.warn;
      ctx.globalAlpha = 0.6 * clamp(bleed2, 0, 1) * clamp((sweep - 0.05) / 0.5, 0, 1);
      ctx.fillRect(XE4 + 1, box.y, SEG4 - 2, box.h);
      ctx.globalAlpha = 1;
    }

    ["old price", "NEW PRICE", "old price", "new price"].forEach((t, i) => {
      const cx = box.x + SEG4 * i + SEG4 / 2;
      label("window " + (i + 1), cx, box.y + box.h + 18, 11.5, COLOR.ink);
      label(t, cx, box.y + box.h + 34, 11.5, COLOR.muted);
    });

    if (sweep >= 0.99){
      const pct = Math.round(bleed2 * 100);
      const bad = bleed2 > 0.2;
      label("window 3 carries " + pct + "% of the new price's effect — " +
            (bad ? "not a clean reading" : "essentially clean"),
        LOGICAL_W / 2, 424, 13, bad ? COLOR.warn : COLOR.good);
    }
  }
};
function renderControls4(state){
  controlsEl.innerHTML = "";
  if (state.phase === "idle"){
    makeBtn("▶ Play the new-price window", "primary", () => {
      state.phase = "played";
      state.swept = false;
      state.prevHl = HALF_LIFE[state.kind];
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
    return;
  }
  const pick = (kind, text) => makeBtn(text, state.kind === kind ? "primary selected" : null, () => {
    if (state.kind === kind) return;
    state.prevHl = HALF_LIFE[state.kind];
    state.kind = kind;
    state.animStart = null;
    renderControls4(state);
    updateText();
  });
  pick("long", "Long-lived effect");
  pick("short", "Short-lived effect");
  makeNote(state.kind === "long"
    ? "Red = effect that leaked past the switch and is polluting later windows."
    : "The tail dies before the boundary — later windows stay clean.");
}

/* -------------------------------------------------------------------- */
/* Scene 5 — Recap + bridge to bandits                                  */
/* -------------------------------------------------------------------- */

const RECAP = [
  { head: "Can't split people", body: "One shared unit runs one condition at a time." },
  { head: "Split time instead", body: "Flip the whole unit back and forth, window by window." },
  { head: "Mind the tail", body: "Lingering effects bleed across the switch." }
];

const scene5 = {
  title: "5. Recap — and What's Next",
  legend: [
    { color: COLOR.control, label: "Old price", def: "the condition you compare against" },
    { color: COLOR.treatment, label: "New price", def: "the condition you're testing" },
    { color: COLOR.warn, label: "Carryover", def: "lingering effect bleeding across a switch" }
  ],
  text(state){
    const recap = "Switchback tests: when you can't hand different people different versions, you flip the whole shared unit — a restaurant, a city, a warehouse — back and forth over time. Pick your window length knowing the trade: short windows buy more comparisons but let one window bleed into the next; long windows separate cleanly but give you less to compare. And always ask whether the effect really ends when the window does.";
    if (state.revealed)
      return recap + " Next up: an experiment that changes its own mind while it runs.";
    return recap;
  },
  enter(state){
    state.revealed = false;
    state.animStart = null;
    state.enterAt = null;
    renderControls5(state);
  },
  draw(c, now, state){
    if (state.enterAt == null) state.enterAt = now;
    const panelW = 250, gap = 25;
    const x0 = (LOGICAL_W - (panelW * 3 + gap * 2)) / 2;

    RECAP.forEach((r, i) => {
      const a = easeOutCubic(clamp((now - state.enterAt - i * 320) / 700, 0, 1));
      if (a <= 0) return;
      const x = x0 + (panelW + gap) * i;
      const y = 60 + (1 - a) * 14;
      ctx.globalAlpha = a;

      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      roundRect(x, y, panelW, 200, 12);
      ctx.stroke();

      const inner = { x: x + 22, y: y + 44, w: panelW - 44, h: 96 };
      if (i === 0){
        ctx.strokeStyle = COLOR.ink;
        ctx.lineWidth = 1.5;
        roundRect(inner.x, inner.y, inner.w, inner.h, 8);
        ctx.stroke();
        for (let k = 0; k < 12; k++){
          const cx = inner.x + 22 + (k % 4) * ((inner.w - 44) / 3);
          const cy = inner.y + 26 + Math.floor(k / 4) * 22;
          ctx.beginPath();
          ctx.arc(cx, cy, 7, 0, Math.PI * 2);
          ctx.fillStyle = COLOR.treatment;
          ctx.globalAlpha = a * 0.85;
          ctx.fill();
          ctx.globalAlpha = a;
        }
      } else if (i === 1){
        drawStrip(condsFor(8), { x: inner.x, y: inner.y + 30, w: inner.w, h: 38 }, { gap: 2 });
      } else {
        const mini = { x: inner.x, y: inner.y + 34, w: inner.w, h: 34 };
        drawStrip(["C", "T", "C", "T"], mini, { gap: 2 });
        const mSeg = mini.w / 4, bx = mini.x + mSeg * 2;
        ctx.fillStyle = COLOR.warn;
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect(bx + 1, mini.y, mSeg - 2, mini.h);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(mini.x + mSeg, mini.y - 8);
        for (let x = mini.x + mSeg; x <= mini.x + mini.w; x += 2){
          const v = x <= bx ? 1 : Math.exp(-Math.LN2 * (x - bx) / (mSeg * 0.9));
          ctx.lineTo(x, mini.y - 8 - v * 22);
        }
        ctx.strokeStyle = COLOR.warn;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      label(r.head, x + panelW / 2, y + 28, 13.5, COLOR.ink, "center", "bold");
      ctx.textAlign = "center";
      ctx.fillStyle = COLOR.muted;
      font(12);
      wrapLines(r.body, panelW - 36).forEach((ln, k) => ctx.fillText(ln, x + panelW / 2, y + 166 + k * 15));
      ctx.globalAlpha = 1;
    });

    if (state.revealed){
      if (state.animStart == null) state.animStart = now;
      const t = easeOutCubic(clamp((now - state.animStart) / 800, 0, 1));
      const by = lerp(320, 300, t);
      ctx.globalAlpha = t;
      ctx.strokeStyle = COLOR.accent;
      ctx.lineWidth = 2;
      roundRect(x0, by, panelW * 3 + gap * 2, 118, 12);
      ctx.stroke();
      label("NEXT — 8. Multi-Armed Bandits", LOGICAL_W / 2, by + 28, 13, COLOR.accent, "center", "bold");
      ctx.textAlign = "center";
      ctx.fillStyle = COLOR.ink;
      font(13.5);
      wrapLines("A switchback still tests one fixed recipe the whole time — switching is just how it gets a fair look. What if instead the experiment could shift more traffic toward whichever option looks better as it learns?", panelW * 3 + gap * 2 - 60)
        .forEach((ln, k) => ctx.fillText(ln, LOGICAL_W / 2, by + 56 + k * 20));
      ctx.globalAlpha = 1;
    }
  }
};
function renderControls5(state){
  controlsEl.innerHTML = "";
  if (!state.revealed){
    makeBtn("What's next? →", "primary", () => {
      state.revealed = true;
      state.animStart = null;
      renderControls5(state);
      updateText();
    });
  } else {
    makeNote("Up next: Multi-Armed Bandits — experiments that reallocate traffic while they run.");
  }
}

registerChapter("07-switchback", { scenes: [scene1, scene2, scene3, scene4, scene5] });

})();
