import { auth } from "@/auth";
import { prisma } from "./prisma";

// Back-office roles:
//  ADMIN   — Super Admin: everything, all properties, all settings.
//  OPS     — Operations: all properties and all day-to-day work (bookings,
//            check-in/out, deposits, extras, tasks, leads), but NO structural
//            settings (pricing, properties, add-on catalog, users, journal,
//            finance). `slugs === null` (all properties), but isSuper is false.
//  MANAGER — Property Manager: operational, scoped to assigned property slugs.
//  STAFF   — Worker: the tasks board only, scoped to assigned properties.
export type StaffScope = { userId: string; role: string; isSuper: boolean; slugs: string[] | null };

export async function staffScope(): Promise<StaffScope | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return null;
  if (u.role === "ADMIN") return { userId: u.id, role: "ADMIN", isSuper: true, slugs: null };
  if (u.role === "OPS") return { userId: u.id, role: "OPS", isSuper: false, slugs: null };
  if (u.role === "MANAGER") {
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { managedSlugs: true } });
    return { userId: u.id, role: "MANAGER", isSuper: false, slugs: dbUser?.managedSlugs ?? [] };
  }
  return null;
}

// Operations scope: like staffScope but also lets a STAFF worker in, limited to
// their assigned properties. Used by the tasks board — STAFF get no other admin
// access. `isWorker` is true for STAFF (a read-mostly, mark-done view).
export type OpsScope = StaffScope & { isWorker: boolean };

export async function opsScope(): Promise<OpsScope | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return null;
  if (u.role === "ADMIN") return { userId: u.id, role: "ADMIN", isSuper: true, slugs: null, isWorker: false };
  if (u.role === "OPS") return { userId: u.id, role: "OPS", isSuper: false, slugs: null, isWorker: false };
  if (u.role === "MANAGER" || u.role === "STAFF") {
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { managedSlugs: true } });
    return { userId: u.id, role: u.role, isSuper: false, slugs: dbUser?.managedSlugs ?? [], isWorker: u.role === "STAFF" };
  }
  return null;
}

// True for the roles allowed to run day-to-day booking operations (not just view).
export async function isOpsOrAdmin(): Promise<boolean> {
  const session = await auth();
  const r = (session?.user as { role?: string } | undefined)?.role;
  return r === "ADMIN" || r === "OPS";
}

// Prisma where-fragment that limits by property when the viewer is scoped.
export function slugFilter(scope: StaffScope): { propertySlug?: { in: string[] } } {
  return scope.slugs ? { propertySlug: { in: scope.slugs } } : {};
}

// Can this scope act on a given property? (slugs === null means all properties.)
export function canAccessProperty(scope: StaffScope, slug: string): boolean {
  return scope.isSuper || scope.slugs === null || scope.slugs.includes(slug);
}
