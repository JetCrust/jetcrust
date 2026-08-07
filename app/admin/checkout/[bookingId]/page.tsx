import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import CheckoutForm from "../../../components/CheckoutForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";

export default async function CheckoutPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin");
  if (role !== "ADMIN" && role !== "OPS") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main></>);
  }

  const { bookingId } = await params;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } });
  if (!booking) notFound();
  const property = await getProperty(booking.propertySlug);
  const report = await prisma.stayReport.findFirst({ where: { bookingId, kind: "CHECKOUT" }, orderBy: { createdAt: "desc" } });

  const guestName = booking.user.name || booking.user.email.split("@")[0];
  const initial = report ? {
    photos: JSON.parse(report.photos || "[]"),
    items: JSON.parse(report.items || "[]"),
    depositStatus: report.depositStatus,
    depositNote: report.depositNote || "",
    notes: report.notes || "",
    staffName: report.staffName || "",
    signature: report.signature || "",
    completedAt: report.completedAt ? report.completedAt.toISOString() : null,
  } : null;

  return (
    <>
      <AppHeader />
      <main className="co-main">
        <CheckoutForm
          bookingId={booking.id}
          propertyName={property?.name || booking.propertySlug}
          guestName={guestName}
          security={{ cents: booking.securityCents, status: booking.securityStatus, capturedCents: booking.securityCapturedCents }}
          initial={initial}
        />
      </main>
    </>
  );
}
