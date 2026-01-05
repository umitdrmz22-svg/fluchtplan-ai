
// Basit yardımcılar
const $ = (sel) => document.querySelector(sel);
const canvas = $("#planCanvas");
const floorGroup = $("#floorGroup");
const symbolsGroup = $("#symbolsGroup");
const northGroup = $("#northGroup");
const youAreHereGroup = $("#youAreHereGroup");
const legendGroup = $("#legendGroup");

// Sembolleri yükle
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

// Demo floor svg yükleme
$("#loadSample").addEventListener("click", async () => {
  const res = await fetch("./samples/demo-floor.svg");
  const svgText = await res.text();
  floorGroup.innerHTML = svgText;  // inline olarak yerleştir
  drawLegend();
});

// Dosya yükleme
$("#floorUpload").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (file.type.includes("svg")) {
      floorGroup.innerHTML = reader.result;
    } else {
      // raster resmi <image> ile göm
      floorGroup.innerHTML = `${reader.result}`;
    }
    drawLegend();
  };
  reader.readAsDataURL(file);
});

// Basit yer tutucu ikon çizimi (gerçek ISO vektörünü sonra ekleyebilirsiniz)
function drawSymbol(code, x, y) {
  const cat = getCategory(code);
  const color = cat === "rescue" ? "#16a34a" :
                cat === "fire" ? "#dc2626" :
                cat === "warning" ? "#f59e0b" : "#1e40af";
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${x},${y})`);
  g.innerHTML = `
    <rect x="-18" y="-18" width="36" height="36" rx="2" fill="${color}" stroke="#111" stroke-width="1" />
    <text x="0" y="6" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${code}</text>
  `;
  symbolsGroup.appendChild(g);
  g.addEventListener("click", () => g.remove());
}
function getCategory(code){
  for (const k of Object.keys(symbolsDB)){
    if (symbolsDB[k].find(s => s.code === code)) return k;
  }
  return "rescue";
}

// UI: sembol ekleme
$("#addRescueSign").addEventListener("click", () => addFromSelect("#rescueSignSelect"));
$("#addFireSign").addEventListener("click", () => addFromSelect("#fireSignSelect"));
$("#addWarnSign").addEventListener("click", () => addFromSelect("#warnSignSelect"));
$("#addMandSign").addEventListener("click", () => addFromSelect("#mandSignSelect"));
function addFromSelect(sel){
  const code = $(sel).value;
  // Ortaya yerleştir, sonra kullanıcı sürüklesin (basit sürükleme)
  drawSymbol(code, 700, 500);
}

// Kuzey oku ve “Sie sind hier”
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

// Basit efsane/legend
function drawLegend(){
  legendGroup.innerHTML = `
    <g transform="translate(1050,860)">
      <rect x="0" y="0" width="330" height="120" fill="#fff" stroke="#cbd5e1"/>
      <text x="10" y="20" font-size="14" font-weight="700">Legende</text>
      <g transform="translate(10,40)">
        <rect x="0" y="-12" width="24" height="24" fill="#16a34a" stroke="#111"/><text x="32" y="6" font-size="12">Rettungszeichen</text>
        <rect x="150" y="-12" width="24" height="24" fill="#dc2626" stroke="#111"/><text x="182" y="6" font-size="12">Brandbekämpfung</text>
      </g>
      <g transform="translate(10,80)">
        <rect x="0" y="-12" width="24" height="24" fill="#f59e0b" stroke="#111"/><text x="32" y="6" font-size="12">Warnzeichen</text>
        <rect x="150" y="-12" width="24" height="24" fill="#1e40af" stroke="#111"/><text x="182" y="6" font-size="12">Gebotszeichen</text>
      </g>
    </g>
  `;
}

// AI çağrısı: JSON öneriler (yerleşim ve metin)
$("#aiSuggestBtn").addEventListener("click", async () => {
  const payload = collectPlanContext();
  const res = await fetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "layout", context: payload })
  });
  const json = await res.json();
  $("#aiOutput").textContent = JSON.stringify(json, null, 2);

  // Önerilen sembolleri yerleştir
  if (json.suggestedSymbols) {
    json.suggestedSymbols.forEach(s => drawSymbol(s.code, s.x, s.y));
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
  // Davranış metinlerini legend altına küçük bir alanla ekleyebilirsiniz (kısaltılmış).
});

// Plan bağlamını topla
function collectPlanContext(){
  return {
    scale: $("#scaleInput").value,
    size: $("#planSize").value,
    siteContext: $("#siteContext").value,
    symbols: Array.from(symbolsGroup.querySelectorAll("g")).map(g => {
      const t = g.getAttribute("transform");
      const m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(t);
      const xy = m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
      const code = g.querySelector("text").textContent.trim();
      return { code, ...xy };
    })
  };
}

// Dışa aktarma (basit)
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
  // Kütüphane kullanmadan basit çözüm: SVG → PNG → PDF veri-uri
  alert("PDF çıktısı tarayıcı yazdırma ile alınır: Ctrl+P / A3 / 100%. Özel PDF modülü eklemek istiyorsanız jsPDF gibi bir kütüphane ekleyiniz.");
});
function download(name, type, data){
  const a = document.createElement("a");
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
