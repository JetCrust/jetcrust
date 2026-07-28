import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import AccountNav from "../../components/AccountNav";
import BillingForm from "../../components/BillingForm";
import SavedCards from "../../components/SavedCards";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountBilling() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/account?next=/account/billing");
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
                <h2>Billing & cards</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Save your billing address and cards to check out faster. We never see your full card number; it is held securely by Stripe.</p>
              </div>

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head"><h3>Saved cards</h3></div>
                <SavedCards />
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Billing address</h3></div>
                <BillingForm
                  initial={{
                    billingName: user.billingName || "",
                    billingLine1: user.billingLine1 || "",
                    billingLine2: user.billingLine2 || "",
                    billingCity: user.billingCity || "",
                    billingPostcode: user.billingPostcode || "",
                    billingCountry: user.billingCountry || "",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
