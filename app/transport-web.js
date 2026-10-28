/* Plane Sight — website transport.
   Aircraft positions come from this site's own /api functions (the community feeds don't allow
   calls straight from a web page). Routes and airframe details come straight from adsb.lol's route
   files and adsbdb, which do allow it, so the server functions stay small and quick.

   How often it asks (each ask is one short server call):
     someone using the page, or military close by: every 10 s
     page open but untouched for 10 minutes:       every 20 s
     page in a background tab:                     every 60 s (so flyby alerts still work) */
(function () {
  'use strict';
  var C = window.Core;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var NEAR_MS = { fast: 10000, idle: 20000, hidden: 60000 }, MIL_MS = { fast: 60000, idle: 60000, hidden: 180000 };
  var ROUTE_HIT = 12 * 3600e3, ROUTE_MISS = 3 * 3600e3;

  /* ---------- routes: adsb.lol's route file for each flight number, kept in this browser ---------- */
  var routes = lsGet('og-routes-web', {}), pending = {}, lastSave = 0;
  (function prune() { var now = Date.now(); Object.keys(routes).forEach(function (k) { var e = routes[k]; if (!e || now - e.ts > (e.legs ? ROUTE_HIT : ROUTE_MISS)) delete routes[k]; }); })();
  function fresh(e, now) { return e && now - e.ts < (e.legs ? ROUTE_HIT : ROUTE_MISS); }
  function fetchRoute(cs) {
    if (pending[cs]) return pending[cs];
    pending[cs] = fetch('https://vrs-standing-data.adsb.lol/routes/' + encodeURIComponent(cs.slice(0, 2)) + '/' + encodeURIComponent(cs) + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        var ap = v && Array.isArray(v._airports) ? v._airports : [];
        routes[cs] = ap.length >= 2 ? { ts: Date.now(), legs: ap.map(function (x) { return [x.iata || x.icao, +x.lat, +x.lon, x.location || '']; }) } : { ts: Date.now() };
      })
      .catch(function () { routes[cs] = { ts: Date.now() }; })
      .then(function () { delete pending[cs]; if (Date.now() - lastSave > 20000) { lastSave = Date.now(); lsSet('og-routes-web', routes); } });
    return pending[cs];
  }
  // The leg this plane is flying right now (a flight number can fly several legs a day).
  function legOf(cs, lat, lon) {
    var e = routes[cs];
    if (!e || !e.legs) return null;
    for (var i = 0; i + 1 < e.legs.length; i++) {
      var A = e.legs[i], B = e.legs[i + 1];
      if (C.onLeg(lat, lon, A[1], A[2], B[1], B[2])) return [A, B];
    }
    return null;
  }

  function start(hub) {
    // Two decimals (about half a mile) is plenty for a 30-mile search and keeps your exact spot private.
    function q() { var h = hub.home(); return '?lat=' + h.lat.toFixed(2) + '&lon=' + h.lon.toFixed(2); }
    function pace() { return hub.pace ? hub.pace() : (document.hidden ? 'hidden' : 'fast'); }
    // Sleep, but wake early (after `fastMs`) if the page comes back to the front or someone starts using it.
    function wait(ms, fastMs) {
      return new Promise(function (res) {
        var t0 = Date.now(), timer = setInterval(function () {
          var el = Date.now() - t0;
          if (el >= ms || (el >= fastMs && pace() === 'fast')) { clearInterval(timer); res(); }
        }, 1000);
      });
    }

    (async function near() {
      var fails = 0, everLive = false;
      while (true) {
        try {
          var r = await fetch('api/planes' + q()), snap = await r.json();
          if (!snap || !Array.isArray(snap.ac)) throw new Error((snap && snap.error) || 'no aircraft list');
          fails = 0; everLive = true;
          var now = Date.now(), want = [];
          snap.ac.forEach(function (row) {
            var cs = row[1];
            if (!C.looksLikeAirline(cs)) return;
            var leg = legOf(cs, row[9], row[10]);
            if (leg) row[13] = leg[0][0] + '-' + leg[1][0];
            else if (!fresh(routes[cs], now)) want.push([C.distanceNm(hub.home().lat, hub.home().lon, row[9], row[10]), cs]);
          });
          hub.near(snap);
          hub.setMode('live', snap.stale ? 'feed slow' : '');
          // look up a few new flight numbers each round, closest first
          want.sort(function (a, b) { return a[0] - b[0]; }).slice(0, 8).forEach(function (w) { fetchRoute(w[1]); });
        } catch (e) {
          fails++;
          if (fails >= 3) hub.setMode(everLive ? 'paused' : 'off');
        }
        await (fails ? sleep(Math.min(30000, 5000 * fails)) : wait(NEAR_MS[pace()] || 10000, NEAR_MS.fast));
      }
    })();

    (async function mil() {
      while (true) {
        var ok = true;
        try {
          var r = await fetch('api/military' + q()), snap = await r.json();
          if (!snap || !Array.isArray(snap.ac)) throw new Error('no list');
          hub.mil(snap);
        } catch (e) { ok = false; }
        await (ok ? wait(MIL_MS[pace()] || 60000, MIL_MS.fast) : sleep(30000));
      }
    })();
  }

  var asked = {};
  // Airframe details (exact variant, owner, photo) from adsbdb. Military aircraft nearby are looked
  // up ahead of time so the flyby card has them ready.
  function prefetch(ac, hub) {
    if (!ac || !ac.id || asked['hex:' + ac.id] || !/^[0-9a-f]{6}$/i.test(ac.id)) return;
    asked['hex:' + ac.id] = 1;
    fetch('https://api.adsbdb.com/v0/aircraft/' + ac.id)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var a = j && j.response && j.response.aircraft;
        if (!a || !hub) return;
        hub.aircraftInfo(ac.id, { type: a.type || '', owner: a.registered_owner || '', photo: a.url_photo_thumbnail || a.url_photo || '' });
      }).catch(function () {});
  }
  // Called for the selected aircraft: route cities and airline, plus airframe details.
  function lookup(ac, hub) {
    if (C.looksLikeAirline(ac.call) && !asked['cs:' + ac.call]) {
      asked['cs:' + ac.call] = 1;
      var cs = ac.call;
      Promise.all([
        routes[cs] && routes[cs].legs ? Promise.resolve() : fetchRoute(cs),
        fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(cs)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (res) {
        var f = res[1] && res[1].response && res[1].response.flightroute, info = {};
        var leg = legOf(cs, ac.lat, ac.lon), airline = (f && f.airline && f.airline.name) || '';
        if (leg) info[cs] = { r: leg[0][0] + '-' + leg[1][0], f: leg[0][3], t: leg[1][3], a: airline };
        else if (f && f.origin && f.destination) info[cs] = {
          r: (f.origin.iata_code || f.origin.icao_code) + '-' + (f.destination.iata_code || f.destination.icao_code),
          f: f.origin.municipality || '', t: f.destination.municipality || '', a: airline,
          o: [f.origin.latitude, f.origin.longitude], d: [f.destination.latitude, f.destination.longitude] };
        if (info[cs]) hub.routes(info);
      });
    }
    prefetch(ac, hub);
  }

  // Address search for the home location (nearby results ranked first).
  function geocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&viewbox=-77.85,39.55,-76.70,38.75&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var h = list && list[0];
        if (!h) return null;
        return { lat: +(+h.lat).toFixed(5), lon: +(+h.lon).toFixed(5), name: String(h.display_name || '').split(',').slice(0, 2).join(',').trim() };
      });
  }

  window.OG_TRANSPORT = { name: 'web', start: start, lookup: lookup, prefetch: prefetch, geocode: geocode, photos: true };
})();
