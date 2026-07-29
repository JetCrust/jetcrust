import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../../components/AppHeader";
import GuidebookView from "../../../../components/GuidebookView";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { staffScope, canAccessProperty } from "@/lib/access";
import { visibleSections } from "@/lib/guidebook";

export default async function BookingGuide({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/account");
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) notFound();

  const scope = await staffScope();
  const isStaff = !!scope && canAccessProperty(scope, b.propertySlug);
  if (b.userId !== userId && !isStaff) notFound();

  const p = await getProperty(b.propertySlug);
  const gb = p?.guidebook;
  const live = !!gb?.enabled;

  // Guests only see a live guidebook; staff can preview a draft.
  const canView = live || isStaff;
  const sections = gb ? visibleSections(gb, b.checkIn, new Date(), isStaff) : [];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <p style={{ marginBottom: "1rem" }}>
            <Link className="textlink" href={`/account/bookings/${b.id}`}>&larr; Back to your booking</Link>
          </p>

          {isStaff && !live && (
            <p className="note" style={{ background: "#fff5e6", border: "1px solid #e6c98a", borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
              Staff preview — this guidebook is not live yet, so guests can’t see it. Turn it on in the property editor.
            </p>
          )}

          {canView ? (
            <GuidebookView
              sections={sections}
              intro={gb?.intro}
              propertyName={p?.name || b.propertySlug}
              hours={p?.hours}
            />
          ) : (
            <div className="sec-head">
              <h2>Guidebook</h2>
              <p className="lead">Your guidebook for {p?.name || "this stay"} will be ready here before arrival. We’ll email you when it’s live.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
