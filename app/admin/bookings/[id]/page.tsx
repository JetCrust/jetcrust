import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import ConsoleNav from "../../../components/ConsoleNav";
import AdminActions from "../../../components/AdminActions";
import BalanceButton from "../../../components/BalanceButton";
import AdminNotes from "../../../components/AdminNotes";
import BookingBreakdown, { parseBreakdown } from "../../../components/BookingBreakdown";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Awaiting approval",
  APPROVED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;
const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "—";
const fmtDT = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB") : "—");

export default async function AdminBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}>
          <div className="wrap"><h2>Not authorized</h2></div>
        </main>
      </>
    );
  }

  const { id } = await params;
  const b = await prisma.booking.findUnique({ where: { id }, include: { user: true, acceptance: true } });
  if (!b) notFound();

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const p = await getProperty(b.propertySlug);
  const addonKeys: string[] = JSON.parse(b.addons || "[]");
  const addonTitles = (p?.addons || []).filter((a) => addonKeys.includes(a.value));
  const breakdown = parseBreakdown(b.breakdown);
  const statusClass = (STATUS_LABEL[b.status] || b.status).toLowerCase().replace(/\s+/g, "-");

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />

            <div>
              <p style={{ margin: "0 0 1rem" }}>
                <Link className="textlink" href="/admin">&larr; All bookings</Link>
              </p>

              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Booking</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>{p?.name || b.propertySlug}</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  {fmt(b.checkIn)} to {fmt(b.checkOut)} · {b.guests} guest{b.guests === 1 ? "" : "s"}
                </p>
                <p style={{ marginTop: "0.8rem" }}><span className={`pill pill--${statusClass}`}>{STATUS_LABEL[b.status] || b.status}</span></p>
              </div>

              <div className="stack">
                {/* Who is booking */}
                <div className="panel">
                  <div className="panel__head"><h3>Guest</h3></div>
                  <ul className="kv">
                    <li><span>Name</span><span>{[b.user.title, b.user.name].filter(Boolean).join(" ") || "—"}</span></li>
                    <li><span>Email</span><span><a className="textlink" href={`mailto:${b.user.email}`}>{b.user.email}</a></span></li>
                    {b.user.phone && <li><span>Phone</span><span>{b.user.phone}</span></li>}
                    <li><span>Account created</span><span>{fmtDT(b.user.createdAt)}</span></li>
                    <li><span>Requested</span><span>{fmtDT(b.createdAt)}</span></li>
                  </ul>
                  {b.user.preferences && (
                    <>
                      <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Guest preferences</p>
                      <p style={{ margin: 0, color: "var(--ink-soft)" }}>{b.user.preferences}</p>
                    </>
                  )}
                  {b.note && (
                    <>
                      <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Guest note (at booking)</p>
                      <p style={{ margin: 0, fontStyle: "italic", color: "var(--ink-soft)" }}>&ldquo;{b.note}&rdquo;</p>
                    </>
                  )}
                  {(() => {
                    let gm: { text: string; at: string }[] = [];
                    try { gm = JSON.parse(b.guestMessages || "[]"); } catch { gm = []; }
                    return gm.length > 0 ? (
                      <>
                        <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Guest requests</p>
                        {gm.map((m, i) => (
                          <p key={i} style={{ margin: "0 0 0.5rem", fontStyle: "italic", color: "var(--ink-soft)" }}>
                            &ldquo;{m.text}&rdquo; <span style={{ fontStyle: "normal", color: "var(--stone)", fontSize: "0.78rem" }}>· {fmtDT(new Date(m.at))}</span>
                          </p>
                        ))}
                      </>
                    ) : null;
                  })()}
                </div>

                {/* Stay + add-ons */}
                <div className="panel">
                  <div className="panel__head"><h3>Stay</h3></div>
                  <ul className="kv">
                    <li><span>Check in</span><span>{fmt(b.checkIn)} {p ? `· from ${p.hours.check_in}` : ""}</span></li>
                    <li><span>Check out</span><span>{fmt(b.checkOut)} {p ? `· by ${p.hours.check_out}` : ""}</span></li>
                    <li><span>Guests</span><span>{b.guests}</span></li>
                    <li>
                      <span>Add-ons</span>
                      <span>{addonTitles.length ? addonTitles.map((a) => a.title).join(", ") : "None"}</span>
                    </li>
                  </ul>
                </div>

                {/* Money */}
                <div className="panel">
                  <div className="panel__head"><h3>Price</h3></div>
                  <BookingBreakdown breakdown={breakdown} fallbackTotal={b.amountCents / 100} />
                  <ul className="kv" style={{ marginTop: "1rem" }}>
                    <li><span>Held / charged first</span><span>{money(b.depositCents ?? b.amountCents)}</span></li>
                    {b.balanceCents > 0 && (
                      <li>
                        <span>Balance</span>
                        <span>
                          {money(b.balanceCents)}
                          {b.balancePaidAt ? ` · paid ${fmtDT(b.balancePaidAt)}` : b.balanceDueAt ? ` · due ${fmt(b.balanceDueAt)}` : ""}
                        </span>
                      </li>
                    )}
                    <li><span>Total</span><span>{money(b.amountCents)}</span></li>
                  </ul>
                  {b.status === "APPROVED" && b.balanceCents > 0 && !b.balancePaidAt && (
                    <div style={{ marginTop: "1rem" }}><BalanceButton bookingId={b.id} /></div>
                  )}
                </div>

                {/* Agreement / compliance */}
                <div className="panel">
                  <div className="panel__head"><h3>Agreement</h3></div>
                  {b.acceptance ? (
                    <ul className="kv">
                      <li><span>Version</span><span>{b.acceptance.contractVersion}</span></li>
                      <li><span>Accepted</span><span>{fmtDT(b.acceptance.acceptedAt)}</span></li>
                      <li><span>IP address</span><span>{b.acceptance.ipAddress}</span></li>
                      <li><span>Device</span><span style={{ maxWidth: 320, fontSize: "0.78rem" }}>{b.acceptance.userAgent}</span></li>
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: "var(--stone)" }}>No agreement recorded.</p>
                  )}
                </div>

                {/* Internal notes */}
                <div className="panel">
                  <div className="panel__head"><h3>Internal notes</h3></div>
                  <p className="panel__hint">Only your team sees these. The guest never does.</p>
                  <AdminNotes bookingId={b.id} initial={b.adminNotes || ""} />
                </div>

                {/* Actions */}
                {b.status === "REQUESTED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Decision</h3></div>
                    <p className="panel__hint">
                      Approving captures the held card and blocks these dates. Declining releases the hold.
                    </p>
                    <AdminActions bookingId={b.id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
