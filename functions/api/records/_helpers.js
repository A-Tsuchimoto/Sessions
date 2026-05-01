// Shared helpers for the records API. Files starting with `_` are not
// routed by Cloudflare Pages Functions, so this module is import-only.

export function normalize(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('session')) continue;
    if (!v || typeof v !== 'object') continue;
    let status = null;
    if (v.status === 'achieved' || v.status === 'off') {
      status = v.status;
    } else if (v.achieved === true) {
      status = 'achieved';
    }
    out[k] = {
      task: typeof v.task === 'string' ? v.task : '',
      status,
    };
  }
  return out;
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function jsonError(message, status) {
  return json({ error: message }, status);
}
