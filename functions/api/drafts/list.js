
export async function onRequestGet({ env }) {
  try {
    const rs = await env.DB.prepare(
      "SELECT id, draft_key, title, author, created_at FROM draft_versions ORDER BY created_at DESC LIMIT 50"
    ).all();
    return new Response(JSON.stringify({ ok: true, items: rs.results || [] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
