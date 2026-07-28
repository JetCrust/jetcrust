import { prisma } from "./prisma";
import { stripe } from "./stripe";

// Every guest gets one account-level Stripe customer, created on first need.
// Saved cards live on this customer, so they can reuse them across bookings.
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
