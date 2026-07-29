"use client";
import { useState } from "react";
import Link from "next/link";
import AvailabilityCalendar from "./AvailabilityCalendar";

const DAY = 86400000;

// Property-page availability preview: see open dates, pick a range, and carry it
// straight into the booking flow.
export default function PropertyAvailability({ slug, blocked, minNights }: { slug: string; blocked: string[]; minNights: number }) {
  const [sel, setSel] = useState({ checkIn: "", checkOut: "" });
  const nights = sel.checkIn && sel.checkOut ? Math.round((new Date(sel.checkOut + "T00:00:00Z").getTime() - new Date(sel.checkIn + "T00:00:00Z").getTime()) / DAY) : 0;
  const ready = !!(sel.checkIn && sel.checkOut) && nights >= minNights;
  const href = ready ? `/book/${slug}?checkIn=${sel.checkIn}&checkOut=${sel.checkOut}` : `/book/${slug}`;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius,16px)", padding: "clamp(1.2rem,3vw,1.8rem)" }}>
      <AvailabilityCalendar blocked={blocked} months={2} minNights={minNights} onSelect={(ci, co) => setSel({ checkIn: ci, checkOut: co })} />
      <div style={{ borderTop: "1px solid var(--line)", marginTop: "1rem", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <span style={{ color: "var(--ink-soft)", fontSize: "0.92rem" }}>
          {sel.checkIn && sel.checkOut
            ? (ready ? `${sel.checkIn} to ${sel.checkOut} · ${nights} nights` : `Minimum stay is ${minNights} nights`)
            : "Pick your dates to check the price."}
        </span>
        <Link className="btn btn--brass" href={href} style={{ flex: "0 0 auto" }}>{ready ? "Reserve these dates" : "Continue to booking"}</Link>
      </div>
    </div>
  );
}
