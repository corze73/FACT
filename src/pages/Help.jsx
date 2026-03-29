import { useMemo } from "react";
import { User } from "@/api/entities.jsx";
import { normalizeUserType } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const coachFaq = [
  {
    q: "How does coach verification work?",
    a: "Upload your qualification and background-check documentation in your profile. Your status moves to pending and an admin reviews it."
  },
  {
    q: "What does 'Awaiting Approval' mean?",
    a: "It means your documents are in the admin verification queue. You can still access your account while review is in progress."
  },
  {
    q: "Why do I not see bookings yet?",
    a: "Bookings only appear after clients create sessions with you. New coaches will typically see an empty list initially."
  },
  {
    q: "Can I message users without a booking?",
    a: "Yes. Admin/support messages can be direct messages that are not tied to a booking."
  }
];

const clientFaq = [
  {
    q: "How do I find the right coach?",
    a: "Use filters for service type, location, and profile details, then compare coach profiles and reviews."
  },
  {
    q: "Where are my bookings?",
    a: "Open My Bookings to see upcoming, past, and cancelled sessions."
  },
  {
    q: "How does messaging work?",
    a: "Messages can be tied to a booking, and you may also receive direct support/admin messages."
  },
  {
    q: "Who do I contact for support?",
    a: "Use the in-app messaging area for support messages or email support@findacoachtoday.com."
  }
];

export default function Help() {
  const [userType, setUserType] = useState("client");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const me = await User.me();
        if (isMounted) {
          setUserType(normalizeUserType(me?.user_type) || "client");
        }
      } catch {
        if (isMounted) setUserType("client");
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const faqItems = useMemo(() => (userType === "coach" ? coachFaq : clientFaq), [userType]);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Help & FAQs</h1>
          <p className="text-slate-600">
            Quick answers for {userType === "coach" ? "coaches" : "clients"}. We can expand this section with your full FAQ set next.
          </p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{userType === "coach" ? "Coach FAQs" : "Client FAQs"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
