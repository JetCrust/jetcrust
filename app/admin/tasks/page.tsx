import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import TasksBoard from "../../components/TasksBoard";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { opsScope, slugFilter } from "@/lib/access";

export default async function AdminTasks() {
  const scope = await opsScope();
  if (!scope) redirect("/account?next=/admin/tasks");
  const sf = slugFilter(scope);

  // Workers only need the count if they can see it; keep it cheap and scoped.
  const pendingCount = scope.isWorker ? 0 : await prisma.booking.count({ where: { status: "REQUESTED", ...sf } });
  const tasks = await prisma.task.findMany({
    where: {
      ...(scope.slugs ? { propertySlug: { in: scope.slugs } } : {}),
      // A worker sees jobs assigned to them or still unassigned at their property.
      ...(scope.isWorker ? { OR: [{ assignedToId: scope.userId }, { assignedToId: null }] } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const allProps = await getProperties(true);
  const properties = (scope.slugs ? allProps.filter((p) => scope.slugs!.includes(p.slug)) : allProps).map((p) => ({ slug: p.slug, name: p.name }));
  const staff = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER", "STAFF"] } }, select: { id: true, name: true, email: true, phone: true } });

  const serialized = tasks.map((t) => ({
    id: t.id, propertySlug: t.propertySlug, title: t.title, category: t.category, status: t.status,
    dueAt: t.dueAt ? t.dueAt.toISOString().slice(0, 10) : null, assignedToId: t.assignedToId, notes: t.notes,
  }));

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.isSuper ? "ADMIN" : scope.isWorker ? "STAFF" : "MANAGER"} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Operations</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>{scope.isWorker ? "My tasks" : "Tasks"}</h2>
                <p className="lead" style={{ marginBottom: 0 }}>{scope.isWorker ? "Your jobs for the properties you cover. Start one to claim it, mark it done when finished." : "Turnovers, cleaning, maintenance and inspections — assign them to the team and track them to done."}</p>
              </div>
              <TasksBoard
                tasks={serialized}
                properties={properties}
                staff={staff.map((s) => ({ id: s.id, name: s.name || s.email.split("@")[0], phone: s.phone }))}
                isWorker={scope.isWorker}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
