import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function GuestsList() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin");
  if (role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main></>);
  }

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const users = await prisma.user.findMany({
    where: { role: "GUEST" },
    include: { bookings: { select: { status: true, amountCents: true, checkIn: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = users.map((u) => {
    const approved = u.bookings.filter((b) => b.status === "APPROVED");
    const spend = approved.reduce((s, b) => s + b.amountCents, 0);
    const last = u.bookings.length ? u.bookings.reduce((a, b) => (b.checkIn > a ? b.checkIn : a), u.bookings[0].checkIn) : null;
    return { u, count: u.bookings.length, confirmed: approved.length, spend, last };
  }).sort((a, b) => (b.last?.getTime() || 0) - (a.last?.getTime() || 0));

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
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Guests</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Everyone with an account. Click a guest for their full history, preferences and lifetime value.</p>
              </div>
              <div className="panel">
                <div className="panel__head"><h3>All guests</h3><span className="console__count">{rows.length}</span></div>
                {rows.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No guests yet.</p> : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ledger">
                      <thead><tr><th>Guest</th><th>Email</th><th>Bookings</th><th>Confirmed spend</th><th>Last stay</th></tr></thead>
                      <tbody>
                        {rows.map(({ u, count, confirmed, spend, last }) => (
                          <tr key={u.id}>
                            <td><Link className="textlink" href={`/admin/guests/${u.id}`}>{[u.title, u.name].filter(Boolean).join(" ") || u.email.split("@")[0]}</Link></td>
                            <td>{u.email}</td>
                            <td>{count}{confirmed !== count ? ` (${confirmed} confirmed)` : ""}</td>
                            <td>{money(spend)}</td>
                            <td>{last ? fmt(last) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
