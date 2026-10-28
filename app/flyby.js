/* Plane Sight — the military flyby card.
   When a military aircraft is about to pass close to home, a big card slides up over the map:
   an illustration of the aircraft crossing a night sky, who flies it, what it is and what the
   flight is, with a live countdown to its closest point. It can also be opened by hand from the
   selected-aircraft card ("Briefing"). */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180;
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  var TRIGGER_CPA_NM = 3.5, TRIGGER_NOW_NM = 3, TRIGGER_LOOKAHEAD_S = 300, TRIGGER_MAX_NM = 25, COOLDOWN_MS = 45 * 60e3, SHOW_MS = 40000;

  function create(opt) {
    var C = opt.core, M = root.MilInfo, A = root.MilArt;
    var reduced = false; try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var seen = lsGet('og-flyby-seen', {}), soundOn = lsGet('og-flyby-sound', false), queue = [], cur = null, timer = null, left = 0, paused = false, lastTick = 0;
    (function prune() { var now = Date.now(); Object.keys(seen).forEach(function (k) { if (now - seen[k] > COOLDOWN_MS) delete seen[k]; }); })();

    /* ---------- the card ---------- */
    var root$ = el('div', 'flyby'); root$.hidden = true; root$.setAttribute('role', 'dialog'); root$.setAttribute('aria-modal', 'false'); root$.setAttribute('aria-labelledby', 'fbName');
    root$.innerHTML =
      '<div class="fb-scrim"></div>' +
      '<section class="fb-card">' +
        '<header class="fb-top"><span class="fb-kicker"><i></i><span id="fbKicker">Military flyby</span></span><span class="fb-eta" id="fbEta"></span>' +
          '<button type="button" class="fb-x" id="fbX" aria-label="Close">×</button></header>' +
        '<div class="fb-stage" id="fbStage">' +
          '<div class="fb-stars"></div><div class="fb-moon"></div>' +
          '<div class="fb-cloud c1"></div><div class="fb-cloud c2"></div><div class="fb-cloud c3"></div>' +
          '<div class="fb-ring"></div>' +
          '<svg class="fb-horizon" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 L0 44 C20 40 30 30 44 34 C56 22 70 26 78 36 L96 36 L96 26 L112 18 L128 26 L128 38 C150 30 166 34 176 42 C190 28 210 30 222 40 L240 40 L240 30 L256 22 L272 30 L272 42 C300 36 320 40 336 46 C352 34 372 32 386 44 C400 30 420 28 436 40 L452 40 L452 28 L470 20 L488 28 L488 42 C512 34 540 38 556 46 C572 32 596 30 612 42 C628 36 640 38 652 44 L668 44 L668 32 L684 24 L700 32 L700 44 C720 38 744 34 760 42 C776 36 790 38 800 42 L800 70 Z"/><g class="fb-lights"><rect x="104" y="30" width="3" height="3"/><rect x="118" y="30" width="3" height="3"/><rect x="250" y="34" width="3" height="3"/><rect x="462" y="32" width="3" height="3"/><rect x="476" y="32" width="3" height="3"/><rect x="678" y="36" width="3" height="3"/></g></svg>' +
          '<div class="fb-fly" id="fbFly"><div class="fb-trail"></div><div class="fb-plane" id="fbPlane"></div></div>' +
          '<figure class="fb-photo" id="fbPhotoWrap" hidden><img id="fbPhoto" alt="Photo of this exact aircraft" referrerpolicy="no-referrer"><figcaption>This airframe · airport-data.com</figcaption></figure>' +
          '<span class="fb-formation" id="fbFormation" hidden></span>' +
        '</div>' +
        '<div class="fb-body">' +
          '<div class="fb-id"><div class="fb-names"><h2 id="fbName"></h2><p id="fbSub"></p></div><span class="fb-svc" id="fbSvc"><b id="fbSvcName"></b></span></div>' +
          '<dl class="fb-stats"><div><dt id="fbCpaK">Closest</dt><dd id="fbCpa"></dd></div><div><dt>Altitude</dt><dd id="fbAlt"></dd></div><div><dt>Speed</dt><dd id="fbSpd"></dd></div><div><dt>Heading</dt><dd id="fbHdg"></dd></div></dl>' +
          '<div class="fb-notes"><section id="fbMissionWrap"><h3 id="fbMissionTitle">The flight</h3><p id="fbMission"></p></section><section><h3 id="fbRole">The aircraft</h3><p id="fbAbout"></p></section></div>' +
          '<footer class="fb-actions"><button type="button" class="btn primary" id="fbTrack">Track on map</button><button type="button" class="btn" id="fbClose">Close</button>' +
          '<span class="fb-spacer"></span><button type="button" class="linkbtn" id="fbSound" aria-pressed="false"></button></footer>' +
        '</div>' +
        '<div class="fb-timer" aria-hidden="true"><b id="fbTimer"></b></div>' +
      '</section>';
    document.body.appendChild(root$);
    function $(id) { return document.getElementById(id); }
    function set(id, v) { var e = $(id); if (e.textContent !== String(v)) e.textContent = v; }
    var card = root$.querySelector('.fb-card');

    function syncSound() { $('fbSound').textContent = soundOn ? 'Sound on' : 'Sound off'; $('fbSound').setAttribute('aria-pressed', String(soundOn)); }
    syncSound();
    $('fbSound').addEventListener('click', function () { soundOn = !soundOn; lsSet('og-flyby-sound', soundOn); syncSound(); if (soundOn) chime(); });
    $('fbX').addEventListener('click', close); $('fbClose').addEventListener('click', close);
    root$.querySelector('.fb-scrim').addEventListener('click', close);
    $('fbTrack').addEventListener('click', function () { var id = cur && cur.id; close(); if (id && opt.onTrack) opt.onTrack(id); });
    card.addEventListener('mouseenter', function () { paused = true; }); card.addEventListener('mouseleave', function () { paused = false; });
    card.addEventListener('focusin', function () { paused = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root$.hidden) close(); });
    $('fbPhoto').addEventListener('error', function () { $('fbPhotoWrap').hidden = true; });

    /* ---------- sound: a soft two-note chime, only when turned on ---------- */
    var actx = null;
    function chime() {
      if (!soundOn) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        [[740, 0], [988, 0.16]].forEach(function (n) {
          var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + n[1];
          o.type = 'sine'; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
          o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 1);
        });
      } catch (e) {}
    }

    /* ---------- filling it in ---------- */
    function find(id) { var l = opt.list(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
    function wingmen(a) {
      return opt.list().filter(function (b) {
        if (b === a || !b.mil) return false;
        var dd = Math.hypot(b.x - a.x, b.y - a.y), dt = Math.abs(((b.trk - a.trk) + 540) % 360 - 180);
        return dd < 2 && dt < 40 && Math.abs(b.alt - a.alt) < 1500;
      });
    }
    function render(full) {
      var a = find(cur.id) || cur.ac;
      cur.ac = a;
      var info = opt.info(a.id) || {}, b = M.briefing(a, info);
      if (full || cur.sig !== b.art + b.livery + b.aircraft.name + b.service.key) {
        cur.sig = b.art + b.livery + b.aircraft.name + b.service.key;
        var img = A.heroImage(a.type, b.art);
        var west = a.trk > 180 && a.trk < 360;
        var plane = $('fbPlane');
        plane.innerHTML = img ? '<img class="hero-img" src="' + img + '" alt="Illustration of the aircraft">' :
          A.svg(b.art, b.livery, { mirror: west, twin: !!b.aircraft.twin, boom: !!b.aircraft.boom, dome: !!b.aircraft.dome, single: !!b.aircraft.single, prop: !!b.aircraft.prop, twinTail: !!b.aircraft.twinTail, piloted: !!b.aircraft.piloted });
        $('fbFly').classList.toggle('west', west);
        $('fbFly').classList.toggle('heli', /^heli|tiltrotor/.test(b.art));
        set('fbName', b.aircraft.name);
        var svcEl = $('fbSvc'); svcEl.className = 'fb-svc svc-' + b.service.key; set('fbSvcName', b.service.name);
        set('fbRole', b.aircraft.role); set('fbAbout', b.aircraft.blurb || 'Plane Sight has no notes on this type yet.');
        $('fbMissionWrap').hidden = !b.mission; $('fbMissionWrap').parentNode.classList.toggle('solo', !b.mission);
        if (b.mission) { set('fbMissionTitle', b.mission.title); set('fbMission', b.mission.text); }
        var photo = opt.photos && info.photo;
        $('fbPhotoWrap').hidden = !photo;
        if (photo && $('fbPhoto').getAttribute('src') !== photo) $('fbPhoto').setAttribute('src', photo);
      }
      set('fbSub', [a.call, a.reg && a.reg !== a.call ? a.reg : '', info.owner && !/united states/i.test(info.owner) ? info.owner : ''].filter(Boolean).join(' · '));
      var wm = wingmen(a);
      $('fbFormation').hidden = !wm.length; set('fbFormation', 'Flight of ' + (wm.length + 1));
      wm.forEach(function (w) { seen[w.id] = Date.now(); });
      set('fbAlt', C.fmtAlt(a.alt) + (a.alt < 18000 ? ' ft' : ''));
      set('fbSpd', Math.round(a.gs) + ' kt');
      set('fbHdg', String(Math.round(a.trk) % 360).padStart(3, '0') + '° ' + C.card8(a.trk));
      var c = C.cpa(a), eta = '', cpa = '';
      if (a.d < 1.2 && (!c || c.receding || c.t < 30)) { eta = 'Overhead now'; cpa = a.d.toFixed(1) + ' nm ' + C.card8(a.brg); }
      else if (c && !c.receding && c.t < 1800 && a.d < 60) { eta = 'Closest in ' + mmss(c.t); cpa = c.d.toFixed(1) + ' nm ' + C.card8(c.brg); }
      else if (c && c.receding && a.d < 60) { eta = 'Moving away'; cpa = a.minD !== undefined ? a.minD.toFixed(1) + ' nm' : a.d.toFixed(1) + ' nm'; }
      else { eta = Math.round(a.d) + ' nm ' + C.card8(a.brg) + ' of home'; cpa = '–'; }
      set('fbEta', eta); set('fbCpa', cpa);
      set('fbCpaK', c && c.receding ? 'Closest it came' : 'Closest to home');
    }
    function mmss(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }

    function open(a, manual) {
      cur = { id: a.id, ac: a, manual: !!manual, sig: '' };
      seen[a.id] = Date.now(); lsSet('og-flyby-seen', seen);
      if (opt.prefetch) opt.prefetch(a);
      set('fbKicker', manual ? 'Military aircraft · briefing' : 'Military flyby');
      root$.classList.toggle('manual', !!manual);
      render(true);
      root$.hidden = false;
      root$.classList.remove('in'); void root$.offsetWidth; root$.classList.add('in');
      left = manual ? 60000 : SHOW_MS; paused = false; lastTick = Date.now();
      clearInterval(timer); timer = setInterval(tick, 500);
      if (manual) $('fbClose').focus({ preventScroll: true });
      else chime();
    }
    function close() {
      if (root$.hidden) return;
      root$.hidden = true; clearInterval(timer); timer = null; cur = null;
      if (queue.length) { var next = queue.shift(), a = find(next); if (a) setTimeout(function () { maybeOpen(a); }, 600); }
    }
    function tick() {
      if (!cur) return;
      var now = Date.now(), dt = now - lastTick; lastTick = now;
      if (!paused && !document.hidden) left -= dt;
      var a = find(cur.id);
      if (a) render(false);
      $('fbTimer').style.transform = 'scaleX(' + Math.max(0, left / (cur.manual ? 60000 : SHOW_MS)).toFixed(3) + ')';
      var gone = !a || (!cur.manual && a.d > 8 && C.cpa(a) && C.cpa(a).receding);
      if (left <= 0 || gone) close();
    }
    function maybeOpen(a) {
      if (!root$.hidden) { if (queue.indexOf(a.id) < 0 && (!cur || cur.id !== a.id)) queue.push(a.id); return; }
      open(a, false);
    }

    /* ---------- watching for flybys ---------- */
    function inbound(a) {
      if (!a.mil || !(a.d < TRIGGER_MAX_NM) || a.alt <= 0) return false;
      if (a.d <= TRIGGER_NOW_NM) return true;
      var c = C.cpa(a);
      return !!(c && !c.receding && c.d <= TRIGGER_CPA_NM && c.t <= TRIGGER_LOOKAHEAD_S);
    }
    function check(list) {
      var now = Date.now();
      list.forEach(function (a) {
        if (a.mil && a.d < 60 && opt.prefetch) opt.prefetch(a);
        if (!inbound(a) || (seen[a.id] && now - seen[a.id] < COOLDOWN_MS)) return;
        if (document.hidden) {
          seen[a.id] = now; lsSet('og-flyby-seen', seen);
          var b = M.briefing(a, opt.info(a.id) || {}), c = C.cpa(a);
          if (opt.notify) opt.notify('Military flyby: ' + b.aircraft.name, b.service.name + ' · ' + a.call + (c && !c.receding ? ' · closest ' + c.d.toFixed(1) + ' nm ' + C.card8(c.brg) + ' in ' + mmss(c.t) : ' · ' + a.d.toFixed(1) + ' nm away'), a.id);
          pendingVisible = a.id;
          return;
        }
        maybeOpen(a);
      });
    }
    // Back on the page after a notification: show the card if that aircraft is still close.
    var pendingVisible = null;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || !pendingVisible) return;
      var a = find(pendingVisible); pendingVisible = null;
      if (a && a.d < 12 && root$.hidden) open(a, false);
    });

    return { check: check, open: function (a) { open(a, true); }, isOpen: function () { return !root$.hidden; }, openId: function () { return cur && cur.id; }, brief: function (a) { return M.briefing(a, opt.info(a.id) || {}); } };
  }

  root.Flyby = { create: create };
})(window);
