import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../../components/AppHeader";
import ConsoleNav from "../../../../components/ConsoleNav";
import PropertyEditor from "../../../../components/PropertyEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function EditProperty({ params }: { params: Promise<{ slug: string }> }) {
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
  const data = JSON.parse(row.data);

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <p style={{ margin: "0 0 1rem" }}><Link className="textlink" href="/admin/properties">&larr; All properties</Link></p>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin · Properties</p>
                <h2>{row.name}</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  {row.status === "live" ? "Live and public." : "Draft, hidden from the site."} Edit anything below, then save.
                  {" "}<Link className="textlink" href={`/${row.slug}`} target="_blank">View the page &rarr;</Link>
                </p>
              </div>
              <PropertyEditor initial={data} isNew={false} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
