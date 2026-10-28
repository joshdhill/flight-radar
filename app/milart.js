/* Plane Sight — side-view illustrations for the military flyby card.
   Original drawings, one per family of aircraft, painted in the colors of the service flying them.
   Every drawing faces right in a 640 x 260 box. Moving parts carry classes the stylesheet animates:
   .mr (main rotor sweep), .tr (tail rotor spin), .pp (propeller blur), .bcn (beacon), .strobe.
   An image dropped in sprites/hero/<TYPE>.png (or <art>.png) replaces the drawing; see sprites/README.md. */
(function (root) {
  'use strict';
  var uid = 0;

  /* ---------- paint schemes ---------- */
  var PAL = {
    army: { body: '#56624a', top: '#6e7b60', belly: '#3b4434', dark: '#2c3327', mark: 'rgba(20,24,18,0.75)', glass: '#18242a', lowvis: true },
    navy: { body: '#7f8a91', top: '#9ba5ab', belly: '#646e75', dark: '#4f585e', mark: 'rgba(30,36,40,0.7)', glass: '#1a252c', lowvis: true },
    af: { body: '#8a949b', top: '#a6afb5', belly: '#6d777e', dark: '#566067', mark: 'rgba(30,36,40,0.7)', glass: '#1a252c', lowvis: true },
    'af-heli': { body: '#2f4f86', top: '#eef2f5', belly: '#233d69', dark: '#1d3156', mark: '#eef2f5', glass: '#17222b', split: true },
    usmc: { body: '#59645a', top: '#717d72', belly: '#424b43', dark: '#323a33', mark: 'rgba(20,24,20,0.75)', glass: '#18242a', lowvis: true },
    whitetop: { body: '#2a4632', top: '#f2f4f2', belly: '#1f3526', dark: '#182a1e', mark: '#f2f4f2', glass: '#15211c', split: true },
    uscg: { body: '#e0482b', top: '#ee6a4c', belly: '#b9381f', dark: '#8f2a17', mark: '#ffffff', glass: '#1a2228' },
    uscgjet: { body: '#f2f4f5', top: '#ffffff', belly: '#d6dadd', dark: '#9aa2a7', mark: '#e0482b', glass: '#1a2228', stripe: '#e0482b' },
    sam: { body: '#a9c6dc', top: '#f3f6f8', belly: '#93b2c9', dark: '#173a6a', mark: '#173a6a', glass: '#16222c', split: true, cheat: '#173a6a' },
    us: { body: '#878f94', top: '#a3aaae', belly: '#6c7479', dark: '#545b60', mark: 'rgba(30,36,40,0.7)', glass: '#1a252c', lowvis: true },
    foreign: { body: '#7f8a86', top: '#9aa49f', belly: '#646e6a', dark: '#4e5753', mark: 'rgba(30,36,40,0.7)', glass: '#1a252c', lowvis: true }
  };
  function palette(livery, art) {
    if (livery === 'af' && /^heli-(huey|utility)$/.test(art)) return PAL['af-heli'];
    if (livery === 'arng') return PAL.army;
    if (livery === 'ang' || livery === 'ussf') return PAL.af;
    return PAL[livery] || PAL.us;
  }

  /* ---------- helpers ---------- */
  function g(o) { return '<g' + (o ? ' ' + o : '') + '>'; }
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>'; }
  var LINE = 'stroke="rgba(0,0,0,0.22)" stroke-width="1.1" fill="none" stroke-linecap="round"';
  var EDGE = 'stroke="rgba(0,0,0,0.38)" stroke-width="1.2" stroke-linejoin="round"';
  function shade(id, p) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.top + '"/><stop offset="0.42" stop-color="' + p.body + '"/><stop offset="1" stop-color="' + p.belly + '"/></linearGradient>';
  }
  function glassGrad(id, p) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d7b88"/><stop offset="0.35" stop-color="' + p.glass + '"/><stop offset="1" stop-color="#0b1216"/></linearGradient>';
  }
  // Body painted with the scheme: a soft vertical shade, or a two-tone split (white tops, VIP blue and white).
  function body(d, p, ids, splitY, cheatY) {
    var s = path(d, 'url(#' + ids.shade + ')', EDGE);
    if (p.split && splitY) {
      s += '<clipPath id="' + ids.clip + '"><path d="' + d + '"/></clipPath>' +
        g('clip-path="url(#' + ids.clip + ')"') + '<rect x="0" y="0" width="640" height="' + splitY + '" fill="' + p.top + '"/>' +
        '<rect x="0" y="' + (splitY - 6) + '" width="640" height="6" fill="#ffffff" opacity="0.18"/>' +
        (p.cheat && cheatY ? '<rect x="0" y="' + cheatY + '" width="640" height="4" fill="' + p.cheat + '"/>' : '') + '</g>' +
        path(d, 'none', EDGE);
    }
    if (p.stripe && cheatY) {
      s += '<clipPath id="' + ids.clip + 's"><path d="' + d + '"/></clipPath>' + g('clip-path="url(#' + ids.clip + 's)"') +
        '<rect x="0" y="' + cheatY + '" width="640" height="7" fill="' + p.stripe + '"/></g>';
    }
    return s;
  }
  // U.S. national star insignia (low-visibility gray on camouflaged aircraft).
  function roundel(x, y, r, p) {
    var low = p.lowvis, blue = low ? 'rgba(0,0,0,0.0)' : '#1f3b74', ink = low ? p.mark : '#ffffff', red = low ? 'rgba(0,0,0,0)' : '#b3262e';
    var star = [], i;
    for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.38 : r * 0.95; star.push((x + Math.cos(a) * rr).toFixed(1) + ',' + (y + Math.sin(a) * rr).toFixed(1)); }
    return g('opacity="' + (low ? 0.55 : 1) + '"') +
      (low ? '' : '<rect x="' + (x - r * 2.1) + '" y="' + (y - r * 0.38) + '" width="' + r * 4.2 + '" height="' + r * 0.76 + '" fill="' + blue + '"/>') +
      '<rect x="' + (x - r * 1.9) + '" y="' + (y - r * 0.24) + '" width="' + r * 3.8 + '" height="' + r * 0.48 + '" fill="none" stroke="' + ink + '" stroke-width="' + (r * 0.12) + '"/>' +
      (low ? '' : '<rect x="' + (x - r * 1.85) + '" y="' + (y - r * 0.07) + '" width="' + r * 3.7 + '" height="' + r * 0.14 + '" fill="' + red + '"/>') +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (low ? 'none' : blue) + '" stroke="' + ink + '" stroke-width="' + (low ? r * 0.12 : 0) + '"/>' +
      '<polygon points="' + star.join(' ') + '" fill="' + ink + '"/></g>';
  }
  var MIRROR = false;
  // Text stays readable when the drawing is flipped to fly the other way.
  function lettering(x, y, txt, size, p, anchor) {
    return '<text' + (MIRROR ? ' transform="translate(' + (2 * x) + ' 0) scale(-1 1)"' : '') + ' x="' + x + '" y="' + y + '" font-family="B612, system-ui, sans-serif" font-weight="700" font-size="' + size + '" letter-spacing="1.2" fill="' + p.mark + '" text-anchor="' + (anchor || 'middle') + '" opacity="' + (p.lowvis ? 0.6 : 0.95) + '">' + txt + '</text>';
  }
  function wheel(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#15191a" stroke="rgba(255,255,255,0.08)"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.42) + '" fill="#3a4245"/>'; }
  function beacon(x, y) { return '<circle class="bcn" cx="' + x + '" cy="' + y + '" r="3.2" fill="#ff3b3b"/>'; }
  function navLight(x, y, c) { return '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="' + c + '" opacity="0.95"/>'; }
  // Main rotor seen from the side: a faint disc with blades sweeping across it.
  function mainRotor(cx, cy, r, blades) {
    var s = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="6" fill="rgba(230,240,235,0.10)"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="1.4" fill="rgba(230,240,235,0.22)"/>';
    for (var i = 0; i < blades; i++) s += '<rect class="mr mr' + i + '" x="' + (cx - r) + '" y="' + (cy - 2) + '" width="' + (r * 2) + '" height="4" rx="2" fill="#20262a" style="transform-origin:' + cx + 'px ' + cy + 'px;animation-delay:' + (-i * 0.32 / blades).toFixed(3) + 's"/>';
    return s + '<ellipse cx="' + cx + '" cy="' + (cy + 1) + '" rx="9" ry="4.5" fill="#2a3135"/>';
  }
  function tailRotor(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(230,240,235,0.10)" stroke="rgba(230,240,235,0.16)"/>' +
      '<g class="tr" style="transform-origin:' + cx + 'px ' + cy + 'px">' +
      '<rect x="' + (cx - 1.6) + '" y="' + (cy - r) + '" width="3.2" height="' + (r * 2) + '" rx="1.6" fill="#20262a"/>' +
      '<rect x="' + (cx - r) + '" y="' + (cy - 1.6) + '" width="' + (r * 2) + '" height="3.2" rx="1.6" fill="#20262a"/></g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#2a3135"/>';
  }
  // Propeller seen edge-on from the side: a tall thin blur.
  function prop(cx, cy, h) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="5" ry="' + h + '" fill="rgba(230,240,235,0.12)"/>' +
      '<rect class="pp" x="' + (cx - 1.8) + '" y="' + (cy - h) + '" width="3.6" height="' + (h * 2) + '" rx="1.8" fill="#20262a" style="transform-origin:' + cx + 'px ' + cy + 'px"/>' +
      '<ellipse cx="' + (cx + 3) + '" cy="' + cy + '" rx="6" ry="5" fill="#30383c"/>';
  }
  function windowsRow(x0, x1, y, w, h, gap, fill) {
    var s = '';
    for (var x = x0; x + w <= x1; x += w + gap) s += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + Math.min(w, h) / 2 + '" fill="' + fill + '"/>';
    return s;
  }

  /* ---------- drawings ---------- */
  var ART = {};

  function spec(d) { return '<path d="' + d + '" stroke="rgba(255,255,255,0.28)" stroke-width="2" fill="none" stroke-linecap="round"/>'; }
  // Jet engine pod facing right: intake ring at the front, exhaust cone at the back.
  function nacelle(x, y, len, r, p, ids, dim) {
    var s = g(dim ? 'opacity="' + dim + '"' : '') +
      '<path d="M' + (x + len) + ' ' + (y - r) + ' L' + (x + r * 0.6) + ' ' + (y - r * 0.82) + ' C' + x + ' ' + (y - r * 0.7) + ' ' + x + ' ' + (y + r * 0.7) + ' ' + (x + r * 0.6) + ' ' + (y + r * 0.82) + ' L' + (x + len) + ' ' + (y + r) + ' Z" fill="url(#' + ids.shade + ')" ' + EDGE + '/>' +
      '<ellipse cx="' + (x + len) + '" cy="' + y + '" rx="' + (r * 0.32) + '" ry="' + r + '" fill="' + p.dark + '" ' + EDGE + '/>' +
      '<ellipse cx="' + (x + len + 1) + '" cy="' + y + '" rx="' + (r * 0.2) + '" ry="' + (r * 0.72) + '" fill="#14181a"/>' +
      '<path d="M' + (x + r * 0.5) + ' ' + (y - r * 0.5) + ' L' + (x - r * 0.5) + ' ' + y + ' L' + (x + r * 0.5) + ' ' + (y + r * 0.5) + ' Z" fill="#2a3033"/>' +
      '<path d="M' + (x + len - 4) + ' ' + (y - r * 0.55) + ' L' + (x + r) + ' ' + (y - r * 0.5) + '" stroke="rgba(255,255,255,0.22)" stroke-width="1.6"/></g>';
    return s;
  }

  ART['heli-utility'] = function (p, ids, o) {
    var F = 'M484 152 C484 142 478 132 470 126 L452 110 C446 105 438 103 428 103 L404 102 L404 90 C404 86 400 84 394 84 L322 84 C312 84 306 90 302 100 C282 101 262 106 246 112 L172 118 L162 120 L160 134 L176 133 C196 138 230 150 262 162 C286 171 312 175 340 176 L440 175 C462 174 478 166 484 152 Z';
    return [
      path('M172 133 L112 129 C108 129 106 133 108 136 L172 140 Z', p.dark, EDGE),
      path('M176 119 L150 60 C148 56 144 54 140 54 L124 54 L132 74 L150 132 Z', 'url(#' + ids.shade + ')', EDGE),
      body(F, p, ids, 124, 0),
      spec('M310 88 L396 88 M250 113 L180 120 M430 106 L454 112'),
      path('M318 100 L304 96 L296 102 L314 106 Z', '#23282b'),
      '<rect x="345" y="72" width="10" height="14" rx="2" fill="#2a3135"/>',
      mainRotor(350, 70, 218, 4),
      tailRotor(138, 76, 26),
      path('M476 136 C474 128 468 120 460 114 L452 108 L446 108 L446 136 Z', 'url(#' + ids.glass + ')'),
      '<rect x="414" y="110" width="26" height="24" rx="4" fill="url(#' + ids.glass + ')"/>',
      '<rect x="368" y="114" width="24" height="20" rx="3" fill="url(#' + ids.glass + ')"/>',
      '<rect x="330" y="114" width="24" height="20" rx="3" fill="url(#' + ids.glass + ')"/>',
      '<path d="M320 104 L320 170 M402 104 L402 172 M444 106 L446 172 M402 140 L320 140" ' + LINE + '/>',
      '<path d="M444 104 L456 90 M478 160 L490 168" stroke="#2a3135" stroke-width="3" stroke-linecap="round"/>',
      '<path d="M418 174 L428 190" stroke="#2a3135" stroke-width="5" stroke-linecap="round"/><path d="M412 174 L418 188" stroke="#20262a" stroke-width="4" stroke-linecap="round"/>' +
      wheel(418, 190, 9).replace('#15191a', '#0f1213') + wheel(430, 193, 10),
      '<path d="M214 136 L220 158" stroke="#2a3135" stroke-width="3.5"/>' + wheel(221, 160, 6),
      o.letters ? lettering(228, 130, o.letters, 9, p) : '',
      roundel(282, 146, 9, p),
      beacon(330, 84), navLight(482, 152, '#3bff8a')
    ].join('');
  };

  ART['heli-huey'] = function (p, ids, o) {
    var F = 'M474 150 C474 128 464 110 444 104 C430 100 412 98 396 98 L396 92 C396 88 392 86 386 86 L340 86 C330 86 326 92 324 100 L310 102 L292 108 L160 118 L156 128 L292 132 C298 150 316 164 340 166 L436 168 C460 166 474 162 474 150 Z';
    return [
      path('M166 119 L138 66 C136 62 132 60 128 60 L116 60 L124 92 L140 128 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M232 126 L200 124 L196 132 L234 132 Z', p.dark, EDGE),
      tailRotor(126, 78, 20).replace('fill="rgba(230,240,235,0.10)"', 'fill="rgba(230,240,235,0.06)"'),
      body(F, p, ids, 124, 0),
      spec('M332 90 L388 90 M290 110 L170 119'),
      '<rect x="355" y="74" width="8" height="14" rx="2" fill="#2a3135"/>',
      mainRotor(360, 72, 212, 2),
      path('M470 136 C468 120 458 108 442 105 L432 104 L432 138 L470 140 Z', 'url(#' + ids.glass + ')'),
      path('M471 144 C471 152 466 158 454 160 L436 160 L436 146 Z', 'url(#' + ids.glass + ')', 'opacity="0.85"'),
      '<rect x="390" y="108" width="34" height="28" rx="4" fill="url(#' + ids.glass + ')"/>',
      '<rect x="344" y="110" width="30" height="24" rx="3" fill="url(#' + ids.glass + ')"/>',
      '<path d="M336 104 L336 164 M428 102 L430 166" ' + LINE + '/>',
      '<path d="M342 166 L336 186 M436 168 L442 186" stroke="#2a3135" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M300 188 L456 188 C468 188 474 184 476 176" stroke="#23292c" stroke-width="5" fill="none" stroke-linecap="round"/>',
      o.letters ? (p.split ? lettering(392, 154, 'U.S. AIR FORCE', 8.5, p) : lettering(228, 125, o.letters, 8.5, p)) : '',
      p.split ? '' : roundel(306, 142, 8, p),
      beacon(352, 86), navLight(470, 150, '#3bff8a')
    ].join('');
  };

  ART['heli-light'] = function (p, ids, o) {
    var F = 'M472 146 C470 120 452 104 424 100 L370 98 C340 98 318 104 304 114 L170 124 L168 132 L300 136 C312 154 334 164 362 166 L432 166 C458 164 472 158 472 146 Z';
    return [
      path('M178 125 L150 76 L128 74 L136 128 Z', 'url(#' + ids.shade + ')', EDGE),
      '<circle cx="144" cy="108" r="15" fill="' + p.dark + '"/><circle cx="144" cy="108" r="11" fill="rgba(230,240,235,0.12)"/>' +
      '<g class="tr" style="transform-origin:144px 108px"><rect x="142.5" y="97" width="3" height="22" fill="#20262a"/><rect x="133" y="106.5" width="22" height="3" fill="#20262a"/></g>',
      path('M196 130 L170 130 L160 138 L198 136 Z', p.dark),
      body(F, p, ids, 0, 0),
      path('M316 108 C320 96 332 90 350 90 L388 90 C398 90 402 96 402 102 Z', 'url(#' + ids.shade + ')', EDGE),
      '<rect x="356" y="78" width="7" height="14" fill="#2a3135"/>',
      mainRotor(360, 76, 176, 4),
      path('M468 128 C464 114 450 104 430 102 L422 102 L422 132 L466 134 Z', 'url(#' + ids.glass + ')'),
      '<rect x="374" y="108" width="34" height="24" rx="5" fill="url(#' + ids.glass + ')"/>',
      '<rect x="334" y="110" width="28" height="20" rx="4" fill="url(#' + ids.glass + ')"/>',
      p.mark === '#ffffff' ? '<rect x="300" y="138" width="170" height="7" fill="#ffffff" opacity="0.92"/>' : '',
      '<path d="M368 166 L366 184 M440 166 L444 182" stroke="#2a3135" stroke-width="4" stroke-linecap="round"/>' + wheel(366, 186, 8) + wheel(444, 184, 7),
      o.letters ? lettering(236, 130, o.letters, 8.5, p) : '',
      beacon(330, 104), navLight(468, 150, '#3bff8a')
    ].join('');
  };

  ART['heli-attack'] = function (p, ids, o) {
    var F = 'M486 150 C486 144 482 140 476 138 L452 132 L430 122 C420 116 408 114 396 114 L384 114 L380 106 L350 104 L344 96 C340 92 334 90 326 90 L300 90 C292 90 288 96 286 104 C262 108 236 116 214 122 L162 126 L158 136 L214 138 C250 150 290 160 330 164 L430 164 C460 164 482 158 486 150 Z';
    return [
      path('M168 127 L140 72 C138 68 134 66 130 66 L118 66 L126 94 L144 134 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M190 134 L150 134 L148 140 L190 140 Z', p.dark, EDGE),
      body(F, p, ids, 0, 0),
      spec('M296 94 L336 94 M280 106 L220 120'),
      path('M452 132 C448 122 440 116 430 114 L404 114 L404 128 Z', 'url(#' + ids.glass + ')', EDGE),
      path('M398 114 C394 106 386 102 378 102 L360 102 L358 112 Z', 'url(#' + ids.glass + ')', EDGE),
      '<rect x="296" y="116" width="34" height="14" rx="5" fill="' + p.dark + '" ' + EDGE + '/><rect x="290" y="119" width="8" height="9" rx="2" fill="#1c2022"/>',
      '<rect x="326" y="78" width="8" height="14" rx="2" fill="#2a3135"/>',
      mainRotor(330, 76, 200, 4),
      tailRotor(132, 82, 22),
      '<path d="M300 142 L372 142" stroke="' + p.dark + '" stroke-width="6" stroke-linecap="round"/>' +
      '<rect x="304" y="146" width="28" height="11" rx="5" fill="#262c2f"/><rect x="336" y="146" width="30" height="11" rx="5" fill="#262c2f"/>' +
      '<rect x="306" y="159" width="26" height="9" rx="4" fill="#2e3437"/><rect x="338" y="159" width="26" height="9" rx="4" fill="#2e3437"/>',
      '<circle cx="482" cy="152" r="9" fill="#262c2f"/><circle cx="485" cy="152" r="4.5" fill="#56788a"/>',
      '<path d="M446 164 L452 172 L488 174" stroke="#2a3135" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      '<path d="M410 164 L420 184" stroke="#2a3135" stroke-width="4.5" stroke-linecap="round"/>' + wheel(422, 188, 9) +
      '<path d="M172 136 L176 152" stroke="#2a3135" stroke-width="3"/>' + wheel(177, 155, 5),
      o.letters ? lettering(222, 133, o.letters, 8, p) : '',
      beacon(300, 90)
    ].join('');
  };

  ART['heli-tandem'] = function (p, ids, o) {
    var F = 'M486 152 C486 132 474 118 452 114 L190 108 C170 106 156 112 150 124 L148 160 C150 170 160 174 176 174 L460 174 C478 172 486 164 486 152 Z';
    return [
      body(F, p, ids, 0, 0),
      path('M150 124 C150 98 164 80 186 76 L226 76 C236 78 240 88 240 108 L150 112 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M410 116 C412 104 422 98 436 98 L458 98 C466 100 468 106 468 116 Z', 'url(#' + ids.shade + ')', EDGE),
      '<rect x="194" y="62" width="8" height="16" fill="#2a3135"/><rect x="436" y="86" width="8" height="14" fill="#2a3135"/>',
      mainRotor(198, 60, 150, 3), mainRotor(440, 84, 150, 3),
      path('M482 140 C478 126 468 118 454 116 L446 116 L446 142 L482 144 Z', 'url(#' + ids.glass + ')'),
      windowsRow(250, 420, 124, 14, 14, 22, 'url(#' + ids.glass + ')'),
      '<path d="M162 140 L186 140 M176 112 L176 172" ' + LINE + '/>',
      '<rect x="210" y="160" width="60" height="16" rx="7" fill="' + p.dark + '"/><rect x="356" y="160" width="60" height="16" rx="7" fill="' + p.dark + '"/>',
      wheel(226, 186, 9) + wheel(254, 186, 9) + wheel(386, 186, 9) + wheel(412, 186, 9),
      o.letters ? lettering(320, 152, o.letters, 9, p) : '',
      beacon(320, 108)
    ].join('');
  };

  ART.tiltrotor = function (p, ids, o) {
    var F = 'M500 148 C498 134 486 122 466 118 L438 112 L216 112 C196 112 176 106 158 96 L142 98 L152 136 C168 154 190 164 220 166 L460 168 C486 166 500 160 500 148 Z';
    return [
      path('M160 100 L142 50 L124 50 L130 102 Z', p.belly, 'opacity="0.7"'),
      path('M174 102 L156 46 L136 46 L148 106 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M200 122 L150 118 L144 126 L202 128 Z', p.dark, EDGE),
      body(F, p, ids, 0, 0),
      spec('M220 114 L436 114'),
      '<path d="M268 112 L300 98 L408 96 L410 110 Z" fill="' + p.dark + '" ' + EDGE + '/>',
      path('M318 100 C318 90 326 84 338 84 L420 84 C434 84 442 92 442 100 C442 108 434 114 420 114 L338 114 C326 114 318 108 318 100 Z', 'url(#' + ids.shade + ')', EDGE),
      '<path d="M330 88 L420 88" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>',
      '<ellipse cx="452" cy="99" rx="9" ry="96" fill="rgba(230,240,235,0.10)"/>' +
      '<g class="ppr" style="transform-origin:452px 99px"><rect x="450" y="3" width="4" height="192" rx="2" fill="#20262a"/></g>' +
      '<g class="ppr ppr2" style="transform-origin:452px 99px"><rect x="450" y="3" width="4" height="192" rx="2" fill="#20262a" opacity="0.7"/></g>' +
      '<path d="M440 92 C452 92 460 96 460 99 C460 102 452 106 440 106 Z" fill="#2c3337"/>',
      path('M494 136 C490 126 480 120 466 120 L456 120 L456 138 L494 140 Z', 'url(#' + ids.glass + ')'),
      windowsRow(276, 420, 128, 12, 12, 26, 'url(#' + ids.glass + ')'),
      '<path d="M232 118 L232 166 M436 118 L436 166" ' + LINE + '/>',
      '<rect x="300" y="156" width="84" height="15" rx="7" fill="' + p.dark + '" ' + EDGE + '/>',
      o.letters ? lettering(266, 152, o.letters, 9, p) : '',
      roundel(204, 140, 8, p),
      beacon(360, 112), navLight(498, 150, '#3bff8a')
    ].join('');
  };

  ART.airlifter = function (p, ids, o) {
    var F = 'M548 150 C546 136 534 124 514 118 L494 112 L210 110 C186 110 160 100 140 84 L120 84 L124 122 C138 148 166 164 204 168 L510 170 C534 168 548 162 548 150 Z';
    return [
      path('M156 92 L124 30 L100 30 L112 96 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M150 34 L66 26 C62 26 60 30 62 32 L72 38 L148 42 Z', 'url(#' + ids.shade + ')', EDGE),
      nacelle(392, 98, 70, 11, p, ids, 0.55),
      body(F, p, ids, 0, 0),
      spec('M214 112 L490 114 M500 116 L520 122'),
      path('M236 112 C250 98 284 92 330 92 L424 94 C438 96 444 104 444 112 Z', 'url(#' + ids.shade + ')', EDGE),
      '<path d="M352 110 L360 122 M300 108 L306 128" stroke="' + p.dark + '" stroke-width="7" stroke-linecap="round"/>',
      nacelle(330, 132, 62, 13, p, ids),
      nacelle(276, 124, 58, 12, p, ids, 0.9),
      path('M540 138 C536 128 526 122 514 120 L502 120 L502 138 Z', 'url(#' + ids.glass + ')'),
      path('M300 154 L420 154 C428 154 432 160 432 166 L432 172 L300 172 C292 172 288 166 288 162 C288 158 292 154 300 154 Z', p.belly, EDGE),
      '<path d="M226 114 L226 166 M470 112 L470 168 M180 120 L180 160" ' + LINE + '/>',
      windowsRow(446, 470, 128, 6, 6, 8, 'url(#' + ids.glass + ')'),
      o.letters ? lettering(230, 146, o.letters, 9.5, p) : '',
      roundel(190, 138, 8, p),
      beacon(380, 92), navLight(544, 152, '#3bff8a')
    ].join('');
  };

  ART.turboprop = function (p, ids, o) {
    var F = 'M520 148 C520 128 504 116 480 114 L210 114 C188 114 164 106 146 94 L128 96 L136 130 C150 150 172 162 206 166 L484 168 C508 166 520 160 520 148 Z';
    var twin = o.twin;
    return [
      path('M164 100 L136 40 L112 40 L128 104 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M192 108 L136 102 L130 110 L194 116 Z', p.dark),
      twin ? '' : g('opacity="0.6"') + '<rect x="302" y="104" width="58" height="12" rx="6" fill="' + p.belly + '"/>' + prop(298, 110, 40) + '</g>',
      body(F, p, ids, 0, 0),
      '<rect x="250" y="102" width="180" height="12" rx="5" fill="' + p.dark + '"/>',
      path('M352 118 C352 108 360 104 370 104 L434 104 C440 104 444 110 444 116 L444 124 C444 128 440 130 434 130 L362 130 C356 130 352 126 352 120 Z', 'url(#' + ids.shade + ')', EDGE),
      prop(346, 117, 46),
      o.dome ? '<path d="M300 106 L306 90 M360 106 L354 90" stroke="' + p.dark + '" stroke-width="5"/><ellipse cx="330" cy="84" rx="86" ry="12" fill="url(#' + ids.shade + ')" ' + EDGE + '/>' : '',
      path('M514 134 C510 126 500 120 488 120 L478 120 L478 134 Z', 'url(#' + ids.glass + ')'),
      '<rect x="296" y="152" width="96" height="16" rx="7" fill="' + p.belly + '" ' + EDGE + '/>',
      '<path d="M226 118 L226 164 M462 118 L462 166" ' + LINE + '/>',
      o.letters ? lettering(220, 146, o.letters, 9, p) : '',
      roundel(192, 136, 8, p),
      beacon(400, 113), navLight(516, 150, '#3bff8a')
    ].join('');
  };

  // Low-wing jets: tankers, AWACS, 707s, 737s, 757s, 747s.
  ART.tanker = function (p, ids, o) {
    var F = 'M556 146 C552 132 538 122 516 120 L190 118 C166 118 146 112 128 102 L112 104 L118 128 C130 146 150 158 186 162 L520 164 C544 162 556 156 556 146 Z';
    var twin = o.twin;
    return [
      path('M156 106 L118 38 L94 38 L112 112 Z', 'url(#' + ids.shade + ')', EDGE),
      g('opacity="0.6"') + path('M168 120 L110 108 L98 112 L166 128 Z', p.belly) + '</g>',
      twin ? '' : g('opacity="0.55"') + '<rect x="262" y="148" width="52" height="14" rx="7" fill="' + p.belly + '"/></g>',
      path('M392 156 L250 140 L232 146 L360 168 Z', p.dark),
      body(F, p, ids, o.split ? 146 : 0, o.cheat ? 142 : 0),
      path('M178 128 L120 116 L108 122 L176 136 Z', p.dark, EDGE),
      '<path d="M350 158 L352 170" stroke="' + p.dark + '" stroke-width="7"/>' + nacelle(twin ? 318 : 324, twin ? 176 : 174, twin ? 70 : 58, twin ? 12 : 10, p, ids),
      twin ? '' : '<path d="M262 154 L264 164" stroke="' + p.dark + '" stroke-width="6"/>' + nacelle(240, 168, 54, 9, p, ids),
      path('M548 134 C544 128 536 124 526 124 L516 124 L516 134 Z', 'url(#' + ids.glass + ')'),
      o.pax ? windowsRow(200, 500, o.split ? 133 : 128, 5, 7, 9, 'rgba(10,18,22,0.55)') : '',
      o.boom ? '<path d="M140 136 L92 176" stroke="' + p.dark + '" stroke-width="5" stroke-linecap="round"/><path d="M104 166 L96 160 M104 166 L112 172" stroke="' + p.dark + '" stroke-width="3"/>' : '',
      o.dome ? '<path d="M240 118 L246 98 M300 118 L294 98" stroke="' + p.dark + '" stroke-width="6"/><ellipse cx="270" cy="92" rx="70" ry="11" fill="url(#' + ids.shade + ')" ' + EDGE + '/><rect x="210" y="90" width="120" height="4" fill="rgba(0,0,0,0.25)"/>' : '',
      o.letters ? lettering(o.split ? 360 : 240, o.split ? 129 : 146, o.letters, o.split ? 9.5 : 9, p) : '',
      o.split ? '' : roundel(196, 140, 8, p),
      beacon(360, 117), navLight(552, 150, '#3bff8a')
    ].join('');
  };
  ART.jet = function (p, ids, o) { return ART.tanker(p, ids, Object.assign({ twin: true, pax: true, split: p.split, cheat: !!p.cheat }, o)); };

  ART.bizjet = function (p, ids, o) {
    var F = 'M520 146 C516 132 500 124 478 122 L230 120 C206 120 186 116 170 110 L154 112 L160 132 C172 146 192 154 226 156 L484 158 C506 156 520 152 520 146 Z';
    return [
      path('M196 114 L164 58 L142 58 L160 118 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M174 62 L120 58 L120 64 L172 70 Z', p.dark, EDGE),
      path('M380 152 L280 140 L268 146 L360 164 Z', p.dark),
      body(F, p, ids, p.split ? 146 : 0, p.cheat ? 142 : (p.stripe ? 144 : 0)),
      '<path d="M226 120 L232 126" stroke="' + p.dark + '" stroke-width="5"/>' + nacelle(196, 117, 58, 10, p, ids),
      path('M512 134 C508 128 500 124 490 124 L480 124 L480 134 Z', 'url(#' + ids.glass + ')'),
      windowsRow(286, 450, p.split ? 132 : 127, 9, 9, 13, 'rgba(10,18,22,0.6)'),
      o.letters ? lettering(370, p.split ? 128 : 150, o.letters, p.split ? 7.5 : 9, p) : '',
      p.split ? '' : roundel(210, 140, 7, p),
      beacon(330, 120), navLight(516, 148, '#3bff8a')
    ].join('');
  };

  ART.twinprop = function (p, ids, o) {
    var single = o.single;
    var F = 'M500 146 C496 132 482 124 462 122 L250 120 C226 120 204 114 186 106 L170 108 L176 130 C188 146 208 154 244 156 L466 158 C488 156 500 152 500 146 Z';
    return [
      path('M206 110 L178 56 L156 56 L176 114 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M186 60 L136 56 L136 62 L184 68 Z', p.dark, EDGE),
      path('M392 150 L300 140 L288 146 L372 160 Z', p.dark),
      body(F, p, ids, 0, 0),
      single ? prop(502, 144, 34) : path('M360 140 C360 132 366 128 376 128 L430 128 C438 128 442 134 442 140 C442 146 438 150 430 150 L372 150 C364 150 360 146 360 140 Z', 'url(#' + ids.shade + ')', EDGE) + prop(446, 139, 32),
      path('M490 134 C486 128 478 124 468 124 L458 124 L458 134 Z', 'url(#' + ids.glass + ')'),
      windowsRow(290, 440, 127, 10, 10, 14, 'rgba(10,18,22,0.6)'),
      o.letters ? lettering(320, 150, o.letters, 8.5, p) : '',
      roundel(232, 140, 7, p),
      beacon(330, 120), navLight(498, 148, '#3bff8a')
    ].join('');
  };

  ART.fighter = function (p, ids, o) {
    var F = 'M552 144 C540 137 520 131 498 128 L470 124 C446 119 420 117 392 117 L250 117 C226 117 206 120 190 124 L160 127 L156 152 L196 156 C240 158 300 160 360 160 L398 162 C420 164 444 162 470 156 C500 150 530 148 552 144 Z';
    return [
      o.twinTail ? g('opacity="0.55"') + path('M236 123 L208 70 L190 70 L204 125 Z', p.belly) + '</g>' : '',
      path('M252 122 L214 58 C212 55 208 54 204 54 L192 54 L208 124 Z', 'url(#' + ids.shade + ')', EDGE),
      path('M236 144 L172 140 L168 148 L236 150 Z', p.dark, EDGE),
      path('M392 146 L262 148 L246 156 L380 152 Z', p.dark),
      body(F, p, ids, 0, 0),
      spec('M380 123 L260 123'),
      path('M500 128 C490 113 472 106 454 106 C440 106 430 111 424 119 L426 122 Z', 'url(#' + ids.glass + ')', EDGE) + '<path d="M488 118 C480 112 470 109 460 109" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>',
      '<path d="M440 158 L398 160 L398 172 C398 174 400 176 402 176 L436 174 C442 174 446 170 446 164 Z" fill="' + p.dark + '" ' + EDGE + '/><path d="M446 160 L446 174 L440 174 Z" fill="#14181a"/>',
      '<path d="M290 160 L284 172 M310 160 L306 172" stroke="' + p.dark + '" stroke-width="4" stroke-linecap="round"/>',
      '<rect x="146" y="128" width="16" height="22" rx="3" fill="#2a2f31"/><ellipse cx="146" cy="139" rx="4" ry="10" fill="#1a1e20"/>',
      '<path d="M380 128 L380 150 M300 124 L300 154" ' + LINE + '/>',
      o.letters ? lettering(330, 145, o.letters, 7, p) : '',
      roundel(270, 138, 6, p),
      navLight(550, 144, '#3bff8a'), beacon(228, 117)
    ].join('');
  };

  ART.drone = function (p, ids, o) {
    var F = 'M520 140 C518 118 500 106 474 106 C450 106 430 116 400 122 L220 128 C196 128 176 126 160 122 L150 128 L162 146 L400 150 C440 152 480 154 500 152 C514 150 520 146 520 140 Z';
    return [
      path('M206 126 L160 76 L144 80 L176 130 Z', 'url(#' + ids.shade + ')', EDGE),
      g('opacity="0.6"') + path('M206 128 L162 82 L150 84 L182 130 Z', p.belly) + '</g>',
      body(F, p, ids, 0, 0),
      o.prop ? prop(150, 136, 26) : path('M220 128 C220 112 232 104 250 104 L300 104 C310 106 314 114 314 124 L314 128 Z', 'url(#' + ids.shade + ')', EDGE) + '<ellipse cx="220" cy="118" rx="6" ry="10" fill="#1c2022"/>',
      '<rect x="300" y="132" width="200" height="5" rx="2.5" fill="' + p.dark + '"/>',
      o.piloted ? path('M476 110 C468 100 450 98 434 104 L428 116 L478 118 Z', 'url(#' + ids.glass + ')', EDGE) : '',
      o.letters ? lettering(320, 146, o.letters, 8, p) : '',
      roundel(250, 140, 6, p),
      beacon(360, 122)
    ].join('');
  };

  var LETTERS = { army: 'U.S. ARMY', navy: 'NAVY', af: 'U.S. AIR FORCE', 'af-heli': 'UNITED STATES OF AMERICA', usmc: 'MARINES', whitetop: 'UNITED STATES OF AMERICA', uscg: 'U.S. COAST GUARD', uscgjet: 'U.S. COAST GUARD', sam: 'UNITED STATES OF AMERICA' };
  var hero = {};
  // svg(art, livery, opts) -> markup. opts: twin, boom, dome, single, prop, twinTail, piloted, mirror (fly left)
  function svg(art, livery, opts) {
    var fn = ART[art] || ART.jet, p = palette(livery, art), id = 'pa' + (++uid);
    var ids = { shade: id + 's', glass: id + 'g', clip: id + 'c' };
    var key = Object.keys(PAL).filter(function (k) { return PAL[k] === p; })[0] || livery;
    var o = Object.assign({ letters: LETTERS[key] || '' }, opts || {});
    MIRROR = !!o.mirror;
    var art = fn(p, ids, o);
    MIRROR = false;
    return '<svg class="hero-art" viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration of the aircraft">' +
      '<defs>' + shade(ids.shade, p) + glassGrad(ids.glass, p) + '</defs>' +
      (o.mirror ? '<g transform="translate(640 0) scale(-1 1)">' + art + '</g>' : art) + '</svg>';
  }
  // Optional painted images (e.g. from Muse), listed in sprites/manifest.json under "hero".
  function loadHero(base, list) { (list || []).forEach(function (k) { if (/^[A-Za-z0-9-]{2,16}$/.test(k)) hero[k] = base + 'hero/' + k + '.png'; }); }
  function heroImage(type, art) { return hero[type] || hero[art] || ''; }

  root.MilArt = { svg: svg, ARTS: Object.keys(ART), loadHero: loadHero, heroImage: heroImage };
})(window);
