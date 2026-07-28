import type { Metadata } from "next";
import LegalLayout from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions | Jet Crust",
  description: "The terms that govern the use of Jet Crust and bookings made through it.",
};

const PH = ({ children }: { children: React.ReactNode }) => <span className="placeholder">{children}</span>;

export default function Terms() {
  return (
    <LegalLayout title="Terms & Conditions" updated="18 July 2026">
      <p>
        These terms govern your use of jetcrust.com and any booking you make through it with <PH>[Company legal name]</PH>,
        trading as Jet Crust. By using the site or requesting a booking, you agree to these terms. Each stay is also subject to
        the rental agreement you accept at the time of booking; if the two differ, the rental agreement applies to that stay.
      </p>

      <h2>1. Our collection</h2>
      <p>We present a curated collection of properties. We take care to describe each home accurately, but photographs and
        descriptions are indicative and features may change. Prices, availability and details may be updated at any time.</p>

      <h2>2. Bookings are requests</h2>
      <p>When you submit a booking you are making a request, not a confirmed reservation. A booking is confirmed only when we
        approve it in writing. We may decline any request at our discretion. You must create an account and accept the rental
        agreement to request a booking.</p>

      <h2>3. Prices</h2>
      <p>Prices are shown per stay for the dates you select and are quoted in euros. Nightly rates vary by season, by weekend,
        and by demand, and the total for your dates is shown before you book. Any applicable taxes, tourist fees, cleaning or
        add-on charges are <PH>[described here / added at checkout]</PH>.</p>

      <h2>4. Payment, holds and charges</h2>
      <p>When you request a booking, your card is authorized (a hold is placed) for the total shown, through our payment
        processor Stripe. Your card is charged only if and when we approve the booking. If we decline, the hold is released and
        you are not charged. Card authorizations typically last around seven days; if we cannot approve within that period the
        hold may lapse and you may be asked to authorize again.</p>

      <h2>5. Cancellations and changes</h2>
      <p>You may cancel a pending request at any time from your account, which releases the hold. For confirmed bookings, our
        cancellation policy is: <PH>[state your cancellation terms, e.g. free cancellation up to 30 days before arrival; the
        stay is non-refundable within 30 days]</PH>. In cases of force majeure we will work with you in good faith to reschedule
        or refund where appropriate.</p>

      <h2>6. Your stay</h2>
      <ul>
        <li>Only the number of guests stated may stay at the property.</li>
        <li>The property may not be used for events, parties or commercial activity without our prior written consent.</li>
        <li>You agree to follow the house rules provided on arrival and to treat the property and its contents with care.</li>
        <li>You are responsible for damage caused during your stay beyond fair wear and tear.</li>
        <li>Check-in and check-out times are as shown for the property unless agreed otherwise in writing.</li>
      </ul>

      <h2>7. Add-ons and experiences</h2>
      <p>Additional services such as a private chef, spa, or mountain adventures are subject to availability and may be provided
        by third parties under their own terms. Prices for add-ons are confirmed with you before they are arranged.</p>

      <h2>8. Liability</h2>
      <p>To the extent permitted by law, we are not liable for indirect or consequential loss, or for personal injury, loss or
        damage to belongings, except where caused by our negligence. Nothing in these terms limits liability that cannot be
        limited by law.</p>

      <h2>9. Intellectual property</h2>
      <p>The Jet Crust name, site, text and photography are owned by us or our licensors and may not be copied or used without
        permission.</p>

      <h2>10. Privacy</h2>
      <p>We handle your data as described in our <a href="/privacy">Privacy Policy</a>.</p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of Romania, and disputes are subject to the courts of <PH>[jurisdiction, e.g.
        Bucharest]</PH>, without affecting any consumer rights you have under mandatory law.</p>

      <h2>12. Changes and contact</h2>
      <p>We may update these terms and will post the new version here. Questions: <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a>.</p>
    </LegalLayout>
  );
}
