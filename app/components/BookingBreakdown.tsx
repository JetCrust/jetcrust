// Renders the price snapshot stored on a booking, so the guest and the host both
// see exactly how the total was built at the time of booking.
type RateLine = { kind: string; label: string; nights: number; rate: number; total: number };
type AddonLine = { value: string; title: string; unit: string; unitPrice: number; qty: number; total: number };
type DiscountLine = { label: string; pct: number; amount: number };
export type StoredBreakdown = {
  nights: number;
  rateLines: RateLine[];
  stayTotal: number;
  discountLines?: DiscountLine[];
  discountTotal?: number;
  addonLines: AddonLine[];
  addonsTotal: number;
  total: number;
  avgNightly: number;
};

const money = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

function unitLabel(unit: string) {
  return unit === "stay" ? "per stay" : unit === "day" ? "per day" : "per night";
}

export function parseBreakdown(s: string | null | undefined): StoredBreakdown | null {
  if (!s) return null;
  try {
    const b = JSON.parse(s) as StoredBreakdown;
    return Array.isArray(b?.rateLines) ? b : null;
  } catch {
    return null;
  }
}

export default function BookingBreakdown({
  breakdown,
  fallbackTotal,
}: {
  breakdown: StoredBreakdown | null;
  fallbackTotal: number;
}) {
  // Older bookings made before we stored the snapshot.
  if (!breakdown) {
    return (
      <div className="breakdown">
        <div className="breakdown__row breakdown__row--total">
          <span>Total</span>
          <span>{money(fallbackTotal)}</span>
        </div>
        <p className="breakdown__note">Itemised breakdown is not available for this booking.</p>
      </div>
    );
  }

  return (
    <div className="breakdown">
      {breakdown.rateLines.map((l, i) => (
        <div className="breakdown__row" key={i}>
          <span>
            {l.nights} × {l.label} <small>at {money(l.rate)}</small>
          </span>
          <span>{money(l.total)}</span>
        </div>
      ))}

      {(breakdown.discountLines?.length || 0) > 0 && (
        <>
          {breakdown.discountLines!.map((l, i) => (
            <div className="breakdown__row" key={`d${i}`} style={{ color: "var(--forest, #253026)" }}>
              <span>{l.label} <small>−{l.pct}%</small></span>
              <span>−{money(l.amount)}</span>
            </div>
          ))}
          <div className="breakdown__row breakdown__row--sub">
            <span>Stay subtotal</span>
            <span>{money(breakdown.stayTotal - (breakdown.discountTotal || 0))}</span>
          </div>
        </>
      )}

      {breakdown.addonLines.length > 0 && (breakdown.discountLines?.length || 0) === 0 && (
        <div className="breakdown__row breakdown__row--sub">
          <span>Stay subtotal</span>
          <span>{money(breakdown.stayTotal)}</span>
        </div>
      )}

      {breakdown.addonLines.map((l) => (
        <div className="breakdown__row" key={l.value}>
          <span>
            {l.title} <small>{money(l.unitPrice)} {unitLabel(l.unit)}{l.qty > 1 ? ` × ${l.qty}` : ""}</small>
          </span>
          <span>{money(l.total)}</span>
        </div>
      ))}

      <div className="breakdown__row breakdown__row--total">
        <span>Total</span>
        <span>{money(breakdown.total)}</span>
      </div>

      <p className="breakdown__note">
        {breakdown.nights} night{breakdown.nights === 1 ? "" : "s"} · average {money(breakdown.avgNightly)} per night
      </p>
    </div>
  );
}
