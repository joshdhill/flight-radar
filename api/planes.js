// GET /api/planes?lat=39.173&lon=-77.272
// Live aircraft within 30 nm of home, with routes attached where known.
import { fetchFeed, compactRow, routesFor, homeFrom, json } from './_lib.js';

let last = { key: '', at: 0, body: null };

export async function GET(request) {
  const home = homeFrom(request.url);
  const key = `${home.lat},${home.lon}`;
  if (last.body && last.key === key && Date.now() - last.at < 4000) return json(last.body);

  try {
    const feed = await fetchFeed('point', home.lat, home.lon, 30);
    const flying = feed.ac.filter((a) => typeof a.lat === 'number' && a.alt_baro !== 'ground');
    const routes = await routesFor(flying.map((a) => (a.flight || '').trim()));
    const ac = flying.map((a) => compactRow(a, routes[(a.flight || '').trim()])).filter(Boolean);
    const body = { now: feed.now, source: feed.source, ac };
    last = { key, at: Date.now(), body };
    return json(body);
  } catch (e) {
    if (last.body && last.key === key) return json({ ...last.body, stale: true, error: e.message }, { sMaxAge: 4 });
    return json({ error: 'No flight feed answered. Retrying shortly.', detail: e.message }, { status: 502, sMaxAge: 2 });
  }
}
