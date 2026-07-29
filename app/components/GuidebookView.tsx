"use client";
import { useState } from "react";
import { videoEmbedUrl, iconFor, searchGuide, type GuideSection, type GuideDevice } from "@/lib/guidebook";

/* Mobile-first guest guidebook: a home screen of big tappable cards, each one
   tap from its detail. Built on the existing design tokens (no new CSS file). */

function Copyable({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", padding: "0.8rem 1rem", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, marginBottom: "0.6rem" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--stone, #8a8375)" }}>{label}</div>
        <div style={{ fontSize: "1.15rem", fontWeight: 600, wordBreak: "break-all" }}>{value}</div>
      </div>
      <button className="btn btn--ghost" style={{ flex: "0 0 auto", padding: "0.45rem 0.9rem" }}
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}>
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Photos({ photos, onOpen }: { photos?: string[]; onOpen: (src: string) => void }) {
  if (!photos?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem", margin: "0.6rem 0" }}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" loading="lazy" onClick={() => onOpen(src)}
          style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)", cursor: "zoom-in" }} />
      ))}
    </div>
  );
}

function Video({ video }: { video?: GuideSection["video"] }) {
  if (!video) return null;
  return (
    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", margin: "0.6rem 0", border: "1px solid var(--line)" }}>
      <iframe src={videoEmbedUrl(video)} title="How-to video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
    </div>
  );
}

function Body({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return <p style={{ whiteSpace: "pre-wrap", color: "var(--ink-soft)", margin: "0 0 0.6rem", lineHeight: 1.6 }}>{text}</p>;
}

function Devices({ devices }: { devices?: GuideDevice[] }) {
  if (!devices?.length) return null;
  return (
    <div style={{ marginTop: "0.6rem" }}>
      {devices.map((d) => (
        <details key={d.id} style={{ background: "var(--cream-2, #f6f2ea)", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.5rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {d.name}{(d.brand || d.model) ? <span style={{ fontWeight: 400, color: "var(--stone, #8a8375)" }}> — {[d.brand, d.model].filter(Boolean).join(" ")}</span> : null}
          </summary>
          <div style={{ marginTop: "0.5rem" }}>
            <Body text={d.notes} />
            {d.video && <Video video={d.video} />}
            {(d.troubleshooting || []).length > 0 && (
              <div style={{ marginTop: "0.3rem" }}>
                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--stone, #8a8375)", marginBottom: "0.3rem" }}>Troubleshooting</div>
                {(d.troubleshooting || []).map((t, i) => (
                  <p key={i} style={{ margin: "0 0 0.35rem", lineHeight: 1.5 }}><strong>{t.problem}</strong> — {t.fix}</p>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

function SectionDetail({ s, hours, onOpenPhoto }: { s: GuideSection; hours?: { check_in: string; check_out: string }; onOpenPhoto: (src: string) => void }) {
  if (s.kind === "wifi") {
    const w = s.wifi;
    return (
      <>
        <Copyable label="Network" value={w?.network || ""} />
        <Copyable label="Password" value={w?.password || ""} />
        {w?.note && <Body text={w.note} />}
        {!w?.network && !w?.password && <Body text="Wi-Fi details will appear here." />}
      </>
    );
  }
  if (s.kind === "getting_in") {
    return (
      <>
        <Body text={s.body} />
        {hours && <p className="tag" style={{ display: "inline-block", marginBottom: "0.8rem" }}>Check-in from {hours.check_in} · check-out by {hours.check_out}</p>}
        {(s.steps || []).map((st, i) => (
          <div key={i} style={{ display: "flex", gap: "0.8rem", marginBottom: "0.9rem" }}>
            <span style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: "50%", background: "var(--forest, #253026)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: "0.9rem" }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <Body text={st.text} />
              {st.photo && <Photos photos={[st.photo]} onOpen={onOpenPhoto} />}
            </div>
          </div>
        ))}
        <Photos photos={s.photos} onOpen={onOpenPhoto} />
        <Video video={s.video} />
      </>
    );
  }
  if (s.kind === "home") {
    return (
      <>
        <Body text={s.body} />
        {(s.rooms || []).map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "1rem", marginBottom: "0.8rem" }}>
            <h4 style={{ margin: "0 0 0.4rem", fontFamily: "var(--serif)", fontSize: "1.15rem" }}>{r.name}</h4>
            <Body text={r.body} />
            <Photos photos={r.photos} onOpen={onOpenPhoto} />
            <Video video={r.video} />
            <Devices devices={r.devices} />
          </div>
        ))}
      </>
    );
  }
  if (s.kind === "local") {
    return (
      <>
        <Body text={s.body} />
        {(s.places || []).map((pl, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "0.9rem 1rem", marginBottom: "0.7rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "baseline" }}>
              <h4 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: "1.1rem" }}>{pl.name}</h4>
              {pl.category && <span className="tag" style={{ fontSize: "0.7rem" }}>{pl.category}</span>}
            </div>
            {pl.note && <Body text={pl.note} />}
            {pl.mapUrl && <a className="textlink" href={pl.mapUrl} target="_blank" rel="noopener noreferrer">Open in maps →</a>}
          </div>
        ))}
      </>
    );
  }
  // rules / entertainment / help / extras / custom
  return (
    <>
      <Body text={s.body} />
      <Photos photos={s.photos} onOpen={onOpenPhoto} />
      <Video video={s.video} />
    </>
  );
}

export default function GuidebookView({ sections, intro, propertyName, hours }: {
  sections: GuideSection[]; intro?: string; propertyName: string; hours?: { check_in: string; check_out: string };
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const active = open != null ? sections[open] : null;
  const hits = query.trim() ? searchGuide(sections, query) : [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {active ? (
        <div>
          <button className="btn btn--ghost" style={{ marginBottom: "1rem" }} onClick={() => setOpen(null)}>← All sections</button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.8rem" }}>{active.icon || iconFor(active.kind)}</span>
            <h2 style={{ margin: 0 }}>{active.title}</h2>
          </div>
          <SectionDetail s={active} hours={hours} onOpenPhoto={setLightbox} />
        </div>
      ) : (
        <div>
          <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
            <p className="overline eyebrow-line">Guidebook</p>
            <h2 style={{ marginBottom: intro ? "0.4rem" : 0 }}>{propertyName}</h2>
            {intro && <p className="lead" style={{ marginBottom: 0 }}>{intro}</p>}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — e.g. Wi-Fi, TV won’t turn on, parking…"
            style={{ width: "100%", padding: "0.8rem 1rem", borderRadius: 12, border: "1px solid var(--line)", fontSize: "1rem", marginBottom: "1rem" }}
          />

          {query.trim() ? (
            <div>
              {hits.length === 0 ? (
                <p style={{ color: "var(--stone)" }}>Nothing matched “{query}”. Try a simpler word, or browse the sections below.</p>
              ) : (
                hits.map((h, i) => (
                  <button key={i} onClick={() => { setOpen(h.sectionIndex); setQuery(""); }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "0.8rem 1rem", marginBottom: "0.6rem", cursor: "pointer" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>{h.title}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{h.snippet}</div>
                  </button>
                ))
              )}
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.8rem" }}>
            {sections.map((s, i) => (
              <button key={s.id} onClick={() => setOpen(i)}
                style={{ textAlign: "left", background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "1.1rem", cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.5rem", minHeight: 118 }}>
                <span style={{ fontSize: "1.7rem" }}>{s.icon || iconFor(s.kind)}</span>
                <span style={{ fontFamily: "var(--serif)", fontSize: "1.05rem", lineHeight: 1.2 }}>{s.title}</span>
              </button>
            ))}
          </div>
          )}
          {!query.trim() && sections.length === 0 && <p style={{ color: "var(--stone)" }}>The guidebook for this stay will appear here shortly.</p>}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,14,0.9)", display: "grid", placeItems: "center", zIndex: 1000, padding: "1.5rem", cursor: "zoom-out" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}
