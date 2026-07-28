// Create two test logins for local play: one client, one admin.
// Idempotent: updates the password/role if they already exist.
//   node prisma/seed-users.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "guest@jetcrust.com", name: "Test Guest", password: "Guest1234", role: "GUEST" },
  { email: "admin@jetcrust.com", name: "Jet Crust Admin", password: "Admin1234", role: "ADMIN" },
];

async function main() {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, name: u.name },
      create: { email: u.email, name: u.name, passwordHash, role: u.role },
    });
    console.log(`ready: ${u.email} / ${u.password}  (${u.role})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
