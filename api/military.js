// GET /api/military?lat=39.173&lon=-77.272
// Every aircraft the feed tags as military, kept to those within 250 nm of home.
import { fetchFeed, compactRow, militaryFlag, distanceNm, homeFrom, json } from './_lib.js';

const RANGE_NM = 250;
let last = { key: '', at: 0, body: null };

export async function GET(request) {
  const home = homeFrom(request.url);
  const key = `${home.lat},${home.lon}`;
  if (last.body && last.key === key && Date.now() - last.at < 40000) return json(last.body, { sMaxAge: 40 });

  try {
    const feed = await fetchFeed('mil', home.lat, home.lon, 0);
    const ac = feed.ac
      .filter((a) => typeof a.lat === 'number' && distanceNm(home.lat, home.lon, a.lat, a.lon) <= RANGE_NM)
      .map((a) => {
        const row = compactRow(a, '');
        if (row && !row[12]) row[12] = militaryFlag(a) || 'db'; // everything on this list is military
        return row;
      })
      .filter(Boolean);
    const body = { now: feed.now, source: feed.source, rangeNm: RANGE_NM, ac };
    last = { key, at: Date.now(), body };
    return json(body, { sMaxAge: 40 });
  } catch (e) {
    if (last.body && last.key === key) return json({ ...last.body, stale: true, error: e.message }, { sMaxAge: 10 });
    return json({ error: 'The military feed did not answer. Retrying shortly.', detail: e.message }, { status: 502, sMaxAge: 5 });
  }
}
