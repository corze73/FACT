import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { POLICY_LAST_UPDATED, POLICY_VERSION } from "@/lib/policyConstants";

const Section = ({ title, children }) => <section><h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2><div className="text-slate-700 space-y-2">{children}</div></section>;

export default function Terms() {
  const navigate = useNavigate();
  const back = () => window.history.length > 1 ? navigate(-1) : navigate(createPageUrl("Landing"));
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Button variant="ghost" size="sm" className="mb-4" onClick={back}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms and Conditions</h1>
        <p className="text-slate-600 mb-8">Version {POLICY_VERSION} · Last updated {POLICY_LAST_UPDATED}</p>
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-7">
          <Section title="1. Who we are and these Terms">
            <p>FACT: Find a Coach Today (“FACT”, “we”, “us”) operates an online marketplace connecting clients with independent football coaches. Contact us at <a className="text-blue-600 underline" href="mailto:support@findacoachtoday.com">support@findacoachtoday.com</a>.</p>
            <p>These Terms form the contract governing your FACT account and use of the platform. Each accepted booking also creates a service agreement between the client and the independent coach, subject to these Terms and the booking details.</p>
          </Section>
          <Section title="2. Eligibility and accounts">
            <ul className="list-disc ml-6 space-y-1">
              <li>Account holders must be at least 18. A parent or legal guardian must create the account, make the booking and supervise as appropriate for a player under 18.</li>
              <li>A child is added only as a participant managed by the responsible adult. Children do not receive login credentials, payment access or private coach messaging.</li>
              <li>You must give accurate information, protect your login details and tell us promptly about unauthorised use.</li>
              <li>You may not impersonate another person, evade a suspension or use FACT for unlawful, abusive or unsafe conduct.</li>
            </ul>
          </Section>
          <Section title="3. Coaches">
            <ul className="list-disc ml-6 space-y-1">
              <li>Coaches act independently and are responsible for delivering sessions with reasonable care and skill, maintaining suitable insurance, qualifications and required background checks.</li>
              <li>FACT verification indicates that submitted evidence passed our platform review at that time; it is not a guarantee of performance or future conduct.</li>
              <li>Coaches must follow the FACT Safeguarding Policy, respect professional boundaries and immediately report safeguarding concerns.</li>
              <li>Coaches must be at least 18 and complete Stripe identity and payout onboarding before receiving earnings.</li>
            </ul>
          </Section>
          <Section title="4. Bookings, prices and payment">
            <ul className="list-disc ml-6 space-y-1">
              <li>The coach’s session price and FACT’s £3 administration fee are shown before a booking request is sent.</li>
              <li>A booking is confirmed only when the coach accepts and payment succeeds. Stripe processes card payments; FACT does not store full card or coach bank details.</li>
              <li>FACT collects payment and holds coach earnings within the payment flow until the completion and dispute conditions shown in the platform are satisfied.</li>
              <li>Nothing in these Terms limits statutory consumer rights, including rights where a service is not provided with reasonable care and skill.</li>
            </ul>
          </Section>
          <Section title="5. Cancellation, refunds and no-shows">
            <p className="font-medium">The policy shown at booking applies:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Coach or FACT cancellation:</strong> the client receives a full refund, including the administration fee.</li>
              <li><strong>Client cancellation 48 hours or more before:</strong> the coaching fee is refunded; the £3 administration fee is retained.</li>
              <li><strong>Client cancellation 24–48 hours before:</strong> 50% of the coaching fee is refunded; the administration fee is retained.</li>
              <li><strong>Client cancellation less than 24 hours before:</strong> no refund is due, subject always to statutory rights and fair individual review.</li>
              <li><strong>Coach no-show:</strong> full client refund. FACT may apply a £3 coach administration charge and a verified strike; repeated no-shows may lead to suspension.</li>
              <li><strong>Client no-show:</strong> no refund is normally due and the coach’s earnings may be released.</li>
            </ul>
            <p>Tell FACT promptly if exceptional circumstances apply. We review disputes fairly, including whether avoided costs or a replacement booking affect any amount retained.</p>
          </Section>
          <Section title="6. Safety and safeguarding">
            <p>Use suitable venues, equipment and supervision. Do not attend where doing so would be unsafe. Report concerns through <Link className="text-blue-600 underline" to={createPageUrl("SafeguardingReport")}>Report Concern</Link>. In an emergency call 999. We may preserve evidence, restrict communication, suspend accounts or refer concerns to the police, social care, The FA or other appropriate bodies.</p>
          </Section>
          <Section title="7. Content, messages and reviews">
            <p>You retain ownership of content you submit and grant FACT a limited licence to store, display and process it to operate, secure and improve the service. Content must be lawful, accurate and respectful. We may moderate or remove content and retain relevant evidence for safety, disputes or legal compliance.</p>
          </Section>
          <Section title="8. Suspension and closure">
            <p>We may restrict or suspend an account where reasonably necessary for safety, suspected fraud, serious or repeated breaches, expired coach verification or legal compliance. Where appropriate we will explain the action and allow review; urgent safeguarding action may be immediate. You may request account closure from your profile.</p>
          </Section>
          <Section title="9. Liability">
            <p>Nothing excludes liability for death or personal injury caused by negligence, fraud, fraudulent misrepresentation, or anything else the law does not permit us to exclude. Subject to that, FACT is not responsible for losses that were not reasonably foreseeable or for business losses suffered by consumers. Coaches remain responsible for their coaching services.</p>
          </Section>
          <Section title="10. Complaints, law and changes">
            <p>Contact <a className="text-blue-600 underline" href="mailto:support@findacoachtoday.com">support@findacoachtoday.com</a> first so we can investigate. These Terms are governed by the laws of England and Wales, but consumers retain any mandatory protections and rights to bring proceedings available where they live.</p>
            <p>We may update these Terms for legal, safety or service changes. Material changes will be brought to account holders’ attention and, where required, fresh acceptance will be requested. The version accepted at booking remains recorded.</p>
          </Section>
          <div className="pt-4 border-t flex flex-wrap gap-4"><Link to={createPageUrl("PrivacyPolicy")} className="text-blue-600 hover:underline">Privacy Policy</Link><Link to={createPageUrl("SafeguardingPolicy")} className="text-blue-600 hover:underline">Safeguarding Policy</Link></div>
        </div>
      </div>
    </div>
  );
}
