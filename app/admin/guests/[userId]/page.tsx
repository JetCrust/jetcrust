import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import ConsoleNav from "../../../components/ConsoleNav";
import LocalTime from "../../../components/LocalTime";
import MessageThread from "../../../components/MessageThread";
import PrivateOfferForm from "../../../components/PrivateOfferForm";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { bookingIncome } from "@/lib/accounting";
import { staffScope, slugFilter } from "@/lib/access";
import { serializeMessages } from "@/lib/threads";

const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS: Record<string, string> = { REQUESTED: "Awaiting", APPROVED: "Confirmed", DECLINED: "Declined", CANCELLED: "Cancelled", EXPIRED: "Expired" };

export default async function GuestProfile({ params }: { params: Promise<{ userId: string }> }) {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");
  const sf = slugFilter(scope);

  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { bookings: { where: sf, orderBy: { checkIn: "desc" } } } });
  if (!user) notFound();
  if (!scope.isSuper && user.bookings.length === 0) notFound();
  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED", ...sf } });
  const props = await getProperties(true);
  const nameOf = (s: string) => props.find((p) => p.slug === s)?.name || s;

  const approved = user.bookings.filter((b) => b.status === "APPROVED");
  const lifetime = approved.reduce((s, b) => s + bookingIncome(b).netCents, 0);
  const nights = approved.reduce((s, b) => s + Math.max(0, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86400000)), 0);
  const now = new Date();

  // The guest's continuous thread, scoped: super sees all; managers see only
  // messages tied to the bookings visible to them (user.bookings is already sf-scoped).
  const msgWhere = scope.isSuper ? { userId } : { userId, bookingId: { in: user.bookings.map((b) => b.id) } };
  const messages = await prisma.message.findMany({ where: msgWhere, orderBy: { createdAt: "asc" } });
  const offerRows = await prisma.privateOffer.findMany({ where: { email: user.email.toLowerCase() }, orderBy: { createdAt: "desc" } });
  const offers = offerRows.map((o) => ({ id: o.id, propertySlug: o.propertySlug, checkIn: o.checkIn.toISOString(), checkOut: o.checkOut.toISOString(), priceCents: o.priceCents, status: o.status, note: o.note }));

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <p style={{ margin: "0 0 1rem" }}><Link className="textlink" href="/admin/guests">&larr; All guests</Link></p>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Guest</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>{[user.title, user.name].filter(Boolean).join(" ") || user.email}</h2>
              </div>

              <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                <div className="rep-kpi"><p className="rep-kpi__label">Confirmed stays</p><p className="rep-kpi__value">{approved.length}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Nights hosted</p><p className="rep-kpi__value">{nights}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Lifetime value</p><p className="rep-kpi__value">{money(lifetime)}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Guest since</p><p className="rep-kpi__value" style={{ fontSize: "1.3rem" }}>{fmt(user.createdAt)}</p></div>
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Contact &amp; preferences</h3></div>
                <ul className="kv">
                  <li><span>Email</span><span><a className="textlink" href={`mailto:${user.email}`}>{user.email}</a></span></li>
                  {user.phone && <li><span>Phone</span><span>{user.phone}</span></li>}
                  <li><span>Marketing</span><span>{user.marketingOptIn ? "Subscribed" : "Not subscribed"}</span></li>
                  {(user.billingCity || user.billingCountry) && <li><span>Billing</span><span>{[user.billingLine1, user.billingCity, user.billingCountry].filter(Boolean).join(", ")}</span></li>}
                </ul>
                {user.preferences && (
                  <>
                    <p className="panel__hint" style={{ marginTop: "1rem", marginBottom: "0.3rem" }}>Preferences</p>
                    <p style={{ margin: 0, color: "var(--ink-soft)" }}>{user.preferences}</p>
                  </>
                )}
              </div>

              {(scope.role === "ADMIN" || scope.role === "OPS") && (
                <div className="panel">
                  <div className="panel__head"><h3>Private rate</h3></div>
                  <PrivateOfferForm email={user.email} properties={props.map((p) => ({ slug: p.slug, name: p.name }))} offers={offers} />
                </div>
              )}

              <div className="panel">
                <div className="panel__head"><h3>Messages</h3></div>
                <p className="panel__hint" style={{ marginTop: 0 }}>One continuous conversation with this guest across all their stays. Replies reach them here and by email.</p>
                <MessageThread
                  endpoint={`/api/admin/guests/${userId}/messages`}
                  me="ADMIN"
                  messages={serializeMessages(messages)}
                  placeholder="No messages with this guest yet."
                />
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Booking history</h3><span className="console__count">{user.bookings.length}</span></div>
                {user.bookings.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No bookings yet.</p> : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ledger">
                      <thead><tr><th>Property</th><th>Dates</th><th>Status</th><th>Value</th><th></th></tr></thead>
                      <tbody>
                        {user.bookings.map((b) => (
                          <tr key={b.id}>
                            <td>
                              {nameOf(b.propertySlug)}{b.status === "APPROVED" && b.checkOut > now ? " · upcoming" : ""}
                              {b.reviewRating ? <span title={`${b.reviewRating}/5`} style={{ marginLeft: "0.4rem", color: b.reviewRating <= 3 ? "#a3412e" : "var(--brass, #9a7b3f)" }}>{"★★★★★".slice(0, b.reviewRating)}</span> : null}
                            </td>
                            <td>{fmt(b.checkIn)} → {fmt(b.checkOut)}</td>
                            <td><span className={`pill pill--${(STATUS[b.status] || b.status).toLowerCase()}`}>{STATUS[b.status] || b.status}</span></td>
                            <td>{money(b.amountCents)}</td>
                            <td><Link className="textlink" href={`/admin/bookings/${b.id}`}>Open</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p style={{ fontSize: "0.78rem", color: "var(--stone)" }}>Account created <LocalTime iso={user.createdAt.toISOString()} />.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
