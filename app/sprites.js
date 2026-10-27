/* Plane Sight — aircraft sprites.
   Built-in sprites are small top-down vector drawings, nose up, one per aircraft class.
   Drop a PNG named after a class into /sprites (for example sprites/narrow.png) and it replaces the drawing.
   See sprites/README.md for the image spec. */
(function (root) {
  'use strict';
  var CLASSES = ['wide', 'narrow', 'regional', 'bizjet', 'prop', 'heli', 'fighter', 'miltransport', 'tiltrotor', 'drone'];
  var SIZE = { wide: 18, narrow: 15, regional: 13.5, bizjet: 12, prop: 11.5, heli: 12, fighter: 13, miltransport: 18, tiltrotor: 14, drone: 15 };
  var images = {};

  // manifest: { "classes": ["narrow", ...], "types": ["B738", ...] } from sprites/manifest.json
  function loadOverrides(base, manifest) {
    var m = Array.isArray(manifest) ? { classes: manifest } : (manifest || {});
    function load(key, file) {
      var img = new Image();
      img.onload = function () { if (img.naturalWidth) images[key] = img; };
      img.src = base + file;
    }
    (m.classes || []).forEach(function (c) { if (CLASSES.indexOf(c) >= 0) load(c, c + '.png'); });
    (m.types || []).forEach(function (t) { if (/^[A-Z0-9]{2,4}$/.test(t)) load('type:' + t, 'types/' + t + '.png'); });
  }

  function mirror(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    for (var j = pts.length - 1; j >= 0; j--) ctx.lineTo(-pts[j][0], pts[j][1]);
    ctx.closePath();
  }
  function wingPair(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
    ctx.moveTo(-pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) ctx.lineTo(-pts[k][0], pts[k][1]); ctx.closePath();
  }
  function capsule(ctx, hw, y0, y1) {
    ctx.moveTo(-hw, y0 + hw); ctx.arc(0, y0 + hw, hw, Math.PI, 0); ctx.lineTo(hw, y1 - hw * 0.6);
    ctx.quadraticCurveTo(hw * 0.6, y1, 0, y1); ctx.quadraticCurveTo(-hw * 0.6, y1, -hw, y1 - hw * 0.6); ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry) { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }

  // Each body adds its silhouette to the current path, in units where the nose is at y = -1.
  var BODY = {
    narrow: function (c) {
      capsule(c, 0.11, -1, 0.97);
      wingPair(c, [[0.1, -0.14], [0.95, 0.27], [0.95, 0.37], [0.1, 0.2]]);
      wingPair(c, [[0.08, 0.68], [0.38, 0.86], [0.38, 0.94], [0.08, 0.86]]);
      ellipse(c, 0.4, 0.04, 0.07, 0.14); ellipse(c, -0.4, 0.04, 0.07, 0.14);
    },
    wide: function (c) {
      capsule(c, 0.15, -1, 0.97);
      wingPair(c, [[0.13, -0.2], [1.0, 0.3], [1.0, 0.41], [0.13, 0.2]]);
      wingPair(c, [[0.1, 0.66], [0.44, 0.86], [0.44, 0.95], [0.1, 0.86]]);
      ellipse(c, 0.44, 0.03, 0.09, 0.17); ellipse(c, -0.44, 0.03, 0.09, 0.17);
    },
    regional: function (c) {
      capsule(c, 0.1, -1, 0.95);
      wingPair(c, [[0.08, -0.06], [0.82, 0.2], [0.82, 0.3], [0.08, 0.2]]);
      wingPair(c, [[0.05, 0.86], [0.36, 0.94], [0.36, 1.01], [0.05, 0.98]]);
      ellipse(c, 0.17, 0.56, 0.065, 0.13); ellipse(c, -0.17, 0.56, 0.065, 0.13);
    },
    bizjet: function (c) {
      capsule(c, 0.085, -1, 0.92);
      wingPair(c, [[0.07, -0.02], [0.7, 0.28], [0.7, 0.36], [0.07, 0.24]]);
      wingPair(c, [[0.04, 0.86], [0.32, 0.95], [0.32, 1.01], [0.04, 0.99]]);
      ellipse(c, 0.15, 0.52, 0.055, 0.12); ellipse(c, -0.15, 0.52, 0.055, 0.12);
    },
    prop: function (c) {
      mirror(c, [[0, -0.9], [0.09, -0.86], [0.12, -0.5], [0.1, 0.3], [0.05, 0.95]]);
      c.moveTo(-1.0, -0.3); c.lineTo(1.0, -0.3); c.arc(1.0, -0.2, 0.1, -Math.PI / 2, Math.PI / 2); c.lineTo(-1.0, -0.1); c.arc(-1.0, -0.2, 0.1, Math.PI / 2, Math.PI * 1.5); c.closePath();
      c.moveTo(-0.36, 0.76); c.lineTo(0.36, 0.76); c.lineTo(0.36, 0.88); c.lineTo(-0.36, 0.88); c.closePath();
    },
    heli: function (c) {
      ellipse(c, 0, -0.18, 0.3, 0.42);
      c.moveTo(-0.05, 0.18); c.lineTo(0.05, 0.18); c.lineTo(0.04, 0.95); c.lineTo(-0.04, 0.95); c.closePath();
      c.moveTo(-0.2, 0.84); c.lineTo(0.2, 0.84); c.lineTo(0.2, 0.9); c.lineTo(-0.2, 0.9); c.closePath();
    },
    fighter: function (c) {
      mirror(c, [[0, -1.05], [0.07, -0.7], [0.12, -0.25], [0.78, 0.32], [0.78, 0.44], [0.15, 0.42], [0.17, 0.62], [0.46, 0.86], [0.46, 0.96], [0.12, 0.92], [0.08, 1.0]]);
    },
    miltransport: function (c) {
      capsule(c, 0.14, -0.98, 0.95);
      wingPair(c, [[0.12, -0.24], [1.0, 0.02], [1.0, 0.14], [0.12, 0.1]]);
      wingPair(c, [[0.06, 0.84], [0.46, 0.92], [0.46, 1.0], [0.06, 0.98]]);
      [[0.36, -0.12], [0.67, -0.04]].forEach(function (e) { ellipse(c, e[0], e[1], 0.055, 0.13); ellipse(c, -e[0], e[1], 0.055, 0.13); });
    },
    drone: function (c) {
      mirror(c, [[0, -0.95], [0.08, -0.8], [0.09, -0.3], [0.06, 0.6], [0.03, 0.9]]);
      c.moveTo(-1.05, -0.12); c.lineTo(1.05, -0.12); c.lineTo(1.05, -0.04); c.lineTo(-1.05, -0.04); c.closePath();
      wingPair(c, [[0.04, 0.72], [0.34, 0.98], [0.3, 1.02], [0.03, 0.82]]);
    },
    tiltrotor: function (c) {
      capsule(c, 0.12, -0.95, 0.92);
      c.moveTo(-0.62, -0.12); c.lineTo(0.62, -0.12); c.lineTo(0.62, 0.06); c.lineTo(-0.62, 0.06); c.closePath();
      ellipse(c, 0.62, -0.03, 0.08, 0.18); ellipse(c, -0.62, -0.03, 0.08, 0.18);
      c.moveTo(-0.32, 0.8); c.lineTo(0.32, 0.8); c.lineTo(0.32, 0.9); c.lineTo(-0.32, 0.9); c.closePath();
    }
  };

  function rotor(ctx, x, y, r, blades, ang, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.10)'); ctx.fill();
    ctx.rotate(ang); ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (var i = 0; i < blades; i++) { ctx.rotate(Math.PI * 2 / blades); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r); ctx.stroke(); }
    ctx.restore();
  }

  // Draws one aircraft centred on (x, y), rotated to track. fill is the altitude colour.
  function draw(ctx, opt) {
    var cls = BODY[opt.cls] ? opt.cls : 'narrow', s = (SIZE[cls] || 12) * (opt.scale || 1), t = opt.time || 0;
    var img = images['type:' + (opt.type || '')] || images[cls];
    ctx.save(); ctx.translate(opt.x, opt.y);
    if (img) {
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      g.addColorStop(0, opt.fill.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, opt.fill.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(opt.track * Math.PI / 180);
      ctx.drawImage(img, -s * 1.3, -s * 1.3, s * 2.6, s * 2.6);
      ctx.restore(); return;
    }
    // soft shadow, offset the same way whatever the heading
    ctx.save(); ctx.translate(1.6, 2.6); ctx.rotate(opt.track * Math.PI / 180); ctx.scale(s, s);
    ctx.beginPath(); BODY[cls](ctx); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.restore();
    ctx.rotate(opt.track * Math.PI / 180); ctx.scale(s, s);
    ctx.beginPath(); BODY[cls](ctx);
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.2 / s; ctx.strokeStyle = opt.outline; ctx.stroke();
    ctx.fillStyle = opt.fill; ctx.fill();
    // sheen along the top of the fuselage
    if (cls !== 'heli' && cls !== 'fighter') {
      ctx.beginPath(); ctx.moveTo(0, -0.86); ctx.lineTo(0, 0.7);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.stroke();
    }
    // cockpit windows
    ctx.beginPath();
    if (cls === 'heli') ctx.ellipse(0, -0.42, 0.18, 0.13, 0, Math.PI, 0);
    else if (cls === 'fighter') ctx.ellipse(0, -0.5, 0.05, 0.16, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, cls === 'prop' ? -0.62 : -0.84, cls === 'wide' || cls === 'miltransport' ? 0.1 : 0.075, 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,18,14,0.55)'; ctx.fill();
    // moving parts
    var lw = 1.4 / s;
    ctx.lineWidth = Math.max(lw, 0.06);
    if (cls === 'heli') { rotor(ctx, 0, -0.2, 1.05, 2, t * 0.025, 'rgba(235,245,240,0.6)'); }
    if (cls === 'tiltrotor') { rotor(ctx, 0.62, -0.03, 0.46, 3, t * 0.03, 'rgba(235,245,240,0.6)'); rotor(ctx, -0.62, -0.03, 0.46, 3, -t * 0.03, 'rgba(235,245,240,0.6)'); }
    if (cls === 'prop') { ctx.beginPath(); ctx.ellipse(0, -0.96, 0.32, 0.04, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(235,245,240,0.35)'; ctx.fill(); }
    ctx.restore();
  }

  root.Sprites = { draw: draw, loadOverrides: loadOverrides, CLASSES: CLASSES, SIZE: SIZE };
})(window);
