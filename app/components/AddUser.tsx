"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Prop = { slug: string; name: string };

export default function AddUser({ properties }: { properties: Prop[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [slugs, setSlugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temp: string } | null>(null);

  const toggle = (s: string) => setSlugs((x) => x.includes(s) ? x.filter((v) => v !== s) : [...x, s]);

  async function create() {
    if (!email.trim()) { setError("Enter an email."); return; }
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role, managedSlugs: role === "MANAGER" ? slugs : [] }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Could not create."); return; }
    setResult({ email: email.toLowerCase(), temp: d.tempPassword });
    setEmail(""); setName(""); setSlugs([]);
    router.refresh();
  }

  if (result) {
    return (
      <div className="panel" style={{ borderColor: "var(--forest)" }}>
        <div className="panel__head"><h3>Team member added</h3></div>
        <p style={{ margin: "0 0 0.6rem" }}><strong>{result.email}</strong> can now sign in. Share this one-time password with them (they can change it later):</p>
        <p style={{ margin: "0 0 1rem", fontFamily: "monospace", fontSize: "1.1rem", background: "var(--cream-2)", padding: "0.6rem 0.9rem", borderRadius: "var(--radius-sm)", display: "inline-block" }}>{result.temp}</p>
        <div><button className="btn btn--ghost" onClick={() => { setResult(null); setOpen(false); }}>Done</button></div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.4rem" }}>
      {open ? (
        <div className="panel">
          <div className="panel__head"><h3>Add a team member</h3></div>
          <div className="cal-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></label>
            <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option value="MANAGER">Property Manager</option><option value="ADMIN">Super Admin</option></select></label>
          </div>
          {role === "MANAGER" && (
            <div style={{ margin: "0.2rem 0 0.6rem" }}>
              <p className="panel__hint" style={{ marginTop: 0 }}>Properties they manage</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {properties.map((p) => (
                  <label key={p.slug} className={`chip${slugs.includes(p.slug) ? " is-on" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={slugs.includes(p.slug)} onChange={() => toggle(p.slug)} style={{ marginRight: 5 }} />{p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p style={{ color: "#a3412e", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem" }}>
            <button className="btn btn--dark" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create account"}</button>
            <button className="btn btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn--dark" onClick={() => setOpen(true)}>+ Add team member</button>
      )}
    </div>
  );
}
