import type { Metadata } from "next";
import LegalLayout from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Jet Crust",
  description: "How Jet Crust collects, uses and protects your personal data.",
};


export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="18 July 2026">
      <p>
        This Privacy Policy explains how Astoria Of AG SRL, trading as Jet Crust (&quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;), collects, uses and protects your personal data when you use jetcrust.com and book a stay with us.
        We are the data controller. You can reach us at <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a> or
        +40 770 111 555. Our registered address is Calea Bucurestilor Nr. 78, Parter, 075100 Otopeni, Romania.
      </p>

      <h2>The data we collect</h2>
      <h3>Account</h3>
      <p>When you create an account: your name, email address and a securely hashed password. We never store your password in readable form.</p>
      <h3>Bookings</h3>
      <p>When you request a booking: the property, dates, number of guests, any add-ons you choose, and any notes you provide.</p>
      <h3>Payments</h3>
      <p>
        Payments are processed by Stripe. Your card is authorized (held) when you request a booking and charged only if we
        approve it. We do not receive or store your full card details. Stripe processes them as an independent controller under
        its own <a href="https://stripe.com/privacy" target="_blank" rel="noopener">privacy policy</a>.
      </p>
      <h3>Your agreement</h3>
      <p>
        When you accept our rental agreement we record the version accepted, the date and time, your IP address and your browser
        user-agent, as evidence of the agreement.
      </p>
      <h3>Communications and technical data</h3>
      <p>
        Emails and messages you send us, and technical information such as your device, browser and log data, and the cookies
        described in our <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>How we use your data, and our legal bases</h2>
      <ul>
        <li>To provide the booking service and manage your account and stay. Legal basis: performance of a contract.</li>
        <li>To take payment through Stripe. Legal basis: performance of a contract.</li>
        <li>To keep a record of your acceptance of the rental agreement. Legal basis: legitimate interests and legal obligation.</li>
        <li>To communicate with you about your enquiry, request or stay. Legal basis: performance of a contract and legitimate interests.</li>
        <li>To secure, operate and improve the site. Legal basis: legitimate interests.</li>
        <li>To send occasional marketing (the Journal) if you sign up. Legal basis: consent, which you can withdraw at any time.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We share your data only as needed to run the service, with providers acting on our instructions:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Resend</strong> — sending booking and account emails.</li>
        <li><strong>Vercel</strong> — website hosting.</li>
        <li><strong>Supabase</strong> — database hosting.</li>
        <li>Concierge or experience partners, only where you request an add-on that requires it.</li>
        <li>Professional advisers or authorities, where required by law.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>International transfers</h2>
      <p>
        Some providers may process data outside the European Economic Area. Where they do, we rely on appropriate safeguards such
        as the European Commission&apos;s Standard Contractual Clauses.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account data while your account is active. We keep booking and agreement records for as long as needed to provide our services, and financial records for 10 years as required by Romanian accounting law{" "}
        to meet legal, tax and accounting obligations, after which they are deleted or anonymised.
      </p>

      <h2>Your rights</h2>
      <p>Under the GDPR you have the right to access, correct, erase, restrict or object to the processing of your data, to data
        portability, and to withdraw consent. See our <a href="/gdpr">GDPR page</a> for how to exercise these rights and how to
        complain to the Romanian supervisory authority.</p>

      <h2>Security</h2>
      <p>We protect your data with hashed passwords, encryption in transit, and access controls. No system is perfectly secure,
        but we take reasonable measures to keep your information safe.</p>

      <h2>Children</h2>
      <p>Our service is intended for adults. It is not directed at anyone under 18.</p>

      <h2>Changes and contact</h2>
      <p>We may update this policy from time to time and will post the new version here. For any privacy question, contact us at{" "}
        <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a>.</p>
    </LegalLayout>
  );
}
