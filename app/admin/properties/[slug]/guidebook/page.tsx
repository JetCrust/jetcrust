import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../../components/AppHeader";
import ConsoleNav from "../../../../components/ConsoleNav";
import GuidebookEditor from "../../../../components/GuidebookEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function EditGuidebook({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/properties");
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
  const { slug } = await params;
  const row = await prisma.property.findUnique({ where: { slug } });
  if (!row) notFound();
  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const data = JSON.parse(row.data) as Record<string, unknown>;

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <p style={{ margin: "0 0 1rem" }}><Link className="textlink" href={`/admin/properties/${slug}/edit`}>&larr; Back to {row.name}</Link></p>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin · Guidebook</p>
                <h2>{row.name} — digital guidebook</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  Build the mobile guidebook guests open before and during their stay. Big tappable sections, in order.
                  Add photos and paste a Vimeo/YouTube link for anything worth showing.
                </p>
              </div>
              <GuidebookEditor slug={slug} property={data} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
