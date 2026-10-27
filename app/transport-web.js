/* Plane Sight — website transport.
   Gets aircraft from this site's own /api functions, and looks up route and airframe details
   straight from adsbdb (which allows calls from web pages). */
(function () {
  'use strict';
  var C = window.Core;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function start(hub) {
    function q() { var h = hub.home(); return '?lat=' + h.lat.toFixed(3) + '&lon=' + h.lon.toFixed(3); }

    (async function near() {
      var fails = 0, everLive = false;
      while (true) {
        try {
          var r = await fetch('api/planes' + q(), { cache: 'no-store' }), snap = await r.json();
          if (!snap || !Array.isArray(snap.ac)) throw new Error((snap && snap.error) || 'no aircraft list');
          fails = 0; everLive = true;
          hub.near(snap);
          hub.setMode('live', snap.stale ? 'feed slow' : '');
        } catch (e) {
          fails++;
          if (fails >= 3) hub.setMode(everLive ? 'paused' : 'off');
        }
        await sleep(document.hidden ? 30000 : fails ? Math.min(30000, 5000 * fails) : 10000);
      }
    })();

    (async function mil() {
      while (true) {
        var wait = 60000;
        try {
          var r = await fetch('api/military' + q(), { cache: 'no-store' }), snap = await r.json();
          if (!snap || !Array.isArray(snap.ac)) throw new Error('no list');
          hub.mil(snap);
        } catch (e) { wait = 30000; }
        await sleep(document.hidden ? 120000 : wait);
      }
    })();
  }

  var asked = {};
  // Called for the selected aircraft: fill in route cities, airline, operator and a photo.
  function lookup(ac, hub) {
    if (C.looksLikeAirline(ac.call) && !asked['cs:' + ac.call]) {
      asked['cs:' + ac.call] = 1;
      var cs = ac.call, info = {};
      // Cities from adsb.lol's route file (same source as the map labels), airline name from adsbdb.
      Promise.all([
        fetch('https://vrs-standing-data.adsb.lol/routes/' + encodeURIComponent(cs.slice(0, 2)) + '/' + encodeURIComponent(cs) + '.json')
          .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
        fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(cs))
          .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (res) {
        var v = res[0], f = res[1] && res[1].response && res[1].response.flightroute;
        var ap = v && Array.isArray(v._airports) ? v._airports : [];
        var shown = ac.route ? ac.route.split('-') : null, from = null, to = null;
        if (shown && ap.length >= 2) {
          ap.forEach(function (x) { if ((x.iata || x.icao) === shown[0] && !from) from = x; if ((x.iata || x.icao) === shown[1]) to = x; });
        }
        if (from && to) info[cs] = { r: ac.route, f: from.location || '', t: to.location || '', a: (f && f.airline && f.airline.name) || '' };
        else if (f && f.origin && f.destination) info[cs] = {
          r: (f.origin.iata_code || f.origin.icao_code) + '-' + (f.destination.iata_code || f.destination.icao_code),
          f: f.origin.municipality || '', t: f.destination.municipality || '', a: (f.airline && f.airline.name) || '',
          o: [f.origin.latitude, f.origin.longitude], d: [f.destination.latitude, f.destination.longitude] };
        if (info[cs]) hub.routes(info);
      });
    }
    if (ac.id && !asked['hex:' + ac.id] && /^[0-9a-f]{6}$/i.test(ac.id)) {
      asked['hex:' + ac.id] = 1;
      fetch('https://api.adsbdb.com/v0/aircraft/' + ac.id)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var a = j && j.response && j.response.aircraft;
          if (!a) return;
          hub.aircraftInfo(ac.id, { type: a.type || '', owner: a.registered_owner || '', photo: a.url_photo_thumbnail || a.url_photo || '' });
        }).catch(function () {});
    }
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

  window.OG_TRANSPORT = { name: 'web', start: start, lookup: lookup, geocode: geocode, photos: true };
})();
