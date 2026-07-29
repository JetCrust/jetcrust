import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { sendEmail } from "@/lib/email";

// Public inquiry capture: a prospective guest asks about a stay. Creates a lead
// (linked to their account if the email already exists) and alerts the team.
const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  propertySlug: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.number().int().min(1).max(60).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please add your name and a way to reach you." }, { status: 400 });
  const d = parsed.data;
  const email = d.email || undefined;

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const lead = await prisma.lead.create({
    data: {
      name: d.name.trim(), email, phone: d.phone?.trim() || null,
      propertySlug: d.propertySlug || null, source: "WEB", message: d.message?.trim() || null,
      checkIn: d.checkIn ? new Date(d.checkIn + "T00:00:00Z") : null,
      checkOut: d.checkOut ? new Date(d.checkOut + "T00:00:00Z") : null,
      guests: d.guests || null, userId: user?.id || null,
    },
  });

  try {
    const to = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM;
    if (to) {
      const property = d.propertySlug ? await getProperty(d.propertySlug) : null;
      await sendEmail({
        to,
        subject: `New inquiry: ${d.name}${property ? ` · ${property.name}` : ""}`,
        html: `<p><strong>${d.name}</strong> made an inquiry.</p>
          <p>${email ? `Email: ${email}<br>` : ""}${d.phone ? `Phone: ${d.phone}<br>` : ""}${property ? `Property: ${property.name}<br>` : ""}${d.checkIn ? `Dates: ${d.checkIn} to ${d.checkOut || "?"}<br>` : ""}${d.guests ? `Guests: ${d.guests}<br>` : ""}</p>
          ${d.message ? `<p>&ldquo;${d.message}&rdquo;</p>` : ""}
          <p>Work it in the console: Leads.</p>`,
      });
    }
  } catch { /* alert best-effort */ }

  return NextResponse.json({ ok: true, id: lead.id });
}
