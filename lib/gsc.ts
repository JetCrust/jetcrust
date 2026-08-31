import crypto from "crypto";

// Google Search Console connector. Auth is a service-account JWT signed with the
// key stored in GOOGLE_SERVICE_ACCOUNT_KEY (the whole downloaded JSON, verbatim).
// Read-only search-analytics: impressions, clicks, position, top queries + pages.

const SITE = process.env.GSC_SITE || "sc-domain:jetcrust.com";

const b64url = (x: Buffer | string) => Buffer.from(x).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let key: { client_email?: string; private_key?: string };
  try { key = JSON.parse(raw); } catch { return null; }
  if (!key.client_email || !key.private_key) return null;
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key.private_key, "base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
  });
  const j = await res.json();
  if (!j.access_token) return null;
  tokenCache = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

type Raw = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
async function query(token: string, dims: string[], rowLimit: number, start: string, end: string): Promise<Raw[]> {
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: dims, rowLimit }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "Search Console error");
  return (j.rows || []) as Raw[];
}

export type GscRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };
// status tells the admin exactly why nothing shows:
//  no_key   — GOOGLE_SERVICE_ACCOUNT_KEY isn't set in this environment
//  bad_key  — it's set but isn't valid service-account JSON (paste/format problem)
//  auth     — the JSON is valid but Google rejected the sign-in
//  error    — signed in, but the searchAnalytics query failed (usually no access to the property)
//  ok       — live data
export type GscStatus = "no_key" | "bad_key" | "auth" | "error" | "ok";
export type GscReport = {
  configured: boolean;
  status: GscStatus;
  error?: string;
  keyEmail?: string;
  fetchedAt: string;
  start: string; end: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  queries: GscRow[];
  pages: GscRow[];
};

const d = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

// Search performance for the last `days` days (Search Console data lags ~2 days).
export async function searchPerformance(days = 28): Promise<GscReport> {
  const end = d(2);
  const start = d(days + 2);
  const base = { start, end, fetchedAt: new Date().toISOString(), totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, queries: [], pages: [] };

  // Inspect the key up front so we can report a precise reason, not a blank panel.
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let keyEmail: string | undefined;
  if (!raw) return { ...base, configured: false, status: "no_key" };
  try {
    const k = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!k.client_email || !k.private_key) return { ...base, configured: false, status: "bad_key" };
    keyEmail = k.client_email;
  } catch {
    return { ...base, configured: false, status: "bad_key" };
  }

  const token = await getToken();
  if (!token) return { ...base, configured: false, status: "auth", keyEmail };
  try {
    const [qRows, pRows, tRows] = await Promise.all([
      query(token, ["query"], 25, start, end),
      query(token, ["page"], 25, start, end),
      query(token, [], 1, start, end),
    ]);
    const map = (r: Raw): GscRow => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
    const t = tRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    return { ...base, configured: true, status: "ok", keyEmail, totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position }, queries: qRows.map(map), pages: pRows.map(map) };
  } catch (e) {
    return { ...base, configured: true, status: "error", keyEmail, error: (e as Error).message };
  }
}
