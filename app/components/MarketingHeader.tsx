import Link from "next/link";
import { auth } from "@/auth";

// Transparent-over-hero header for the marketing pages (home + property pages).
// Scroll/solid + mobile-menu behaviour is wired by ClientInteractions.
export default async function MarketingHeader() {
  const session = await auth();
  const signedIn = !!session;
  return (
    <header className="site-header" id="header">
      <div className="wrap nav">
        <Link href="/" className="brand" aria-label="Jet Crust home">
          <span className="brand__mark">JET CRUST</span>
          <span className="brand__tag">Curated Luxury Rentals</span>
        </Link>
        <nav aria-label="Primary">
          <ul className="nav__menu" id="navMenu">
            <li><Link className="nav__link" href="/#collection">The Collection</Link></li>
            <li><Link className="nav__link" href="/#edge">Our Standard</Link></li>
            <li><Link className="nav__link" href="/#experiences">Experiences</Link></li>
            <li><Link className="nav__link" href="/#destinations">Destinations</Link></li>
            <li><Link className="nav__link" href="/journal">Journal</Link></li>
            <li><Link className="nav__link" href="/account">My Account</Link></li>
          </ul>
        </nav>
        <div className="nav__right">
          <Link className="nav__link" href="/account">{signedIn ? "My Account" : "Sign In"}</Link>
          <Link className="btn btn--brass nav__cta" href="/#collection">Book a Stay</Link>
          <button className="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  );
}
