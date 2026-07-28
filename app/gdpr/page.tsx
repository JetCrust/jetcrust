import type { Metadata } from "next";
import LegalLayout from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "GDPR & Your Rights | Jet Crust",
  description: "Your data protection rights under the GDPR and how to exercise them with Jet Crust.",
};

const PH = ({ children }: { children: React.ReactNode }) => <span className="placeholder">{children}</span>;

export default function Gdpr() {
  return (
    <LegalLayout title="GDPR & Your Rights" updated="18 July 2026">
      <p>
        We are committed to protecting your personal data in line with the EU General Data Protection Regulation (GDPR) and
        Romanian data protection law. This page summarises your rights and how to exercise them. For full detail on what we
        collect and why, see our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Who is responsible</h2>
      <p>
        The data controller is <PH>[Company legal name]</PH>, trading as Jet Crust, <PH>[registered address]</PH>, company
        number <PH>[registration number]</PH>. Contact: <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a>.
        <PH>[If you appoint a Data Protection Officer, add their contact here.]</PH>
      </p>

      <h2>The legal bases we rely on</h2>
      <ul>
        <li>Performance of a contract, to provide bookings, accounts and payments.</li>
        <li>Legal obligation, to keep booking, agreement and tax records.</li>
        <li>Legitimate interests, to secure and improve the service and keep evidence of agreements.</li>
        <li>Consent, for marketing and any optional analytics, which you may withdraw at any time.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access</strong> — a copy of the personal data we hold about you.</li>
        <li><strong>Rectification</strong> — correction of inaccurate or incomplete data.</li>
        <li><strong>Erasure</strong> — deletion of your data where there is no overriding legal reason to keep it.</li>
        <li><strong>Restriction</strong> — to limit how we use your data in certain cases.</li>
        <li><strong>Portability</strong> — to receive your data in a portable format, or have it sent to another provider.</li>
        <li><strong>Objection</strong> — to object to processing based on legitimate interests, and to direct marketing at any time.</li>
        <li><strong>Withdraw consent</strong> — where we rely on consent, at any time, without affecting prior processing.</li>
      </ul>

      <h2>How to exercise your rights</h2>
      <p>
        Email <a href="mailto:contact@jetcrust.com">contact@jetcrust.com</a> with your request. We may need to verify your
        identity. We will respond within one month, and will tell you if we need more time for a complex request. Exercising your
        rights is free unless a request is manifestly unfounded or excessive.
      </p>

      <h2>International transfers</h2>
      <p>
        Some of our providers may process data outside the European Economic Area. Where they do, we rely on appropriate
        safeguards such as the European Commission&apos;s Standard Contractual Clauses.
      </p>

      <h2>How long we keep your data</h2>
      <p>
        We keep account data while your account is active, and booking and agreement records for <PH>[retention period]</PH> to
        meet legal and tax obligations, after which they are deleted or anonymised.
      </p>

      <h2>Complaints</h2>
      <p>
        If you are concerned about how we handle your data, please contact us first so we can help. You also have the right to
        lodge a complaint with the Romanian supervisory authority, the National Supervisory Authority for Personal Data
        Processing (ANSPDCP), at <a href="https://www.dataprotection.ro" target="_blank" rel="noopener">dataprotection.ro</a>.
      </p>
    </LegalLayout>
  );
}
