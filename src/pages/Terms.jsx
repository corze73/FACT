// React import removed as unused with modern JSX transform
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Terms() {
  const lastUpdated = new Date().toLocaleDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms and Conditions</h1>
        <p className="text-slate-600 mb-8">Last updated: {lastUpdated}</p>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Agreement to Terms</h2>
            <p className="text-slate-700">
              These Terms govern your access to and use of FACT: Find a Coach Today (the “Service”). By creating an account or using the Service, you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Our role</h2>
            <p className="text-slate-700">
              We provide a marketplace that connects clients with independent coaches. We are not a party to coaching agreements between clients and coaches. Coaches operate independently and are responsible for their services and compliance with applicable laws and qualifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Accounts and eligibility</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>You must provide accurate information and keep your account secure.</li>
              <li>Coaches warrant they hold appropriate experience, insurance, and certifications where required.</li>
              <li>You must be at least 16, or the age of consent in your jurisdiction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Bookings, fees and payments</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>Clients request sessions; coaches may accept or decline.</li>
              <li>Session prices are set by coaches; an administration fee may apply and will be shown prior to checkout.</li>
              <li>Payments are processed securely by our payment provider (e.g., Stripe). You authorize charges for sessions and applicable fees.</li>
              <li>Cancellation and rescheduling policies are determined by the coach unless otherwise stated by the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Reviews and conduct</h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-1">
              <li>Reviews must be fair, accurate, and non-abusive. We may moderate or remove content that violates these Terms.</li>
              <li>You agree not to misuse the Service, including spamming, harassing, scraping, reverse engineering, or infringing third‑party rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Safety and responsibility</h2>
            <p className="text-slate-700">
              You are responsible for your interactions. Coaches are solely responsible for their coaching services and safety practices. Always assess suitability and, where appropriate, supervise minors and use safe venues/equipment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Intellectual property</h2>
            <p className="text-slate-700">
              The Service and its content are protected by intellectual property laws. You may not copy, reproduce, or create derivative works without permission. You grant us a limited license to host and display content you submit for operating the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">8. Disclaimers and limitation of liability</h2>
            <p className="text-slate-700">
              The Service is provided “as is”. To the maximum extent permitted by law, we disclaim warranties and limit liability for indirect or consequential losses. Nothing excludes liability that cannot be excluded by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">9. Termination</h2>
            <p className="text-slate-700">
              We may suspend or terminate access for breach of these Terms or to protect users. You may stop using the Service at any time. Certain provisions survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">10. Governing law</h2>
            <p className="text-slate-700">
              These Terms are governed by the laws of your operating jurisdiction (e.g., United Kingdom). Courts in that jurisdiction shall have exclusive jurisdiction, except where consumer laws provide otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">11. Changes</h2>
            <p className="text-slate-700">
              We may update these Terms from time to time. We will post changes here with the “Last updated” date. Continued use constitutes acceptance of the updated Terms.
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