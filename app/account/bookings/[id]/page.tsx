import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import BookingManage from "../../../components/BookingManage";
import CancelBookingButton from "../../../components/CancelBookingButton";
import BookingBreakdown, { parseBreakdown } from "../../../components/BookingBreakdown";
import GuestStayForms from "../../../components/GuestStayForms";
import CancelStay from "../../../components/CancelStay";
import MessageThread from "../../../components/MessageThread";
import { cancellationRefund } from "@/lib/policy";
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
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/account");
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const b = await prisma.booking.findUnique({ where: { id }, include: { acceptance: true } });
  if (!b) notFound();
  if (b.userId !== userId) notFound();
  const p = await getProperty(b.propertySlug);
  const checkoutReport = b.status === "APPROVED"
    ? await prisma.stayReport.findFirst({ where: { bookingId: b.id, kind: "CHECKOUT", completedAt: { not: null } }, orderBy: { createdAt: "desc" } })
    : null;
  const checkoutItems: { desc: string; amountCents: number }[] = checkoutReport ? JSON.parse(checkoutReport.items || "[]") : [];
  const chatMessages = await prisma.message.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: "asc" } });
  const current: string[] = JSON.parse(b.addons || "[]");
  let messages: { text: string; at: string }[] = [];
  try { messages = JSON.parse(b.guestMessages || "[]"); } catch { messages = []; }
  const canEdit = !["DECLINED", "CANCELLED", "EXPIRED"].includes(b.status);
  const hasBalance = b.balanceCents > 0;
  const addonTitles = current.map((v) => p?.addons.find((a) => a.value === v)?.title || v).join(", ");
  const depositLabel = `${money(b.depositCents ?? 0)}${b.status === "APPROVED" ? " charged" : " held"}`;
  const balanceLabel = `${money(b.balanceCents)}${b.balancePaidAt ? " paid" : b.balanceDueAt ? ` due ${fmt(b.balanceDueAt)}` : ""}`;
  const paymentLabel = b.status === "APPROVED" ? "Charged" : "Card held, not charged";

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p style={{ marginBottom: "1rem" }}><Link className="textlink" href="/account">&larr; My bookings</Link></p>

          <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
            <p className="overline eyebrow-line">Your booking</p>
            <h2>{p?.name || b.propertySlug}</h2>
          </div>

          <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", alignItems: "baseline" }}>
              <h3 style={{ fontSize: "1.4rem" }}>{fmt(b.checkIn)} to {fmt(b.checkOut)}</h3>
              <span className="tag">{STATUS_LABEL[b.status] || b.status}</span>
            </div>
            <div className="rule"></div>
            <ul>
              <li>Guests <span>{b.guests}</span></li>
              {hasBalance ? (
                <>
                  <li>Deposit <span>{depositLabel}</span></li>
                  <li>Balance <span>{balanceLabel}</span></li>
                </>
              ) : (
                <li>Payment <span>{paymentLabel}</span></li>
              )}
              {current.length > 0 && <li>Add-ons <span>{addonTitles}</span></li>}
              {b.securityCents > 0 && (
                <li>Security deposit <span>{money(b.securityCents)}{
                  b.securityStatus === "held" ? " · held" :
                  b.securityStatus === "released" ? " · released" :
                  b.securityStatus === "captured" ? ` · ${money(b.securityCapturedCents)} charged` :
                  " · refundable, held near arrival"
                }</span></li>
              )}
            </ul>

            <p className="panel__hint" style={{ marginBottom: "0.5rem" }}>What you are paying for</p>
            <BookingBreakdown breakdown={parseBreakdown(b.breakdown)} fallbackTotal={b.amountCents / 100} />
            {b.status === "REQUESTED" && (
              <div style={{ marginTop: "0.4rem" }}><CancelBookingButton bookingId={b.id} /></div>
            )}
          </div>

          <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.6rem" }}>Messages &amp; concierge</h3>
            <p className="panel__hint" style={{ marginTop: 0 }}>Message us directly about your stay. We reply here and by email.</p>
            <MessageThread bookingId={b.id} me="GUEST" messages={chatMessages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() }))} />
          </div>

          <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.6rem" }}>Your documents</h3>
            <ul className="kv">
              <li><span>Rental agreement</span><span>{b.acceptance ? `Signed ${fmt(b.acceptance.acceptedAt)}` : "On file"}</span></li>
              <li><span>House rules &amp; terms</span><span><Link className="textlink" href="/terms">View</Link></span></li>
              {p?.hours && <li><span>Arrival &amp; departure</span><span>In from {p.hours.check_in} · out by {p.hours.check_out}</span></li>}
              {b.securityCents > 0 && (
                <li><span>Security deposit</span><span>{money(b.securityCents)}{
                  b.securityStatus === "held" ? " · held" :
                  b.securityStatus === "released" ? " · released" :
                  b.securityStatus === "captured" ? ` · ${money(b.securityCapturedCents)} charged` :
                  " · refundable, held near arrival"
                }</span></li>
              )}
            </ul>
            {checkoutReport && (
              <>
                <div className="rule"></div>
                <p className="panel__hint" style={{ marginBottom: "0.4rem" }}>Check-out summary</p>
                <ul className="kv">
                  {checkoutItems.map((it, i) => (<li key={i}><span>{it.desc}</span><span>{money(it.amountCents)}</span></li>))}
                  <li style={{ fontWeight: 600 }}><span>Additional charges</span><span>{money(checkoutReport.additionalCents)}</span></li>
                </ul>
              </>
            )}
            <p className="note" style={{ margin: "0.6rem 0 0", color: "var(--stone)", fontSize: "0.8rem" }}>Arrival directions and access details are sent by our team before your stay.</p>
          </div>

          <GuestStayForms
            bookingId={b.id}
            preferences={b.stayPreferences || ""}
            showPreferences={!["CANCELLED", "DECLINED", "EXPIRED"].includes(b.status) && b.checkOut > new Date()}
            canReview={b.status === "APPROVED" && b.checkOut <= new Date()}
            review={b.reviewRating ? { rating: b.reviewRating, text: b.reviewText || "" } : null}
          />

          {b.status === "APPROVED" && b.checkIn > new Date() && (() => {
            const c = cancellationRefund(b, new Date());
            return <CancelStay bookingId={b.id} refundableCents={c.refundableCents} label={c.label} />;
          })()}

          {(b.note || messages.length > 0) && (
            <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "0.6rem" }}>Your notes & requests</h3>
              {b.note && (
                <p style={{ margin: "0 0 0.8rem", color: "var(--ink-soft)" }}>
                  <span className="panel__hint" style={{ display: "block", marginBottom: "0.2rem" }}>At booking</span>
                  &ldquo;{b.note}&rdquo;
                </p>
              )}
              {messages.map((m, i) => (
                <p key={i} style={{ margin: "0 0 0.7rem", color: "var(--ink-soft)" }}>
                  <span className="panel__hint" style={{ display: "block", marginBottom: "0.2rem" }}>{new Date(m.at).toLocaleString("en-GB")}</span>
                  &ldquo;{m.text}&rdquo;
                </p>
              ))}
              <p className="note" style={{ margin: 0, color: "var(--stone)", fontSize: "0.8rem" }}>Our team replies personally, by email.</p>
            </div>
          )}

          {canEdit ? (
            <>
              <div className="sec-head" style={{ marginBottom: "0.4rem" }}>
                <p className="overline eyebrow-line">Manage</p>
                <h3 style={{ fontSize: "1.5rem", fontFamily: "var(--serif)" }}>Add options or request a change</h3>
              </div>
              <BookingManage
                bookingId={b.id}
                catalog={p?.addons || []}
                currentAddons={current}
                guests={b.guests}
                maxGuests={p?.capacity.sleeps ?? 64}
              />
            </>
          ) : (
            <p className="lead">This booking is {STATUS_LABEL[b.status]?.toLowerCase()} and can no longer be changed. <Link className="textlink" href="/#collection">Explore the collection</Link></p>
          )}
        </div>
      </main>
    </>
  );
}
