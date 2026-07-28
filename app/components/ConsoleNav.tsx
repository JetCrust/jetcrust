"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Left-hand admin menu: one place to reach everything on the back end.
const LINKS = [
  { href: "/admin", label: "Bookings", exact: true },
  { href: "/admin/calendar", label: "Calendar & sync" },
  { href: "/admin/finance", label: "Finance & P&L" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/properties", label: "Properties & pricing" },
];

export default function ConsoleNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="console__nav" aria-label="Admin">
      <span className="console__label">Manage</span>
      {LINKS.map((l) => {
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
