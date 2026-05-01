// GET  /api/records/:date  -> { session1: {task, status}, ... }
// PUT  /api/records/:date  -> body: { session: 1-6, task?, status?: 'achieved'|'off'|null,
//                                     achieved?: boolean (legacy) }

import { normalize, json, jsonError } from './_helpers.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS = new Set(['achieved', 'off']);

export async function onRequest(context) {
  const { request, params, env } = context;
  const date = params.date;

  if (!DATE_RE.test(date)) {
    return jsonError('Invalid date format. Use YYYY-MM-DD.', 400);
  }

  const kv = env.RECORDS;
  if (!kv) return jsonError('KV binding "RECORDS" is not configured.', 500);

  const key = `record:${date}`;

  if (request.method === 'GET') {
    const data = (await kv.get(key, 'json')) || {};
    return json(normalize(data));
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body.', 400);
    }

    const sessionNum = Number(body.session);
    if (!Number.isInteger(sessionNum) || sessionNum < 1 || sessionNum > 6) {
      return jsonError('Body must include "session" (1-6).', 400);
    }

    const existing = normalize((await kv.get(key, 'json')) || {});
    const sessKey = `session${sessionNum}`;
    const cur = existing[sessKey] || { task: '', status: null };

    let nextStatus = cur.status;
    if ('status' in body) {
      if (body.status === null || body.status === undefined || body.status === '') {
        nextStatus = null;
      } else if (VALID_STATUS.has(body.status)) {
        nextStatus = body.status;
      } else {
        return jsonError('status must be "achieved", "off", or null.', 400);
      }
    } else if ('achieved' in body) {
      if (typeof body.achieved !== 'boolean') {
        return jsonError('achieved must be boolean.', 400);
      }
      if (body.achieved) nextStatus = 'achieved';
      else if (cur.status === 'achieved') nextStatus = null;
    }

    existing[sessKey] = {
      task: typeof body.task === 'string' ? body.task : cur.task,
      status: nextStatus,
    };

    await kv.put(key, JSON.stringify(existing));
    return json(existing);
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  });
}
