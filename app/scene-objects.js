"use strict";

/* Recurring in-world visual props and characters drawn on the canvas. These
   are the illustrated-world equivalents of statistical objects (cups, signs,
   clipboards, dashboards, customers). Shared so missions stay visually
   consistent without each reimplementing the doodles.

   All draw functions take the engine's `ctx` (and use engine globals COLOR,
   LOGICAL_W, etc.) and honor the shared paper/ink style. They are decorative
   companions to the existing canvas primitives (drawUnitGrid, drawMorphBars,
   drawScatter); they do not replace them. */

(function(global){
  "use strict";

  const FONT = 'FuturaHandwritten, cursive';

  function label(text, x, y, opts){
    opts = opts || {};
    const ctx = global.ctx;
    ctx.save();
    ctx.fillStyle = opts.color || COLOR.muted;
    ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || 12.5) + "px " + FONT;
    ctx.textAlign = opts.align || "center";
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // A lemonade cup: trapezoid body, straw, a liquid line. scale ~1 fits ~20px.
  function cup(ctx, x, y, scale, color, alpha){
    scale = scale || 1;
    const s = scale;
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 0.95;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.6 * s;
    const w = 14 * s, h = 18 * s, taper = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h);
    ctx.lineTo(x + w / 2, y - h);
    ctx.lineTo(x + w / 2 - taper, y);
    ctx.lineTo(x - w / 2 + taper, y);
    ctx.closePath();
    ctx.fillStyle = color || COLOR.control;
    ctx.fill();
    ctx.stroke();
    // liquid
    ctx.beginPath();
    const ly = y - h * 0.4;
    ctx.moveTo(x - w / 2 + 1.6 * s, ly);
    ctx.lineTo(x + w / 2 - 1.6 * s, ly);
    ctx.stroke();
    // straw
    ctx.beginPath();
    ctx.moveTo(x + w * 0.18, y - h - 4 * s);
    ctx.lineTo(x + w * 0.32, y - h * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  // A small wooden sign on a post. text is the treatment label.
  function sign(ctx, x, y, text, color, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    const w = 96, h = 34;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2;
    // post
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x, y + h / 2 + 22);
    ctx.stroke();
    // board
    ctx.fillStyle = color || COLOR.treatment;
    roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "600 18px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text || "NEW", x, y);
    ctx.restore();
  }

  // A clipboard with a tally sheet — a "metric / dashboard card" proxy.
  function clipboard(ctx, x, y, w, h, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 0.95;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#fffdf6";
    ctx.fill();
    ctx.stroke();
    // clip
    ctx.fillStyle = COLOR.muted;
    roundRectPath(ctx, x + w / 2 - 14, y - 6, 28, 10, 3);
    ctx.fill();
    ctx.stroke();
    // ruled lines
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++){
      const ly = y + (h * i) / 5;
      ctx.beginPath();
      ctx.moveTo(x + 10, ly);
      ctx.lineTo(x + w - 10, ly);
      ctx.stroke();
    }
    ctx.restore();
  }

  // A calendar strip: n days, with optional highlighted index.
  function calendarStrip(ctx, x, y, days, highlight, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    const cell = 26, gap = 6;
    const total = days * cell + (days - 1) * gap;
    const x0 = x - total / 2;
    for (let i = 0; i < days; i++){
      const cx = x0 + i * (cell + gap);
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 1.4;
      roundRectPath(ctx, cx, y, cell, cell, 5);
      ctx.fillStyle = i === highlight ? COLOR.accent : "#fffdf6";
      ctx.fill();
      ctx.stroke();
      if (i === highlight){
        ctx.fillStyle = "#fff";
      } else {
        ctx.fillStyle = COLOR.muted;
      }
      ctx.font = "600 15px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cx + cell / 2, y + cell / 2);
    }
    ctx.restore();
  }

  // Simple round-rect path helper (engine has roundRect but not exposed).
  function roundRectPath(ctx, x, y, w, h, r){
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  // A customer avatar: head + shoulders circle, with an expression color.
  function customer(ctx, x, y, r, color, alpha){
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 0.95;
    ctx.fillStyle = color || COLOR.control;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.4;
    // head
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // shoulders
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.7);
    ctx.quadraticCurveTo(x, y - r * 0.1, x + r * 0.7, y + r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  global.Props = { label, cup, sign, clipboard, calendarStrip, customer, roundRectPath };
})(window);