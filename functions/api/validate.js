
export async function onRequestPost({ request }) {
  const plan = await request.json();
  const errors = [];
  const warnings = [];

  // Boyut / Ölçek (A3 önerisi)
  if ((plan.size || "").toUpperCase() !== "A3") {
    warnings.push("Planformat A3 önerilir (Einzelraum dışında).");
  }
  // Arka plan beyaz olmalı
  if (plan.backgroundColor && plan.backgroundColor !== "#ffffff") {
    errors.push("Arka plan beyaz olmalıdır (ISO 3864-1 ile uyumlu).");
  }
  // Kuzey oku ve “Sie sind hier”
  if (!plan.hasNorthArrow) warnings.push("Nordpfeil eklenmeli.");
  if (!plan.hasYouAreHere) warnings.push("“Sie sind hier” işareti eklenmeli.");
  // ISO 7010 kodları
  const bad = (plan.symbols||[]).filter(s => !/^[EFMW][0-9]{3}$/.test(s.code));
  if (bad.length) errors.push("ISO 7010 kod biçimi geçersiz: " + bad.map(b=>b.code).join(", "));

  return new Response(JSON.stringify({ errors, warnings }), {
    headers: { "Content-Type": "application/json" }
  });
}
