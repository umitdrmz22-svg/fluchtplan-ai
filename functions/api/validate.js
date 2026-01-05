
export async function onRequestPost({ request }) {
  const plan = await request.json();
  const errors = [];
  const warnings = [];

  // Format
  if ((plan.size || "").toUpperCase() !== "A3") {
    warnings.push("Format A3 empfohlen (Ausnahme: Einzelraum, dann A4).");
  }
  // Hintergrund (weiß)
  if (plan.backgroundColor && plan.backgroundColor.toLowerCase() !== "#ffffff") {
    errors.push("Hintergrund muss weiß sein (ISO 3864‑1).");
  }
  // Orientierung
  if (!plan.hasNorthArrow) warnings.push("Nordpfeil ergänzen.");
  if (!plan.hasYouAreHere) warnings.push("„Sie sind hier“ ergänzen.");

  // ISO 7010 Codeformat
  const bad = (plan.symbols||[]).filter(s => !/^[EFMW][0-9]{3}$/.test(s.code));
  if (bad.length) errors.push("Ungültige ISO‑7010 Codes: " + bad.map(b=>b.code).join(", "));

  // Maßstabsprüfung (vereinfachte Hinweise)
  const scaleMatch = /^1\s*:\s*([0-9]+)$/.exec(plan.scale||"");
  if (!scaleMatch) {
    warnings.push("Maßstabformat prüfen (z. B. 1:250).");
  } else {
    const denom = parseInt(scaleMatch[1], 10);
    // Empfehlung: Mindestschriftgröße ~ 3.5 mm bei A3; auf SVG‑Pixel übertragen (1000px ~ ca. 210mm Höhe)
    const pxPerMm = 1000 / 297; // grobe Umrechnung für A3‑Höhe ~ 297 mm
    const minFontPx = Math.round(3.5 * pxPerMm);
    warnings.push(`Empfohlene Mindestschriftgröße ~ ${minFontPx}px für Legende/Labels (abhängig vom Druck).`);
    // Strichstärke für Fluchtwege deutlicher darstellen
    warnings.push("Fluchtwegführung klar und durchgehend kennzeichnen (Pfeile, Grün gemäß ISO‑Konvention).");
  }

  return new Response(JSON.stringify({ errors, warnings }), {
    headers: { "Content-Type": "application/json" }
  });
}
