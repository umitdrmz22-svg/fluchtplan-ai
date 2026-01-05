
export async function onRequestPost(context) {
  const { env, request } = context;
  const { task, context: payload } = await request.json();

  const model = "@cf/meta/llama-3.1-8b-instruct-fast"; // gutes P/L-Verhältnis

  if (task === "layout") {
    const prompt = `
Du bist Fachkraft für Arbeitssicherheit. Erzeuge Vorschläge für einen Flucht- und Rettungsplan gemäß DIN ISO 23601 (A3, weißer Hintergrund, Legende, Nordpfeil, „Sie sind hier“) mit ISO 7010 Zeichen (E/F/W/M).
Gib ausschließlich folgendes JSON zurück:
{
  "suggestedSymbols": [ { "code": "E001", "x": 120, "y": 180 } ],
  "notes": [ "Fluchtwege klar markieren", "Sammelstelle (E007) ergänzen" ],
  "legendItems": [ "Rettungszeichen", "Brandbekämpfung", "Warnzeichen", "Gebotszeichen" ]
}
Kontext: ${JSON.stringify(payload)}
Nur JSON, keine Erklärungen.`;

    const aiRes = await env.AI.run(model, { prompt, max_tokens: 600 });
    let data = {};
    try { data = JSON.parse(aiRes); } catch { data = { suggestedSymbols: [], notes: ["AI‑Antwort nicht auswertbar"], legendItems: [] }; }
    return json(data);
  }

  if (task === "texts") {
    const prompt = `
Erstelle knappe Verhaltensregeln (Deutsch) gemäß gängiger Praxis für DIN ISO 23601‑Pläne.
Nur JSON zurückgeben:
{
  "brandfall": ["Ruhe bewahren","Alarm auslösen","In Sicherheit begeben","Feuerwehr 112 (5‑W‑Fragen)","Entstehungsbrand nur bei eigener Sicherheit bekämpfen"],
  "unfall": ["Erste Hilfe leisten","Gefahrbereich sichern","Notruf 112 (5‑W‑Fragen)","Ersthelfer informieren","Ereignis melden und dokumentieren"]
}
Kontext: ${JSON.stringify(payload)}`;
    const aiRes = await env.AI.run(model, { prompt, max_tokens: 400 });
    let data = {};
    try { data = JSON.parse(aiRes); } catch { data = { brandfall: [], unfall: [] }; }
    return json(data);
  }

  return json({ error: "Unbekannte Aufgabe" }, 400);
}

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
