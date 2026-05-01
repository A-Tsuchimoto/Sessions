// GET  /api/records/:date  -> returns { session1: {task, achieved}, ... }
// PUT  /api/records/:date  -> body: { session: 1-6, task?, achieved? }
//                           Updates only the supplied fields for that session.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    return json(data);
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

    const existing = (await kv.get(key, 'json')) || {};
    const sessKey = `session${sessionNum}`;
    const cur = existing[sessKey] || { task: '', achieved: false };

    const next = {
      task: typeof body.task === 'string' ? body.task : cur.task,
      achieved: typeof body.achieved === 'boolean' ? body.achieved : cur.achieved,
    };
    existing[sessKey] = next;

    await kv.put(key, JSON.stringify(existing));
    return json(existing);
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function jsonError(message, status) {
  return json({ error: message }, status);
}
