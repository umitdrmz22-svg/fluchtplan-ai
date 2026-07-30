const CHECK_LABELS = {
  checkCurrentFloorplan: "Aktueller Grundriss wurde bestätigt.",
  checkEscapeRoutes: "Fluchtwege und Notausgänge wurden vor Ort bestätigt.",
  checkOrientation: "Aushangort und blickrichtige Orientierung wurden bestätigt.",
  checkSafetyEquipment: "Sicherheitseinrichtungen wurden vollständig geprüft.",
  checkAssemblyPoint: "Sammelstelle und Verhaltensregeln wurden abgestimmt.",
  checkExpertReview: "Fachkundige Prüfung und Freigabe wurden bestätigt."
};

export async function onRequestPost({ request }) {
  const plan = await request.json();
  const errors = [];
  const warnings = [];
  const passed = [];
  const required = (value, message) => value ? passed.push(message) : errors.push(message.replace(" vorhanden.", " ergänzen."));

  required(plan.company?.name, "Unternehmen vorhanden.");
  required(plan.company?.address, "Standort / Anschrift vorhanden.");
  required(plan.company?.building, "Gebäude / Bereich vorhanden.");
  required(plan.company?.floor, "Etage vorhanden.");
  required(plan.title, "Planbezeichnung vorhanden.");
  required(plan.planNumber, "Plannummer vorhanden.");
  required(plan.revision, "Revisionsstand vorhanden.");
  required(plan.issueDate, "Erstell- / Prüfdatum vorhanden.");
  required(plan.approvedBy, "Fachkundige Freigabe vorhanden.");
  required(plan.assemblyPoint, "Sammelstelle vorhanden.");

  if (!/^\+?[0-9 ()/-]{3,}$/.test(plan.emergencyNumber || "")) errors.push("Gültige betriebliche Notrufnummer ergänzen.");
  else passed.push("Notrufnummer ist eingetragen.");

  if ((plan.size || "").toUpperCase() !== "A3") {
    warnings.push("A4 nur für einen einzelnen Raum verwenden; ansonsten A3 oder größer wählen.");
  } else passed.push("Ausgabeformat A3 gewählt.");

  const scaleMatch = /^1\s*:\s*([0-9]+)$/.exec(plan.scale || "");
  if (!scaleMatch) errors.push("Maßstab im Format 1:n angeben.");
  else if (Number(scaleMatch[1]) > 250) warnings.push("Maßstab ist kleiner als 1:250; Lesbarkeit und örtliche Eignung fachkundig prüfen.");
  else passed.push("Maßstab ist formal angegeben und mindestens 1:250.");

  if (!plan.hasNorthArrow) warnings.push("Nordpfeil ergänzen, sofern er für die Orientierung erforderlich ist.");
  else passed.push("Nordpfeil ist eingeblendet.");
  if (!plan.hasYouAreHere) errors.push("Standortmarkierung „Sie sind hier“ ergänzen.");
  else passed.push("Standortmarkierung ist eingeblendet.");

  const drawing = Array.isArray(plan.drawing) ? plan.drawing : [];
  if (!drawing.length) errors.push("Aktuellen Gebäudegrundriss zeichnen oder hinterlegen.");
  const escapeRoutes = drawing.filter(item => item.type === "escape");
  if (!escapeRoutes.length) errors.push("Mindestens einen Fluchtweg mit Richtungspfeil einzeichnen.");
  else passed.push(`${escapeRoutes.length} Fluchtweg${escapeRoutes.length === 1 ? "" : "e"} eingezeichnet.`);

  const symbols = Array.isArray(plan.symbols) ? plan.symbols : [];
  const bad = symbols.filter(symbol => !/^[EFMW][0-9]{3}$/.test(symbol.code || ""));
  if (bad.length) errors.push(`Ungültige ISO-7010-Codes: ${bad.map(symbol => symbol.code).join(", ")}.`);
  if (!symbols.some(symbol => ["E001", "E002"].includes(symbol.code))) errors.push("Mindestens einen Notausgang (E001/E002) lagerichtig eintragen.");
  else passed.push("Mindestens ein Notausgang ist eingetragen.");
  if (!symbols.some(symbol => symbol.code === "E007")) warnings.push("Sammelstelle mit E007 im Plan oder Übersichtsplan darstellen.");
  if (!symbols.some(symbol => symbol.code.startsWith("F"))) warnings.push("Vorhandene Brandmelde- und Löscheinrichtungen lagerichtig ergänzen.");
  if (!symbols.some(symbol => symbol.code === "E003")) warnings.push("Vorhandene Erste-Hilfe-Einrichtungen mit E003 ergänzen.");

  for (const [id, label] of Object.entries(CHECK_LABELS)) {
    if (plan.compliance?.[id]) passed.push(label);
    else errors.push(`Abschlusskontrolle offen: ${label.replace(" wurde bestätigt.", " bestätigen").replace(" wurden bestätigt.", " bestätigen")}`);
  }

  return new Response(JSON.stringify({
    errors,
    warnings,
    passed,
    disclaimer: "Automatische formale Plausibilitätsprüfung; keine Konformitätsbescheinigung. Gefährdungsbeurteilung, örtliche Prüfung und Freigabe durch eine fachkundige Person bleiben erforderlich."
  }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
