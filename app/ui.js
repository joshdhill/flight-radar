/* Plane Sight — map, feeds and panels. */
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
  function useMap(raw) {
    ['wood', 'park', 'water', 'river', 'stream', 'major', 'primary', 'secondary'].forEach(function (k) { OSM[k] = decodeSet(raw[k]); });
    OSM.places = raw.places || []; OSM.shields = raw.shields || []; baseKey = '';
  }
  var WIDE = null;
  var inlineWide = document.getElementById('widemap');
  if (inlineWide) {
    try {
      var rw = JSON.parse(inlineWide.textContent);
      WIDE = { ready: true, water: decodeSet(rw.water), major: decodeSet(rw.major), boundary: decodeSet(rw.boundary), places: rw.places || [], airports: rw.airports || [], detailBox: rw.detailBox };
    } catch (e) {}
  }
  if (window.OG_TILES) window.OG_TILES.onUpdate(function () { baseKey = ''; });
  var inlineMap = document.getElementById('mapdata');
  if (inlineMap) { try { useMap(JSON.parse(inlineMap.textContent)); } catch (e) {} }
  else if (!window.OG_TILES) fetch('data/map.json').then(function (r) { return r.json(); }).then(useMap).catch(function () {});
  var AIRPORTS = [['IAD', 38.9445, -77.4558], ['DCA', 38.8521, -77.0377], ['BWI', 39.1754, -76.6683], ['GAI', 39.1684, -77.1660],
    ['FDK', 39.4176, -77.3743], ['JYO', 39.0777, -77.5570], ['ADW', 38.8108, -76.8669], ['DAA', 38.7150, -77.1810]];
  if (!window.OG_EMBEDDED) fetch('sprites/manifest.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (list) {
    S.loadOverrides('sprites/', list);
    if (window.MilArt && list && list.hero) window.MilArt.loadHero('sprites/', list.hero);
  }).catch(function () {});
  var T = window.OG_TRANSPORT || { start: function () {}, lookup: function () {}, copy: {} };
  var COPY = {
    off: (T.copy && T.copy.off) || ['Can\u2019t reach the flight feed', 'None of the flight feeds answered yet. This page keeps retrying on its own, usually within a minute.'],
    paused: (T.copy && T.copy.paused) || function (ago) { return ['Flight feed is slow', 'The last update arrived ' + ago + '. This page keeps retrying on its own.']; },
    needsOk: (T.copy && T.copy.needsOk) || ['Allow the live feed', 'Press Start to connect.']
  };
  var routeInfo = {}, acInfo = {};
  function routeOf(a) {
    if (a.route) return a.route;
    var ri = routeInfo[a.call];
    if (!ri || !ri.r) return '';
    if (ri.o && ri.d && typeof a.lat === 'number' && !C.onLeg(a.lat, a.lon, ri.o[0], ri.o[1], ri.d[0], ri.d[1])) return '';
    return ri.r;
  }

  /* ---------- state ---------- */
  var state = { range: 10, panX: 0, panY: 0, selId: null, auto: true, tab: 'now', mode: 'connecting', note: '', lastData: 0, lastMil: 0, milOk: false, follow: null, cycleView: -1, cycleMil: -1, milFilter: 'all', milQuery: '' };
  var isPhone = function () { try { return matchMedia('(max-width: 1000px)').matches; } catch (e) { return false; } };
  var feed = C.createLiveFeed(), tracker = C.createTracker();
  var canvas = $('map'), ctx = canvas.getContext('2d'), W = 0, H = 0, DPR = 1;
  var baseCanvas = document.createElement('canvas'), bctx = baseCanvas.getContext('2d'), baseKey = '';
  var col = {}, altRGB = [];
  (function readColors() {
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    ['land', 'land-glow', 'wood', 'park', 'water', 'river', 'road-major', 'road-primary', 'road-secondary', 'road-minor', 'building', 'building-edge', 'label', 'label-strong', 'ring', 'zone',
      'home', 'fg', 'fg-muted', 'fg-faint', 'mil', 'danger', 'boundary'].forEach(function (k) { col[k] = g('--' + k); });
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
  function dashSet(g, sets, style, width) {
    if (!sets || !sets.length) return;
    g.save(); g.setLineDash([5, 4]); strokeSet(g, sets, style, width); g.restore();
  }
  function fillSet(g, sets, style) {
    if (!sets.length) return;
    g.beginPath(); sets.forEach(function (p) { pathOf(g, p); g.closePath(); });
    g.fillStyle = style; g.fill();
  }
  function niceStep(R) { return R <= 0.6 ? 0.1 : R <= 1.5 ? 0.25 : R <= 3 ? 0.5 : R <= 6 ? 1 : R <= 12 ? 2 : R <= 25 ? 5 : R <= 60 ? 10 : R <= 150 ? 25 : 50; }
  var MIN_RANGE = 0.25, MAX_RANGE = 300;
  function clampRange(r) { return Math.max(MIN_RANGE, Math.min(MAX_RANGE, r)); }

  // Map shapes for the current view: live tiles on the website, the built-in map in the Claude dashboard.
  function groupShields(list) {
    var g = {}; list.forEach(function (s) { (g[s[0]] = g[s[0]] || []).push(s[1]); });
    return Object.keys(g).map(function (k) { return [k, g[k]]; });
  }
  function mapLayers(vb, R) {
    if (window.OG_TILES) {
      var mpp = 1852 / scale(), zx = Math.log(156543.03 * Math.cos(C.getHome().lat * RAD) / mpp) / Math.LN2;
      var L = window.OG_TILES.layersFor(vb, Math.floor(zx - 0.4));
      L.shields = groupShields(L.shields);
      return L;
    }
    var W2 = WIDE;
    return {
      water: vis(OSM.water, vb), wood: vis(OSM.wood, vb), park: vis(OSM.park, vb), river: vis(OSM.river, vb), stream: vis(OSM.stream, vb),
      major: vis(OSM.major, vb), primary: vis(OSM.primary, vb), secondary: vis(OSM.secondary, vb), minor: [], names: [], buildings: [], housenumbers: [], boundary: [],
      places: OSM.places, shields: OSM.shields, airports: AIRPORTS,
      wide: W2 && W2.ready ? { water: vis(W2.water, vb), major: vis(W2.major, vb), boundary: vis(W2.boundary, vb), places: W2.places, airports: W2.airports, box: W2.detailBox } : null
    };
  }

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

    var M = mapLayers(vb, R);
    if (M.wide) {
      // coarse wide-area map, kept outside the detailed area around home
      var bx = M.wide.box, p1 = proj(bx[1], bx[2]), p2 = proj(bx[0], bx[3]);
      g.save(); g.beginPath(); g.rect(-10, -10, W + 20, H + 20); g.rect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1]); g.clip('evenodd');
      fillSet(g, M.wide.water, col['water']);
      dashSet(g, M.wide.boundary, col['boundary'], 1);
      strokeSet(g, M.wide.major, col['road-major'], 1.4);
      g.restore();
    }
    var zw = R < 2 ? Math.min(5, 2 / R) : 1; // roads widen as you zoom in to street level
    if (R <= 60) fillSet(g, M.wood, col['wood']);
    if (R <= 60) fillSet(g, M.park, col['park']);
    if (R <= 6) strokeSet(g, M.stream, col['river'], 0.8 * Math.min(zw, 1.5));
    strokeSet(g, M.river, col['river'], 1.4 * z * Math.min(zw, 2));
    fillSet(g, M.water, col['water']);
    dashSet(g, M.boundary, col['boundary'], 1);
    if (R <= 1.2 && M.buildings.length) {
      fillSet(g, vis(M.buildings, vb), col['building']);
      if (R <= 0.6) strokeSet(g, vis(M.buildings, vb), col['building-edge'], 0.8);
    }
    if (R <= 2.5) strokeSet(g, M.minor, col['road-minor'], Math.min(9, 1.1 * zw));
    if (R <= 6) strokeSet(g, M.secondary, col['road-secondary'], 0.9 * zw);
    if (R <= 30) strokeSet(g, M.primary, col['road-primary'], 1.1 * z * zw);
    strokeSet(g, M.major, col['road-major'], (R > 60 ? 1.2 : 1.7) * z * zw);

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
      document.querySelectorAll('.hud-stats, .hud-ctrl, .overlay, .mil-fab, .mini-sel:not([hidden]), .peek, .top').forEach(function (el) {
        var ps = getComputedStyle(el).position; if (ps !== 'absolute' && ps !== 'fixed') return;
        var r = el.getBoundingClientRect(); boxes.push([r.left - cr.left - 8, r.top - cr.top - 8, r.width + 16, r.height + 16]);
      });
    } catch (e) {}
    g.font = '10px "B612 Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = col['fg-faint'];
    for (i = 1; i * step <= R + 0.01; i++) {
      var rr = step * i * k, lx = hp[0] + rr * 0.7071 + 3, ly = hp[1] - rr * 0.7071 - 2, txt = +(step * i).toFixed(2) + ' nm', tw0 = g.measureText(txt).width;
      if (free(lx, ly - 11, tw0 + 2, 12)) g.fillText(txt, lx, ly);
    }
    if (R <= 1.6) drawStreetNames(g, M.names, free);
    if (R <= 0.7) drawHouseNumbers(g, M.housenumbers, free);
    g.font = '700 9.5px "B612 Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var target = Math.min(W, H) * 0.3;
    (R <= 60 ? M.shields : []).forEach(function (s) {
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
    var apts = M.airports.concat(M.wide ? M.wide.airports : []);
    if (R > 60) apts = apts.filter(function (p) { return p[3] === 'international' || p[3] === 'military' || AIRPORTS.some(function (a) { return a[0] === p[0]; }); });
    apts.forEach(function (p) {
      var q = proj(p[1], p[2]); if (q[0] < -10 || q[1] < -10 || q[0] > W + 10 || q[1] > H + 10) return;
      g.strokeStyle = col['label']; g.lineWidth = 1.1;
      g.beginPath(); g.arc(q[0], q[1], 3.5, 0, Math.PI * 2); g.stroke();
      var tw = g.measureText(p[0]).width;
      if (free(q[0] + 6, q[1] - 6, tw + 2, 12)) { g.fillStyle = col['label']; g.fillText(p[0], q[0] + 7, q[1]); }
    });
    var maxTier = R <= 6 ? 3 : R <= 30 ? 2 : 1, shown = 0, cap = R <= 6 ? 22 : R <= 30 ? 16 : 14;
    var places = M.places.concat(M.wide ? M.wide.places : []);
    g.textAlign = 'center';
    for (i = 0; i < places.length && shown < cap; i++) {
      var p = places[i]; if (p[1] > maxTier) continue;
      g.font = p[1] === 1 ? '700 12px "B612", system-ui, sans-serif' : p[1] === 2 ? '11.5px "B612", system-ui, sans-serif' : '10.5px "B612", system-ui, sans-serif';
      var q2 = proj(p[2], p[3]), tw2 = g.measureText(p[0]).width;
      if (!free(q2[0] - tw2 / 2 - 4, q2[1] - 8, tw2 + 8, 16)) continue;
      g.fillStyle = p[1] === 1 ? col['label-strong'] : col['label'];
      g.fillText(p[0], q2[0], q2[1]); shown++;
    }
  }

  // Street names, centered on each street's longest visible stretch and tilted along it.
  function drawStreetNames(g, names, free) {
    var best = {};
    names.forEach(function (n) {
      var pts = n[1].map(function (q) { return proj(q[0], q[1]); }), cum = [0];
      for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      var len = cum[cum.length - 1];
      if (!best[n[0]] || len > best[n[0]].len) best[n[0]] = { len: len, pts: pts, cum: cum };
    });
    function at(s, d) { // point at distance d along the line
      for (var i = 1; i < s.cum.length; i++) if (s.cum[i] >= d) { var f = (d - s.cum[i - 1]) / Math.max(1e-6, s.cum[i] - s.cum[i - 1]); return [s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * f, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * f]; }
      return s.pts[s.pts.length - 1];
    }
    g.font = '600 11px "B612", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    Object.keys(best).forEach(function (name) {
      var s = best[name], tw = g.measureText(name).width;
      if (s.len < tw + 16) return;
      var mid = at(s, s.len / 2), a = at(s, s.len / 2 - tw / 2), b = at(s, s.len / 2 + tw / 2);
      if (mid[0] < 20 || mid[1] < 20 || mid[0] > W - 20 || mid[1] > H - 20) return;
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      var bw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * 13, bh = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * 13;
      if (!free(mid[0] - bw / 2, mid[1] - bh / 2, bw, bh)) return;
      g.save(); g.translate(mid[0], mid[1]); g.rotate(ang);
      g.lineWidth = 3.5; g.strokeStyle = col['land']; g.lineJoin = 'round'; g.strokeText(name, 0, 0);
      g.fillStyle = col['label-strong']; g.globalAlpha = 0.85; g.fillText(name, 0, 0); g.restore();
    });
  }
  function drawHouseNumbers(g, nums, free) {
    g.font = '9px "B612 Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var shown = 0;
    for (var i = 0; i < nums.length && shown < 400; i++) {
      var q = proj(nums[i][1], nums[i][2]); if (q[0] < 0 || q[1] < 0 || q[0] > W || q[1] > H) continue;
      var tw = g.measureText(nums[i][0]).width;
      if (!free(q[0] - tw / 2 - 1, q[1] - 6, tw + 2, 12)) continue;
      g.fillStyle = col['fg-faint']; g.fillText(nums[i][0], q[0], q[1]); shown++;
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
  // Label next to each plane: the route is the headline, type and altitude sit underneath.
  function labelFor(a) {
    var rt = routeOf(a), ty = C.shortType(a.type);
    if (a.mil) return { top: a.call, chip: 'MIL', strong: true, sub: window.MilInfo ? window.MilInfo.label(a, acInfo[a.id]) : ty };
    if (rt) return { top: C.routeText(rt), chip: '', strong: true, sub: ty };
    return { top: a.call, chip: '', strong: false, sub: ty };
  }
  function drawTraffic(t) {
    var hp = homePx(), k = scale(), list = feed.list, sel = null, i, j, ac, ow = overlayW();
    for (i = 0; i < list.length; i++) {
      ac = list[i]; var q = proj(ac.lat, ac.lon); ac.px = q[0]; ac.py = q[1];
      ac.vis = q[0] > -30 && q[1] > -30 && q[0] < W - ow + 30 && q[1] < H + 30;
      if (ac.id === state.selId) sel = ac;
    }
    var wideView = state.range > 40; // zoomed far out: military and the selected plane stand out, the rest become small marks
    for (i = 0; i < list.length; i++) {
      ac = list[i]; var tr = ac.trail, n = tr.length; if (n < 2 || !ac.vis) continue;
      var isSel = ac === sel;
      if (wideView && !isSel && !ac.mil) continue;
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
      var small = wideView && x !== sel && !x.mil;
      S.draw(ctx, { cls: x.cls, type: x.type, x: x.px, y: x.py, track: x.trk, fill: altColor(x.alt, small ? 0.75 : 1), outline: col['land'], scale: x === sel ? 1.12 : small ? 0.42 : wideView ? 0.8 : 1, time: reduced ? 0 : t });
      if (x.mil) brackets(x.px, x.py, 20, col["mil"]);
    });
    // labels: route (or callsign) as the headline, type and altitude underneath, without overlaps
    var boxes = [[hp[0] - 14, hp[1] - 14, 28, 28]];
    var F_TOP = '700 13px "B612 Mono", ui-monospace, monospace', F_TOP2 = '700 11px "B612 Mono", ui-monospace, monospace';
    var F_SUB = '10.5px "B612", system-ui, sans-serif', F_ALT = '10px "B612 Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    order.forEach(function (x) {
      if (x !== sel && !x.mil && (wideView || x.d > state.range * 1.25)) return;
      var L = labelFor(x), alt = C.fmtAlt(x.alt), sub = L.sub ? L.sub + '  ' : '';
      var ftop = L.strong ? F_TOP : F_TOP2;
      ctx.font = ftop; var w1 = ctx.measureText(L.top).width + (L.chip ? 30 : 0);
      ctx.font = F_SUB; var ws = ctx.measureText(sub).width;
      ctx.font = F_ALT; var wa = ctx.measureText(alt).width;
      var w = Math.max(w1, ws + wa) + 4, lx = x.px + 21, ly = x.py - 16, hh = 32;
      var hit = false;
      for (var m = 0; m < boxes.length; m++) { var b = boxes[m]; if (lx < b[0] + b[2] && lx + w > b[0] && ly < b[1] + b[3] && ly + hh > b[1]) { hit = true; break; } }
      if (hit && x !== sel && (!x.mil || wideView)) return; // zoomed far out, crowded military labels give way (the brackets stay)
      boxes.push([lx, ly, w, hh]);
      var cx = lx, ty = x.py - 7, sy = x.py + 9;
      if (L.chip) {
        ctx.font = '700 8.5px "B612 Mono", ui-monospace, monospace';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx, ty - 6.5, 26, 13, 3); else ctx.rect(cx, ty - 6.5, 26, 13);
        ctx.fillStyle = col['mil']; ctx.fill(); ctx.fillStyle = col['land']; ctx.fillText(L.chip, cx + 4, ty + 0.5); cx += 30;
      }
      ctx.lineWidth = 3.4; ctx.strokeStyle = col['land']; ctx.lineJoin = 'round';
      ctx.font = ftop; ctx.strokeText(L.top, cx, ty);
      ctx.fillStyle = L.strong || x === sel ? col['fg'] : col['fg-muted']; ctx.fillText(L.top, cx, ty);
      ctx.lineWidth = 3;
      if (sub) { ctx.font = F_SUB; ctx.strokeText(sub, lx, sy); ctx.fillStyle = col['fg-muted']; ctx.fillText(sub, lx, sy); }
      ctx.font = F_ALT; ctx.strokeText(alt, lx + ws, sy); ctx.fillStyle = altColor(x.alt, 0.95); ctx.fillText(alt, lx + ws, sy);
    });
    drawEdgeMarkers(hp);
  }
  // Military aircraft outside the view get a pointer at the map edge.
  function drawEdgeMarkers(hp) {
    var ow = overlayW(), x0 = 22, y0 = 22, x1 = W - ow - 22, y1 = H - 40, arrows = [], boxes = [];
    var reach = Math.max(40, state.range * 4), shown = 0;
    military().forEach(function (a) {
      if (a.vis || a.d > reach || shown >= 6) return;
      var dx = a.px - hp[0], dy = a.py - hp[1], tt = Infinity;
      if (dx > 0) tt = Math.min(tt, (x1 - hp[0]) / dx); if (dx < 0) tt = Math.min(tt, (x0 - hp[0]) / dx);
      if (dy > 0) tt = Math.min(tt, (y1 - hp[1]) / dy); if (dy < 0) tt = Math.min(tt, (y0 - hp[1]) / dy);
      if (!isFinite(tt) || tt <= 0) return;
      var ex = hp[0] + dx * tt, ey = hp[1] + dy * tt;
      for (var i = 0; i < arrows.length; i++) if (Math.hypot(arrows[i][0] - ex, arrows[i][1] - ey) < 16) return;
      arrows.push([ex, ey]); shown++;
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

  function drawCrosshair() {
    var c = center();
    ctx.save(); ctx.strokeStyle = col['fg']; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(c[0], c[1], 9, 0, Math.PI * 2);
    ctx.moveTo(c[0] - 18, c[1]); ctx.lineTo(c[0] - 5, c[1]); ctx.moveTo(c[0] + 5, c[1]); ctx.lineTo(c[0] + 18, c[1]);
    ctx.moveTo(c[0], c[1] - 18); ctx.lineTo(c[0], c[1] - 5); ctx.moveTo(c[0], c[1] + 5); ctx.lineTo(c[0], c[1] + 18); ctx.stroke(); ctx.restore();
  }

  /* ---------- panels ---------- */
  function inView() { return feed.list.filter(function (a) { return a.d <= state.range; }).sort(function (a, b) { return a.d - b.d; }); }
  function military() { return feed.list.filter(function (a) { return a.mil && a.d <= MIL_RANGE; }).sort(function (a, b) { return a.d - b.d; }); }
  // Military list filters: search text plus one chip (all, coming my way, helicopters, a branch).
  function inbound(a) { var c = C.cpa(a); return !!(c && !c.receding && c.d < 10 && c.t < 3600); }
  function milMatch(a, f) {
    if (f === 'all') return true;
    if (f === 'inbound') return inbound(a);
    if (f === 'heli') return a.cls === 'heli' || a.cls === 'tiltrotor';
    var k = window.MilInfo ? window.MilInfo.service(a, acInfo[a.id]).key : '';
    return k === f || (f === 'army' && k === 'arng') || (f === 'af' && k === 'ang');
  }
  function milText(a) {
    if (!window.MilInfo) return (a.call + ' ' + a.reg + ' ' + a.type).toLowerCase();
    var b = window.MilInfo.briefing(a, acInfo[a.id]);
    return [a.call, a.reg, a.type, b.aircraft.name, b.aircraft.role, b.service.name, b.service.short, b.mission ? b.mission.title : ''].join(' ').toLowerCase();
  }
  function militaryShown() {
    var f = state.milFilter, q = state.milQuery.trim().toLowerCase();
    var rows = military().filter(function (a) { return milMatch(a, f) && (!q || milText(a).indexOf(q) >= 0); });
    if (f === 'inbound') rows.sort(function (a, b) { return C.cpa(a).t - C.cpa(b).t; });
    return rows;
  }
  function closestMil() { var m = military(); return m[0] || null; }
  function findSel() { for (var i = 0; i < feed.list.length; i++) if (feed.list[i].id === state.selId) return feed.list[i]; return null; }
  // center: keep this plane in the middle of the map as it moves
  function select(id, center) {
    state.selId = id; state.auto = false;
    var a = findSel();
    if (center && a) { follow(a); }
    else if (state.follow && state.follow !== id) stopFollow();
    renderPanels();
  }
  function follow(a) {
    state.follow = a.id; state.panX = a.x; state.panY = a.y;
    $('followBar').hidden = false; text('followText', 'Following ' + a.call);
  }
  function stopFollow() { state.follow = null; $('followBar').hidden = true; }
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
      t.append(b, ' · ' + feed.list.filter(function (a) { return a.source === 'near'; }).length + ' aircraft · ' + ago(state.lastData) + (state.note ? ' · ' + state.note : ''));
    } else if (m === 'paused') t.textContent = 'Feed paused · last ' + (state.lastData ? ago(state.lastData) : 'update a while ago');
    else if (m === 'off') t.textContent = 'Feed off';
    else if (m === 'needs-ok') t.textContent = 'Live feed needs your OK';
    else t.textContent = 'Connecting';
    text('clock', new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }
  function offlineShown() { return (state.mode === 'off' || state.mode === 'paused' || state.mode === 'needs-ok') && !feed.list.length; }
  function renderOffline() {
    var show = offlineShown();
    $('offline').hidden = !show; $('selLive').hidden = show;
    if (!show) return;
    var c = state.mode === 'needs-ok' ? COPY.needsOk : state.mode === 'paused' ? COPY.paused(state.lastData ? ago(state.lastData) : 'a while ago') : COPY.off;
    text('offTitle', c[0]); text('offText', c[1]);
    $('btnStart').hidden = state.mode !== 'needs-ok';
  }
  function renderStats() {
    var rows = inView(), today = startOfDay(), mil = military();
    text('stInView', state.mode === 'live' ? rows.length : '–');
    text('stNearest', rows.length ? rows[0].d.toFixed(1) : '–'); $('stNearest').nextElementSibling.hidden = !rows.length;
    text('stMil', state.milOk ? mil.length : '–');
    text('stPasses', tracker.log.filter(function (p) { return p.ts >= today; }).length);
    text('milCount', state.milOk ? String(mil.length) : '');
    var cm = mil[0];
    text('closestMilText', cm ? cm.call + ' · ' + (cm.d < 10 ? cm.d.toFixed(1) : Math.round(cm.d)) + ' nm ' + C.card8(cm.brg) : state.milOk ? 'none in 250 nm' : '…');
    $('btnClosestMil').disabled = !cm;
    $('btnClosestMil').classList.toggle('near', !!(cm && cm.d < 15));
  }

  function renderSel() {
    if (offlineShown()) return;
    var ac = findSel(), rows = inView();
    if (!ac && !state.auto) state.auto = true;
    if (state.auto) { ac = rows[0] || null; state.selId = ac ? ac.id : null; }
    var badges = $('selBadges'); badges.textContent = '';
    if (!ac) {
      text('selCall', '–'); text('selRoute', ''); text('selRouteMore', ''); text('selNote', ''); $('btnBrief').hidden = true; $('selPhotoWrap').hidden = true; text('selType', state.mode === 'live' ? 'Nothing inside ' + state.range + ' nm right now' : 'Waiting for aircraft');
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
    if (lastLookup !== ac.id) { lastLookup = ac.id; T.lookup(ac, hub); }
    var ri = routeInfo[ac.call], ai = acInfo[ac.id];
    text('selRoute', C.routeText(routeOf(ac)));
    var shownRoute = routeOf(ac), riOk = ri && ri.r === shownRoute;
    text('selRouteMore', riOk ? [ri.f && ri.t ? ri.f + ' to ' + ri.t : '', ri.a].filter(Boolean).join(' · ') : (ai && ai.owner && !ac.mil ? ai.owner : ''));
    var br = ac.mil && window.MilInfo ? window.MilInfo.briefing(ac, ai) : null;
    text('selType', [br ? br.aircraft.name : ai && ai.type ? ai.type : ac.typeName, ac.reg && ac.reg !== ac.call ? ac.reg : '', ac.mlat ? 'MLAT position' : ''].filter(Boolean).join(' · ') + (state.auto ? ' · nearest' : ''));
    text('selNote', br ? [br.service.name, br.mission ? br.mission.title : ''].filter(Boolean).join(' · ') : C.callsignNote(ac.call));
    $('btnBrief').hidden = !(br && FB);
    if (ac.mil && T.prefetch) T.prefetch(ac);
    var ph = $('selPhoto'), photo = T.photos && ai && ai.photo;
    $('selPhotoWrap').hidden = !photo;
    if (photo && ph.getAttribute('src') !== photo) ph.setAttribute('src', photo);
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
      var rt = routeOf(ac);
      var sub = ac.mil && window.MilInfo ? window.MilInfo.label(ac, acInfo[ac.id]) : [rt ? ac.call : '', C.shortType(ac.type)].filter(Boolean).join(' · ');
      ul.append(row(ac, function () { select(ac.id); if (isPhone()) window.scrollTo({ top: 0, behavior: 'smooth' }); }, [rt ? C.routeText(rt) : ac.call, sub, C.fmtAlt(ac.alt), ac.d.toFixed(1) + ' nm']));
    });
  }
  function renderMil() {
    var ul = $('milList'), all = military(), rows = militaryShown(); ul.textContent = '';
    $('milChips').querySelectorAll('button').forEach(function (b) {
      var f = b.getAttribute('data-f'), n = all.filter(function (a) { return milMatch(a, f); }).length;
      var c = b.querySelector('.n'); if (!c) { c = document.createElement('span'); c.className = 'n'; b.append(c); }
      c.textContent = state.milOk ? String(n) : '';
    });
    if (!state.milOk) return empty(ul, 'Loading military aircraft within ' + MIL_RANGE + ' nm…');
    if (!all.length) return empty(ul, 'No military aircraft broadcasting within ' + MIL_RANGE + ' nm right now.');
    if (!rows.length) return empty(ul, state.milFilter === 'inbound' ? 'Nothing military is headed close to home right now.' : 'No military aircraft match.');
    rows.forEach(function (ac) {
      var c = C.cpa(ac), coming = inbound(ac);
      var where = coming ? 'in ' + Math.max(1, Math.round(c.t / 60)) + ' min, ' + c.d.toFixed(1) + ' nm' : (ac.d < 10 ? ac.d.toFixed(1) : Math.round(ac.d)) + ' nm ' + C.card8(ac.brg);
      var li = row(ac, function () { select(ac.id, true); if (isPhone()) window.scrollTo({ top: 0, behavior: 'smooth' }); }, [ac.call, window.MilInfo ? window.MilInfo.label(ac, acInfo[ac.id]) : C.shortType(ac.type), C.fmtAlt(ac.alt), where]);
      if (coming) li.firstChild.classList.add('coming');
      ul.append(li);
    });
  }
  var milOnly = false;
  function renderLog() {
    var ul = $('log'), L = milOnly ? tracker.log.filter(function (r) { return r.mil; }) : tracker.log; ul.textContent = '';
    if (!L.length) return empty(ul, milOnly ? 'No military aircraft have passed within ' + C.PASS_NM + ' nm yet.' : 'Flights that pass within ' + C.PASS_NM + ' nm of home are logged here.');
    L.forEach(function (r) {
      var li = document.createElement('li'); li.className = 'row log';
      var t = document.createElement('span'); t.className = 'num'; t.style.textAlign = 'left'; t.textContent = hhmm(r.ts);
      var call = document.createElement('span'); call.className = 'call'; call.textContent = r.route ? C.routeText(r.route) : r.call;
      var sm = document.createElement('small'); sm.textContent = r.mil ? (r.svc ? r.svc + ' · ' : 'MIL · ') + (r.name || r.type) : (r.route ? r.call : C.shortType(r.type)); call.append(sm);
      if (r.mil) { var dot = document.createElement('span'); dot.className = 'milchip'; dot.textContent = 'MIL'; call.prepend(dot); }
      var alt = document.createElement('span'); alt.className = 'num'; alt.textContent = C.fmtAlt(r.alt);
      var d = document.createElement('span'); d.className = 'num'; d.textContent = r.d.toFixed(1) + ' nm';
      li.append(t, call, alt, d); ul.append(li);
    });
  }
  function renderPanels() {
    renderStatus(); renderOffline(); renderStats(); renderSel(); renderMini();
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
  var toastTimer = null, toastId = null;
  function toast(msg, id, kind) {
    var el = $('toast'); el.textContent = msg; el.hidden = false; toastId = id || null; el.classList.toggle('info', kind === 'info');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 9000);
  }
  function notify(title, body, id) {
    if (alertsOn && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body: body, tag: 'mil-' + id, icon: 'icons/icon-192.png' }); } catch (e) {} }
  }
  // Military aircraft within 15 nm get a small note (the big flyby card covers the ones passing close).
  function checkAlerts() {
    var now = Date.now();
    if (FB) FB.check(feed.list);
    feed.list.forEach(function (a) {
      if (!a.mil || a.d > ALERT_NM) return;
      if (alerted[a.id] && now - alerted[a.id] < 3600e3) return;
      alerted[a.id] = now;
      if (FB && (FB.openId() === a.id || FB.shown(a.id))) return; // the flyby card (or its notification) already covered it
      var b = window.MilInfo ? window.MilInfo.briefing(a, acInfo[a.id]) : null;
      var msg = 'Military nearby: ' + a.call + ' · ' + (b ? b.aircraft.name + ', ' + b.service.short : a.typeName) + ' · ' + a.d.toFixed(1) + ' nm ' + C.card8(a.brg) + ', ' + C.fmtAlt(a.alt) + (a.alt < 18000 ? ' ft' : '');
      if (!FB || !FB.isOpen()) toast(msg, a.id);
      if (document.hidden) notify('Plane Sight', msg, a.id);
    });
  }
  $('toast').addEventListener('click', function () {
    this.hidden = true;
    var a = null; for (var i = 0; i < feed.list.length; i++) if (feed.list[i].id === toastId) a = feed.list[i];
    if (a && FB) FB.open(a);
  });

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
    state.tab = v; $('list').hidden = v !== 'now'; $('milList').hidden = v !== 'mil'; $('log').hidden = v !== 'passes'; $('btnAlerts').hidden = v !== 'mil'; $('btnMilOnly').hidden = v !== 'passes'; $('milTools').hidden = v !== 'mil';
    text('listTitle', v === 'now' ? 'In view' : v === 'mil' ? 'Military within ' + MIL_RANGE + ' nm' : 'Passes within ' + C.PASS_NM + ' nm');
    renderPanels();
  });
  $('btnMilOnly').addEventListener('click', function () { milOnly = !milOnly; this.setAttribute('aria-pressed', String(milOnly)); renderPanels(); });
  $('btnCenter').addEventListener('click', function () { stopFollow(); state.panX = 0; state.panY = 0; });
  $('btnStopFollow').addEventListener('click', function () { stopFollow(); });
  // Summary tiles: step through planes in view, center on the nearest, step through military, open passes.
  $('tileInView').addEventListener('click', function () {
    var rows = inView(); if (!rows.length) return;
    state.cycleView = (state.cycleView + 1) % rows.length; select(rows[state.cycleView].id);
  });
  $('tileNearest').addEventListener('click', function () {
    var rows = inView(); if (!rows.length) return;
    state.cycleView = 0; select(rows[0].id, true);
  });
  $('milChips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.milFilter = b.getAttribute('data-f'); state.cycleMil = -1;
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderPanels();
  });
  $('milSearch').addEventListener('input', function () { state.milQuery = this.value; state.cycleMil = -1; renderPanels(); });
  // Always one tap away: the closest military aircraft, centered and followed.
  $('btnClosestMil').addEventListener('click', function () {
    var a = closestMil(); if (!a) return;
    select(a.id, true);
    if (a.d < 20 && state.range > 25) { state.range = 10; syncRangeSeg(); }
  });
  $('tileMil').addEventListener('click', function () {
    var rows = militaryShown(); if (!rows.length) rows = military(); if (!rows.length) return;
    state.cycleMil = (state.cycleMil + 1) % rows.length; select(rows[state.cycleMil].id, true);
    if (state.tab !== 'mil') $('tabSeg').querySelector('button[data-tab="mil"]').click();
  });
  $('tilePasses').addEventListener('click', function () { $('tabSeg').querySelector('button[data-tab="passes"]').click(); });
  /* ---------- map gestures: drag, pinch, scroll wheel, double-tap, press and hold ---------- */
  function rel(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function worldAt(p) { var k = scale(), c = center(); return [(p[0] - c[0]) / k + state.panX, -(p[1] - c[1]) / k + state.panY]; }
  // Zoom so the map point under screen point p stays put (a followed plane stays centered).
  function zoomAround(p, range, world) {
    state.range = clampRange(range);
    if (!state.follow) { var k = scale(), c = center(); state.panX = world[0] - (p[0] - c[0]) / k; state.panY = world[1] + (p[1] - c[1]) / k; }
    syncRangeSeg();
  }
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); var p = rel(e);
    zoomAround(p, state.range * Math.exp(e.deltaY * 0.0015), worldAt(p));
  }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(function (ev) { canvas.addEventListener(ev, function (e) { e.preventDefault(); }); }); // Safari: zoom the map, not the page
  var pts = new Map(), gest = null, dragged = false, lpTimer = null, lastTap = 0, lastTapP = null, popAt = null;
  function cancelHold() { clearTimeout(lpTimer); lpTimer = null; }
  function startHold(p) {
    cancelHold();
    lpTimer = setTimeout(function () { lpTimer = null; dragged = true; showHomePop(p); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }, 600);
  }
  var lastPointerType = 'mouse';
  canvas.addEventListener('pointerdown', function (e) {
    lastPointerType = e.pointerType;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    var p = rel(e); pts.set(e.pointerId, p);
    if (pts.size === 1) { gest = { pan: true, start: p, px: state.panX, py: state.panY }; dragged = false; startHold(p); }
    else if (pts.size === 2) {
      cancelHold(); var v = Array.from(pts.values()), mid = [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2];
      gest = { pinch: true, d0: Math.max(10, Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1])), r0: state.range, world: worldAt(mid) };
      dragged = true;
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pts.has(e.pointerId) || !gest) return;
    var p = rel(e); pts.set(e.pointerId, p);
    if (gest.pinch && pts.size >= 2) {
      var v = Array.from(pts.values()), mid = [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2], d = Math.max(10, Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]));
      zoomAround(mid, gest.r0 * gest.d0 / d, gest.world);
    } else if (gest.pan) {
      var dx = p[0] - gest.start[0], dy = p[1] - gest.start[1];
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      cancelHold();
      if (!dragged) stopFollow();
      dragged = true; canvas.classList.add('dragging');
      var k = scale(); state.panX = gest.px - dx / k; state.panY = gest.py + dy / k;
    }
  });
  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    var p = pts.get(e.pointerId); pts.delete(e.pointerId); cancelHold();
    if (pts.size === 1) { var q = pts.values().next().value; gest = { pan: true, start: q, px: state.panX, py: state.panY }; return; }
    if (pts.size) return;
    canvas.classList.remove('dragging'); gest = null;
    // double-tap zooms in on that spot
    if (e.type === 'pointerup' && e.pointerType !== 'mouse' && !dragged) {
      var now = Date.now();
      if (now - lastTap < 320 && lastTapP && Math.hypot(p[0] - lastTapP[0], p[1] - lastTapP[1]) < 30) { zoomAround(p, state.range / 2, worldAt(p)); lastTap = 0; dragged = true; }
      else { lastTap = now; lastTapP = p; }
    }
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('dblclick', function (e) { if (lastPointerType !== 'mouse') return; var p = rel(e); zoomAround(p, state.range / 2, worldAt(p)); }); // touch double-taps are handled above
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); dragged = true; showHomePop(rel(e)); });
  canvas.addEventListener('click', function (e) {
    if (dragged) { dragged = false; return; }
    if (!$('homePop').hidden) { hideHomePop(); return; }
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 30;
    feed.list.forEach(function (ac) { if (!ac.vis) return; var d = Math.hypot(ac.px - x, ac.py - y); if (d < bd) { bd = d; best = ac; } });
    if (best) select(best.id); else { state.auto = true; renderPanels(); }
  });

  // Press and hold (or right-click) on the map: set home right there.
  function showHomePop(p) {
    var w = worldAt(p), h = C.getHome(), cosl = Math.cos(h.lat * RAD);
    popAt = { p: p, lat: +(h.lat + w[1] / 60).toFixed(5), lon: +(h.lon + w[0] / (60 * cosl)).toFixed(5), world: w };
    var pop = $('homePop'); pop.hidden = false;
    var pw = pop.offsetWidth || 180, ph = pop.offsetHeight || 80;
    pop.style.left = Math.max(8, Math.min(W - pw - 8, p[0] - pw / 2)) + 'px';
    pop.style.top = Math.max(8, p[1] - ph - 18) + 'px';
  }
  function hideHomePop() { $('homePop').hidden = true; popAt = null; }
  $('btnPopCancel').addEventListener('click', hideHomePop);
  $('btnPopSet').addEventListener('click', function () {
    if (!popAt) return;
    var a = popAt; hideHomePop();
    if (saveHome(a.lat, a.lon, 'My house')) toast('Home set right there. It’s saved in this browser.', null, 'info');
  });
  function drawPopPin() {
    if (!popAt) return;
    var k = scale(), c = center(), x = c[0] + (popAt.world[0] - state.panX) * k, y = c[1] - (popAt.world[1] - state.panY) * k;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = col['home']; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.strokeStyle = col['home']; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }

  /* ---------- phone: small card for the selected plane, and a handle down to the lists ---------- */
  $('miniSel').addEventListener('click', function () { $('selCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('btnPeek').addEventListener('click', function () { document.querySelector('.overlay').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  function renderMini() {
    var mini = $('miniSel'), a = state.auto ? null : findSel();
    if (!a) { mini.hidden = true; return; }
    mini.hidden = false;
    var rt = routeOf(a);
    text('msCall', rt ? C.routeText(rt) : a.call);
    var br = a.mil && window.MilInfo ? window.MilInfo.briefing(a, acInfo[a.id]) : null;
    text('msSub', [rt ? a.call : '', br ? br.aircraft.name + ' · ' + br.service.short : C.shortType(a.type), C.fmtAlt(a.alt) + (a.alt < 18000 ? ' ft' : '')].filter(Boolean).join(' · '));
    text('msNum', (a.d < 10 ? a.d.toFixed(1) : Math.round(a.d)) + ' nm ' + C.card8(a.brg));
    mini.classList.toggle('mil', !!a.mil);
  }

  var DEFAULT_HOME = window.OG_DEFAULT_HOME || { lat: 39.1732, lon: -77.2717, name: 'Germantown, MD' };
  function inMapArea(la, lo) {
    if (!isFinite(la) || !isFinite(lo)) return false;
    if (window.OG_TILES) return Math.abs(la) < 80 && Math.abs(lo) <= 180;
    return Math.abs(la - 39.17) <= 0.35 && Math.abs(lo + 77.27) <= 0.45;
  }
  function applyHome(la, lo, name) {
    C.setHome(la, lo); tracker.reset(feed.list); stopFollow(); state.panX = 0; state.panY = 0;
    text('coords', Math.abs(la).toFixed(2) + '°' + (la >= 0 ? 'N ' : 'S ') + Math.abs(lo).toFixed(2) + '°' + (lo <= 0 ? 'W' : 'E'));
    text('homeLabel', 'Home: ' + (name || la.toFixed(4) + ', ' + lo.toFixed(4)));
    baseKey = '';
  }
  function saveHome(la, lo, name) {
    if (!inMapArea(la, lo)) { text('homeNote', 'That spot is outside the map, which covers about 25 miles around Germantown.'); toast('That spot is outside this map.', null, 'info'); return false; }
    applyHome(la, lo, name); lsSet('og-home', JSON.stringify([la, lo, name || '']));
    text('homeNote', 'Home moved. It’s saved in this browser.');
    closeHome(); return true;
  }
  function closeHome() { $('homeForm').hidden = true; $('btnHome').setAttribute('aria-expanded', 'false'); }
  var canSearch = typeof T.geocode === 'function', canGps = T.name === 'web' && 'geolocation' in navigator;
  $('homeSearchRow').hidden = !canSearch; $('btnHomeGps').hidden = !canGps;
  $('btnHome').addEventListener('click', function () {
    var f = $('homeForm'); f.hidden = !f.hidden; this.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden && canSearch) $('homeQuery').focus();
  });
  $('homeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('homeQuery').value.trim(); if (!q || !canSearch) return;
    text('homeNote', 'Looking up “' + q + '”…');
    T.geocode(q, C.getHome()).then(function (hit) {
      if (!hit) { text('homeNote', 'No match. Try the street address with the town name.'); return; }
      if (!saveHome(hit.lat, hit.lon, hit.name)) return;
      state.range = 0.5; syncRangeSeg(); // street level, so you can check the pin against the buildings and house numbers
      toast(hit.exact ? 'Pinned at ' + hit.name + '. If it’s not exactly on your house, press and hold on your roof to move it.'
        : 'Found the street, not the exact house. Press and hold on your house to pin it exactly.', null, 'info');
    }).catch(function (err) { text('homeNote', err && /Claude app/.test(err.message || '') ? err.message : 'The address lookup didn’t answer. Try again, or use the map center.'); });
  });
  $('btnHomeCenter').addEventListener('click', function () {
    var h = C.getHome(), cosl = Math.cos(h.lat * RAD);
    var la = h.lat + state.panY / 60, lo = h.lon + state.panX / (60 * cosl);
    saveHome(+la.toFixed(5), +lo.toFixed(5), '');
  });
  $('btnHomeGps').addEventListener('click', function () {
    text('homeNote', 'Asking for your location…');
    navigator.geolocation.getCurrentPosition(function (p) {
      if (saveHome(+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5), 'My house')) { state.range = 0.5; syncRangeSeg(); toast('Home set from your location (accurate to about ' + Math.round(p.coords.accuracy) + ' m).', null, 'info'); }
    },
      function () { text('homeNote', 'Location wasn’t shared. Use the search or the map center instead.'); }, { enableHighAccuracy: true, timeout: 10000 });
  });
  $('btnHomeReset').addEventListener('click', function () {
    applyHome(DEFAULT_HOME.lat, DEFAULT_HOME.lon, DEFAULT_HOME.name);
    try { localStorage.removeItem('og-home'); } catch (e) {}
    text('homeNote', 'Home reset to ' + DEFAULT_HOME.name + '.'); closeHome();
  });
  // A private link like #home=39.137,-77.284,Home sets home on this device. The part after # never
  // leaves the browser, and it's removed from the address bar once it's been read.
  // #home= only fills in a device that has no home yet (so a home you fine-tune isn't overwritten
  // every time a shortcut opens); #sethome= always replaces it.
  function homeFromLink() {
    var m = /[#&](set)?home=([-0-9.]+),([-0-9.]+)(?:,([^&]*))?/.exec(location.hash || '');
    if (!m) return false;
    var force = !!m[1], la = +m[2], lo = +m[3], nm = m[4] ? decodeURIComponent(m[4]).slice(0, 40) : 'Home';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (!inMapArea(la, lo)) return false;
    if (!force && lsGet('og-home')) return false;
    lsSet('og-home', JSON.stringify([la, lo, nm]));
    return [la, lo, nm];
  }
  homeFromLink();
  window.addEventListener('hashchange', function () { var h = homeFromLink(); if (h) applyHome(h[0], h[1], h[2]); });
  var savedHome = null;
  try { savedHome = JSON.parse(lsGet('og-home') || 'null'); } catch (e) {}
  if (savedHome && savedHome.length >= 2 && inMapArea(savedHome[0], savedHome[1])) applyHome(savedHome[0], savedHome[1], savedHome[2] || '');
  else applyHome(DEFAULT_HOME.lat, DEFAULT_HOME.lon, DEFAULT_HOME.name);

  /* ---------- feeds (the transport decides where data comes from) ---------- */
  var lastSave = 0, lastLookup = null, startHandler = null;
  // Passes by military aircraft keep who flew them and what they were.
  var recordBase = tracker.record;
  tracker.record = function (ac) {
    if (ac.mil && window.MilInfo && !ac.logged && ac.minD !== undefined && ac.minD < C.PASS_NM) {
      var b = window.MilInfo.briefing(ac, acInfo[ac.id]);
      ac.logged = true;
      tracker.add({ id: ac.id, call: ac.call, type: ac.type, route: '', mil: ac.mil, d: +ac.minD.toFixed(2), alt: Math.round(ac.minAlt), ts: ac.minTs, svc: b.service.short, name: b.aircraft.name });
      return;
    }
    recordBase(ac);
  };
  function loadPasses() { try { JSON.parse(lsGet('og-passes') || '[]').forEach(function (p) { if (p && p.ts) tracker.add(p); }); } catch (e) {} }
  function savePasses() { if (Date.now() - lastSave < 15000) return; lastSave = Date.now(); lsSet('og-passes', JSON.stringify(tracker.log.slice(0, 150))); }
  var lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) { window.addEventListener(ev, function () { lastInput = Date.now(); }, { passive: true }); });
  var hub = {
    home: function () { return C.getHome(); },
    // How often to ask for new positions: quicker while someone is using the page or a military
    // aircraft is close, slower when it's just sitting open, slowest in a background tab.
    pace: function () {
      if (document.hidden) return 'hidden';
      if (Date.now() - lastInput < 10 * 60e3) return 'fast';
      for (var i = 0; i < feed.list.length; i++) { var a = feed.list[i]; if ((a.mil && a.d < 40) || a.d < 3) return 'fast'; }
      return 'idle';
    },
    near: function (snap) {
      if (feed.ingest(snap, 'near', 60000)) { state.lastData = Math.min(Date.now(), snap.now); tracker.update(feed.list, Date.now()); savePasses(); }
    },
    mil: function (snap) {
      feed.ingest(snap, 'mil', 150000); state.milOk = true; state.lastMil = Date.now(); tracker.update(feed.list, Date.now());
    },
    routes: function (map) {
      Object.keys(map || {}).forEach(function (cs) { var r = map[cs]; if (r && r.r) routeInfo[cs] = r; });
    },
    aircraftInfo: function (hex, info) { if (info) acInfo[hex] = Object.assign(acInfo[hex] || {}, info); },
    passes: function (list) { (list || []).forEach(function (p) { if (p && p.ts) tracker.add(p); }); },
    passList: function () { return tracker.log; },
    selected: function () { return findSel(); },
    setMode: function (m, note, lastData) {
      if (lastData) state.lastData = lastData;
      if (state.mode === m && state.note === (note || '')) return;
      state.mode = m; state.note = note || ''; renderPanels();
    },
    onStart: function (fn) { startHandler = fn; }
  };
  $('btnStart').addEventListener('click', function () { if (startHandler) startHandler(); });
  $('selPhoto').addEventListener('error', function () { $('selPhotoWrap').hidden = true; var a = findSel(); if (a && acInfo[a.id]) acInfo[a.id].photo = ''; });
  loadPasses();
  T.start(hub);
  var FB = window.Flyby ? window.Flyby.create({
    core: C, list: function () { return feed.list; }, info: function (id) { return acInfo[id]; }, photos: !!T.photos,
    prefetch: function (a) { if (T.prefetch) T.prefetch(a, hub); },
    onTrack: function (id) { select(id, true); if (state.range > 25) { state.range = 10; syncRangeSeg(); } },
    notify: notify
  }) : null;
  $('btnBrief').addEventListener('click', function () { var a = findSel(); if (a && FB) FB.open(a); });

  /* ---------- loop ---------- */
  // Tracking and alerts run on their own timer, so they keep working in a background tab
  // (browsers stop drawing frames there); the map itself is drawn every frame.
  var lastPanel = 0, tileVersion = -1, lastTileDraw = 0, lastFrame = 0;
  function logic() {
    var removed = feed.step();
    tracker.update(feed.list, Date.now());
    removed.forEach(function (ac) { tracker.record(ac); });
    if (state.mode === 'live' && state.lastData && Date.now() - state.lastData > 90000) { state.mode = 'paused'; }
  }
  setInterval(function () {
    if (performance.now() - lastFrame < 1500) return; // frames are running; they do this
    logic(); checkAlerts(); savePasses();
  }, 1000);
  function frame(t) {
    lastFrame = performance.now();
    logic();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state.follow) {
      var fa = null; for (var i = 0; i < feed.list.length; i++) if (feed.list[i].id === state.follow) { fa = feed.list[i]; break; }
      if (!fa) stopFollow();
      else if (Math.hypot(fa.x - state.panX, fa.y - state.panY) > state.range * 0.03) { state.panX = fa.x; state.panY = fa.y; }
    }
    if (window.OG_TILES) { var tv = window.OG_TILES.version(); if (tv !== tileVersion && t - lastTileDraw > 250) { tileVersion = tv; lastTileDraw = t; baseKey = ''; } }
    if (W > 0 && H > 0) { drawBase(); drawTraffic(t); drawHome(t); drawPopPin(); if (!$('homeForm').hidden) drawCrosshair(); }
    if (t - lastPanel > 800) { lastPanel = t; renderPanels(); checkAlerts(); }
    requestAnimationFrame(frame);
  }
  window.PlaneSight = { state: state }; // read-only peek for troubleshooting
  renderPanels();
  requestAnimationFrame(frame);
})();
