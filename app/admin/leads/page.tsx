import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import LeadBoard, { type Lead } from "../../components/LeadBoard";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope } from "@/lib/access";

export default async function AdminLeads() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");
  const slugs = scope.slugs;

  // Managers see leads for their properties plus unassigned ones; super sees all.
  const where = slugs ? { OR: [{ propertySlug: { in: slugs } }, { propertySlug: null }] } : {};
  const [rows, props, pendingCount] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } }),
    getProperties(true),
    prisma.booking.count({ where: { status: "REQUESTED", ...(slugs ? { propertySlug: { in: slugs } } : {}) } }),
  ]);

  const leads: Lead[] = rows.map((l) => {
    let noteLog: { at: string; text: string }[] = [];
    try { noteLog = JSON.parse(l.noteLog || "[]"); } catch { noteLog = []; }
    // Fold any legacy single note in as the first log entry.
    if (l.notes && l.notes.trim() && noteLog.length === 0) noteLog = [{ at: l.createdAt.toISOString(), text: l.notes.trim() }];
    return {
      id: l.id, name: l.name, email: l.email, phone: l.phone, propertySlug: l.propertySlug,
      source: l.source, status: l.status, message: l.message, guests: l.guests,
      checkIn: l.checkIn?.toISOString() || null, checkOut: l.checkOut?.toISOString() || null,
      followUpAt: l.followUpAt?.toISOString() || null, noteLog,
      userId: l.userId, createdAt: l.createdAt.toISOString(),
    };
  });
  const propList = props.filter((p) => (slugs ? slugs.includes(p.slug) : true)).map((p) => ({ slug: p.slug, name: p.name }));

  const open = leads.filter((l) => l.status !== "WON" && l.status !== "LOST").length;

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.isSuper ? "ADMIN" : "MANAGER"} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Leads &amp; inquiries</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Every prospect from first contact to won or lost. {open} open. Work them, add notes, and move them along — they link to a guest account automatically once they sign up with the same email.</p>
              </div>
              <LeadBoard leads={leads} properties={propList} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
