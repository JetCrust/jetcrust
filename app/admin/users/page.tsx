import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import UserRow from "../../components/UserRow";
import AddUser from "../../components/AddUser";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";

const ROLE_ORDER: Record<string, number> = { ADMIN: 0, MANAGER: 1, GUEST: 2 };

export default async function AdminUsers() {
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (!session) redirect("/account?next=/admin/users");
  if (me?.role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2><p className="lead">Only a Super Admin can manage users and access.</p></div></main></>);
  }

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const props = await getProperties(true);
  const propList = props.map((p) => ({ slug: p.slug, name: p.name }));
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const sorted = users.sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || (a.name || a.email).localeCompare(b.name || b.email));
  const staff = sorted.filter((u) => u.role !== "GUEST");
  const guests = sorted.filter((u) => u.role === "GUEST");

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Users &amp; access</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Make someone a Property Manager and assign the homes they look after. Super Admins see everything; managers see only their assigned properties.</p>
              </div>

              <AddUser properties={propList} />

              <div className="panel">
                <div className="panel__head"><h3>Team</h3></div>
                {staff.map((u) => (
                  <UserRow key={u.id} userId={u.id} email={u.email} name={u.name} role={u.role} managedSlugs={u.managedSlugs} properties={propList} isSelf={u.id === me.id} />
                ))}
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Guests</h3><span className="console__count">{guests.length}</span></div>
                <p className="panel__hint">Promote any guest to Property Manager here. They keep their existing login.</p>
                {guests.slice(0, 100).map((u) => (
                  <UserRow key={u.id} userId={u.id} email={u.email} name={u.name} role={u.role} managedSlugs={u.managedSlugs} properties={propList} isSelf={u.id === me.id} />
                ))}
                {guests.length > 100 && <p className="panel__hint">Showing the first 100 guests.</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
