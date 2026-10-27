/* Over Germantown — website transport.
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
      fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(ac.call))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var f = j && j.response && j.response.flightroute;
          if (!f || !f.origin || !f.destination) return;
          var info = {}; info[ac.call] = {
            r: (f.origin.iata_code || f.origin.icao_code) + '-' + (f.destination.iata_code || f.destination.icao_code),
            f: f.origin.municipality || f.origin.name || '', t: f.destination.municipality || f.destination.name || '',
            a: (f.airline && f.airline.name) || ''
          };
          hub.routes(info);
        }).catch(function () {});
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

  window.OG_TRANSPORT = { name: 'web', start: start, lookup: lookup, photos: true };
})();
