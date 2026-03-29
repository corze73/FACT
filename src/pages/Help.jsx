import { useMemo } from "react";
import { User } from "@/api/entities.jsx";
import { createPageUrl, normalizeUserType } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Search } from "lucide-react";

const faqItems = [
  {
    id: "coach-verification-flow",
    role: "coach",
    category: "verification",
    q: "How does coach verification work?",
    a: "Upload your qualification and background-check documentation in your coach profile. Once submitted, your documents move to pending and are reviewed by admin.",
    keywords: ["verification", "compliance", "admin", "approval"]
  },
  {
    id: "coach-awaiting-approval",
    role: "coach",
    category: "verification",
    q: "What does 'Awaiting Approval' mean?",
    a: "It means your documents are in the admin verification queue. You can still access your account while review is in progress, but final verification actions depend on admin review.",
    keywords: ["pending", "approval", "status"]
  },
  {
    id: "coach-no-bookings",
    role: "coach",
    category: "bookings",
    q: "Why do I not see bookings yet?",
    a: "Bookings only appear after clients create sessions with you. New coaches will often see an empty list at first.",
    keywords: ["empty", "dashboard", "my bookings"]
  },
  {
    id: "coach-direct-messages",
    role: "coach",
    category: "messaging",
    q: "Can I message users without a booking?",
    a: "Yes. Admin/support messages can be direct messages that are not tied to a booking.",
    keywords: ["admin", "support", "direct", "conversation"]
  },
  {
    id: "client-find-coach",
    role: "client",
    category: "onboarding",
    q: "How do I find the right coach?",
    a: "Use filters for service type, location, and profile details, then compare coach profiles and reviews before booking.",
    keywords: ["find", "filter", "search", "coach"]
  },
  {
    id: "client-my-bookings",
    role: "client",
    category: "bookings",
    q: "Where are my bookings?",
    a: "Open My Bookings to see upcoming, past, and cancelled sessions.",
    keywords: ["upcoming", "past", "cancelled"]
  },
  {
    id: "client-messaging",
    role: "client",
    category: "messaging",
    q: "How does messaging work?",
    a: "Messages can be tied to a booking, and you may also receive direct support/admin messages.",
    keywords: ["chat", "conversation", "support"]
  },
  {
    id: "client-support",
    role: "client",
    category: "support",
    q: "Who do I contact for support?",
    a: "Use in-app messages for support contact or email support@findacoachtoday.com.",
    keywords: ["help", "support", "contact"]
  },
  {
    id: "both-booking-reference",
    role: "both",
    category: "bookings",
    q: "What is a booking reference used for?",
    a: "Your booking reference helps support quickly locate session details and investigate booking or payment queries.",
    keywords: ["reference", "support", "booking id"]
  },
  {
    id: "both-account-security",
    role: "both",
    category: "security",
    q: "What should I do if account details look wrong?",
    a: "Update your profile immediately and revoke sessions from account tools if needed, then message support so we can review account activity.",
    keywords: ["security", "revoke sessions", "account"]
  }
];

const categoryLabels = {
  all: "All",
  onboarding: "Getting Started",
  verification: "Verification",
  bookings: "Bookings",
  messaging: "Messaging",
  support: "Support",
  security: "Security"
};

export default function Help() {
  const [userType, setUserType] = useState("client");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

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

  const roleScopedFaq = useMemo(() => {
    return faqItems.filter((item) => item.role === "both" || item.role === userType);
  }, [userType]);

  const categories = useMemo(() => {
    const unique = ["all", ...new Set(roleScopedFaq.map((item) => item.category))];
    return unique;
  }, [roleScopedFaq]);

  const filteredFaq = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return roleScopedFaq.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.category === activeCategory;
      if (!categoryMatch) return false;
      if (!term) return true;

      const haystack = [item.q, item.a, ...(item.keywords || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [roleScopedFaq, activeCategory, searchTerm]);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Help & FAQs</h1>
          <p className="text-slate-600">
            Find answers fast with role-specific guidance for {userType === "coach" ? "coaches" : "clients"}.
          </p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Search Help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search topics, e.g. verification, messages, bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() => setActiveCategory(category)}
                >
                  {categoryLabels[category] || category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{userType === "coach" ? "Coach FAQs" : "Client FAQs"}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaq.length === 0 ? (
              <p className="text-sm text-slate-600">
                No FAQ entries matched your search. Try a broader term or switch category.
              </p>
            ) : (
              <Accordion type="multiple" className="w-full">
                {filteredFaq.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-slate-50/80">
          <CardHeader>
            <CardTitle>Still Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="gap-2">
              <Link to={createPageUrl("Messages")}>
                <MessageCircle className="w-4 h-4" />
                Open Messages
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="mailto:support@findacoachtoday.com">
                <Mail className="w-4 h-4" />
                Email Support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
