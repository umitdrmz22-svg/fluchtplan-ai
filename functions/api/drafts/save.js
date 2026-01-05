
export async function onRequestPost({ env, request }) {
  try {
    const { title, plan, note, author } = await request.json();
    const id = crypto.randomUUID();
    const kvKey = `draft:${id}`;
    const payload = { id, title, plan, note, author, ts: Date.now() };

    await env.DRAFTS.put(kvKey, JSON.stringify(payload)); // KV: schneller Zugriff
    const stmt = await env.DB.prepare(
      "INSERT INTO draft_versions (id, draft_key, title, author, plan_json, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    ).bind(id, kvKey, title || null, author || null, JSON.stringify(plan), note || null);
    await stmt.run();

    return json({ ok: true, id, key: kvKey, message: "Entwurf gespeichert." });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
