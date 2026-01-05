
// === Hilfsfunktionen & Referenzen ===
const $ = (sel) => document.querySelector(sel);
const canvas = $("#planCanvas");
const floorGroup = $("#floorGroup");
const drawGrid = $("#drawGrid");
const drawGroup = $("#drawGroup");
const symbolsGroup = $("#symbolsGroup");
const northGroup = $("#northGroup");
const youAreHereGroup = $("#youAreHereGroup");
const legendGroup = $("#legendGroup");

let symbolsDB = {};
fetch("./assets/symbols.json")
  .then(r => r.json())
  .then(json => {
    symbolsDB = json;
    fillSelect("#rescueSignSelect", json.rescue);
    fillSelect("#fireSignSelect", json.fire);
    fillSelect("#warnSignSelect", json.warning);
    fillSelect("#mandSignSelect", json.mandatory);
  });

function fillSelect(id, arr){
  const el = $(id);
  arr.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.code; opt.textContent = `${s.code} — ${s.label}`;
    el.appendChild(opt);
  });
}

// === Maßstab / Raster ===
// Wir nehmen eine feste viewBox 1400 x 1000 px ≈ A3 quer (420 x 297 mm).
const PX_PER_MM_X = 1400 / 420;  // ≈ 3.333
const PX_PER_MM_Y = 1000 / 297;  // ≈ 3.367
const PX_PER_MM = (PX_PER_MM_X + PX_PER_MM_Y) / 2; // ≈ 3.35 px/mm

function mmToPx(mm) { return mm * PX_PER_MM; }
function pxToMm(px) { return px / PX_PER_MM; }

// === Zeichenstatus ===
const state = {
  tool: "select",
  drawing: [],            // [{type, ...}], z.B. wall, door, window, room, measure
  selection: null,
  isPanning: false,
  panStart: null,
  wallPreview: null,
  measurePreview: null,
  undoStack: []
};

function pushUndo() {
  // flache Kopie des Zustands für Undo
  state.undoStack.push(JSON.stringify(state.drawing));
  if (state.undoStack.length > 50) state.undoStack.shift();
}
$("#undoBtn").addEventListener("click", () => {
  if (state.undoStack.length) {
    state.drawing = JSON.parse(state.undoStack.pop());
    renderDrawing();
  }
});
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    $("#undoBtn").click();
    e.preventDefault();
  }
});

// === Raster & Snap ===
const gridToggle = $("#gridToggle");
const snapToggle = $("#snapToggle");
const gridSizeMmInput = $("#gridSizeMm");

function renderGrid() {
  drawGrid.innerHTML = "";
  if (!gridToggle.checked) return;
  const stepPx = mmToPx(parseInt(gridSizeMmInput.value || "500", 10));
  for (let x = 0; x <= 1400; x += stepPx) {
    const line = lineEl(x, 0, x, 1000, "grid-line");
    drawGrid.appendChild(line);
  }
  for (let y = 0; y <= 1000; y += stepPx) {
    const line = lineEl(0, y, 1400, y, "grid-line");
    drawGrid.appendChild(line);
  }
  // Achsen (0)
  drawGrid.appendChild(lineEl(0, 0, 1400, 0, "grid-axis"));
  drawGrid.appendChild(lineEl(0, 0, 0, 1000, "grid-axis"));
}

gridToggle.addEventListener("change", renderGrid);
gridSizeMmInput.addEventListener("change", () => { renderGrid(); });
renderGrid();

function snap(x,y) {
  if (!snapToggle.checked) return {x,y};
  const stepPx = mmToPx(parseInt(gridSizeMmInput.value || "500", 10));
  const sx = Math.round(x / stepPx) * stepPx;
  const sy = Math.round(y / stepPx) * stepPx;
  return { x: sx, y: sy };
}

// === Datei laden (optional) ===
$("#loadSample").addEventListener("click", async () => {
  const res = await fetch("./samples/demo-floor.svg");
  const svgText = await res.text();
  floorGroup.innerHTML = svgText;
  drawLegend();
});
$("#floorUpload").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (file.type.includes("svg")) floorGroup.innerHTML = reader.result;
    else {
      const url = reader.result;
      floorGroup.innerHTML = `${url}`;
    }
    drawLegend();
  };
  reader.readAsDataURL(file);
});

// === CAD Werkzeugleiste ===
document.querySelectorAll(".toolbtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".toolbtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.tool = btn.getAttribute("data-tool");
    state.selection = null;
    clearPreviews();
  });
});
document.querySelector('.toolbtn[data-tool="select"]').classList.add("active");

// === SVG Hilfs-Erzeuger ===
function lineEl(x1,y1,x2,y2, cls, sw=2) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", x1); el.setAttribute("y1", y1);
  el.setAttribute("x2", x2); el.setAttribute("y2", y2);
  el.setAttribute("class", cls || "");
  el.setAttribute("stroke-width", sw);
  return el;
}
function rectEl(x,y,w,h, cls, sw=2, fill="none") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  el.setAttribute("x", Math.min(x, x+w));
  el.setAttribute("y", Math.min(y, y+h));
  el.setAttribute("width", Math.abs(w));
  el.setAttribute("height", Math.abs(h));
  el.setAttribute("class", cls || "");
  el.setAttribute("stroke-width", sw);
  el.setAttribute("fill", fill);
  return el;
}
function arcPath(x,y,r,angle) {
  // einfacher Türanschlag (90° Bogen)
  const rad = (angle || 90) * Math.PI/180;
  const x2 = x + r*Math.cos(rad), y2 = y + r*Math.sin(rad);
  const large = angle > 180 ? 1 : 0;
  return `M ${x},${y} A ${r},${r} 0 ${large},1 ${x2},${y2}`;
}

// === Zeichenlogik ===
const wallThkMm = $("#wallThkMm");
const doorWidthMm = $("#doorWidthMm");
const winWidthMm = $("#winWidthMm");

let pointer = {x:0,y:0};   // aktuelle Mausposition im SVG

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("dblclick", onDblClick);
window.addEventListener("keydown", onKeyDown);

function svgPoint(evt){
  const pt = canvas.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const m = canvas.getScreenCTM().inverse();
  const p = pt.matrixTransform(m);
  return { x: p.x, y: p.y };
}

function onPointerDown(e){
  const p = svgPoint(e);
  pointer = p;
  if (state.tool === "pan") {
    state.isPanning = true;
    state.panStart = { x: e.clientX, y: e.clientY, vb: canvas.viewBox.baseVal };
    return;
  }
  if (state.tool === "select" || state.tool === "erase") {
    const target = e.target.closest(".draw-elt");
    if (target) {
      if (state.tool === "erase") { pushUndo(); removeById(target.dataset.id); return; }
      state.selection = target.dataset.id;
      updateSelection();
      return;
    } else {
      state.selection = null; updateSelection();
      return;
    }
  }
  if (state.tool === "wall") {
    pushUndo();
    const q = snap(p.x, p.y);
    state.wallPreview = { start: q, end: q };
    renderPreviews();
    return;
  }
  if (state.tool === "rect") {
    pushUndo();
    const q = snap(p.x, p.y);
    state.measurePreview = { start: q, end: q, mode:"rect" };
    renderPreviews();
    return;
  }
  if (state.tool === "measure") {
    const q = snap(p.x, p.y);
    state.measurePreview = { start: q, end: q, mode:"measure" };
    renderPreviews();
    return;
  }
  if (state.tool === "door" || state.tool === "window") {
    pushUndo();
    const q = snap(p.x, p.y);
    placeOpening(state.tool, q);
    renderDrawing();
  }
}

function onPointerMove(e){
  const p = svgPoint(e);
  pointer = p;

  if (state.isPanning) {
    const dx = state.panStart.vb.x - (e.clientX - state.panStart.x)/2;
    const dy = state.panStart.vb.y - (e.clientY - state.panStart.y)/2;
    canvas.viewBox.baseVal.x = dx;
    canvas.viewBox.baseVal.y = dy;
    return;
  }

  if (state.wallPreview) {
    const q = snap(p.x, p.y);
    state.wallPreview.end = q;
    renderPreviews();
    return;
  }
  if (state.measurePreview) {
    const q = snap(p.x, p.y);
    state.measurePreview.end = q;
    renderPreviews();
    return;
  }
}

function onPointerUp(e){
  if (state.isPanning) { state.isPanning = false; return; }

  if (state.wallPreview) {
    const { start, end } = state.wallPreview;
    if (distance(start, end) > 1) {
      const thkPx = mmToPx(parseFloat(wallThkMm.value || "240"));
      const id = genId("wall");
      state.drawing.push({ id, type:"wall", x1:start.x, y1:start.y, x2:end.x, y2:end.y, thk: thkPx });
    }
    state.wallPreview = null;
    clearPreviews();
    renderDrawing();
    return;
  }

  if (state.measurePreview && state.measurePreview.mode === "rect") {
    const { start, end } = state.measurePreview;
    const id = genId("room");
    state.drawing.push({ id, type:"room", x:start.x, y:start.y, w:end.x - start.x, h:end.y - start.y });
    state.measurePreview = null;
    clearPreviews();
    renderDrawing();
    return;
  }

  if (state.measurePreview && state.measurePreview.mode === "measure") {
    const { start, end } = state.measurePreview;
    const id = genId("measure");
    state.drawing.push({ id, type:"measure", x1:start.x, y1:start.y, x2:end.x, y2:end.y });
    state.measurePreview = null;
    clearPreviews();
    renderDrawing();
    return;
  }
}

function onDblClick(e){
  const target = e.target.closest(".draw-elt");
  if (target) { pushUndo(); removeById(target.dataset.id); }
}

function onKeyDown(e){
  if (e.key === "Delete" || e.key === "Backspace") {
    if (state.selection) { pushUndo(); removeById(state.selection); state.selection = null; updateSelection(); }
  }
  if (e.key.toLowerCase() === "w") setTool("wall");
  if (e.key.toLowerCase() === "r") setTool("rect");
  if (e.key.toLowerCase() === "t") setTool("door");
  if (e.key.toLowerCase() === "f") setTool("window");
  if (e.key.toLowerCase() === "v") setTool("select");
  if (e.key.toLowerCase() === "m") setTool("measure");
}

function setTool(name){
  document.querySelectorAll(".toolbtn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.toolbtn[data-tool="${name}"]`);
  if (btn) btn.classList.add("active");
  state.tool = name;
  state.selection = null;
  clearPreviews();
}

function placeOpening(kind, p) {
  // Öffnungen werden als zentrales Element mit Breite und Ausrichtung gesetzt.
  const widthMm = kind === "door" ? parseFloat(doorWidthMm.value||"1000") : parseFloat(winWidthMm.value||"1200");
  const id = genId(kind);
  state.drawing.push({
    id, type: kind, x: p.x, y: p.y,
    angle: 0, widthPx: mmToPx(widthMm)
  });
}

// === Rendern ===
function renderPreviews(){
  // temporäre Layer in drawGroup nicht mischen: wir nutzen eine eigene Gruppe
  const prevId = "preview-layer";
  let prev = document.getElementById(prevId);
  if (!prev) { prev = document.createElementNS("http://www.w3.org/2000/svg","g"); prev.id = prevId; drawGroup.appendChild(prev); }
  prev.innerHTML = "";

  if (state.wallPreview) {
    const { start, end } = state.wallPreview;
    const line = lineEl(start.x, start.y, end.x, end.y, "wall", mmToPx(parseFloat(wallThkMm.value||"240")));
    line.setAttribute("opacity", "0.5");
    prev.appendChild(line);
  }
  if (state.measurePreview) {
    if (state.measurePreview.mode === "rect") {
      const { start, end } = state.measurePreview;
      prev.appendChild(rectEl(start.x, start.y, end.x-start.x, end.y-start.y, "room", 2, "#e5f0ff"));
    } else {
      const { start, end } = state.measurePreview;
      prev.appendChild(lineEl(start.x, start.y, end.x, end.y, "measure", 2));
    }
  }
}
function clearPreviews(){
  const prev = document.getElementById("preview-layer");
  if (prev) prev.remove();
}

function renderDrawing(){
  drawGroup.innerHTML = "";

  for (const elt of state.drawing) {
    let node = null;

    if (elt.type === "wall") {
      node = lineEl(elt.x1, elt.y1, elt.x2, elt.y2, "draw-elt wall", elt.thk || mmToPx(240));
    }

    if (elt.type === "room") {
      node = rectEl(elt.x, elt.y, elt.w, elt.h, "draw-elt room", 2, "#f1f5f9");
    }

    if (elt.type === "door") {
      const r = (elt.widthPx || mmToPx(1000)) / 2;
      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d", arcPath(elt.x, elt.y, r, 90));
      path.setAttribute("class","draw-elt door");
      node = document.createElementNS("http://www.w3.org/2000/svg","g");
      node.appendChild(path);
    }

    if (elt.type === "window") {
      const w = elt.widthPx || mmToPx(1200);
      const l1 = lineEl(elt.x - w/2, elt.y, elt.x + w/2, elt.y, "draw-elt window", 3);
      node = document.createElementNS("http://www.w3.org/2000/svg","g");
      node.appendChild(l1);
    }

    if (elt.type === "measure") {
      node = lineEl(elt.x1, elt.y1, elt.x2, elt.y2, "draw-elt measure", 2);
    }

    if (!node) continue;

    // Markierung, Auswahl, Drag
    if (node.classList) node.classList.add("draw-elt");
    node.dataset.id = elt.id;
    attachInteract(node, elt);
    drawGroup.appendChild(node);
  }
  updateSelection();
}

function attachInteract(node, elt){
  // Ziehen (einfach): auf Gruppe/Element anwenden
  let dragging = false, sx=0, sy=0;

  node.addEventListener("pointerdown", (e) => {
    if (state.tool !== "select") return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    state.selection = elt.id; updateSelection();
    e.stopPropagation();
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging || state.tool !== "select") return;
    const dx = (e.clientX - sx);
    const dy = (e.clientY - sy);
    sx = e.clientX; sy = e.clientY;
    const dxSvg = dx / (window.devicePixelRatio || 1) * 0.75; // grobe Umrechnung
    const dySvg = dy / (window.devicePixelRatio || 1) * 0.75;

    if (elt.type === "wall") { elt.x1 += dxSvg; elt.y1 += dySvg; elt.x2 += dxSvg; elt.y2 += dySvg; }
    else if (elt.type === "room") { elt.x += dxSvg; elt.y += dySvg; }
    else if (elt.type === "door" || elt.type === "window") { elt.x += dxSvg; elt.y += dySvg; }
    else if (elt.type === "measure") { elt.x1 += dxSvg; elt.y1 += dySvg; elt.x2 += dxSvg; elt.y2 += dySvg; }

    renderDrawing();
  });
  window.addEventListener("pointerup", () => { dragging = false; });
}

function updateSelection(){
  drawGroup.querySelectorAll(".draw-elt").forEach(n => n.classList.remove("selected"));
  if (!state.selection) return;
  const selNode = drawGroup.querySelector(`[data-id="${state.selection}"]`);
  if (selNode) selNode.classList.add("selected");
}

function removeById(id){
  state.drawing = state.drawing.filter(d => d.id !== id);
  renderDrawing();
}
function genId(prefix){ return `${prefix}-${Math.random().toString(36).slice(2,9)}`; }
function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

// === Legende, Nordpfeil, Standort ===
$("#legendLang").addEventListener("change", drawLegend);
function legendText(lang){
  return lang === "en"
    ? { title:"Legend", rescue:"Emergency", fire:"Fire", warn:"Warning", mand:"Mandatory" }
    : { title:"Legende", rescue:"Rettungszeichen", fire:"Brandbekämpfung", warn:"Warnzeichen", mand:"Gebotszeichen" };
}
function drawLegend(){
  const lang = $("#legendLang").value || "de";
  const t = legendText(lang);
  legendGroup.innerHTML = `
    <g transform="translate(1050,860)">
      <rect x="0" y="0" width="330" height="120" fill="#fff" stroke="#cbd5e1"/>
      <text x="10" y="20" font-size="14" font-weight="700">${t.title}</text>
      <g transform="translate(10,40)">
        <rect x="0" y="-12" width="24" height="24" fill="#16a34a" stroke="#111"/><text x="32" y="6" font-size="12">${t.rescue}</text>
        <rect x="150" y="-12" width="24" height="24" fill="#dc2626" stroke="#111"/><text x="182" y="6" font-size="12">${t.fire}</text>
      </g>
      <g transform="translate(10,80)">
        <rect x="0" y="-12" width="24" height="24" fill="#f59e0b" stroke="#111"/><text x="32" y="6" font-size="12">${t.warn}</text>
        <rect x="150" y="-12" width="24" height="24" fill="#1e40af" stroke="#111"/><text x="182" y="6" font-size="12">${t.mand}</text>
      </g>
    </g>
  `;
}
$("#showNorth").addEventListener("change", (e) => {
  northGroup.innerHTML = e.target.checked ? `
    <g transform="translate(1320,60)">
      <text x="0" y="0" font-size="12" fill="#111">N</text>
      <path d="M0,10 L0,-20 M-5,-15 L0,-25 L5,-15" stroke="#111" fill="#111"/>
    </g>` : "";
});
$("#showYouAreHere").addEventListener("change", (e) => {
  youAreHereGroup.innerHTML = e.target.checked ? `
    <g transform="translate(80,920)">
      <circle cx="0" cy="0" r="8" fill="#1e40af" />
      <text x="14" y="5" font-size="12" fill="#111">Sie sind hier</text>
    </g>` : "";
});

// === ISO 7010 Symbole ===
async function loadIconSVG(code) {
  const res = await fetch(`/api/icons/${code}`);
  if (res.ok) return await res.text();
  return `<rect x="-18" y="-18" width="36" height="36" rx="2" fill="#16a34a" stroke="#111" />
          <text x="0" y="6" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${code}</text>`;
}
async function drawSymbol(code, x, y) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${x},${y})`);
  g.setAttribute("data-code", code);
  const svg = await loadIconSVG(code);
  g.innerHTML = `<g transform="translate(-18,-18)">${svg}</g>`;
  symbolsGroup.appendChild(g);
  makeSymbolDraggable(g);
  g.addEventListener("dblclick", () => g.remove());
}
function makeSymbolDraggable(el) {
  let drag = false, sx=0, sy=0, ox=0, oy=0;
  el.addEventListener("mousedown", (e) => {
    drag = true;
    const m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(el.getAttribute("transform"));
    ox = m ? parseFloat(m[1]) : 0; oy = m ? parseFloat(m[2]) : 0;
    sx = e.clientX; sy = e.clientY;
  });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const nx = ox + (e.clientX - sx);
    const ny = oy + (e.clientY - sy);
    el.setAttribute("transform", `translate(${nx},${ny})`);
  });
  window.addEventListener("mouseup", () => drag = false);
}
$("#addRescueSign").addEventListener("click", () => addFromSelect("#rescueSignSelect"));
$("#addFireSign").addEventListener("click", () => addFromSelect("#fireSignSelect"));
$("#addWarnSign").addEventListener("click", () => addFromSelect("#warnSignSelect"));
$("#addMandSign").addEventListener("click", () => addFromSelect("#mandSignSelect"));
function addFromSelect(sel){
  const code = $(sel).value;
  drawSymbol(code, 700, 500);
}

// === AI ===
$("#aiSuggestBtn").addEventListener("click", async () => {
  const payload = collectPlanContext();
  const res = await fetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "layout", context: payload })
  });
  const json = await res.json();
  $("#aiOutput").textContent = JSON.stringify(json, null, 2);
  if (json.suggestedSymbols) {
    for (const s of json.suggestedSymbols) await drawSymbol(s.code, s.x, s.y);
  }
});
$("#aiTextsBtn").addEventListener("click", async () => {
  const payload = collectPlanContext();
  const res = await fetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "texts", context: payload })
  });
  const json = await res.json();
  $("#aiOutput").textContent = JSON.stringify(json, null, 2);
});

// === Prüfung & Export ===
$("#validateBtn").addEventListener("click", async () => {
  const payload = collectPlanContext();
  const res = await fetch("/api/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  $("#validationOutput").textContent = JSON.stringify(json, null, 2);
});

$("#exportSVG").addEventListener("click", () => {
  const svgData = new XMLSerializer().serializeToString(canvas);
  download("fluchtplan.svg", "image/svg+xml;charset=utf-8", svgData);
});
$("#exportPNG").addEventListener("click", async () => {
  const svgData = new XMLSerializer().serializeToString(canvas);
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const cnv = document.createElement("canvas");
    cnv.width = 1400; cnv.height = 1000;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cnv.width,cnv.height);
    ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    cnv.toBlob(blob => download("fluchtplan.png", "image/png", blob), "image/png");
  };
  img.src = url;
});
$("#exportPDF").addEventListener("click", () => {
  alert("Bitte über den Browser drucken: A3, 100 %, Hintergrundgrafiken an.");
});
$("#exportPDFServer").addEventListener("click", async () => {
  const svgData = new XMLSerializer().serializeToString(canvas);
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  img.onload = async () => {
    const cnv = document.createElement("canvas");
    cnv.width = 1400; cnv.height = 1000;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cnv.width,cnv.height);
    ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    cnv.toBlob(async (blob) => {
      const jpegArray = new Uint8Array(await blob.arrayBuffer());
      const b64 = btoa(String.fromCharCode(...jpegArray));
      // Turnstile optional; wenn nicht aktiv, leeren Token senden (Server kann es ignorieren/prüfen)
      const res = await fetch("/api/pdf/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jpegBase64: b64, turnstileToken: "" })
      });
      if (!res.ok) { alert("PDF‑Erstellung fehlgeschlagen."); return; }
      const pdfBlob = await res.blob();
      download("fluchtplan.pdf", "application/pdf", pdfBlob);
    }, "image/jpeg", 0.92);
  };
  img.src = url;
});

function download(name, type, data){
  const a = document.createElement("a");
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// === Planstatus sammeln (Drafts) ===
function collectPlanContext(){
  return {
    size: $("#planSize").value,
    scale: $("#scaleInput").value,
    hasNorthArrow: $("#showNorth").checked,
    hasYouAreHere: $("#showYouAreHere").checked,
    siteContext: $("#siteContext").value,
    legendLang: $("#legendLang").value,
    drawing: state.drawing, // CAD‑Elemente
    symbols: Array.from(symbolsGroup.querySelectorAll("g")).map(g => {
      const t = g.getAttribute("transform");
      const m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(t);
      const xy = m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
      const code = g.getAttribute("data-code") || "E001";
      return { code, ...xy };
    })
  };
}

// === Entwürfe (KV + D1) ===
$("#saveDraftBtn").addEventListener("click", async () => {
  const title = $("#draftTitle").value || "Unbenannter Entwurf";
  const payload = collectPlanContext();
  const res = await fetch("/api/drafts/save", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, plan: payload })
  });
  const json = await res.json();
  alert(json.message || "Gespeichert.");
});
$("#listDraftsBtn").addEventListener("click", async () => {
  const res = await fetch("/api/drafts/list");
  const list = await res.json();
  $("#draftsList").textContent = JSON.stringify(list, null, 2);
});
