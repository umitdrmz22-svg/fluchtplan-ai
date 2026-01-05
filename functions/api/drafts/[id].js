
export async function onRequestGet({ env, params }) {
  const id = params.id;
  try {
    const kvKey = `draft:${id}`;
    const val = await env.DRAFTS.get(kvKey, "json");
    if (val) return new Response(JSON.stringify({ ok: true, draft: val }), { headers: { "Content-Type": "application/json" } });

    const rs = await env.DB.prepare("SELECT plan_json, title, author, created_at FROM draft_versions WHERE id=?1").bind(id).all();
    if (rs.results && rs.results.length) {
      const row = rs.results[0];
      return new Response(JSON.stringify({ ok: true, draft: { id, title: row.title, author: row.author, ts: row.created_at, plan: JSON.parse(row.plan_json) } }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: false, error: "Nicht gefunden" }), { status: 404, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
``
