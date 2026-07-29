import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

// Solid header for interior app pages (account, book, admin).
export default async function AppHeader() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return (
    <header className="site-header app" id="header">
      <div className="wrap nav">
        <Link href="/" className="brand" aria-label="Jet Crust home">
          <span className="brand__mark">JET CRUST</span>
          <span className="brand__tag">Curated Luxury Rentals</span>
        </Link>
        <nav aria-label="Primary">
          <ul className="nav__menu">
            <li><Link className="nav__link" href="/#collection">The Collection</Link></li>
            {session && <li><Link className="nav__link" href="/account">My Bookings</Link></li>}
            {(role === "ADMIN" || role === "MANAGER") && <li><Link className="nav__link" href="/admin">Console</Link></li>}
            {role === "STAFF" && <li><Link className="nav__link" href="/admin/tasks">My Tasks</Link></li>}
          </ul>
        </nav>
        <div className="nav__right">
          {session ? <SignOutButton /> : <Link className="nav__link" href="/account">Sign In</Link>}
        </div>
      </div>
    </header>
  );
}
