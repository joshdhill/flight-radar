/* Over Germantown — core logic (no DOM): geometry, live feed, tracking, aircraft classes. */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180, NM = 60;
  var home = { lat: 39.1732, lon: -77.2717 };
  var PASS_NM = 5;

  function setHome(lat, lon) { home = { lat: lat, lon: lon }; }
  function getHome() { return home; }
  function toXY(lat, lon) { return { x: (lon - home.lon) * NM * Math.cos(home.lat * RAD), y: (lat - home.lat) * NM }; }
  function bearingOf(x, y) { return (Math.atan2(x, y) / RAD + 360) % 360; }

  /* ---------- aircraft types ---------- */
  var TYPES = {
    A319: 'Airbus A319', A320: 'Airbus A320', A20N: 'Airbus A320neo', A321: 'Airbus A321', A21N: 'Airbus A321neo',
    A332: 'Airbus A330-200', A333: 'Airbus A330-300', A339: 'Airbus A330-900', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000',
    A388: 'Airbus A380', B712: 'Boeing 717', B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900',
    B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9', B752: 'Boeing 757-200', B753: 'Boeing 757-300', B762: 'Boeing 767-200', B763: 'Boeing 767-300',
    B764: 'Boeing 767-400', B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR', B77W: 'Boeing 777-300ER', B788: 'Boeing 787-8', B789: 'Boeing 787-9',
    B78X: 'Boeing 787-10', B744: 'Boeing 747-400', B748: 'Boeing 747-8', B742: 'Boeing 747-200', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
    CRJ2: 'CRJ-200', CRJ7: 'CRJ-700', CRJ9: 'CRJ-900', E135: 'Embraer ERJ-135', E145: 'Embraer ERJ-145', E170: 'Embraer E170',
    E75L: 'Embraer E175', E75S: 'Embraer E175', E190: 'Embraer E190', E195: 'Embraer E195', E290: 'Embraer E190-E2', DH8D: 'Dash 8-400',
    AT72: 'ATR 72', AT76: 'ATR 72-600', MD11: 'MD-11', DC10: 'DC-10',
    C172: 'Cessna 172', C182: 'Cessna 182', C152: 'Cessna 152', C208: 'Cessna Caravan', C210: 'Cessna 210', P28A: 'Piper Cherokee', PA28: 'Piper Cherokee',
    P32R: 'Piper Saratoga', PA46: 'Piper Malibu', SR22: 'Cirrus SR22', SR20: 'Cirrus SR20', DA40: 'Diamond DA40', DA42: 'Diamond DA42',
    BE20: 'King Air 200', BE35: 'Bonanza', BE36: 'Bonanza', BE58: 'Baron', PC12: 'Pilatus PC-12', TBM9: 'TBM 900', M20P: 'Mooney M20',
    C56X: 'Citation Excel', C68A: 'Citation Latitude', C700: 'Citation Longitude', C25A: 'Citation CJ2', C25B: 'Citation CJ3', C25C: 'Citation CJ4',
    C510: 'Citation Mustang', C560: 'Citation V', C680: 'Citation Sovereign', C750: 'Citation X', E55P: 'Phenom 300', E50P: 'Phenom 100',
    E545: 'Praetor 500', E550: 'Praetor 600', CL30: 'Challenger 300', CL35: 'Challenger 350', CL60: 'Challenger 600', GLF4: 'Gulfstream IV',
    GLF5: 'Gulfstream V', GLF6: 'Gulfstream G650', G280: 'Gulfstream G280', GL5T: 'Global 5000', GL7T: 'Global 7500', GLEX: 'Global Express',
    LJ45: 'Learjet 45', LJ60: 'Learjet 60', LJ75: 'Learjet 75', F2TH: 'Falcon 2000', FA7X: 'Falcon 7X', FA8X: 'Falcon 8X', F900: 'Falcon 900',
    PC24: 'Pilatus PC-24', PRM1: 'Premier I', SF50: 'Cirrus Vision Jet', HDJT: 'HondaJet',
    H60: 'Black Hawk', H47: 'Chinook', V22: 'V-22 Osprey', S92: 'Sikorsky S-92', EC35: 'Airbus H135', EC45: 'Airbus H145', H145: 'Airbus H145',
    B407: 'Bell 407', B429: 'Bell 429', B06: 'Bell 206', A109: 'AW109', A139: 'AW139', A169: 'AW169', AS50: 'AStar', AS65: 'Dauphin',
    R44: 'Robinson R44', R22: 'Robinson R22', R66: 'Robinson R66', S76: 'Sikorsky S-76', H64: 'Apache', UH1: 'Huey', UH1Y: 'Venom',
    C130: 'C-130 Hercules', C30J: 'C-130J Super Hercules', C17: 'C-17 Globemaster III', C5M: 'C-5M Super Galaxy', K35R: 'KC-135 Stratotanker',
    KC46: 'KC-46 Pegasus', E3TF: 'E-3 Sentry', E6: 'E-6 Mercury', P8: 'P-8 Poseidon', C40: 'C-40 Clipper', R135: 'RC-135',
    F16: 'F-16 Fighting Falcon', F15: 'F-15 Eagle', F18H: 'F/A-18 Super Hornet', F18S: 'F/A-18 Super Hornet', F35: 'F-35 Lightning II',
    F22: 'F-22 Raptor', A10: 'A-10 Thunderbolt II', T38: 'T-38 Talon', T6: 'T-6 Texan II', TEX2: 'T-6 Texan II', T45: 'T-45 Goshawk',
    C12: 'C-12 Huron', U2: 'U-2 Dragon Lady', E2: 'E-2 Hawkeye', C2: 'C-2 Greyhound', Q4: 'RQ-4 Global Hawk', Q9: 'MQ-9 Reaper',
    A400: 'Airbus A400M', T206: 'Cessna 206', C130H: 'C-130H Hercules', E3CF: 'E-3 Sentry'
  };
  var RE = {
    fighter: /^(F1[4568]|F18|F22|F35|A10|T38|T45|T6|TEX2|EUFI|AV8|F117)/,
    miltransport: /^(C17$|C5M|C130|C30J|C160|A400|KC46|K35R|E3|E6|E8|R135|P8|C2$|E2$)/,
    tiltrotor: /^V22/,
    drone: /^(Q4|Q9|MQ9|MQ1|RQ4|Q1|U2|TR1)$/,
    heli: /^(H60|H47|H64|S92|S76|S70|EC|H1[2-6]|B06|B4[0-9]|B2|A1[0-6]9|AS[0-9]|R[24]4|R22|R66|UH1|MI|NH90|AW|H500|MD5)/,
    wide: /^(A30|A310|A33|A34|A35|A38|B74|B76|B77|B78|MD11|DC10|IL96|L101)/,
    narrow: /^(A31[89]|A32|A20N|A21N|A19N|B73|B3[789]M|B3XM|B75|B712|BCS|MD8|MD9|C40)/,
    regional: /^(CRJ|E1[3-9]|E17|E19|E75|E29|DH8|AT[47]|SF34|SB20|J328|F70|F100)/,
    bizjet: /^(C25|C5[0-9]|C6[58]|C7|E5[045]|E545|E550|CL[36]|GLF|G2|G28|GL[57X]|LJ|F2TH|FA[5-9X]|F900|PC24|PRM|SF50|HDJT|H25|ASTR|GALX|BE40)/,
    prop: /^(C1[0-9]|C2[0-9]|C20|PA|P2|P3|P4|SR2|BE[0-9]|DA[4-6]|M20|PC12|PC6|TBM|AA5|M7|C77|RV|GA8|KODI|CH7|EVOT)/
  };
  // Shape used for the sprite. Military aircraft keep their real shape and get a marker on top.
  function classOf(type, cat) {
    var t = type || '';
    if (RE.tiltrotor.test(t)) return 'tiltrotor';
    if (RE.drone.test(t)) return 'drone';
    if (cat === 'A7' || RE.heli.test(t)) return 'heli';
    if (RE.fighter.test(t)) return 'fighter';
    if (RE.miltransport.test(t)) return 'miltransport';
    if (RE.wide.test(t)) return 'wide';
    if (RE.narrow.test(t)) return 'narrow';
    if (RE.regional.test(t)) return 'regional';
    if (RE.bizjet.test(t)) return 'bizjet';
    if (cat === 'A1' || RE.prop.test(t) || /^B[1-7]$/.test(cat)) return 'prop';
    if (cat === 'A5' || cat === 'A4') return 'wide';
    if (cat === 'A2') return 'bizjet';
    return 'narrow';
  }
  var MIL_LABEL = { db: 'Listed as military', hex: 'US military transponder block', cs: 'Military callsign' };

  /* ---------- live feed ---------- */
  // row: [hex, call, reg, type, cat, alt, gs, trk, vs, lat, lon, ageSec, mil, route, squawk, posSource]
  function deadReckon(ac, nowMs) {
    var el = Math.max(0, Math.min(ac.reckonSec, (nowMs - ac.baseT) / 1000));
    var d = ac.gs / 3600 * el;
    ac.lat = ac.baseLat + d * Math.cos(ac.trk * RAD) / NM;
    ac.lon = ac.baseLon + d * Math.sin(ac.trk * RAD) / (NM * Math.cos(ac.baseLat * RAD));
    ac.alt = Math.max(0, ac.baseAlt + ac.vs / 60 * Math.min(el, 30));
  }
  function createLiveFeed() {
    var F = { list: [], last: {} }, byId = {};
    F.nowMs = function () { return Date.now(); };
    // source: 'near' (every ~10 s) or 'mil' (every ~60 s, wider area)
    F.ingest = function (snap, source, ttlMs) {
      if (!snap || !Array.isArray(snap.ac)) return false;
      if (F.last[source] && snap.now <= F.last[source]) return false;
      F.last[source] = snap.now;
      var now = Date.now();
      snap.ac.forEach(function (r) {
        var id = r[0], ac = byId[id];
        if (!ac) { ac = { id: id, trail: [] }; byId[id] = ac; F.list.push(ac); }
        else if (source === 'mil' && ac.source === 'near' && now - ac.lastSeen < 20000) return; // fresher near data wins
        ac.source = source;
        ac.call = r[1] || r[2] || String(id).toUpperCase(); ac.reg = r[2] || ''; ac.type = r[3] || '';
        ac.typeName = TYPES[ac.type] || ac.type || 'Unknown type';
        ac.cls = classOf(ac.type, r[4]);
        ac.baseAlt = r[5]; ac.gs = r[6]; ac.trk = r[7]; ac.vs = r[8];
        ac.baseLat = r[9]; ac.baseLon = r[10]; ac.baseT = Math.min(now, snap.now) - (r[11] || 0) * 1000; ac.lastSeen = now;
        ac.mil = r[12] || ''; ac.route = r[13] || ''; ac.squawk = r[14] || ''; ac.mlat = r[15] === 'mlat';
        ac.emergency = /^(7500|7600|7700)$/.test(ac.squawk);
        ac.ttl = ttlMs || 60000; ac.reckonSec = Math.min(90, (ttlMs || 60000) / 1000 * 0.75);
        deadReckon(ac, now);
      });
      return true;
    };
    F.step = function () {
      var now = Date.now(), removed = [];
      for (var i = F.list.length - 1; i >= 0; i--) {
        var ac = F.list[i];
        if (now - ac.lastSeen > ac.ttl) { removed.push(ac); F.list.splice(i, 1); delete byId[ac.id]; continue; }
        deadReckon(ac, now);
      }
      return removed;
    };
    return F;
  }

  /* ---------- tracking: distance, trails, passes ---------- */
  function createTracker() {
    var T = { log: [] };
    T.record = function (ac) {
      if (ac.logged || ac.minD === undefined || ac.minD >= PASS_NM) return;
      ac.logged = true;
      T.add({ id: ac.id, call: ac.call, type: ac.type, route: ac.route, mil: ac.mil, d: +ac.minD.toFixed(2), alt: Math.round(ac.minAlt), ts: ac.minTs });
    };
    T.add = function (p) {
      for (var i = 0; i < T.log.length; i++) if (T.log[i].id === p.id && Math.abs(T.log[i].ts - p.ts) < 600000) return false;
      T.log.push(p); T.log.sort(function (a, b) { return b.ts - a.ts; });
      if (T.log.length > 150) T.log.length = 150;
      return true;
    };
    T.update = function (list, nowMs) {
      for (var i = 0; i < list.length; i++) {
        var ac = list[i], p = toXY(ac.lat, ac.lon);
        ac.x = p.x; ac.y = p.y; ac.d = Math.hypot(p.x, p.y); ac.brg = bearingOf(p.x, p.y);
        if (ac.minD === undefined || ac.d < ac.minD) { ac.minD = ac.d; ac.minAlt = ac.alt; ac.minTs = nowMs; }
        if (ac.d < 60 && (ac.lastTrail === undefined || nowMs - ac.lastTrail >= 6000)) {
          ac.lastTrail = nowMs; ac.trail.push({ lat: ac.lat, lon: ac.lon, alt: ac.alt });
          if (ac.trail.length > 50) ac.trail.shift();
        }
        if (!ac.logged && ac.minD < PASS_NM && ac.d > ac.minD + 0.3) T.record(ac);
      }
    };
    T.reset = function (list) { list.forEach(function (ac) { delete ac.minD; ac.logged = false; }); T.log.length = 0; };
    return T;
  }

  function cpa(ac) {
    var v = ac.gs / 3600, vx = v * Math.sin(ac.trk * RAD), vy = v * Math.cos(ac.trk * RAD), v2 = vx * vx + vy * vy;
    if (v2 < 1e-9) return null;
    var t = -(ac.x * vx + ac.y * vy) / v2;
    if (t <= 0) return { t: 0, d: ac.d, receding: true };
    var cx = ac.x + vx * t, cy = ac.y + vy * t;
    return { t: t, d: Math.hypot(cx, cy), brg: bearingOf(cx, cy), x: cx, y: cy, receding: false };
  }

  var ALT_STOPS = [0, 2000, 5000, 10000, 20000, 30000, 40000];
  function altStop(ft) {
    if (ft <= 0) return 0;
    if (ft >= 40000) return 6;
    for (var i = 1; i < ALT_STOPS.length; i++) if (ft <= ALT_STOPS[i]) return i - 1 + (ft - ALT_STOPS[i - 1]) / (ALT_STOPS[i] - ALT_STOPS[i - 1]);
    return 6;
  }
  function fmtAlt(ft) {
    if (ft >= 18000) return 'FL' + String(Math.round(ft / 100)).padStart(3, '0');
    return String(Math.round(ft / 100) * 100);
  }
  function fmtDur(sec) {
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (s === 60) { m++; s = 0; }
    return m > 0 ? m + ' min ' + String(s).padStart(2, '0') + ' s' : s + ' s';
  }
  var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function card8(deg) { return DIRS[Math.round(deg / 45) % 8]; }
  function routeText(r) { return r ? r.replace('-', ' → ') : ''; }


  /* ---------- military helpers (same rules as api/_lib.js) ---------- */
  var MIL_CALLSIGNS = /^(RCH|SAM|PAT|CNV|SPAR|EXEC|AF[12]$|VENUS|NAVY|ARMY|USAF|KING|TEAL|EVAC|BLUE|JEDI|GOLD|SKULL|DUKE|IRON|HAWK)/;
  function militaryFlag(a) {
    if (a.dbFlags & 1) return 'db';
    var n = parseInt(a.hex || '', 16);
    if (n >= 0xae0000 && n <= 0xafffff) return 'hex';
    var cs = (a.flight || '').trim();
    if (cs && MIL_CALLSIGNS.test(cs)) return 'cs';
    return '';
  }
  var CALLSIGN_NOTES = [
    [/^AF1$/, 'Air Force One'], [/^AF2$/, 'Air Force Two'],
    [/^SAM\d/, 'Special Air Mission: VIP transport out of Joint Base Andrews'],
    [/^RCH\d/, 'Reach: Air Mobility Command cargo or tanker flight'],
    [/^PAT\d/, 'Priority Air Transport: Army staff and VIP flight'],
    [/^CNV\d/, 'Convoy: Navy airlift flight'],
    [/^KING\d/, 'King: Air Force rescue (HC-130)'],
    [/^TEAL\d/, 'Teal: Air Force Reserve Hurricane Hunters'],
    [/^C\d{4}$/, 'Coast Guard aircraft']
  ];
  function callsignNote(cs) { for (var i = 0; i < CALLSIGN_NOTES.length; i++) if (CALLSIGN_NOTES[i][0].test(cs || '')) return CALLSIGN_NOTES[i][1]; return ''; }
  function distanceNm(lat1, lon1, lat2, lon2) {
    var dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }
  // readsb/"v2" aircraft object -> compact row (same layout the server sends)
  function compactRow(a, route) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
    if (a.alt_baro === 'ground' || (a.category || '').charAt(0) === 'C') return null;
    var alt = typeof a.alt_baro === 'number' ? a.alt_baro : typeof a.alt_geom === 'number' ? a.alt_geom : null;
    if (alt === null) return null;
    var age = a.seen_pos != null ? a.seen_pos : a.seen || 0;
    if (age > 60) return null;
    return [a.hex, (a.flight || '').trim(), a.r || '', a.t || '', a.category || '', Math.round(alt), Math.round(a.gs || 0),
      Math.round(a.track != null ? a.track : a.true_heading || 0), Math.round(a.baro_rate != null ? a.baro_rate : a.geom_rate || 0),
      +a.lat.toFixed(5), +a.lon.toFixed(5), +(+age).toFixed(1), militaryFlag(a), route || '', a.squawk || '', a.type || ''];
  }
  // pull the JSON object out of page text that may have extra lines around it
  function extractJson(text) {
    var s = text.indexOf('{');
    if (s < 0) throw new Error(text.trim().slice(0, 80) || 'empty answer');
    var depth = 0, inStr = false, esc = false;
    for (var i = s; i < text.length; i++) {
      var ch = text[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return JSON.parse(text.slice(s, i + 1)); }
    }
    throw new Error('answer was cut off');
  }
  function looksLikeAirline(cs) { return /^[A-Z]{3}[0-9][0-9A-Z]{0,4}$/.test(cs || '') && !MIL_CALLSIGNS.test(cs); }

  root.Core = {
    setHome: setHome, getHome: getHome, toXY: toXY, bearingOf: bearingOf, PASS_NM: PASS_NM, MIL_LABEL: MIL_LABEL,
    createLiveFeed: createLiveFeed, createTracker: createTracker, classOf: classOf, cpa: cpa, altStop: altStop,
    fmtAlt: fmtAlt, fmtDur: fmtDur, card8: card8, routeText: routeText, TYPES: TYPES,
    militaryFlag: militaryFlag, callsignNote: callsignNote, distanceNm: distanceNm, compactRow: compactRow, extractJson: extractJson, looksLikeAirline: looksLikeAirline
  };
})(typeof window !== 'undefined' ? window : globalThis);
