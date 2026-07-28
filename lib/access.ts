import { auth } from "@/auth";
import { prisma } from "./prisma";

// Staff = Super Admin (ADMIN, sees everything) or Property Manager (MANAGER,
// scoped to assigned property slugs). `slugs === null` means all properties.
export type StaffScope = { userId: string; isSuper: boolean; slugs: string[] | null };

export async function staffScope(): Promise<StaffScope | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return null;
  if (u.role === "ADMIN") return { userId: u.id, isSuper: true, slugs: null };
  if (u.role === "MANAGER") {
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { managedSlugs: true } });
    return { userId: u.id, isSuper: false, slugs: dbUser?.managedSlugs ?? [] };
  }
  return null;
}

// Prisma where-fragment that limits by property when the viewer is scoped.
export function slugFilter(scope: StaffScope): { propertySlug?: { in: string[] } } {
  return scope.slugs ? { propertySlug: { in: scope.slugs } } : {};
}

// Can this scope act on a given property?
export function canAccessProperty(scope: StaffScope, slug: string): boolean {
  return scope.isSuper || (scope.slugs?.includes(slug) ?? false);
}
