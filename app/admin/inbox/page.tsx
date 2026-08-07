import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import LocalTime from "../../components/LocalTime";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope, slugFilter } from "@/lib/access";

export default async function AdminInbox() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin/inbox");
  const sf = slugFilter(scope);

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED", ...sf } });
  // Managers only see threads for their properties.
  let bookingIds: string[] | null = null;
  if (scope.slugs) {
    const bs = await prisma.booking.findMany({ where: sf, select: { id: true } });
    bookingIds = bs.map((b) => b.id);
  }
  const messages = await prisma.message.findMany({ where: bookingIds ? { bookingId: { in: bookingIds } } : {}, orderBy: { createdAt: "desc" } });
  const props = await getProperties(true);
  const nameOf = (s: string) => props.find((p) => p.slug === s)?.name || s;

  // Group by booking: latest message + unread (guest messages not yet read).
  const byBooking = new Map<string, { latest: typeof messages[0]; unread: number }>();
  for (const m of messages) {
    const cur = byBooking.get(m.bookingId);
    const isUnread = m.sender === "GUEST" && !m.readByAdmin;
    if (!cur) byBooking.set(m.bookingId, { latest: m, unread: isUnread ? 1 : 0 });
    else cur.unread += isUnread ? 1 : 0;
  }
  const ids = [...byBooking.keys()];
  const bookings = ids.length ? await prisma.booking.findMany({ where: { id: { in: ids } }, include: { user: true } }) : [];
  const bookingOf = new Map(bookings.map((b) => [b.id, b]));

  const threads = [...byBooking.entries()]
    .map(([id, v]) => ({ id, ...v, booking: bookingOf.get(id) }))
    .filter((t) => t.booking)
    .sort((a, b) => (b.unread - a.unread) || (b.latest.createdAt.getTime() - a.latest.createdAt.getTime()));
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Inbox</h2>
                <p className="lead" style={{ marginBottom: 0 }}>All guest conversations in one place{totalUnread > 0 ? ` · ${totalUnread} unread` : ""}. Open a thread to reply.</p>
              </div>
              <div className="panel">
                {threads.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No messages yet.</p> : (
                  <ul className="ov-list">
                    {threads.map((t) => (
                      <li key={t.id} className="ov-row">
                        <div style={{ minWidth: 0 }}>
                          <span className="ov-row__name">
                            {t.booking!.user.name || t.booking!.user.email.split("@")[0]}
                            {t.unread > 0 && <span className="msg-badge">{t.unread}</span>}
                          </span>
                          <span className="ov-row__meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 480, display: "block" }}>
                            {nameOf(t.booking!.propertySlug)} · {t.latest.sender === "ADMIN" ? "You: " : ""}{t.latest.body}
                          </span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span className="ov-row__meta" style={{ display: "block" }}><LocalTime iso={t.latest.createdAt.toISOString()} /></span>
                          <Link className="chip" href={`/admin/bookings/${t.id}`}>Open</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
