import { NextResponse } from "next/server";

// One-click self-exclusion from our first-party analytics. The team opens this
// once per browser/device: /optout stops counting their visits, /optout?on=1
// starts counting again. Sets a long-lived cookie the track + quote routes check.
export async function GET(req: Request) {
  const on = new URL(req.url).searchParams.get("on") === "1"; // on=1 => count me again
  const excluded = !on;
  const page = `<!doctype html><html><head><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Analytics ${excluded ? "opt-out" : "opt-in"} — Jet Crust</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0e110e;color:#f6f1e7;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:2rem;text-align:center}.card{max-width:440px}h1{font-weight:500;font-size:1.5rem}p{color:#c9c4b6;line-height:1.6}a{color:#c8a76a}</style></head>
<body><div class="card"><h1>${excluded ? "You're now excluded from analytics" : "Your visits are counted again"}</h1>
<p>${excluded ? "Your visits on this browser will no longer be counted in Jet Crust's Demand &amp; interest analytics. Do this on each device or browser you use." : "Your visits on this browser are being counted in the analytics again."}</p>
<p>${excluded ? `<a href="/optout?on=1">Undo — start counting my visits again</a>` : `<a href="/optout">Exclude my visits again</a>`}</p>
<p><a href="/">Back to Jet Crust</a></p></div></body></html>`;
  const res = new NextResponse(page, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (excluded) {
    res.cookies.set("jc_noanalytics", "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
  } else {
    res.cookies.set("jc_noanalytics", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  }
  return res;
}
