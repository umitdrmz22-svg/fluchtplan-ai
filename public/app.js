"use strict";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "fluchtplan-studio-v2";

const SIGNS = [
  { code: "E001", label: "Rettungsweg / Notausgang links", category: "rescue" },
  { code: "E002", label: "Rettungsweg / Notausgang rechts", category: "rescue" },
  { code: "E003", label: "Erste Hilfe", category: "rescue" },
  { code: "E004", label: "Notruftelefon", category: "rescue" },
  { code: "E007", label: "Sammelstelle", category: "rescue" },
  { code: "E010", label: "Automatisierter Defibrillator", category: "rescue" },
  { code: "E011", label: "Augenspüleinrichtung", category: "rescue" },
  { code: "E012", label: "Notdusche", category: "rescue" },
  { code: "E013", label: "Krankentrage", category: "rescue" },
  { code: "E016", label: "Notausstieg mit Fluchtleiter", category: "rescue" },
  { code: "E017", label: "Rettungsausstieg", category: "rescue" },
  { code: "F001", label: "Feuerlöscher", category: "fire" },
  { code: "F002", label: "Löschschlauch", category: "fire" },
  { code: "F003", label: "Feuerleiter", category: "fire" },
  { code: "F004", label: "Mittel zur Brandbekämpfung", category: "fire" },
  { code: "F005", label: "Brandmelder", category: "fire" },
  { code: "F006", label: "Brandmeldetelefon", category: "fire" }
].map((item) => ({ ...item, src: `assets/signs/${item.code}.jpg` }));

const DEFAULT_FIRE_TEXT = `Ruhe bewahren.\nBrand melden: Notruf 112 und betriebliche Alarmierung auslösen.\nGefährdete Personen warnen und hilfsbedürftige Personen unterstützen.\nGekennzeichneten Fluchtwegen folgen; Aufzüge nicht benutzen.\nSammelstelle aufsuchen und auf weitere Anweisungen warten.\nLöschversuch nur ohne Eigengefährdung unternehmen.`;
const DEFAULT_ACCIDENT_TEXT = `Ruhe bewahren und Unfallstelle sichern.\nErste Hilfe leisten und Ersthelfer verständigen.\nNotruf 112 absetzen: Wo, was, wie viele, welche Verletzungen; Rückfragen abwarten.\nRettungsdienst einweisen und Zufahrten freihalten.\nEreignis unverzüglich betrieblich melden und dokumentieren.`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function defaultState() {
  return {
    version: 2,
    meta: {
      company: "",
      building: "",
      floor: "",
      planNumber: "",
      title: "Flucht- und Rettungsplan",
      author: "",
      created: today(),
      revision: "Rev. 1",
      nextReview: nextYear(),
      emergencyNumber: "Notruf 112"
    },
    settings: {
      scale: "1:250",
      format: "A3",
      a4Reason: "",
      rotation: "0",
      opacity: 82,
      partialArea: false,
      whiteBackground: true,
      showLegend: true,
      showNorth: true,
      safetyLighting: "nein"
    },
    facilities: { firstAid: true, fire: true, alarm: true, assembly: true },
    confirmations: {
      siteOriented: false,
      lowLightUsable: false,
      facilitiesChecked: false,
      currentState: false,
      professionalReview: false
    },
    behavior: { fire: DEFAULT_FIRE_TEXT, accident: DEFAULT_ACCIDENT_TEXT },
    baseImage: null,
    overviewImage: null,
    elements: []
  };
}

let state = defaultState();
let activeTool = "select";
let selectedId = null;
let undoStack = [];
let pointerAction = null;
let currentRoute = [];
let lastResult = null;
let saveTimer = null;

const canvas = $("#planCanvas");
const layers = {
  base: $("#baseLayer"),
  drawing: $("#drawingLayer"),
  route: $("#routeLayer"),
  symbol: $("#symbolLayer"),
  overlay: $("#overlayLayer"),
  preview: $("#previewLayer")
};

function getPath(path) {
  return path.split(".").reduce((value, key) => value && value[key], state);
}

function setPath(path, value) {
  const keys = path.split(".");
  let target = state;
  keys.slice(0, -1).forEach((key) => {
    if (!target[key]) target[key] = {};
    target = target[key];
  });
  target[keys.at(-1)] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function formatDate(value) {
  if (!value) return "–";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
}

function lines(value) {
  return String(value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function pushUndo() {
  undoStack.push(clone({ elements: state.elements, baseImage: state.baseImage, overviewImage: state.overviewImage }));
  if (undoStack.length > 30) undoStack.shift();
}

function undo() {
  const previous = undoStack.pop();
  if (!previous) return;
  state.elements = previous.elements;
  state.baseImage = previous.baseImage;
  state.overviewImage = previous.overviewImage;
  selectedId = null;
  currentRoute = [];
  invalidateCheck();
  renderAll();
}

function bindControls() {
  $$('[data-path]').forEach((control) => {
    const eventName = control.matches("select,input[type=checkbox],input[type=date]") ? "change" : "input";
    control.addEventListener(eventName, () => {
      const value = control.type === "checkbox" ? control.checked : control.value;
      setPath(control.dataset.path, value);
      if (control.dataset.path === "settings.opacity") state.settings.opacity = Number(value);
      invalidateCheck();
      updateConditionals();
      renderAll();
      scheduleLocalSave();
    });
  });

  $("#opacityRange").addEventListener("input", (event) => {
    state.settings.opacity = Number(event.target.value);
    invalidateCheck();
    renderPlan();
    scheduleLocalSave();
  });

  $$(".step-nav button").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.target)));
  $$(".tool[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  $("#finishRouteBtn").addEventListener("click", finishRoute);
  $("#undoBtn").addEventListener("click", undo);
  $("#deleteBtn").addEventListener("click", deleteSelected);
  $("#addLabelBtn").addEventListener("click", addLabel);
  $("#newPlanBtn").addEventListener("click", newPlan);
  $("#demoBtn").addEventListener("click", loadDemo);
  $("#checkBtn").addEventListener("click", runNormCheck);
  $("#finalCheckBtn").addEventListener("click", runNormCheck);
  $("#saveBtn").addEventListener("click", () => $("#saveDialog").showModal());
  $("#downloadProjectBtn").addEventListener("click", downloadProject);
  $("#projectUpload").addEventListener("change", (event) => importProject(event.target.files[0]));
  $("#svgBtn").addEventListener("click", exportSvg);
  $("#printBtn").addEventListener("click", printPlan);
  $("#floorSelectBtn").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    $("#floorUpload").click();
  });
  $("#floorUpload").addEventListener("change", (event) => loadImageFile(event.target.files[0], "baseImage"));
  $("#overviewUpload").addEventListener("change", (event) => loadImageFile(event.target.files[0], "overviewImage"));
  configureDropZone();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", (event) => {
    if (activeTool === "route") {
      event.preventDefault();
      finishRoute();
    }
  });
  window.addEventListener("keydown", onKeyDown);
}

function applyStateToControls() {
  $$('[data-path]').forEach((control) => {
    const value = getPath(control.dataset.path);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = value == null ? "" : value;
  });
  $("#opacityRange").value = state.settings.opacity ?? 82;
  updateConditionals();
}

function updateConditionals() {
  $("#a4ReasonField").classList.toggle("visible", state.settings.format === "A4");
  $("#overviewField").classList.toggle("visible", Boolean(state.settings.partialArea));
  $("#lowLightField").classList.toggle("visible", state.settings.safetyLighting === "ja");
}

function showSection(id) {
  $$(".editor-section").forEach((section) => section.classList.toggle("active", section.id === id));
  $$(".step-nav button").forEach((button) => button.classList.toggle("active", button.dataset.target === id));
  $("#normResults").classList.remove("visible");
  $("#editorPanel")?.scrollTo?.({ top: 0, behavior: "smooth" });
}

function renderSignLibrary() {
  const build = (category, container) => {
    SIGNS.filter((sign) => sign.category === category).forEach((sign) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sign-card";
      button.title = `${sign.code} – ${sign.label} in der Planmitte einsetzen`;
      const image = document.createElement("img");
      image.src = sign.src;
      image.alt = sign.label;
      const code = document.createElement("b");
      code.textContent = sign.code;
      const label = document.createElement("small");
      label.textContent = sign.label;
      button.append(image, code, label);
      button.addEventListener("click", () => addSymbol(sign.code));
      container.appendChild(button);
    });
  };
  build("rescue", $("#rescueSigns"));
  build("fire", $("#fireSigns"));
}

function setTool(tool) {
  if (activeTool === "route" && tool !== "route") finishRoute();
  activeTool = tool;
  canvas.dataset.tool = tool;
  $$(".tool[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  const messages = {
    select: "Element anklicken und ziehen. Ausgewählte Elemente können gelöscht werden.",
    route: "Fluchtweg Punkt für Punkt anklicken; mit Doppelklick, Enter oder „Weg abschließen“ beenden.",
    room: "Von einer Raumecke zur gegenüberliegenden Ecke ziehen.",
    wall: "Wand vom Start- zum Endpunkt ziehen.",
    location: "Den tatsächlichen Aushangort einmal im Grundriss anklicken."
  };
  $("#canvasHint").textContent = messages[tool] || messages.select;
  renderPlan();
}

function canvasPoint(event) {
  const point = canvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(canvas.getScreenCTM().inverse());
}

function onPointerDown(event) {
  const point = canvasPoint(event);
  if (activeTool === "select") {
    const target = event.target.closest("[data-id]");
    selectedId = target?.dataset.id || null;
    const item = state.elements.find((element) => element.id === selectedId);
    if (item && ["symbol", "location", "label"].includes(item.type)) {
      pushUndo();
      pointerAction = { type: "move", id: item.id, start: point, origin: { x: item.x, y: item.y } };
      canvas.setPointerCapture(event.pointerId);
    }
    renderPlan();
    return;
  }

  if (activeTool === "route") {
    if (currentRoute.length === 0) pushUndo();
    currentRoute.push({ x: point.x, y: point.y });
    renderPlan();
    return;
  }

  if (activeTool === "location") {
    pushUndo();
    state.elements = state.elements.filter((element) => element.type !== "location");
    const item = { id: uid("location"), type: "location", x: point.x, y: point.y };
    state.elements.push(item);
    selectedId = item.id;
    setTool("select");
    changed();
    return;
  }

  if (activeTool === "wall" || activeTool === "room") {
    pushUndo();
    pointerAction = { type: activeTool, start: point, current: point };
    canvas.setPointerCapture(event.pointerId);
    renderPlan();
  }
}

function onPointerMove(event) {
  if (!pointerAction) return;
  const point = canvasPoint(event);
  if (pointerAction.type === "move") {
    const item = state.elements.find((element) => element.id === pointerAction.id);
    if (item) {
      item.x = pointerAction.origin.x + point.x - pointerAction.start.x;
      item.y = pointerAction.origin.y + point.y - pointerAction.start.y;
    }
  } else {
    pointerAction.current = point;
  }
  renderPlan();
}

function onPointerUp(event) {
  if (!pointerAction) return;
  const action = pointerAction;
  pointerAction = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (action.type === "wall") {
    const dx = action.current.x - action.start.x;
    const dy = action.current.y - action.start.y;
    if (Math.hypot(dx, dy) > 12) state.elements.push({ id: uid("wall"), type: "wall", x1: action.start.x, y1: action.start.y, x2: action.current.x, y2: action.current.y });
  }
  if (action.type === "room") {
    const x = Math.min(action.start.x, action.current.x);
    const y = Math.min(action.start.y, action.current.y);
    const width = Math.abs(action.current.x - action.start.x);
    const height = Math.abs(action.current.y - action.start.y);
    if (width > 20 && height > 20) state.elements.push({ id: uid("room"), type: "room", x, y, width, height });
  }
  changed();
}

function onKeyDown(event) {
  const editable = event.target.matches("input,textarea,select");
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !editable) {
    event.preventDefault();
    undo();
  }
  if (event.key === "Enter" && activeTool === "route" && !editable) finishRoute();
  if ((event.key === "Delete" || event.key === "Backspace") && !editable) deleteSelected();
  if (event.key === "Escape") {
    currentRoute = [];
    pointerAction = null;
    setTool("select");
  }
}

function finishRoute() {
  if (currentRoute.length >= 2) {
    const points = currentRoute.filter((point, index, list) => index === 0 || Math.hypot(point.x - list[index - 1].x, point.y - list[index - 1].y) > 4);
    if (points.length >= 2) state.elements.push({ id: uid("route"), type: "route", points });
  }
  currentRoute = [];
  if (activeTool === "route") setTool("select");
  changed();
}

function addSymbol(code) {
  const same = state.elements.filter((item) => item.type === "symbol").length;
  pushUndo();
  const item = { id: uid("symbol"), type: "symbol", code, x: 530 + (same % 5) * 38, y: 330 + (same % 4) * 34 };
  state.elements.push(item);
  selectedId = item.id;
  setTool("select");
  changed();
}

function addLabel() {
  const value = $("#labelText").value.trim();
  if (!value) {
    $("#labelText").focus();
    return;
  }
  pushUndo();
  const item = { id: uid("label"), type: "label", text: value, x: 520, y: 260 };
  state.elements.push(item);
  selectedId = item.id;
  $("#labelText").value = "";
  setTool("select");
  changed();
}

function deleteSelected() {
  if (!selectedId) return;
  pushUndo();
  state.elements = state.elements.filter((item) => item.id !== selectedId);
  selectedId = null;
  changed();
}

function renderAll() {
  renderPlan();
  renderDocumentData();
  updateProgress();
  updateFileStates();
}

function renderPlan() {
  Object.values(layers).forEach((layer) => layer.replaceChildren());
  renderBase();
  state.elements.forEach(renderElement);
  renderOrientation();
  renderPointerPreview();
  renderLegend();
}

function renderBase() {
  if (state.baseImage?.data) {
    const image = svgElement("image", { x: 35, y: 28, width: 1130, height: 704, preserveAspectRatio: "xMidYMid meet", opacity: (state.settings.opacity ?? 82) / 100 });
    image.setAttribute("href", state.baseImage.data);
    const rotation = Number(state.settings.rotation || 0);
    if (rotation) image.setAttribute("transform", `rotate(${rotation} 600 380)`);
    layers.base.appendChild(image);
  }
  if (state.settings.partialArea && state.overviewImage?.data) {
    const box = svgElement("g", { transform: "translate(925 550)", filter: "url(#softShadow)" });
    box.appendChild(svgElement("rect", { x: 0, y: 0, width: 250, height: 170, rx: 4, fill: "#fff", stroke: "#263d48", "stroke-width": 3 }));
    const title = svgElement("text", { x: 10, y: 18, "font-size": 12, "font-weight": 800, fill: "#173342" });
    title.textContent = "Übersicht / Lage im Gebäude";
    const image = svgElement("image", { x: 8, y: 25, width: 234, height: 137, preserveAspectRatio: "xMidYMid meet" });
    image.setAttribute("href", state.overviewImage.data);
    box.append(title, image);
    layers.overlay.appendChild(box);
  }
}

function renderElement(item) {
  if (item.type === "wall") {
    const line = svgElement("line", { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, class: `wall-line plan-element${item.id === selectedId ? " selected" : ""}`, "data-id": item.id });
    layers.drawing.appendChild(line);
  }
  if (item.type === "room") {
    const rect = svgElement("rect", { x: item.x, y: item.y, width: item.width, height: item.height, class: `room-shape plan-element${item.id === selectedId ? " selected" : ""}`, "data-id": item.id });
    layers.drawing.appendChild(rect);
  }
  if (item.type === "route") renderRoute(item.points, item.id, false);
  if (item.type === "symbol") renderSymbol(item);
  if (item.type === "location") renderLocation(item);
  if (item.type === "label") {
    const label = svgElement("text", { x: item.x, y: item.y, class: `plan-label plan-element${item.id === selectedId ? " selected" : ""}`, "data-id": item.id });
    label.textContent = item.text;
    layers.symbol.appendChild(label);
  }
}

function renderRoute(points, id, preview) {
  if (points.length < 2) return;
  const value = points.map((point) => `${point.x},${point.y}`).join(" ");
  const route = svgElement("polyline", { points: value, class: `route-line plan-element${id === selectedId ? " selected" : ""}`, "data-id": id || "", opacity: preview ? .55 : 1 });
  const core = svgElement("polyline", { points: value, class: "route-core" });
  (preview ? layers.preview : layers.route).append(route, core);
}

function renderSymbol(item) {
  const sign = SIGNS.find((entry) => entry.code === item.code);
  if (!sign) return;
  const group = svgElement("g", { transform: `translate(${item.x} ${item.y})`, class: `plan-element${item.id === selectedId ? " selected" : ""}`, "data-id": item.id, filter: "url(#softShadow)" });
  const background = svgElement("rect", { x: -30, y: -30, width: 60, height: 60, rx: 3, fill: "#fff", stroke: "#fff", "stroke-width": 4 });
  const image = svgElement("image", { x: -27, y: -27, width: 54, height: 54, preserveAspectRatio: "xMidYMid meet" });
  image.setAttribute("href", sign.src);
  group.append(background, image);
  layers.symbol.appendChild(group);
}

function renderLocation(item) {
  const group = svgElement("g", { transform: `translate(${item.x} ${item.y})`, class: `location-marker plan-element${item.id === selectedId ? " selected" : ""}`, "data-id": item.id, filter: "url(#softShadow)" });
  group.appendChild(svgElement("circle", { class: "outer", cx: 0, cy: 0, r: 17 }));
  group.appendChild(svgElement("circle", { class: "inner", cx: 0, cy: 0, r: 5 }));
  const label = svgElement("text", { x: 26, y: 6 });
  label.textContent = "Sie sind hier";
  group.appendChild(label);
  layers.symbol.appendChild(group);
}

function renderOrientation() {
  if (!state.settings.showNorth) return;
  const group = svgElement("g", { transform: "translate(1138 68)" });
  group.appendChild(svgElement("circle", { cx: 0, cy: 0, r: 34, fill: "rgba(255,255,255,.9)", stroke: "#243d48", "stroke-width": 2 }));
  group.appendChild(svgElement("path", { d: "M0 -26 L10 10 L0 5 L-10 10 Z", fill: "#173b4a" }));
  const text = svgElement("text", { x: 0, y: 25, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: "#173b4a" });
  text.textContent = "N";
  group.appendChild(text);
  layers.overlay.appendChild(group);
}

function renderPointerPreview() {
  if (currentRoute.length >= 2) renderRoute(currentRoute, "", true);
  if (!pointerAction || pointerAction.type === "move") return;
  if (pointerAction.type === "wall") layers.preview.appendChild(svgElement("line", { x1: pointerAction.start.x, y1: pointerAction.start.y, x2: pointerAction.current.x, y2: pointerAction.current.y, class: "wall-line", opacity: .55 }));
  if (pointerAction.type === "room") {
    const x = Math.min(pointerAction.start.x, pointerAction.current.x);
    const y = Math.min(pointerAction.start.y, pointerAction.current.y);
    layers.preview.appendChild(svgElement("rect", { x, y, width: Math.abs(pointerAction.current.x - pointerAction.start.x), height: Math.abs(pointerAction.current.y - pointerAction.start.y), class: "room-shape", opacity: .55 }));
  }
}

function renderLegend() {
  const container = $("#legendPreview");
  container.replaceChildren();
  if (!state.settings.showLegend) {
    const hidden = document.createElement("span");
    hidden.className = "legend-empty";
    hidden.textContent = "Legende ausgeblendet.";
    container.appendChild(hidden);
    return;
  }
  const codes = [...new Set(state.elements.filter((item) => item.type === "symbol").map((item) => item.code))];
  codes.forEach((code) => {
    const sign = SIGNS.find((item) => item.code === code);
    if (!sign) return;
    const item = document.createElement("span");
    item.className = "legend-item";
    const image = document.createElement("img");
    image.src = sign.src;
    image.alt = "";
    const label = document.createElement("span");
    label.textContent = `${sign.code} ${sign.label}`;
    item.append(image, label);
    container.appendChild(item);
  });
  if (!codes.length) {
    const empty = document.createElement("span");
    empty.className = "legend-empty";
    empty.textContent = "Verwendete Zeichen werden automatisch ergänzt.";
    container.appendChild(empty);
  }
}

function renderDocumentData() {
  $("#previewTitle").textContent = state.meta.title || "Flucht- und Rettungsplan";
  $("#previewCompany").textContent = state.meta.company || "–";
  $("#previewLocation").textContent = [state.meta.building, state.meta.floor].filter(Boolean).join(" · ") || "–";
  $("#previewNumber").textContent = state.meta.planNumber || "–";
  $("#previewRevision").textContent = state.meta.revision || "–";
  $("#scalePreview").textContent = `Maßstab ${state.settings.scale || "–"}`;
  $("#authorPreview").textContent = `Erstellt durch ${state.meta.author || "–"}`;
  $("#datePreview").textContent = `Datum ${formatDate(state.meta.created)}`;
  $("#emergencyPreview").textContent = state.meta.emergencyNumber || "112";
  renderBehaviorList("#firePreview", state.behavior.fire);
  renderBehaviorList("#accidentPreview", state.behavior.accident);
}

function renderBehaviorList(selector, value) {
  const list = $(selector);
  list.replaceChildren();
  lines(value).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  });
}

function updateProgress() {
  const elementTypes = (type) => state.elements.filter((item) => item.type === type).length;
  const sections = [
    [state.meta.company, state.meta.building, state.meta.floor, state.meta.planNumber, state.meta.author, state.meta.created].every((value) => String(value || "").trim()),
    (Boolean(state.baseImage) || elementTypes("wall") + elementTypes("room") >= 2) && state.confirmations.siteOriented,
    elementTypes("route") > 0 && state.elements.some((item) => item.type === "symbol" && ["E001", "E002", "E016", "E017"].includes(item.code)),
    lines(state.behavior.fire).length >= 4 && lines(state.behavior.accident).length >= 4 && state.settings.showLegend,
    state.confirmations.facilitiesChecked && state.confirmations.currentState && state.confirmations.professionalReview
  ];
  const done = sections.filter(Boolean).length;
  const percent = Math.round((done / sections.length) * 100);
  $("#progressText").textContent = `${done} von 5 Bereichen bearbeitet`;
  $("#progressPercent").textContent = `${percent} %`;
  $("#progressBar").style.width = `${percent}%`;
}

function updateFileStates() {
  const floor = $("#floorFileState");
  floor.textContent = state.baseImage ? `Geladen: ${state.baseImage.name}` : "Noch kein Grundriss geladen.";
  floor.classList.toggle("loaded", Boolean(state.baseImage));
  $("#overviewFileState").textContent = state.overviewImage ? `Geladen: ${state.overviewImage.name}` : "Noch keine Übersicht geladen.";
}

function configureDropZone() {
  const zone = $("#floorDrop");
  ["dragenter", "dragover"].forEach((name) => zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach((name) => zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
  }));
  zone.addEventListener("drop", (event) => loadImageFile(event.dataTransfer.files[0], "baseImage"));
}

function loadImageFile(file, target) {
  if (!file) return;
  const allowed = ["image/png", "image/jpeg", "image/svg+xml"];
  if (!allowed.includes(file.type) && !/\.(svg|png|jpe?g)$/i.test(file.name)) {
    alert("Bitte wählen Sie eine SVG-, PNG- oder JPG-Datei.");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    alert("Die Datei ist größer als 12 MB. Bitte verwenden Sie eine optimierte Planabbildung.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pushUndo();
    state[target] = { name: file.name, type: file.type, data: reader.result };
    changed();
  };
  reader.readAsDataURL(file);
}

function changed() {
  invalidateCheck();
  renderAll();
  scheduleLocalSave();
}

function invalidateCheck() {
  lastResult = null;
  $("#printBtn").disabled = true;
  $("#exportStatus").textContent = "Norm-Check erforderlich";
  $("#exportDetail").textContent = "Der PDF-Export wird nach erfolgreicher Prüfung freigegeben.";
  $(".export-bar").classList.remove("ready");
}

function runNormCheck() {
  finishRoute();
  lastResult = window.FluchtplanRules.validatePlan(state);
  renderNormResults(lastResult);
  $("#normResults").classList.add("visible");
  $$(".editor-section").forEach((section) => section.classList.remove("active"));
  $$(".step-nav button").forEach((button) => button.classList.remove("active"));
  $("#normResults").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#printBtn").disabled = !lastResult.ready;
  if (lastResult.ready) {
    $("#exportStatus").textContent = "Norm-Check ohne offene Pflichtabweichung";
    $("#exportDetail").textContent = "Der Plan kann jetzt als A3-PDF gespeichert oder gedruckt werden.";
    $(".export-bar").classList.add("ready");
  } else {
    $("#exportStatus").textContent = `${lastResult.errors} Pflichtabweichung${lastResult.errors === 1 ? "" : "en"} offen`;
    $("#exportDetail").textContent = "Öffnen Sie den Prüfbericht und ergänzen Sie die fehlenden Angaben.";
  }
}

function renderNormResults(result) {
  const container = $("#normResults");
  container.replaceChildren();
  const summary = document.createElement("div");
  summary.className = `result-summary${result.ready ? " ready" : ""}`;
  const title = document.createElement("h2");
  title.textContent = result.ready ? "Norm-Check bestanden" : `${result.errors} Pflichtabweichung${result.errors === 1 ? "" : "en"} gefunden`;
  const detail = document.createElement("p");
  detail.textContent = `${result.passed} von ${result.total} Prüfpunkten erfüllt · ${result.notices} fachliche Hinweise offen. Der Check ist keine Zertifizierung.`;
  summary.append(title, detail);
  container.appendChild(summary);

  const groups = [...new Set(result.checks.map((item) => item.group))];
  groups.forEach((groupName) => {
    const group = document.createElement("section");
    group.className = "result-group";
    const heading = document.createElement("h3");
    heading.textContent = groupName;
    group.appendChild(heading);
    result.checks.filter((item) => item.group === groupName).forEach((check) => {
      const row = document.createElement("div");
      const failureClass = check.level === "Hinweis" ? "notice" : "fail";
      row.className = `result-item ${check.passed ? "pass" : failureClass}`;
      const icon = document.createElement("span");
      icon.className = "result-icon";
      icon.textContent = check.passed ? "✓" : check.level === "Hinweis" ? "!" : "×";
      const copy = document.createElement("div");
      const titleElement = document.createElement("b");
      titleElement.textContent = check.title;
      const paragraph = document.createElement("p");
      paragraph.textContent = check.passed ? "Erfüllt." : check.detail;
      const source = document.createElement("small");
      source.textContent = `Grundlage: ${check.source}`;
      copy.append(titleElement, paragraph, source);
      row.append(icon, copy);
      group.appendChild(row);
    });
    container.appendChild(group);
  });
}

function scheduleLocalSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Große Planbilder werden weiterhin in der herunterladbaren Projektdatei gesichert. */
    }
  }, 350);
}

function restoreLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2) state = mergeState(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function mergeState(saved) {
  const fresh = defaultState();
  return {
    ...fresh,
    ...saved,
    meta: { ...fresh.meta, ...(saved.meta || {}) },
    settings: { ...fresh.settings, ...(saved.settings || {}) },
    facilities: { ...fresh.facilities, ...(saved.facilities || {}) },
    confirmations: { ...fresh.confirmations, ...(saved.confirmations || {}) },
    behavior: { ...fresh.behavior, ...(saved.behavior || {}) },
    elements: Array.isArray(saved.elements) ? saved.elements : []
  };
}

function newPlan() {
  if (!confirm("Möchten Sie den aktuellen Entwurf wirklich schließen und einen neuen Plan beginnen? Die heruntergeladene Projektdatei bleibt erhalten.")) return;
  state = defaultState();
  undoStack = [];
  selectedId = null;
  currentRoute = [];
  localStorage.removeItem(STORAGE_KEY);
  applyStateToControls();
  invalidateCheck();
  renderAll();
  showSection("sectionMeta");
}

function loadDemo() {
  if (state.elements.length && !confirm("Soll der aktuelle Entwurf durch das Muster ersetzt werden?")) return;
  const demo = defaultState();
  demo.meta = {
    company: "Musterbetrieb GmbH",
    building: "Produktionsgebäude 1",
    floor: "Erdgeschoss – Verpackung",
    planNumber: "FRP-EG-01",
    title: "Flucht- und Rettungsplan",
    author: "Max Mustermann, Brandschutzbeauftragter",
    created: today(),
    revision: "Rev. 1",
    nextReview: nextYear(),
    emergencyNumber: "Notruf 112 · Werkschutz 555"
  };
  demo.confirmations = { siteOriented: true, lowLightUsable: false, facilitiesChecked: true, currentState: true, professionalReview: true };
  demo.elements = [
    { id: uid("room"), type: "room", x: 120, y: 120, width: 780, height: 490 },
    { id: uid("wall"), type: "wall", x1: 510, y1: 120, x2: 510, y2: 610 },
    { id: uid("wall"), type: "wall", x1: 120, y1: 360, x2: 900, y2: 360 },
    { id: uid("route"), type: "route", points: [{ x: 255, y: 520 }, { x: 430, y: 430 }, { x: 650, y: 300 }, { x: 885, y: 300 }] },
    { id: uid("location"), type: "location", x: 250, y: 520 },
    { id: uid("label"), type: "label", text: "Verpackung", x: 210, y: 235 },
    { id: uid("label"), type: "label", text: "Flur", x: 610, y: 445 },
    { id: uid("symbol"), type: "symbol", code: "E002", x: 885, y: 300 },
    { id: uid("symbol"), type: "symbol", code: "E003", x: 310, y: 155 },
    { id: uid("symbol"), type: "symbol", code: "F001", x: 535, y: 330 },
    { id: uid("symbol"), type: "symbol", code: "F005", x: 835, y: 330 },
    { id: uid("symbol"), type: "symbol", code: "E007", x: 1010, y: 225 }
  ];
  state = demo;
  undoStack = [];
  selectedId = null;
  applyStateToControls();
  changed();
  showSection("sectionMeta");
}

function downloadProject(event) {
  event.preventDefault();
  scheduleLocalSave();
  const filename = sanitizeFilename($("#projectName").value || "flucht-und-rettungsplan") + ".frp.json";
  downloadBlob(filename, new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  $("#saveDialog").close();
}

function importProject(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed.version !== 2) throw new Error("Nicht unterstützte Projektversion");
      state = mergeState(parsed);
      undoStack = [];
      selectedId = null;
      currentRoute = [];
      applyStateToControls();
      invalidateCheck();
      renderAll();
      scheduleLocalSave();
      showSection("sectionMeta");
    } catch {
      alert("Die Projektdatei konnte nicht geöffnet werden. Bitte wählen Sie eine gültige .frp.json-Datei.");
    }
    $("#projectUpload").value = "";
  };
  reader.readAsText(file);
}

function sanitizeFilename(value) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, "-").replace(/^-+|-+$/g, "") || "flucht-und-rettungsplan";
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvg() {
  const copy = canvas.cloneNode(true);
  copy.querySelector("#gridLayer")?.remove();
  copy.querySelector("#previewLayer")?.remove();
  copy.setAttribute("xmlns", SVG_NS);
  const data = new XMLSerializer().serializeToString(copy);
  downloadBlob(`${sanitizeFilename(state.meta.planNumber || "fluchtplan")}.svg`, new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
}

function printPlan() {
  const result = window.FluchtplanRules.validatePlan(state);
  if (!result.ready) {
    runNormCheck();
    alert("Der PDF-Export ist erst möglich, wenn alle Pflichtabweichungen bearbeitet wurden.");
    return;
  }
  document.body.classList.remove("print-a3", "print-a4");
  document.body.classList.add(state.settings.format === "A4" ? "print-a4" : "print-a3");
  window.print();
}

window.addEventListener("afterprint", () => document.body.classList.remove("print-a3", "print-a4"));

function initialize() {
  restoreLocal();
  renderSignLibrary();
  bindControls();
  applyStateToControls();
  setTool("select");
  renderAll();
}

initialize();
