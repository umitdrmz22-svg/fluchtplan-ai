
const $ = (sel) => document.querySelector(sel);

// SVG-Gruppen
const canvas = $("#planCanvas");
const floorGroup = $("#floorGroup");
const symbolsGroup = $("#symbolsGroup");
const northGroup = $("#northGroup");
const youAreHereGroup = $("#youAreHereGroup");
const legendGroup = $("#legendGroup");

// Symbol-Datenbank
let symbolsDB = {};
fetch("./assets/symbols.json").then(r => r.json()).then(json => {
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

// Demo-Grundriss
$("#loadSample").addEventListener("click", async () => {
  const res = await fetch("./samples/demo-floor.svg");
  const svgText = await res.text();
  floorGroup.innerHTML = svgText;
  drawLegend();
});

// Datei-Upload
$("#floorUpload").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (file.type.includes("svg")) {
      floorGroup.innerHTML = reader.result;
    } else {
      const url = reader.result;
      floorGroup.innerHTML = `${url}`;
    }
    drawLegend();
  };
  reader.readAsDataURL(file);
});

// ECHTE ISO 7010 SVG-Icons laden (aus /assets/icons/{CODE}.svg) via Function
async function loadIconSVG(code) {
  const res = await fetch(`/api/icons/${code}`);
  if (res.ok) return await res.text();
  // Fallback: Platzhalter
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
  makeDraggable(g);
  g.addEventListener("dblclick", () => g.remove());
}

function makeDraggable(el) {
  let drag = false, sx=0, sy=0, ox=0, oy=0;
  el.addEventListener("mousedown", (e) => {
    drag = true;
    const m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(el.getAttribute("transform"));
    ox = m ? parseFloat(m[1]) : 0;
    oy = m ? parseFloat(m[2]) : 0;
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

// Nordpfeil / Sie sind hier
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

// Legende (Mehrsprachig: de/en)
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
$("#legendLang").addEventListener("change", drawLegend);

// AI-Aufrufe
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

// Validierung DIN/ISO inkl. Maßstab
$("#validateBtn").addEventListener("click", async () => {
  const payload = collectPlanContext();
  const res = await fetch("/api/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  $("#validationOutput").textContent = JSON.stringify(json, null, 2);
});

// Export: Clientseitig
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

// Export: Serverseitig (PDF, A3) – nutzt Turnstile + JPEG
$("#exportPDFServer").addEventListener("click", async () => {
  // Canvas → JPEG
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
      const token = getTurnstileToken();
      const res = await fetch("/api/pdf/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jpegBase64: b64, turnstileToken: token })
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

// Planstatus sammeln
function collectPlanContext(){
  return {
    size: $("#planSize").value,
    scale: $("#scaleInput").value,
    hasNorthArrow: $("#showNorth").checked,
    hasYouAreHere: $("#showYouAreHere").checked,
    siteContext: $("#siteContext").value,
    legendLang: $("#legendLang").value,
    symbols: Array.from(symbolsGroup.querySelectorAll("g")).map(g => {
      const t = g.getAttribute("transform");
      const m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(t);
      const xy = m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
      const code = g.getAttribute("data-code") || "E001";
      return { code, ...xy };
    })
  };
}

// Turnstile: Token lesen
function getTurnstileToken(){
  const input = document.querySelector('input[name="cf-turnstile-response"]');
  return input ? input.value : "";
}

// Sitzung starten (Turnstile + Rolle -> Durable Object)
$("#sessionStartBtn").addEventListener("click", async () => {
  const role = $("#roleSelect").value || "viewer";
  const token = getTurnstileToken();
  const res = await fetch("/api/session/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, turnstileToken: token })
  });
  const json = await res.json();
  $("#sessionInfo").textContent = JSON.stringify(json, null, 2);
});

// Entwürfe (KV + D1)
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
