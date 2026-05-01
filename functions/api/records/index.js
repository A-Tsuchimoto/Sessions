// GET /api/records                                -> all records (used by CSV export)
// GET /api/records?start=YYYY-MM-DD&end=YYYY-MM-DD -> records in range (inclusive)

import { normalize, json, jsonError } from './_helpers.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  const kv = env.RECORDS;
  if (!kv) return jsonError('KV binding "RECORDS" is not configured.', 500);

  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (start && !DATE_RE.test(start)) return jsonError('Invalid start date.', 400);
  if (end && !DATE_RE.test(end)) return jsonError('Invalid end date.', 400);

  // List all keys with prefix `record:`. KV list returns up to 1000 per call.
  const allDates = [];
  let cursor;
  while (true) {
    const result = await kv.list({ prefix: 'record:', cursor, limit: 1000 });
    for (const k of result.keys) {
      const date = k.name.slice('record:'.length);
      if (DATE_RE.test(date)) allDates.push(date);
    }
    if (result.list_complete) break;
    cursor = result.cursor;
  }

  let dates = allDates;
  if (start) dates = dates.filter((d) => d >= start);
  if (end) dates = dates.filter((d) => d <= end);
  dates.sort();

  const entries = await Promise.all(
    dates.map(async (d) => {
      const data = await kv.get(`record:${d}`, 'json');
      return [d, normalize(data || {})];
    })
  );

  return json(Object.fromEntries(entries));
}
