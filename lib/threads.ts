import { prisma } from "./prisma";
import { getProperty } from "./properties";
import { sendEmail } from "./email";
import { newMessageEmail } from "./emails";

// Guest-level messaging helpers, shared by the client (/api/account/messages)
// and staff (/api/admin/guests/[userId]/messages) thread endpoints.

export const PRESENCE_MS = 2 * 60 * 1000;

export const touchSeen = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});

// The guest's most recent booking (optionally restricted to a manager's slugs).
// New guest-level messages anchor to this booking for context + scoping.
export async function mostRecentBooking(userId: string, slugs: string[] | null) {
  return prisma.booking.findFirst({
    where: { userId, ...(slugs ? { propertySlug: { in: slugs } } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

// Email the other party unless they appear to be online right now. Best-effort.
export async function notifyOtherParty(opts: {
  isAdmin: boolean;
  guest: { email: string; name: string | null; lastSeenAt: Date | null };
  propertySlug: string;
  bookingId: string;
  preview: string;
}): Promise<boolean> {
  const since = new Date(Date.now() - PRESENCE_MS);
  let to = "";
  let online = false;
  if (opts.isAdmin) {
    to = opts.guest.email;
    online = !!opts.guest.lastSeenAt && opts.guest.lastSeenAt > since;
  } else {
    to = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM || "";
    const active = await prisma.user.count({
      where: { lastSeenAt: { gt: since }, OR: [{ role: "ADMIN" }, { role: "MANAGER", managedSlugs: { has: opts.propertySlug } }] },
    });
    online = active > 0;
  }
  if (to && !online) {
    try {
      const property = await getProperty(opts.propertySlug);
      const mail = newMessageEmail({
        toGuest: opts.isAdmin,
        guestName: opts.guest.name || opts.guest.email.split("@")[0],
        propertyName: property?.name || opts.propertySlug,
        preview: opts.preview.slice(0, 140),
        bookingId: opts.bookingId,
      });
      await sendEmail({ to, subject: mail.subject, html: mail.html });
    } catch { /* email is best-effort */ }
  }
  return !online;
}

export const serializeMessages = (msgs: { id: string; sender: string; body: string; createdAt: Date }[]) =>
  msgs.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() }));
