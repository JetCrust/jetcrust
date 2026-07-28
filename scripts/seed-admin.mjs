// Create or update the admin account. Usage:
//   node scripts/seed-admin.mjs <email> <password>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = (process.argv[2] || "admin@jetcrust.com").toLowerCase();
const password = process.argv[3] || "changeme12345";

const passwordHash = await bcrypt.hash(password, 10);
const user = await prisma.user.upsert({
  where: { email },
  update: { role: "ADMIN", passwordHash },
  create: { email, name: "Jet Crust Admin", role: "ADMIN", passwordHash },
});
console.log("Admin ready:", user.email);
await prisma.$disconnect();
