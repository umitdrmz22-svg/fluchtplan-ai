
export async function onRequestPost({ env, request }) {
  try {
    const { role, turnstileToken } = await request.json();
    // Pflicht: Server‑seitige Turnstile‑Validierung (POST siteverify)
    const formData = new FormData();
    formData.append("secret", env.TURNSTILE_SECRET || "DEIN_SECRET_HIER");
    formData.append("response", turnstileToken || "");
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
    const vjson = await verify.json();
    if (!vjson.success) {
      return json({ ok: false, error: "Turnstile‑Verifizierung fehlgeschlagen", details: vjson }, 400);
    }

    // Durable Object: Sitzung/Rolle speichern (BINDING via Dashboard: SESSIONS)
    // Hinweis: DO muss in separatem Worker bereitgestellt werden (siehe workers/sessions/_worker.js).
    const id = env.SESSIONS.idFromName("global-session"); // vereinfachtes Beispiel
    const stub = env.SESSIONS.get(id);
    const resp = await stub.fetch("https://do/sessions/create", {
      method: "POST",
      body: JSON.stringify({ role, ip: vjson.remote_ip || null }),
      headers: { "Content-Type": "application/json" }
    });
    const sjson = await resp.json();

    return json({ ok: true, session: sjson });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
