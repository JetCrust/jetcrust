import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="brand__mark">JET CRUST</span>
            <p>Curated luxury rentals where Transylvanian legend meets private sanctuary. Selected in person, hosted with care.</p>
          </div>
          <div className="footer__col"><h5>Discover</h5><ul>
            <li><Link href="/#collection">The Collection</Link></li>
            <li><Link href="/castelaria">Castelaria</Link></li>
            <li><Link href="/marque-de-lago">MarqueDeLago</Link></li>
            <li><Link href="/soho-place">Soho Place</Link></li>
            <li><Link href="/destinations">Destinations</Link></li>
            <li><Link href="/journal">The Journal</Link></li>
          </ul></div>
          <div className="footer__col"><h5>Visit</h5><ul>
            <li><a href="tel:+40770111555">+40 770 111 555</a></li>
            <li><a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a></li>
            <li>Bran · Bucharest</li>
          </ul></div>
          <div className="footer__col footer__news"><h5>The Journal</h5>
            <p>Seasonal itineraries and quiet luxury, a few times a year. No noise.</p>
            <form className="footer__form" id="newsForm"><input type="email" placeholder="Your email" aria-label="Your email" /><button type="submit">Join</button></form>
          </div>
        </div>
        <div className="footer__bottom">
          <span>&copy; <span id="year"></span> Jet Crust. All rights reserved.</span>
          <div className="footer__social">
            <a href="https://instagram.com/jet.crust" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://www.facebook.com/jet.crust" target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href="https://es.pinterest.com/jetcrust/" target="_blank" rel="noopener noreferrer">Pinterest</a>
            <a href="https://www.tiktok.com/@jet.crust" target="_blank" rel="noopener noreferrer">TikTok</a>
          </div>
          <div className="footer__legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/gdpr">GDPR</Link></div>
        </div>
      </div>
    </footer>
  );
}
