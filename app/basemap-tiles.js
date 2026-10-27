/* Plane Sight — live base map from OpenFreeMap vector tiles (OpenStreetMap data).
   Tiles are fetched for whatever part of the map is on screen, decoded here, and handed to the
   map drawing as plain lat/lon shapes. Detail follows the zoom: highways and coastlines when
   zoomed out to the 250 nm military view, streets and creeks up close. */
(function () {
  'use strict';
  var TILEJSON = 'https://tiles.openfreemap.org/planet';
  var tileUrl = null, cache = new Map(), inflight = 0, queue = [], listeners = [], MAX_TILES = 500, MAX_INFLIGHT = 6;

  fetch(TILEJSON).then(function (r) { return r.json(); }).then(function (j) {
    tileUrl = (j.tiles && j.tiles[0]) || null; notify();
  }).catch(function () {});

  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---------- Mapbox vector tile decoding ---------- */
  function decodeTile(buf) {
    var b = new Uint8Array(buf), pos = 0;
    function varint() { var r = 0, s = 0, c; do { c = b[pos++]; r += (c & 0x7f) * Math.pow(2, s); s += 7; } while (c & 0x80); return r; }
    function skip(t) { if (t === 0) varint(); else if (t === 1) pos += 8; else if (t === 2) { var l = varint(); pos += l; } else if (t === 5) pos += 4; }
    function str(len) { var s = new TextDecoder().decode(b.subarray(pos, pos + len)); pos += len; return s; }
    function packed() { var l = varint(), e = pos + l, a = []; while (pos < e) a.push(varint()); return a; }
    function msg(end, cb) { while (pos < end) { var k = varint(); cb(Math.floor(k / 8), k & 7); } }
    var layers = {};
    msg(b.length, function (f, t) {
      if (f !== 3) return skip(t);
      var l = varint(), e = pos + l, L = { name: '', feats: [], keys: [], vals: [], extent: 4096 };
      msg(e, function (f2, t2) {
        if (f2 === 1) L.name = str(varint());
        else if (f2 === 2) {
          var fl = varint(), fe = pos + fl, F = { tags: [], type: 0, geom: [] };
          msg(fe, function (f3, t3) { if (f3 === 2) F.tags = packed(); else if (f3 === 3) F.type = varint(); else if (f3 === 4) F.geom = packed(); else skip(t3); });
          L.feats.push(F);
        } else if (f2 === 3) L.keys.push(str(varint()));
        else if (f2 === 4) {
          var vl = varint(), ve = pos + vl, v = null;
          msg(ve, function (f4, t4) {
            if (f4 === 1) v = str(varint());
            else if (f4 === 2) { v = new DataView(b.buffer, b.byteOffset + pos, 4).getFloat32(0, true); pos += 4; }
            else if (f4 === 3) { v = new DataView(b.buffer, b.byteOffset + pos, 8).getFloat64(0, true); pos += 8; }
            else if (f4 === 4 || f4 === 5) v = varint();
            else if (f4 === 6) { var n = varint(); v = (n % 2) ? -(n + 1) / 2 : n / 2; }
            else if (f4 === 7) v = !!varint();
            else skip(t4);
          });
          L.vals.push(v);
        } else if (f2 === 5) L.extent = varint();
        else skip(t2);
      });
      layers[L.name] = L;
    });
    return layers;
  }
  function tags(L, F) { var t = {}; for (var i = 0; i < F.tags.length; i += 2) t[L.keys[F.tags[i]]] = L.vals[F.tags[i + 1]]; return t; }
  function geom(F, ext, z, tx, ty) {
    var rings = [], cur = null, x = 0, y = 0, i = 0, g = F.geom, n2 = Math.pow(2, z);
    while (i < g.length) {
      var c = g[i++], id = c & 7, cnt = c >> 3;
      if (id === 7) { if (cur && cur.length) cur.push(cur[0]); continue; }
      for (var k = 0; k < cnt; k++) {
        var dx = g[i++], dy = g[i++];
        x += (dx >> 1) ^ (-(dx & 1)); y += (dy >> 1) ^ (-(dy & 1));
        if (id === 1) { cur = []; rings.push(cur); }
        var wx = (tx + x / ext) / n2, wy = (ty + y / ext) / n2;
        cur.push([Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI, wx * 360 - 180]);
      }
    }
    rings.forEach(function (r) {
      var b = [90, -90, 180, -180];
      r.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[0] > b[1]) b[1] = p[0]; if (p[1] < b[2]) b[2] = p[1]; if (p[1] > b[3]) b[3] = p[1]; });
      r.b = b;
    });
    return rings;
  }

  var PLACE_TIER = { city: 1, town: 2, village: 3, suburb: 3 };
  function extract(layers, z, x, y) {
    var D = { water: [], wood: [], park: [], river: [], stream: [], major: [], primary: [], secondary: [], boundary: [], places: [], shields: [], airports: [] };
    function each(name, fn) { var L = layers[name]; if (!L) return; L.feats.forEach(function (F) { fn(tags(L, F), F, L.extent); }); }
    each('water', function (t, F, e) { if (F.type === 3) push(D.water, geom(F, e, z, x, y)); });
    each('landcover', function (t, F, e) { if (F.type === 3 && t['class'] === 'wood') push(D.wood, geom(F, e, z, x, y)); });
    each('park', function (t, F, e) { if (F.type === 3 && t['class'] !== 'sustainable' && t['class'] !== 'conservation_district') push(D.park, geom(F, e, z, x, y)); });
    each('waterway', function (t, F, e) { if (F.type === 2) push(t['class'] === 'river' ? D.river : D.stream, geom(F, e, z, x, y)); });
    each('transportation', function (t, F, e) {
      if (F.type !== 2 || t.ramp) return;
      var c = t['class'];
      if (c === 'motorway' || c === 'trunk') push(D.major, geom(F, e, z, x, y));
      else if (c === 'primary') push(D.primary, geom(F, e, z, x, y));
      else if (c === 'secondary') push(D.secondary, geom(F, e, z, x, y));
    });
    each('boundary', function (t, F, e) { if (F.type === 2 && !t.maritime && (t.admin_level === 4 || t.admin_level === 2)) push(D.boundary, geom(F, e, z, x, y)); });
    each('place', function (t, F, e) {
      var tier = PLACE_TIER[t['class']], name = t['name:en'] || t.name;
      if (!tier || !name) return;
      var p = geom(F, e, z, x, y)[0]; if (!p || !p[0]) return;
      D.places.push([name, tier, p[0][0], p[0][1], t.rank || 99]);
    });
    each('transportation_name', function (t, F, e) {
      if (F.type !== 2 || t.network !== 'us-interstate' || !t.ref) return;
      geom(F, e, z, x, y).forEach(function (line) { if (line.length) D.shields.push([String(t.ref).replace(/^I[- ]?/, ''), line[Math.floor(line.length / 2)]]); });
    });
    each('aerodrome_label', function (t, F, e) {
      var code = t.iata || t.icao; if (!code) return;
      var cls = t['class'];
      if (cls !== 'international' && cls !== 'public' && cls !== 'military' && cls !== 'regional' && !t.iata) return;
      var p = geom(F, e, z, x, y)[0]; if (!p || !p[0]) return;
      D.airports.push([code, p[0][0], p[0][1], cls]);
    });
    return D;
  }
  function push(arr, rings) { for (var i = 0; i < rings.length; i++) if (rings[i].length > 1) arr.push(rings[i]); }

  /* ---------- fetching ---------- */
  function key(z, x, y) { return z + '/' + x + '/' + y; }
  function request(z, x, y) {
    var k = key(z, x, y);
    if (cache.has(k) || !tileUrl) return;
    cache.set(k, { state: 'queued', at: Date.now() });
    queue.push([z, x, y]); pump();
  }
  function pump() {
    while (inflight < MAX_INFLIGHT && queue.length) {
      var t = queue.shift(), k = key(t[0], t[1], t[2]);
      var entry = cache.get(k); if (!entry) continue;
      entry.state = 'loading'; inflight++;
      (function (t, k) {
        fetch(tileUrl.replace('{z}', t[0]).replace('{x}', t[1]).replace('{y}', t[2]))
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (buf) { cache.set(k, { state: 'ok', data: extract(decodeTile(buf), t[0], t[1], t[2]), at: Date.now() }); })
          .catch(function () { cache.set(k, { state: 'err', at: Date.now() }); })
          .then(function () { inflight--; trim(); notify(); pump(); });
      })(t, k);
    }
  }
  function trim() {
    if (cache.size <= MAX_TILES) return;
    var arr = Array.from(cache.entries()).filter(function (e) { return e[1].state === 'ok' || e[1].state === 'err'; }).sort(function (a, b) { return a[1].at - b[1].at; });
    for (var i = 0; i < arr.length - MAX_TILES * 0.8; i++) cache.delete(arr[i][0]);
  }
  function lon2x(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
  function lat2y(lat, z) { var r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); }

  // vb: [south, north, west, east]; z: tile zoom. Returns merged layers for the view from loaded tiles.
  function layersFor(vb, z) {
    z = Math.max(3, Math.min(14, z));
    var x0 = lon2x(vb[2], z), x1 = lon2x(vb[3], z), y0 = lat2y(vb[1], z), y1 = lat2y(vb[0], z), n = Math.pow(2, z);
    var out = { water: [], wood: [], park: [], river: [], stream: [], major: [], primary: [], secondary: [], boundary: [], places: [], shields: [], airports: [], loading: 0 };
    var used = {}, count = 0;
    for (var x = x0; x <= x1 && count < 80; x++) for (var y = y0; y <= y1 && count < 80; y++, count++) {
      if (y < 0 || y >= n) continue;
      var xx = ((x % n) + n) % n, k = key(z, xx, y), e = cache.get(k);
      if (!e) { request(z, xx, y); e = cache.get(k); }
      if (e && e.state === 'ok') { if (!used[k]) { used[k] = 1; merge(out, e.data); } e.at = Date.now(); continue; }
      if (!e || e.state !== 'err') out.loading++;
      // show a lower-zoom tile meanwhile
      for (var up = 1; up <= 3; up++) {
        var pk = key(z - up, xx >> up, y >> up), pe = cache.get(pk);
        if (pe && pe.state === 'ok') { if (!used[pk]) { used[pk] = 1; merge(out, pe.data); } break; }
      }
    }
    var seen = {};
    out.places = out.places.filter(function (p) { var kk = p[0] + '|' + p[2].toFixed(2) + '|' + p[3].toFixed(2); if (seen[kk]) return false; seen[kk] = 1; return true; })
      .sort(function (a, b) { return a[1] - b[1] || a[4] - b[4]; });
    var seenA = {};
    out.airports = out.airports.filter(function (a) { if (seenA[a[0]]) return false; seenA[a[0]] = 1; return true; });
    return out;
  }
  function merge(out, d) {
    ['water', 'wood', 'park', 'river', 'stream', 'major', 'primary', 'secondary', 'boundary', 'places', 'shields', 'airports'].forEach(function (k) {
      var a = d[k]; for (var i = 0; i < a.length; i++) out[k].push(a[i]);
    });
  }

  window.OG_TILES = {
    layersFor: layersFor,
    onUpdate: function (fn) { listeners.push(fn); },
    ready: function () { return !!tileUrl; }
  };
})();
