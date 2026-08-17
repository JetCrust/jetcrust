// Structured, mobile-first digital guidebook — types + client-safe helpers.
// No node imports here, so both server pages and client editors can use it.

export type GuideVideo = { provider: "youtube" | "vimeo"; id: string };
export type GuidePlace = { name: string; category?: string; note?: string; mapUrl?: string; photo?: string };
// Phase 2 (reserved shape): per-room device library + troubleshooting.
export type GuideDevice = { id: string; name: string; brand?: string; model?: string; video?: GuideVideo | null; notes?: string; troubleshooting?: { problem: string; fix: string }[] };
export type GuideRoom = { id: string; name: string; body?: string; photos?: string[]; video?: GuideVideo | null; devices?: GuideDevice[] };
export type GuideStep = { text: string; photo?: string };
export type GuideSectionKind = "getting_in" | "wifi" | "rules" | "home" | "entertainment" | "local" | "help" | "extras" | "custom";
export type GuideSection = {
  id: string;
  kind: GuideSectionKind;
  title: string;
  icon?: string;
  body?: string;
  photos?: string[];
  video?: GuideVideo | null;
  wifi?: { network: string; password: string; note?: string };
  steps?: GuideStep[];
  rooms?: GuideRoom[];
  places?: GuidePlace[];
  revealDaysBefore?: number | null; // hide (sensitive) section until within N days of check-in
};
export type Guidebook = { enabled: boolean; intro?: string; sections: GuideSection[] };

// The eight standard sections, in the fixed "by need" order, with icons.
// Used by the editor's "Start from template" so a blank property fills in one click.
export const SECTION_META: { kind: GuideSectionKind; title: string; icon: string }[] = [
  { kind: "getting_in", title: "Getting In", icon: "🔑" },
  { kind: "wifi", title: "Wi-Fi & Internet", icon: "📶" },
  { kind: "rules", title: "House Rules & Times", icon: "📋" },
  { kind: "home", title: "The Home", icon: "🏛️" },
  { kind: "entertainment", title: "Entertainment", icon: "📺" },
  { kind: "local", title: "Local Recommendations", icon: "📍" },
  { kind: "help", title: "Need Help", icon: "☎️" },
  { kind: "extras", title: "Extras & Services", icon: "✨" },
];

export function iconFor(kind: GuideSectionKind): string {
  return SECTION_META.find((s) => s.kind === kind)?.icon || "•";
}

// A fresh guidebook seeded with the eight standard sections (kind used as a
// stable id since each kind appears once). Kind-specific containers are
// pre-created so the editor renders the right fields immediately.
export function seedGuidebook(): Guidebook {
  return {
    enabled: true,
    intro: "",
    sections: SECTION_META.map((m) => ({
      id: m.kind,
      kind: m.kind,
      title: m.title,
      icon: m.icon,
      body: "",
      ...(m.kind === "wifi" ? { wifi: { network: "", password: "", note: "" } } : {}),
      ...(m.kind === "getting_in" ? { steps: [], revealDaysBefore: 3 } : {}),
      ...(m.kind === "home" ? { rooms: [] } : {}),
      ...(m.kind === "local" ? { places: [] } : {}),
    })),
  };
}

// Parse a pasted Vimeo/YouTube link into an embeddable {provider,id}. Returns
// null when the URL isn't recognised (the editor shows a hint in that case).
export function parseVideo(url: string): GuideVideo | null {
  const u = (url || "").trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (m) return { provider: "youtube", id: m[1] };
  m = u.match(/vimeo\.com\/(?:video\/|channels\/[\w]+\/|groups\/[\w]+\/videos\/)?(\d{6,})/i);
  if (m) return { provider: "vimeo", id: m[1] };
  return null;
}

// Flatten a guidebook into plain text so the guest assistant can answer questions
// from it (Wi-Fi, how things work, house rules, local picks).
export function guidebookToText(gb: Guidebook | undefined, propertyName: string): string {
  if (!gb?.enabled || !Array.isArray(gb.sections) || gb.sections.length === 0) return "";
  const lines: string[] = [`Guidebook for ${propertyName} (use this to answer the guest's questions about the home):`];
  if (gb.intro) lines.push(gb.intro);
  for (const s of gb.sections) {
    lines.push(`\n## ${s.title}`);
    if (s.body) lines.push(s.body);
    if (s.wifi?.network) lines.push(`Wi-Fi network: ${s.wifi.network}${s.wifi.password ? `, password: ${s.wifi.password}` : ""}${s.wifi.note ? `. ${s.wifi.note}` : ""}`);
    if (s.steps?.length) s.steps.forEach((st, i) => { if (st.text) lines.push(`${i + 1}. ${st.text}`); });
    for (const r of s.rooms || []) {
      lines.push(`Room/area: ${r.name}${r.body ? ` — ${r.body}` : ""}`);
      for (const d of r.devices || []) {
        lines.push(`  ${d.name}${d.brand || d.model ? ` (${[d.brand, d.model].filter(Boolean).join(" ")})` : ""}${d.notes ? ` — ${d.notes}` : ""}`);
        for (const t of d.troubleshooting || []) lines.push(`    If ${t.problem}: ${t.fix}`);
      }
    }
    for (const pl of s.places || []) lines.push(`${pl.name}${pl.category ? ` (${pl.category})` : ""}${pl.note ? ` — ${pl.note}` : ""}`);
  }
  return lines.join("\n");
}

export function videoEmbedUrl(v: GuideVideo): string {
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.id}`
    : `https://player.vimeo.com/video/${v.id}`;
}

// Whole days from `now` until check-in (negative once the stay has started).
export function daysUntil(checkIn: Date, now: Date): number {
  const DAY = 86400000;
  const a = Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / DAY);
}

// Drop sections whose sensitive content should stay hidden until within
// `revealDaysBefore` days of arrival (e.g. door codes). `isStaff` sees all.
export function visibleSections(book: Guidebook, checkIn: Date | null, now: Date, isStaff: boolean): GuideSection[] {
  return (book.sections || []).filter((s) => {
    if (isStaff) return true;
    const gate = s.revealDaysBefore;
    if (gate == null) return true;
    if (!checkIn) return false; // gated but no arrival date known → hide
    return daysUntil(checkIn, now) <= gate;
  });
}

// ---- Smart (non-AI) help search over the guidebook + device library ----
export type GuideHit = { sectionIndex: number; title: string; snippet: string };

function snippet(text: string, terms: string[]): string {
  const hay = text.toLowerCase();
  let at = -1;
  for (const t of terms) { const i = hay.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const start = Math.max(0, at - 40);
  const s = text.slice(start, start + 140).trim();
  return (start > 0 ? "…" : "") + s + (start + 140 < text.length ? "…" : "");
}

// Rank sections/rooms/devices by how many query terms they contain. Returns the
// top matches, each pointing at the section to open. Pure + instant (no network).
export function searchGuide(sections: GuideSection[], query: string): GuideHit[] {
  const terms = query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);
  if (!terms.length) return [];
  const scored: (GuideHit & { score: number })[] = [];
  sections.forEach((s, idx) => {
    const entries: { title: string; text: string }[] = [];
    entries.push({
      title: s.title,
      text: [s.title, s.body, ...(s.steps || []).map((x) => x.text), s.wifi?.note,
        ...(s.places || []).map((p) => `${p.name} ${p.category || ""} ${p.note || ""}`)].filter(Boolean).join(" "),
    });
    (s.rooms || []).forEach((r) => {
      entries.push({ title: `${s.title} · ${r.name}`, text: [r.name, r.body].filter(Boolean).join(" ") });
      (r.devices || []).forEach((d) => {
        const ts = (d.troubleshooting || []).map((t) => `${t.problem} ${t.fix}`).join(" ");
        entries.push({ title: `${r.name} · ${d.name}`, text: [d.name, d.brand, d.model, d.notes, ts].filter(Boolean).join(" ") });
      });
    });
    for (const e of entries) {
      const hay = e.text.toLowerCase();
      const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      if (score > 0) scored.push({ sectionIndex: idx, title: e.title, snippet: snippet(e.text, terms), score });
    }
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map(({ sectionIndex, title, snippet }) => ({ sectionIndex, title, snippet }));
}

// Everyday words → the terms actually used in a guidebook, so a guest typing
// "wifi", "music" or "lights" still matches. Extend freely.
const SYN: Record<string, string[]> = {
  wifi: ["wifi", "wi-fi", "internet", "wireless", "network", "password"],
  music: ["music", "sound", "speaker", "speakers", "sonos", "audio", "stereo", "bluetooth", "play"],
  tv: ["tv", "television", "cinema", "theatre", "theater", "movie", "movies", "netflix", "projector", "alexa", "remote", "screen"],
  pool: ["pool", "swim", "swimming", "jacuzzi", "hot tub"],
  sauna: ["sauna", "saunas", "steam"],
  gym: ["gym", "fitness", "weights", "workout"],
  wine: ["wine", "cellar", "crama", "cigar", "cigars"],
  lights: ["light", "lights", "lamp", "lamps", "dimmer", "switch"],
  heat: ["heat", "heating", "thermostat", "temperature", "cold", "warm", "ac", "air conditioning"],
  checkin: ["check-in", "checkin", "arrival", "arrive", "keys", "key", "code", "codes", "door", "gate", "entry", "enter"],
  checkout: ["check-out", "checkout", "departure", "leave", "leaving"],
  rules: ["rules", "smoking", "smoke", "quiet", "noise", "party", "pets", "children"],
  local: ["restaurant", "restaurants", "eat", "food", "dinner", "nearby", "recommend", "attractions", "castle"],
  kitchen: ["kitchen", "cook", "cooking", "coffee", "dishwasher", "oven"],
  help: ["help", "broken", "not working", "problem", "emergency", "issue"],
};

function expandTerms(query: string): string[] {
  const raw = query.toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z0-9-]/g, "")).filter(Boolean);
  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    for (const group of Object.values(SYN)) if (group.includes(t)) group.forEach((g) => out.add(g));
  }
  return [...out];
}

// Build a complete, guest-ready answer for one entry (not a snippet).
function sectionAnswer(s: GuideSection): string {
  const parts: string[] = [];
  if (s.body) parts.push(s.body);
  if (s.wifi?.network) parts.push(`Wi-Fi network: ${s.wifi.network}${s.wifi.password ? `\nPassword: ${s.wifi.password}` : ""}${s.wifi.note ? `\n${s.wifi.note}` : ""}`);
  for (const st of s.steps || []) if (st.text) parts.push(`• ${st.text}`);
  for (const pl of s.places || []) parts.push(`• ${pl.name}${pl.note ? ` — ${pl.note}` : ""}`);
  return parts.join("\n");
}

// The keyword knowledge base for the guest chat: find the best-matching guidebook
// entry and return a full answer. Pure + instant — no AI, no network.
export function answerFromGuide(sections: GuideSection[], query: string): { title: string; text: string } | null {
  const T = expandTerms(query);
  if (!T.length) return null;
  const cands: { score: number; title: string; text: string }[] = [];
  const add = (score: number, title: string, text: string) => { if (score > 0 && text) cands.push({ score, title, text }); };
  for (const s of sections) {
    const secHay = [s.title, s.body, ...(s.steps || []).map((x) => x.text), s.wifi?.note, s.wifi?.network,
      ...(s.places || []).map((p) => `${p.name} ${p.category || ""} ${p.note || ""}`)].filter(Boolean).join(" ").toLowerCase();
    add(T.reduce((n, t) => n + (secHay.includes(t) ? 1 : 0), 0), s.title, sectionAnswer(s));
    for (const r of s.rooms || []) {
      const roomHay = [r.name, r.body].filter(Boolean).join(" ").toLowerCase();
      add(T.reduce((n, t) => n + (roomHay.includes(t) ? 1 : 0), 0), r.name, [r.name, r.body].filter(Boolean).join(": "));
      for (const d of r.devices || []) {
        const ts = (d.troubleshooting || []).map((t) => `${t.problem} ${t.fix}`).join(" ");
        const devHay = [d.name, d.brand, d.model, d.notes, ts].filter(Boolean).join(" ").toLowerCase();
        const devAns = [d.name + (d.notes ? `: ${d.notes}` : ""), ...(d.troubleshooting || []).map((t) => `If ${t.problem}: ${t.fix}`)].filter(Boolean).join("\n");
        add(T.reduce((n, t) => n + (devHay.includes(t) ? 1 : 0), 0), `${r.name} · ${d.name}`, devAns);
      }
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  return { title: cands[0].title, text: cands[0].text };
}
