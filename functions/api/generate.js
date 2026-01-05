
export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const { task, context: payload } = body || {};

  // Modeller: hızlı, çok dilli diyalog için Llama 3.1 8B (fast)
  const model = "@cf/meta/llama-3.1-8b-instruct-fast";

  if (task === "layout") {
    const prompt = `
Sen bir iş sağlığı ve güvenliği uzmanı ve DIN ISO 23601 / ISO 7010 uyumluluk kontrol aracısın.
Verilen bağlamdan kaçış ve kurtarma planı için aşağıdaki JSON şemasına tam uyan öneriler üret:
{
  "suggestedSymbols": [ { "code": "E001", "x": 100, "y": 120 }, ... ],
  "notes": [ "Fluchtwege klar und durchgehend markieren", "Sammelstelle E007 ekleyin" ],
  "legendItems": [ "Rettungszeichen", "Brandbekämpfung", "Warnzeichen", "Gebotszeichen" ]
}
Kısıtlar:
- Semboller ISO 7010 kodları olmalı (E/F/W/M serileri).
- Konumlar SVG piksel koordinatı (viewBox 1400x1000).
- A3, beyaz arka plan, “Nordpfeil” ve “Sie sind hier” işaretinin bulunması.
- Yazı metni yoksa notlara ekle.
Bağlam:
${JSON.stringify(payload)}
Yanıtı YALNIZCA yukarıdaki JSON yapısı ile ver.
`;

    const aiRes = await env.AI.run(model, { prompt, max_tokens: 600 });
    // Çıktı düzeltme: güvenli parse
    let data = {};
    try { data = JSON.parse(aiRes); } catch { data = { suggestedSymbols: [], notes: ["AI yanıtı parse edilemedi."] }; }
    return json(data);
  }

  if (task === "texts") {
    const prompt = `
DIN ISO 23601 uyumlu “Verhaltensregeln” metinlerini oluştur.
Çıktı şeması:
{
  "brandfall": [ "Ruhe bewahren", "Alarm auslösen", "In Sicherheit bringen", "Feuerwehr 112 rufen (5W-Fragen)", "Brand bekämpfen: nur Entstehungsbrand" ],
  "unfall": [ "Erste Hilfe leisten", "Gefahrbereich sichern", "Notruf 112 (5W-Fragen)", "Ersthelfer informieren", "Meldung und Dokumentation" ]
}
Metinleri Almanca kısa madde şeklinde ver; ISO 7010 işaretleriyle uyum referansı ekleme.
Bağlam: ${JSON.stringify(payload)}
YALNIZCA JSON ver.
`;
    const aiRes = await env.AI.run(model, { prompt, max_tokens: 400 });
    let data = {};
    try { data = JSON.parse(aiRes); } catch { data = { brandfall: [], unfall: [] }; }
    return json(data);
  }

  return json({ error: "Unknown task" }, 400);
}

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
