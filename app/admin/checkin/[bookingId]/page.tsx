import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import CheckinForm from "../../../components/CheckinForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";

const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

export default async function CheckinPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin");
  if (role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main></>);
  }

  const { bookingId } = await params;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } });
  if (!booking) notFound();
  const property = await getProperty(booking.propertySlug);
  const report = await prisma.stayReport.findFirst({ where: { bookingId, kind: "CHECKIN" }, orderBy: { createdAt: "desc" } });

  const guestName = booking.user.name || booking.user.email.split("@")[0];
  const initial = report ? {
    photos: JSON.parse(report.photos || "[]"),
    items: JSON.parse(report.items || "[]"),
    notes: report.notes || "",
    staffName: report.staffName || "",
    signature: report.signature || "",
    acknowledged: report.depositStatus === "acknowledged",
    completedAt: report.completedAt ? report.completedAt.toISOString() : null,
  } : null;

  return (
    <>
      <AppHeader />
      <main className="co-main">
        <CheckinForm
          bookingId={booking.id}
          propertyName={property?.name || booking.propertySlug}
          guestName={guestName}
          stay={{ checkIn: fmt(booking.checkIn), checkOut: fmt(booking.checkOut), guests: booking.guests, checkInTime: property?.hours?.check_in }}
          initial={initial}
        />
      </main>
    </>
  );
}
