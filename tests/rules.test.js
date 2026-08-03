"use strict";

const assert = require("node:assert/strict");
const { validatePlan, SOURCES } = require("../public/rules.js");

function validPlan() {
  return {
    meta: {
      company: "Muster GmbH",
      building: "Werk 1",
      floor: "Erdgeschoss",
      planNumber: "FRP-001",
      title: "Flucht- und Rettungsplan",
      author: "Erika Muster",
      created: "2026-08-03",
      revision: "Rev. 1",
      nextReview: "2027-08-03",
      emergencyNumber: "Notruf 112"
    },
    settings: {
      scale: "1:250",
      format: "A3",
      whiteBackground: true,
      partialArea: false,
      showNorth: true,
      showLegend: true,
      safetyLighting: "nein"
    },
    facilities: { firstAid: true, fire: true, alarm: true, assembly: true },
    confirmations: {
      siteOriented: true,
      facilitiesChecked: true,
      currentState: true,
      professionalReview: true,
      lowLightUsable: false
    },
    behavior: {
      fire: "Ruhe bewahren. Brand melden. Personen warnen. Fluchtweg benutzen. Sammelstelle aufsuchen. Löschversuch nur ohne Eigengefährdung.",
      accident: "Unfallstelle sichern. Erste Hilfe leisten. Notruf 112 absetzen. Rettungsdienst einweisen. Ereignis melden und dokumentieren."
    },
    baseImage: { name: "grundriss.svg", data: "data:image/svg+xml;base64,PHN2Zy8+" },
    overviewImage: null,
    elements: [
      { id: "route-1", type: "route", points: [{ x: 10, y: 10 }, { x: 100, y: 100 }] },
      { id: "location-1", type: "location", x: 10, y: 10 },
      { id: "exit-1", type: "symbol", code: "E001", x: 100, y: 100 },
      { id: "assembly-1", type: "symbol", code: "E007", x: 110, y: 100 },
      { id: "aid-1", type: "symbol", code: "E003", x: 60, y: 50 },
      { id: "fire-1", type: "symbol", code: "F001", x: 50, y: 50 },
      { id: "alarm-1", type: "symbol", code: "F005", x: 40, y: 50 }
    ]
  };
}

const result = validatePlan(validPlan());
assert.equal(result.ready, true, "Ein vollständiger Plan muss den Pflichtcheck bestehen.");
assert.equal(result.errors, 0);
assert.ok(result.total >= 20, "Der Check muss alle fachlichen Bereiche abdecken.");
assert.equal(SOURCES.length, 4);

const missingLocation = validPlan();
missingLocation.elements = missingLocation.elements.filter((item) => item.type !== "location");
const locationResult = validatePlan(missingLocation);
assert.equal(locationResult.ready, false);
assert.equal(locationResult.checks.find((item) => item.id === "location").passed, false);

const partial = validPlan();
partial.settings.partialArea = true;
const overviewResult = validatePlan(partial);
assert.equal(overviewResult.checks.find((item) => item.id === "overview").passed, false);

const badScale = validPlan();
badScale.settings.scale = "1:500";
assert.equal(validatePlan(badScale).checks.find((item) => item.id === "scale").passed, false);

const lowLight = validPlan();
lowLight.settings.safetyLighting = "ja";
assert.equal(validatePlan(lowLight).checks.find((item) => item.id === "lighting").passed, false);
lowLight.confirmations.lowLightUsable = true;
assert.equal(validatePlan(lowLight).checks.find((item) => item.id === "lighting").passed, true);

console.log("rules.test.js: Alle Prüfungen bestanden");
