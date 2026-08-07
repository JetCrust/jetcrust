import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import ConsoleNav from "../../../components/ConsoleNav";
import AdminActions from "../../../components/AdminActions";
import BalanceButton from "../../../components/BalanceButton";
import AdminNotes from "../../../components/AdminNotes";
import MessageThread from "../../../components/MessageThread";
import SecurityDeposit from "../../../components/SecurityDeposit";
import { depositIsCharge } from "@/lib/security-deposit";
import ExtrasLedger from "../../../components/ExtrasLedger";
import RefundControl from "../../../components/RefundControl";
import BookingBreakdown, { parseBreakdown } from "../../../components/BookingBreakdown";
import LocalTime from "../../../components/LocalTime";
import { prisma } from "@/lib/prisma";
import { getProperty, fmtInTz } from "@/lib/properties";
import { parseExtras } from "@/lib/accounting";
import { staffScope, slugFilter, canAccessProperty } from "@/lib/access";

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

export default async function AdminBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");

  const { id } = await params;
  const b = await prisma.booking.findUnique({ where: { id }, include: { user: true, acceptance: true } });
  if (!b) notFound();
  if (!canAccessProperty(scope, b.propertySlug)) notFound();

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED", ...slugFilter(scope) } });
  const p = await getProperty(b.propertySlug);
  const [checkinReport, checkoutReport] = await Promise.all([
    prisma.stayReport.findFirst({ where: { bookingId: id, kind: "CHECKIN" }, orderBy: { createdAt: "desc" } }),
    prisma.stayReport.findFirst({ where: { bookingId: id, kind: "CHECKOUT" }, orderBy: { createdAt: "desc" } }),
  ]);
  const reportStatus = (r: { completedAt: Date | null } | null) => (!r ? "Not started" : r.completedAt ? `Completed ${fmtInTz(r.completedAt, p?.timezone || "Europe/Bucharest")} (property time)` : "Draft saved");
  const chatMessages = await prisma.message.findMany({ where: { bookingId: id }, orderBy: { createdAt: "asc" } });
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
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />

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
                  <div className="panel__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h3>Guest</h3><Link className="textlink" href={`/admin/guests/${b.userId}`}>Full profile &rarr;</Link></div>
                  <ul className="kv">
                    <li><span>Name</span><span>{[b.user.title, b.user.name].filter(Boolean).join(" ") || "—"}</span></li>
                    <li><span>Email</span><span><a className="textlink" href={`mailto:${b.user.email}`}>{b.user.email}</a></span></li>
                    {b.user.phone && <li><span>Phone</span><span>{b.user.phone}</span></li>}
                    <li><span>Account created</span><span><LocalTime iso={b.user.createdAt.toISOString()} /></span></li>
                    <li><span>Requested</span><span><LocalTime iso={b.createdAt.toISOString()} /></span></li>
                  </ul>
                  {b.user.preferences && (
                    <>
                      <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Guest preferences (account)</p>
                      <p style={{ margin: 0, color: "var(--ink-soft)" }}>{b.user.preferences}</p>
                    </>
                  )}
                  {b.stayPreferences && (
                    <>
                      <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>This stay's preferences</p>
                      <p style={{ margin: 0, color: "var(--ink-soft)" }}>{b.stayPreferences}</p>
                    </>
                  )}
                  {b.reviewRating && (
                    <>
                      <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Guest review</p>
                      <p style={{ margin: 0, color: "var(--ink-soft)" }}><span style={{ color: "var(--brass)", letterSpacing: "0.1em" }}>{"★".repeat(b.reviewRating)}</span>{b.reviewText ? ` — "${b.reviewText}"` : ""}</p>
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
                            &ldquo;{m.text}&rdquo; <span style={{ fontStyle: "normal", color: "var(--stone)", fontSize: "0.78rem" }}>· {m.at ? <LocalTime iso={m.at} /> : ""}</span>
                          </p>
                        ))}
                      </>
                    ) : null;
                  })()}
                </div>

                {/* Messages */}
                <div className="panel">
                  <div className="panel__head"><h3>Messages</h3></div>
                  <MessageThread bookingId={b.id} me="ADMIN" messages={chatMessages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() }))} />
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
                          {b.balancePaidAt ? <> · paid <LocalTime iso={b.balancePaidAt.toISOString()} /></> : b.balanceDueAt ? ` · due ${fmt(b.balanceDueAt)}` : ""}
                        </span>
                      </li>
                    )}
                    <li><span>Total</span><span>{money(b.amountCents)}</span></li>
                  </ul>
                  {b.status === "APPROVED" && b.balanceCents > 0 && !b.balancePaidAt && (
                    <div style={{ marginTop: "1rem" }}><BalanceButton bookingId={b.id} /></div>
                  )}
                </div>

                {/* Security deposit */}
                {b.status === "APPROVED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Security deposit</h3></div>
                    <SecurityDeposit bookingId={b.id} cents={b.securityCents} status={b.securityStatus} capturedCents={b.securityCapturedCents} willCharge={depositIsCharge(b.checkIn, b.checkOut)} propertyDepositCents={Math.round((Number(p?.pricing?.deposit_eur) || 0) * 100)} />
                  </div>
                )}

                {/* Check-in / check-out forms */}
                {b.status === "APPROVED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Check-in &amp; check-out</h3></div>
                    <p className="panel__hint">Tablet-first forms: check-in captures ID, preferences, agreement signature and arrival add-ons; check-out captures condition photos, extras, deposit outcome and the guest's signature.</p>
                    <ul className="kv" style={{ marginBottom: "1rem" }}>
                      <li><span>Check-in</span><span>{reportStatus(checkinReport)}</span></li>
                      <li><span>Check-out</span><span>{reportStatus(checkoutReport)}</span></li>
                    </ul>
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                      <Link href={`/admin/checkin/${b.id}`} className="btn btn--ghost" style={{ justifyContent: "center" }}>{checkinReport?.completedAt ? "View check-in" : "Start check-in"}</Link>
                      <Link href={`/admin/checkout/${b.id}`} className="btn btn--dark" style={{ justifyContent: "center" }}>{checkoutReport?.completedAt ? "View check-out" : "Start check-out"}</Link>
                    </div>
                  </div>
                )}

                {/* Extras ledger */}
                {b.status === "APPROVED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Extras &amp; charges</h3></div>
                    <p className="panel__hint">Bar, services, late checkout or agreed breakages. Charge the saved card, take cash, or settle from the security deposit.</p>
                    <ExtrasLedger bookingId={b.id} extras={parseExtras(b.extras)} hasCard={!!(b.stripeCustomerId && b.stripePaymentMethodId)} />
                  </div>
                )}

                {/* Refund */}
                {b.status === "APPROVED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Refund</h3></div>
                    <p className="panel__hint">Refund part or all of the stay payment to the guest. The security deposit is handled above, on its own hold.</p>
                    <RefundControl bookingId={b.id} totalCents={b.amountCents} refundedCents={b.refundedCents} />
                  </div>
                )}

                {/* Agreement / compliance */}
                <div className="panel">
                  <div className="panel__head"><h3>Agreement</h3></div>
                  {b.acceptance ? (
                    <ul className="kv">
                      <li><span>Version</span><span>{b.acceptance.contractVersion}</span></li>
                      <li><span>Accepted</span><span><LocalTime iso={b.acceptance.acceptedAt.toISOString()} /></span></li>
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
                  <AdminNotes bookingId={b.id} log={(() => {
                    if (!b.adminNotes) return [];
                    try { const v = JSON.parse(b.adminNotes); return Array.isArray(v) ? v : [{ text: b.adminNotes, at: "" }]; }
                    catch { return [{ text: b.adminNotes, at: "" }]; }
                  })()} />
                </div>

                {/* Actions */}
                {b.status === "REQUESTED" && (
                  <div className="panel">
                    <div className="panel__head"><h3>Decision</h3></div>
                    <p className="panel__hint">
                      Choose how much to charge now, then approve (this charges the card and blocks these dates) or decline (releases the hold).
                    </p>
                    <AdminActions
                      bookingId={b.id}
                      totalCents={b.amountCents}
                      defaultPct={Number(p?.pricing?.charge_now_pct) || 100}
                      balanceDays={Number(p?.pricing?.balance_days_before) || 30}
                    />
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
