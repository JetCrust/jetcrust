"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Left-hand admin menu: one place to reach everything on the back end.
// `manager: true` links are also shown to Property Managers; the rest are
// Super-Admin only.
const LINKS = [
  { href: "/admin/overview", label: "Overview", manager: true },
  { href: "/admin", label: "Bookings", exact: true, manager: true },
  { href: "/admin/inbox", label: "Inbox", manager: true },
  { href: "/admin/guests", label: "Guests", manager: true },
  { href: "/admin/calendar", label: "Calendar & sync", manager: true },
  { href: "/admin/reports", label: "Reports & performance" },
  { href: "/admin/finance", label: "Finance & P&L" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/properties", label: "Properties & pricing" },
  { href: "/admin/users", label: "Users & access" },
];

export default function ConsoleNav({ pendingCount = 0, role = "ADMIN" }: { pendingCount?: number; role?: string }) {
  const pathname = usePathname();
  const links = role === "MANAGER" ? LINKS.filter((l) => l.manager) : LINKS;
  return (
    <nav className="console__nav" aria-label="Admin">
      <span className="console__label">{role === "MANAGER" ? "Property manager" : "Manage"}</span>
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`console__link${active ? " is-active" : ""}`}>
            <span>{l.label}</span>
            {l.href === "/admin" && pendingCount > 0 && <span className="console__count">{pendingCount}</span>}
          </Link>
        );
      })}
      <div className="console__sep" />
      <Link href="/" className="console__link">View site</Link>
    </nav>
  );
}
