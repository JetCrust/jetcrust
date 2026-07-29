"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadPhoto } from "./photoUpload";
import {
  seedGuidebook, parseVideo, iconFor, SECTION_META,
  type Guidebook, type GuideSection, type GuideSectionKind, type GuideVideo,
  type GuideRoom, type GuidePlace, type GuideStep,
} from "@/lib/guidebook";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const KIND_LABEL: Record<GuideSectionKind, string> = {
  getting_in: "Getting In", wifi: "Wi-Fi", rules: "House Rules", home: "The Home",
  entertainment: "Entertainment", local: "Local", help: "Need Help", extras: "Extras", custom: "Custom",
};

/* ---------- small reusable pieces ---------- */

function PhotoList({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function add(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(list)) { const u = await uploadPhoto(f); if (u) added.push(u); }
    setBusy(false);
    if (added.length) onChange([...photos, ...added]);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
              <button type="button" title="Remove" onClick={() => onChange(photos.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#a3412e", color: "#fff", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <button type="button" className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }} disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "＋ Photo"}</button>
    </div>
  );
}

function VideoInput({ video, onChange }: { video?: GuideVideo | null; onChange: (v: GuideVideo | null) => void }) {
  const [text, setText] = useState(video ? (video.provider === "youtube" ? `https://youtu.be/${video.id}` : `https://vimeo.com/${video.id}`) : "");
  const parsed = parseVideo(text);
  return (
    <div>
      <label>Video (paste a Vimeo or YouTube link)</label>
      <input value={text} placeholder="https://vimeo.com/123456789" onChange={(e) => { setText(e.target.value); onChange(parseVideo(e.target.value)); }} />
      {text && (parsed
        ? <p className="panel__hint" style={{ margin: "0.3rem 0 0", color: "var(--forest)" }}>✓ {parsed.provider === "youtube" ? "YouTube" : "Vimeo"} video linked.</p>
        : <p className="panel__hint" style={{ margin: "0.3rem 0 0", color: "#a3412e" }}>Not a recognised Vimeo/YouTube link.</p>)}
    </div>
  );
}

/* ---------- kind-specific bodies ---------- */

function WifiFields({ s, patch }: { s: GuideSection; patch: (p: Partial<GuideSection>) => void }) {
  const w = s.wifi || { network: "", password: "", note: "" };
  const setW = (p: Partial<NonNullable<GuideSection["wifi"]>>) => patch({ wifi: { ...w, ...p } });
  return (
    <div className="ef">
      <div><label>Network name</label><input value={w.network} onChange={(e) => setW({ network: e.target.value })} placeholder="Castelaria-Guest" /></div>
      <div><label>Password</label><input value={w.password} onChange={(e) => setW({ password: e.target.value })} placeholder="…" /></div>
      <div className="full"><label>Note (optional)</label><input value={w.note || ""} onChange={(e) => setW({ note: e.target.value })} placeholder="Router is in the study. If it drops, switch it off for 20 seconds." /></div>
    </div>
  );
}

function StepFields({ s, patch }: { s: GuideSection; patch: (p: Partial<GuideSection>) => void }) {
  const steps = s.steps || [];
  const set = (i: number, p: Partial<GuideStep>) => patch({ steps: steps.map((st, j) => (j === i ? { ...st, ...p } : st)) });
  return (
    <div>
      {steps.map((st, i) => (
        <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", marginBottom: "0.6rem" }}>
          <span style={{ fontWeight: 600, color: "var(--brass, #9a7b3f)", paddingTop: "0.5rem" }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <textarea value={st.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="Turn off the main road at the stone gate…" style={{ minHeight: 48 }} />
            <div style={{ marginTop: "0.4rem" }}>
              <PhotoList photos={st.photo ? [st.photo] : []} onChange={(ph) => set(i, { photo: ph[ph.length - 1] || undefined })} />
            </div>
          </div>
          <button type="button" title="Remove step" onClick={() => patch({ steps: steps.filter((_, j) => j !== i) })} style={{ border: "none", background: "none", color: "#a3412e", cursor: "pointer", fontSize: "1.1rem", paddingTop: "0.35rem" }}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }} onClick={() => patch({ steps: [...steps, { text: "" }] })}>＋ Step</button>
    </div>
  );
}

function RoomFields({ s, patch }: { s: GuideSection; patch: (p: Partial<GuideSection>) => void }) {
  const rooms = s.rooms || [];
  const set = (i: number, p: Partial<GuideRoom>) => patch({ rooms: rooms.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <div>
      {rooms.map((r, i) => (
        <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "0.9rem", marginBottom: "0.8rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.5rem" }}>
            <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Master bedroom / Kitchen / Pool & spa" style={{ flex: 1, fontWeight: 600 }} />
            <button type="button" title="Remove room" onClick={() => patch({ rooms: rooms.filter((_, j) => j !== i) })} style={{ border: "none", background: "none", color: "#a3412e", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
          </div>
          <textarea value={r.body || ""} onChange={(e) => set(i, { body: e.target.value })} placeholder="How things work in this room: thermostat, blinds, coffee machine, where the remote lives…" style={{ minHeight: 64, marginBottom: "0.5rem" }} />
          <div style={{ marginBottom: "0.5rem" }}><PhotoList photos={r.photos || []} onChange={(ph) => set(i, { photos: ph })} /></div>
          <VideoInput video={r.video} onChange={(v) => set(i, { video: v })} />
        </div>
      ))}
      <button type="button" className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }} onClick={() => patch({ rooms: [...rooms, { id: uid(), name: "" }] })}>＋ Room / zone</button>
    </div>
  );
}

function PlaceFields({ s, patch }: { s: GuideSection; patch: (p: Partial<GuideSection>) => void }) {
  const places = s.places || [];
  const set = (i: number, p: Partial<GuidePlace>) => patch({ places: places.map((pl, j) => (j === i ? { ...pl, ...p } : pl)) });
  return (
    <div>
      {places.map((pl, i) => (
        <div key={i} className="ef" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "0.7rem", marginBottom: "0.7rem" }}>
          <div><label>Name</label><input value={pl.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Casa Wagner" /></div>
          <div><label>Category</label><input value={pl.category || ""} onChange={(e) => set(i, { category: e.target.value })} placeholder="Restaurant / Groceries / Experience" /></div>
          <div className="full"><label>Note</label><input value={pl.note || ""} onChange={(e) => set(i, { note: e.target.value })} placeholder="Best Saxon dinner in Bran — book ahead." /></div>
          <div className="full"><label>Map link (optional)</label><input value={pl.mapUrl || ""} onChange={(e) => set(i, { mapUrl: e.target.value })} placeholder="https://maps.google.com/…" /></div>
          <div className="full"><button type="button" className="textlink" style={{ background: "none", border: 0, cursor: "pointer", color: "#a3412e" }} onClick={() => patch({ places: places.filter((_, j) => j !== i) })}>Remove</button></div>
        </div>
      ))}
      <button type="button" className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }} onClick={() => patch({ places: [...places, { name: "" }] })}>＋ Place</button>
    </div>
  );
}

/* ---------- one section card ---------- */

function SectionCard({ s, index, count, patch, move, remove }: {
  s: GuideSection; index: number; count: number;
  patch: (p: Partial<GuideSection>) => void; move: (dir: -1 | 1) => void; remove: () => void;
}) {
  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.8rem" }}>
        <span style={{ fontSize: "1.3rem" }}>{s.icon || iconFor(s.kind)}</span>
        <input value={s.title} onChange={(e) => patch({ title: e.target.value })} style={{ flex: 1, fontFamily: "var(--serif)", fontSize: "1.1rem" }} />
        <span className="tag" style={{ fontSize: "0.7rem" }}>{KIND_LABEL[s.kind]}</span>
        <button type="button" title="Move up" disabled={index === 0} onClick={() => move(-1)} className="btn btn--ghost" style={{ padding: "0.25rem 0.55rem" }}>↑</button>
        <button type="button" title="Move down" disabled={index === count - 1} onClick={() => move(1)} className="btn btn--ghost" style={{ padding: "0.25rem 0.55rem" }}>↓</button>
        <button type="button" title="Remove section" onClick={remove} style={{ border: "none", background: "none", color: "#a3412e", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
      </div>

      {/* Intro / body text for most kinds */}
      {s.kind !== "wifi" && (
        <div className="ef"><div className="full">
          <label>{s.kind === "getting_in" ? "Overview (before the steps)" : s.kind === "home" ? "Overview" : "Text"}</label>
          <textarea value={s.body || ""} onChange={(e) => patch({ body: e.target.value })} style={{ minHeight: 64 }}
            placeholder={s.kind === "rules" ? "Quiet hours 22:00–08:00 · No parties · No smoking indoors · Max guests as booked" : "Short, friendly text…"} />
        </div></div>
      )}

      {s.kind === "wifi" && <WifiFields s={s} patch={patch} />}
      {s.kind === "getting_in" && (
        <>
          <div style={{ marginTop: "0.8rem" }}><p className="panel__hint" style={{ marginBottom: "0.4rem" }}>Step-by-step</p><StepFields s={s} patch={patch} /></div>
          <div className="ef" style={{ marginTop: "0.8rem" }}><div>
            <label>Reveal codes/steps how many days before arrival?</label>
            <input type="number" min={0} value={s.revealDaysBefore ?? 3} onChange={(e) => patch({ revealDaysBefore: e.target.value === "" ? null : Number(e.target.value) })} />
            <p className="panel__hint" style={{ margin: "0.25rem 0 0" }}>Guests see this section only within this window. Leave the field empty to always show it.</p>
          </div></div>
        </>
      )}
      {s.kind === "home" && <div style={{ marginTop: "0.8rem" }}><p className="panel__hint" style={{ marginBottom: "0.4rem" }}>Rooms &amp; zones</p><RoomFields s={s} patch={patch} /></div>}
      {s.kind === "local" && <div style={{ marginTop: "0.8rem" }}><p className="panel__hint" style={{ marginBottom: "0.4rem" }}>Curated places (keep it short — 3–6 is ideal)</p><PlaceFields s={s} patch={patch} /></div>}

      {/* Photos + video for content-y kinds (not wifi/home, which handle their own media) */}
      {s.kind !== "wifi" && s.kind !== "home" && (
        <div style={{ marginTop: "0.9rem" }}>
          <p className="panel__hint" style={{ marginBottom: "0.4rem" }}>Photos</p>
          <PhotoList photos={s.photos || []} onChange={(ph) => patch({ photos: ph })} />
          <div className="ef" style={{ marginTop: "0.7rem" }}><div className="full"><VideoInput video={s.video} onChange={(v) => patch({ video: v })} /></div></div>
        </div>
      )}
    </div>
  );
}

/* ---------- editor root ---------- */

export default function GuidebookEditor({ slug, property }: { slug: string; property: Record<string, unknown> }) {
  const router = useRouter();
  const init = (property.guidebook as Guidebook | undefined) || { enabled: false, intro: "", sections: [] };
  const [gb, setGb] = useState<Guidebook>({ enabled: !!init.enabled, intro: init.intro || "", sections: init.sections || [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<GuideSectionKind>("custom");

  const setSection = (i: number, p: Partial<GuideSection>) => setGb((g) => ({ ...g, sections: g.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) }));
  const moveSection = (i: number, dir: -1 | 1) => setGb((g) => {
    const j = i + dir; if (j < 0 || j >= g.sections.length) return g;
    const next = [...g.sections]; [next[i], next[j]] = [next[j], next[i]]; return { ...g, sections: next };
  });
  const removeSection = (i: number) => setGb((g) => ({ ...g, sections: g.sections.filter((_, j) => j !== i) }));
  const addSection = () => {
    const meta = SECTION_META.find((m) => m.kind === addKind);
    setGb((g) => ({ ...g, sections: [...g.sections, {
      id: uid(), kind: addKind, title: meta?.title || "New section", icon: meta?.icon || "•",
      ...(addKind === "wifi" ? { wifi: { network: "", password: "", note: "" } } : {}),
      ...(addKind === "getting_in" ? { steps: [], revealDaysBefore: 3 } : {}),
      ...(addKind === "home" ? { rooms: [] } : {}),
      ...(addKind === "local" ? { places: [] } : {}),
    }] }));
  };

  async function save() {
    setBusy(true); setMsg(null);
    const data = { ...property, guidebook: gb };
    const res = await fetch(`/api/admin/properties/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setMsg("Saved."); router.refresh(); } else setMsg(d.error || "Could not save.");
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="panel">
        <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
          <input type="checkbox" checked={gb.enabled} onChange={(e) => setGb((g) => ({ ...g, enabled: e.target.checked }))} />
          <span><strong>Guidebook is live</strong> — when on, guests see the structured guidebook instead of the plain fallback text.</span>
        </label>
        <div className="ef" style={{ marginTop: "0.9rem" }}><div className="full">
          <label>Welcome note (optional, shown at the top)</label>
          <textarea value={gb.intro || ""} onChange={(e) => setGb((g) => ({ ...g, intro: e.target.value }))} placeholder="Welcome to Castelaria. Everything you need for a seamless stay is here — tap any card." style={{ minHeight: 56 }} />
        </div></div>
        {gb.sections.length === 0 && (
          <button type="button" className="btn btn--dark" style={{ marginTop: "0.9rem" }} onClick={() => setGb(seedGuidebook())}>Start from template (8 standard sections)</button>
        )}
      </div>

      {gb.sections.map((s, i) => (
        <SectionCard key={s.id} s={s} index={i} count={gb.sections.length}
          patch={(p) => setSection(i, p)} move={(dir) => moveSection(i, dir)} remove={() => removeSection(i)} />
      ))}

      <div className="panel">
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Add a section</label>
            <select value={addKind} onChange={(e) => setAddKind(e.target.value as GuideSectionKind)}>
              {SECTION_META.map((m) => <option key={m.kind} value={m.kind}>{m.icon} {m.title}</option>)}
              <option value="custom">• Custom</option>
            </select>
          </div>
          <button type="button" className="btn btn--ghost" onClick={addSection}>＋ Add</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--cream, #faf7f1)", padding: "1rem 0", borderTop: "1px solid var(--line)" }}>
        <button className="btn btn--brass" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save guidebook"}</button>
        <a className="btn btn--ghost" href="/admin/properties">Back to properties</a>
        {msg && <span style={{ color: msg === "Saved." ? "var(--forest)" : "#a3412e" }}>{msg}</span>}
      </div>
    </div>
  );
}
