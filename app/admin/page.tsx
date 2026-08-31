import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../components/AppHeader";
import ConsoleNav from "../components/ConsoleNav";
import { prisma } from "@/lib/prisma";
import { getProperty, getProperties } from "@/lib/properties";
import { staffScope, slugFilter } from "@/lib/access";
import AddOtaStay from "../components/AddOtaStay";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Awaiting approval",
  APPROVED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function Row({
  b,
}: {
  b: { id: string; propertySlug: string; checkIn: Date; checkOut: Date; guests: number; amountCents: number; status: string; channel: string; guestName: string | null; user: { email: string; name: string | null } };
}) {
  const p = await getProperty(b.propertySlug);
  const ota = b.channel !== "DIRECT";
  const statusClass = (STATUS_LABEL[b.status] || b.status).toLowerCase().replace(/\s+/g, "-");
  const name = b.guestName || b.user.name || b.user.email;
  return (
    <Link href={`/admin/bookings/${b.id}`} className="bcard" style={{ gridTemplateColumns: "1fr auto" }}>
      <div className="bcard__body">
        <span className="bcard__loc">{p?.name || b.propertySlug}</span>
        <h3 style={{ fontSize: "1.15rem" }}>{name}</h3>
        <p className="bcard__meta">
          {fmt(b.checkIn)} to {fmt(b.checkOut)} · {b.guests} guest{b.guests === 1 ? "" : "s"}{ota ? "" : ` · ${b.user.email}`}
        </p>
      </div>
      <div className="bcard__side">
        {ota && <span className="pill" style={{ background: "#e7eef7", color: "#1a4a7a" }}>{b.channel}</span>}
        <span className={`pill pill--${statusClass}`}>{STATUS_LABEL[b.status] || b.status}</span>
        {ota ? <span className="bcard__price" style={{ color: "var(--stone)" }}>via OTA</span> : <span className="bcard__price">{money(b.amountCents)}</span>}
        <span className="bcard__manage">Open &rarr;</span>
      </div>
    </Link>
  );
}

export default async function AdminPage() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");

  const bookings = await prisma.booking.findMany({
    where: { ...slugFilter(scope) },
    orderBy: [{ createdAt: "desc" }],
    include: { user: true },
  });
  const pending = bookings.filter((b) => b.status === "REQUESTED");
  const balances = bookings.filter((b) => b.status === "APPROVED" && b.balanceCents > 0 && !b.balancePaidAt);
  const rest = bookings.filter((b) => b.status !== "REQUESTED");

  // Only ADMIN/OPS can add an OTA stay by hand (the API enforces this too).
  const canAddOta = scope.role === "ADMIN" || scope.role === "OPS";
  const propertyOptions = canAddOta
    ? (await getProperties())
        .filter((p) => !scope.slugs || scope.slugs.includes(p.slug))
        .map((p) => ({ slug: p.slug, name: p.name }))
    : [];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pending.length} role={scope.role} />

            <div>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Bookings</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  Open any booking to see the guest, the full price breakdown, the signed agreement, and to approve,
                  decline or add private notes.
                </p>
              </div>

              {canAddOta && propertyOptions.length > 0 && (
                <div style={{ marginBottom: "1.6rem" }}>
                  <AddOtaStay properties={propertyOptions} />
                </div>
              )}

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head">
                  <h3>Awaiting approval</h3>
                  <span className="console__count">{pending.length}</span>
                </div>
                {pending.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--stone)" }}>Nothing waiting. All caught up.</p>
                ) : (
                  <div className="stack">{pending.map((b) => <Row key={b.id} b={b} />)}</div>
                )}
              </div>

              {balances.length > 0 && (
                <div className="panel" style={{ marginBottom: "1.6rem" }}>
                  <div className="panel__head">
                    <h3>Balances due</h3>
                    <span className="console__count">{balances.length}</span>
                  </div>
                  <p className="panel__hint">Balances charge automatically on their due date. Open a booking to charge one now.</p>
                  <div className="stack">{balances.map((b) => <Row key={b.id} b={b} />)}</div>
                </div>
              )}

              <div className="panel">
                <div className="panel__head">
                  <h3>All bookings</h3>
                  <span className="console__count">{rest.length}</span>
                </div>
                {rest.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--stone)" }}>No processed bookings yet.</p>
                ) : (
                  <div className="stack">{rest.map((b) => <Row key={b.id} b={b} />)}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
