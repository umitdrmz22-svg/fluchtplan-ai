
export async function onRequestPost({ env, request }) {
  try {
    const { jpegBase64, turnstileToken } = await request.json();

    // Optional: Turnstile prüfen (empfohlen)
    const formData = new FormData();
    formData.append("secret", env.TURNSTILE_SECRET || "DEIN_SECRET_HIER");
    formData.append("response", turnstileToken || "");
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
    const vjson = await verify.json();
    if (!vjson.success) return new Response("Turnstile fehlgeschlagen", { status: 400 });

    const imgBytes = Uint8Array.from(atob(jpegBase64), c => c.charCodeAt(0));

    // Einfacher PDF‑Writer mit einer JPEG‑Bild‑XObject (DCTDecode)
    // A3 Maße in Punkten (1pt = 1/72 inch): A3 (297 x 420 mm) ≈ (842 x 1190 pt)
    const pageW = 1190, pageH = 842; // Querformat A3
    const imgW = 1190, imgH = 842;   // Bild auf volle Seite

    const objects = [];
    let offset = 0;
    function addObj(str){ const len = (new TextEncoder()).encode(str).length; objects.push({ offset, data: str }); offset += len; }
    function addBin(label, bytes){ const head = `%${label}\n`; const len = (new TextEncoder()).encode(head).length + bytes.length; objects.push({ offset, data: head, bin: bytes }); offset += len; }

    const xref = [];
    function obj(n, body){ const o = `\n${n} 0 obj\n${body}\nendobj\n`; xref.push({n, off: offset}); addObj(o); }

    addObj("%PDF-1.4\n");

    // 1: Bildobjekt (JPEG)
    const imgObjNum = 1;
    obj(imgObjNum, `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>`);
    addBin("stream", imgBytes);
    addObj("endstream\nendobj\n");

    // 2: Ressourcen
    const resObjNum = 2;
    obj(resObjNum, `<< /XObject << /Im1 ${imgObjNum} 0 R >> >>`);

    // 3: Seiteninhalt (Bild zeichnen)
    const contObjNum = 3;
    const content = `q ${imgW} 0 0 ${imgH} 0 0 cm /Im1 Do Q`;
    obj(contObjNum, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    // 4: Seite
    const pageObjNum = 4;
    obj(pageObjNum, `<< /Type /Page /Parent 5 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${resObjNum} 0 R /Contents ${contObjNum} 0 R >>`);

    // 5: Seitenbaum
    const pagesObjNum = 5;
    obj(pagesObjNum, `<< /Type /Pages /Count 1 /Kids [${pageObjNum} 0 R] >>`);

    // 6: Katalog
    const catObjNum = 6;
    obj(catObjNum, `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    // xref
    const xrefStart = offset;
    addObj(`\nxref\n0 ${xref.length+1}\n0000000000 65535 f \n`);
    for (const {off} of xref) addObj(String(off).padStart(10,"0") + " 00000 n \n");
    addObj(`trail er\n<< /Size ${xref.length+1} /Root ${catObjNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    // Antwort
    const parts = [];
    for (const obj of objects) {
      parts.push(new TextEncoder().encode(obj.data));
      if (obj.bin) parts.push(obj.bin);
    }
    const pdfBytes = new Blob(parts, { type: "application/pdf" });
    return new Response(pdfBytes, { headers: { "Content-Type": "application/pdf" } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
