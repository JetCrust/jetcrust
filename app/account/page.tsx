import { Suspense } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AuthForms from "../components/AuthForms";
import AccountNav from "../components/AccountNav";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties, imageUrl } from "@/lib/properties";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Awaiting approval",
  APPROVED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AccountPage() {
  const session = await auth();

  if (!session) {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "70vh" }}>
          <div className="wrap" style={{ maxWidth: 860 }}>
            <div className="sec-head center">
              <p className="overline eyebrow-line" style={{ justifyContent: "center" }}>Your Account</p>
              <h2>Sign in to book</h2>
              <p className="lead" style={{ marginInline: "auto" }}>
                An account lets you request a stay, accept your agreement, and manage your bookings.
              </p>
            </div>
            <Suspense fallback={null}>
              <AuthForms />
            </Suspense>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <AccountNav />
            <div>
              {(() => {
                const role = (session.user as { role?: string } | undefined)?.role;
                if (role !== "ADMIN" && role !== "MANAGER") return null;
                return (
                  <div className="panel" style={{ marginBottom: "1.4rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", borderLeft: "3px solid var(--forest, #253026)" }}>
                    <div>
                      <strong>{role === "ADMIN" ? "You're an administrator." : "You're a property manager."}</strong>
                      <p className="panel__hint" style={{ margin: "0.15rem 0 0" }}>This is your personal guest account. To manage {role === "ADMIN" ? "the portfolio" : "your properties"} — bookings, calendar, guests — open the console.</p>
                    </div>
                    <Link className="btn btn--dark" href="/admin" style={{ flex: "0 0 auto" }}>Open the console →</Link>
                  </div>
                );
              })()}
              <AccountDashboard userId={(session.user as { id: string }).id} name={session.user?.name || session.user?.email || "there"} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

async function AccountDashboard({ userId, name }: { userId: string; name: string }) {
  const bookings = await prisma.booking.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const props = await getProperties(true);
  const byslug = new Map(props.map((p) => [p.slug, p]));
  const upcoming = bookings.filter((b) => b.status === "APPROVED" && new Date(b.checkOut) >= new Date()).length;
  const pending = bookings.filter((b) => b.status === "REQUESTED").length;

  return (
    <>
      <div className="sec-head">
        <p className="overline eyebrow-line">Your Account</p>
        <h2>Welcome back, {name.split(" ")[0]}</h2>
        <p className="lead">
          {bookings.length === 0
            ? "Your stays will appear here once you make your first request."
            : `${upcoming} confirmed ${upcoming === 1 ? "stay" : "stays"}${pending ? `, ${pending} awaiting approval` : ""}.`}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="panel panel--empty">
          <p style={{ margin: "0 0 1.2rem", color: "var(--ink-soft)" }}>
            You have no bookings yet. While you are here, you can set up your details and save a card so checkout is quick when you find your stay.
          </p>
          <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn--brass" href="/#collection">Explore the collection</Link>
            <Link className="btn btn--ghost" href="/account/details">Complete my details</Link>
            <Link className="btn btn--ghost" href="/account/billing">Add a card</Link>
          </div>
        </div>
      ) : (
        <div className="stack">
          {bookings.map((b) => {
            const p = byslug.get(b.propertySlug);
            const status = (STATUS_LABEL[b.status] || b.status).toLowerCase().replace(/\s+/g, "-");
            return (
              <Link key={b.id} href={`/account/bookings/${b.id}`} className="bcard">
                <div
                  className="bcard__media"
                  style={p ? { backgroundImage: `url('${imageUrl(p.img_key, p.card.image, 800)}')` } : undefined}
                />
                <div className="bcard__body">
                  <span className="bcard__loc">{p?.location || ""}</span>
                  <h3>{p?.name || b.propertySlug}</h3>
                  <p className="bcard__meta">
                    {fmt(b.checkIn)} to {fmt(b.checkOut)} · {b.guests} guest{b.guests === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="bcard__side">
                  <span className={`pill pill--${status}`}>{STATUS_LABEL[b.status] || b.status}</span>
                  <span className="bcard__price">€{(b.amountCents / 100).toLocaleString("en-US")}</span>
                  <span className="bcard__manage">Manage &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
