
export async function onRequestPost({ request }) {
  const plan = await request.json();
  const errors = [];
  const warnings = [];

  if ((plan.size || "").toUpperCase() !== "A3") {
    warnings.push("Format A3 empfohlen (Ausnahme: Einzelraum, dann A4).");
  }
  // Weißer Hintergrund empfohlen
  // (Frontend setzt weiß; falls exportseitig geändert wird:)
  // plan.backgroundColor optional prüfen
  if (plan.backgroundColor && plan.backgroundColor.toLowerCase() !== "#ffffff") {
    errors.push("Hintergrund muss weiß sein (ISO 3864‑1).");
  }
  if (!plan.hasNorthArrow) warnings.push("Nordpfeil ergänzen.");
  if (!plan.hasYouAreHere) warnings.push("„Sie sind hier“ ergänzen.");

  const bad = (plan.symbols||[]).filter(s => !/^[EFMW][0-9]{3}$/.test(s.code));
  if (bad.length) errors.push("Ungültige ISO‑7010 Codes: " + bad.map(b=>b.code).join(", "));

  return new Response(JSON.stringify({ errors, warnings }), {
    headers: { "Content-Type": "application/json" }
  });
}
