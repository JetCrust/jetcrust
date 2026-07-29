"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Prop = { slug: string; name: string };

export default function UserRow({ userId, email, name, phone, role, managedSlugs, properties, isSelf }: {
  userId: string; email: string; name: string | null; phone?: string | null; role: string; managedSlugs: string[]; properties: Prop[]; isSelf: boolean;
}) {
  const router = useRouter();
  const [r, setR] = useState(role);
  const [slugs, setSlugs] = useState<string[]>(managedSlugs);
  const [ph, setPh] = useState(phone || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = r !== role || JSON.stringify(slugs) !== JSON.stringify(managedSlugs) || ph !== (phone || "");

  const toggle = (s: string) => setSlugs((x) => x.includes(s) ? x.filter((v) => v !== s) : [...x, s]);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: r, managedSlugs: (r === "MANAGER" || r === "STAFF") ? slugs : [], phone: ph }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Could not save."); return; }
    setMsg("Saved.");
    router.refresh();
  }

  async function resetPw() {
    if (!confirm(`Reset the password for ${email}? A new temporary password will be shown.`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, resetPassword: true }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Could not reset."); return; }
    setMsg(`New password: ${d.tempPassword}`);
  }

  return (
    <div className="urow">
      <div className="urow__who">
        <span className="urow__name">{name || email.split("@")[0]}{isSelf && <span className="urow__you">you</span>}</span>
        <span className="urow__email">{email}</span>
      </div>
      <select className="cal-select" value={r} onChange={(e) => setR(e.target.value)} disabled={isSelf}>
        <option value="GUEST">Guest</option>
        <option value="STAFF">Staff (tasks only)</option>
        <option value="MANAGER">Property Manager</option>
        <option value="ADMIN">Super Admin</option>
      </select>
      {(r === "MANAGER" || r === "STAFF") && (
        <input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+40 phone (WhatsApp)" style={{ padding: "0.3rem 0.5rem", border: "1px solid var(--line)", borderRadius: 6, fontSize: "0.8rem", maxWidth: 170 }} />
      )}
      {(r === "MANAGER" || r === "STAFF") && (
        <div className="urow__props">
          {properties.map((p) => (
            <label key={p.slug} className={`chip${slugs.includes(p.slug) ? " is-on" : ""}`} style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={slugs.includes(p.slug)} onChange={() => toggle(p.slug)} style={{ marginRight: 5 }} />
              {p.name}
            </label>
          ))}
        </div>
      )}
      <div className="urow__save">
        {dirty && <button className="btn btn--dark cal-act" disabled={busy} onClick={save}>{busy ? "…" : "Save"}</button>}
        {role !== "GUEST" && <button className="chip" disabled={busy} onClick={resetPw}>Reset password</button>}
        {msg && <span style={{ fontSize: "0.78rem", color: msg.startsWith("New password") ? "var(--ink)" : "var(--stone)", fontFamily: msg.startsWith("New password") ? "monospace" : "inherit" }}>{msg}</span>}
      </div>
    </div>
  );
}
