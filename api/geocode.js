// GET /api/geocode?q=17103+Main+St,+Germantown,+MD&near=39.17,-77.27
// Turns an address into a map point for "Change home". The U.S. Census Bureau's geocoder places a
// house number along its block, so it's usually within a few houses; OpenStreetMap is the fallback
// (and covers places outside the U.S.). Nothing is cached or stored.
const UA = 'plane-sight/1.0 (personal flight dashboard; github.com/joshdhill/flight-radar)';

async function getJson(url, ms) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
}
const title = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

async function census(q) {
  const u = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(q);
  const j = await getJson(u, 8000);
  const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
  if (!m || !m.coordinates) return null;
  const street = String(m.matchedAddress || '').split(',')[0];
  return { lat: +(+m.coordinates.y).toFixed(6), lon: +(+m.coordinates.x).toFixed(6), name: title(street), exact: /^\d/.test(street), source: 'census' };
}

async function osm(q, near) {
  let u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=' + encodeURIComponent(q);
  if (near) u += `&viewbox=${near.lon - 0.6},${near.lat + 0.45},${near.lon + 0.6},${near.lat - 0.45}`;
  const list = await getJson(u, 8000);
  const h = list && list[0];
  if (!h) return null;
  const a = h.address || {};
  const name = a.house_number && a.road ? `${a.house_number} ${a.road}` : String(h.display_name || '').split(',').slice(0, 2).join(',').trim();
  return { lat: +(+h.lat).toFixed(6), lon: +(+h.lon).toFixed(6), name, exact: !!a.house_number, source: 'openstreetmap' };
}

export async function GET(request) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 200);
  const nm = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(u.searchParams.get('near') || '');
  const near = nm ? { lat: +nm[1], lon: +nm[2] } : null;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (!q) return new Response(JSON.stringify({ error: 'Type an address.' }), { status: 400, headers });
  let hit = null;
  try { hit = await census(q); } catch {}
  if (!hit || !hit.exact) {
    try { const o = await osm(q, near); if (o && (!hit || o.exact)) hit = o; } catch {}
  }
  return new Response(JSON.stringify(hit || { none: true }), { status: 200, headers });
}
