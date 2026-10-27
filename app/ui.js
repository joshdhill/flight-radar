/* Over Germantown — map, feeds and panels. */
(function () {
  'use strict';
  var C = window.Core, S = window.Sprites, RAD = Math.PI / 180;
  var $ = function (id) { return document.getElementById(id); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var MIL_RANGE = 250, ALERT_NM = 15;

  /* ---------- map data ---------- */
  var OSM = { wood: [], park: [], water: [], river: [], stream: [], major: [], primary: [], secondary: [], places: [], shields: [] };
  function decodeSet(arr) {
    return (arr || []).map(function (a) {
      var pts = [], la = 0, lo = 0, b = [90, -90, 180, -180];
      for (var i = 0; i < a.length; i += 2) {
        la += a[i]; lo += a[i + 1]; var y = la / 1e4, x = lo / 1e4; pts.push([y, x]);
        if (y < b[0]) b[0] = y; if (y > b[1]) b[1] = y; if (x < b[2]) b[2] = x; if (x > b[3]) b[3] = x;
      }
      pts.b = b; return pts;
    });
  }
  fetch('data/map.json').then(function (r) { return r.json(); }).then(function (raw) {
    ['wood', 'park', 'water', 'river', 'stream', 'major', 'primary', 'secondary'].forEach(function (k) { OSM[k] = decodeSet(raw[k]); });
    OSM.places = raw.places || []; OSM.shields = raw.shields || []; baseKey = '';
  }).catch(function () {});
  var AIRPORTS = [['IAD', 38.9445, -77.4558], ['DCA', 38.8521, -77.0377], ['BWI', 39.1754, -76.6683], ['GAI', 39.1684, -77.1660],
    ['FDK', 39.4176, -77.3743], ['JYO', 39.0777, -77.5570], ['ADW', 38.8108, -76.8669], ['DAA', 38.7150, -77.1810]];
  fetch('sprites/manifest.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (list) { S.loadOverrides('sprites/', list); }).catch(function () {});

  /* ---------- state ---------- */
  var state = { range: 10, panX: 0, panY: 0, selId: null, auto: true, tab: 'now', mode: 'connecting', lastData: 0, lastMil: 0, milOk: false };
  var feed = C.createLiveFeed(), tracker = C.createTracker();
  var canvas = $('map'), ctx = canvas.getContext('2d'), W = 0, H = 0, DPR = 1;
  var baseCanvas = document.createElement('canvas'), bctx = baseCanvas.getContext('2d'), baseKey = '';
  var col = {}, altRGB = [];
  (function readColors() {
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    ['land', 'land-glow', 'wood', 'park', 'water', 'river', 'road-major', 'road-primary', 'road-secondary', 'label', 'label-strong', 'ring', 'zone',
      'home', 'fg', 'fg-muted', 'fg-faint', 'mil', 'danger'].forEach(function (k) { col[k] = g('--' + k); });
    for (var i = 0; i < 7; i++) {
      var n = parseInt(g('--alt-' + i).replace('#', ''), 16);
      altRGB.push(isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [200, 200, 200]);
    }
  })();
  function altColor(ft, a) {
    var s = C.altStop(ft), i = Math.min(5, Math.floor(s)), f = s - i, p = altRGB[i], q = altRGB[i + 1];
    return 'rgba(' + Math.round(p[0] + (q[0] - p[0]) * f) + ',' + Math.round(p[1] + (q[1] - p[1]) * f) + ',' + Math.round(p[2] + (q[2] - p[2]) * f) + ',' + (a === undefined ? 1 : a) + ')';
  }
  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function resize() {
    var r = canvas.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); baseKey = '';
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------- projection ---------- */
  var overlayEl = document.querySelector('.overlay');
  function overlayW() {
    try { if (getComputedStyle(overlayEl).position === 'absolute') return overlayEl.offsetWidth + 14; } catch (e) {}
    return 0;
  }
  function center() { return [(W - overlayW()) / 2, H / 2 + 10]; }
  function scale() { var c = center(); return (Math.min(c[0] * 2, H) / 2 - 24) / state.range; }
  function proj(lat, lon) { var p = C.toXY(lat, lon), k = scale(), c = center(); return [c[0] + (p.x - state.panX) * k, c[1] - (p.y - state.panY) * k]; }
  function homePx() { var k = scale(), c = center(); return [c[0] - state.panX * k, c[1] + state.panY * k]; }
  function viewBox() {
    var k = scale(), c = center(), h = C.getHome(), cosl = Math.cos(h.lat * RAD);
    var x0 = -c[0] / k + state.panX, x1 = (W - c[0]) / k + state.panX, y0 = -(H - c[1]) / k + state.panY, y1 = c[1] / k + state.panY;
    return [h.lat + y0 / 60, h.lat + y1 / 60, h.lon + x0 / (60 * cosl), h.lon + x1 / (60 * cosl)];
  }
  function vis(set, vb) { return set.filter(function (p) { var b = p.b; return b[1] >= vb[0] && b[0] <= vb[1] && b[3] >= vb[2] && b[2] <= vb[3]; }); }
  function pathOf(g, pts) { for (var i = 0; i < pts.length; i++) { var q = proj(pts[i][0], pts[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } }
  function strokeSet(g, sets, style, width) {
    if (!sets.length) return;
    g.beginPath(); sets.forEach(function (p) { pathOf(g, p); });
    g.strokeStyle = style; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
  function fillSet(g, sets, style) {
    if (!sets.length) return;
    g.beginPath(); sets.forEach(function (p) { pathOf(g, p); g.closePath(); });
    g.fillStyle = style; g.fill();
  }
  function niceStep(R) { return R <= 6 ? 1 : R <= 12 ? 2 : R <= 25 ? 5 : 10; }

  /* ---------- base map (cached) ---------- */
  function drawBase() {
    var h = C.getHome(), key = [W, H, DPR, state.range.toFixed(3), state.panX.toFixed(3), state.panY.toFixed(3), overlayW(), h.lat, h.lon].join('|');
    if (key !== baseKey) { baseKey = key; renderBase(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(baseCanvas, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function renderBase() {
    baseCanvas.width = canvas.width; baseCanvas.height = canvas.height;
    var g = bctx, k = scale(), R = state.range, hp = homePx(), vb = viewBox(), i;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = col['land']; g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], Math.max(W, H) * 0.65);
    glow.addColorStop(0, col['land-glow']); glow.addColorStop(1, col['land']);
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    var z = Math.max(0.85, Math.min(1.4, 10 / R));

    fillSet(g, vis(OSM.wood, vb), col['wood']);
    fillSet(g, vis(OSM.park, vb), col['park']);
    if (R <= 6) strokeSet(g, vis(OSM.stream, vb), col['river'], 0.8);
    strokeSet(g, vis(OSM.river, vb), col['river'], 1.4 * z);
    fillSet(g, vis(OSM.water, vb), col['water']);
    if (R <= 6) strokeSet(g, vis(OSM.secondary, vb), col['road-secondary'], 0.9);
    if (R <= 14) strokeSet(g, vis(OSM.primary, vb), col['road-primary'], 1.1 * z);
    strokeSet(g, vis(OSM.major, vb), col['road-major'], 1.7 * z);

    g.beginPath(); g.arc(hp[0], hp[1], 2 * k, 0, Math.PI * 2); g.fillStyle = col['zone']; g.fill();
    var step = niceStep(R);
    for (i = 1; i * step <= R + 0.01; i++) {
      g.beginPath(); g.arc(hp[0], hp[1], step * i * k, 0, Math.PI * 2);
      g.strokeStyle = col['ring']; g.lineWidth = 1; g.setLineDash([1.5, 5]); g.stroke(); g.setLineDash([]);
    }

    var boxes = [];
    function free(x, y, w, h) {
      if (x < 6 || y < 6 || x + w > W - 6 || y + h > H - 6) return false;
      for (var j = 0; j < boxes.length; j++) { var b = boxes[j]; if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false; }
      boxes.push([x, y, w, h]); return true;
    }
    boxes.push([hp[0] - 16, hp[1] - 16, 32, 32]);
    try {
      var cr = canvas.getBoundingClientRect();
      document.querySelectorAll('.hud-stats, .hud-ctrl, .overlay').forEach(function (el) {
        if (getComputedStyle(el).position !== 'absolute') return;
        var r = el.getBoundingClientRect(); boxes.push([r.left - cr.left - 8, r.top - cr.top - 8, r.width + 16, r.height + 16]);
      });
    } catch (e) {}
    g.font = '10px "B612 Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = col['fg-faint'];
    for (i = 1; i * step <= R + 0.01; i++) {
      var rr = step * i * k, lx = hp[0] + rr * 0.7071 + 3, ly = hp[1] - rr * 0.7071 - 2, txt = (step * i) + ' nm', tw0 = g.measureText(txt).width;
      if (free(lx, ly - 11, tw0 + 2, 12)) g.fillText(txt, lx, ly);
    }
    g.font = '700 9.5px "B612 Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var target = Math.min(W, H) * 0.3;
    OSM.shields.forEach(function (s) {
      var best = null;
      s[1].forEach(function (p) {
        var q = proj(p[0], p[1]); if (q[0] < 20 || q[1] < 20 || q[0] > W - 20 || q[1] > H - 20) return;
        var d = Math.abs(Math.hypot(q[0] - hp[0], q[1] - hp[1]) - target);
        if (!best || d < best.d) best = { d: d, x: q[0], y: q[1] };
      });
      if (!best) return;
      var tw = g.measureText(s[0]).width + 10, hh = 15;
      if (!free(best.x - tw / 2, best.y - hh / 2, tw, hh)) return;
      g.beginPath();
      if (g.roundRect) g.roundRect(best.x - tw / 2, best.y - hh / 2, tw, hh, 4); else g.rect(best.x - tw / 2, best.y - hh / 2, tw, hh);
      g.fillStyle = col['land']; g.fill(); g.strokeStyle = col['road-major']; g.lineWidth = 1; g.stroke();
      g.fillStyle = col['fg-muted']; g.fillText(s[0], best.x, best.y + 0.5);
    });
    g.textAlign = 'left';
    AIRPORTS.forEach(function (p) {
      var q = proj(p[1], p[2]); if (q[0] < -10 || q[1] < -10 || q[0] > W + 10 || q[1] > H + 10) return;
      g.strokeStyle = col['label']; g.lineWidth = 1.1;
      g.beginPath(); g.arc(q[0], q[1], 3.5, 0, Math.PI * 2); g.stroke();
      var tw = g.measureText(p[0]).width;
      if (free(q[0] + 6, q[1] - 6, tw + 2, 12)) { g.fillStyle = col['label']; g.fillText(p[0], q[0] + 7, q[1]); }
    });
    var maxTier = R <= 6 ? 3 : 2, shown = 0, cap = R <= 6 ? 22 : 16;
    g.textAlign = 'center';
    for (i = 0; i < OSM.places.length && shown < cap; i++) {
      var p = OSM.places[i]; if (p[1] > maxTier) continue;
      g.font = p[1] === 1 ? '700 12px "B612", system-ui, sans-serif' : p[1] === 2 ? '11.5px "B612", system-ui, sans-serif' : '10.5px "B612", system-ui, sans-serif';
      var q2 = proj(p[2], p[3]), tw2 = g.measureText(p[0]).width;
      if (!free(q2[0] - tw2 / 2 - 4, q2[1] - 8, tw2 + 8, 16)) continue;
      g.fillStyle = p[1] === 1 ? col['label-strong'] : col['label'];
      g.fillText(p[0], q2[0], q2[1]); shown++;
    }
  }

  /* ---------- aircraft ---------- */
  function brackets(x, y, r, color) {
    var l = r * 0.45;
    ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      ctx.moveTo(x + c[0] * r, y + c[1] * (r - l)); ctx.lineTo(x + c[0] * r, y + c[1] * r); ctx.lineTo(x + c[0] * (r - l), y + c[1] * r);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
  }
  function labelFor(a) {
    if (a.mil) return { top: a.call, chip: 'MIL' };
    if (a.route) return { top: C.routeText(a.route), chip: '' };
    return { top: a.call, chip: '' };
  }
  function drawTraffic(t) {
    var hp = homePx(), k = scale(), list = feed.list, sel = null, i, j, ac, ow = overlayW();
    for (i = 0; i < list.length; i++) {
      ac = list[i]; var q = proj(ac.lat, ac.lon); ac.px = q[0]; ac.py = q[1];
      ac.vis = q[0] > -30 && q[1] > -30 && q[0] < W - ow + 30 && q[1] < H + 30;
      if (ac.id === state.selId) sel = ac;
    }
    for (i = 0; i < list.length; i++) {
      ac = list[i]; var tr = ac.trail, n = tr.length; if (n < 2 || !ac.vis) continue;
      var isSel = ac === sel;
      for (j = 1; j < n; j++) {
        var a = proj(tr[j - 1].lat, tr[j - 1].lon), b = proj(tr[j].lat, tr[j].lon);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = altColor(tr[j].alt, (isSel ? 0.85 : 0.38) * (j / n)); ctx.lineWidth = isSel ? 2 : 1.3; ctx.stroke();
      }
      var last = proj(tr[n - 1].lat, tr[n - 1].lon);
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(ac.px, ac.py); ctx.strokeStyle = altColor(ac.alt, isSel ? 0.85 : 0.38); ctx.stroke();
    }
    if (sel && sel.vis) {
      var c = C.cpa(sel), v = 5 * 60 * sel.gs / 3600 * k;
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = col['fg']; ctx.lineWidth = 1.1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(sel.px, sel.py); ctx.lineTo(sel.px + Math.sin(sel.trk * RAD) * v, sel.py - Math.cos(sel.trk * RAD) * v); ctx.stroke();
      if (c && !c.receding && c.t < 1800) {
        var cp = [hp[0] + c.x * k, hp[1] - c.y * k];
        ctx.setLineDash([1, 4]); ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(cp[0], cp[1]); ctx.stroke();
        ctx.setLineDash([]); ctx.beginPath(); ctx.arc(cp[0], cp[1], 2.5, 0, Math.PI * 2); ctx.fillStyle = col['fg']; ctx.fill();
      }
      ctx.restore();
    }
    var order = list.filter(function (x) { return x.vis; }).sort(function (x, y) { return x === sel ? -1 : y === sel ? 1 : (y.mil ? 1 : 0) - (x.mil ? 1 : 0) || x.d - y.d; });
    order.slice().reverse().forEach(function (x) {
      if (x.emergency) {
        var pr = reduced ? 0 : (t / 900) % 1;
        ctx.beginPath(); ctx.arc(x.px, x.py, 14 + pr * 10, 0, Math.PI * 2); ctx.strokeStyle = col['danger']; ctx.globalAlpha = 1 - pr * 0.8; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (x === sel) { ctx.beginPath(); ctx.arc(x.px, x.py, 23, 0, Math.PI * 2); ctx.strokeStyle = col["fg"]; ctx.lineWidth = 1.3; ctx.stroke(); }
      S.draw(ctx, { cls: x.cls, type: x.type, x: x.px, y: x.py, track: x.trk, fill: altColor(x.alt), outline: col['land'], scale: x === sel ? 1.12 : 1, time: reduced ? 0 : t });
      if (x.mil) brackets(x.px, x.py, 20, col["mil"]);
    });
    // labels: route (or callsign) over altitude, without overlaps
    var boxes = [[hp[0] - 14, hp[1] - 14, 28, 28]];
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    order.forEach(function (x) {
      if (x !== sel && !x.mil && x.d > state.range * 1.25) return;
      var L = labelFor(x), t2 = C.fmtAlt(x.alt);
      ctx.font = '700 10.5px "B612 Mono", ui-monospace, monospace'; var w1 = ctx.measureText(L.top).width + (L.chip ? 30 : 0);
      ctx.font = '10px "B612 Mono", ui-monospace, monospace'; var w2 = ctx.measureText(t2).width;
      var w = Math.max(w1, w2) + 4, lx = x.px + 21, ly = x.py - 13, hh = 26;
      var hit = false;
      for (var m = 0; m < boxes.length; m++) { var b = boxes[m]; if (lx < b[0] + b[2] && lx + w > b[0] && ly < b[1] + b[3] && ly + hh > b[1]) { hit = true; break; } }
      if (hit && x !== sel && !x.mil) return;
      boxes.push([lx, ly, w, hh]);
      var cx = lx;
      if (L.chip) {
        ctx.font = '700 8.5px "B612 Mono", ui-monospace, monospace';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx, x.py - 12, 26, 12, 3); else ctx.rect(cx, x.py - 12, 26, 12);
        ctx.fillStyle = col['mil']; ctx.fill(); ctx.fillStyle = col['land']; ctx.fillText(L.chip, cx + 4, x.py - 5.5); cx += 30;
      }
      ctx.lineWidth = 3; ctx.strokeStyle = col['land']; ctx.lineJoin = 'round';
      ctx.font = '700 10.5px "B612 Mono", ui-monospace, monospace';
      ctx.strokeText(L.top, cx, x.py - 6); ctx.fillStyle = x === sel || x.mil ? col['fg'] : col['fg-muted']; ctx.fillText(L.top, cx, x.py - 6);
      ctx.font = '10px "B612 Mono", ui-monospace, monospace';
      ctx.strokeText(t2, lx, x.py + 7); ctx.fillStyle = altColor(x.alt, 0.95); ctx.fillText(t2, lx, x.py + 7);
    });
    drawEdgeMarkers(hp);
  }
  // Military aircraft outside the view get a pointer at the map edge.
  function drawEdgeMarkers(hp) {
    var ow = overlayW(), x0 = 22, y0 = 22, x1 = W - ow - 22, y1 = H - 40, arrows = [], boxes = [];
    military().forEach(function (a) {
      if (a.vis) return;
      var dx = a.px - hp[0], dy = a.py - hp[1], tt = Infinity;
      if (dx > 0) tt = Math.min(tt, (x1 - hp[0]) / dx); if (dx < 0) tt = Math.min(tt, (x0 - hp[0]) / dx);
      if (dy > 0) tt = Math.min(tt, (y1 - hp[1]) / dy); if (dy < 0) tt = Math.min(tt, (y0 - hp[1]) / dy);
      if (!isFinite(tt) || tt <= 0) return;
      var ex = hp[0] + dx * tt, ey = hp[1] + dy * tt;
      for (var i = 0; i < arrows.length; i++) if (Math.hypot(arrows[i][0] - ex, arrows[i][1] - ey) < 16) return;
      arrows.push([ex, ey]);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = col['land']; ctx.stroke(); ctx.fillStyle = col['mil']; ctx.fill(); ctx.restore();
      var label = a.call + ' ' + Math.round(a.d) + ' nm';
      ctx.font = '700 9.5px "B612 Mono", ui-monospace, monospace';
      var tw = ctx.measureText(label).width, lx = Math.min(Math.max(ex - tw / 2, x0), x1 - tw), ly = ey + (ey > H / 2 ? -14 : 15);
      for (var j = 0; j < boxes.length; j++) { var b = boxes[j]; if (lx < b[0] + b[2] + 6 && lx + tw + 6 > b[0] && Math.abs(ly - b[1]) < 13) return; }
      boxes.push([lx, ly, tw]);
      ctx.lineWidth = 3; ctx.strokeStyle = col['land']; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col['mil']; ctx.fillText(label, lx, ly);
    });
  }
  function drawHome(t) {
    var hp = homePx(), cx = hp[0], cy = hp[1], pulse = reduced ? 0 : (t / 2400) % 1;
    ctx.beginPath(); ctx.arc(cx, cy, 7 + pulse * 20, 0, Math.PI * 2);
    ctx.strokeStyle = col['home']; ctx.globalAlpha = 0.45 * (1 - pulse); ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = col['land']; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6.5, -1.2); ctx.lineTo(4.6, -1.2); ctx.lineTo(4.6, 5.5); ctx.lineTo(-4.6, 5.5); ctx.lineTo(-4.6, -1.2); ctx.lineTo(-6.5, -1.2); ctx.closePath();
    ctx.fillStyle = col['home']; ctx.fill(); ctx.fillStyle = col['land']; ctx.fillRect(-1.4, 1.6, 2.8, 3.9);
    ctx.restore();
  }

  /* ---------- panels ---------- */
  function inView() { return feed.list.filter(function (a) { return a.d <= state.range; }).sort(function (a, b) { return a.d - b.d; }); }
  function military() { return feed.list.filter(function (a) { return a.mil && a.d <= MIL_RANGE; }).sort(function (a, b) { return a.d - b.d; }); }
  function findSel() { for (var i = 0; i < feed.list.length; i++) if (feed.list[i].id === state.selId) return feed.list[i]; return null; }
  function select(id, pan) {
    state.selId = id; state.auto = false;
    var a = findSel();
    if (pan && a && a.d > state.range) { state.panX = a.x; state.panY = a.y; state.range = Math.min(22, Math.max(state.range, 10)); syncRangeSeg(); }
    renderPanels();
  }
  function hhmm(ms) { return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function ago(ms) { var s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }
  function startOfDay() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function text(id, v) { var el = $(id); if (el.textContent !== String(v)) el.textContent = v; }

  function renderStatus() {
    var pill = $('pill'), m = state.mode, t = $('pillText');
    pill.setAttribute('data-state', m);
    t.textContent = '';
    if (m === 'live') {
      var b = document.createElement('b'); b.textContent = 'Live';
      t.append(b, ' · ' + feed.list.filter(function (a) { return a.source === 'near'; }).length + ' aircraft · ' + ago(state.lastData));
    } else if (m === 'paused') t.textContent = 'Feed slow · last ' + ago(state.lastData);
    else if (m === 'off') t.textContent = 'Feed not answering';
    else t.textContent = 'Connecting';
    text('clock', new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }
  function offlineShown() { return (state.mode === 'off' || state.mode === 'paused') && !feed.list.length; }
  function renderOffline() {
    var show = offlineShown();
    $('offline').hidden = !show; $('selLive').hidden = show;
    if (!show) return;
    if (state.mode === 'paused') { text('offTitle', 'Flight feed is slow'); text('offText', 'The last update arrived ' + ago(state.lastData) + '. This page keeps retrying on its own.'); }
    else { text('offTitle', 'Can’t reach the flight feed'); text('offText', 'None of the flight feeds answered yet. This page keeps retrying on its own, usually within a minute.'); }
  }
  function renderStats() {
    var rows = inView(), today = startOfDay(), mil = military();
    text('stInView', state.mode === 'live' ? rows.length : '–');
    text('stNearest', rows.length ? rows[0].d.toFixed(1) : '–'); $('stNearest').nextElementSibling.hidden = !rows.length;
    text('stMil', state.milOk ? mil.length : '–');
    text('stPasses', tracker.log.filter(function (p) { return p.ts >= today; }).length);
    text('milCount', state.milOk ? String(mil.length) : '');
  }

  var routeInfo = {};
  function routeDetails(call) {
    if (!/^[A-Z]{3}[0-9][0-9A-Z]{0,4}$/.test(call || '')) return null;
    if (routeInfo[call] !== undefined) return routeInfo[call];
    routeInfo[call] = null;
    fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(call))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var f = j && j.response && j.response.flightroute;
        if (!f || !f.origin || !f.destination) return;
        routeInfo[call] = { from: f.origin.municipality || f.origin.name || '', to: f.destination.municipality || f.destination.name || '', airline: (f.airline && f.airline.name) || '' };
        renderPanels();
      }).catch(function () {});
    return null;
  }

  function renderSel() {
    if (offlineShown()) return;
    var ac = findSel(), rows = inView();
    if (!ac && !state.auto) state.auto = true;
    if (state.auto) { ac = rows[0] || null; state.selId = ac ? ac.id : null; }
    var badges = $('selBadges'); badges.textContent = '';
    if (!ac) {
      text('selCall', '–'); text('selRoute', ''); text('selRouteMore', ''); text('selType', state.mode === 'live' ? 'Nothing inside ' + state.range + ' nm right now' : 'Waiting for aircraft');
      ['selAlt', 'selSpd', 'selHdg', 'selDist'].forEach(function (id) { text(id, '–'); });
      text('selVs', ''); text('selCard8', ''); text('selBrg', 'nm'); text('selPass', 'Aircraft appear here as they come near.');
      return;
    }
    function badge(txt, cls) { var b = document.createElement('span'); b.className = 'badge ' + (cls || ''); b.textContent = txt; badges.append(b); }
    if (ac.emergency) badge('Emergency ' + ac.squawk, 'danger');
    if (ac.mil) badge('Military', 'mil');
    if (ac.d < 2) badge('Overhead', 'hot');
    var c = C.cpa(ac);
    if (!(ac.d < 2) && c && !c.receding && c.d < 3 && c.t < 900) badge('Approaching');
    text('selCall', ac.call);
    text('selRoute', C.routeText(ac.route));
    var info = routeDetails(ac.call);
    text('selRouteMore', info ? [info.from && info.to ? info.from + ' to ' + info.to : '', info.airline].filter(Boolean).join(' · ') : (ac.mil ? C.MIL_LABEL[ac.mil] || '' : ''));
    text('selType', [ac.typeName, ac.reg && ac.reg !== ac.call ? ac.reg : '', ac.mlat ? 'MLAT position' : ''].filter(Boolean).join(' · ') + (state.auto ? ' · nearest' : ''));
    text('selAlt', C.fmtAlt(ac.alt) + (ac.alt < 18000 ? ' ft' : ''));
    text('selVs', Math.abs(ac.vs) < 200 ? 'level' : (ac.vs > 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(ac.vs) / 50) * 50 + ' fpm');
    text('selSpd', Math.round(ac.gs));
    text('selHdg', String(Math.round(ac.trk) % 360).padStart(3, '0') + '°'); text('selCard8', C.card8(ac.trk));
    text('selDist', ac.d < 100 ? ac.d.toFixed(1) : Math.round(ac.d)); text('selBrg', 'nm ' + C.card8(ac.brg));
    $('selMark').style.left = (C.altStop(ac.alt) / 6 * 100).toFixed(1) + '%';
    var p = $('selPass'); p.textContent = '';
    var strong = document.createElement('strong');
    if (ac.d > 40) { p.append('About '); strong.textContent = Math.round(ac.d) + ' nm ' + C.card8(ac.brg); p.append(strong, ' of home.'); }
    else if (!c || c.receding) { p.append('Heading away. Closest it came: '); strong.textContent = ac.minD.toFixed(1) + ' nm'; p.append(strong, '.'); }
    else if (c.t < 20) { p.append('Closest to home right now, '); strong.textContent = c.d.toFixed(1) + ' nm ' + C.card8(c.brg); p.append(strong, '.'); }
    else {
      p.append(c.d < 1 ? 'Passes overhead in ' : 'Closest in '); strong.textContent = C.fmtDur(c.t);
      p.append(strong, c.d < 1 ? '.' : ', ' + c.d.toFixed(1) + ' nm ' + C.card8(c.brg) + ' of home.');
    }
  }

  function row(ac, onClick, cols) {
    var li = document.createElement('li'), bt = document.createElement('button');
    bt.type = 'button'; bt.className = 'row'; if (ac.id === state.selId) bt.setAttribute('aria-current', 'true');
    var dot = document.createElement('span'); dot.className = 'dot' + (ac.mil ? ' mil' : ''); dot.style.background = altColor(ac.alt);
    var main = document.createElement('span'); main.className = 'call'; main.textContent = cols[0];
    var sm = document.createElement('small'); sm.textContent = cols[1]; main.append(sm);
    var a = document.createElement('span'); a.className = 'num'; a.textContent = cols[2];
    var d = document.createElement('span'); d.className = 'num'; d.textContent = cols[3];
    bt.append(dot, main, a, d); bt.addEventListener('click', onClick);
    li.append(bt); return li;
  }
  function empty(ul, msg) { var e = document.createElement('li'); e.className = 'empty'; e.textContent = msg; ul.append(e); }
  function renderList() {
    var ul = $('list'), rows = inView(); ul.textContent = '';
    if (!rows.length) return empty(ul, state.mode === 'live' ? 'Nothing inside ' + state.range + ' nm right now.' : 'No aircraft yet.');
    rows.forEach(function (ac) {
      ul.append(row(ac, function () { select(ac.id); }, [ac.route ? C.routeText(ac.route) : ac.call, ac.route ? ac.call : ac.type, C.fmtAlt(ac.alt), ac.d.toFixed(1) + ' nm']));
    });
  }
  function renderMil() {
    var ul = $('milList'), rows = military(); ul.textContent = '';
    if (!state.milOk) return empty(ul, 'Loading military aircraft within ' + MIL_RANGE + ' nm…');
    if (!rows.length) return empty(ul, 'No military aircraft broadcasting within ' + MIL_RANGE + ' nm right now.');
    rows.forEach(function (ac) {
      ul.append(row(ac, function () { select(ac.id, true); }, [ac.call, ac.type || '', C.fmtAlt(ac.alt), Math.round(ac.d) + ' nm ' + C.card8(ac.brg)]));
    });
  }
  function renderLog() {
    var ul = $('log'), L = tracker.log; ul.textContent = '';
    if (!L.length) return empty(ul, 'Flights that pass within ' + C.PASS_NM + ' nm of home are logged here.');
    L.forEach(function (r) {
      var li = document.createElement('li'); li.className = 'row log';
      var t = document.createElement('span'); t.className = 'num'; t.style.textAlign = 'left'; t.textContent = hhmm(r.ts);
      var call = document.createElement('span'); call.className = 'call'; call.textContent = r.route ? C.routeText(r.route) : r.call;
      var sm = document.createElement('small'); sm.textContent = (r.mil ? 'MIL ' : '') + (r.route ? r.call : r.type); call.append(sm);
      var alt = document.createElement('span'); alt.className = 'num'; alt.textContent = C.fmtAlt(r.alt);
      var d = document.createElement('span'); d.className = 'num'; d.textContent = r.d.toFixed(1) + ' nm';
      li.append(t, call, alt, d); ul.append(li);
    });
  }
  function renderPanels() {
    renderStatus(); renderOffline(); renderStats(); renderSel();
    if (state.tab === 'now') renderList(); else if (state.tab === 'mil') renderMil(); else renderLog();
  }

  /* ---------- military alerts ---------- */
  var alerted = {}, alertsOn = lsGet('og-mil-alerts') === '1';
  function syncAlertBtn() {
    var b = $('btnAlerts'); b.setAttribute('aria-pressed', alertsOn ? 'true' : 'false');
    b.textContent = alertsOn ? 'Alerts on within ' + ALERT_NM + ' nm' : 'Alert me within ' + ALERT_NM + ' nm';
  }
  syncAlertBtn();
  $('btnAlerts').addEventListener('click', function () {
    alertsOn = !alertsOn; lsSet('og-mil-alerts', alertsOn ? '1' : '0'); syncAlertBtn();
    if (alertsOn && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
  });
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 9000);
  }
  function checkAlerts() {
    var now = Date.now();
    feed.list.forEach(function (a) {
      if (!a.mil || a.d > ALERT_NM) return;
      if (alerted[a.id] && now - alerted[a.id] < 3600e3) return;
      alerted[a.id] = now;
      var msg = 'Military nearby: ' + a.call + (a.typeName && a.typeName !== 'Unknown type' ? ' (' + a.typeName + ')' : '') + ', ' + a.d.toFixed(1) + ' nm ' + C.card8(a.brg) + ', ' + C.fmtAlt(a.alt) + (a.alt < 18000 ? ' ft' : '');
      toast(msg);
      if (alertsOn && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Over Germantown', { body: msg, tag: 'mil-' + a.id }); } catch (e) {} }
    });
  }
  $('toast').addEventListener('click', function () { this.hidden = true; });

  /* ---------- controls ---------- */
  function segBind(id, attr, fn) {
    var seg = $(id);
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !b.hasAttribute(attr)) return;
      seg.querySelectorAll('button[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fn(b.getAttribute(attr));
    });
  }
  function syncRangeSeg() { $('rangeSeg').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', Math.abs(+b.getAttribute('data-range') - state.range) < 0.4 ? 'true' : 'false'); }); }
  segBind('rangeSeg', 'data-range', function (v) { state.range = +v; renderPanels(); });
  segBind('tabSeg', 'data-tab', function (v) {
    state.tab = v; $('list').hidden = v !== 'now'; $('milList').hidden = v !== 'mil'; $('log').hidden = v !== 'passes'; $('btnAlerts').hidden = v !== 'mil';
    text('listTitle', v === 'now' ? 'In view' : v === 'mil' ? 'Military within ' + MIL_RANGE + ' nm' : 'Passes within ' + C.PASS_NM + ' nm');
    renderPanels();
  });
  $('btnCenter').addEventListener('click', function () { state.panX = 0; state.panY = 0; });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k0 = scale(), c = center();
    var wx = (mx - c[0]) / k0 + state.panX, wy = -(my - c[1]) / k0 + state.panY;
    state.range = Math.max(2.5, Math.min(22, state.range * Math.exp(e.deltaY * 0.0015)));
    var k1 = scale(); state.panX = wx - (mx - c[0]) / k1; state.panY = wy + (my - c[1]) / k1;
    syncRangeSeg();
  }, { passive: false });
  var drag = null, dragged = false;
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, y: e.clientY, px: state.panX, py: state.panY }; dragged = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true; canvas.classList.add('dragging');
    var k = scale(); state.panX = drag.px - dx / k; state.panY = drag.py + dy / k;
  });
  function endDrag() { drag = null; canvas.classList.remove('dragging'); }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('click', function (e) {
    if (dragged) { dragged = false; return; }
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 30;
    feed.list.forEach(function (ac) { if (!ac.vis) return; var d = Math.hypot(ac.px - x, ac.py - y); if (d < bd) { bd = d; best = ac; } });
    if (best) select(best.id); else { state.auto = true; renderPanels(); }
  });

  function applyHome(la, lo) {
    C.setHome(la, lo); tracker.reset(feed.list);
    text('coords', la.toFixed(4) + '°N ' + Math.abs(lo).toFixed(4) + '°W');
    text('homeLabel', Math.abs(la - 39.1732) < 1e-4 && Math.abs(lo + 77.2717) < 1e-4 ? 'Home pin: Germantown' : 'Home pin: ' + la.toFixed(4) + ', ' + lo.toFixed(4));
    $('homeLat').value = la; $('homeLon').value = lo; baseKey = '';
  }
  $('btnHome').addEventListener('click', function () { var f = $('homeForm'); f.hidden = !f.hidden; this.setAttribute('aria-expanded', String(!f.hidden)); });
  $('homeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var la = parseFloat($('homeLat').value), lo = parseFloat($('homeLon').value);
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la - 39.17) > 0.35 || Math.abs(lo + 77.27) > 0.45) {
      text('homeNote', 'That point is outside the map. Use decimal degrees near Germantown, for example 39.1732 and -77.2717.'); return;
    }
    applyHome(la, lo); lsSet('og-home', JSON.stringify([la, lo]));
    text('homeNote', 'Home pin moved.'); $('homeForm').hidden = true; $('btnHome').setAttribute('aria-expanded', 'false');
  });
  try { var savedHome = JSON.parse(lsGet('og-home') || 'null'); if (savedHome && savedHome.length === 2) applyHome(savedHome[0], savedHome[1]); } catch (e) {}

  /* ---------- feeds ---------- */
  var lastSave = 0;
  function loadPasses() { try { JSON.parse(lsGet('og-passes') || '[]').forEach(function (p) { if (p && p.ts) tracker.add(p); }); } catch (e) {} }
  function savePasses() { if (Date.now() - lastSave < 15000) return; lastSave = Date.now(); lsSet('og-passes', JSON.stringify(tracker.log.slice(0, 150))); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q() { var h = C.getHome(); return '?lat=' + h.lat.toFixed(3) + '&lon=' + h.lon.toFixed(3); }
  async function pollNear() {
    var fails = 0;
    while (true) {
      try {
        var r = await fetch('api/planes' + q(), { cache: 'no-store' }), snap = await r.json();
        if (!snap || !Array.isArray(snap.ac)) throw new Error((snap && snap.error) || 'no aircraft list');
        fails = 0;
        if (feed.ingest(snap, 'near', 60000)) { state.lastData = Math.min(Date.now(), snap.now); tracker.update(feed.list, Date.now()); savePasses(); }
        if (state.mode !== 'live') { state.mode = 'live'; renderPanels(); }
      } catch (e) {
        fails++;
        if (fails >= 3 && state.mode !== 'live') { state.mode = state.lastData ? 'paused' : 'off'; renderPanels(); }
      }
      await sleep(document.hidden ? 30000 : fails ? Math.min(30000, 5000 * fails) : 10000);
    }
  }
  async function pollMil() {
    while (true) {
      var wait = 60000;
      try {
        var r = await fetch('api/military' + q(), { cache: 'no-store' }), snap = await r.json();
        if (!snap || !Array.isArray(snap.ac)) throw new Error('no list');
        feed.ingest(snap, 'mil', 150000); state.milOk = true; state.lastMil = Date.now();
        tracker.update(feed.list, Date.now()); renderPanels();
      } catch (e) { wait = 30000; }
      await sleep(document.hidden ? 120000 : wait);
    }
  }
  loadPasses();
  pollNear();
  pollMil();

  /* ---------- loop ---------- */
  var lastPanel = 0;
  function frame(t) {
    var removed = feed.step();
    tracker.update(feed.list, Date.now());
    removed.forEach(function (ac) { tracker.record(ac); });
    if (state.mode === 'live' && Date.now() - state.lastData > 90000) { state.mode = 'paused'; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (W > 0 && H > 0) { drawBase(); drawTraffic(t); drawHome(t); }
    if (t - lastPanel > 800) { lastPanel = t; renderPanels(); checkAlerts(); }
    requestAnimationFrame(frame);
  }
  renderPanels();
  requestAnimationFrame(frame);
})();
