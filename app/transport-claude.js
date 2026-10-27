/* Over Germantown — Claude dashboard transport.
   A Claude dashboard can't call outside servers, so on the owner's PC it borrows the Claude desktop
   app's built-in browser (the "host:claude_browser" tools) to load adsb.lol and adsbdb pages and read
   them back. Each update is saved to the dashboard's own store, so the same dashboard on a phone, or
   anywhere without the desktop app, shows the PC's feed live. */
(function () {
  'use strict';
  var C = window.Core, HOST = 'host:claude_browser', MIL_RANGE = 250;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function textOf(res) {
    if (!res) return '';
    if (typeof res.payload === 'string') return res.payload;
    var t = (res.content || []).filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
    if (t) return t;
    try { return JSON.stringify(res.payload); } catch (e) { return ''; }
  }

  var HOSTLESS = { server_not_connected: 1, not_granted: 1, capability_disabled: 1, capability_removed: 1, blocked_by_policy: 1, server_not_found: 1, selection_required: 1 };
  var DECLINED = { cancelled: 1, not_in_manifest: 1, approval_required: 1, consent_required: 1 };
  var ROUTE_HIT = 12 * 3600e3, ROUTE_MISS = 2 * 3600e3;

  function start(hub) {
    var mcp = null, db = null, tabId = null, everHost = false, polling = false, relayOn = false;
    var routes = lsGet('og-routes', {}), acinfo = lsGet('og-acinfo', {}), queue = [], queued = {};
    var nearSnap = null, milSnap = null, lastMil = 0, lastWrite = 0, writing = false, lastSaveCache = 0, lookupsBlocked = false;

    function host(tool, input) { return mcp.callTool(HOST, tool, input, { cache: false }); }
    async function load(url) {
      if (!tabId) {
        var r = await host('preview_start', { url: url });
        var m = /tabId\s+([A-Za-z0-9_.:-]+)/.exec(textOf(r));
        if (!m) { var err = new Error('The app did not report a browser tab.'); err.code = 'tool_error'; throw err; }
        tabId = m[1].replace(/[).,]+$/, '');
      } else {
        await host('navigate', { url: url, tabId: tabId });
      }
      var res = await host('get_page_text', { tabId: tabId, max_chars: 900000 });
      return C.extractJson(textOf(res));
    }
    function fresh(entry, now) { return entry && now - entry.ts < (entry.r ? ROUTE_HIT : ROUTE_MISS); }
    function routeCode(cs) { var e = routes[cs]; return e && e.r ? e.r : ''; }
    function saveCaches() {
      if (Date.now() - lastSaveCache < 20000) return;
      lastSaveCache = Date.now();
      var now = Date.now();
      Object.keys(routes).forEach(function (k) { if (now - routes[k].ts > ROUTE_HIT) delete routes[k]; });
      lsSet('og-routes', routes); lsSet('og-acinfo', acinfo);
    }
    function enqueue(item, front) {
      var key = item.join(':'); if (queued[key]) return;
      queued[key] = 1; if (front) queue.unshift(item); else queue.push(item);
      if (queue.length > 60) { var dropped = queue.pop(); delete queued[dropped.join(':')]; }
    }

    async function lookup(item) {
      var kind = item[0], key = item[1];
      delete queued[item.join(':')];
      try {
        if (kind === 'cs') {
          var j = await load('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(key));
          var f = j.response && j.response.flightroute;
          routes[key] = f && f.origin && f.destination ? {
            r: (f.origin.iata_code || f.origin.icao_code) + '-' + (f.destination.iata_code || f.destination.icao_code),
            f: f.origin.municipality || f.origin.name || '', t: f.destination.municipality || f.destination.name || '',
            a: (f.airline && f.airline.name) || '', ts: Date.now() } : { r: '', ts: Date.now() };
          if (routes[key].r) { var o = {}; o[key] = routes[key]; hub.routes(o); }
        } else {
          var k2 = await load('https://api.adsbdb.com/v0/aircraft/' + key);
          var a = k2.response && k2.response.aircraft;
          acinfo[key] = a ? { type: a.type || '', owner: a.registered_owner || '', ts: Date.now() } : { type: '', owner: '', ts: Date.now() };
          if (a) hub.aircraftInfo(key, acinfo[key]);
        }
      } catch (e) {
        if (e && HOSTLESS[e.code]) throw e;
        if (e && DECLINED[e.code]) lookupsBlocked = true; // adsbdb not allowed: keep the live feed, skip extras
        if (kind === 'cs') routes[key] = { r: '', ts: Date.now() }; // don't retry right away
      }
    }

    async function cycle() {
      var h = hub.home(), now = Date.now();
      var j = await load('https://api.adsb.lol/v2/point/' + h.lat.toFixed(4) + '/' + h.lon.toFixed(4) + '/30');
      var rows = (j.ac || []).map(function (a) { return C.compactRow(a, routeCode((a.flight || '').trim())); }).filter(Boolean);
      nearSnap = { now: j.now || now, ac: rows };
      hub.near(nearSnap); hub.setMode('live', ''); everHost = true;
      rows.map(function (r) { return [C.distanceNm(h.lat, h.lon, r[9], r[10]), r[1]]; }).sort(function (a, b) { return a[0] - b[0]; })
        .forEach(function (x) { if (C.looksLikeAirline(x[1]) && !fresh(routes[x[1]], now)) enqueue(['cs', x[1]]); });

      if (now - lastMil > 60000) {
        lastMil = now;
        try {
          var m = await load('https://api.adsb.lol/v2/mil');
          var mrows = (m.ac || []).filter(function (a) { return typeof a.lat === 'number' && C.distanceNm(h.lat, h.lon, a.lat, a.lon) <= MIL_RANGE; })
            .map(function (a) { var r = C.compactRow(a, ''); if (r && !r[12]) r[12] = 'db'; return r; }).filter(Boolean);
          milSnap = { now: m.now || Date.now(), ac: mrows };
          hub.mil(milSnap);
        } catch (e) { if (e && (HOSTLESS[e.code] || DECLINED[e.code])) throw e; lastMil = now - 30000; }
      }

      var sel = hub.selected();
      if (sel) {
        if (sel.mil && /^[0-9a-f]{6}$/i.test(sel.id) && !acinfo[sel.id]) enqueue(['hex', sel.id], true);
        if (C.looksLikeAirline(sel.call) && !fresh(routes[sel.call], now)) enqueue(['cs', sel.call], true);
      }
      var budget = queue.length > 8 ? 4 : 2;
      for (var n = 0; n < budget && queue.length && !lookupsBlocked; n++) await lookup(queue.shift());
      saveCaches();
      publish();
    }

    function publish() {
      if (!db || writing || !nearSnap || Date.now() - lastWrite < 7000) return;
      writing = true; lastWrite = Date.now();
      var h = hub.home(), calls = {}, hexes = {};
      nearSnap.ac.concat(milSnap ? milSnap.ac : []).forEach(function (r) { calls[r[1]] = 1; hexes[r[0]] = 1; });
      var rsub = {}, asub = {};
      Object.keys(calls).forEach(function (c) { if (routes[c] && routes[c].r) rsub[c] = routes[c]; });
      Object.keys(hexes).forEach(function (x) { if (acinfo[x] && acinfo[x].owner) asub[x] = acinfo[x]; });
      db.doc('live/latest').set({
        now: nearSnap.now, ac: JSON.stringify(nearSnap.ac),
        milNow: milSnap ? milSnap.now : 0, mil: JSON.stringify(milSnap ? milSnap.ac : []),
        routes: JSON.stringify(rsub), acinfo: JSON.stringify(asub),
        passes: JSON.stringify(hub.passList().slice(0, 80)), home: [h.lat, h.lon]
      }).catch(function () {}).then(function () { writing = false; });
    }

    async function hostLoop() {
      if (polling || !mcp) return;
      polling = true;
      var fails = 0;
      while (true) {
        var t0 = Date.now();
        try { await cycle(); fails = 0; }
        catch (e) {
          var code = e && e.code;
          if (HOSTLESS[code]) { polling = false; relay(); return; }
          if (DECLINED[code]) { polling = false; hub.setMode('needs-ok'); return; }
          if (code === 'tool_error' || !code) tabId = null;
          fails++;
          if (!everHost && fails >= 3) { polling = false; relay(); return; }
          if (everHost && fails >= 3) hub.setMode('paused');
        }
        await sleep(fails ? Math.min(30000, 4000 * fails) : Math.max(1500, 9000 - (Date.now() - t0)));
      }
    }

    function relay() {
      if (relayOn) return;
      if (!db) { hub.setMode('off'); return; }
      relayOn = true;
      db.doc('live/latest').onSnapshot(function (s) {
        if (polling) return;
        if (!s.exists) { hub.setMode('off'); return; }
        var d = s.data();
        try { hub.passes(JSON.parse(d.passes || '[]')); } catch (e) {}
        try { hub.routes(JSON.parse(d.routes || '{}')); } catch (e) {}
        try { var ai = JSON.parse(d.acinfo || '{}'); Object.keys(ai).forEach(function (x) { hub.aircraftInfo(x, ai[x]); }); } catch (e) {}
        if (typeof d.now === 'number' && Date.now() - d.now < 90000) {
          try { hub.near({ now: d.now, ac: JSON.parse(d.ac || '[]') }); } catch (e) {}
          try { if (d.milNow) hub.mil({ now: d.milNow, ac: JSON.parse(d.mil || '[]') }); } catch (e) {}
          hub.setMode('live', 'via your PC');
        } else {
          hub.setMode(d.now ? 'paused' : 'off', '', d.now || 0);
        }
      }, function () { relayOn = false; hub.setMode('off'); });
    }

    hub.onStart(function () { hub.setMode('connecting'); hostLoop(); });

    (async function boot() {
      var cl = window.claude;
      if (!cl || typeof cl.use !== 'function') { hub.setMode('off'); return; }
      try { db = await cl.use('db'); } catch (e) { db = null; }
      try { mcp = await cl.use('mcp'); } catch (e) { mcp = null; }
      if (db) {
        db.doc('live/latest').get().then(function (s) {
          if (!s.exists) return;
          var d = s.data();
          try { hub.passes(JSON.parse(d.passes || '[]')); } catch (e) {}
          try { var rr = JSON.parse(d.routes || '{}'); Object.keys(rr).forEach(function (k) { if (!routes[k]) routes[k] = rr[k]; }); hub.routes(rr); } catch (e) {}
        }).catch(function () {});
      }
      if (mcp) hostLoop(); else relay();
    })();
  }

  window.OG_TRANSPORT = {
    name: 'claude', start: start, lookup: function () {}, photos: false,
    copy: {
      off: ['Live feed is off', 'Open this dashboard in the Claude desktop app on your PC. It pulls live flights through the app’s browser, and your phone picks them up from there.'],
      paused: function (ago) { return ['Live feed paused', 'The last update came from your PC ' + ago + '. Open this dashboard in the Claude desktop app on your PC to resume it.']; },
      needsOk: ['Allow the live feed', 'The Claude app asks before this page uses its browser to load flights. Press Start, then choose Allow.']
    }
  };
})();
