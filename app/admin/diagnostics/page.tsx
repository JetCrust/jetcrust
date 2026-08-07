import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const keyMode = (k: string, live: string, test: string) => (k.startsWith(live) ? "live" : k.startsWith(test) ? "test" : k ? "other" : "missing");

function Row({ ok, label, detail, warn }: { ok: boolean; label: string; detail: string; warn?: boolean }) {
  const color = ok ? "var(--forest, #253026)" : warn ? "#9a7b3f" : "#a3412e";
  return (
    <li style={{ display: "flex", gap: "0.8rem", alignItems: "baseline", padding: "0.6rem 0", borderTop: "1px solid var(--line)" }}>
      <span style={{ color, fontWeight: 700, flex: "0 0 auto" }}>{ok ? "✓" : warn ? "!" : "✕"}</span>
      <span style={{ flex: 1 }}><strong>{label}</strong><br /><span className="panel__hint" style={{ margin: 0 }}>{detail}</span></span>
    </li>
  );
}

export default async function Diagnostics() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/diagnostics");
  if (role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main></>);
  }

  const sk = process.env.STRIPE_SECRET_KEY || "";
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const skMode = keyMode(sk, "sk_live_", "sk_test_");
  const pkMode = keyMode(pk, "pk_live_", "pk_test_");

  // Live Stripe check: retrieve the account behind the secret key.
  let acct: { charges: boolean; details: boolean; country?: string | null; currency?: string | null } | null = null;
  let stripeError: string | null = null;
  if (sk) {
    try {
      // Retrieve the account behind the key (current-account endpoint).
      const a = await (stripe.accounts.retrieve as (opts?: unknown) => Promise<{ charges_enabled?: boolean; details_submitted?: boolean; country?: string | null; default_currency?: string | null }>)();
      acct = { charges: !!a.charges_enabled, details: !!a.details_submitted, country: a.country, currency: a.default_currency };
    } catch (e) { stripeError = e instanceof Error ? e.message : "Unknown Stripe error"; }
  }

  let dbOk = true;
  try { await prisma.property.count(); } catch { dbOk = false; }

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } }).catch(() => 0);

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>System check</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Live status of payments, email, storage and the database in production. Keys are never shown, only whether they are set and in live mode.</p>
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Payments (Stripe)</h3></div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <Row ok={skMode === "live"} warn={skMode === "test"} label="Secret key" detail={skMode === "live" ? "Set and in live mode (sk_live_)." : skMode === "test" ? "Set but in TEST mode (sk_test_). Swap to the sk_live_ key in Vercel → Production, then redeploy." : skMode === "missing" ? "MISSING. Add STRIPE_SECRET_KEY (sk_live_…) in Vercel → Production, then redeploy." : "Set but not a recognised Stripe key."} />
                  <Row ok={pkMode === "live"} warn={pkMode === "test"} label="Publishable key" detail={pkMode === "live" ? "Set and in live mode (pk_live_)." : pkMode === "missing" ? "MISSING." : "In test mode (pk_test_)."} />
                  <Row ok={skMode === pkMode && skMode === "live"} label="Keys match mode" detail={skMode === pkMode ? "Secret and publishable keys are the same mode." : "MISMATCH: one key is live and the other is test. Both must be live."} />
                  {sk && (
                    <Row ok={!!acct && acct.charges && !stripeError} warn={!!acct && !acct.charges} label="Stripe account activated"
                      detail={stripeError ? `Stripe rejected the key: ${stripeError}` : acct ? (acct.charges ? `Live charges enabled. Country ${acct.country}, currency ${acct.currency?.toUpperCase()}.` : "Account NOT yet enabled for live charges — finish activation in Stripe (Dashboard → Activate/Complete your profile).") : "Could not reach Stripe."} />
                  )}
                </ul>
                <p className="panel__hint" style={{ marginTop: "0.8rem", marginBottom: 0 }}>
                  {skMode === "live" && acct?.charges ? "Payments are correctly configured. If a booking still fails, check Vercel → Logs for “Booking creation failed”." : "Fix the red items above, then redeploy and refresh this page."}
                </p>
              </div>

              <div className="panel" style={{ marginTop: "1.4rem" }}>
                <div className="panel__head"><h3>Other services</h3></div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <Row ok={dbOk} label="Database" detail={dbOk ? "Connected." : "Cannot reach the database."} />
                  <Row ok={!!process.env.RESEND_API_KEY} warn={!process.env.RESEND_API_KEY} label="Email (Resend)" detail={process.env.RESEND_API_KEY ? "Configured — confirmations and alerts will send." : "No RESEND_API_KEY — emails won't send (bookings still work)."} />
                  <Row ok={!!process.env.BLOB_READ_WRITE_TOKEN} warn={!process.env.BLOB_READ_WRITE_TOKEN} label="Photo storage (Blob)" detail={process.env.BLOB_READ_WRITE_TOKEN ? "Configured — photo uploads work." : "No BLOB_READ_WRITE_TOKEN — photo uploads will fail."} />
                  <Row ok={!!process.env.CRON_SECRET} warn={!process.env.CRON_SECRET} label="Scheduled jobs" detail={process.env.CRON_SECRET ? "Cron secret set — OTA sync, balance charges and follow-ups run." : "No CRON_SECRET — scheduled jobs are unprotected/disabled."} />
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
