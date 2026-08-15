"use strict";

(function(){

/* -------------------------------------------------------------------- */
/* Data                                                                  */
/* -------------------------------------------------------------------- */

const N_METRICS = 20;

const METRIC_NAMES = [
  "Signups", "Revenue", "Clicks", "Time on site", "Bounce rate",
  "Add to cart", "Checkouts", "Searches", "Shares", "Logins",
  "Support tickets", "Page views", "Scroll depth", "Video plays", "Wishlist adds",
  "App opens", "Push opt-ins", "Refunds", "Reviews", "Referrals"
];

// "Surprise score": how far a metric's result strayed from "nothing changed".
// In this chapter every metric is drawn from a null world — no real effects
// anywhere — so every high score is pure luck.
const USUAL_BAR = 1.96;
const SCORE_MAX = 3.5;

// Muted fill for metrics that came out unremarkable — deliberately duller than
// COLOR.muted so it reads as "measured, nothing to see" rather than "no data".
const PLAIN_GREY = "#a09781";

// The rising bar, rank 1 (most extreme) first. Each entry is the score a metric
// at that rank must clear. Precomputed so the drawing code stays arithmetic-free.
const RISING_BAR = [
  3.0234, 2.8070, 2.6738, 2.5758, 2.4977, 2.4324, 2.3760, 2.3263, 2.2818, 2.2414,
  2.2043, 2.1701, 2.1382, 2.1084, 2.0803, 2.0537, 2.0286, 2.0047, 1.9818, 1.9600
];

function makeRun(seed){
  const rng = mulberry32(seed);
  const scores = [];
  for (let i = 0; i < N_METRICS; i++) scores.push(Math.abs(randNormal(rng, 0, 1)));
  const revealOrder = shuffle(scores.map((s, i) => i), mulberry32(seed + 4242));
  return { scores, revealOrder };
}

function flaggedIdxs(scores){
  return scores.map((s, i) => (s >= USUAL_BAR ? i : -1)).filter(i => i >= 0);
}

// Rank order: most extreme score first.
function rankOrder(scores){
  return scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
}

// How many of the top-ranked metrics survive the rising bar. Walking from the
// bottom of the sorted list up, the deepest rank that still clears its own bar
// sets the cutoff; everything above it survives too.
function survivorCount(scores){
  const order = rankOrder(scores);
  let cutoff = 0;
  for (let k = 0; k < N_METRICS; k++){
    if (scores[order[k]] >= RISING_BAR[k]) cutoff = k + 1;
  }
  return cutoff;
}

const SCENE2_BASE = 131;      // run sequence reads 3, 2, 1, 1, 0, 3 flags
const SCENE3_SEED = 6728;     // 3 lucky flags, none survive the rising bar
const SCENE3 = makeRun(SCENE3_SEED);
const SCENE3_ORDER = rankOrder(SCENE3.scores);
const SCENE3_FLAGGED = flaggedIdxs(SCENE3.scores);

/* -------------------------------------------------------------------- */
/* Layout + drawing helpers                                              */
/* -------------------------------------------------------------------- */

const GRID = { cols: 5, x: 46, y: 54, cellW: 157, cellH: 84, cardW: 143, cardH: 66 };
const ROWS = { x: 26, y: 30, h: 20, labelW: 148, trackX: 196, trackW: 630, barH: 11 };

function gridRect(i){
  const col = i % GRID.cols, row = Math.floor(i / GRID.cols);
  return {
    x: GRID.x + col * GRID.cellW,
    y: GRID.y + row * GRID.cellH,
    w: GRID.cardW,
    h: GRID.cardH
  };
}

function rowRect(rank){
  return { x: ROWS.x, y: ROWS.y + rank * ROWS.h, w: ROWS.labelW, h: ROWS.h - 5 };
}

// Frame timestamps are not guaranteed to be monotonic relative to a stored
// start (headless virtual-time replays can hand back an earlier `now`), and a
// negative elapsed would rewind every tween to its pre-start state.
function since(state, now){
  if (state.animStart == null) state.animStart = now;
  return Math.max(0, now - state.animStart);
}

function roundRect(x, y, w, h, r){
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillRound(x, y, w, h, r, color, alpha){
  ctx.save();
  ctx.globalAlpha = alpha != null ? alpha : 1;
  ctx.fillStyle = color;
  roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function label(text, x, y, size, color, align){
  ctx.fillStyle = color;
  ctx.font = size + "px FuturaHandwritten, cursive";
  ctx.textAlign = align || "left";
  ctx.fillText(text, x, y);
}

// A metric card drawn as a rectangle that can morph between its grid slot and
// its sorted-row slot. state: "untested" | "plain" | "flagged" | "survivor".
// morph 0 = grid card, 1 = sorted row.
function drawCard(name, score, cardState, opts){
  opts = opts || {};
  const morph = opts.morph || 0;
  const g = opts.gridRect, r = opts.rowRect;
  const x = lerp(g.x, r.x, morph);
  const y = lerp(g.y, r.y, morph);
  const w = lerp(g.w, r.w, morph);
  const h = lerp(g.h, r.h, morph);
  const reveal = opts.reveal != null ? opts.reveal : 1;

  const flagged = cardState === "flagged";
  const survivor = cardState === "survivor";
  const bg = flagged ? "#f6e2df" : survivor ? "#e0efe5" : "#f2efe7";
  const stroke = flagged ? COLOR.warn : survivor ? COLOR.good : COLOR.line;

  fillRound(x, y, w, h, lerp(9, 5, morph), bg, opts.alpha != null ? opts.alpha : 1);
  ctx.save();
  ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * (flagged || survivor ? 0.9 : 0.7);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = flagged || survivor ? 1.8 : 1.2;
  roundRect(x, y, w, h, lerp(9, 5, morph));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  const nameSize = lerp(11.5, 10, morph);
  const nameY = lerp(y + 19, y + h * 0.5 + 3.5, morph);
  label(name, x + lerp(11, 8, morph), nameY, nameSize,
        flagged ? COLOR.warn : survivor ? COLOR.good : COLOR.ink);

  // Score bar: inside the card when gridded, extending along the row when sorted.
  const barX = lerp(x + 11, ROWS.trackX, morph);
  const barY = lerp(y + 40, r.y + (r.h - ROWS.barH) / 2 + 1, morph);
  const barH = lerp(8, ROWS.barH, morph);
  const fullLen = lerp(GRID.cardW - 46, ROWS.trackW, morph);
  const frac = clamp(score / SCORE_MAX, 0, 1);

  ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * 0.35;
  ctx.fillStyle = COLOR.line;
  ctx.fillRect(barX, barY, fullLen, barH);
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;

  if (cardState === "untested"){
    label("—", barX + 4, barY + barH - 0.5, 9, COLOR.muted);
  } else {
    ctx.fillStyle = flagged ? COLOR.warn : survivor ? COLOR.good : PLAIN_GREY;
    ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * 0.9;
    ctx.fillRect(barX, barY, Math.max(fullLen * frac * reveal, 1.5), barH);
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  }

  // The "usual bar" tick sits at the same score on every card.
  ctx.save();
  ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * 0.55;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tickX = barX + fullLen * (USUAL_BAR / SCORE_MAX);
  ctx.moveTo(tickX, barY - 2);
  ctx.lineTo(tickX, barY + barH + 2);
  ctx.stroke();
  ctx.restore();

  if (cardState !== "untested" && morph < 0.5){
    label(String(Math.round(score * 10)), x + w - 10, barY + barH, 10.5,
          flagged ? COLOR.warn : COLOR.muted, "right");
  }
  ctx.restore();

  if (flagged && opts.badge > 0){
    drawFlagBadge(x + w - lerp(9, 4, morph), y + lerp(9, h / 2, morph), opts.badge, morph);
  }
}

function drawFlagBadge(cx, cy, t, morph){
  const s = easeOutCubic(clamp(t, 0, 1));
  const r = lerp(9, 5.5, morph || 0) * s;
  if (r <= 0.2) return;
  ctx.save();
  ctx.globalAlpha = clamp(t, 0, 1);
  ctx.fillStyle = COLOR.warn;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold " + (r * 1.25).toFixed(1) + "px FuturaHandwritten, cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", cx, cy + 0.5);
  ctx.restore();
  ctx.textBaseline = "alphabetic";
}

function drawUsualBarLegend(y){
  label("short bar = unremarkable          longer bar = more surprising          | = the usual bar every metric must clear",
        LOGICAL_W / 2, y, 11.5, COLOR.muted, "center");
}

/* -------------------------------------------------------------------- */
/* Scene 1 — Setup                                                       */
/* -------------------------------------------------------------------- */

const scene1 = {
  title: "1. One Metric, One Chance To Be Fooled",
  legend: [
    { color: PLAIN_GREY, label: "unremarkable", def: "the result stayed inside the normal wobble" },
    { color: COLOR.warn, label: "false alarm", def: "wobbled far enough to look real, but nothing changed" }
  ],
  text(state){
    if (state.phase === "one"){
      return "Here is a single metric from a single experiment. Even when your change did absolutely nothing, the numbers still wobble. Roughly 1 time in 20 — about 5% of the time — they wobble far enough that the metric looks like a win when it isn't. That is the same 5% false-alarm rate from the last chapter, and on one metric it is a risk most teams happily accept.";
    }
    if (state.phase === "repeats"){
      return "Twenty imaginary repeats of that same one-metric test, in a world where nothing really changed. About one of them cries wolf. One bad call in twenty tries: annoying, but survivable.";
    }
    return "But almost nobody ships a change and then looks at one number. You look at signups, and revenue, and clicks, and bounce rate, and a dozen more — all from the same experiment. So here is the twist: what happens to that comfortable 5% when you are not checking one metric, but twenty?";
  },
  enter(state){
    state.phase = "one";
    state.animStart = null;
    renderControls1(state);
  },
  draw(c, now, state){
    const elapsed = since(state, now);
    const t = easeOutCubic(clamp(elapsed / 800, 0, 1));

    const nCards = state.phase === "three" ? 3 : 1;
    const cardW = 200, cardH = 96, gap = 26;
    const totalW = nCards * cardW + (nCards - 1) * gap;
    const startX = (LOGICAL_W - totalW) / 2;
    const cardY = 78;

    label("One experiment. Nothing has really changed.", LOGICAL_W / 2, 44, 13.5, COLOR.muted, "center");

    for (let i = 0; i < nCards; i++){
      // Later cards slide in slightly behind the first one.
      const stagger = clamp((elapsed - i * 180) / 800, 0, 1);
      const ti = easeOutCubic(stagger);
      const x = startX + i * (cardW + gap);
      const y = lerp(cardY + 26, cardY, ti);
      ctx.save();
      ctx.globalAlpha = ti;
      fillRound(x, y, cardW, cardH, 11, "#f2efe7", ti);
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1.4;
      roundRect(x, y, cardW, cardH, 11);
      ctx.stroke();
      label(METRIC_NAMES[i], x + 16, y + 28, 14, COLOR.ink);
      label("looked at once", x + 16, y + 47, 11.5, COLOR.muted);

      const barX = x + 16, barY = y + 62, barW = cardW - 32, barH = 11;
      ctx.globalAlpha = ti * 0.35;
      ctx.fillStyle = COLOR.line;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.globalAlpha = ti * 0.9;
      ctx.fillStyle = PLAIN_GREY;
      ctx.fillRect(barX, barY, barW * 0.34 * ti, barH);
      ctx.globalAlpha = ti * 0.55;
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const tickX = barX + barW * (USUAL_BAR / SCORE_MAX);
      ctx.moveTo(tickX, barY - 3);
      ctx.lineTo(tickX, barY + barH + 3);
      ctx.stroke();
      ctx.restore();
      label("didn't clear the bar", x + 16, y + 89, 10.5, COLOR.muted);
    }

    if (state.phase === "repeats" || state.phase === "three"){
      const stripY = 250;
      label("The same one-metric test, run 20 times in a world where nothing changed",
            LOGICAL_W / 2, stripY - 16, 12.5, COLOR.muted, "center");
      const r = 13, gapC = 34;
      const sx = (LOGICAL_W - (19 * gapC)) / 2;
      const luckyOne = 13;
      for (let i = 0; i < 20; i++){
        const st = easeOutCubic(clamp((elapsed - 200 - i * 55) / 500, 0, 1));
        if (st <= 0) continue;
        const isLucky = i === luckyOne;
        ctx.save();
        ctx.globalAlpha = st;
        ctx.beginPath();
        ctx.arc(sx + i * gapC, stripY + 16, r * st, 0, Math.PI * 2);
        ctx.fillStyle = isLucky ? COLOR.warn : "#e7e2d6";
        ctx.fill();
        ctx.restore();
      }
      const doneT = easeOutCubic(clamp((elapsed - 1300) / 600, 0, 1));
      ctx.save();
      ctx.globalAlpha = doneT;
      label("about 1 of these 20 runs shouts “significant!” purely by luck",
            LOGICAL_W / 2, stripY + 62, 12.5, COLOR.warn, "center");
      ctx.restore();
    }

    if (state.phase === "three"){
      const qT = easeOutCubic(clamp((elapsed - 900) / 700, 0, 1));
      ctx.save();
      ctx.globalAlpha = qT;
      label("… and 17 more metrics from the same experiment", LOGICAL_W / 2, 200, 13, COLOR.ink, "center");
      label("So what happens when you check them all?", LOGICAL_W / 2, 404, 15, COLOR.accent, "center");
      ctx.restore();
    }
  }
};
function renderControls1(state){
  controlsEl.innerHTML = "";
  if (state.phase === "one"){
    makeBtn("Run it 20 times", "primary", () => {
      state.phase = "repeats";
      state.animStart = null;
      renderControls1(state);
      updateText();
    });
  } else if (state.phase === "repeats"){
    makeBtn("But we never check just one metric →", "primary", () => {
      state.phase = "three";
      state.animStart = null;
      renderControls1(state);
      updateText();
    });
  } else {
    makeNote("One metric, 5% risk. Twenty metrics… let's find out.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 2 — Pile-Up                                                     */
/* -------------------------------------------------------------------- */

const RUN_MS = 1100;

const scene2 = {
  title: "2. Twenty Metrics, One Experiment",
  legend: [
    { color: COLOR.muted, label: "not measured yet", def: "waiting for you to run the experiment" },
    { color: PLAIN_GREY, label: "unremarkable", def: "didn't clear the usual bar" },
    { color: COLOR.warn, label: "false alarm", def: "cleared the bar by luck alone, since no real effect exists here" }
  ],
  text(state){
    if (!state.run){
      return "Twenty metrics from one experiment. Here is the crucial part: in this world, the change did nothing at all. Not one of these twenty metrics has any real effect. Every result you are about to see is noise. Hit run and watch what the noise alone produces.";
    }
    const n = state.flagged.length;
    const total = state.history.reduce((s, v) => s + v, 0);
    let head;
    if (n === 0) head = "This run: nothing flagged. It happens — but keep going.";
    else if (n === 1) head = "This run: 1 metric flagged as “significant.”";
    else head = "This run: " + n + " metrics flagged as “significant.”";
    let body = " Remember, none of them are real. Each metric on its own only had a 1-in-20 chance of a false alarm — but you gave luck twenty separate chances to fool you, so a run with two or three red flags is the normal outcome, not bad luck.";
    if (state.history.length > 1){
      body += " Across " + state.history.length + " runs you have collected " + total +
              " false alarms in a world where there was nothing to find.";
    }
    return head + body;
  },
  enter(state){
    state.runIdx = 0;
    state.run = null;
    state.flagged = [];
    state.history = [];
    state.animStart = null;
    renderControls2(state);
  },
  draw(c, now, state){
    label("20 metrics, one experiment, zero real effects", LOGICAL_W / 2, 32, 13.5, COLOR.muted, "center");

    let elapsed = 0;
    if (state.run){
      elapsed = since(state, now);
    }

    const revealRank = {};
    if (state.run) state.run.revealOrder.forEach((idx, r) => { revealRank[idx] = r; });

    for (let i = 0; i < N_METRICS; i++){
      const g = gridRect(i);
      if (!state.run){
        drawCard(METRIC_NAMES[i], 0, "untested", { gridRect: g, rowRect: g, morph: 0 });
        continue;
      }
      const r = revealRank[i];
      const cardT = clamp((elapsed - r * 34) / 420, 0, 1);
      const reveal = easeOutCubic(cardT);
      const isFlagged = state.run.scores[i] >= USUAL_BAR;
      const cardState = cardT <= 0 ? "untested" : (isFlagged && cardT >= 1 ? "flagged" : "plain");
      const badge = isFlagged ? clamp((elapsed - r * 34 - 420) / 320, 0, 1) : 0;
      drawCard(METRIC_NAMES[i], state.run.scores[i], cardState, {
        gridRect: g, rowRect: g, morph: 0, reveal: reveal, badge: badge
      });
    }

    drawUsualBarLegend(422);

    if (state.run){
      const tallyT = easeOutCubic(clamp((elapsed - RUN_MS) / 500, 0, 1));
      ctx.save();
      ctx.globalAlpha = tallyT;
      const n = state.flagged.length;
      const msg = n === 0
        ? "Run " + state.history.length + ": 0 false alarms this time"
        : "Run " + state.history.length + ": " + n + " false alarm" + (n === 1 ? "" : "s") + " — and nothing here is real";
      label(msg, LOGICAL_W / 2, 456, 14, n === 0 ? COLOR.muted : COLOR.warn, "center");
      ctx.restore();
    } else {
      label("nothing measured yet", LOGICAL_W / 2, 456, 13, COLOR.muted, "center");
    }
  }
};
function renderControls2(state){
  controlsEl.innerHTML = "";
  const doRun = () => {
    state.runIdx += 1;
    state.run = makeRun(SCENE2_BASE + (state.runIdx - 1) * 7919);
    state.flagged = flaggedIdxs(state.run.scores);
    state.history.push(state.flagged.length);
    state.animStart = null;
    renderControls2(state);
    updateText();
  };
  makeBtn(state.run ? "↻ Run again" : "▶ Run experiment", "primary", doRun);
  if (state.history.length >= 2){
    const total = state.history.reduce((s, v) => s + v, 0);
    makeNote("Flags per run so far: " + state.history.join(", ") + "  (total " + total + " false alarms)");
  } else if (state.run){
    makeNote("Run it a few more times — the red flags move around, but they keep coming.");
  }
}

/* -------------------------------------------------------------------- */
/* Scene 3 — The Rising Bar                                              */
/* -------------------------------------------------------------------- */

const SORT_MS = 1000;
const STAIR_MS = 1100;
const DROP_MS = 700;

const scene3 = {
  title: "3. Make The Loudest Claims Work Hardest",
  legend: [
    { color: PLAIN_GREY, label: "unremarkable", def: "nothing here needed explaining away" },
    { color: COLOR.warn, label: "false alarm", def: "flagged as a win, but only because luck got 20 tries" },
    { color: COLOR.good, label: "correctly cleared", def: "the rising bar dismissed it, which is the right call here" },
    { color: COLOR.accent, label: "the rising bar", def: "strictest at the top of the list, gentler further down" }
  ],
  text(state){
    if (state.phase === "grid"){
      return "One more run of the same nothing-happened experiment: three metrics have been flagged. The fix is not to stop looking at metrics. It is to stop judging all twenty against the same bar. Line them up from most surprising to least, and we can be smarter about it.";
    }
    if (state.phase === "sorted"){
      return "Now they are sorted: the most surprising result at the top, the dullest at the bottom. Sorting alone changes nothing yet — but it lets us ask a better question than “did this metric clear the bar?”";
    }
    if (state.phase === "staircase"){
      return "Here is the rising bar. The more metrics you check, the higher the bar the top few must clear to prove they are not just the luckiest of a large crowd. Metrics further down the list get a little more benefit of the doubt, because in a list of twenty, most of them should look unremarkable — so an ordinary-looking result that far down is exactly what you would expect either way.";
    }
    return "Apply it and the pile-up drains away. Every one of those red flags was the loudest voice in a crowd of twenty, and none of them was loud enough to earn that. Nothing survives — which is the right answer, because in this world nothing ever changed.";
  },
  enter(state){
    state.phase = "grid";
    state.animStart = null;
    renderControls3(state);
  },
  draw(c, now, state){
    const elapsed = since(state, now);

    // "sorted" tweens the grid→rows morph from its own animStart; later phases
    // start already sorted, so morph is pinned at 1.
    let morph = 0;
    if (state.phase === "sorted"){
      morph = easeInOutCubic(clamp(elapsed / SORT_MS, 0, 1));
    } else if (state.phase !== "grid"){
      morph = 1;
    }

    let stairT = 0;
    if (state.phase === "staircase" || state.phase === "filtered"){
      stairT = easeOutCubic(clamp(elapsed / STAIR_MS, 0, 1));
    }
    let dropT = 0;
    if (state.phase === "filtered"){
      dropT = easeInOutCubic(clamp((elapsed - 150) / DROP_MS, 0, 1));
    }

    if (morph < 0.5){
      label("Same experiment, same 20 metrics, still nothing real", LOGICAL_W / 2, 32, 13.5, COLOR.muted, "center");
    }

    const survivors = state.phase === "filtered" ? survivorCount(SCENE3.scores) : 0;

    // Rising bar staircase, swept in top to bottom.
    if (stairT > 0){
      const shown = stairT * N_METRICS;
      ctx.save();
      ctx.globalAlpha = clamp(stairT * 1.4, 0, 1);
      ctx.strokeStyle = COLOR.accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k < N_METRICS; k++){
        if (k > shown) break;
        const x = ROWS.trackX + ROWS.trackW * (RISING_BAR[k] / SCORE_MAX);
        const yTop = ROWS.y + k * ROWS.h - 2;
        const yBot = yTop + ROWS.h;
        const clipBot = Math.min(yBot, ROWS.y + shown * ROWS.h);
        if (k === 0) ctx.moveTo(x, yTop);
        else ctx.lineTo(x, yTop);
        ctx.lineTo(x, clipBot);
      }
      ctx.stroke();
      ctx.restore();

      const capT = easeOutCubic(clamp((elapsed - 500) / 600, 0, 1));
      ctx.save();
      ctx.globalAlpha = capT;
      label("the bar the top claim must clear →",
            ROWS.trackX + ROWS.trackW * (RISING_BAR[0] / SCORE_MAX) - 8, ROWS.y - 12, 11.5, COLOR.accent, "right");
      label("… and it eases off down here",
            ROWS.trackX + ROWS.trackW * (RISING_BAR[N_METRICS - 1] / SCORE_MAX) + 12,
            ROWS.y + N_METRICS * ROWS.h + 12, 11.5, COLOR.accent, "left");
      ctx.restore();
    }

    for (let rank = 0; rank < N_METRICS; rank++){
      const i = SCENE3_ORDER[rank];
      const g = gridRect(i);
      const r = rowRect(rank);
      const wasFlagged = SCENE3_FLAGGED.indexOf(i) >= 0;
      const survives = rank < survivors;

      let cardState = "plain";
      let badge = 0;
      if (wasFlagged){
        if (state.phase === "filtered"){
          cardState = survives ? "survivor" : (dropT >= 1 ? "plain" : "flagged");
          badge = survives ? 0 : 1 - dropT;
        } else {
          cardState = "flagged";
          badge = 1;
        }
      } else if (survives){
        cardState = "survivor";
      }

      // Cards travel to their sorted slot on a slight stagger by rank.
      const cardMorph = state.phase === "sorted"
        ? easeInOutCubic(clamp((elapsed - rank * 18) / SORT_MS, 0, 1))
        : morph;

      drawCard(METRIC_NAMES[i], SCENE3.scores[i], cardState, {
        gridRect: g, rowRect: r, morph: cardMorph, badge: badge
      });
    }

    if (morph > 0.6){
      ctx.save();
      ctx.globalAlpha = (morph - 0.6) / 0.4;
      label("most surprising", ROWS.x + 2, ROWS.y - 12, 11, COLOR.muted, "left");
      label("least surprising", ROWS.x + 2, ROWS.y + N_METRICS * ROWS.h + 14, 11, COLOR.muted, "left");
      ctx.restore();
    }

    if (state.phase === "filtered" && dropT > 0.5){
      ctx.save();
      ctx.globalAlpha = (dropT - 0.5) / 0.5;
      label(survivors === 0 ? "0 metrics survive — correct, nothing was ever real"
                            : survivors + " metric(s) survive",
            LOGICAL_W - 24, ROWS.y + N_METRICS * ROWS.h + 32, 13.5,
            survivors === 0 ? COLOR.good : COLOR.warn, "right");
      ctx.restore();
    }
  }
};
function renderControls3(state){
  controlsEl.innerHTML = "";
  if (state.phase === "grid"){
    makeBtn("Sort by how surprising they look", "primary", () => {
      state.phase = "sorted";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else if (state.phase === "sorted"){
    makeBtn("Bring in the rising bar", "primary", () => {
      state.phase = "staircase";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else if (state.phase === "staircase"){
    makeBtn("Apply it", "primary", () => {
      state.phase = "filtered";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  } else {
    makeNote("Footnote for the curious: this sorted, rising-bar method is the Benjamini-Hochberg procedure, and what it controls is called the false discovery rate.");
    makeBtn("↺ Start over", null, () => {
      state.phase = "grid";
      state.animStart = null;
      renderControls3(state);
      updateText();
    });
  }
}

/* -------------------------------------------------------------------- */
/* Scene 4 — Recap + Bridge                                              */
/* -------------------------------------------------------------------- */

const RECAP_MS = 1500;

const scene4 = {
  title: "4. Recap — And A Bigger Worry",
  legend: [
    { color: COLOR.warn, label: "false alarm", def: "what one shared bar across 20 metrics leaves you holding" },
    { color: COLOR.good, label: "all clear", def: "no flags left standing after the rising bar" },
    { color: COLOR.accent, label: "the fix", def: "sort the metrics, then raise the bar for the loudest claims" }
  ],
  text(state){
    return "Recap: checking many metrics multiplies your chances of a lucky false alarm, so a handful of red flags is the normal harvest from an experiment where nothing happened. Sorting the metrics and applying a rising bar — strictest on the loudest claim, gentler further down the list — filters most of those false alarms back out, without forcing you to stop looking at metrics you care about. Now the bigger worry. Every trap so far — noise, peeking, piling up metrics — assumed the experiment's plumbing was trustworthy: that the pipeline really did split people into fair groups and measure them honestly. What if it doesn't? That is next.";
  },
  enter(state){
    state.animStart = null;
    renderControls4(state);
  },
  draw(c, now, state){
    const elapsed = since(state, now);
    const tLeft = easeOutCubic(clamp(elapsed / 600, 0, 1));
    const tArrow = easeOutCubic(clamp((elapsed - 550) / 500, 0, 1));
    const tRight = easeOutCubic(clamp((elapsed - 850) / 650, 0, 1));
    const tBridge = easeOutCubic(clamp((elapsed - RECAP_MS) / 700, 0, 1));

    const panelW = 300, panelH = 210, gap = 74;
    const leftX = (LOGICAL_W - (panelW * 2 + gap)) / 2;
    const rightX = leftX + panelW + gap;
    const panelY = 44;

    drawMiniPanel(leftX, panelY, panelW, panelH, tLeft, {
      title: "Check 20 metrics at one bar",
      sub: "3 look “significant” — none are real",
      flags: [2, 9, 14],
      flagColor: COLOR.warn,
      footColor: COLOR.warn,
      foot: "3 false alarms"
    });

    ctx.save();
    ctx.globalAlpha = tArrow;
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 2.4;
    const ay = panelY + panelH / 2;
    const ax0 = leftX + panelW + 16, ax1 = rightX - 16;
    ctx.beginPath();
    ctx.moveTo(ax0, ay);
    ctx.lineTo(lerp(ax0, ax1, tArrow), ay);
    ctx.stroke();
    if (tArrow > 0.9){
      ctx.beginPath();
      ctx.moveTo(ax1, ay);
      ctx.lineTo(ax1 - 9, ay - 6);
      ctx.lineTo(ax1 - 9, ay + 6);
      ctx.closePath();
      ctx.fillStyle = COLOR.accent;
      ctx.fill();
    }
    label("sort +", (ax0 + ax1) / 2, ay - 22, 11.5, COLOR.accent, "center");
    label("rising bar", (ax0 + ax1) / 2, ay - 8, 11.5, COLOR.accent, "center");
    ctx.restore();

    drawMiniPanel(rightX, panelY, panelW, panelH, tRight, {
      title: "Sort, then raise the bar",
      sub: "the loudest claim must work hardest",
      flags: [],
      flagColor: COLOR.good,
      footColor: COLOR.good,
      foot: "false alarms filtered out"
    });

    ctx.save();
    ctx.globalAlpha = tBridge;
    label("Next: all of this assumed the pipeline split people fairly in the first place.",
          LOGICAL_W / 2, panelY + panelH + 66, 14.5, COLOR.ink, "center");
    label("What if it didn't?", LOGICAL_W / 2, panelY + panelH + 92, 15, COLOR.accent, "center");
    ctx.restore();
  }
};

function drawMiniPanel(x, y, w, h, t, opts){
  if (t <= 0) return;
  ctx.save();
  ctx.globalAlpha = t;
  fillRound(x, y, w, h, 13, "#f7f4ec", t);
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.4;
  roundRect(x, y, w, h, 13);
  ctx.stroke();
  label(opts.title, x + w / 2, y + 25, 13.5, COLOR.ink, "center");
  label(opts.sub, x + w / 2, y + 43, 11.5, COLOR.muted, "center");

  const cols = 5, cw = 46, ch = 22, cellGap = 8;
  const gw = cols * cw + (cols - 1) * cellGap;
  const gx = x + (w - gw) / 2, gy = y + 58;
  for (let i = 0; i < N_METRICS; i++){
    const col = i % cols, row = Math.floor(i / cols);
    const cx = gx + col * (cw + cellGap), cy = gy + row * (ch + cellGap);
    const on = opts.flags.indexOf(i) >= 0;
    const st = easeOutCubic(clamp((t * 1.6) - i * 0.02, 0, 1));
    fillRound(cx, cy, cw, ch * st, 4, on ? "#f0d5d1" : "#e9e5da", t);
    ctx.strokeStyle = on ? COLOR.warn : COLOR.line;
    ctx.lineWidth = on ? 1.6 : 1;
    roundRect(cx, cy, cw, ch * st, 4);
    ctx.stroke();
    if (on && st > 0.8){
      ctx.fillStyle = COLOR.warn;
      ctx.font = "bold 17px FuturaHandwritten, cursive";
      ctx.textAlign = "center";
      ctx.fillText("!", cx + cw / 2, cy + ch - 6);
    }
  }
  label(opts.foot, x + w / 2, y + h - 12, 12.5, opts.footColor, "center");
  ctx.restore();
}

function renderControls4(state){
  controlsEl.innerHTML = "";
  makeBtn("↻ Replay", null, () => {
    state.animStart = null;
    renderControls4(state);
    updateText();
  });
  makeNote("Up next: A/A Tests — checking whether the plumbing itself can be trusted.");
}

registerChapter("05-multiple-testing", {
  scenes: [scene1, scene2, scene3, scene4]
});

})();
