import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import AccountNav from "../../components/AccountNav";
import MessageThread from "../../components/MessageThread";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serializeMessages } from "@/lib/threads";

export default async function AccountMessages() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/account?next=/account/messages");

  const [messages, bookingCount] = await Promise.all([
    prisma.message.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.booking.count({ where: { userId } }),
  ]);

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
                <h2>Messages</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Your direct line to our team — one conversation across every stay. We reply here and by email.</p>
              </div>

              <div className="panel">
                {bookingCount === 0 ? (
                  <p style={{ color: "var(--stone)", margin: 0 }}>Once you have a booking with us, your conversation with our team lives here. To reach us in the meantime, email <a className="textlink" href="mailto:contact@jetcrust.com">contact@jetcrust.com</a>.</p>
                ) : (
                  <MessageThread
                    endpoint="/api/account/messages"
                    me="GUEST"
                    messages={serializeMessages(messages)}
                    placeholder="No messages yet. Ask us anything — arrival, the home, local plans, or your next stay."
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
