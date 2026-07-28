import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import AccountNav from "../../components/AccountNav";
import ProfileForm from "../../components/ProfileForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountDetails() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/account?next=/account/details");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/account");

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <AccountNav />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Account</p>
                <h2>My details</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Your contact details and preferences. Used for your bookings and confirmations.</p>
              </div>

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head"><h3>Contact & preferences</h3></div>
                <ProfileForm initial={{ title: user.title || "", name: user.name || "", phone: user.phone || "", preferences: user.preferences || "", marketingOptIn: user.marketingOptIn }} />
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Sign-in</h3></div>
                <ul className="kv">
                  <li><span>Email</span><span>{user.email}</span></li>
                  <li><span>Member since</span><span>{new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></li>
                </ul>
                <p className="panel__hint" style={{ marginBottom: 0 }}>Your email is your sign-in. To change it, contact us and we will move your account across.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
