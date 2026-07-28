"use client";
import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("jc-cookie-consent")) setShow(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const choose = (value: "essential" | "all") => {
    try {
      localStorage.setItem("jc-cookie-consent", value);
      localStorage.setItem("jc-cookie-consent-at", new Date().toISOString());
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <p>
        We use essential cookies to run the site and keep you signed in. With your consent we may also use analytics to
        improve it. Read our <a href="/cookies">Cookie Policy</a>.
      </p>
      <div className="cookie-banner__actions">
        <button className="btn btn--ghost-light" onClick={() => choose("essential")}>Essential only</button>
        <button className="btn btn--brass" onClick={() => choose("all")}>Accept all</button>
      </div>
    </div>
  );
}
