
export async function onRequestGet(context) {
  const { params } = context;
  const code = (params.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  try {
    const url = new URL(`/assets/icons/${code}.svg`, context.request.url);
    const res = await fetch(url.href);
    if (!res.ok) return new Response("Not found", { status: 404 });
    const svg = await res.text();
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
