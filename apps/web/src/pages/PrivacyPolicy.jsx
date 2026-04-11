// React import removed as unused with modern JSX transform
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = new Date().toLocaleDateString();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(createPageUrl("Landing"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Button variant="ghost" size="sm" className="mb-4" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-600 mb-8">Last updated: {lastUpdated}</p>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Who we are</h2>
            <p className="text-slate-700">
              FACT: Find a Coach Today (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a platform connecting clients and coaches for football coaching sessions.
              We act as the data controller for information you provide directly to our platform. For questions, contact:
              <span className="font-medium"> privacy@findacoachtoday.com</span>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Personal data we collect</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>Identity and profile: name, profile picture, bio, user type (client/coach).</li>
              <li>Contact details: email address and phone number (not publicly displayed).</li>
              <li>Location: general address (e.g., city/area) for matching and discovery.</li>
              <li>Coach data: services offered, hourly rate, availability, ratings.</li>
              <li>Booking data: session details, price, messages between parties, reviews.</li>
              <li>Usage data: device, log and analytics information for performance and security.</li>
              <li>Cookies and similar tech: for essential operation, security, and preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">How we use your data (lawful bases)</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>Provide and operate the service, facilitate bookings and messaging (Contract necessity).</li>
              <li>Personalize discovery and improve the platform (Legitimate interests).</li>
              <li>Communicate updates, service messages, and support (Contract/Legitimate interests).</li>
              <li>Process payments and prevent fraud (Contract/Legal obligation/Legitimate interests).</li>
              <li>With consent, show profiles publicly (e.g., coach listings) and send optional marketing (Consent).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Sharing your data</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>With other users as needed to fulfil bookings (e.g., names in chats and bookings).</li>
              <li>Service providers (hosting, analytics, payments). Payments are securely processed by Stripe.</li>
              <li>Authorities where required by law or to protect rights, safety, and security.</li>
            </ul>
            <p className="text-slate-700 mt-2">
              We do not sell your personal data. Public coach profiles never include email or phone.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">International transfers</h2>
            <p className="text-slate-700">
              Where data is transferred outside your region, we rely on appropriate safeguards such as Standard Contractual Clauses or equivalent lawful mechanisms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Data retention</h2>
            <p className="text-slate-700">
              We keep data only as long as necessary for the purposes described above, including legal, accounting and reporting requirements. You may request deletion where applicable (see “Your rights”).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Your rights</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>Access, rectification, deletion and portability of your data.</li>
              <li>Restriction or objection to processing (where applicable).</li>
              <li>Withdraw consent at any time (where processing is based on consent).</li>
              <li>Complain to your data protection authority if you believe your rights are infringed.</li>
            </ul>
            <p className="text-slate-700 mt-2">
              To exercise rights, email <span className="font-medium">privacy@findacoachtoday.com</span>. We may verify your identity before actioning your request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Children</h2>
            <p className="text-slate-700">
              Our service is not directed to children under 16. If you believe a child has provided us personal data, contact us to remove it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Cookies</h2>
            <p className="text-slate-700">
              We use essential cookies for authentication and security, and functional cookies for preferences. You can control cookies via browser settings. Some features may not work without essential cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Changes</h2>
            <p className="text-slate-700">
              We may update this policy from time to time. We will post the updated version here and update the “Last updated” date.
            </p>
          </section>

          <div className="pt-4 border-t">
            <Link to={createPageUrl("Landing")} className="text-blue-600 hover:underline">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}