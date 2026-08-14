"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = { id: string; propertySlug: string; title: string; category: string; status: string; dueAt: string | null; assignedToId: string | null; notes: string | null; vendor?: string | null; vendorPhone?: string | null; costCents?: number; confirmed?: boolean; paid?: boolean; paidVia?: string | null };
const PAY_METHODS = ["cash", "bank", "card", "other"] as const;
type Prop = { slug: string; name: string };
type Staff = { id: string; name: string; phone?: string | null };

const CATS = ["CLEANING", "MAINTENANCE", "INSPECTION", "RESTOCK", "CHEF", "SPA", "TRANSFER", "EXPERIENCE", "OTHER"];
const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();
const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;
const COLUMNS: { key: string; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
];

export default function TasksBoard({ tasks, properties, staff, isWorker = false }: { tasks: Task[]; properties: Prop[]; staff: Staff[]; isWorker?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(properties[0]?.slug || "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CLEANING");
  const [dueAt, setDueAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propName = (s: string) => properties.find((p) => p.slug === s)?.name || s;
  const staffName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name || "Someone" : "Unassigned");

  // Send a job to WhatsApp: pre-fills the message to the assignee's number (they
  // just press send). No number on file → opens WhatsApp to pick a contact.
  function whatsapp(t: Task) {
    const assignee = staff.find((s) => s.id === t.assignedToId);
    const lines = [
      `Jet Crust — job at ${propName(t.propertySlug)}`,
      `• ${t.title}`,
      `• Type: ${catLabel(t.category)}`,
      t.dueAt ? `• Date: ${t.dueAt}` : null,
      t.notes ? `• Notes: ${t.notes}` : null,
      `Please confirm you can do this.`,
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    const digits = (t.vendorPhone || assignee?.phone || "").replace(/\D/g, "");
    window.open(digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  async function create() {
    if (!title.trim() || !slug) { setError("Add a property and a title."); return; }
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertySlug: slug, title, category, dueAt: dueAt || null, assignedToId: assignedToId || null, vendor: vendor || null, vendorPhone: vendorPhone || null, costCents: Math.round((parseFloat(cost) || 0) * 100) }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Could not create."); return; }
    setTitle(""); setDueAt(""); setVendor(""); setVendorPhone(""); setCost(""); setOpen(false);
    router.refresh();
  }

  async function patch(id: string, body: object) {
    await fetch("/api/admin/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/admin/tasks?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div style={{ marginBottom: "1.2rem", display: isWorker ? "none" : "block" }}>
        {open ? (
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel__head"><h3>New task</h3></div>
            <div className="cal-form" style={{ gridTemplateColumns: "1fr 1fr", display: "grid" }}>
              <label style={{ gridColumn: "1 / -1" }}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Turnover clean after checkout" /></label>
              <label>Property<select value={slug} onChange={(e) => setSlug(e.target.value)}>{properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
              <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select></label>
              <label>Due<input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
              <label>Assign to (staff)<select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Vendor (chef, spa, driver…)<input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="external provider name" /></label>
              <label>Vendor WhatsApp<input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="+40 770 000 000" /></label>
              <label>Cost to us (€)<input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="what we pay them" /></label>
            </div>
            <p className="panel__hint" style={{ margin: "0.2rem 0 0" }}>For a paid service (chef, massage, transfer): add the vendor + their WhatsApp + the cost. The cost books to expenses when the job is marked done.</p>
            {error && <p style={{ color: "#a3412e", fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem" }}>
              <button className="btn btn--dark" disabled={busy} onClick={create}>{busy ? "Adding…" : "Add task"}</button>
              <button className="btn btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn--dark" onClick={() => setOpen(true)}>+ New task</button>
        )}
      </div>

      <div className="tasks-board">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="tasks-col">
              <div className="tasks-col__head">{col.label}<span className="console__count">{items.length}</span></div>
              {items.length === 0 ? <p className="tasks-empty">None</p> : items.map((t) => {
                const overdue = t.dueAt && t.status !== "DONE" && t.dueAt < new Date().toISOString().slice(0, 10);
                return (
                  <div key={t.id} className="task-card">
                    <div className="task-card__top">
                      <span className={`task-cat task-cat--${t.category.toLowerCase()}`}>{catLabel(t.category)}</span>
                      {!isWorker && <button className="task-x" onClick={() => remove(t.id)} title="Delete">×</button>}
                    </div>
                    <p className="task-title">{t.title}</p>
                    <p className="task-meta">{propName(t.propertySlug)}{t.dueAt ? ` · due ${t.dueAt}${overdue ? " ⚠" : ""}` : ""}</p>
                    {(t.vendor || (t.costCents || 0) > 0) && (
                      <p className="task-meta" style={{ marginTop: 2 }}>
                        {t.vendor || "Vendor"}{(t.costCents || 0) > 0 ? ` · ${money(t.costCents!)}` : ""}
                        {" · "}
                        <span style={{ color: t.confirmed ? "#25936b" : "#a3412e", fontWeight: 600 }}>{t.confirmed ? "confirmed" : "pending"}</span>
                        {t.status === "DONE" && (t.costCents || 0) > 0 ? <span style={{ color: "var(--stone)" }}> · booked to expenses</span> : null}
                      </p>
                    )}
                    {!isWorker && t.status === "DONE" && (t.vendor || (t.costCents || 0) > 0) && (
                      <div className="task-meta" style={{ marginTop: 6 }}>
                        {t.paid ? (
                          <span style={{ color: "#25936b", fontWeight: 600 }}>
                            Paid · {t.paidVia || "—"}
                            <button className="chip" style={{ marginLeft: 6 }} onClick={() => patch(t.id, { paid: false })}>undo</button>
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ color: "var(--stone)" }}>Mark paid:</span>
                            {PAY_METHODS.map((m) => (
                              <button key={m} className="chip" onClick={() => patch(t.id, { paid: true, paidVia: m })}>{m}</button>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="task-row" style={{ display: isWorker ? "none" : undefined }}>
                      <select className="task-assign" value={t.assignedToId || ""} onChange={(e) => patch(t.id, { assignedToId: e.target.value })}>
                        <option value="">Unassigned</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="task-actions">
                      {!isWorker && <button className="chip" title="Send this job to WhatsApp" onClick={() => whatsapp(t)} style={{ color: "#25936b" }}>WhatsApp</button>}
                      {!isWorker && (t.vendor || (t.costCents || 0) > 0) && <button className="chip" onClick={() => patch(t.id, { confirmed: !t.confirmed })}>{t.confirmed ? "Set pending" : "Confirm ✓"}</button>}
                      {t.status !== "OPEN" && <button className="chip" onClick={() => patch(t.id, { status: t.status === "DONE" ? "IN_PROGRESS" : "OPEN" })}>‹ Back</button>}
                      {t.status !== "DONE" && <button className="chip" onClick={() => patch(t.id, { status: t.status === "OPEN" ? "IN_PROGRESS" : "DONE" })}>{t.status === "OPEN" ? "Start ›" : "Done ✓"}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
