(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FluchtplanRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SOURCES = [
    { short: "ArbStättV § 4 Abs. 4", url: "https://www.gesetze-im-internet.de/arbst_ttv_2004/__4.html" },
    { short: "ASR A2.3", url: "https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-3" },
    { short: "ASR A1.3", url: "https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-3" },
    { short: "DIN ISO 23601:2021-11", url: "https://www.dinmedia.de/de/norm/din-iso-23601/341641268" }
  ];

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function symbols(plan, codes) {
    const wanted = new Set(codes);
    return (plan.elements || []).filter((item) => item.type === "symbol" && wanted.has(item.code));
  }

  function count(plan, type) {
    return (plan.elements || []).filter((item) => item.type === type).length;
  }

  function check(id, group, level, passed, title, detail, source) {
    return { id, group, level, passed: Boolean(passed), title, detail, source };
  }

  function validatePlan(plan) {
    const meta = plan.meta || {};
    const settings = plan.settings || {};
    const facilities = plan.facilities || {};
    const confirmations = plan.confirmations || {};
    const behavior = plan.behavior || {};
    const scaleMatch = /^1\s*:\s*(\d+)$/.exec(text(settings.scale));
    const scaleDenominator = scaleMatch ? Number(scaleMatch[1]) : NaN;
    const routes = (plan.elements || []).filter((item) => item.type === "route" && (item.points || []).length >= 2);
    const locationCount = count(plan, "location");
    const basePresent = Boolean(plan.baseImage) || (count(plan, "wall") + count(plan, "room") >= 2);
    const checks = [];

    checks.push(check("meta", "Planangaben", "Fehler",
      [meta.company, meta.building, meta.floor, meta.planNumber, meta.author, meta.created, meta.revision].every(text),
      "Planangaben vollständig",
      "Unternehmen, Gebäude, Geschoss/Bereich, Plannummer, Ersteller, Datum und Revisionsstand müssen nachvollziehbar sein.",
      "DIN ISO 23601"));
    checks.push(check("title", "Planangaben", "Fehler", text(meta.title).toLowerCase().includes("flucht") && text(meta.title).toLowerCase().includes("rettungsplan"),
      "Eindeutige Planbezeichnung", "Die Bezeichnung „Flucht- und Rettungsplan“ muss eindeutig erkennbar sein.", "DIN ISO 23601"));
    checks.push(check("format", "Planangaben", "Fehler", settings.format === "A3" || (settings.format === "A4" && text(settings.a4Reason)),
      "Geeignetes Ausgabeformat", "Regelformat ist A3. A4 ist nur für geeignete besondere Anwendungsfälle mit dokumentierter Begründung vorgesehen.", "DIN ISO 23601"));
    checks.push(check("scale", "Planangaben", "Fehler", Number.isFinite(scaleDenominator) && scaleDenominator > 0 && scaleDenominator <= 250,
      "Maßstab lesbar und höchstens 1:250", "Für den Detailplan ist ein lesbarer Maßstab, regelmäßig mindestens 1:250, einzutragen.", "DIN ISO 23601"));

    checks.push(check("floor", "Grundriss und Orientierung", "Fehler", basePresent,
      "Grundriss vorhanden", "Ein Gebäude- oder Etagengrundriss muss hochgeladen oder mit den Zeichenwerkzeugen erstellt sein.", "ASR A2.3"));
    checks.push(check("white", "Grundriss und Orientierung", "Fehler", settings.whiteBackground !== false,
      "Weißer Planhintergrund", "Der Planhintergrund muss weiß und der Grundriss kontrastreich dargestellt sein.", "DIN ISO 23601"));
    checks.push(check("overview", "Grundriss und Orientierung", "Fehler", !settings.partialArea || Boolean(plan.overviewImage),
      "Übersicht bei Teilgrundriss", "Wird nur ein Teil des Gebäudes gezeigt, muss eine Übersicht die Lage im Gesamtkomplex verdeutlichen.", "ASR A2.3 / DIN ISO 23601"));
    checks.push(check("orientation", "Grundriss und Orientierung", "Fehler", confirmations.siteOriented,
      "Lagerichtige Darstellung bestätigt", "Der Plan muss bezogen auf den jeweiligen Anbringungsort lagerichtig gestaltet und angebracht werden.", "ASR A2.3"));
    checks.push(check("north", "Grundriss und Orientierung", "Hinweis", settings.showNorth,
      "Orientierungshilfe vorhanden", "Ein Nordpfeil unterstützt die eindeutige Orientierung, sofern die lagerichtige Darstellung allein nicht ausreicht.", "DIN ISO 23601"));
    checks.push(check("location", "Grundriss und Orientierung", "Fehler", locationCount === 1,
      "Genau ein Betrachterstandort", "Der jeweilige Anbringungsort ist mit genau einem blauen Standortzeichen „Sie sind hier“ zu kennzeichnen.", "ASR A2.3 / DIN ISO 23601"));

    checks.push(check("route", "Fluchtwegdarstellung", "Fehler", routes.length > 0,
      "Fluchtweg eingezeichnet", "Vom Standort muss ein eindeutig erkennbarer, durchgehend grüner Weg in einen sicheren Bereich oder ins Freie führen.", "ASR A2.3"));
    checks.push(check("exit", "Fluchtwegdarstellung", "Fehler", symbols(plan, ["E001", "E002", "E016", "E017"]).length > 0,
      "Notausgang oder Notausstieg gekennzeichnet", "Mindestens der im dargestellten Bereich maßgebende Ausgang oder Ausstieg muss gekennzeichnet sein.", "ASR A1.3 / DIN EN ISO 7010"));
    checks.push(check("assembly", "Fluchtwegdarstellung", "Fehler", facilities.assembly !== true || symbols(plan, ["E007"]).length > 0,
      "Sammelstelle berücksichtigt", "Ist eine Sammelstelle für den dargestellten Bereich vorgesehen, muss E007 im Plan erscheinen.", "ASR A2.3 / ASR A1.3"));

    checks.push(check("firstaid", "Sicherheitsausstattung", "Fehler", facilities.firstAid !== true || symbols(plan, ["E003", "E004", "E009", "E010", "E011", "E012", "E013"]).length > 0,
      "Erste-Hilfe-Einrichtungen dargestellt", "Vorhandene Erste-Hilfe-Einrichtungen sind mit den zutreffenden Sicherheitszeichen einzutragen.", "ASR A2.3 / ASR A1.3"));
    checks.push(check("fire", "Sicherheitsausstattung", "Fehler", facilities.fire !== true || symbols(plan, ["F001", "F002", "F003", "F004"]).length > 0,
      "Brandbekämpfungseinrichtungen dargestellt", "Vorhandene Feuerlöscher, Löschschläuche oder sonstige Brandbekämpfungseinrichtungen sind einzutragen.", "ASR A2.3 / ASR A1.3"));
    checks.push(check("alarm", "Sicherheitsausstattung", "Fehler", facilities.alarm !== true || symbols(plan, ["F005", "F006", "E004"]).length > 0,
      "Alarmierungseinrichtungen dargestellt", "Vorhandene Brandmelder und Notrufeinrichtungen sind im Plan zu kennzeichnen.", "ASR A2.3 / ASR A1.3"));
    checks.push(check("applicability", "Sicherheitsausstattung", "Fehler", confirmations.facilitiesChecked,
      "Örtliche Ausstattung abgeglichen", "Die Auswahl muss mit Begehung, Brandschutzkonzept und aktueller Gefährdungsbeurteilung abgeglichen sein.", "ArbStättV / ASR A2.3"));

    checks.push(check("legend", "Informationen", "Fehler", settings.showLegend && symbols(plan, ["E001", "E002", "E003", "E004", "E007", "E010", "E011", "E012", "E013", "E016", "E017", "F001", "F002", "F003", "F004", "F005", "F006"]).length > 0,
      "Legende vorhanden", "Die verwendeten Sicherheitszeichen müssen verständlich in einer Legende erklärt werden.", "DIN ISO 23601"));
    checks.push(check("firetext", "Informationen", "Fehler", text(behavior.fire).length >= 80,
      "Verhalten im Brandfall angepasst", "Die kurzen Handlungsregeln müssen vollständig und an die örtliche Alarmierung angepasst sein.", "ASR A2.3"));
    checks.push(check("accidenttext", "Informationen", "Fehler", text(behavior.accident).length >= 70,
      "Verhalten bei Unfällen angepasst", "Die Erste-Hilfe-Regeln müssen kurz, verständlich und betrieblich zutreffend sein.", "ASR A2.3"));
    checks.push(check("emergency", "Informationen", "Fehler", text(meta.emergencyNumber).includes("112"),
      "Notruf 112 angegeben", "Die europaweite Notrufnummer 112 muss klar erkennbar sein; betriebliche Zusatznummern können ergänzt werden.", "ASR A2.3"));

    checks.push(check("lighting", "Freigabe", "Fehler", settings.safetyLighting !== "ja" || confirmations.lowLightUsable,
      "Nutzbarkeit bei Beleuchtungsausfall", "Ist am Aushangort Sicherheitsbeleuchtung erforderlich, muss der Plan auch bei Ausfall der Allgemeinbeleuchtung nutzbar sein.", "ASR A2.3"));
    checks.push(check("current", "Freigabe", "Fehler", confirmations.currentState,
      "Aktueller baulicher Zustand bestätigt", "Fluchtwege, Türen, Sicherheits- und Brandschutzeinrichtungen müssen dem tatsächlichen Zustand entsprechen.", "ArbStättV / ASR A2.3"));
    checks.push(check("review", "Freigabe", "Fehler", confirmations.professionalReview,
      "Fachkundige Prüfung dokumentiert", "Der Norm-Check ersetzt nicht die fachliche Prüfung der örtlichen Gegebenheiten und des Brandschutzkonzepts.", "ArbStättV / ASR A2.3"));
    checks.push(check("maintenance", "Freigabe", "Hinweis", Boolean(meta.nextReview),
      "Nächste Prüfung festgelegt", "Pläne sind regelmäßig sowie unverzüglich nach relevanten Änderungen auf Aktualität, Lesbarkeit und Verständlichkeit zu prüfen.", "ASR A2.3"));

    const errors = checks.filter((item) => item.level === "Fehler" && !item.passed).length;
    const notices = checks.filter((item) => item.level === "Hinweis" && !item.passed).length;
    const passed = checks.filter((item) => item.passed).length;
    return {
      checks,
      errors,
      notices,
      passed,
      total: checks.length,
      ready: errors === 0,
      score: Math.round((passed / checks.length) * 100)
    };
  }

  return { SOURCES, validatePlan };
});
