import { redirect } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import ConsoleNav from "../../../components/ConsoleNav";
import PropertyEditor from "../../../components/PropertyEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blankProperty } from "@/lib/property-template";

export default async function NewProperty() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/properties/new");
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
  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin · Properties</p>
                <h2>Add a property</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Fill in the essentials and save as a draft. It stays hidden until you publish it. Tip: duplicating an existing home is often the fastest start.</p>
              </div>
              <PropertyEditor initial={blankProperty()} isNew />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
