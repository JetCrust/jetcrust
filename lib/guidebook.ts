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
