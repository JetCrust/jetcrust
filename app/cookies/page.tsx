import type { Metadata } from "next";
import LegalLayout from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "Cookie Policy | Jet Crust",
  description: "How Jet Crust uses cookies and how you can manage them.",
};

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy" updated="18 July 2026">
      <p>
        Cookies are small files stored on your device that help a website work and remember your choices. This policy explains
        the cookies we use on jetcrust.com and how you can control them. It should be read with our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>The cookies we use</h2>
      <table>
        <thead>
          <tr><th>Type</th><th>Purpose</th><th>Consent</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Essential</td>
            <td>Keep you signed in (session), protect forms against cross-site request forgery, and remember your cookie choice.</td>
            <td>Not required (necessary for the service)</td>
          </tr>
          <tr>
            <td>Payment</td>
            <td>Set by Stripe during checkout to process your payment securely and prevent fraud.</td>
            <td>Necessary for payment</td>
          </tr>
          <tr>
            <td>Analytics (optional)</td>
            <td>If enabled, help us understand how the site is used so we can improve it.</td>
            <td>Only with your consent</td>
          </tr>
        </tbody>
      </table>
      <p>
        Today the site uses essential and payment cookies only. If we add analytics, they will run only after you accept them in
        the cookie banner.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can accept or limit non-essential cookies using the banner shown on your first visit. You can also block or delete
        cookies in your browser settings, though blocking essential cookies may stop parts of the site, such as signing in, from
        working. Guidance for common browsers is available in their help pages.
      </p>

      <h2>Third parties</h2>
      <p>
        Stripe may set cookies as part of processing payments and preventing fraud, under its own{" "}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener">privacy policy</a>.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update this policy and will post the new version here. Questions:{" "}
        <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a>.
      </p>
    </LegalLayout>
  );
}
