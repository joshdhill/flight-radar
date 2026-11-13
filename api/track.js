// GET /api/track?hex=a42f0e
// The path an aircraft has flown so far on its current flight, from the OpenSky Network's
// free REST API (opensky-network.org, non-commercial use). Nothing is stored: each answer is
// fetched when someone selects a plane, and kept briefly so repeat taps don't ask again.
// Answer: { src, path: [[unixSeconds, lat, lon, altFeet|null], ...] } oldest first.

const UA = 'plane-sight/1.0 (personal flight dashboard; github.com/joshdhill/flight-radar)';
const cache = new Map(); // hex -> { at, body }

function reply(body, status = 200, maxAge = 60) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=0, s-maxage=${maxAge}` },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const hex = (url.searchParams.get('hex') || '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return reply({ error: 'hex must be a 6-digit ICAO address' }, 400, 3600);
  const debug = url.searchParams.has('debug');

  const hit = cache.get(hex);
  if (!debug && hit && Date.now() - hit.at < 60000) return reply(hit.body);

  try {
    const res = await fetch(`https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    if (debug) return reply({ status: res.status, remaining: res.headers.get('x-rate-limit-remaining'), head: text.slice(0, 300) }, 200, 0);
    if (res.status === 404) { const body = { src: 'opensky', path: [] }; cache.set(hex, { at: Date.now(), body }); return reply(body); }
    if (!res.ok) throw new Error(`OpenSky answered ${res.status}`);
    const j = JSON.parse(text);
    // waypoints: [time, lat, lon, baro_altitude (m), true_track, on_ground]
    const path = (j.path || []).filter((w) => typeof w[1] === 'number' && typeof w[2] === 'number')
      .map((w) => [w[0], +w[1].toFixed(4), +w[2].toFixed(4), typeof w[3] === 'number' ? Math.round(w[3] * 3.28084) : null]);
    const body = { src: 'opensky', start: j.startTime || null, path };
    cache.set(hex, { at: Date.now(), body });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return reply(body);
  } catch (e) {
    return reply({ error: 'No track available right now.', detail: String(e.message || e) }, 502, 10);
  }
}
