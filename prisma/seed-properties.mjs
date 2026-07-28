// Import the data/*.json property files into the database (one-time migration,
// and safe to re-run: it upserts by slug). After this the app reads properties
// from the DB, and new/edited homes are managed from the admin.
//   node prisma/seed-properties.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("README"));
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    if (!data.slug) { console.log(`skip (no slug): ${f}`); continue; }
    await prisma.property.upsert({
      where: { slug: data.slug },
      update: {
        status: data.status || "live",
        order: data.order ?? 99,
        name: data.name || data.slug,
        location: data.location || "",
        data: JSON.stringify(data),
      },
      create: {
        slug: data.slug,
        status: data.status || "live",
        order: data.order ?? 99,
        name: data.name || data.slug,
        location: data.location || "",
        data: JSON.stringify(data),
      },
    });
    console.log(`imported: ${data.slug} (${data.name})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
