import { useMemo, useRef } from "react";
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
    id: "coach-background-required",
    role: "coach",
    category: "verification",
    q: "Do I need a background-check file if I select yes?",
    a: "Yes. If you mark that you have a background check, you must upload the supporting document before compliance can be submitted successfully.",
    keywords: ["background", "document", "required"]
  },
  {
    id: "coach-rejected-docs",
    role: "coach",
    category: "verification",
    q: "What happens if a document is rejected?",
    a: "You will see rejection status and admin notes in your coach profile. Upload an updated document and save again to return it to pending review.",
    keywords: ["rejected", "notes", "resubmit"]
  },
  {
    id: "coach-edit-profile-visibility",
    role: "coach",
    category: "onboarding",
    q: "Which parts of my profile are visible to clients?",
    a: "Your public coaching profile fields, services, and media can be visible to clients. Keep contact and qualification details accurate and professional.",
    keywords: ["public", "profile", "visibility"]
  },
  {
    id: "coach-cancel-session",
    role: "coach",
    category: "bookings",
    q: "How do I cancel a confirmed booking?",
    a: "Use your dashboard booking actions to cancel and include a reason where prompted. The booking status updates and appears in cancelled history.",
    keywords: ["cancel", "confirmed", "reason"]
  },
  {
    id: "coach-session-status",
    role: "coach",
    category: "bookings",
    q: "What are session statuses like pending, confirmed, completed?",
    a: "Pending means awaiting action, confirmed means accepted/scheduled, completed means session finished, and cancelled means the booking was cancelled.",
    keywords: ["status", "pending", "confirmed", "completed", "cancelled"]
  },
  {
    id: "coach-payout-question",
    role: "coach",
    category: "payments",
    q: "Who do I contact about payment issues?",
    a: "Use in-app messages or support email with your booking reference and date so support can investigate quickly.",
    keywords: ["payments", "payout", "support"]
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
    id: "client-booking-create",
    role: "client",
    category: "bookings",
    q: "How do I create a booking?",
    a: "Open a coach profile, choose a service/session option, and submit your booking request. You can then track status in My Bookings.",
    keywords: ["create", "new booking", "request"]
  },
  {
    id: "client-reschedule",
    role: "client",
    category: "bookings",
    q: "Can I reschedule a session?",
    a: "Yes, where reschedule options are available. Submit a reschedule request from booking actions and wait for confirmation.",
    keywords: ["reschedule", "change date", "booking actions"]
  },
  {
    id: "client-cancel",
    role: "client",
    category: "bookings",
    q: "How do I cancel a booking?",
    a: "Use the cancel action in booking details, provide context if requested, and check the cancelled tab afterward.",
    keywords: ["cancel booking", "cancelled tab"]
  },
  {
    id: "client-review",
    role: "client",
    category: "onboarding",
    q: "When can I leave a review?",
    a: "Reviews are typically submitted after completed sessions. Open the relevant booking and use the review option when available.",
    keywords: ["review", "feedback", "completed"]
  },
  {
    id: "client-security",
    role: "client",
    category: "security",
    q: "What should I do if I suspect unauthorized account access?",
    a: "Change your password, revoke active sessions, and contact support with the approximate time and affected actions.",
    keywords: ["unauthorized", "security", "revoke sessions"]
  },
  {
    id: "client-payment-proof",
    role: "client",
    category: "payments",
    q: "What should I include in a payment support request?",
    a: "Include booking reference, date/time, amount, and screenshots of any error so support can verify transaction records faster.",
    keywords: ["payment", "receipt", "amount", "support"]
  },
  {
    id: "admin-verification-dot",
    role: "admin",
    category: "verification",
    q: "When does the red dot appear on Verifications?",
    a: "The red indicator appears when there are pending coach verification items in the admin queue.",
    keywords: ["admin", "red dot", "verifications"]
  },
  {
    id: "admin-messages-dot",
    role: "admin",
    category: "messaging",
    q: "When does the red dot appear on Messages?",
    a: "The red indicator appears when unread direct message threads exist for the admin account.",
    keywords: ["admin", "messages", "unread", "red dot"]
  },
  {
    id: "admin-verification-process",
    role: "admin",
    category: "verification",
    q: "How should admin review coach compliance files?",
    a: "Open the verification queue, review uploaded qualification/background files, leave notes where needed, and set approve/reject statuses accordingly.",
    keywords: ["admin", "review", "approve", "reject"]
  },
  {
    id: "admin-direct-message",
    role: "admin",
    category: "messaging",
    q: "Are admin messages always tied to bookings?",
    a: "No. Admin/support can message users directly without a booking, and those conversations appear as direct threads.",
    keywords: ["direct", "booking_id", "support"]
  },
  {
    id: "admin-audit",
    role: "admin",
    category: "security",
    q: "Where do I check key admin actions?",
    a: "Use Admin Audit Logs and Operations pages to inspect critical actions, account events, and platform activity.",
    keywords: ["audit", "operations", "logs"]
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
  payments: "Payments",
  support: "Support",
  security: "Security"
};

export default function Help() {
  const [userType, setUserType] = useState("client");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const lastTrackedRef = useRef("");

  const roleLabel = userType === "coach" ? "coach" : userType === "admin" ? "admin" : "client";

  const trackHelpEvent = (eventName, params = {}) => {
    try {
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", eventName, { help_role: roleLabel, ...params });
      }
    } catch {
      // Ignore analytics failures
    }
  };

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
    return faqItems.filter((item) => item.role === "both" || item.role === roleLabel);
  }, [roleLabel]);

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

  useEffect(() => {
    const key = `${roleLabel}|${activeCategory}|${searchTerm.trim().toLowerCase()}|${filteredFaq.length}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;

    if (searchTerm.trim()) {
      trackHelpEvent("help_search", {
        query: searchTerm.trim().slice(0, 80),
        category: activeCategory,
        results: filteredFaq.length
      });
    }

    if (searchTerm.trim() && filteredFaq.length === 0) {
      trackHelpEvent("help_no_results", {
        query: searchTerm.trim().slice(0, 80),
        category: activeCategory
      });
    }
  }, [activeCategory, filteredFaq.length, roleLabel, searchTerm]);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Help & FAQs</h1>
          <p className="text-slate-600">
            Find answers fast with role-specific guidance for {roleLabel === "coach" ? "coaches" : roleLabel === "admin" ? "admins" : "clients"}.
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
                  onClick={() => {
                    setActiveCategory(category);
                    trackHelpEvent("help_category_select", { category });
                  }}
                >
                  {categoryLabels[category] || category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{roleLabel === "coach" ? "Coach FAQs" : roleLabel === "admin" ? "Admin FAQs" : "Client FAQs"}</CardTitle>
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
