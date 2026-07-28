"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/account", label: "My bookings", exact: true },
  { href: "/account/details", label: "My details" },
  { href: "/account/billing", label: "Billing & cards" },
];

export default function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="console__nav" aria-label="Account">
      <span className="console__label">Account</span>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`console__link${active ? " is-active" : ""}`}>
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
