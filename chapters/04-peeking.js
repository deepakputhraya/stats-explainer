"use strict";

(function(){

/* -------------------------------------------------------------------- */
/* Data — a no-effect experiment, watched day by day                     */
/* -------------------------------------------------------------------- */

const DAYS = 28;
const PER_DAY = 50;
const FLAT = 1.96;          // the flat "significance line"
const RHO = 120, ALPHA = 0.18; // shape + strictness of the widening boundary
const N_RUNS = 60;

// The widening boundary: strict on day 1, gently relaxing as evidence piles up.
function boundAt(day){
  const nEff = (PER_DAY * day) / 2;
  return Math.sqrt((1 + RHO / nEff) * Math.log((nEff + RHO) / (RHO * ALPHA * ALPHA)));
}

// Both groups are drawn from the SAME distribution: there is no real effect.
function makeRun(seed){
  const rng = mulberry32(seed);
  let sumA = 0, sumB = 0, n = 0;
  const lead = [];
  for (let d = 1; d <= DAYS; d++){
    for (let i = 0; i < PER_DAY; i++){
      sumA += randNormal(rng, 0, 1);
      sumB += randNormal(rng, 0, 1);
    }
    n += PER_DAY;
    lead.push((sumB / n - sumA / n) / Math.sqrt(2 / n));
  }
  const flatIdx = lead.findIndex(v => Math.abs(v) >= FLAT);
  const funnelIdx = lead.findIndex((v, i) => Math.abs(v) >= boundAt(i + 1));
  return {
    lead,
    flatStopDay: flatIdx === -1 ? null : flatIdx + 1,
    funnelStopDay: funnelIdx === -1 ? null : funnelIdx + 1,
    endAbove: Math.abs(lead[DAYS - 1]) >= FLAT
  };
}

// Sign-flipped so this run's tempting spikes point upward, matching "orange's lead".
const DEMO = makeRun(49961);
DEMO.lead = DEMO.lead.map(v => -v);
const RUNS = [];
for (let s = 0; s < N_RUNS; s++) RUNS.push(makeRun(64 * 7919 + s * 104729));

const PEEK_WINS = RUNS.filter(r => r.flatStopDay != null).length;
const ONCE_WINS = RUNS.filter(r => r.endAbove).length;
const SEQ_WINS = RUNS.filter(r => r.funnelStopDay != null).length;
const pct = k => Math.round((100 * k) / N_RUNS) + "%";

// What each repeated-run mode counts as a "win", and when it lands.
const MODES = {
  peek:   { stopDay: r => r.flatStopDay,   win: r => r.flatStopDay != null },
  once:   { stopDay: r => DAYS,            win: r => r.endAbove },
  funnel: { stopDay: r => r.funnelStopDay, win: r => r.funnelStopDay != null }
};

/* -------------------------------------------------------------------- */
/* Local drawing helpers                                                 */
/* -------------------------------------------------------------------- */

const TL_PLOT = { x: 126, y: 40, w: 726, h: 340 };
const Y_MAX = 4.8;

function tlAxes(plot){
  const toX = d => plot.x + (d / DAYS) * plot.w;
  const toY = v => plot.y + plot.h / 2 - (clamp(v, -Y_MAX, Y_MAX) / Y_MAX) * (plot.h / 2);
  return { toX, toY };
}

// The chapter's core visual: a running "is it significant yet?" line, with a
// boundary that tweens between flat (boundaryT 0) and widening (boundaryT 1).
function drawTimeline(o){
  o = o || {};
  const plot = o.plot || TL_PLOT;
  const { toX, toY } = tlAxes(plot);
  const bT = o.boundaryT || 0;
  const dayProgress = clamp(o.dayProgress != null ? o.dayProgress : DAYS, 0, DAYS);
  const boundOn = d => lerp(FLAT, boundAt(Math.max(d, 0.6)), bT);

  // Boundary band — the "nothing surprising here" zone.
  const samples = [];
  for (let d = 1; d <= DAYS; d += 0.25) samples.push(d);
  if (samples[samples.length - 1] !== DAYS) samples.push(DAYS);

  ctx.beginPath();
  samples.forEach((d, i) => {
    const y = toY(boundOn(d));
    i === 0 ? ctx.moveTo(toX(d), y) : ctx.lineTo(toX(d), y);
  });
  for (let i = samples.length - 1; i >= 0; i--){
    const d = samples[i];
    ctx.lineTo(toX(d), toY(-boundOn(d)));
  }
  ctx.closePath();
  ctx.fillStyle = "#f4f1e8";
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Axes + zero line.
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plot.x, toY(0));
  ctx.lineTo(plot.x + plot.w, toY(0));
  ctx.stroke();

  // Boundary lines, crossfaded from flat-colored to widening-colored.
  [[COLOR.accent, 1 - bT], [COLOR.good, bT]].forEach(([color, alpha]) => {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha;
    [1, -1].forEach(sign => {
      ctx.beginPath();
      samples.forEach((d, i) => {
        const y = toY(sign * boundOn(d));
        i === 0 ? ctx.moveTo(toX(d), y) : ctx.lineTo(toX(d), y);
      });
      ctx.stroke();
    });
    ctx.restore();
  });

  // The running line, revealed up to dayProgress (last segment partial).
  const run = o.run || DEMO;
  if (dayProgress > 0){
    const whole = Math.floor(dayProgress);
    const frac = dayProgress - whole;
    ctx.save();
    ctx.strokeStyle = COLOR.treatment;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    for (let d = 1; d <= whole; d++) ctx.lineTo(toX(d), toY(run.lead[d - 1]));
    if (frac > 0 && whole < DAYS){
      const prev = whole === 0 ? 0 : run.lead[whole - 1];
      const next = run.lead[whole];
      ctx.lineTo(toX(whole + frac), toY(lerp(prev, next, frac)));
    }
    ctx.stroke();
    ctx.restore();

    for (let d = 1; d <= whole; d++){
      const v = run.lead[d - 1];
      const above = Math.abs(v) >= boundOn(d);
      ctx.beginPath();
      ctx.arc(toX(d), toY(v), above ? 5 : 3.4, 0, Math.PI * 2);
      ctx.fillStyle = above ? COLOR.warn : COLOR.treatment;
      ctx.fill();
    }
  }

  // Labels.
  ctx.fillStyle = COLOR.muted;
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  ctx.fillText("Days the experiment has been running →", plot.x + plot.w / 2, plot.y + plot.h + 34);
  ctx.save();
  ctx.translate(plot.x - 74, plot.y + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("How big orange's lead looks", 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.font = "16px FuturaHandwritten, cursive";
  ctx.fillStyle = COLOR.muted;
  ctx.fillText("no difference", plot.x + 6, toY(0) - 7);

  // Boundary label sits just under the upper boundary at its right edge.
  ctx.textAlign = "right";
  ctx.font = "600 22px FuturaHandwritten, cursive";
  ctx.fillStyle = bT > 0.5 ? COLOR.good : COLOR.accent;
  ctx.fillText(bT > 0.5 ? "the smarter line ↑" : "significance line ↑",
    plot.x + plot.w - 6, toY(boundOn(DAYS)) + 16);

  if (bT > 0.5){
    ctx.font = "italic 16px FuturaHandwritten, cursive";
    ctx.fillStyle = COLOR.good;
    ctx.globalAlpha = bT;
    ctx.textAlign = "left";
    ctx.fillText("early on: a huge gap is needed", toX(1.4), toY(boundOn(1.4)) - 10);
    ctx.textAlign = "right";
    ctx.fillText("later: the bar comes down", toX(DAYS) - 4, toY(boundOn(DAYS)) - 12);
    ctx.globalAlpha = 1;
  }

  // Live readout.
  const day = Math.floor(dayProgress);
  const cur = day >= 1 ? run.lead[day - 1] : 0;
  const crossing = day >= 1 && Math.abs(cur) >= boundOn(day);
  ctx.textAlign = "left";
  ctx.font = "600 20px FuturaHandwritten, cursive";
  ctx.fillStyle = crossing ? COLOR.warn : COLOR.muted;
  const readout = day === 0
    ? "Day 0 — no data yet"
    : "Day " + day + " — " + (crossing ? "SIGNIFICANT! 🎉" : "not significant");
  ctx.fillText(readout, plot.x, plot.y - 16);

  return { toX, toY };
}

// A grid of one dot per repeated run, landing one at a time.
function drawRunGrid(o){
  o = o || {};
  const mode = MODES[o.mode];
  const shown = clamp(o.shown != null ? o.shown : N_RUNS, 0, N_RUNS);
  const cols = 12, rows = Math.ceil(N_RUNS / cols);
  const cellW = 26, cellH = 26;
  const x0 = o.x != null ? o.x : 90;
  const y0 = o.y != null ? o.y : 60;

  ctx.textAlign = "left";
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(o.title || "60 repeats of the same no-effect experiment", x0, y0 - 14);

  for (let i = 0; i < N_RUNS; i++){
    const local = clamp(shown - i, 0, 1);
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x0 + col * cellW + cellW / 2;
    const cy = y0 + row * cellH + cellH / 2;
    if (local <= 0){
      // Empty slot — an experiment that hasn't finished running yet.
      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      continue;
    }
    const t = easeOutCubic(local);
    const win = mode.win(RUNS[i]);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(2, 8.5, t), 0, Math.PI * 2);
    ctx.fillStyle = win ? COLOR.warn : "#d8d3c6";
    ctx.globalAlpha = win ? 0.35 + 0.55 * t : 0.9 * t;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (win && t > 0.5){
      ctx.strokeStyle = COLOR.warn;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.font = "16px FuturaHandwritten, cursive";
  ctx.fillStyle = COLOR.muted;
  ctx.fillText("each circle = one experiment where nothing was actually different", x0, y0 + rows * cellH + 18);
  return { bottom: y0 + rows * cellH + 26 };
}

// Horizontal "false wins" bars with the 5% one-check baseline marked.
function drawTallyBars(bars, o){
  o = o || {};
  const x0 = o.x != null ? o.x : 200;
  const y0 = o.y != null ? o.y : 250;
  const w = o.w != null ? o.w : 520;
  const barH = 30, gap = 20;
  const scaleMax = 40; // percent at full bar width

  ctx.textAlign = "left";
  ctx.font = "18px FuturaHandwritten, cursive";
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(o.title || "How often we declared a winner (there was none)", x0, y0 - 16);

  // 5% baseline marker.
  const baseX = x0 + (5 / scaleMax) * w;
  const totalH = bars.length * barH + (bars.length - 1) * gap;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COLOR.good;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(baseX, y0 - 6);
  ctx.lineTo(baseX, y0 + totalH + 8);
  ctx.stroke();
  ctx.restore();
  ctx.font = "16px FuturaHandwritten, cursive";
  ctx.fillStyle = COLOR.good;
  ctx.fillText("5% — what one single check costs you", baseX + 6, y0 + totalH + 22);

  bars.forEach((bar, i) => {
    const by = y0 + i * (barH + gap);
    const barT = bar.t != null ? bar.t : 1;
    const shownPct = bar.pct * barT;
    const bw = clamp((shownPct / scaleMax) * w, 1, w);
    ctx.fillStyle = "#efece3";
    ctx.fillRect(x0, by, w, barH);
    ctx.fillStyle = bar.color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x0, by, bw, barH);
    ctx.globalAlpha = 1;

    ctx.textAlign = "right";
    ctx.font = "18px FuturaHandwritten, cursive";
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(bar.label, x0 - 12, by + barH / 2 + 4);

    if (barT > 0.02){
      ctx.textAlign = "left";
      ctx.font = "600 20px FuturaHandwritten, cursive";
      ctx.fillStyle = bar.color;
      ctx.fillText(Math.round(shownPct) + "%", x0 + bw + 8, by + barH / 2 + 5);
    }
  });
}

/* -------------------------------------------------------------------- */
/* Scene 1 — The Temptation                                              */
/* -------------------------------------------------------------------- */

const DAY_MS = 260;

// Shared day-ticker: tweens the newest point in, auto-advances while playing.
function tickDays(state, now){
  if (state.animStart == null) state.animStart = now;
  const raw = clamp((now - state.animStart) / DAY_MS, 0, 1);
  const t = easeOutCubic(raw);
  const progress = lerp(state.dayFrom, state.dayShown, t);
  if (raw >= 1 && state.playing && state.dayShown < DAYS){
    state.dayFrom = state.dayShown;
    state.dayShown += 1;
    state.animStart = now;
  }
  if (raw >= 1 && state.dayShown >= DAYS) state.playing = false;
  return progress;
}

function advanceDay(state){
  if (state.dayShown >= DAYS) return;
  state.dayFrom = state.dayShown;
  state.dayShown += 1;
  state.animStart = null;
}

function isCrossing(state, boundaryT){
  const d = state.dayShown;
  if (d < 1) return false;
  const b = boundaryT ? boundAt(Math.max(d, 0.6)) : FLAT;
  return Math.abs(DEMO.lead[d - 1]) >= b;
}

const scene1 = {
  title: "1. The Temptation",
  legend: [
    { color: COLOR.treatment, label: "The running readout", def: "how big orange's lead looks today; nothing is really different" },
    { color: COLOR.accent, label: "Significance line", def: "cross it and the gap looks too big to be chance" },
    { color: COLOR.warn, label: "Over the line", def: "a day the readout tempts you to declare a winner" }
  ],
  text(state){
    if (state.declared) return "You just declared a winner — and there was never anything to win. Both groups got exactly the same experience. Every wobble you saw was pure chance. The trouble is that the readout genuinely did cross the line, so stopping there felt completely justified.";
    if (state.dayShown === 0) return "An experiment is running. Behind the scenes we've rigged it so both groups get the SAME experience — there is no real difference at all. Add days one at a time and watch the “are we significant yet?” readout. The dashed line is the significance line: cross it and the gap looks too big to be chance.";
    if (isCrossing(state, 0)) return "There it is — the line is crossed and the readout says SIGNIFICANT. The 🎉 button just lit up. This is the temptation: right now, stopping and shipping feels like the obvious, responsible thing to do. Remember, nothing is actually different between the groups.";
    if (state.dayShown >= DAYS) return "Keep adding days and the wobble drifts back toward the middle. It crossed the line, then un-crossed it. If you had happened to look on one of those crossing days, you would have shipped a change that does nothing.";
    return "Keep going. The readout wanders up and down — that's just noise, since nothing is really different. Watch for the moment it crosses the dashed line.";
  },
  enter(state){
    state.dayShown = 0;
    state.dayFrom = 0;
    state.playing = false;
    state.declared = false;
    state.wasCrossing = false;
    state.animStart = null;
    renderControls1(state);
  },
  draw(c, now, state){
    const progress = tickDays(state, now);
    drawTimeline({ dayProgress: progress, boundaryT: 0, run: DEMO });

    const crossing = isCrossing(state, 0);
    if (crossing !== state.wasCrossing || state.playingRendered !== state.playing){
      state.wasCrossing = crossing;
      state.playingRendered = state.playing;
      renderControls1(state);
      updateText();
    }
    if (state.declared){
      ctx.textAlign = "center";
      ctx.font = "600 21px FuturaHandwritten, cursive";
      ctx.fillStyle = COLOR.warn;
      ctx.fillText("Declared a winner on day " + state.declaredDay + " — but nothing was different.", LOGICAL_W / 2, LOGICAL_H - 14);
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  const done = state.dayShown >= DAYS;
  makeBtn("+ Advance a day", null, () => {
    state.playing = false;
    advanceDay(state);
    renderControls1(state);
    updateText();
  }, done);
  makeBtn(state.playing ? "❙❙ Pause" : "▶ Run", "primary", () => {
    state.playing = !state.playing;
    if (state.playing && state.dayShown < DAYS) state.animStart = null;
    renderControls1(state);
    updateText();
  }, done);
  makeBtn("🎉 Declare winner", state.wasCrossing ? "treatment-color" : null, () => {
    state.playing = false;
    state.declared = true;
    state.declaredDay = state.dayShown;
    renderControls1(state);
    updateText();
  }, !state.wasCrossing);
  makeBtn("↻ Reset", null, () => {
    state.dayShown = 0; state.dayFrom = 0; state.playing = false;
    state.declared = false; state.animStart = null;
    renderControls1(state);
    updateText();
  });
  if (!state.wasCrossing && state.dayShown > 0 && !state.declared) makeNote("(the 🎉 button only lights up while the readout is over the line)");
}

/* -------------------------------------------------------------------- */
/* Scene 2 — Why It's a Trap                                             */
/* -------------------------------------------------------------------- */

const RUN_MS = 90;

// Shared repeated-runs ticker: lands one run at a time while playing.
function tickRuns(state, now){
  if (state.animStart == null) state.animStart = now;
  const elapsed = now - state.animStart;
  if (state.playing){
    const target = clamp(state.runsFrom + elapsed / RUN_MS, 0, N_RUNS);
    state.runsShown = target;
    if (target >= N_RUNS){
      state.playing = false;
      state.finished = true;
      (state.renderControls || renderRunControls)(state);
      updateText();
    }
  }
  return state.runsShown;
}

function countWins(mode, shown){
  let k = 0;
  for (let i = 0; i < Math.floor(shown); i++) if (MODES[mode].win(RUNS[i])) k++;
  return k;
}

const scene2 = {
  title: "2. Why It's a Trap",
  legend: [
    { color: COLOR.warn, label: "False win", def: "we declared a winner when nothing was different" },
    { color: "#d8d3c6", label: "No win declared", def: "this run never crossed the line" },
    { color: COLOR.good, label: "5% mark", def: "the false wins you'd expect from a single check" }
  ],
  text(state){
    if (state.runsShown === 0) return "Let's find out how often that trap springs. We'll re-run the very same no-effect experiment 60 times. Each run gets peeked at every single day, and stops the first day it crosses the line — exactly the behaviour that felt so reasonable a moment ago.";
    if (!state.finished) return "Each circle is one finished experiment. Red means we declared a winner even though nothing was different — a false win. Watch how fast the red ones pile up.";
    return "Here's the damage. If you only checked once, you'd expect about 5 false wins in 100 tries — the 5% mark. Peeking every day and stopping at the first crossing produced " + pct(PEEK_WINS) + " false wins instead. Peeking didn't change the experiment; it changed how many chances noise got to fool you.";
  },
  enter(state){
    state.mode = "peek";
    state.runsShown = 0;
    state.runsFrom = 0;
    state.playing = false;
    state.finished = false;
    state.animStart = null;
    renderRunControls(state);
  },
  draw(c, now, state){
    const shown = tickRuns(state, now);
    drawRunGrid({ mode: "peek", shown, x: 176, y: 92, title: "60 repeats — each peeked at daily, stopped at the first crossing" });
    if (shown >= 1){
      const wins = countWins("peek", shown);
      drawTallyBars([
        { label: "Peek every day", pct: (100 * wins) / N_RUNS, color: COLOR.warn }
      ], { x: 250, y: 300, w: 440, title: "False wins: " + wins + " (of " + Math.floor(shown) + " experiments finished)" });
    }
  }
};
function renderRunControls(state){
  controlsEl.innerHTML = "";
  if (state.finished){
    makeBtn("↻ Run again", null, () => {
      state.runsShown = 0; state.runsFrom = 0; state.finished = false;
      state.playing = true; state.animStart = null;
      renderRunControls(state);
      updateText();
    });
    makeNote(state.noteDone || "That's far more than the 5% you signed up for.");
  } else {
    makeBtn(state.playing ? "❙❙ Pause" : (state.runsShown > 0 ? "▶ Resume" : state.startLabel || "▶ Run 60 experiments"), "primary", () => {
      state.playing = !state.playing;
      state.runsFrom = state.runsShown;
      state.animStart = null;
      renderRunControls(state);
      updateText();
    });
  }
}

/* -------------------------------------------------------------------- */
/* Scene 3 — Fix One: Pick a Date and Wait                               */
/* -------------------------------------------------------------------- */

const scene3 = {
  title: "3. Fix One: Pick a Date and Wait",
  legend: [
    { color: COLOR.warn, label: "Peeking every day", def: "the inflated tally from Scene 2, kept for comparison" },
    { color: COLOR.good, label: "Checking once", def: "one look on the agreed end date, no early peeking" },
    { color: "#d8d3c6", label: "No win declared", def: "wobbled over the line mid-month, but nobody was watching" }
  ],
  text(state){
    if (state.runsShown === 0) return "Here's the boring fix. Before starting, commit to an end date — day 28 — and simply do not check significance before it arrives. No early peeking. Same 60 no-effect experiments, same noise, same line. The only change is that each run now gets exactly ONE check, right at the end.";
    if (!state.finished) return "Notice how much less red there is. Most runs wobbled over the line at some point during the month — but nobody was watching, so those wobbles cost nothing.";
    return "One check, " + pct(ONCE_WINS) + " false wins — right back down to the 5% you expected. The red bar above it is Scene 2's peeking result, unchanged, for comparison. Same data, same threshold; the only difference is how many chances you gave yourself to be fooled.";
  },
  enter(state){
    state.runsShown = 0;
    state.runsFrom = 0;
    state.playing = false;
    state.finished = false;
    state.animStart = null;
    state.startLabel = "▶ Run 60 experiments (one check each)";
    state.noteDone = "Cheap, effective, and it forbids early peeking entirely.";
    renderRunControls(state);
  },
  draw(c, now, state){
    const shown = tickRuns(state, now);
    drawRunGrid({ mode: "once", shown, x: 176, y: 84, title: "60 repeats — each checked once, on day 28 only" });
    const wins = countWins("once", shown);
    drawTallyBars([
      { label: "Before: peek every day", pct: (100 * PEEK_WINS) / N_RUNS, color: COLOR.warn },
      { label: "After: check once at the end", pct: (100 * wins) / N_RUNS, color: COLOR.good, t: shown >= 1 ? 1 : 0 }
    ], { x: 268, y: 292, w: 420, title: "Before / after — false wins out of 60" });
  }
};

/* -------------------------------------------------------------------- */
/* Scene 4 — Fix Two: A Line That Widens                                 */
/* -------------------------------------------------------------------- */

const scene4 = {
  title: "4. Fix Two: A Smarter Line",
  legend: [
    { color: COLOR.treatment, label: "The running readout", def: "same wobbles as Scene 1, same no-effect experiment" },
    { color: COLOR.accent, label: "Old flat line", def: "one fixed bar, no matter how long you've watched" },
    { color: COLOR.good, label: "Smarter boundary", def: "strict early, more forgiving later — safe to check any day" },
    { color: COLOR.warn, label: "False win", def: "a run that still crossed and declared a winner" }
  ],
  text(state){
    if (state.phase === "flat") return "Committing to one date works, but it's painful: you can't react to anything early. So here's the other fix. Keep the daily peeking — but change the line. Watch what happens to the same run from Scene 1.";
    if (state.phase === "morph") return "The flat line is being replaced by a curved boundary. On day 1 it sits very high: with barely any data, only an enormous gap should convince you. As the days pile up it settles downward, because by then a gap of that size really would be surprising. In plain words: a smarter line that gets more forgiving the longer you've been watching, so early wobbles don't fool you — yet you're still allowed to check any day you like.";
    if (state.phase === "funnel") return "Same wobbles, same daily peeking, no crossing. The red points are gone: every one of those tempting spikes now sits comfortably below the boundary, because the boundary knew you'd be looking every day. Replay the days to watch it hold.";
    if (state.phase === "trickle") return "Peek as often as you want. The boundary is doing the work of keeping you honest, so the wobbles that fooled you in Scene 1 no longer clear the bar.";
    if (!state.finished) return "Now the real test: all 60 no-effect experiments again, peeked at every single day, stopping the first time the smarter boundary is crossed.";
    return "Peeking every day, and still only " + pct(SEQ_WINS) + " false wins — right at the 5% baseline, matching the commit-to-a-date fix while letting you look whenever you like. That's the trade the smarter boundary buys you.";
  },
  enter(state){
    state.phase = "flat";
    state.boundaryT = 0;
    state.animStart = null;
    state.dayShown = DAYS;
    state.dayFrom = DAYS;
    state.playing = false;
    state.runsShown = 0;
    state.runsFrom = 0;
    state.finished = false;
    state.renderControls = renderControls4;
    renderControls4(state);
  },
  draw(c, now, state){
    if (state.phase === "tally"){
      const shown = tickRuns(state, now);
      drawRunGrid({ mode: "funnel", shown, x: 176, y: 84, title: "60 repeats — peeked at daily, against the smarter boundary" });
      const wins = countWins("funnel", shown);
      drawTallyBars([
        { label: "Flat line, peek daily", pct: (100 * PEEK_WINS) / N_RUNS, color: COLOR.warn },
        { label: "Smarter line, peek daily", pct: (100 * wins) / N_RUNS, color: COLOR.good, t: shown >= 1 ? 1 : 0 }
      ], { x: 268, y: 292, w: 420, title: "False wins out of 60 — same peeking, different line" });
      return;
    }

    if (state.phase === "morph"){
      if (state.animStart == null) state.animStart = now;
      const t = easeInOutCubic(clamp((now - state.animStart) / 1100, 0, 1));
      state.boundaryT = t;
      if (t >= 1){
        state.phase = "funnel";
        state.animStart = null;
        renderControls4(state);
        updateText();
      }
    }

    const progress = state.phase === "trickle" ? tickDays(state, now) : state.dayShown;
    drawTimeline({ dayProgress: progress, boundaryT: state.boundaryT, run: DEMO });

    if (state.phase === "trickle" && !state.playing && state.dayShown >= DAYS && !state.trickleDone){
      state.trickleDone = true;
      renderControls4(state);
      updateText();
    }
  }
};
function renderControls4(state){
  controlsEl.innerHTML = "";
  if (state.phase === "flat"){
    makeBtn("Swap in a smarter boundary", "primary", () => {
      state.phase = "morph";
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
    makeNote("Red points = days this no-effect run looked “significant”.");
  } else if (state.phase === "morph"){
    makeNote("Reshaping the line…");
  } else if (state.phase === "funnel" || state.phase === "trickle"){
    makeBtn("▶ Replay the days", null, () => {
      state.phase = "trickle";
      state.dayShown = 0;
      state.dayFrom = 0;
      state.trickleDone = false;
      state.playing = true;
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
    makeBtn("Now repeat it 60 times →", "primary", () => {
      state.phase = "tally";
      state.runsShown = 0;
      state.runsFrom = 0;
      state.finished = false;
      state.playing = true;
      state.animStart = null;
      renderControls4(state);
      updateText();
    });
  } else if (state.phase === "tally"){
    if (state.finished){
      makeNote("Peek all you like — the boundary was built to be checked every day.");
    } else {
      makeNote("Running 60 experiments against the smarter boundary…");
    }
  }
}

/* -------------------------------------------------------------------- */
/* Scene 5 — Recap + Bridge                                              */
/* -------------------------------------------------------------------- */

const scene5 = {
  title: "5. Recap",
  legend: [
    { color: COLOR.warn, label: "Peeking at a flat line", def: "every extra look is another chance to be fooled" },
    { color: COLOR.good, label: "Either honest fix", def: "check once on a fixed date, or use a boundary built for peeking" }
  ],
  text(state){
    if (!state.revealed) return "Three ways to run the very same no-effect experiment, side by side. Reveal the tally one more time.";
    return "Peeking at a flat line inflates false positives, because every extra look is another chance for noise to cross it. Two honest fixes: commit to checking once on a fixed date, or use a boundary designed to be checked any time. Peeking too often on ONE metric is one trap. Checking too MANY metrics once is another — that's next.";
  },
  enter(state){
    state.revealed = false;
    state.animStart = null;
    renderControls5(state);
  },
  draw(c, now, state){
    let t = 0;
    if (state.revealed){
      if (state.animStart == null) state.animStart = now;
      t = easeOutCubic(clamp((now - state.animStart) / 1000, 0, 1));
    }
    drawTallyBars([
      { label: "Peek daily, flat line", pct: (100 * PEEK_WINS) / N_RUNS, color: COLOR.warn, t },
      { label: "Check once on a fixed date", pct: (100 * ONCE_WINS) / N_RUNS, color: COLOR.good, t },
      { label: "Peek daily, smarter line", pct: (100 * SEQ_WINS) / N_RUNS, color: COLOR.good, t }
    ], { x: 292, y: 130, w: 400, title: "False wins out of 60 experiments where nothing was different" });

    ctx.textAlign = "center";
    ctx.font = "18px FuturaHandwritten, cursive";
    ctx.fillStyle = COLOR.muted;
    ctx.fillText("Next up — Chapter 5: one metric checked many times is not the only trap.", LOGICAL_W / 2, LOGICAL_H - 26);
  }
};
function renderControls5(state){
  controlsEl.innerHTML = "";
  if (!state.revealed){
    makeBtn("Show the three tallies", "primary", () => {
      state.revealed = true;
      state.animStart = null;
      renderControls5(state);
      updateText();
    });
  } else {
    makeNote("Either check once, or use a line built for repeated checking. Up next: Multiple Testing.");
  }
}

registerChapter("04-peeking", {
  scenes: [scene1, scene2, scene3, scene4, scene5]
});

})();
